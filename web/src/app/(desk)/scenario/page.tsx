"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/topbar";
import { useT } from "@/lib/i18n";

// Fast what-if model on top of the base P50 path. The real recompute comes from the Monte Carlo
// service; this keeps the sliders instant in the sandbox.
const BASE: [number, number][] = [[0, 142], [10, 88], [19, 0], [30, -32], [45, -38], [60, -8], [75, 42], [90, 78]];
const DEFAULTS = { delay: 45, cny: 0, price: 0, hires: 0 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const xs = (d: number) => Math.round(50 + d * 9);
const ys = (v: number) => Math.round(20 + (160 - clamp(v, -100, 160)));
const linePath = (p: [number, number][]) => p.map(([d, v], i) => (i ? "L" : "M") + xs(d) + "," + ys(v)).join(" ");
const fmt = (v: number) => (v < 0 ? "−" : "") + Math.abs(Math.round(v)) + "M";
const sign = (n: number, u: string) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n) + u;

function simulate(s: typeof DEFAULTS) {
  const r1 = (d: number) => Math.min(1, d / 30);
  const r2 = (d: number) => clamp((d - 20) / 40, 0, 1);
  const pts = BASE.map(([d, v]) => [d, d === 0 ? v : v + (45 - s.delay) * 1.6 * r1(d) + s.cny * 1.57 * r2(d) + s.price * 2 * r2(d) - (s.hires * 1.4 * d) / 30] as [number, number]);
  const up = pts.map(([d, v]) => [d, v + d * 0.9] as [number, number]);
  const dn = pts.map(([d, v]) => [d, v - d * 0.9] as [number, number]).reverse();
  let cross: number | null = null;
  for (let i = 1; i < pts.length; i++) {
    const [d0, v0] = pts[i - 1];
    const [d1, v1] = pts[i];
    if (v0 >= 0 && v1 < 0) {
      cross = d0 + (v0 / (v0 - v1)) * (d1 - d0);
      break;
    }
  }
  const prob = clamp(Math.round(81 - pts[2][1] * 0.9), 3, 99);
  return {
    line: linePath(pts),
    band: linePath(up) + " " + dn.map(([d, v]) => "L" + xs(d) + "," + ys(v)).join(" ") + " Z",
    cross,
    prob,
    probColor: prob > 50 ? "var(--crit)" : prob > 20 ? "var(--warn)" : "var(--ok)",
    runway: cross !== null ? Math.round(cross) + "D" : ">90D",
    trough: fmt(Math.min(...pts.map((p) => p[1]))),
    end: fmt(pts[pts.length - 1][1]),
  };
}

export default function ScenarioPage() {
  const t = useT();
  const [s, setS] = useState(DEFAULTS);
  const r = useMemo(() => simulate(s), [s]);
  const set = (k: keyof typeof DEFAULTS) => (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => ({ ...p, [k]: +e.target.value }));

  const sliders = [
    { k: "delay" as const, id: "tts-delay", label: "Payment delay", value: `${s.delay}D`, min: 0, max: 90, step: 5, hint: "0 · base 45 · 90" },
    { k: "cny" as const, id: "tts-cny", label: "CNY/USD Δ", value: sign(s.cny, "%"), min: -10, max: 10, step: 1, hint: "−10% · 0 · +10%" },
    { k: "price" as const, id: "tts-price", label: "Cherry price Δ", value: sign(s.price, "%"), min: -20, max: 20, step: 1, hint: "−20% · 0 · +20%" },
    { k: "hires" as const, id: "tts-hires", label: "New hires", value: String(s.hires), min: 0, max: 5, step: 1, hint: "CLP 1.4M/mo each" },
  ];

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">CLP $142.300.000</span></div>
        <div className="tick"><span className="l">Mode</span><span className="v" style={{ color: "var(--warn)" }}>SIMULATION · NO EXECUTION</span></div>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="h1">{t("nav.scenario")}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => setS(DEFAULTS)}>Reset <span className="key">0</span></button>
            <Link className="btn btn-primary" href="/financing">Price financing</Link>
          </div>
        </div>

        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {sliders.map((sl) => (
            <div key={sl.k} className="kpi" style={{ gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><label className="kpi-l" htmlFor={sl.id}>{sl.label}</label><b className="num">{sl.value}</b></div>
              <input id={sl.id} className="range" type="range" min={sl.min} max={sl.max} step={sl.step} value={s[sl.k]} onChange={set(sl.k)} />
              <span className="hint">{sl.hint}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(300px, 1fr)", gap: 12 }}>
          <div className="card">
            <div className="card-h"><span className="h3">P50 · base vs scenario · CLP M</span><div className="legend"><span><i className="sw" style={{ borderTop: "1px dashed var(--faint)", height: 0 }} />BASE</span><span><i className="sw" style={{ background: "var(--ok)", height: 2 }} />SCENARIO</span><span><i className="sw" style={{ background: "var(--chart-band)" }} />P10–90</span></div></div>
            <div className="card-b">
              <svg viewBox="0 0 900 310" width="100%" role="img" aria-label={`Scenario forecast versus base forecast. Probability of negative cash ${r.prob}%.`}>
                <rect className="ch-neg" x="50" y="180" width="810" height="100" />
                {[30, 80, 130, 230, 280].map((y) => <line key={y} className="ch-grid" x1="50" x2="860" y1={y} y2={y} />)}
                <line className="ch-zero" x1="50" x2="860" y1="180" y2="180" />
                <path className="ch-band" d={r.band} />
                <path className="ch-before" d="M50,38 L140,92 L221,180 L320,212 L455,218 L590,188 L725,138 L860,102" />
                <path className="ch-after" d={r.line} />
                <line className="ch-buffer" x1="50" x2="860" y1="140" y2="140" />
                {r.cross !== null && <line className="ch-mark" x1={xs(r.cross)} x2={xs(r.cross)} y1="20" y2="280" />}
                {[150, 100, 50, 0, -50, -100].map((v, i) => <text key={v} className="ch-axis" x="42" y={34 + i * 50} textAnchor="end">{v}</text>)}
                <text className="ch-axis" x="50" y="302">D0</text><text className="ch-axis" x="320" y="302" textAnchor="middle">D30</text><text className="ch-axis" x="590" y="302" textAnchor="middle">D60</text><text className="ch-axis" x="860" y="302" textAnchor="end">D90</text>
              </svg>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><span className="h3">Before → after</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Metric</th><th className="r">Base</th><th className="r">Scen</th></tr></thead>
              <tbody>
                <tr><td>P(cash&lt;0) 19D</td><td className="r num">81%</td><td className="r num"><b style={{ color: r.probColor }}>{r.prob}%</b></td></tr>
                <tr><td>Runway P50</td><td className="r num">19D</td><td className="r num"><b>{r.runway}</b></td></tr>
                <tr><td>Trough P50</td><td className="r num">−38M</td><td className="r num"><b>{r.trough}</b></td></tr>
                <tr><td>D90 P50</td><td className="r num">78M</td><td className="r num"><b>{r.end}</b></td></tr>
              </tbody>
            </table></div>
            <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="mono small muted">Simulation only: nothing here executes. Use “Price financing” to act on a scenario.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
