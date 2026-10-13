"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { S, cashTick, clpM, pct, presetName } from "@/lib/scenario";

// Every preset is a full run of the quant engine (10,000-path Monte Carlo + MILP), precomputed so
// the lab answers instantly and offline. Free-form what-ifs go to /quant once the API is connected.
const PRESETS = S.scenarioLab;
type Preset = (typeof PRESETS)[number];
const BASE = PRESETS[0];

const name = (p: Preset, lang: Lang) => presetName(p.preset, lang);

// The engine writes headlines and plan actions in English; these patterns give the ES / 中文 copy.
function headline(h: string, lang: Lang) {
  if (lang === "en") return h;
  let m = h.match(/^(\d+)% probability of negative cash in (\d+) days \((.+)\)$/);
  if (m) return lang === "es" ? `${m[1]}% de probabilidad de caja negativa en ${m[2]} días (${m[3]})` : `${m[2]}天内（${m[3]}）现金为负的概率为${m[1]}%`;
  m = h.match(/^(\d+)% probability of negative cash within 90 days$/);
  if (m) return lang === "es" ? `${m[1]}% de probabilidad de caja negativa en 90 días` : `90天内现金为负的概率为${m[1]}%`;
  return h;
}
function action(a: string, lang: Lang) {
  if (lang === "en") return a;
  let m = a.match(/^Borrow USD ([\d,]+) for (\d+) days from Pre-export loan in USD \(PAE\)$/);
  if (m) return lang === "es" ? `Crédito de pre-exportación (PAE) por USD ${m[1].replace(/,/g, ".")} a ${m[2]} días` : `出口前融资（PAE）${m[1]} 美元，期限${m[2]}天`;
  m = a.match(/^Factor (\d+)% of (\S+) with (.+)$/);
  if (m) return lang === "es" ? `Factoring del ${m[1]}% de la ${m[2]} (${m[3].includes("Fintech") ? "fintech" : "banco"})` : `将 ${m[2]} 的${m[1]}%进行保理（${m[3].includes("Fintech") ? "金融科技" : "银行"}）`;
  m = a.match(/^Extend (\d+)% of (\S+) by (\d+) days via Confirming/);
  if (m) return lang === "es" ? `Postergar ${m[3]} días el ${m[1]}% del pago ${m[2]} (confirming)` : `通过 Confirming 将付款 ${m[2]} 的${m[1]}%延期${m[3]}天`;
  return a;
}

const TX = {
  en: { mode: "Mode", sim: "SIMULATION · NO EXECUTION", presets: "Scenarios", price: "Price financing", pNeg: "Chance of negative cash · 90 days", pBuf: "P(below buffer)", plan: "Plan cost", save: "Saved vs bank loan", none: "no bank-only plan",
    chart: "Probability of negative cash · every scenario", table: "Base → scenario", metric: "Metric", base: "Base", scen: "Scen", low: "P10 low point", crunch: "Crunch date", actions: "Optimizer plan for this scenario",
    note: "Simulation only: nothing here executes. Each scenario is a full 10,000-path Monte Carlo and MILP run of the quant engine." },
  es: { mode: "Modo", sim: "SIMULACIÓN · NO EJECUTA", presets: "Escenarios", price: "Cotizar financiamiento", pNeg: "Prob. de caja negativa · 90 días", pBuf: "P(bajo el colchón)", plan: "Costo del plan", save: "Ahorro vs crédito", none: "sin plan solo con crédito",
    chart: "Probabilidad de caja negativa · todos los escenarios", table: "Base → escenario", metric: "Métrica", base: "Base", scen: "Esc.", low: "Mínimo P10", crunch: "Día crítico", actions: "Plan del optimizador para este escenario",
    note: "Solo simulación: nada se ejecuta. Cada escenario es una corrida completa del motor quant (Monte Carlo de 10.000 caminos y MILP)." },
  zh: { mode: "模式", sim: "仅模拟 · 不执行", presets: "情景", price: "融资报价", pNeg: "90天内现金<0概率", pBuf: "低于安全垫概率", plan: "方案成本", save: "比银行贷款节省", none: "无仅用银行贷款的方案",
    chart: "各情景现金为负的概率", table: "基准 → 情景", metric: "指标", base: "基准", scen: "情景", low: "P10 最低点", crunch: "危机日", actions: "该情景下的优化方案",
    note: "仅为模拟，不会执行任何操作。每个情景都是量化引擎的完整运行（10,000路径蒙特卡洛 + MILP）。" },
};

