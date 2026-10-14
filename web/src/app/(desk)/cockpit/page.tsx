"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AgentCard, useAgentLive } from "@/components/agent-card";
import { ForecastChart, ForecastLegend } from "@/components/forecast-chart";
import { agent, type AgentAnswer } from "@/lib/api";
import { CloseButton } from "@/components/close-button";
import { OwnerView, ViewSwitch } from "@/components/owner-view";
import { Topbar } from "@/components/topbar";
import { useCrisisNumbers, useDesk } from "@/lib/desk-state";
import { setDismissed, useDismissed } from "@/lib/dismiss";
import { useLang, useT } from "@/lib/i18n";
import { usePref, type Lang } from "@/lib/prefs";
import { N, RECEIVABLE, S, SHORT_CUSTOMER, SHORT_CUSTOMER_ZH, cashTick, clpM, cny, longDate, pct, presetName, usd } from "@/lib/scenario";

type Answer = { q: Record<Lang, string>; a: Record<Lang, string>; href: string; cta: Record<Lang, string> };

const CNY_INVOICES = S.receivables.filter((r) => r.currency === "CNY");
const CNY_TOTAL = CNY_INVOICES.reduce((a, r) => a + r.amount, 0);
const ELIGIBLE = N.eligible;

// Sandbox answers, and the fallback when the live agent is not reachable. Every number comes from the
// quant engine's Cherry Crisis run (lib/scenario.ts).
const ANSWERS: Answer[] = [
  {
    q: { en: `Why is day ${N.crunchDay} at risk?`, es: `¿Por qué el día ${N.crunchDay} está en riesgo?`, zh: `为什么第${N.crunchDay}天有风险？` },
    a: {
      en: `${SHORT_CUSTOMER} will pay ${RECEIVABLE.id} (${usd(N.overdueUsd)}) ${N.delayDays} days late. Harvest payroll (${clpM(N.payroll)}) is due on ${N.crunchDate}, so cash is below zero that day in ${N.pNeg} of 10,000 simulated paths. If Shanghai paid on time it would be ${pct(S.after.probNegIfOnTime)}.`,
      es: `${SHORT_CUSTOMER} pagará la ${RECEIVABLE.id} (${usd(N.overdueUsd, "es")}) con ${N.delayDays} días de atraso. La nómina de cosecha (${clpM(N.payroll, "es")}) vence el ${N.crunchDate}, así que en el ${N.pNeg} de 10.000 escenarios la caja queda bajo cero ese día. Si Shanghái pagara a tiempo sería ${pct(S.after.probNegIfOnTime)}.`,
      zh: `${SHORT_CUSTOMER_ZH}将推迟${N.delayDays}天支付发票 ${RECEIVABLE.id}（${usd(N.overdueUsd, "zh")}）。采收工资（${clpM(N.payroll, "zh")}）在 ${N.crunchDate} 支付，因此在10,000次模拟中有${N.pNeg}当天现金为负。若上海客户按时付款，概率仅为${pct(S.after.probNegIfOnTime)}。`,
    },
    href: "/mission",
    cta: { en: "See the agent's reasoning", es: "Ver el razonamiento del agente", zh: "查看代理推理" },
  },
  {
    q: { en: "Compare financing options", es: "Comparar opciones de financiamiento", zh: "比较融资方案" },
    a: {
      en: `${N.products} products checked, ${ELIGIBLE} eligible. The optimizer picks a ${N.termDays}-day USD pre-export loan of ${usd(N.loanUsd)}: ${clpM(N.planCost)} vs ${clpM(N.defaultCost)} for the default bank loan (${N.savingsPct} cheaper). Cash stays above the buffer in ${N.coverage} of scenarios.`,
      es: `${N.products} productos revisados, ${ELIGIBLE} elegibles. El optimizador elige un crédito de pre-exportación en USD a ${N.termDays} días por ${usd(N.loanUsd, "es")}: ${clpM(N.planCost, "es")} vs ${clpM(N.defaultCost, "es")} del crédito bancario (${N.savingsPct} más barato). La caja queda sobre el colchón en el ${N.coverage} de los escenarios.`,
      zh: `评估了${N.products}种产品，其中${ELIGIBLE}种符合条件。优化器选择${N.termDays}天期美元出口前融资 ${usd(N.loanUsd, "zh")}：成本${clpM(N.planCost, "zh")}，银行贷款需${clpM(N.defaultCost, "zh")}（节省${N.savingsPct}）。${N.coverage}的情景中现金保持在安全垫之上。`,
    },
    href: "/financing",
    cta: { en: "Open Financing Arena", es: "Abrir comparación", zh: "打开融资比较" },
  },
  {
    q: { en: "Should I hedge my CNY?", es: "¿Debo cubrir mis CNY?", zh: "我需要对冲人民币吗？" },
    a: {
      en: `¥${(CNY_TOTAL / 1e6).toFixed(2)}M of CNY invoices are collected in mid-January, after the crunch day. A forward would lock their rate but brings no cash for the ${N.crunchDate} payroll, so at this confidence level the optimizer leaves it out.`,
      es: `Hay ¥${(CNY_TOTAL / 1e6).toFixed(2).replace(".", ",")}M en facturas en CNY que se cobran a mediados de enero, después del día crítico. Un forward fija su tipo de cambio pero no trae caja para la nómina del ${N.crunchDate}, así que con este nivel de confianza el optimizador lo deja fuera.`,
      zh: `人民币发票共 ¥${(CNY_TOTAL / 1e6).toFixed(2)}M，将在1月中旬（危机日之后）收回。远期合约可以锁定汇率，但无法为 ${N.crunchDate} 的工资提供现金，因此在当前置信水平下优化器未选择它。`,
    },
    href: "/scenario",
    cta: { en: "Try FX moves in Scenario Lab", es: "Probar movimientos de tipo de cambio", zh: "在情景实验室测试汇率变动" },
  },
  {
    q: { en: "Draft a reminder in 中文", es: "Redactar recordatorio en 中文", zh: "用中文起草付款提醒" },
    a: {
      en: `Draft for WeCom: “您好，感谢告知发票 ${RECEIVABLE.id}（180,000 美元）将延迟${N.delayDays}天付款。请确认新的付款日期；如可提前支付部分款项，请告知。谢谢！” It goes out as an L1 action, no approval needed.`,
      es: `Borrador para WeCom: “您好，感谢告知发票 ${RECEIVABLE.id}（180,000 美元）将延迟${N.delayDays}天付款。请确认新的付款日期；如可提前支付部分款项，请告知。谢谢！” Sale como acción L1, sin aprobación.`,
      zh: `企业微信草稿：“您好，感谢告知发票 ${RECEIVABLE.id}（180,000 美元）将延迟${N.delayDays}天付款。请确认新的付款日期；如可提前支付部分款项，请告知。谢谢！” 属于 L1 操作，无需审批。`,
    },
    href: "/channels",
    cta: { en: "Open Channels", es: "Abrir Canales", zh: "打开渠道" },
  },
];

