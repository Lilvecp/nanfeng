"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, S, clpM, shortDate, usd } from "@/lib/scenario";

// three.js needs the browser: load the globe client-side only.
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const SCL = { lat: -33.45, lng: -70.67, name: "SANTIAGO" };
const SHA = { lat: 31.23, lng: 121.47, name: "SHANGHAI" };
const CRUISE_ALT = 0.04;
const CAMERA_ALT = 2.1;

type Pt = [number, number, number];

// The cities are ~170° apart: follow the great circle and lift it slightly, like a flight route.
function flightRoute(a: { lat: number; lng: number }, b: { lat: number; lng: number }, n = 240): Pt[] {
  const D = Math.PI / 180;
  const v = (p: { lat: number; lng: number }) => [Math.cos(p.lat * D) * Math.cos(p.lng * D), Math.cos(p.lat * D) * Math.sin(p.lng * D), Math.sin(p.lat * D)];
  const A = v(a);
  const B = v(b);
  const w = Math.acos(A[0] * B[0] + A[1] * B[1] + A[2] * B[2]);
  const sw = Math.sin(w);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const k0 = Math.sin((1 - t) * w) / sw;
    const k1 = Math.sin(t * w) / sw;
    const x = k0 * A[0] + k1 * B[0];
    const y = k0 * A[1] + k1 * B[1];
    const z = k0 * A[2] + k1 * B[2];
    pts.push([Math.asin(z) / D, Math.atan2(y, x) / D, 0.004 + CRUISE_ALT * Math.sin(Math.PI * t)]);
  }
  return pts;
}
const ROUTE = flightRoute(SCL, SHA);
const ROUTES = [ROUTE];

/** Point on the route at progress t ∈ [0, 1]. */
function at(t: number): Pt {
  const f = Math.max(0, Math.min(1, t)) * (ROUTE.length - 1);
  const i = Math.min(ROUTE.length - 2, Math.floor(f));
  const k = f - i;
  const [la0, lo0, a0] = ROUTE[i];
  const [la1, lo1, a1] = ROUTE[i + 1];
  let dl = lo1 - lo0;
  if (dl > 180) dl -= 360;
  if (dl < -180) dl += 360;
  let lng = lo0 + dl * k;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return [la0 + (la1 - la0) * k, lng, a0 + (a1 - a0) * k];
}

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// Story (seconds), from the battle plan: the importer's payment should travel Shanghai → Santiago,
// it is delayed 45 days, payroll on day 19 is at risk, NanFeng bridges the gap locally, and only
// on day 45 does the payment cross the Pacific (repaying the bank).
// t is the payment's progress along the route, measured from Shanghai.
type Phase = 0 | 1 | 2 | 3 | 4;
type Frame = { cam: number; pay: number; payState: "due" | "late" | "paid" | "gone"; scl: "idle" | "risk" | "fixed"; phase: Phase };
const LOOP = 20;
function story(s: number): Frame {
  if (s < 2) return { cam: 0, pay: 0, payState: "due", scl: "idle", phase: 0 };
  if (s < 3.2) return { cam: 0, pay: 0, payState: "late", scl: "idle", phase: 1 };
  if (s < 6.7) return { cam: ease((s - 3.2) / 3.5), pay: 0, payState: "late", scl: "risk", phase: 1 };
  if (s < 8.2) return { cam: 1, pay: 0, payState: "late", scl: "risk", phase: 1 };
  if (s < 10.2) return { cam: 1, pay: 0, payState: "late", scl: "fixed", phase: 2 };
  if (s < 12.4) return { cam: 1, pay: 0, payState: "late", scl: "fixed", phase: 3 };
  if (s < 13.6) return { cam: 1 - ease((s - 12.4) / 1.2), pay: 0, payState: "paid", scl: "fixed", phase: 4 };
  if (s < 17.6) return { cam: Math.min(1, ease((s - 13.6) / 4) + 0.03), pay: ease((s - 13.6) / 4), payState: "paid", scl: "fixed", phase: 4 };
  if (s < 18) return { cam: 1, pay: 1, payState: "paid", scl: "fixed", phase: 4 };
  return { cam: 1 - ease((s - 18) / 2), pay: 0, payState: "gone", scl: "idle", phase: 0 };
}

