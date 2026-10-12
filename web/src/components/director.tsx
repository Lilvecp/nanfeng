"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { AGENT_STEPS } from "@/lib/demo-replay";
import { CHERRY_PLAN, SANDBOX_OTP, useDesk } from "@/lib/desk-state";
import { SCENES, director, useDirector } from "@/lib/director";
import { useLang } from "@/lib/i18n";
import { getToken, requestLogin } from "@/lib/owner-session";
import { setPref, type Lang } from "@/lib/prefs";

// Demo tour across the real app (fe-10). Mounted in the desk layout; while it runs it drives the
// screens (route, spotlight, caption) and makes each step really happen: on the live API through
// the Demo Mode replay (POST /demo/step/n), offline on the shared desk state.

const LABELS: Record<Lang, string[]> = {
  en: ["DELAY", "FORECAST", "QUOTES", "PLAN", "APPROVE", "CLOSED"],
  es: ["ATRASO", "PRONÓSTICO", "COTIZACIONES", "PLAN", "APROBAR", "CERRADA"],
  zh: ["延迟", "预测", "报价", "方案", "批准", "补足"],
};
const UI: Record<Lang, Record<string, string>> = {
  en: { prev: "Previous", next: "Next", play: "Play", pause: "Pause", exit: "Exit tour", replay: "Watch again", live: "LIVE BACKEND", offline: "OFFLINE", start: "Tour the app", end: "End of the tour" },
  es: { prev: "Anterior", next: "Siguiente", play: "Reproducir", pause: "Pausa", exit: "Salir del recorrido", replay: "Ver de nuevo", live: "BACKEND EN VIVO", offline: "SIN RED", start: "Recorrer la app", end: "Fin del recorrido" },
  zh: { prev: "上一步", next: "下一步", play: "播放", pause: "暂停", exit: "退出导览", replay: "再看一次", live: "实时后端", offline: "离线", start: "浏览应用", end: "导览结束" },
};