export default function ScenarioPage() {
  const t = useT();
  const lang = useLang();
  const x = TX[lang];
  const [sel, setSel] = useState(BASE.preset);
  const p = PRESETS.find((q) => q.preset === sel)!;
  const color = (v: number) => (v > 0.5 ? "var(--crit)" : v > 0.2 ? "var(--warn)" : "var(--ok)");

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
        <div className="tick"><span className="l">{x.mode}</span><span className="v" style={{ color: "var(--warn)" }}>{x.sim}</span></div>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="h1">{t("nav.scenario")}</h1>
          <Link className="btn btn-primary" href="/financing">{x.price}</Link>
        </div>

        <div className="card" data-guide="wif-presets">
          <div className="card-h"><span className="h3">{x.presets}</span></div>
          <div className="card-b">
            <div className="chips" role="group" aria-label={x.presets}>
              {PRESETS.map((q) => (
                <button key={q.preset} type="button" aria-pressed={q.preset === sel} onClick={() => setSel(q.preset)} style={q.preset === sel ? { background: "var(--accent)", color: "#FFFFFF", borderColor: "var(--accent)" } : undefined}>{name(q, lang)}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="card" data-guide="wif-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">{x.pNeg}</span><span className="kpi-v" style={{ color: color(p.probNeg90d) }}>{pct(p.probNeg90d)}</span><span className="mono small muted">{headline(p.headline, lang)}</span></div>
          <div className="kpi"><span className="kpi-l">{x.pBuf}</span><span className="kpi-v">{pct(p.probBelowBuffer90d)}</span></div>
          <div className="kpi"><span className="kpi-l">{x.plan}</span><span className="kpi-v">{clpM(p.planCostClp, lang)}</span></div>
          <div className="kpi"><span className="kpi-l">{x.save}</span><span className="kpi-v up">{p.savingsPct !== null ? pct(p.savingsPct) : "—"}</span><span className="mono small muted">{p.defaultCostClp !== null ? clpM(p.defaultCostClp, lang) : x.none}</span></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(300px, 1fr)", gap: 12 }}>
          <div className="card" data-guide="wif-chart">
            <div className="card-h"><span className="h3">{x.chart}</span></div>
            <div className="card-b">
              <svg viewBox={`0 0 640 ${PRESETS.length * 30 + 30}`} width="100%" role="img" aria-label={`${x.chart}. ${PRESETS.map((q) => `${name(q, "en")}: ${pct(q.probNeg90d)}`).join("; ")}.`}>
                {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                  <g key={v}>
                    <line className="ch-grid" x1={240 + v * 360} x2={240 + v * 360} y1="4" y2={PRESETS.length * 30 + 6} />
                    <text className="ch-axis" x={240 + v * 360} y={PRESETS.length * 30 + 24} textAnchor="middle">{v * 100}%</text>
                  </g>
                ))}
                {PRESETS.map((q, i) => (
                  <g key={q.preset} onClick={() => setSel(q.preset)} style={{ cursor: "pointer" }}>
                    <text className="ch-axis" x="232" y={i * 30 + 22} textAnchor="end" style={q.preset === sel ? { fill: "var(--text)", fontWeight: 700 } : undefined}>{name(q, lang)}</text>
                    <rect x="240" y={i * 30 + 10} width={Math.max(2, q.probNeg90d * 360)} height="16" fill={color(q.probNeg90d)} opacity={q.preset === sel ? 1 : 0.4} />
                    <text className="ch-axis" x={246 + q.probNeg90d * 360} y={i * 30 + 22} textAnchor={q.probNeg90d > 0.9 ? "end" : "start"} dx={q.probNeg90d > 0.9 ? -10 : 0} style={q.probNeg90d > 0.9 ? { fill: "#FFFFFF" } : undefined}>{pct(q.probNeg90d)}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
          <div className="card" data-guide="wif-table">
            <div className="card-h"><span className="h3">{x.table}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>{x.metric}</th><th className="r">{x.base}</th><th className="r">{x.scen}</th></tr></thead>
              <tbody>
                <tr><td>{x.pNeg}</td><td className="r num">{pct(BASE.probNeg90d)}</td><td className="r num"><b style={{ color: color(p.probNeg90d) }}>{pct(p.probNeg90d)}</b></td></tr>
                <tr><td>{x.crunch}</td><td className="r num">{BASE.crunchDate ?? "—"}</td><td className="r num"><b>{p.crunchDate ?? "—"}</b></td></tr>
                <tr><td>{x.low}</td><td className="r num">{clpM(BASE.minCashP10Clp, lang)}</td><td className="r num"><b>{clpM(p.minCashP10Clp, lang)}</b></td></tr>
                <tr><td>{x.plan}</td><td className="r num">{clpM(BASE.planCostClp, lang)}</td><td className="r num"><b>{clpM(p.planCostClp, lang)}</b></td></tr>
              </tbody>
            </table></div>
            <div className="card-h" style={{ borderTop: "1px solid var(--line)" }}><span className="h3">{x.actions}</span></div>
            <div className="card-b mono small" style={{ gap: 6 }}>
              {p.planActions.map((a) => <span key={a}>→ {action(a, lang)}</span>)}
            </div>
            <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="mono small muted">{x.note}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