// Copy for the callout next to the globe, one entry per phase. Numbers match the Cherry Crisis scenario.
type Step = { title: string; body: string; stat: string };
const STEP_TONE = ["navy", "crit", "brass", "ok", "navy"] as const;
const STEP_START = [0, 2, 8.2, 10.2, 12.4];
const LENDERS = new Set(S.arena.map((a) => a.lender)).size;
const STEPS: Record<Lang, Step[]> = {
  en: [
    { title: "An invoice is due", body: `Shanghai Hongxin owes Huerto Austral ${usd(N.overdueUsd)} for the last shipment. It should land in Santiago on ${shortDate(S.event.due_date)}.`, stat: `${usd(N.overdueUsd)} · due ${shortDate(S.event.due_date)}` },
    { title: `The payment will be ${N.delayDays} days late`, body: `Payroll can't wait. NanFeng re-runs 10,000 scenarios: ${N.pNeg} chance cash goes negative on day ${N.crunchDay}, the harvest payroll.`, stat: `${N.pNeg} risk · day ${N.crunchDay} · need ${clpM(S.need.amount_clp)}` },
    { title: "NanFeng finds the cheapest fix", body: `${S.arena.length} quotes from ${LENDERS} lenders. A ${N.termDays}-day USD pre-export loan closes the gap, ${N.savingsPct} cheaper than a bank loan.`, stat: `Cash on payroll day · ${clpM(N.planCost)} cost` },
    { title: "The owner approves with one code", body: "A six-digit code on WhatsApp. Payroll is covered and every step is hash-chained and anchored on-chain.", stat: "L3 · OTP · audited" },
    { title: "Day 45: the importer pays", body: "The delayed payment finally crosses the Pacific and the loan is repaid in USD. Cash never went negative.", stat: `Gap closed in ${N.coverage} of scenarios` },
  ],
  es: [
    { title: "Hay una factura por cobrar", body: `Shanghai Hongxin le debe a Huerto Austral ${usd(N.overdueUsd, "es")} por el último embarque. Debería llegar a Santiago el ${shortDate(S.event.due_date, "es")}.`, stat: `${usd(N.overdueUsd, "es")} · vence el ${shortDate(S.event.due_date, "es")}` },
    { title: `El pago llegará ${N.delayDays} días tarde`, body: `Los sueldos no esperan. NanFeng corre 10.000 escenarios: ${N.pNeg} de probabilidad de caja negativa el día ${N.crunchDay}, el pago de la cosecha.`, stat: `${N.pNeg} de riesgo · día ${N.crunchDay} · faltan ${clpM(S.need.amount_clp, "es")}` },
    { title: "NanFeng encuentra la solución más barata", body: `${S.arena.length} cotizaciones de ${LENDERS} prestamistas. Un crédito de pre-exportación en USD a ${N.termDays} días cierra la brecha, ${N.savingsPct} más barato que un crédito bancario.`, stat: `Caja el día de la nómina · costo ${clpM(N.planCost, "es")}` },
    { title: "El dueño aprueba con un código", body: "Un código de seis dígitos por WhatsApp. Los sueldos quedan cubiertos y cada paso queda encadenado y anclado on-chain.", stat: "L3 · OTP · auditado" },
    { title: "Día 45: el importador paga", body: "El pago atrasado por fin cruza el Pacífico y el crédito se paga en dólares. La caja nunca quedó negativa.", stat: `Brecha cerrada en el ${N.coverage} de los escenarios` },
  ],
  zh: [
    { title: "一张发票即将到期", body: `上海鸿信欠 Huerto Austral ${usd(N.overdueUsd, "zh")}货款，应于${shortDate(S.event.due_date, "zh")}汇到圣地亚哥。`, stat: `${usd(N.overdueUsd, "zh")} · ${shortDate(S.event.due_date, "zh")}到期` },
    { title: `付款将延迟${N.delayDays}天`, body: `工资不能等。南风重新运行10,000次模拟：第${N.crunchDay}天（采收工资日）现金为负的概率为${N.pNeg}。`, stat: `风险${N.pNeg} · 第${N.crunchDay}天 · 缺口${clpM(S.need.amount_clp, "zh").replace("智利比索", "比索")}` },
    { title: "南风找到最低成本方案", body: `${LENDERS}家贷款方的${S.arena.length}份报价。${N.termDays}天期美元出口前融资补足缺口，比银行贷款便宜${N.savingsPct}。`, stat: `发薪日到账 · 成本${clpM(N.planCost, "zh").replace("智利比索", "比索")}` },
    { title: "企业主一键批准", body: "通过 WhatsApp 输入6位验证码。工资得到保障，每一步都上链存证。", stat: "L3 · 验证码 · 可审计" },
    { title: "第45天：进口商付款", body: "延迟的货款终于跨过太平洋，贷款以美元偿还。现金从未为负。", stat: `${N.coverage}的情景中缺口已补足` },
  ],
};

