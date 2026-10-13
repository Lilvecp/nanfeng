"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SailMark } from "@/components/logo";
import { useCrisisNumbers, useDesk } from "@/lib/desk-state";
import { useDirector } from "@/lib/director";
import { GUIDE_UI, guideContent, markHelloSeen, markTourSeen, setAutoTours, setGuideOn, useAutoTours, useGuideOn, useHelloSeen, useTourSeen, type GuideStep } from "@/lib/guide";
import { useLang } from "@/lib/i18n";
import { usePref } from "@/lib/prefs";

// The sail button in the corner. First visit to a screen: it glides from part to part explaining
// each one (spotlight + bubble). After that it stays quiet until tapped, except for a dot when a
// decision is waiting. Turned off from the panel or from Settings.

const GAP = 14;
const EDGE = 16;
const NO_GUIDE = new Set(["/demo"]);

type Box = { top: number; left: number; width: number; height: number };

function findTarget(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-guide="${id}"]`);
}

function boxOf(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Bubble position next to the target: below if it fits, else above, else pinned to the bottom. */
function place(box: Box | null, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!box) return { top: Math.max(EDGE, (vh - h) / 2), left: Math.max(EDGE, (vw - w) / 2) };
  const left = Math.min(Math.max(box.left + box.width / 2 - w / 2, EDGE), vw - w - EDGE);
  const below = box.top + box.height + GAP;
  const above = box.top - GAP - h;
  const top = below + h <= vh - EDGE ? below : above >= EDGE ? above : vh - h - EDGE;
  return { top, left };
}

const HELLO = "__hello";

type CloseReason = "done" | "skip" | "later";

function Tour({ steps: pageSteps, hello, onClose }: { steps: GuideStep[]; hello: boolean; onClose: (why: CloseReason) => void }) {
  const ui = GUIDE_UI[useLang()];
  // First tour ever: the guide introduces itself in a centred bubble before the screen's steps.
  const steps = hello ? [{ target: HELLO, title: ui.helloTitle, body: ui.helloBody }, ...pageSteps] : pageSteps;
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [size, setSize] = useState({ w: 360, h: 200 });
  const [moving, setMoving] = useState(true);
  const bubble = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const isHello = step.target === HELLO;
  const n = hello ? i : i + 1; // step number among the screen's own steps

  // Bring the target into view, then follow it every frame: the page can shift under it (smooth
  // scroll, a notice closing, data arriving), and a stale spotlight would point at the wrong thing.
  useEffect(() => {
    const el = findTarget(step.target);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Scroll the page itself (scrollIntoView also scrolls clipped ancestors and shifts the layout).
    const r = el?.getBoundingClientRect();
    if (r && (r.top < 70 || r.bottom > window.innerHeight - 40)) {
      const top = window.scrollY + r.top - Math.max(80, (window.innerHeight - r.height) / 2);
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    }
    let frame = 0;
    let prev = "";
    const update = () => {
      const b = boxOf(findTarget(step.target));
      const key = b ? `${Math.round(b.top)},${Math.round(b.left)},${Math.round(b.width)},${Math.round(b.height)}` : "none";
      if (key !== prev) {
        prev = key;
        setBox(b);
      }
    };
    const loop = () => {
      update();
      frame = requestAnimationFrame(loop);
    };
    loop();
    // Browsers pause animation frames in hidden tabs and some recorders: keep a slower check too.
    const poll = setInterval(update, 200);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const settle = setTimeout(() => setMoving(false), 650);
    nextBtn.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(poll);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      clearTimeout(settle);
    };
  }, [step.target]);

  useLayoutEffect(() => {
    const b = bubble.current;
    if (b) setSize({ w: b.offsetWidth, h: b.offsetHeight });
  }, [i]);

  const go = useCallback((n: number) => {
    setMoving(true);
    setI(n);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose("later");
      else if (e.key === "ArrowRight") {
        if (last) onClose("done");
        else go(i + 1);
      }
      else if (e.key === "ArrowLeft" && i > 0) go(i - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [i, last, go, onClose]);

  const pos = place(box, size.w, size.h);
  const pad = 6;

  return (
    <div className="guide-layer">
      {box ? (
        <div className="guide-spot" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} aria-hidden="true" />
      ) : (
        <div className="guide-dim" aria-hidden="true" />
      )}
      <div ref={bubble} className={`guide-bubble${isHello ? " hello" : ""}`} role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-body" style={{ top: pos.top, left: pos.left }}>
        <span className={`guide-avatar${moving ? " moving" : ""}`} aria-hidden="true"><SailMark size={isHello ? 40 : 26} /></span>
        {!isHello && <span className="guide-count">{ui.step} {n} {ui.of} {pageSteps.length}</span>}
        <h2 id="guide-title" className="guide-title">{step.title}</h2>
        <p id="guide-body" className="guide-body" aria-live="polite">{step.body}</p>
        {!isHello && <div className="guide-dots" aria-hidden="true">{pageSteps.map((s, k) => <i key={s.target} className={k === n - 1 ? "on" : undefined} />)}</div>}
        <div className="guide-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => onClose(isHello ? "later" : "skip")}>{isHello ? ui.helloLater : ui.skip}</button>
          <span style={{ flex: 1 }} />
          {i > 0 && !(hello && i === 1) && <button className="btn btn-secondary btn-sm" type="button" onClick={() => go(i - 1)}>{ui.back}</button>}
          <button ref={nextBtn} className="btn btn-primary btn-sm" type="button" onClick={() => (last ? onClose("done") : go(i + 1))}>{isHello ? ui.helloGo : last ? ui.done : ui.next}</button>
        </div>
      </div>
    </div>
  );
}

export function Guide() {
  const pathname = usePathname();
  const lang = useLang();
  const ui = GUIDE_UI[lang];
  const on = useGuideOn();
  const touringDemo = useDirector().active; // the demo tour owns the screen while it runs
  const intro = usePref("intro");
  const view = usePref("view");
  // Home has two views with different parts, so each gets its own tour.
  const key = pathname === "/cockpit" && view === "detail" ? "/cockpit#detail" : pathname;
  const seen = useTourSeen(key);
  const auto = useAutoTours();
  const helloSeen = useHelloSeen();
  const { notify, approval, killSwitch, events } = useDesk();
  const { pendingCount } = useCrisisNumbers();
  // Both are tied to the route they were opened on, so moving to another screen closes them.
  const [tourOn, setTourOn] = useState<string | null>(null);
  const [panelOn, setPanelOn] = useState<string | null>(null);
  const touring = tourOn === key;
  const panel = panelOn === key;
  const setTouring = useCallback((v: boolean) => setTourOn(v ? key : null), [key]);
  const setPanel = useCallback((v: boolean | ((p: boolean) => boolean)) => {
    setPanelOn((cur) => ((typeof v === "function" ? v(cur === key) : v) ? key : null));
  }, [key]);
  const fab = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const page = guideContent(lang)[key];
  const steps = page?.steps;
  // On Home the owner's welcome card goes first; the tour waits until it is closed.
  const blocked = key === "/cockpit" && intro !== "seen";
  // Coming straight out of Demo Mode the viewer has just seen the story: no tour on top of it.
  const [prevPath, setPrevPath] = useState(pathname);
  const [fromDemo, setFromDemo] = useState(false);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setFromDemo(NO_GUIDE.has(prevPath));
  }
  const autoStart = on === true && auto && !!steps && !seen && !blocked && !fromDemo && !NO_GUIDE.has(pathname);

  // Short tips when something worth knowing happens, so the owner knows where to look next.
  type Tip = { text: string; href?: string; cta?: string };
  const [tip, setTip] = useState<Tip | null>(null);
  // Compare with the previous value during render (React's pattern for reacting to a change).
  const [lastApproval, setLastApproval] = useState(approval);
  if (approval !== lastApproval) {
    setLastApproval(approval);
    // Only a decision taken now: after a reload the saved state also "changes" from pending.
    if (approval === "approved" && lastApproval === "verifying") setTip({ text: ui.tipApproved, href: "/security", cta: ui.ctaSecurity });
    else if (approval === "rejected") setTip({ text: ui.tipRejected, href: "/financing", cta: ui.ctaFinancing });
  }
  const [lastKill, setLastKill] = useState(killSwitch);
  if (killSwitch !== lastKill) {
    setLastKill(killSwitch);
    if (killSwitch) setTip({ text: ui.tipKill });
  }
  // A blocked document reported on the live stream (Andy's guard writes security.* audit entries).
  // Only recent events count: the stream replays its history when the page connects.
  const lastEvent = useRef(0);
  useEffect(() => {
    const fresh = events.filter((e) => e.id > lastEvent.current && Date.now() - Date.parse(e.ts) < 30_000);
    lastEvent.current = events.length ? events[events.length - 1].id : lastEvent.current;
    if (!fresh.some((e) => e.type.startsWith("security.") || String(e.data.kind ?? "").startsWith("security."))) return;
    const t = setTimeout(() => setTip({ text: ui.tipBlocked, href: "/security", cta: ui.ctaSecurity }), 0);
    return () => clearTimeout(t);
  }, [events, ui]);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 14000);
    return () => clearTimeout(t);
  }, [tip]);

  useEffect(() => {
    if (!autoStart) return;
    const t = setTimeout(() => {
      setPanel(false);
      setTouring(true);
    }, 900);
    return () => clearTimeout(t);
  }, [autoStart, setPanel, setTouring]);

  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !fab.current?.contains(e.target as Node)) setPanel(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (setPanel(false), fab.current?.focus());
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [panel, setPanel]);

  const endTour = useCallback((why: CloseReason) => {
    setTouring(false);
    markTourSeen(key);
    markHelloSeen();
    // Skipping or "Not now" means the viewer does not want tours popping up: stop them everywhere.
    if (why !== "done" && auto) {
      setAutoTours(false);
      notify(ui.laterToast);
    }
    fab.current?.focus({ preventScroll: true });
  }, [key, setTouring, auto, notify, ui]);

  if (on !== true || NO_GUIDE.has(pathname) || touringDemo) return null;
  const nudge = pendingCount > 0 && pathname !== "/approvals";

  return (
    <>
      {touring && steps && <Tour key={key} steps={steps} hello={!helloSeen} onClose={endTour} />}
      {tip && !touring && !panel && (
        <div className="guide-tip" role="status">
          <SailMark size={20} />
          <span className="guide-body">{tip.text}</span>
          <div className="guide-actions">
            {tip.href && tip.href !== pathname && <Link className="btn btn-primary btn-sm" href={tip.href} onClick={() => setTip(null)}>{tip.cta}</Link>}
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setTip(null)}>{ui.dismiss}</button>
          </div>
        </div>
      )}
      {panel && page && (
        <div ref={panelRef} className="guide-panel" role="dialog" aria-label={ui.name}>
          <div className="guide-panel-h"><SailMark size={22} /><b>{ui.name}</b></div>
          <p className="guide-body">{page.summary}</p>
          {nudge && (
            <div className="guide-nudge">
              <span>{ui.pending}</span>
              <Link className="btn btn-cherry btn-sm" href="/approvals" onClick={() => setPanel(false)}>{ui.openApprovals}</Link>
            </div>
          )}
          <div className="guide-actions">
            {steps && <button className="btn btn-primary btn-sm" type="button" onClick={() => { setPanel(false); setTouring(true); }}>{ui.tour}</button>}
            <span style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setGuideOn(false); notify(ui.offToast); }}>{ui.off}</button>
          </div>
        </div>
      )}
      {!touring && (
        <button
          ref={fab}
          className={`guide-fab${auto && !seen && steps ? " fresh" : ""}`}
          type="button"
          aria-label={panel ? ui.close : ui.open}
          aria-expanded={panel}
          onClick={() => setPanel((p) => !p)}
        >
          <SailMark size={28} />
          {nudge && <span className="guide-fab-dot" aria-hidden="true" />}
        </button>
      )}
    </>
  );
}
