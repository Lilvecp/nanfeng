"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { isLite, useLiteClass } from "@/lib/perf";
import type { Lang } from "@/lib/prefs";
import { N } from "@/lib/scenario";

/** Splits a headline into words (characters for languages without spaces) that fly in one after another. React-owned, so language switches stay safe. */
export function Words({ text, base = 0 }: { text: string; base?: number }) {
  const parts = text.includes(" ") ? text.split(" ") : Array.from(text);
  const spaced = text.includes(" ");
  return (
    <>
      {parts.map((w, i) => (
        <span key={i} className="fx-w" style={{ "--w": base + i } as React.CSSProperties}>
          {w}
          {spaced && i < parts.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

/** "50/50", "−41%", "46/46": every number in the string counts up from zero the first time it is on screen.
 *  The server HTML carries the real value (crawlers, link previews, no JS); it only drops to zero while still off screen. */
export function CountUp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let primed = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) {
        if (!primed) { primed = true; setK(0); }
        return;
      }
      io.disconnect();
      if (!primed) return; // already on screen at load: keep the real value, no count from zero
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1600);
        setK(1 - Math.pow(1 - p, 4));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return <span ref={ref}>{text.replace(/\d+(?:[.,]\d+)?/g, (m) => String(Math.round(parseFloat(m.replace(",", ".")) * k)))}</span>;
}

const TICKER: Record<Lang, string[]> = {
  en: [`${N.pNeg} cash-out risk caught`, `${N.crunchDay} days of warning`, `${N.savingsPct} cheaper than the bank`, `${N.rtStopped}/${N.rtAttacks} attacks stopped`, `${N.benchSolved}/${N.benchCases} benchmark cases solved`, "hash-chained audit", "WhatsApp · WeCom · voice", "one-time code to move money"],
  es: [`${N.pNeg} de riesgo detectado`, `${N.crunchDay} días de anticipación`, `${N.savingsPct} más barato que el banco`, `${N.rtStopped}/${N.rtAttacks} ataques frenados`, `${N.benchSolved}/${N.benchCases} casos resueltos`, "auditoría encadenada", "WhatsApp · WeCom · voz", "código de un uso para mover plata"],
  zh: [`${N.pNeg} 现金风险已预警`, `提前 ${N.crunchDay} 天`, `比银行便宜 ${N.savingsPct}`, `${N.rtStopped}/${N.rtAttacks} 次攻击拦截`, `${N.benchSolved}/${N.benchCases} 基准案例通过`, "哈希链审计", "WhatsApp · 企业微信 · 语音", "一次性验证码才能动用资金"],
};

/** Endless strip of proof points under the hero. */
export function Ticker() {
  const items = TICKER[useLang()];
  const row = (k: string) => (
    <div className="fx-tick-row" aria-hidden={k === "b"}>
      {items.map((t, i) => <span key={`${k}${i}`}><i />{t}</span>)}
    </div>
  );
  return <div className="fx-ticker" role="marquee"><div className="fx-tick-track">{row("a")}{row("b")}</div></div>;
}

/**
 * The motion layer of the landing page (the entrance curtain is components/load-curtain.tsx): scroll progress bar, pointer aura,
 * hero orbs that follow the mouse, scroll-linked parallax (--p per [data-scroll]), magnetic buttons
 * and 3D tilt with glare on cards. Everything is skipped for reduced motion and touch pointers.
 */
export function LandingFx() {
  const bar = useRef<HTMLDivElement>(null);
  const aura = useRef<HTMLDivElement>(null);
  useLiteClass();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches && !isLite();
    const root = document.documentElement;
    root.classList.add("fx-on");
    if (reduce) return () => root.classList.remove("fx-on");
    const cleanups: (() => void)[] = [];

    // Offscreen = paused: animated decoration (orbs, ticker) stops when it is not on screen.
    const pausables = Array.from(document.querySelectorAll<HTMLElement>(".fx-ticker,.fx-hero"));
    const pio = new IntersectionObserver((es) => es.forEach((e) => e.target.toggleAttribute("data-paused", !e.isIntersecting)), { rootMargin: "80px" });
    pausables.forEach((el) => pio.observe(el));
    cleanups.push(() => pio.disconnect());

    // scroll: progress bar + per-element progress through the viewport (0 → 1). One rAF per frame, reads then writes.
    const scrollEls = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll]"));
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const vh = window.innerHeight;
        const ps = scrollEls.map((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom < -200 || r.top > vh + 200 ? null : Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
        });
        bar.current?.style.setProperty("--prog", String(max > 0 ? window.scrollY / max : 0));
        scrollEls.forEach((el, i) => ps[i] !== null && el.style.setProperty("--p", (ps[i] as number).toFixed(3)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    cleanups.push(() => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); });

    if (fine) {
      // pointer light (lerped, loop sleeps once it settles) + mouse position for the hero orbs (set on the hero only)
      const hero = document.querySelector<HTMLElement>(".fx-hero");
      let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0, moveRaf = 0;
      const loop = () => {
        x += (tx - x) * 0.16;
        y += (ty - y) * 0.16;
        if (aura.current) aura.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
        raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.4 ? requestAnimationFrame(loop) : 0;
      };
      let ev: PointerEvent | null = null;
      const onMove = (e: PointerEvent) => {
        tx = e.clientX; ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(loop);
        ev = e;
        if (moveRaf) return;
        moveRaf = requestAnimationFrame(() => {
          moveRaf = 0;
          if (!ev) return;
          if (hero && !hero.hasAttribute("data-paused")) {
            hero.style.setProperty("--mx", String((ev.clientX / innerWidth - 0.5) * 2));
            hero.style.setProperty("--my", String((ev.clientY / innerHeight - 0.5) * 2));
          }
          const hot = (ev.target as HTMLElement).closest?.("a,button,[data-tilt],.vcard,.chip");
          aura.current?.toggleAttribute("data-hot", !!hot);
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => { cancelAnimationFrame(raf); cancelAnimationFrame(moveRaf); window.removeEventListener("pointermove", onMove); });

      // magnetic buttons and 3D tilt: the rect is measured once on enter, writes are batched per frame
      const bind = (els: NodeListOf<HTMLElement>, onEnterCls: string | null, apply: (el: HTMLElement, e: PointerEvent, r: DOMRect) => void, reset: (el: HTMLElement) => void) => {
        els.forEach((el) => {
          let r: DOMRect | null = null, f = 0, last: PointerEvent | null = null;
          const enter = () => { r = el.getBoundingClientRect(); };
          const mv = (e: PointerEvent) => {
            if (!r) r = el.getBoundingClientRect();
            last = e;
            if (f) return;
            f = requestAnimationFrame(() => { f = 0; if (last && r) apply(el, last, r); });
          };
          const lv = () => { r = null; cancelAnimationFrame(f); f = 0; reset(el); };
          if (onEnterCls) el.classList.add(onEnterCls);
          el.addEventListener("pointerenter", enter);
          el.addEventListener("pointermove", mv);
          el.addEventListener("pointerleave", lv);
          cleanups.push(() => { cancelAnimationFrame(f); el.removeEventListener("pointerenter", enter); el.removeEventListener("pointermove", mv); el.removeEventListener("pointerleave", lv); if (onEnterCls) el.classList.remove(onEnterCls); });
        });
      };
      bind(document.querySelectorAll<HTMLElement>(".lp .pill-cherry,.lp .pill-out,.lp .pill-sm,.lp .team-cta"), "fx-mag",
        (el, e, r) => { el.style.setProperty("--tx", `${(e.clientX - (r.left + r.width / 2)) * 0.18}px`); el.style.setProperty("--ty", `${(e.clientY - (r.top + r.height / 2)) * 0.25}px`); },
        (el) => { el.style.setProperty("--tx", "0px"); el.style.setProperty("--ty", "0px"); });
      bind(document.querySelectorAll<HTMLElement>(".lp .card,.lp .final-flow"), null,
        (el, e, r) => {
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.setAttribute("data-tilt", "");
          el.style.setProperty("--rx", `${(0.5 - py) * 6}deg`); el.style.setProperty("--ry", `${(px - 0.5) * 7}deg`);
          el.style.setProperty("--gx", `${px * 100}%`); el.style.setProperty("--gy", `${py * 100}%`);
        },
        (el) => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    }

    return () => {
      cleanups.forEach((c) => c());
      root.classList.remove("fx-on");
    };
  }, []);

  return (
    <>
      <div className="fx-progress" ref={bar} aria-hidden="true" />
      <div className="fx-aura" ref={aura} aria-hidden="true" />
    </>
  );
}