const PAUSE: Record<Lang, [string, string]> = { en: ["Pause the story", "Play the story"], es: ["Pausar la historia", "Reproducir la historia"], zh: ["暂停故事", "播放故事"] };

// Matte globe: no specular glare on the night texture. Created lazily in the browser
// (three.js mints random ids, which must not run during the server prerender).
let matte: MeshPhongMaterial | undefined;
const matteMaterial = () => (matte ??= new MeshPhongMaterial({ specular: 0x000000, shininess: 0 }));

export function HeroGlobe({ max = 780 }: { max?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pay = useRef<HTMLDivElement>(null);
  const scl = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const clock = useRef(0);
  const started = useRef(false);
  const [size, setSize] = useState(0);
  const [ready, setReady] = useState(false);
  // Next keeps visited pages alive but hidden (Activity). Hiding runs react-globe.gl's destructor,
  // which disposes the WebGL renderer, so each time the page is shown again we mount a fresh globe.
  const [generation, setGeneration] = useState(0);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);
  // WCAG 2.2.2: the story loops, so the viewer can stop it (and the callout is only announced then).
  const [paused, setPaused] = useState(false);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const lang = useLang();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Wide screens: globe + callout side by side. Narrow: callout drops under the globe.
    const ro = new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      setSize(w >= 900 ? Math.min(max, w - 380) : Math.min(max, w));
    });
    ro.observe(el);
    // The story only runs while the globe is on screen, so it starts when you scroll to it.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.45 });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
      setReady(false);
      setGeneration((g) => g + 1);
    };
  }, [max]);

  useEffect(() => {
    const g = globe.current;
    if (!ready || !g) return;
    const c = g.controls();
    c.enableZoom = false;
    c.enableRotate = false;
    c.enablePan = false;
    c.autoRotateSpeed = 0.35;
    const D = Math.PI / 180;

    // Pin a DOM marker over the canvas at a route position; hide it on the far side of the planet.
    const pin = (el: HTMLElement | null, t: number, hidden = false) => {
      if (!el) return;
      const [lat, lng, alt] = at(t);
      const p = g.getScreenCoords(lat, lng, alt);
      const cam = g.pointOfView();
      const cosAng = Math.sin(lat * D) * Math.sin(cam.lat * D) + Math.cos(lat * D) * Math.cos(cam.lat * D) * Math.cos((lng - cam.lng) * D);
      const facing = cosAng > 1 / (1 + cam.altitude) - 0.02;
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      el.style.opacity = facing && !hidden ? "1" : "0";
    };
    // Camera position along the route: 0 = over Shanghai, 1 = over Santiago.
    const look = (u: number, ms = 0) => {
      const [lat, lng] = at(1 - u);
      g.pointOfView({ lat: lat * 0.85, lng, altitude: CAMERA_ALT }, ms);
    };
    const render = (f: Frame) => {
      pin(pay.current, 1 - f.pay, f.payState === "gone");
      pin(scl.current, 0, f.scl === "idle");
      pay.current?.setAttribute("data-state", f.payState);
      scl.current?.setAttribute("data-state", f.scl);
    };

    if (still) {
      // One still frame: the late payment in Shanghai and the gap closed in Santiago.
      const [lat, lng] = at(0.5);
      g.pointOfView({ lat, lng, altitude: 2.7 }, 0);
      const id = requestAnimationFrame(() => render({ cam: 0.5, pay: 0, payState: "late", scl: "fixed", phase: 2 }));
      return () => cancelAnimationFrame(id);
    }

    if (!visible || paused) {
      // Waits over Shanghai until the globe scrolls into view; pauses where it was otherwise.
      if (!started.current) look(0);
      const id = requestAnimationFrame(() => render(story(clock.current)));
      return () => cancelAnimationFrame(id);
    }
    started.current = true;

    let raf = 0;
    let last = performance.now();
    let lastPhase = -1;
    const tick = (now: number) => {
      clock.current = (clock.current + Math.min(0.05, (now - last) / 1000)) % LOOP;
      last = now;
      const f = story(clock.current);
      if (f.phase !== lastPhase) {
        lastPhase = f.phase;
        setPhase(f.phase);
      }
      look(f.cam);
      render(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, visible, still, paused]);

  const shown = still ? 1 : phase;
  const step = STEPS[lang][shown];
  const jump = (i: number) => {
    clock.current = STEP_START[i] + 0.01;
    setPhase(i);
  };

  return (
    <div ref={wrap} className="globe-stage">
      <div
        role="img"
        aria-label="Night-side Earth. A USD 180,000 payment is due from Shanghai to Santiago but is delayed 45 days; Santiago turns red as payroll is at risk, NanFeng closes the gap locally, and the payment crosses the Pacific on day 45."
        style={{ position: "relative", width: size || "100%", height: size || 320 }}
      >
        {size > 0 && (
          <Globe
            key={generation}
            ref={globe}
            width={size}
            height={size}
            backgroundColor="rgba(0,0,0,0)"
            rendererConfig={{ alpha: true, antialias: true }}
            animateIn={false}
            globeMaterial={matteMaterial()}
            globeImageUrl="/textures/earth-night.jpg"
            bumpImageUrl="/textures/earth-topology.png"
            showAtmosphere
            atmosphereColor="#5fa8d3"
            atmosphereAltitude={0.18}
            pathsData={ROUTES}
            pathPoints={(d: object) => d as Pt[]}
            pathPointLat={(p: Pt) => p[0]}
            pathPointLng={(p: Pt) => p[1]}
            pathPointAlt={(p: Pt) => p[2]}
            pathColor={() => "rgba(255,255,255,0.42)"}
            pathStroke={1}
            pathDashLength={0.012}
            pathDashGap={0.01}
            pathDashAnimateTime={0}
            pathTransitionDuration={0}
            pointsData={[SCL, SHA]}
            pointColor={() => "#FFFFFF"}
            pointAltitude={0.01}
            pointRadius={0.35}
            pointsTransitionDuration={0}
            htmlElementsData={[SCL, SHA]}
            htmlElement={(d: object) => {
              // globe.gl centers the element on the city; the inner label shifts right of the dot.
              const el = document.createElement("div");
              const label = document.createElement("span");
              label.className = "globe-label";
              label.textContent = (d as typeof SCL).name;
              el.appendChild(label);
              return el;
            }}
            htmlAltitude={0.02}
            htmlTransitionDuration={0}
            htmlElementVisibilityModifier={(el: HTMLElement, isVisible: boolean) => {
              el.style.opacity = isVisible ? "1" : "0";
            }}
            enablePointerInteraction={false}
            onGlobeReady={() => setReady(true)}
          />
        )}
        <div ref={pay} className="globe-pay" data-state="due" aria-hidden="true">
          <span className="ring" />
          <span className="coin">$</span>
          <span className="tag">USD 180K</span>
        </div>
        <div ref={scl} className="globe-scl" data-state="idle" aria-hidden="true">
          <span className="ring" />
          <span className="tag risk">D{N.crunchDay} · −{clpM(S.need.amount_clp)}</span>
          <span className="tag fixed">+USD {(N.loanUsd / 1000).toFixed(1)}K · PAE</span>
        </div>
      </div>
      <aside className={`globe-callout tone-${STEP_TONE[shown]}`} aria-live={paused ? "polite" : "off"}>
        <div key={`${shown}-${lang}`} className="globe-callout-body">
          <span className="globe-callout-step">{String(shown + 1).padStart(2, "0")} / 05</span>
          <h2>{step.title}</h2>
          <p>{step.body}</p>
          <span className="globe-callout-stat">{step.stat}</span>
        </div>
        <div className="globe-callout-dots" role="group" aria-label="Story steps">
          {STEPS[lang].map((st, i) => (
            <button key={i} type="button" className={i === shown ? "on" : undefined} aria-label={st.title} aria-current={i === shown ? "step" : undefined} onClick={() => jump(i)} disabled={still} />
          ))}
          {!still && (
            <button type="button" className="globe-pause" aria-pressed={paused} aria-label={PAUSE[lang][paused ? 1 : 0]} title={PAUSE[lang][paused ? 1 : 0]} onClick={() => setPaused((p) => !p)}>
              {paused ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              )}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
