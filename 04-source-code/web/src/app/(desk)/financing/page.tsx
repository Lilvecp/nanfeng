"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { DEFAULT_PLAN, useDesk } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, S, clpM, pct, productShort, usd } from "@/lib/scenario";

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
const sname = productShort;

// ES / 中文 versions of the engine's reasons and requirements (English comes from the engine as is).
const NOTE: Record<string, Record<Exclude<Lang, "en">, string>> = {
  "FACT-BANK": { es: "sin recurso: no compra la INV-2026-118, cuyo cliente ya avisó que pagará tarde", zh: "无追索权：不会买断 INV-2026-118，因为买家已通知延迟付款" },
  FOGAPE: { es: "plazo mínimo de 365 días: los intereses siguen corriendo mucho después de cerrar la brecha", zh: "最短期限365天：缺口补足后利息仍会持续很久" },
  "LC-DISC": { es: "todas las facturas elegibles se cobran antes de la fecha en que se necesita la plata", zh: "所有符合条件的发票都会在资金需求日之前收回" },
  OVERDRAFT: { es: "sola no logra mantener la caja sobre el colchón en la proporción de escenarios exigida (cupo, plazo o fecha de pago)", zh: "单独使用无法在目标比例的情景中让现金高于安全垫（额度、到账时间或还款日）" },
  "FWD-CNY": { es: "una cobertura no trae plata: las facturas en CNY se cobran después del día crítico, así que fijar su tipo de cambio no paga los sueldos", zh: "对冲不带来现金：人民币发票在危机日之后才收回，锁定汇率无法支付工资" },
};
const REQ: Record<string, Record<Exclude<Lang, "en">, string>> = {
  "FACT-BANK": { es: "Factura a un comprador extranjero asegurado o solvente; cesión notificada al deudor. Un factoring sin recurso no compra facturas cuyo deudor ya avisó atraso.", zh: "发票须开给有保险或信用良好的境外买家，并通知债务人转让。无追索权保理不买断已通知延迟的发票。" },
  "PAE-USD": { es: "Contrato de exportación o documentos de embarque; se paga en USD con el retorno de la exportación.", zh: "需出口合同或装运单据；以出口美元收入偿还。" },
  "WC-BANK": { es: "Dos años de estados financieros; garantía real o aval personal.", zh: "两年财务报表；抵押或个人担保。" },
  OVERDRAFT: { es: "Línea preaprobada en la cuenta corriente.", zh: "活期账户上的预批额度。" },
  "FACT-FINTECH": { es: "Alta en línea; fondos en 24 h. Con recurso: si el comprador no paga 30 días después de lo esperado, el exportador devuelve el anticipo.", zh: "线上开户，24小时到账。有追索权：买家逾期30天未付，出口商须退还预付款。" },
  "CONF-BANK": { es: "Proveedor inscrito en el programa de confirming del banco.", zh: "供应商须已加入银行的 Confirming 计划。" },
  FOGAPE: { es: "Ventas netas anuales hasta 100.000 UF; financiamiento hasta 15.000 UF; sin protestos ni deudas morosas.", zh: "年净销售额不超过10万 UF；融资上限1.5万 UF；无拒付或逾期债务。" },
};

function reasonFor(r: Row, lang: Lang) {
  // the engine writes full pesos ("CLP 2,802,079"); the screen uses one compact format everywhere
  if (lang === "en") return r.reason.replace(/CLP ([\d,]+)/g, (_, n: string) => clpM(Number(n.replace(/,/g, ""))));
  const note = NOTE[r.productId]?.[lang];
  if (r.alone === null) return note ?? r.reason;
  const extra = r.alone - N.planCost;
  const base = lang === "es"
    ? `usada sola costaría ${clpM(r.alone, "es")}, ${clpM(extra, "es")} más que el plan elegido`
    : `单独使用成本为${clpM(r.alone, "zh")}，比所选方案多${clpM(extra, "zh")}`;
  return note ? `${base} (${note})` : base;
}
const reqFor = (r: Row, lang: Lang) => (lang === "en" ? r.req : REQ[r.productId]?.[lang] ?? r.req);
const planExplanation = (lang: Lang) =>
  lang === "en" ? S.approvalRequest.explanation
  : lang === "es" ? `${N.pNeg} de probabilidad de caja negativa en ${N.crunchDay} días (${N.crunchDate}). Plan: crédito de pre-exportación por ${usd(N.loanUsd, "es")} a ${N.termDays} días. Cuesta ${clpM(N.planCost, "es")} vs ${clpM(N.defaultCost, "es")} del crédito bancario (${N.savingsPct} más barato); la caja queda sobre el colchón en el ${N.coverage} de 10.000 escenarios.`
  : `${N.crunchDay}天后（${N.crunchDate}）现金为负的概率为${N.pNeg}。方案：${N.termDays}天期出口前融资 ${usd(N.loanUsd, "zh")}。成本${clpM(N.planCost, "zh")}，银行贷款需${clpM(N.defaultCost, "zh")}（便宜${N.savingsPct}）；10,000个情景中${N.coverage}现金高于安全垫。`;

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
        <div className="card" data-guide="fin-options">
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
            <span className="small" style={{ flex: "1 1 320px" }}>{selected.selected ? planExplanation(lang) : reasonFor(selected, lang)}</span>
            {selected.req && <span className="small muted" style={{ flex: "1 1 100%" }}>{reqFor(selected, lang)}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card" data-guide="fin-chart">
            <div className="card-h"><span className="h3">{x.chart}</span><span className="hint">{x.chartHint}</span></div>
            <div className="card-b">
              <svg viewBox={`0 0 760 ${priced.length * 30 + 10}`} width="100%" role="img" aria-label={`${x.chart}. ${priced.map((r) => `${sname(r.product, lang)}: ${clpM(r.alone!)}`).join("; ")}.`}>
                {priced.map((r, i) => (
                  <g key={r.product} onClick={() => setFocus(r.product)} style={{ cursor: "pointer" }}>
                    <text className="ch-axis" x="150" y={i * 30 + 22} textAnchor="end" style={r.selected ? { fill: "var(--accent)", fontWeight: 700 } : undefined}>{sname(r.product, lang)}</text>
                    <rect x="160" y={i * 30 + 10} width={barW(r.alone!)} height="16" fill={r.selected ? "var(--accent)" : "var(--muted)"} opacity={r.selected ? 1 : 0.45} stroke={focus === r.product ? "var(--text)" : "none"} strokeWidth="2" />
                    <text className="ch-axis" x={166 + barW(r.alone!)} y={i * 30 + 22}>{(r.alone! / 1e6).toLocaleString(lang === "es" ? "es-CL" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</text>
                  </g>
                ))}
              </svg>
              <span className="mono small muted">{x.source}</span>
            </div>
          </div>
          <div className="card" data-guide="fin-why">
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
                <span key={r.product}><span className="down">−</span> <b>{pname(r.product, lang)}</b>: {reasonFor(r, lang)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
