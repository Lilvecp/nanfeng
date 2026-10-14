"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import type { ApiEvent } from "@/lib/api";
import { fmtLocal, useDesk } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, S, cashTick, clpM, pct, usd } from "@/lib/scenario";

type Step = { n: number; step: Record<Lang, string>; tool: string; tier: 0 | 1 | 3; model: string; sec: number | null };

// The Cherry Crisis run as a scripted replay. Latency and cost were never measured for these steps,
// so none are shown; the only timing is the MILP solve time, which the quant engine records itself.
// The live event stream below (SSE) is the real run.
const AGENT: Step[] = [
  { n: 1, step: { en: "Read delay notice via OCR", es: "Leyó el aviso de atraso (OCR)", zh: "OCR 读取延迟通知" }, tool: "ocr.extract", tier: 0, model: "Mistral OCR", sec: null },
  { n: 2, step: { en: "Re-ran 10,000 scenarios", es: "Recalculó 10.000 escenarios", zh: "重新模拟10,000个情景" }, tool: "forecast_run", tier: 0, model: "Monte Carlo", sec: null },
  { n: 3, step: { en: `Checked ${N.products} financing products · ${N.eligible} eligible`, es: `Revisó ${N.products} productos de financiamiento · ${N.eligible} elegibles`, zh: `评估${N.products}种融资产品 · ${N.eligible}种符合条件` }, tool: "financing_quote", tier: 1, model: "catalog", sec: null },
  { n: 4, step: { en: "Optimizer selected plan", es: "El optimizador eligió el plan", zh: "优化器选定方案" }, tool: "optimize_plan", tier: 0, model: "MILP OR-Tools CBC", sec: Math.round(S.plan.solveSeconds * 10) / 10 },
];

// The bars show the order of the steps, not their duration (one equal slot each).
const AGENT_SPAN = 76;
const SLOT = AGENT_SPAN / AGENT.length;
const STEPS = AGENT.map((s, i) => ({ ...s, left: i * SLOT, width: SLOT }));
const secs = (v: number, lang: Lang) => `${v.toLocaleString(lang === "es" ? "es-CL" : "en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${lang === "zh" ? "秒" : " s"}`;
const axis = (lang: Lang) => `${lang === "es" ? "orden" : lang === "zh" ? "顺序" : "order"} 1 → ${AGENT.length} │ ${lang === "es" ? "dueño" : lang === "zh" ? "企业主" : "owner"}`;

const FOGAPE_COST = S.explanation.find((e) => e.productId.startsWith("FOGAPE"))?.aloneCostClp ?? 0;
const REPLIES: { match: RegExp; text: Record<Lang, string> }[] = [
  { match: /on time|a tiempo|day ?10|día ?10|第10天|按时/i, text: {
    en: `If Shanghai pays on its due date, the chance of negative cash on ${N.crunchDate} drops from ${N.pNeg} to ${pct(S.after.probNegIfOnTime)} and no new financing is needed.`,
    es: `Si Shanghái paga en la fecha original, la probabilidad de caja negativa el ${N.crunchDate} baja de ${N.pNeg} a ${pct(S.after.probNegIfOnTime)} y no hace falta financiamiento nuevo.`,
    zh: `如果上海客户按原定日期付款，${N.crunchDate}现金为负的概率将从${N.pNeg}降至${pct(S.after.probNegIfOnTime)}，无需新的融资。` } },
  { match: /fogape/i, text: {
    en: `FOGAPE has a low rate, but its shortest term is 365 days: interest keeps running long after the gap closes. On its own it would cost ${clpM(FOGAPE_COST)} vs ${clpM(N.planCost)} for the PAE loan.`,
    es: `FOGAPE tiene una tasa baja, pero su plazo mínimo es de 365 días: los intereses siguen corriendo mucho después de cerrar la brecha. Sola costaría ${clpM(FOGAPE_COST, "es")} vs ${clpM(N.planCost, "es")} del crédito PAE.`,
    zh: `FOGAPE 利率较低，但最短期限为365天：缺口补足后利息仍会持续很久。单独使用成本为${clpM(FOGAPE_COST, "zh")}，PAE 贷款仅${clpM(N.planCost, "zh")}。` } },
  { match: /forward|cny|hedge|yuan|人民币|对冲/i, text: {
    en: "The CNY invoices are collected in mid-January, after the crunch day. A forward would lock their rate but brings no cash for the payroll, so the optimizer leaves it out at this confidence level.",
    es: "Las facturas en CNY se cobran a mediados de enero, después del día crítico. Un forward fija su tipo de cambio pero no trae plata para los sueldos, así que el optimizador lo deja fuera con este nivel de confianza.",
    zh: "人民币发票在1月中旬（危机日之后）收回。远期合约可锁定汇率，但无法为工资提供现金，因此在当前置信水平下优化器未选择它。" } },
];

