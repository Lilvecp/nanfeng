"use client";

import Link from "next/link";
import { useState } from "react";
import { ForecastChart, ForecastLegend } from "@/components/forecast-chart";
import { Topbar } from "@/components/topbar";
import { useCrisisNumbers, useDesk } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";

type Answer = { q: Record<Lang, string>; a: Record<Lang, string>; href: string; cta: Record<Lang, string> };

// Sandbox answers until the planner agent is wired in. Every number comes from the Cherry Crisis scenario.
const ANSWERS: Answer[] = [
  {
    q: { en: "Why is day 19 at risk?", es: "¿Por qué el día 19 está en riesgo?", zh: "为什么第19天有风险？" },
    a: {
      en: "Shanghai Fresh Imports moved USD 180,000 by 45 days. Harvest payroll (CLP 38.5M) lands on 2026-10-28, so in 8,100 of 10,000 simulated paths cash goes below zero that day.",
      es: "Shanghai Fresh Imports atrasó USD 180.000 en 45 días. La nómina de cosecha (CLP 38,5M) cae el 2026-10-28, así que en 8.100 de 10.000 escenarios la caja queda bajo cero ese día.",
      zh: "上海 Fresh Imports 将 180,000 美元付款推迟45天。采收工资（3,850万智利比索）在2026-10-28支付，因此在10,000次模拟中有8,100次当天现金为负。",
    },
    href: "/mission",
    cta: { en: "See the agent's reasoning", es: "Ver el razonamiento del agente", zh: "查看代理推理" },
  },
  {
    q: { en: "Compare financing options", es: "Comparar opciones de financiamiento", zh: "比较融资方案" },
    a: {
      en: "4 quotes from 3 counterparties. Partial factoring + CNY forward costs 11.8% EAC and closes the gap in 48 h, CLP 4.1M cheaper than the default bank loan.",
      es: "4 cotizaciones de 3 contrapartes. Factoring parcial + forward CNY cuesta 11,8% CAE y cierra la brecha en 48 h, CLP 4,1M más barato que el crédito bancario.",
      zh: "来自3家机构的4份报价。部分保理 + 人民币远期的年化成本为11.8%，48小时内补足缺口，比银行贷款便宜410万智利比索。",
    },
    href: "/financing",
    cta: { en: "Open Financing Arena", es: "Abrir comparación", zh: "打开融资比较" },
  },
  {
    q: { en: "Hedge my CNY exposure", es: "Cubrir mi exposición en CNY", zh: "对冲人民币敞口" },
    a: {
      en: "¥1.2M is unhedged for 60 days. A 30-day forward on ¥450,000 locks 0.1404 CNY/USD; it is bundled in the recommended plan.",
      es: "¥1,2M sin cobertura a 60 días. Un forward a 30 días por ¥450.000 fija 0,1404 CNY/USD; va incluido en el plan recomendado.",
      zh: "120万元人民币在60天内未对冲。对45万元做30天远期可锁定 0.1404 CNY/USD，已包含在推荐方案中。",
    },
    href: "/scenario",
    cta: { en: "Try it in Scenario Lab", es: "Probar en Escenarios", zh: "在情景实验室试算" },
  },
  {
    q: { en: "Draft a reminder in 中文", es: "Redactar recordatorio en 中文", zh: "用中文起草催款提醒" },
    a: {
      en: "Draft for WeCom: “您好，发票 INV-2026-0871（180,000 美元）已逾期45天，请确认付款日期。谢谢！” It goes out as an L1 action, no approval needed.",
      es: "Borrador para WeCom: “您好，发票 INV-2026-0871（180,000 美元）已逾期45天，请确认付款日期。谢谢！” Sale como acción L1, sin aprobación.",
      zh: "企业微信草稿：“您好，发票 INV-2026-0871（180,000 美元）已逾期45天，请确认付款日期。谢谢！” 属于 L1 操作，无需审批。",
    },
    href: "/channels",
    cta: { en: "Open Channels", es: "Abrir Canales", zh: "打开渠道" },
  },
];

