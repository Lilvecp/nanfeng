"use client";

import Link from "next/link";
import { useState } from "react";
import { useAgentLive } from "@/components/agent-card";
import { Topbar } from "@/components/topbar";
import { agent } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { S, cashTick, clpM, pct, shortDate } from "@/lib/scenario";

// Business health (Topic E: business financial analysis). Every number comes from the quant
// engine's business_analysis run (vicente-rodriguez/results/cherry_crisis_analysis.json, synced
// into lib/scenario.ts): a contracted 90-day cash calendar built from the same receivables,
// shipments and payables the sandbox bank holds, plus the Monte Carlo risk on each payroll.
const A = S.analysis;
const K = A.kpis;
const FIRST = S.asOf;
const LAST = S.fan.dates[S.fan.dates.length - 1];

type Severity = "high" | "medium" | "low" | "ok";
const SEV_CLASS: Record<Severity, string> = { high: "crit", medium: "warn", low: "", ok: "ok" };

const TX = {
  en: {
    basis: "CONTRACTED VIEW · 90 DAYS", lead: "What NanFeng sees in the business", sev: { high: "Act now", medium: "Watch", low: "Note", ok: "Healthy" },
    net: "Net cash flow · 90 days", margin: "operating cash margin", dso: "Days sales outstanding", toCollect: "to collect", top: "Largest customer", hhi: "concentration index",
    foreign: "Inflows in USD / CNY", shock: (p: number) => `a peso ${p}% stronger`,
    budget: "Cash budget by month", month: "Month", inflows: "In", outflows: "Out", netCol: "Net", closing: "Closing cash",
    where: "Where the money goes", customers: "Who pays the business", customer: "Customer", share: "Share of inflows", open: "Open invoices", late: "Announced delay", days: "days",
    aging: "When receivables come in", ccy: "Currency exposure", currency: "Currency", payrolls: "Can the business pay its people?", payroll: "Payroll", date: "Date", amount: "Amount",
    before: "Cash before paying", coverage: "Coverage", risk: "Chance cash < 0 after",
    note: "Contracted view: each invoice is paid at its due date plus any announced delay plus the customer's usual delay, at today's FX. The last column adds the 10,000-path Monte Carlo. Synthetic company.",
    fix: "See the financing plan", ask: "Ask NanFeng why",
    from: "from", to: "to",
    send: "Send to my WhatsApp", sending: "Sending…", sent: "Sent on WhatsApp", failed: "Could not send. Try again in a moment.",
    cat: { payroll: "Payroll", supplier: "Suppliers", freight: "Freight", debt_service: "Debt service", tax: "Taxes", utilities: "Energy and water", other: "Other" } as Record<string, string>,
    bucket: (b: string) => (b === "90+" ? "after 90 days" : `in ${b} days`),
  },
  es: {
    basis: "VISTA COMPROMETIDA · 90 DÍAS", lead: "Lo que NanFeng ve en el negocio", sev: { high: "Actuar ya", medium: "Vigilar", low: "Nota", ok: "Sano" },
    net: "Flujo de caja neto · 90 días", margin: "margen operacional de caja", dso: "Días de venta por cobrar", toCollect: "por cobrar", top: "Cliente principal", hhi: "índice de concentración",
    foreign: "Ingresos en USD / CNY", shock: (p: number) => `un peso ${p}% más fuerte`,
    budget: "Presupuesto de caja por mes", month: "Mes", inflows: "Entra", outflows: "Sale", netCol: "Neto", closing: "Caja al cierre",
    where: "En qué se va la plata", customers: "Quién le paga al negocio", customer: "Cliente", share: "% de ingresos", open: "Facturas abiertas", late: "Atraso avisado", days: "días",
    aging: "Cuándo entran las cuentas por cobrar", ccy: "Exposición por moneda", currency: "Moneda", payrolls: "¿Puede el negocio pagar a su gente?", payroll: "Nómina", date: "Fecha", amount: "Monto",
    before: "Caja antes de pagar", coverage: "Cobertura", risk: "Prob. caja < 0 después",
    note: "Vista comprometida: cada factura se paga en su vencimiento más el atraso avisado y el atraso habitual del cliente, al tipo de cambio de hoy. La última columna suma el Monte Carlo de 10.000 caminos. Empresa sintética.",
    fix: "Ver el plan de financiamiento", ask: "Preguntarle a NanFeng por qué",
    from: "desde", to: "hasta",
    send: "Enviar a mi WhatsApp", sending: "Enviando…", sent: "Enviado por WhatsApp", failed: "No se pudo enviar. Intenta de nuevo en un momento.",
    cat: { payroll: "Nómina", supplier: "Proveedores", freight: "Flete", debt_service: "Deuda", tax: "Impuestos", utilities: "Energía y riego", other: "Otros" } as Record<string, string>,
    bucket: (b: string) => (b === "90+" ? "después de 90 días" : `en ${b} días`),
  },
  zh: {
    basis: "合同视图 · 90天", lead: "南风对企业的观察", sev: { high: "立即处理", medium: "关注", low: "提示", ok: "健康" },
    net: "90天净现金流", margin: "经营现金利润率", dso: "应收账款周转天数", toCollect: "待收", top: "最大客户", hhi: "集中度指数",
    foreign: "美元/人民币收入占比", shock: (p: number) => `比索升值${p}%`,
    budget: "按月现金预算", month: "月份", inflows: "流入", outflows: "流出", netCol: "净额", closing: "月末现金",
    where: "资金去向", customers: "谁在付款", customer: "客户", share: "收入占比", open: "未结发票", late: "已通知延迟", days: "天",
    aging: "应收账款何时到账", ccy: "币种敞口", currency: "币种", payrolls: "企业能否支付工资？", payroll: "工资", date: "日期", amount: "金额",
    before: "支付前现金", coverage: "覆盖率", risk: "支付后现金<0概率",
    note: "合同视图：每张发票按到期日加上已通知的延迟和客户的常见延迟收款，按今日汇率计算。最后一列来自10,000路径蒙特卡洛。虚构企业。",
    fix: "查看融资方案", ask: "问南风为什么",
    from: "自", to: "至",
    send: "发送到我的WhatsApp", sending: "发送中…", sent: "已通过WhatsApp发送", failed: "发送失败，请稍后再试。",
    cat: { payroll: "工资", supplier: "供应商", freight: "运费", debt_service: "偿债", tax: "税费", utilities: "能源与灌溉", other: "其他" } as Record<string, string>,
    bucket: (b: string) => (b === "90+" ? "90天以后" : `${b}天内`),
  },
};