const TX = {
  en: {
    run: "Run", halted: "AGENT HALTED · KILL SWITCH", pausedS: "RUN PAUSED", complete: "RUN COMPLETE · EXECUTED", awaiting: "AWAITING APPROVAL · L3",
    trigger: "TRIGGER email:shanghai-hongxin · SCENARIO TIME 10:12",
    replayNote: "Scripted replay of the Cherry Crisis run · no measured latency or cost",
    resumed: "Run resumed", pausedT: "Run paused · no new tool calls", resume: "Resume", pause: "Pause", rearm: "Re-arm agent", confirm: "Confirm kill", cancel: "Cancel", kill: "Kill switch", rearmCode: "Re-arm with code", otpPh: "Code", rearmAria: "One-time code to re-arm the agent",
    stop: "STOP", stopBody: "Kill switch engaged. The agent cannot call any tool until it is re-armed. Pending approvals stay frozen; nothing executes.",
    trace: "Execution trace · waterfall", doneL: "DONE", waiting: "WAITING ON OWNER", cols: ["#", "Step", "Tool", "Tier", "Model", axis("en"), "Solver time"],
    approved: "Approved by owner (OTP)", rejected: "Rejected by owner", awaitingStep: "Awaiting approval", closed: "closed", open: "open", executedStep: "Executed in sandbox · hash anchored",
    live: "Live event stream · SSE", events: "EVENTS", liveCols: ["#", "Time", "Source", "Event", "Detail"], waitingEvents: "WAITING FOR EVENTS FROM THE AGENT",
    detail: "Step 5 · detail", executed: "Executed", openApproval: "Open approval", costL: "cost", defaultLoan: "default bank loan", whyL3: "why L3", whyL3Body: "new money · counterparty first use this season · > L2 cap CLP 25M", notified: "notified", timeout: "timeout", autoCancel: "auto-cancel, no action",
    ask: "Ask why", query: "Ask the agent", ph: "> what if Shanghai pays on time?",
    q0: "why the PAE loan over the bank loan?", a0: `Both close the gap, but the PAE loan costs ${clpM(N.planCost)} vs ${clpM(N.defaultCost)} (${N.savingsPct} cheaper) and is repaid in USD with the export proceeds. Bank factoring will not buy ${S.event.invoice} because its buyer already announced a delay.`,
    fallback: "In the sandbox I answer questions about the Cherry Crisis run: try “on time”, FOGAPE or the CNY forward.",
  },
  es: {
    run: "Corrida", halted: "AGENTE DETENIDO · FRENO DE EMERGENCIA", pausedS: "CORRIDA EN PAUSA", complete: "CORRIDA TERMINADA · EJECUTADA", awaiting: "ESPERANDO APROBACIÓN · L3",
    trigger: "ORIGEN correo:shanghai-hongxin · HORA DEL ESCENARIO 10:12",
    replayNote: "Repetición guionada de la corrida Cherry Crisis · sin latencia ni costo medidos",
    resumed: "Corrida reanudada", pausedT: "Corrida en pausa · sin nuevas llamadas a herramientas", resume: "Reanudar", pause: "Pausar", rearm: "Reactivar agente", confirm: "Confirmar freno", cancel: "Cancelar", kill: "Freno de emergencia", rearmCode: "Reactivar con código", otpPh: "Código", rearmAria: "Código de un solo uso para reactivar el agente",
    stop: "ALTO", stopBody: "Freno de emergencia activado. El agente no puede usar ninguna herramienta hasta que lo reactives. Las aprobaciones pendientes quedan congeladas; nada se ejecuta.",
    trace: "Traza de ejecución · cascada", doneL: "HECHO", waiting: "ESPERANDO AL DUEÑO", cols: ["#", "Paso", "Herramienta", "Nivel", "Modelo", axis("es"), "Tiempo del solver"],
    approved: "Aprobado por el dueño (código)", rejected: "Rechazado por el dueño", awaitingStep: "Esperando aprobación", closed: "cerrado", open: "abierto", executedStep: "Ejecutado en el sandbox · hash anclado",
    live: "Eventos en vivo · SSE", events: "EVENTOS", liveCols: ["#", "Hora", "Origen", "Evento", "Detalle"], waitingEvents: "ESPERANDO EVENTOS DEL AGENTE",
    detail: "Paso 5 · detalle", executed: "Ejecutado", openApproval: "Abrir aprobación", costL: "costo", defaultLoan: "crédito bancario", whyL3: "por qué L3", whyL3Body: "plata nueva · primera vez con este prestamista en la temporada · > tope L2 CLP 25M", notified: "avisado", timeout: "vence", autoCancel: "se cancela solo, sin ejecutar",
    ask: "Pregúntale por qué", query: "Preguntar al agente", ph: "> ¿y si Shanghái paga a tiempo?",
    q0: "¿por qué el crédito PAE y no el crédito del banco?", a0: `Ambos cierran la brecha, pero el crédito PAE cuesta ${clpM(N.planCost, "es")} vs ${clpM(N.defaultCost, "es")} (${N.savingsPct} más barato) y se paga en USD con el retorno de la exportación. El factoring del banco no compra la ${S.event.invoice} porque su cliente ya avisó que pagará tarde.`,
    fallback: "En el sandbox respondo preguntas sobre la Cherry Crisis: prueba “a tiempo”, FOGAPE o el forward en CNY.",
  },
  zh: {
    run: "运行", halted: "代理已停止 · 紧急停止", pausedS: "运行已暂停", complete: "运行完成 · 已执行", awaiting: "等待批准 · L3",
    trigger: "触发 邮件:shanghai-hongxin · 情景时间 10:12",
    replayNote: "樱桃危机运行的脚本回放 · 无实测延迟或成本",
    resumed: "运行已恢复", pausedT: "运行已暂停 · 不再调用工具", resume: "恢复", pause: "暂停", rearm: "重新启用代理", confirm: "确认停止", cancel: "取消", kill: "紧急停止", rearmCode: "凭验证码恢复", otpPh: "验证码", rearmAria: "恢复代理所需的一次性验证码",
    stop: "停止", stopBody: "紧急停止已启动。重新启用之前，代理无法调用任何工具。待批事项全部冻结，不会执行任何操作。",
    trace: "执行轨迹 · 瀑布图", doneL: "完成", waiting: "等待企业主", cols: ["#", "步骤", "工具", "级别", "模型", axis("zh"), "求解时间"],
    approved: "企业主已批准（验证码）", rejected: "企业主已拒绝", awaitingStep: "等待批准", closed: "已关闭", open: "进行中", executedStep: "已在沙盒执行 · 哈希已锚定",
    live: "实时事件流 · SSE", events: "个事件", liveCols: ["#", "时间", "来源", "事件", "详情"], waitingEvents: "等待代理事件",
    detail: "第5步 · 详情", executed: "已执行", openApproval: "打开审批", costL: "成本", defaultLoan: "银行贷款", whyL3: "为何 L3", whyL3Body: "新增资金 · 本季首次使用该贷款方 · 超过 L2 上限 2,500万智利比索", notified: "已通知", timeout: "超时", autoCancel: "自动取消，不执行",
    ask: "问问原因", query: "询问代理", ph: "> 如果上海客户按时付款呢？",
    q0: "为什么选 PAE 贷款而不是银行贷款？", a0: `两者都能补足缺口，但 PAE 贷款成本${clpM(N.planCost, "zh")}，银行贷款${clpM(N.defaultCost, "zh")}（便宜${N.savingsPct}），并以出口美元收入偿还。银行保理不会买断 ${S.event.invoice}，因为买家已通知延迟付款。`,
    fallback: "在沙盒中，我可以回答关于樱桃危机的问题：试试“按时”、FOGAPE 或人民币远期。",
  },
};