type Box = { top: number; left: number; width: number; height: number };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function boxOf(id: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-guide="${id}"]`);
  const r = el?.getBoundingClientRect();
  return r && (r.width || r.height) ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}

/** Types the code into the Approvals boxes and submits, the way the owner would. */
async function approveOnScreen(code: string) {
  for (let tries = 0; tries < 20 && !document.querySelector(".otp input"); tries++) await wait(150);
  const boxes = [...document.querySelectorAll<HTMLInputElement>(".otp input")];
  if (boxes.length < 6) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  for (let i = 0; i < 6; i++) {
    setter?.call(boxes[i], code[i]);
    boxes[i].dispatchEvent(new Event("input", { bubbles: true }));
    await wait(220);
  }
  await wait(400);
  boxes[0].closest("form")?.requestSubmit();
  return true;
}

/** Starts the tour: owner sign-in first on the live API (so it never pops up mid-video), then a clean sandbox. */
export function useStartTour() {
  const { mode, resetDemo } = useDesk();
  return useCallback(async () => {
    if (mode === "live") {
      if (!getToken()) {
        try {
          await requestLogin();
        } catch {
          return;
        }
      }
      await api.demo.step(1, { agent_steps: AGENT_STEPS[1] }).catch(() => {});
    } else {
      await resetDemo();
    }
    setPref("view", "simple");
    director.start();
  }, [mode, resetDemo]);
}

export function Director() {
  const t = useDirector();
  const lang = useLang();
  const u = UI[lang];
  const router = useRouter();
  const pathname = usePathname();
  const { mode, approval, finishDemo, notify } = useDesk();
  const startTour = useStartTour();
  const [box, setBox] = useState<Box | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(new Set<number>([1])); // replay steps already played this take (1 = at start)
  const chain = useRef<Promise<unknown>>(Promise.resolve()); // replay calls go out strictly in order
  const scene = SCENES[t.scene];
  const last = t.scene === SCENES.length - 1;

  // a new take starts with only step 1 played
  useEffect(() => {
    if (t.active && t.scene === 0) {
      ran.current = new Set([1]);
      chain.current = Promise.resolve();
    }
  }, [t.active, t.scene]);

  // go to the scene's screen
  useEffect(() => {
    if (!t.active) return;
    if (pathname !== scene.route) router.push(scene.route);
  }, [t.active, scene, pathname, router]);

  // open the right document on the Documents screen
  useEffect(() => {
    if (!t.active || !scene.doc || pathname !== scene.route) return;
    const id = setTimeout(() => window.dispatchEvent(new CustomEvent("nanfeng:select-doc", { detail: scene.doc })), 300);
    return () => clearTimeout(id);
  }, [t.active, scene, pathname]);

  // light up the part that matters, following it while the page settles or scrolls
  useEffect(() => {
    if (!t.active || pathname !== scene.route) return;
    let prev = "";
    const update = () => {
      const b = boxOf(scene.target);
      const key = b ? `${Math.round(b.top)},${Math.round(b.left)},${Math.round(b.width)},${Math.round(b.height)}` : "";
      if (key !== prev) {
        prev = key;
        setBox(b);
      }
    };
    const first = setTimeout(() => {
      document.querySelector(`[data-guide="${scene.target}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
    const poll = setInterval(update, 120);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      window.removeEventListener("scroll", update, true);
      setBox(null);
    };
  }, [t.active, scene, pathname]);

  // make the scene's step really happen (once per take, strictly in order). A step is played on the
  // last scene that belongs to it ("closed" at the very end), the approval right after it is typed.
  useEffect(() => {
    if (!t.active || pathname !== scene.route) return;
    let cancelled = false;
    const live = mode === "live";
    const play = (n: number) => {
      if (ran.current.has(n)) return chain.current;
      ran.current.add(n);
      if (!live) return chain.current;
      chain.current = chain.current
        .then(() => api.demo.step(n, { agent_steps: AGENT_STEPS[n], plan: n === 4 || n === 5 ? CHERRY_PLAN : undefined }))
        .catch((err) => setError(err instanceof ApiError ? `HTTP ${err.status}` : "Backend unreachable"));
      return chain.current;
    };
    const lastOfStep = SCENES.findLastIndex((s) => s.step === scene.step) === t.scene;
    (async () => {
      for (let n = 2; n < scene.step; n++) if (n !== 5) void play(n); // jumped ahead: catch up
      if (scene.action === "approve") {
        await wait(1200);
        if (cancelled) return;
        if (approval !== "approved") await approveOnScreen(SANDBOX_OTP);
        void play(5); // live: publishes the step; the approval itself just happened on screen
      } else if (lastOfStep && scene.step !== 5) {
        void play(scene.step);
      }
      if (last && !live) finishDemo();
    })();
    return () => {
      cancelled = true;
    };
    // approval is read when the scene starts; re-running on its change would approve twice
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.active, scene, pathname, mode]);

  // advance by itself while playing
  useEffect(() => {
    if (!t.active || !t.playing) return;
    const id = setTimeout(() => director.next(), scene.ms);
    return () => clearTimeout(id);
  }, [t.active, t.playing, t.scene, scene.ms]);

  // keyboard: space play/pause, arrows, Esc to leave
  useEffect(() => {
    if (!t.active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " ") director.toggle();
      else if (e.key === "ArrowRight") director.next();
      else if (e.key === "ArrowLeft") director.prev();
      else if (e.key === "Escape") director.stop();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [t.active]);

  useEffect(() => {
    if (error) notify(error);
  }, [error, notify]);

  if (!t.active) return null;
  const pad = 8;
  const label = LABELS[lang][scene.step - 1];

  return (
    <>
      {box && (
        <div className="director-spot" aria-hidden="true"
          style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      )}
      <div className="director-bar" role="region" aria-label="Demo tour">
        <div className="director-caption" aria-live="polite">
          <span className="director-step mono">0{scene.step}/06 · {label}</span>
          <span className="director-text">{scene.caption[lang]}</span>
        </div>
        <div className="director-progress">
          <i key={`${t.scene}-${t.playing}`} style={{ animationDuration: `${scene.ms}ms`, animationPlayState: t.playing ? "running" : "paused" }} />
        </div>
        <div className="director-ctl">
          <span className={`badge${mode === "live" ? " ok" : ""}`}>{mode === "live" ? u.live : u.offline}</span>
          <div className="director-dots" aria-hidden="true">
            {SCENES.map((s, i) => <button key={i} type="button" tabIndex={-1} className={i === t.scene ? "on" : i < t.scene ? "done" : undefined} onClick={() => director.go(i)} />)}
          </div>
          <span style={{ flex: 1 }} />
          <button className="ctl" type="button" aria-label={u.prev} title={u.prev} onClick={director.prev} disabled={t.scene === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          {last && !t.playing ? (
            <button className="ctl ctl-main" type="button" aria-label={u.replay} title={u.replay} onClick={() => void startTour()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5" /></svg>
            </button>
          ) : (
            <button className="ctl ctl-main" type="button" aria-label={t.playing ? u.pause : u.play} title={t.playing ? u.pause : u.play} onClick={director.toggle}>
              {t.playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          )}
          <button className="ctl" type="button" aria-label={u.next} title={u.next} onClick={director.next} disabled={last}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={director.stop}>{u.exit}</button>
        </div>
      </div>
    </>
  );
}

/** Button that starts the tour (Demo page, or anywhere in the desk). */
export function TourButton({ className = "btn btn-primary btn-sm" }: { className?: string }) {
  const u = UI[useLang()];
  const start = useStartTour();
  return <button className={className} type="button" onClick={() => void start()}>{u.start}</button>;
}