const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-CL", zh: "zh-CN" };
const monthName = (ym: string, lang: Lang) =>
  new Date(`${ym}-15T12:00:00`).toLocaleDateString(LOCALE[lang], { month: "short", year: "numeric" }).replace(".", "");

const MONTHS_ES: Record<string, string> = { December: "diciembre", January: "enero", February: "febrero", March: "marzo" };
function payrollName(name: string, date: string, lang: Lang) {
  const m = name.match(/^Harvest payroll \((\w+)\)$/);
  if (!m || lang === "en") return name;
  return lang === "es" ? `Nómina de cosecha (${MONTHS_ES[m[1]] ?? m[1]})` : `收获季工资（${Number(date.slice(5, 7))}月）`;
}

const COUNTRY: Record<string, { es: string; zh: string }> = {
  "Mainland China": { es: "China continental", zh: "中国内地" },
  "Hong Kong SAR": { es: "Hong Kong RAE", zh: "中国香港" },
  "United States": { es: "Estados Unidos", zh: "美国" },
};
const country = (c: string, lang: Lang) => (lang === "en" ? c : COUNTRY[c]?.[lang] ?? c);

/** A thin horizontal bar for shares (0–1). */
function Bar({ value, tone = "var(--accent)" }: { value: number; tone?: string }) {
  return (
    <span aria-hidden style={{ display: "inline-block", width: 120, height: 8, background: "var(--line)", verticalAlign: "middle" }}>
      <span style={{ display: "block", width: `${Math.max(2, Math.min(1, value) * 100)}%`, height: "100%", background: tone }} />
    </span>
  );
}