const FALLBACK: Record<Lang, string> = {
  en: "In the sandbox NanFeng answers the suggested questions and what-ifs about payment dates, the yuan, the dollar, cherry prices and extra workers. Other questions go to the planner agent once it is connected.",
  es: "En el sandbox NanFeng responde las preguntas sugeridas y los “¿y si…?” sobre fechas de pago, el yuan, el dólar, el precio de la cereza y más temporeros. Las demás preguntas irán al agente planificador cuando esté conectado.",
  zh: "在沙盒中，南风可回答建议的问题，以及关于付款日期、人民币、美元、樱桃价格和增加工人的假设问题。其他问题将在规划代理接入后开放。",
};

// What-ifs typed in the box, answered from the quant engine's precomputed runs (Scenario Lab).
const LAB = Object.fromEntries(S.scenarioLab.map((p) => [p.preset, p]));
const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));
const down = (t: string) => has(t, "baja", "cae", "caída", "drop", "fall", "down", "weaker", "-", "−", "跌", "下降", "贬");
const up = (t: string) => has(t, "sube", "alza", "rise", "up", "stronger", "+", "涨", "上升", "升值");

function whatIf(raw: string, lang: Lang): Answer | null {
  const t = raw.toLowerCase();
  const preset = (key: string): Answer => {
    const p = LAB[key];
    const prob = pct(p.probNeg90d);
    const cost = p.planCostClp ? clpM(p.planCostClp, lang) : "—";
    const nm = presetName(key, lang);
    return {
      q: { en: raw, es: raw, zh: raw },
      a: {
        en: `${nm}: ${prob} chance of negative cash within 90 days (base: ${pct(LAB[S.scenarioLab[0].preset].probNeg90d)}). The optimizer's plan would cost ${cost}. Full 10,000-path run of the quant engine.`,
        es: `${nm}: ${prob} de probabilidad de caja negativa en 90 días (base: ${pct(LAB[S.scenarioLab[0].preset].probNeg90d)}). El plan del optimizador costaría ${cost}. Corrida completa del motor quant con 10.000 caminos.`,
        zh: `${nm}：90天内现金为负的概率为${prob}（基准：${pct(LAB[S.scenarioLab[0].preset].probNeg90d)}）。优化方案成本为${cost}${p.planCostClp ? `（${cny(p.planCostClp)}）` : ""}。量化引擎完整运行10,000条路径。`,
      },
      href: "/scenario",
      cta: { en: "Open What if…", es: "Abrir ¿Y si…?", zh: "打开假设分析" },
    };
  };
  // "What if Shanghai pays on day 10 / on time?" — any payment before payroll day works like paying on time.
  const day = t.match(/(?:d[ií]a|day|第)\s*(\d{1,2})/);
  const onTime = has(t, "a tiempo", "on time", "按时", "准时");
  if (day || onTime) {
    const d = day ? Number(day[1]) : 0;
    if (onTime || d < N.crunchDay) {
      const when = { en: day ? `on day ${d}` : "on time", es: day ? `el día ${d}` : "a tiempo", zh: day ? `在第${d}天` : "按时" };
      return {
        q: { en: raw, es: raw, zh: raw },
        a: {
          en: `If ${SHORT_CUSTOMER} pays ${when.en}, the USD 180,000 arrives before the payroll on ${longDate(N.crunchDate)} (day ${N.crunchDay}). The engine's on-time run puts the risk at ${pct(S.after.probNegIfOnTime)} instead of ${N.pNeg}: you would not need the loan.`,
          es: `Si ${SHORT_CUSTOMER} paga ${when.es}, los USD 180.000 llegan antes de los sueldos del ${longDate(N.crunchDate, "es")} (día ${N.crunchDay}). Con pago a tiempo el motor da un riesgo de ${pct(S.after.probNegIfOnTime)} en vez de ${N.pNeg}: no necesitarías el crédito.`,
          zh: `如果${SHORT_CUSTOMER_ZH}${when.zh}付款，18万美元将在${longDate(N.crunchDate, "zh")}（第${N.crunchDay}天）发薪前到账。按时付款情景下风险为${pct(S.after.probNegIfOnTime)}，而不是${N.pNeg}：您无需贷款。`,
        },
        href: "/scenario",
        cta: { en: "Open What if…", es: "Abrir ¿Y si…?", zh: "打开假设分析" },
      };
    }
    return preset(S.scenarioLab[0].preset);
  }
  if (has(t, "todos los clientes", "all customers", "所有客户", "+15", "15 días", "15 days", "15天")) return preset("All customers +15 days late");
  if (has(t, "cny", "yuan", "rmb", "人民币")) return preset(down(t) ? "CNY -5% vs CLP" : "CNY +5% vs CLP");
  if (has(t, "usd", "dólar", "dolar", "dollar", "美元")) return preset("USD -5% vs CLP");
  if (has(t, "cereza", "cherry", "cherries", "樱桃")) return preset(up(t) && !down(t) ? "Cherry price +10%" : "Cherry price -10%");
  if (has(t, "temporer", "trabajador", "worker", "contrat", "hire", "工人")) return preset("30 extra harvest workers");
  return null;
}

