"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { DEFAULT_PLAN, useDesk } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, PRODUCT_SHORT, S, clpM, pct } from "@/lib/scenario";

// Product names come from the quant catalog in English; these are the ES / 中文 labels.
const PRODUCT_NAME: Record<string, Record<Exclude<Lang, "en">, string>> = {
  "Export factoring, non-recourse (bank)": { es: "Factoring de exportación sin recurso (banco)", zh: "出口保理（无追索权，银行）" },
  "Pre-export loan in USD (PAE)": { es: "Crédito de pre-exportación en USD (PAE)", zh: "美元出口前融资（PAE）" },
  "Working capital loan (default bank credit)": { es: "Crédito de capital de trabajo (banco, por defecto)", zh: "流动资金贷款（默认银行贷款）" },
  "Credit line / overdraft": { es: "Línea de crédito / sobregiro", zh: "信用额度 / 透支" },
  "Fintech factoring, with recourse (fast onboarding)": { es: "Factoring fintech con recurso (alta rápida)", zh: "金融科技保理（有追索权，快速开户）" },
  "Confirming (supplier payment extension)": { es: "Confirming (extensión de pago a proveedores)", zh: "供应商付款延期（Confirming）" },
  "FOGAPE-guaranteed working capital loan": { es: "Crédito de capital de trabajo con garantía FOGAPE", zh: "FOGAPE 担保流动资金贷款" },
  "CNY forward (sell CNY, cash-settled)": { es: "Forward CNY (venta de CNY, compensado)", zh: "人民币远期（卖出人民币，现金交割）" },
  "Letter of credit discounting": { es: "Descuento de carta de crédito", zh: "信用证贴现" },
};
const pname = (p: string, lang: Lang) => (lang === "en" ? p : PRODUCT_NAME[p]?.[lang] ?? p);

const PLAN_NAME = "Pre-export loan in USD (PAE)";
const DEFAULT_NAME = "Working capital loan (default bank credit)";

type Row = { product: string; productId: string; lender: string; cost: number | null; eac: number | null; term: number | null; req: string; alone: number | null; selected: boolean; reason: string };

const ROWS: Row[] = S.explanation.map((e) => {
  const q = S.arena.find((a) => a.product === e.product);
  return {
    product: e.product,
    productId: e.productId,
    lender: q?.lender.replace(/ \(fictional.*\)/, "") ?? "—",
    cost: q?.cost_clp ?? null,
    eac: q?.eac ?? null,
    term: q?.term_days ?? null,
    req: q?.requirements ?? "",
    alone: e.selected ? N.planCost : e.aloneCostClp,
    selected: e.selected,
    reason: e.reason,
  };
}).sort((a, b) => (a.alone ?? Infinity) - (b.alone ?? Infinity));