export default function HealthPage() {
  const t = useT();
  const lang = useLang();
  const x = TX[lang];
  const live = useAgentLive();
  const [report, setReport] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const send = async () => {
    setReport("sending");
    try {
      const r = await agent.report(lang);
      setReport(r.delivery ? "sent" : "failed");
    } catch {
      setReport("failed");
    }
  };
  const amt = (v: number) => (Math.abs(v) < 50_000 ? "—" : clpM(v, lang));
  const monthLabel = (ym: string) =>
    `${monthName(ym, lang)}${ym === FIRST.slice(0, 7) ? ` (${x.from} ${shortDate(FIRST, lang)})` : ym === LAST.slice(0, 7) ? ` (${x.to} ${shortDate(LAST, lang)})` : ""}`;
  const riskColor = (p: number | null) => (p === null ? undefined : p >= 0.5 ? "var(--crit)" : p >= 0.1 ? "var(--warn)" : "var(--ok)");

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
        <div className="tick"><span className="l">{t("nav.health")}</span><span className="v">{x.basis}</span></div>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="h1">{t("nav.health")}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {live && (
              <button className="btn" type="button" onClick={send} disabled={report === "sending"} aria-live="polite">
                {report === "sending" ? x.sending : report === "sent" ? `✓ ${x.sent}` : report === "failed" ? x.failed : x.send}
              </button>
            )}
            <Link className="btn" href="/mission">{x.ask}</Link>
            <Link className="btn btn-primary" href="/financing">{x.fix}</Link>
          </div>
        </div>

        <div className="card" data-guide="health-insights">
          <div className="card-h"><span className="h3">{x.lead}</span></div>
          <div className="card-b" style={{ gap: 10 }}>
            {A.insights.map((i) => (
              <div key={i.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className={`badge ${SEV_CLASS[i.severity as Severity]}`} style={{ minWidth: 86, justifyContent: "center" }}>{x.sev[i.severity as Severity]}</span>
                <span>{i.text[lang]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" data-guide="health-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">{x.net}</span><span className={`kpi-v ${K.net_cash_flow_clp >= 0 ? "up" : "down"}`}>{clpM(K.net_cash_flow_clp, lang)}</span><span className="mono small muted">{pct(K.operating_cash_margin)} {x.margin}</span></div>
          <div className="kpi"><span className="kpi-l">{x.dso}</span><span className="kpi-v">{Math.round(K.dso_days)} {x.days}</span><span className="mono small muted">{clpM(K.open_receivables_clp, lang)} {x.toCollect}</span></div>
          <div className="kpi"><span className="kpi-l">{x.top}</span><span className="kpi-v" style={{ color: K.top_customer_share >= 0.4 ? "var(--crit)" : undefined }}>{pct(K.top_customer_share)}</span><span className="mono small muted">{A.customers[0]?.name} · {x.hhi} {K.concentration_hhi.toFixed(2)}</span></div>
          <div className="kpi"><span className="kpi-l">{x.foreign}</span><span className="kpi-v">{pct(K.foreign_share_of_inflows)}</span><span className="mono small muted">{x.shock(K.fx_shock_pct)}: {clpM(K.fx_shock_impact_clp, lang)}</span></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card" data-guide="health-budget">
            <div className="card-h"><span className="h3">{x.budget}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>{x.month}</th><th className="r">{x.inflows}</th><th className="r">{x.outflows}</th><th className="r">{x.netCol}</th><th className="r">{x.closing}</th></tr></thead>
              <tbody>
                {A.months.map((m) => (
                  <tr key={m.month}>
                    <td>{monthLabel(m.month)}</td>
                    <td className="r num">{amt(m.inflows_clp)}</td>
                    <td className="r num">{amt(m.outflows_clp)}</td>
                    <td className={`r num ${m.net_clp >= 0 ? "up" : "down"}`}>{clpM(m.net_clp, lang)}</td>
                    <td className="r num"><b style={{ color: m.closing_cash_clp < 0 ? "var(--crit)" : undefined }}>{clpM(m.closing_cash_clp, lang)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
          <div className="card" data-guide="health-outflows">
            <div className="card-h"><span className="h3">{x.where}</span><span className="mono small muted">{clpM(K.expected_outflows_clp, lang)}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <tbody>
                {A.outflows.map((c) => (
                  <tr key={c.category}>
                    <td>{x.cat[c.category] ?? c.category}</td>
                    <td><Bar value={c.share} tone={c.category === "payroll" ? "var(--cherry)" : "var(--accent)"} /></td>
                    <td className="r num">{pct(c.share)}</td>
                    <td className="r num">{clpM(c.amount_clp, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card" data-guide="health-customers">
            <div className="card-h"><span className="h3">{x.customers}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>{x.customer}</th><th>{x.share}</th><th className="r">{x.open}</th><th className="r">{x.late}</th></tr></thead>
              <tbody>
                {A.customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}<div className="mono small muted">{country(c.country, lang)} · {c.currency}</div></td>
                    <td className="num"><Bar value={c.share} tone={c.share >= 0.4 ? "var(--crit)" : "var(--accent)"} /> {pct(c.share)}</td>
                    <td className="r num">{clpM(c.openClp, lang)}</td>
                    <td className="r num">{c.announcedDelay > 0 ? <b style={{ color: "var(--crit)" }}>{c.announcedDelay} {x.days}</b> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
          <div className="card" data-guide="health-fx">
            <div className="card-h"><span className="h3">{x.aging}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <tbody>
                {A.aging.filter((a) => a.amount_clp > 0).map((a) => (
                  <tr key={a.bucket}><td>{x.bucket(a.bucket)}</td><td><Bar value={a.share} /></td><td className="r num">{pct(a.share)}</td><td className="r num">{clpM(a.amount_clp, lang)}</td></tr>
                ))}
              </tbody>
            </table></div>
            <div className="card-h" style={{ borderTop: "1px solid var(--line)" }}><span className="h3">{x.ccy}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>{x.currency}</th><th className="r">{x.inflows}</th><th className="r">{x.outflows}</th><th className="r">{x.netCol}</th></tr></thead>
              <tbody>
                {A.currencies.map((c) => (
                  <tr key={c.currency}><td className="mono">{c.currency}</td><td className="r num">{amt(c.inflows_clp)}</td><td className="r num">{amt(c.outflows_clp)}</td><td className={`r num ${c.net_clp >= 0 ? "up" : "down"}`}>{clpM(c.net_clp, lang)}</td></tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="card" data-guide="health-payrolls">
          <div className="card-h"><span className="h3">{x.payrolls}</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{x.payroll}</th><th>{x.date}</th><th className="r">{x.amount}</th><th className="r">{x.before}</th><th className="r">{x.coverage}</th><th className="r">{x.risk}</th></tr></thead>
            <tbody>
              {A.payrolls.map((p) => (
                <tr key={p.id}>
                  <td>{payrollName(p.name, p.date, lang)}</td>
                  <td className="num">{p.date}</td>
                  <td className="r num">{clpM(p.amount_clp, lang)}</td>
                  <td className="r num">{clpM(p.cash_before_clp, lang)}</td>
                  <td className="r num" style={{ color: p.coverage < 1 ? "var(--crit)" : undefined }}>{p.coverage.toFixed(2)}×</td>
                  <td className="r num"><b style={{ color: riskColor(p.prob_negative_after) }}>{p.prob_negative_after === null ? "—" : pct(p.prob_negative_after)}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="mono small muted">{x.note}</span>
          </div>
        </div>
      </div>
    </>
  );
}
