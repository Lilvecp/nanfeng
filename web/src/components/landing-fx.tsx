"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
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

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const root = document.documentElement;
    root.classList.add("fx-on");
    if (reduce) return () => root.classList.remove("fx-on");

    // scroll: progress bar + per-element progress through the viewport (0 → 1)
    const scrollEls = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll]"));
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        bar.current?.style.setProperty("--prog", String(max > 0 ? y / max : 0));
        root.style.setProperty("--sy", String(y));
        const vh = window.innerHeight;
        for (const el of scrollEls) {
          const r = el.getBoundingClientRect();
          const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
          el.style.setProperty("--p", p.toFixed(4));
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const cleanups: (() => void)[] = [];
    if (fine) {
      // pointer aura (lerped) + mouse position for the hero orbs
      let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0;
      const loop = () => {
        x += (tx - x) * 0.14;
        y += (ty - y) * 0.14;
        if (aura.current) aura.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const onMove = (e: PointerEvent) => {
        tx = e.clientX; ty = e.clientY;
        root.style.setProperty("--mx", String((e.clientX / innerWidth - 0.5) * 2));
        root.style.setProperty("--my", String((e.clientY / innerHeight - 0.5) * 2));
        const hot = (e.target as HTMLElement).closest("a,button,[data-tilt],.vcard,.chip");
        aura.current?.toggleAttribute("data-hot", !!hot);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); });

      // magnetic buttons
      const mags = document.querySelectorAll<HTMLElement>(".lp .pill-cherry,.lp .pill-out,.lp .pill-sm,.lp .team-cta");
      mags.forEach((el) => {
        const mv = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty("--tx", `${(e.clientX - (r.left + r.width / 2)) * 0.18}px`);
          el.style.setProperty("--ty", `${(e.clientY - (r.top + r.height / 2)) * 0.25}px`);
        };
        const lv = () => { el.style.setProperty("--tx", "0px"); el.style.setProperty("--ty", "0px"); };
        el.classList.add("fx-mag");
        el.addEventListener("pointermove", mv);
        el.addEventListener("pointerleave", lv);
        cleanups.push(() => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerleave", lv); el.classList.remove("fx-mag"); });
      });

      // 3D tilt + glare
      const tilts = document.querySelectorAll<HTMLElement>(".lp .card,.lp .final-flow");
      tilts.forEach((el) => {
        const mv = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.style.setProperty("--rx", `${(0.5 - py) * 6}deg`);
          el.style.setProperty("--ry", `${(px - 0.5) * 7}deg`);
          el.style.setProperty("--gx", `${px * 100}%`);
          el.style.setProperty("--gy", `${py * 100}%`);
        };
        const lv = () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
        el.setAttribute("data-tilt", "");
        el.addEventListener("pointermove", mv);
        el.addEventListener("pointerleave", lv);
        cleanups.push(() => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerleave", lv); el.removeAttribute("data-tilt"); });
      });
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