const TX = {
  en: {
    need: `Need · D${N.crunchDay}`, asOf: "Quotes as of", status: `${S.arena.length} ELIGIBLE · ${ROWS.length} CHECKED`, closed: "CLOSED",
    book: "Option book · ranked by plan cost", hint: "CLICK A ROW TO INSPECT", option: "Option", lender: "Lender", eac: "EAC", quote: `Quote for CLP ${(S.need.amount_clp / 1e6).toFixed(1)}M`, term: "Term", alone: "Plan cost if used alone",
    best: "Chosen", def: "Default", inPlan: "In the plan", out: "Left out", na: "not eligible",
    chart: "What each option would cost to close the gap", chartHint: `CLP M · same target: cash above the buffer in 90% of scenarios`,
    why: "Why this", whyNot: "Why not the others", send: "Send to approval", approved: "Approved · executing",
    pros: [
      `${clpM(N.savings)} cheaper than the default bank loan (${N.savingsPct})`,
      `Cash on ${S.plan.actions[0].date}, the day of the payroll`,
      `Repaid in USD with the export proceeds (${S.plan.maturity})`,
      `Cash above the buffer in ${N.coverage} of 10,000 scenarios`,
    ],
    source: `Exact chance-constrained MILP · ${S.plan.solver} · gap ${S.plan.optimality_gap} · ${S.plan.nScenarios} scenarios`,
  },
  es: {
    need: `Necesidad · D${N.crunchDay}`, asOf: "Cotizaciones al", status: `${S.arena.length} ELEGIBLES · ${ROWS.length} REVISADAS`, closed: "CERRADA",
    book: "Opciones · ordenadas por costo del plan", hint: "HAZ CLIC EN UNA FILA", option: "Opción", lender: "Prestamista", eac: "CAE", quote: `Cotización por CLP ${(S.need.amount_clp / 1e6).toFixed(1).replace(".", ",")}M`, term: "Plazo", alone: "Costo del plan si se usa sola",
    best: "Elegida", def: "Por defecto", inPlan: "En el plan", out: "Fuera", na: "no elegible",
    chart: "Cuánto costaría cerrar la brecha con cada opción", chartHint: "CLP M · misma meta: caja sobre el colchón en el 90% de los escenarios",
    why: "Por qué esta", whyNot: "Por qué no las otras", send: "Enviar a aprobación", approved: "Aprobada · ejecutándose",
    pros: [
      `${clpM(N.savings, "es")} más barato que el crédito bancario (${N.savingsPct})`,
      `Caja el ${S.plan.actions[0].date}, el día de la nómina`,
      `Se paga en USD con el retorno de la exportación (${S.plan.maturity})`,
      `Caja sobre el colchón en el ${N.coverage} de 10.000 escenarios`,
    ],
    source: `MILP exacto con restricción de probabilidad · ${S.plan.solver} · gap ${S.plan.optimality_gap} · ${S.plan.nScenarios} escenarios`,
  },
  zh: {
    need: `资金需求 · 第${N.crunchDay}天`, asOf: "报价日期", status: `${S.arena.length}项符合条件 · 共评估${ROWS.length}项`, closed: "已补足",
    book: "方案列表 · 按方案成本排序", hint: "点击行查看详情", option: "方案", lender: "贷款方", eac: "年化成本", quote: `${Math.round(S.need.amount_clp / 1e4).toLocaleString("en-US")}万比索报价`, term: "期限", alone: "单独使用时的方案成本",
    best: "已选", def: "默认", inPlan: "纳入方案", out: "未选", na: "不符合条件",
    chart: "用各方案补足缺口的成本", chartHint: "百万智利比索 · 同一目标：90%情景中现金高于安全垫",
    why: "选择理由", whyNot: "其他方案为何未选", send: "提交审批", approved: "已批准 · 执行中",
    pros: [
      `比默认银行贷款便宜${clpM(N.savings, "zh")}（${N.savingsPct}）`,
      `${S.plan.actions[0].date} 到账，正值发薪日`,
      `以出口收入美元还款（${S.plan.maturity}）`,
      `10,000个情景中${N.coverage}现金高于安全垫`,
    ],
    source: `精确机会约束 MILP · ${S.plan.solver} · 间隙 ${S.plan.optimality_gap} · ${S.plan.nScenarios}个情景`,
  },
};