/** One line per backend event: what happened and the fields worth showing. */
function describe(e: ApiEvent): string {
  const d = e.data as Record<string, unknown>;
  const pick = (...keys: string[]) => keys.filter((k) => d[k] !== undefined && d[k] !== null).map((k) => `${k}=${typeof d[k] === "object" ? JSON.stringify(d[k]) : d[k]}`).join(" · ");
  if (e.type.startsWith("approval.")) return pick("id", "action", "tier", "status", "otp_attempts_left");
  if (e.type.startsWith("bank.")) return pick("receivable_id", "payee", "currency", "amount_clp", "proceeds_clp", "audit_seq");
  if (e.type === "audit.anchored") return pick("anchor_id", "from_seq", "to_seq", "backend");
  if (e.type.startsWith("quant.")) return pick("job_id", "message", "error");
  return pick("step", "tool", "tier", "model", ...(d.cost_usd ? ["cost_usd"] : []), ...(d.latency_s ? ["latency_s"] : []), "status", "on") || JSON.stringify(d).slice(0, 120);
}

export default function MissionPage() {
  const t = useT();
  const lang = useLang();
  const x = TX[lang];
  const { approval, notify, mode, events, killSwitch: killed, setKillSwitch } = useDesk();
  const [paused, setPaused] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  // Re-arming on the live API is L3: the owner types the one-time code (in the demo, the sandbox code).
  const [rearm, setRearm] = useState(false);
  const [rearmCode, setRearmCode] = useState("");
  const [chat, setChat] = useState<{ who: "out" | "in"; text: string }[]>([]);
  const [q, setQ] = useState("");
  const done = approval === "approved";

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const reply = REPLIES.find((r) => r.match.test(q))?.text[lang] ?? x.fallback;
    setChat((c) => [...c, { who: "out", text: q }, { who: "in", text: reply }]);
    setQ("");
  };

  const status = killed ? { dot: "crit", text: x.halted } : paused ? { dot: "idle", text: x.pausedS } : done ? { dot: "", text: x.complete } : { dot: "warn blink", text: x.awaiting };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
        <div className="tick"><span className="l">{x.run}</span><span className="v">#0412</span></div>
        <span className="status"><span className={`dot ${status.dot}`} />{status.text}</span>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 className="h1">{t("tab.agent")}</h1><span className="mono small muted">{x.trigger}</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" disabled={killed} aria-pressed={paused} onClick={() => { setPaused((p) => !p); notify(paused ? x.resumed : x.pausedT); }}>{paused ? x.resume : x.pause} <span className="key">P</span></button>
            {killed ? (
              mode === "live" && rearm ? (
                <form style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onSubmit={async (e) => {
                  e.preventDefault();
                  if (await setKillSwitch(false, rearmCode)) { setRearm(false); setPaused(false); }
                  setRearmCode("");
                }}>
                  <input className="input mono" style={{ width: 120 }} inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder={x.otpPh} aria-label={x.rearmAria}
                    value={rearmCode} onChange={(e) => setRearmCode(e.target.value.replace(/\D/g, ""))} autoFocus />
                  <button className="btn btn-primary" type="submit" disabled={rearmCode.length !== 6}>{x.rearmCode}</button>
                  <button className="btn btn-secondary" type="button" onClick={() => { setRearm(false); setRearmCode(""); }}>{x.cancel}</button>
                </form>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => { if (mode === "live") setRearm(true); else { setPaused(false); void setKillSwitch(false); } }}>{x.rearm}</button>
              )
            ) : confirmKill ? (
              <>
                <button className="btn btn-danger" type="button" style={{ minHeight: 48 }} onClick={() => { setConfirmKill(false); void setKillSwitch(true); }}>{x.confirm}</button>
                <button className="btn btn-secondary" type="button" onClick={() => setConfirmKill(false)}>{x.cancel}</button>
              </>
            ) : (
              <button data-guide="agent-kill" className="btn btn-danger" type="button" style={{ minHeight: 48, padding: "0 20px" }} onClick={() => setConfirmKill(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" /></svg>{x.kill} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>⇧K</span>
              </button>
            )}
          </div>
        </div>

        {killed && (
          <div className="alert crit"><span className="ic">{x.stop}</span><span className="small">{x.stopBody}</span></div>
        )}

        <div className="card" data-guide="agent-trace">
          <div className="card-h"><span className="h3">{x.trace} <span className="badge" style={{ color: "var(--warn)" }} title={x.replayNote}>{t("shell.replay")}</span></span><div className="legend"><span><i className="sw" style={{ background: "var(--ok)" }} />{x.doneL}</span><span><i className="sw" style={{ background: "repeating-linear-gradient(90deg, var(--crit) 0 3px, transparent 3px 5px)" }} />{x.waiting}</span></div></div>
          <div className="card-b" style={{ paddingTop: 0, paddingBottom: 0 }}><span className="hint">{x.replayNote}</span></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>{x.cols.map((c, i) => <th key={c} className={i >= 6 ? "r" : undefined} style={i === 5 ? { width: "32%" } : undefined}>{c}</th>)}</tr></thead>
            <tbody>
              {STEPS.map((s) => (
                <tr key={s.n}>
                  <td className="num">{s.n}</td><td>{s.step[lang]}</td><td className="num">{s.tool}</td>
                  <td><span className={`tier t${s.tier}`}><b>L{s.tier}</b></span></td>
                  <td className="num small">{s.model}</td>
                  <td><div style={{ position: "relative", height: 12, background: "var(--surface-2)" }}><div style={{ position: "absolute", left: `${s.left}%`, width: `${s.width}%`, top: 0, bottom: 0, background: "var(--ok)" }} /></div></td>
                  <td className="r num">{s.sec === null ? "—" : secs(s.sec, lang)}</td>
                </tr>
              ))}
              <tr className={done ? undefined : "pick"}>
                <td className="num">5</td>
                <td><b>{done ? x.approved : approval === "rejected" ? x.rejected : x.awaitingStep}</b></td>
                <td className="num">loan.request</td>
                <td><span className="tier t3"><b>L3</b><span>OTP</span></span></td>
                <td className="num small">—</td>
                <td><div style={{ position: "relative", height: 12, background: "var(--surface-2)" }}><div style={{ position: "absolute", left: `${AGENT_SPAN + 1}%`, right: done ? "6%" : 0, top: 0, bottom: 0, background: done ? "var(--ok)" : "repeating-linear-gradient(90deg, var(--crit) 0 6px, transparent 6px 9px)" }} /></div></td>
                <td className={`r num ${done ? "" : "down"}`}>{done ? "—" : approval === "rejected" ? x.closed : x.open}</td>
              </tr>
              {done && (
                <tr>
                  <td className="num">6</td><td>{x.executedStep}</td><td className="num">audit.anchor</td>
                  <td><span className="tier t0"><b>L0</b></span></td><td className="num small">—</td>
                  <td><div style={{ position: "relative", height: 12, background: "var(--surface-2)" }}><div style={{ position: "absolute", left: "94%", right: 0, top: 0, bottom: 0, background: "var(--ok)" }} /></div></td>
                  <td className="r num">—</td>
                </tr>
              )}
            </tbody>
          </table></div>
        </div>

        {mode === "live" && (
          <div className="card" data-guide="agent-live">
            <div className="card-h">
              <span className="h3">{x.live}</span>
              <span className="status"><span className="dot" />{events.length} {x.events}</span>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 280, overflowY: "auto" }} aria-live="polite"><table className="tbl">
              <thead><tr>{x.liveCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {[...events].reverse().map((e) => (
                  <tr key={e.id}>
                    <td className="num">{e.id}</td>
                    <td className="num">{fmtLocal(e.ts, false)}</td>
                    <td className="mono small">{e.source}</td>
                    <td className="num">{e.type}</td>
                    <td className="mono small muted" style={{ wordBreak: "break-all" }}>{describe(e)}</td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={5} className="mono small muted">{x.waitingEvents}<span className="blink">_</span></td></tr>}
              </tbody>
            </table></div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card">
            <div className="card-h">
              <span className="h3">{x.detail} <span className="badge" style={{ color: "var(--warn)" }} title={x.replayNote}>{t("shell.replay")}</span></span>
              {done ? <span className="badge ok">{x.executed}</span> : <Link className="btn btn-primary btn-sm" href="/approvals">{x.openApproval} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>A</span></Link>}
            </div>
            <div className="card-b mono small" style={{ gap: 6 }}>
              <span><span className="muted">action    </span> loan.request(lender=&quot;{S.approvalRequest.operations[0].params.lender_id}&quot;, amount={usd(N.loanUsd)}, term={N.termDays}D, env=sandbox)</span>
              <span><span className="muted">{x.costL.padEnd(10)}</span> {clpM(N.planCost, lang)} vs {clpM(N.defaultCost, lang)} {x.defaultLoan}</span>
              <span><span className="muted">{x.whyL3.padEnd(10)}</span> {x.whyL3Body}</span>
              <span><span className="muted">{x.notified.padEnd(10)}</span> WhatsApp 10:15:06 · web 10:15:06</span>
              <span><span className="muted">{x.timeout.padEnd(10)}</span> 23:41:06 → {x.autoCancel}</span>
            </div>
          </div>
          <div className="card" data-guide="agent-ask">
            <div className="card-h"><span className="h3">{x.ask}</span></div>
            <div className="card-b">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }} aria-live="polite">
                {[{ who: "out" as const, text: x.q0 }, { who: "in" as const, text: x.a0 }, ...chat].map((m, i) => <div key={i} className={`bubble ${m.who}`} style={{ maxWidth: "100%" }}>{m.text}</div>)}
              </div>
              <form className="field" onSubmit={ask}>
                <label htmlFor="ttmc-ask">{x.query}</label>
                <input id="ttmc-ask" className="input" placeholder={x.ph} value={q} onChange={(e) => setQ(e.target.value)} disabled={killed} />
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