const FALLBACK: Record<Lang, string> = {
  en: "In the sandbox NanFeng answers the suggested questions. Free-form questions go to the planner agent once it is connected.",
  es: "En el sandbox NanFeng responde las preguntas sugeridas. Las preguntas libres irán al agente planificador cuando esté conectado.",
  zh: "在沙盒中，南风可回答建议的问题。自由提问将在规划代理接入后开放。",
};

export default function CockpitPage() {
  const t = useT();
  const lang = useLang();
  const { approval } = useDesk();
  const { resolved, pNeg, runway } = useCrisisNumbers();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | "fallback" | null>(null);

  const ask = (text: string) => {
    const hit = ANSWERS.find((a) => Object.values(a.q).some((q) => q.toLowerCase() === text.trim().toLowerCase()));
    setQuestion(text);
    setAnswer(hit ?? (text.trim() ? "fallback" : null));
  };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">CLP $142.300.000</span></div>
        <div className="tick"><span className="l">USD/CLP</span><span className="v">905.40</span><span className="up">+0.3%</span></div>
        <div className="tick"><span className="l">CNY/USD</span><span className="v">0.1404</span><span className="down">−0.1%</span></div>
        <span className="status"><span className="dot" />AGENT MONITORING · {resolved ? 4 : 3} ACTIONS TODAY</span>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0 4px" }}>
          {resolved ? (
            <h1 className="h1" style={{ fontSize: 26 }}>{t("cockpit.hello.done.a")} <span style={{ color: "var(--ok)" }}>{t("cockpit.hello.done.b")}</span> {t("cockpit.hello.done.c")}</h1>
          ) : (
            <h1 className="h1" style={{ fontSize: 26 }}>{t("cockpit.hello.pending.a")} <span style={{ color: "var(--accent)" }}>{t("cockpit.hello.pending.b")}</span> {t("cockpit.hello.pending.c")}</h1>
          )}
          <form className="ask" role="search" aria-label="Ask NanFeng" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: "var(--accent)" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <label htmlFor="nvc-ask" className="visually-hidden">Ask NanFeng</label>
            <input id="nvc-ask" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("cockpit.ask.placeholder")} />
            <button className="btn btn-primary" type="submit">{t("cockpit.ask")}</button>
          </form>
          <div className="chips">
            {ANSWERS.map((a) => (
              <button key={a.href} type="button" onClick={() => ask(a.q[lang])}>{a.q[lang]}</button>
            ))}
          </div>
          {answer && (
            <div className="answer" role="status" aria-live="polite">
              <span className="eyebrow">NanFeng</span>
              {answer === "fallback" ? (
                <span>{FALLBACK[lang]}</span>
              ) : (
                <>
                  <span>{answer.a[lang]}</span>
                  <Link href={answer.href} className="mono small">{answer.cta[lang]} →</Link>
                </>
              )}
            </div>
          )}
        </div>

        {approval === "approved" ? (
          <div className="alert ok" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span className="ic">OK</span>
            <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 15 }}>{t("cockpit.done.title")}</b>
              <span className="mono small">{t("cockpit.done.sub")}</span>
            </div>
            <Link className="btn btn-secondary" href="/security">{t("cockpit.audit")}</Link>
          </div>
        ) : (
          <div className="alert crit" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span className="ic">CRIT</span>
            <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 15 }}>{approval === "rejected" ? t("cockpit.rejected.title") : t("cockpit.alert.title")}</b>
              <span className="mono small">{t("cockpit.alert.rec")} <b className="up">CLP 4.1M</b> {t("cockpit.alert.vs")}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="btn btn-primary" href="/financing">{t("cockpit.review")} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>R</span></Link>
              <Link className="btn btn-secondary" href="/mission">{t("cockpit.why")} <span className="key">?</span></Link>
            </div>
          </div>
        )}

        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">P(cash&lt;0) · 19D</span><span className="kpi-v" style={{ color: resolved ? "var(--ok)" : "var(--crit)" }}>{pNeg}</span><span className="mono small muted">{resolved ? "▼ from 81% · 10:15" : "▲ from 22% · 09:08"}</span></div>
          <div className="kpi"><span className="kpi-l">Runway P50</span><span className="kpi-v">{runway}</span><span className="mono small muted">{resolved ? "buffer held all 90D" : "P10 12D · P90 41D"}</span></div>
          <div className="kpi"><span className="kpi-l">Overdue</span><span className="kpi-v">USD 180,000</span><span className="mono small muted">Shanghai Fresh Imports</span></div>
          <div className="kpi"><span className="kpi-l">FX exposure</span><span className="kpi-v">{resolved ? "¥750K CNY" : "¥1.2M CNY"}</span><span className="mono small muted">{resolved ? "¥450K hedged · 30D fwd" : "unhedged · 60D"}</span></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(300px, 1fr)", gap: 12 }}>
          <div className="card">
            <div className="card-h"><span className="h3">Cash forecast · 90D · CLP M · MC 10,000</span><ForecastLegend resolved={resolved} /></div>
            <div className="card-b"><ForecastChart resolved={resolved} /></div>
          </div>

          <div className="card">
            <div className="card-h"><span className="h3">Agent tape</span><span className="badge solid crit">2 threats blocked today</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <tbody>
                {resolved && <tr><td className="num muted">10:15</td><td className="up">Plan executed · hash anchored</td><td className="r"><span className="tier t3"><b>L3</b></span></td></tr>}
                <tr><td className="num muted">09:14</td><td>Plan proposed</td><td className="r"><span className="tier t3"><b>L3</b></span></td></tr>
                <tr><td className="num muted">09:11</td><td>4 quotes received</td><td className="r"><span className="tier t1"><b>L1</b></span></td></tr>
                <tr><td className="num muted">09:08</td><td>MC re-run · P=0.81</td><td className="r"><span className="tier t0"><b>L0</b></span></td></tr>
                <tr><td className="num muted">08:47</td><td className="down">Blocked: bank-detail swap</td><td className="r"><span className="badge crit">BLK</span></td></tr>
                <tr><td className="num muted">08:30</td><td>Reminder → WeCom</td><td className="r"><span className="tier t1"><b>L1</b></span></td></tr>
                <tr><td className="num muted">07:51</td><td className="down">Blocked: injected email</td><td className="r"><span className="badge crit">BLK</span></td></tr>
              </tbody>
            </table></div>
            <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
              <Link href="/mission" className="mono small">Open Mission Control →</Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><span className="h3">Receivables blotter</span><span className="hint">USD · sorted by risk</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Invoice</th><th>Importer</th><th>City</th><th className="r">Amount</th><th className="r">Due</th><th className="r">Days late</th><th className="r">P(pay ≤ 30D)</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td className="num">INV-2026-0871</td><td>Shanghai Fresh Imports</td><td>Shanghai</td><td className="r num">180,000.00</td><td className="r num">2026-08-25</td><td className="r num down">45</td><td className="r num down">0.31</td><td>{resolved ? <span className="badge ok">Factored 67%</span> : <Link href="/approvals" className="badge warn">Plan pending</Link>}</td></tr>
              <tr><td className="num">INV-2026-0902</td><td>Guangzhou Orchard Trading</td><td>Guangzhou</td><td className="r num">96,400.00</td><td className="r num">2026-11-12</td><td className="r num">—</td><td className="r num up">0.92</td><td><span className="badge ok">Monitor</span></td></tr>
              <tr><td className="num">INV-2026-0915</td><td>Ningbo Cold Chain Co.</td><td>Ningbo</td><td className="r num">54,250.00</td><td className="r num">2026-11-30</td><td className="r num">—</td><td className="r num up">0.88</td><td><span className="badge ok">Monitor</span></td></tr>
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