export default function FinancingPage() {
  const t = useT();
  const lang = useLang();
  const x = TX[lang];
  const { choosePlan, approval } = useDesk();
  const [focus, setFocus] = useState(PLAN_NAME);
  const selected = ROWS.find((r) => r.product === focus)!;

  const priced = ROWS.filter((r) => r.alone !== null);
  const max = Math.max(...priced.map((r) => r.alone!));
  const barW = (v: number) => Math.max(4, (v / max) * 540);

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{x.need}</span><span className={`v ${approval === "approved" ? "up" : "down"}`}>{approval === "approved" ? x.closed : `−${clpM(S.need.amount_clp, lang).replace("−", "")}`}</span></div>
        <div className="tick"><span className="l">{x.asOf}</span><span className="v">{S.asOf} 10:14</span></div>
        <span className="status"><span className="dot" />{x.status}</span>
      </Topbar>

      <div className="content">
        <h1 className="h1">{t("nav.financing")}</h1>
        <div className="card">
          <div className="card-h"><span className="h3">{x.book}</span><span className="hint">{x.hint}</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>#</th><th>{x.option}</th><th>{x.lender}</th><th className="r">{x.eac}</th><th className="r">{x.quote}</th><th className="r">{x.term}</th><th className="r">{x.alone}</th></tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.product} className={focus === r.product ? "pick" : undefined} onClick={() => setFocus(r.product)} style={{ cursor: "pointer" }} aria-selected={focus === r.product}>
                  <td className="num">{String(i + 1).padStart(2, "0")}</td>
                  <td>
                    {r.selected ? <b>{pname(r.product, lang)}</b> : pname(r.product, lang)}{" "}
                    {r.selected && <span className="badge acc">{x.best}</span>}
                    {r.product === DEFAULT_NAME && <span className="badge">{x.def}</span>}
                  </td>
                  <td>{r.lender}</td>
                  <td className="r num">{r.eac !== null ? pct(r.eac) : "—"}</td>
                  <td className="r num">{r.cost !== null ? clpM(r.cost, lang) : <span className="muted">{x.na}</span>}</td>
                  <td className="r num">{r.term !== null ? `${r.term}D` : "—"}</td>
                  <td className={`r num${r.selected ? " up" : ""}`}>{r.alone !== null ? (r.selected ? <b>{clpM(r.alone, lang)}</b> : clpM(r.alone, lang)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="card-b" style={{ borderTop: "1px solid var(--line)", flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span className={`badge ${selected.selected ? "ok" : "crit"}`}>{selected.selected ? x.inPlan : x.out}</span>
            <span className="small" style={{ flex: "1 1 320px" }}>{selected.selected ? S.approvalRequest.explanation : selected.reason}</span>
            {selected.req && <span className="small muted" style={{ flex: "1 1 100%" }}>{selected.req}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card">
            <div className="card-h"><span className="h3">{x.chart}</span><span className="hint">{x.chartHint}</span></div>
            <div className="card-b">
              <svg viewBox={`0 0 760 ${priced.length * 30 + 10}`} width="100%" role="img" aria-label={`${x.chart}. ${priced.map((r) => `${PRODUCT_SHORT[r.product] ?? r.product}: ${clpM(r.alone!)}`).join("; ")}.`}>
                {priced.map((r, i) => (
                  <g key={r.product} onClick={() => setFocus(r.product)} style={{ cursor: "pointer" }}>
                    <text className="ch-axis" x="150" y={i * 30 + 22} textAnchor="end" style={r.selected ? { fill: "var(--accent)", fontWeight: 700 } : undefined}>{PRODUCT_SHORT[r.product] ?? r.product}</text>
                    <rect x="160" y={i * 30 + 10} width={barW(r.alone!)} height="16" fill={r.selected ? "var(--accent)" : "var(--muted)"} opacity={r.selected ? 1 : 0.45} stroke={focus === r.product ? "var(--text)" : "none"} strokeWidth="2" />
                    <text className="ch-axis" x={166 + barW(r.alone!)} y={i * 30 + 22}>{(r.alone! / 1e6).toFixed(1)}</text>
                  </g>
                ))}
              </svg>
              <span className="mono small muted">{x.source}</span>
            </div>
          </div>
          <div className="card">
            <div className="card-h">
              <span className="h3">{x.why}</span>
              {approval === "approved" ? (
                <span className="badge ok">{x.approved}</span>
              ) : (
                <Link className="btn btn-primary btn-sm" href="/approvals" onClick={() => choosePlan(DEFAULT_PLAN)}>{x.send}</Link>
              )}
            </div>
            <div className="card-b small" style={{ gap: 6 }}>
              {x.pros.map((p) => <span key={p}><span className="up">+</span> {p}</span>)}
            </div>
            <div className="card-h" style={{ borderTop: "1px solid var(--line)" }}><span className="h3">{x.whyNot}</span></div>
            <div className="card-b small" style={{ gap: 6 }}>
              {ROWS.filter((r) => !r.selected).map((r) => (
                <span key={r.product}><span className="down">−</span> <b>{PRODUCT_SHORT[r.product] ?? r.product}</b>: {r.reason}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
