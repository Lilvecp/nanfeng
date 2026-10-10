"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { useDesk, type PlanId } from "@/lib/desk-state";
import { useT } from "@/lib/i18n";

type Option = {
  id: PlanId;
  rank: string;
  name: string;
  badge?: { cls: string; label: string };
  who: string;
  eac: { v: string; cls?: string };
  cost: string;
  term: string;
  req: string;
  ttc: { v: string; cls?: string };
  gap: { v: string; cls: string };
  score: string;
  verdict: string;
  closesGap: boolean;
};

const OPTIONS: Option[] = [
  { id: "fact-fwd", rank: "01", name: "CNY forward + partial factoring", badge: { cls: "badge acc", label: "Best" }, who: "Banco Pacífico + FX desk", eac: { v: "11.8%" }, cost: "CLP 8.5M", term: "60D", req: "Assignable invoice · FX line", ttc: { v: "48H" }, gap: { v: "+31.0M ✓", cls: "up" }, score: "0.92", verdict: "Recommended: closes the D19 gap at the lowest cost and hedges the CNY exposure.", closesGap: true },
  { id: "factoring", rank: "02", name: "Invoice factoring (full)", who: "Banco Pacífico", eac: { v: "13.9%" }, cost: "CLP 10.9M", term: "60D", req: "Invoice · credit check", ttc: { v: "48H" }, gap: { v: "+79.0M ✓", cls: "up" }, score: "0.81", verdict: "Closes the gap, but costs CLP 2.4M more and leaves ¥1.2M unhedged.", closesGap: true },
  { id: "fogape", rank: "03", name: "FOGAPE-backed loan", who: "Banco Andino", eac: { v: "9.6%", cls: "up" }, cost: "CLP 7.2M", term: "24M", req: "Sales < UF 100k · window", ttc: { v: "~21D", cls: "down" }, gap: { v: "MISS by 2D", cls: "down" }, score: "0.44", verdict: "Cheapest rate, but cash arrives on D21, two days after payroll. Apply now for next season.", closesGap: false },
  { id: "bank-loan", rank: "04", name: "Working-capital loan", badge: { cls: "badge", label: "Default" }, who: "Banco Andino", eac: { v: "16.4%", cls: "down" }, cost: "CLP 12.6M", term: "12M", req: "2y financials · collateral", ttc: { v: "~15BD", cls: "down" }, gap: { v: "MISS by 2D", cls: "down" }, score: "0.21", verdict: "Most expensive and late: fallback only.", closesGap: false },
];