const TX = {
  en: {
    monitoring: "AGENT MONITORING", actions: "ACTIONS TODAY", pNeg: `Chance of negative cash · day ${N.crunchDay}`, fromAfter: `▼ from ${N.pNeg} · 10:15`, fromBefore: `▲ from ${N.pNegBefore} before the notice`,
    crunch: "Crunch day", crunchSub: `P50 low ${clpM(S.after.minCashP50Clp)} · payroll ${clpM(N.payroll)}`, crunchDone: `buffer held in ${N.coverage} of paths`, cleared: "CLEARED",
    delayed: `Delayed +${N.delayDays}D`, passport: "Credit Passport", passportSub: "explainable score for lenders", from: "from",
    forecast: "Cash forecast · 90D · CLP M · MC 10,000", tape: "Agent tape", threats: "1 threat blocked today", openMission: "Open agent activity",
    blotter: "Receivables", blotterHint: "sorted by due date", inv: "Invoice", importer: "Importer", market: "Market", amount: "Amount", due: "Due", delay: "Announced delay", action: "Action",
    pending: "Plan pending", financed: "Bridged by PAE", monitor: "Monitor", lc: "LC-backed",
    tapeRows: { exec: "Plan executed · hash anchored", proposed: "Plan proposed", quotes: `${ELIGIBLE} quotes received`, mc: `MC re-run · P=${S.after.probNegByCrunch.toFixed(2)}`, ocr: "Delay notice read (OCR)", voice: "Voice cash briefing (ES)", blk1: "Blocked: Frío Austral invoice 4471 · bank-detail swap + hidden instruction" },
  },
  es: {
    monitoring: "AGENTE MONITOREANDO", actions: "ACCIONES HOY", pNeg: `Prob. de caja negativa · día ${N.crunchDay}`, fromAfter: `▼ desde ${N.pNeg} · 10:15`, fromBefore: `▲ desde ${N.pNegBefore} antes del aviso`,
    crunch: "Día crítico", crunchSub: `Mínimo P50 ${clpM(S.after.minCashP50Clp, "es")} · nómina ${clpM(N.payroll, "es")}`, crunchDone: `colchón respetado en ${N.coverage} de los escenarios`, cleared: "DESPEJADO",
    delayed: `Atrasado +${N.delayDays}D`, passport: "Credit Passport", passportSub: "puntaje explicable para prestamistas", from: "desde",
    forecast: "Pronóstico de caja · 90D · CLP M · MC 10.000", tape: "Bitácora del agente", threats: "1 amenaza bloqueada hoy", openMission: "Abrir actividad del agente",
    blotter: "Cuentas por cobrar", blotterHint: "por fecha de vencimiento", inv: "Factura", importer: "Importador", market: "Mercado", amount: "Monto", due: "Vence", delay: "Atraso avisado", action: "Acción",
    pending: "Plan pendiente", financed: "Cubierta con PAE", monitor: "Vigilar", lc: "Con carta de crédito",
    tapeRows: { exec: "Plan ejecutado · hash anclado", proposed: "Plan propuesto", quotes: `${ELIGIBLE} cotizaciones recibidas`, mc: `MC re-calculado · P=${S.after.probNegByCrunch.toFixed(2)}`, ocr: "Aviso de atraso leído (OCR)", voice: "Briefing de caja por voz (ES)", blk1: "Bloqueada: factura 4471 de Frío Austral · cambio de cuenta + instrucción oculta" },
  },
  zh: {
    monitoring: "代理监控中", actions: "项今日操作", pNeg: `现金为负概率 · 第${N.crunchDay}天`, fromAfter: `▼ 原为 ${N.pNeg} · 10:15`, fromBefore: `▲ 通知前为 ${N.pNegBefore}`,
    crunch: "危机日", crunchSub: `P50 最低 ${clpM(S.after.minCashP50Clp, "zh")} · 工资 ${clpM(N.payroll, "zh")}`, crunchDone: `${N.coverage} 的情景保持安全垫`, cleared: "已解除",
    delayed: `延迟 +${N.delayDays}天`, passport: "信用护照", passportSub: "面向贷款方的可解释评分", from: "原为",
    forecast: "现金预测 · 90天 · 百万智利比索 · 蒙特卡洛 10,000", tape: "代理记录", threats: "今日拦截1次威胁", openMission: "打开代理活动",
    blotter: "应收账款", blotterHint: "按到期日排序", inv: "发票", importer: "进口商", market: "市场", amount: "金额", due: "到期日", delay: "已通知延迟", action: "操作",
    pending: "方案待批", financed: "已由 PAE 过桥", monitor: "监控", lc: "信用证担保",
    tapeRows: { exec: "方案已执行 · 哈希已锚定", proposed: "已提出方案", quotes: `收到${ELIGIBLE}份报价`, mc: `重新模拟 · P=${S.after.probNegByCrunch.toFixed(2)}`, ocr: "已读取延迟通知（OCR）", voice: "语音现金简报（西语）", blk1: "已拦截：Frío Austral 发票 4471 · 银行账户变更 + 隐藏指令" },
  },
};

