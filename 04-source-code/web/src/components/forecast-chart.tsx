// 90-day Monte Carlo fan chart (CLP M) drawn from the quant engine's Cherry Crisis run.
// `resolved` overlays the forecast after the approved plan.

import type { Lang } from "@/lib/prefs";
import { N, S } from "@/lib/scenario";

const W = 900, H = 310, L = 50, R = 860, T = 20, B = 280;
const Y_MIN = -100, Y_MAX = 700; // only the last days of P90 go above 700 and are clipped
const DAYS = S.fan.dates.length - 1;

export const fx = (d: number) => L + (d / DAYS) * (R - L);
export const fy = (v: number) => B - ((Math.max(Y_MIN, Math.min(Y_MAX, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * (B - T);
export const line = (vals: number[]) => vals.map((v, d) => `${d ? "L" : "M"}${fx(d).toFixed(1)},${fy(v).toFixed(1)}`).join(" ");
export const band = (lo: number[], hi: number[]) =>
  `${line(hi)} ${lo.map((v, d) => [d, v] as const).reverse().map(([d, v]) => `L${fx(d).toFixed(1)},${fy(v).toFixed(1)}`).join(" ")} Z`;

const Y_TICKS = [600, 400, 200, 0];
const X_TICKS = [0, 15, 30, 45, 60, 75, 90];

const LBL: Record<Lang, { closed: string; neg: string; buffer: string; before: string; after: string; d: string }> = {
  en: { closed: "GAP CLOSED", neg: "CASH < 0", buffer: "BUFFER", before: "P50 BEFORE", after: "P50 AFTER PLAN", d: "D" },
  es: { closed: "BRECHA CERRADA", neg: "CAJA < 0", buffer: "COLCHÓN", before: "P50 ANTES", after: "P50 CON EL PLAN", d: "D" },
  zh: { closed: "缺口已补足", neg: "现金 < 0", buffer: "安全垫", before: "P50 方案前", after: "P50 方案后", d: "第" },
};

export function ForecastChart({ resolved = false, labels = true, lang = "en" }: { resolved?: boolean; labels?: boolean; lang?: Lang }) {
  const l = LBL[lang];
  const f = resolved ? S.fan.afterPlan : S.fan.after;
  const cx = fx(N.crunchDay);
  const tag = `D${N.crunchDay} · ${N.crunchDate} · ${resolved ? l.closed : l.neg}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={resolved ? `90-day forecast after the plan: cash stays above the buffer in ${N.coverage} of scenarios.` : `90-day forecast. ${N.pNeg} probability of negative cash on day ${N.crunchDay}, ${N.crunchDate}.`}>
      <rect className="ch-neg" x={L} y={fy(0)} width={R - L} height={B - fy(0)} />
      {Y_TICKS.map((v) => <line key={v} className="ch-grid" x1={L} x2={R} y1={fy(v)} y2={fy(v)} />)}
      {X_TICKS.slice(1, -1).map((d) => <line key={d} className="ch-grid" x1={fx(d)} x2={fx(d)} y1={T} y2={B} />)}
      <line className="ch-zero" x1={L} x2={R} y1={fy(0)} y2={fy(0)} />
      <path className="ch-band" d={band(f.p10, f.p90)} />
      {resolved && <path className="ch-before" d={line(S.fan.after.p50)} />}
      <path className={resolved ? "ch-after" : "ch-p50"} d={line(f.p50)} style={resolved ? { strokeWidth: 3 } : undefined} />
      <line className="ch-buffer" x1={L} x2={R} y1={fy(S.bufferClp / 1e6)} y2={fy(S.bufferClp / 1e6)} />
      <line className="ch-mark" x1={cx} x2={cx} y1={T} y2={B} />
      {!resolved && <rect className="ch-dot" x={cx - 5} y={fy(S.fan.after.p50[N.crunchDay]) - 5} width="10" height="10" />}
      {labels && (
        <>
          <rect x={cx + 5} y={T + 2} width={tag.length * (lang === "zh" ? 9.5 : 6.9) + 12} height="20" fill={resolved ? "var(--ok)" : "var(--crit)"} />
          <text x={cx + 11} y={T + 16} style={{ fill: "#FFFFFF", fontFamily: "var(--f-mono)", fontSize: 11, fontWeight: 700 }}>{tag}</text>
          <rect x={R - 70} y={fy(25) - 20} width="70" height="16" fill="var(--surface)" />
          <text className="ch-lbl2" x={R - 4} y={fy(25) - 8} textAnchor="end">{l.buffer}</text>
          {Y_TICKS.map((v) => <text key={v} className="ch-axis" x={L - 8} y={fy(v) + 4} textAnchor="end">{v}</text>)}
          {X_TICKS.map((d, i) => <text key={d} className="ch-axis" x={fx(d)} y={H - 8} textAnchor={i === 0 ? "start" : i === X_TICKS.length - 1 ? "end" : "middle"}>D{d}</text>)}
        </>
      )}
    </svg>
  );
}

export function ForecastLegend({ resolved = false, lang = "en" }: { resolved?: boolean; lang?: Lang }) {
  const l = LBL[lang];
  return (
    <div className="legend">
      <span><i className="sw" style={{ background: "var(--chart-band)" }} />P10–90</span>
      <span><i className="sw" style={{ background: resolved ? "var(--faint)" : "var(--chart-1)", height: 2 }} />{resolved ? l.before : "P50"}</span>
      {resolved && <span><i className="sw" style={{ background: "var(--ok)", height: 3 }} />{l.after}</span>}
      <span><i className="sw" style={{ borderTop: "1px dashed var(--warn)", height: 0 }} />{l.buffer} {S.bufferClp / 1e6}M</span>
    </div>
  );
}