export default function FinancingPage() {
  const t = useT();
  const { plan, choosePlan, approval } = useDesk();
  const [focus, setFocus] = useState<PlanId>(plan);
  const selected = OPTIONS.find((o) => o.id === focus)!;

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">Gap D19</span><span className={`v ${approval === "approved" ? "up" : "down"}`}>{approval === "approved" ? "CLOSED" : "CLP −77M"}</span></div>
        <div className="tick"><span className="l">Quotes valid</span><span className="v">2026-10-10 18:00</span></div>
        <span className="status"><span className="dot" />4 QUOTES · 3 COUNTERPARTIES</span>
      </Topbar>

      <div className="content">
        <h1 className="h1">{t("nav.financing")}</h1>
        <div className="card">
          <div className="card-h"><span className="h3">Option book · ranked by optimizer score</span><span className="hint">CLICK A ROW TO INSPECT</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Rank</th><th>Option</th><th>Counterparty</th><th className="r">EAC</th><th className="r">Total cost</th><th className="r">Term</th><th>Requirements</th><th className="r">Time to cash</th><th className="r">D19 gap impact</th><th className="r">Score</th></tr></thead>
            <tbody>
              {OPTIONS.map((o) => (
                <tr key={o.id} className={focus === o.id ? "pick" : undefined} onClick={() => setFocus(o.id)} style={{ cursor: "pointer" }} aria-selected={focus === o.id}>
                  <td className="num">{o.rank}</td>
                  <td>{o.rank === "01" ? <b>{o.name}</b> : o.name} {o.badge && <span className={o.badge.cls}>{o.badge.label}</span>}</td>
                  <td>{o.who}</td>
                  <td className={`r num ${o.eac.cls ?? ""}`}>{o.eac.v}</td>
                  <td className="r num">{o.cost}</td>
                  <td className="r num">{o.term}</td>
                  <td className="small">{o.req}</td>
                  <td className={`r num ${o.ttc.cls ?? ""}`}>{o.ttc.v}</td>
                  <td className={`r num ${o.gap.cls}`}>{o.gap.v}</td>
                  <td className="r num">{o.rank === "01" ? <b>{o.score}</b> : o.score}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="card-b" style={{ borderTop: "1px solid var(--line)", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span className={`badge ${selected.closesGap ? "ok" : "crit"}`}>{selected.closesGap ? "Closes gap" : "Misses D19"}</span>
            <span className="small" style={{ flex: "1 1 320px" }}>{selected.verdict}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card">
            <div className="card-h"><span className="h3">Cost vs speed</span><div className="legend"><span><i className="sw" style={{ background: "var(--accent)" }} />BEST</span><span><i className="sw" style={{ background: "var(--muted)" }} />OTHER</span><span><i className="sw" style={{ background: "var(--crit)", opacity: 0.3 }} />AFTER D19</span></div></div>
            <div className="card-b">
              <svg viewBox="0 0 520 300" width="100%" role="img" aria-label="Scatter of effective annual cost against days to cash. Only the two factoring options arrive before day 19; the recommended plan is cheaper of the two.">
                <rect x="392" y="30" width="108" height="230" fill="var(--crit)" opacity=".1" />
                {[40, 106, 172, 238].map((y) => <line key={y} className="ch-grid" x1="50" x2="500" y1={y} y2={y} />)}
                <line className="ch-zero" x1="50" x2="500" y1="260" y2="260" /><line className="ch-zero" x1="50" x2="50" y1="30" y2="260" />
                <line className="ch-mark" x1="392" x2="392" y1="30" y2="260" strokeDasharray="4 3" /><text className="ch-lbl" x="398" y="46">D19 GAP</text>
                {[
                  { id: "fact-fwd" as PlanId, x: 80, y: 170, label: "FWD+FACT 11.8%", tx: 100, ty: 181, anchor: "start" as const },
                  { id: "factoring" as PlanId, x: 80, y: 124, label: "FACTORING 13.9%", tx: 100, ty: 135, anchor: "start" as const },
                  { id: "fogape" as PlanId, x: 422, y: 219, label: "FOGAPE 9.6%", tx: 416, ty: 214, anchor: "end" as const },
                  { id: "bank-loan" as PlanId, x: 422, y: 69, label: "WC LOAN 16.4%", tx: 416, ty: 64, anchor: "end" as const },
                ].map((p) => (
                  <g key={p.id} onClick={() => setFocus(p.id)} style={{ cursor: "pointer" }}>
                    <rect x={p.x} y={p.y} width="12" height="12" fill={p.id === "fact-fwd" ? "var(--accent)" : "var(--muted)"} stroke={focus === p.id ? "var(--text)" : "none"} strokeWidth="2" />
                    <text className="ch-axis" x={p.tx} y={p.ty} textAnchor={p.anchor} style={p.id === "fact-fwd" ? { fill: "var(--accent)", fontWeight: 700 } : undefined}>{p.label}</text>
                  </g>
                ))}
                <text className="ch-axis" x="44" y="44" textAnchor="end">18%</text><text className="ch-axis" x="44" y="176" textAnchor="end">12%</text><text className="ch-axis" x="44" y="264" textAnchor="end">8%</text>
                <text className="ch-axis" x="50" y="282">0D</text><text className="ch-axis" x="230" y="282" textAnchor="middle">10D</text><text className="ch-axis" x="500" y="282" textAnchor="end">25D · TIME TO CASH</text>
              </svg>
            </div>
          </div>
          <div className="card">
            <div className="card-h">
              <span className="h3">Why this</span>
              {approval === "approved" ? (
                <span className="badge ok">Approved · executing</span>
              ) : (
                <Link className="btn btn-primary btn-sm" href="/approvals" onClick={() => choosePlan("fact-fwd")}>Send to approval</Link>
              )}
            </div>
            <div className="card-b small" style={{ gap: 6 }}>
              <span><span className="up">+</span> Funds in 48H — 17 days before the gap</span>
              <span><span className="up">+</span> CLP 4.1M cheaper than default loan</span>
              <span><span className="up">+</span> Forward hedges ¥1.2M remaining exposure</span>
              <span><span className="up">+</span> No new long-term debt pre-harvest</span>
            </div>
            <div className="card-h" style={{ borderTop: "1px solid var(--line)" }}><span className="h3">Why not the others</span></div>
            <div className="card-b small" style={{ gap: 6 }}>
              <span><span className="down">−</span> <b>Full factoring</b>: +CLP 2.4M, FX still open</span>
              <span><span className="down">−</span> <b>FOGAPE</b>: cheapest, but arrives D21 (apply now for next season)</span>
              <span><span className="down">−</span> <b>WC loan</b>: most expensive and late — fallback only</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