/** The owner lands on the plain-language view; the full desk is one switch away. */
export default function CockpitPage() {
  const view = usePref("view");
  const t = useT();
  const lang = useLang();
  if (view === "detail") return <CockpitDetail />;
  return (
    <>
      <Topbar lead={<ViewSwitch />}>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
      </Topbar>
      <div className="content"><OwnerView /></div>
    </>
  );
}

function CockpitDetail() {
  const t = useT();
  const lang = useLang();
  const x = TX[lang];
  const { approval, receipt } = useDesk();
  const { resolved, pNeg } = useCrisisNumbers();
  const alertClosed = useDismissed(`detail-${approval}`);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | AgentAnswer | "fallback" | "thinking" | null>(null);
  const agentLive = useAgentLive();
  const asked = useRef(0);

  const ask = async (text: string) => {
    const n = ++asked.current;
    setQuestion(text);
    if (!text.trim()) return setAnswer(null);
    const local = ANSWERS.find((a) => Object.values(a.q).some((q) => q.toLowerCase() === text.trim().toLowerCase()));
    // What-ifs come from the quant engine's runs; everything else goes to the live agent, which explains
    // what it actually did. The sandbox answers stay as the fallback when the agent has nothing to say.
    const lab = whatIf(text, lang);
    if (lab) return setAnswer(lab);
    if (agentLive) {
      setAnswer("thinking");
      try {
        const a = await agent.ask(text.trim(), lang);
        if (n !== asked.current) return; // a newer question was asked meanwhile
        if (a.intent !== "none" || !local) return setAnswer(a);
      } catch {
        // agent unreachable: answer from the sandbox below
      }
      if (n !== asked.current) return;
    }
    setAnswer(local ?? "fallback");
  };

  const receivables = [...S.receivables].sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <>
      <Topbar lead={<ViewSwitch />}>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
        <div className="tick"><span className="l">USD/CLP</span><span className="v">{S.fx.clp_per_usd.toFixed(2)}</span></div>
        <div className="tick"><span className="l">USD/CNY</span><span className="v">{S.fx.cny_per_usd.toFixed(4)}</span></div>
        <span className="status"><span className="dot" />{x.monitoring} · {resolved ? 6 : 5} {x.actions}</span>
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
              ) : answer === "thinking" ? (
                <span className="muted">…</span>
              ) : "answer" in answer ? (
                <>
                  <span>{answer.answer}</span>
                  {answer.run_id && <Link href="/mission" className="mono small">{answer.run_id} →</Link>}
                </>
              ) : (
                <>
                  <span>{answer.a[lang]}</span>
                  <Link href={answer.href} className="mono small">{answer.cta[lang]} →</Link>
                </>
              )}
            </div>
          )}
        </div>

        <AgentCard uploadOnly />

        {alertClosed ? null : approval === "approved" ? (
          <div data-guide="det-alert" className="alert ok" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span className="ic">OK</span>
            <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 15 }}>{t("cockpit.done.title")}</b>
              <span className="mono small">{t("cockpit.done.sub")}</span>
            </div>
            <Link className="btn btn-secondary" href="/security">{t("cockpit.audit")}</Link>
            <CloseButton onClick={() => setDismissed(`detail-${approval}`)} />
          </div>
        ) : (
          <div data-guide="det-alert" className="alert crit" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span className="ic">{lang === "es" ? "ALERTA" : lang === "zh" ? "警报" : "CRIT"}</span>
            <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", gap: 2 }}>
              <b style={{ fontSize: 15 }}>{approval === "rejected" ? t("cockpit.rejected.title") : t("cockpit.alert.title")}</b>
              <span className="mono small">{t("cockpit.alert.rec")} <b className="up">{clpM(N.savings, lang)}</b> ({N.savingsPct}) {t("cockpit.alert.vs")}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link className="btn btn-primary" href="/financing">{t("cockpit.review")} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>R</span></Link>
              <Link className="btn btn-secondary" href="/mission">{t("cockpit.why")} <span className="key">?</span></Link>
              <CloseButton onClick={() => setDismissed(`detail-${approval}`)} />
            </div>
          </div>
        )}

        <div className="card" data-guide="det-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">{x.pNeg}</span><span className="kpi-v" style={{ color: resolved ? "var(--ok)" : "var(--crit)" }}>{pNeg}</span><span className="mono small muted">{resolved ? x.fromAfter : x.fromBefore}</span></div>
          <div className="kpi"><span className="kpi-l">{x.crunch}</span><span className="kpi-v">{resolved ? x.cleared : `D${N.crunchDay}`}</span><span className="mono small muted">{resolved ? x.crunchDone : x.crunchSub}</span></div>
          <div className="kpi"><span className="kpi-l">{x.delayed}</span><span className="kpi-v">{usd(N.overdueUsd, lang)}</span><span className="mono small muted">{lang === "zh" ? SHORT_CUSTOMER_ZH : SHORT_CUSTOMER} · {RECEIVABLE.id}</span></div>
          <div className="kpi"><span className="kpi-l">{x.passport}</span><span className="kpi-v">{resolved ? `${Math.round(S.passport.after_plan.score)} ${S.passport.after_plan.grade}` : `${Math.round(S.passport.before.score)} ${S.passport.before.grade}`}</span><span className="mono small muted">{resolved ? `▲ ${x.from} ${Math.round(S.passport.before.score)} ${S.passport.before.grade}` : x.passportSub}</span></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(300px, 1fr)", gap: 12 }}>
          <div className="card" data-guide="det-chart">
            <div className="card-h"><span className="h3">{x.forecast}</span><ForecastLegend resolved={resolved} lang={lang} /></div>
            <div className="card-b"><ForecastChart resolved={resolved} lang={lang} /><span className="mono small muted">{S.source}</span></div>
          </div>

          <div className="card" data-guide="det-tape">
            <div className="card-h"><span className="h3">{x.tape}</span><span className="badge solid crit">{x.threats}</span></div>
            <div className="tbl-wrap"><table className="tbl">
              <tbody>
                {resolved && <tr><td className="num muted">{receipt.time}</td><td className="up">{x.tapeRows.exec}</td><td className="r"><span className="tier t3"><b>L3</b></span></td></tr>}
                <tr><td className="num muted">10:15</td><td>{x.tapeRows.proposed}</td><td className="r"><span className="tier t3"><b>L3</b></span></td></tr>
                <tr><td className="num muted">10:14</td><td>{x.tapeRows.quotes}</td><td className="r"><span className="tier t1"><b>L1</b></span></td></tr>
                <tr><td className="num muted">10:13</td><td>{x.tapeRows.mc}</td><td className="r"><span className="tier t0"><b>L0</b></span></td></tr>
                <tr><td className="num muted">10:12</td><td>{x.tapeRows.ocr}</td><td className="r"><span className="tier t0"><b>L0</b></span></td></tr>
                <tr><td className="num muted">08:47</td><td className="down">{x.tapeRows.blk1}</td><td className="r"><span className="badge crit">BLK</span></td></tr>
                <tr><td className="num muted">08:00</td><td>{x.tapeRows.voice}</td><td className="r"><span className="tier t0"><b>L0</b></span></td></tr>
              </tbody>
            </table></div>
            <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
              <Link href="/mission" className="mono small">{x.openMission} →</Link>
            </div>
          </div>
        </div>

        <div className="card" data-guide="det-blotter">
          <div className="card-h"><span className="h3">{x.blotter}</span><span className="hint">{x.blotterHint}</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>{x.inv}</th><th>{x.importer}</th><th>{x.market}</th><th className="r">{x.amount}</th><th className="r">{x.due}</th><th className="r">{x.delay}</th><th>{x.action}</th></tr></thead>
            <tbody>
              {receivables.map((r) => {
                const hit = r.id === RECEIVABLE.id;
                return (
                  <tr key={r.id}>
                    <td className="num">{r.id}</td>
                    <td>{r.customer}</td>
                    <td>{r.country}</td>
                    <td className="r num">{r.currency === "CNY" ? "¥" : "USD "}{r.amount.toLocaleString(lang === "es" ? "es-CL" : "en-US")}</td>
                    <td className="r num">{r.due_date}</td>
                    <td className={`r num${hit ? " down" : ""}`}>{"announced_delay_days" in r && r.announced_delay_days ? `+${r.announced_delay_days}D` : "—"}</td>
                    <td>
                      {hit ? (resolved ? <span className="badge ok">{x.financed}</span> : <Link href="/approvals" className="badge warn">{x.pending}</Link>) : <span className="badge ok">{x.monitor}</span>}
                      {"lc_backed" in r && r.lc_backed ? <> <span className="badge">{x.lc}</span></> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
