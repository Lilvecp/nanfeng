"use client";

import { CloseButton } from "@/components/close-button";
import { setDismissed, useDismissed } from "@/lib/dismiss";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Receipt } from "@/components/receipt";
import { Topbar } from "@/components/topbar";
import { SANDBOX_OTP, useDesk, type HistoryRow } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import { N, RECEIVABLE, S, SHORT_CUSTOMER, cashTick, clpFull, clpM, cny, longDate, money, pct, pesos, usd } from "@/lib/scenario";

type Filter = "all" | "approved" | "rejected" | "auto";

const PAE = S.arena.find((a) => a.product === "Pre-export loan in USD (PAE)")!;

// Copy for the request card (fe-11). Numbers come from the quant engine (lib/scenario.ts).
const TX = {
  en: {
    plain: `In plain words: you are approving a loan of ${usd(N.loanUsd)} that arrives on ${longDate(N.crunchDate)} to pay the harvest wages. It costs ${pesos(N.planCost)}, ${pesos(N.savings)} less than a regular bank loan. To confirm, type the 6-digit code we sent you by SMS.`,
    queue: "Queue", awaiting: "1 ACTION AWAITING YOU", clear: "NOTHING PENDING", approvedAt: (t: string) => `Approved ${t} · code verified`, back: "Back home", audit: "Audit log", compare: "Compare options", expires: "code valid for", reasonPh: "> call the importer first", reasonReq: "Write a short reason so the agent knows what to try next.",
    filters: { all: "ALL", approved: "APPROVED", rejected: "REJECTED", auto: "AUTO" } as Record<Filter, string>, dec: { approved: "Approved", rejected: "Rejected", auto: "Auto" } as Record<HistoryRow["decision"], string>,
    cols: ["Time", "ID", "Action", "Level", "Amount", "Decision", "Channel", "Note"], none: "NO ACTIONS IN RANGE",
    request: "Request pre-export loan (PAE)", bridges: `bridges ${RECEIVABLE.id} · ${SHORT_CUSTOMER}`, cost: "Plan cost", term: "Term", coverage: "Above buffer",
    what: "What happens", whatBody: `${N.lender} lends ${usd(N.loanUsd)} on ${longDate(N.crunchDate)}, the day of the harvest payroll. You repay it in USD with the export proceeds by ${longDate(S.plan.maturity ?? N.crunchDate)}.`,
    ifRejected: "If rejected", ifRejectedBody: `${N.pNeg} chance of running out of cash on ${longDate(N.crunchDate)} (payroll ${clpM(N.payroll)}). The agent prepares the next-cheapest option: export factoring.`,
    approvedBody: `Loan request sent to ${N.lender} (sandbox). Every step is hash-chained and anchored on-chain.`,
    rejectedBody: (r: string) => `Reason: “${r}”. The agent is preparing the next-cheapest option (export factoring) and will ask again.`,
    verifying: `Verifying with ${N.lender}`,
    status: { pending: "Pending", approved: "Approved", rejected: "Rejected" }, tierL3: "OWNER+CODE", risk: "Risk: medium", executed: "Executed", ttl: "Expires in", eac: "Annual cost",
    errLen: "Type all 6 digits of the code.", errLock: "Too many wrong codes. Send yourself a new code to try again.", errBad: (n: number) => `That code didn't match. ${n} ${n === 1 ? "attempt" : "attempts"} left; check the SMS and try again.`,
    otpGroup: "One-time code", digit: "Digit", filter: "Filter",
    resend: "Send a new code", resetSandbox: "Reset the sandbox", reassure: `Cash stays above the safety buffer in ${N.coverage} of scenarios · sandbox · no real funds move`,
    notes: {} as Record<string, string>,
  },
  es: {
    plain: `En simple: estás aprobando un crédito de ${usd(N.loanUsd, "es")} que llega el ${longDate(N.crunchDate, "es")} para pagar los sueldos de la cosecha. Cuesta ${pesos(N.planCost, "es")}, ${pesos(N.savings, "es")} menos que un crédito normal del banco. Para confirmar, escribe el código de 6 dígitos que te llegó por SMS.`,
    queue: "Pendientes", awaiting: "1 ACCIÓN ESPERA TU OK", clear: "NADA PENDIENTE", approvedAt: (t: string) => `Aprobado ${t} · código verificado`, back: "Volver al inicio", audit: "Auditoría", compare: "Comparar opciones", expires: "el código vale por", reasonPh: "> primero llamar al importador", reasonReq: "Escribe un motivo corto para que el agente sepa qué probar después.",
    filters: { all: "TODO", approved: "APROBADAS", rejected: "RECHAZADAS", auto: "AUTOMÁTICAS" } as Record<Filter, string>, dec: { approved: "Aprobada", rejected: "Rechazada", auto: "Automática" } as Record<HistoryRow["decision"], string>,
    cols: ["Hora", "ID", "Acción", "Nivel", "Monto", "Decisión", "Canal", "Nota"], none: "NO HAY ACCIONES",
    request: "Solicitar crédito de pre-exportación (PAE)", bridges: `cubre la ${RECEIVABLE.id} · ${SHORT_CUSTOMER}`, cost: "Costo del plan", term: "Plazo", coverage: "Sobre el colchón",
    what: "Qué pasa", whatBody: `${N.lender} presta ${usd(N.loanUsd, "es")} el ${longDate(N.crunchDate, "es")}, el día de la nómina de cosecha. Lo pagas en USD con el retorno de la exportación, a más tardar el ${longDate(S.plan.maturity ?? N.crunchDate, "es")}.`,
    ifRejected: "Si lo rechazas", ifRejectedBody: `${N.pNeg} de probabilidad de quedar sin caja el ${longDate(N.crunchDate, "es")} (nómina ${clpM(N.payroll, "es")}). El agente prepara la siguiente opción más barata: factoring de exportación.`,
    approvedBody: `Solicitud de crédito enviada a ${N.lender} (sandbox). Cada paso queda con hash encadenado y anclado on-chain.`,
    rejectedBody: (r: string) => `Motivo: “${r}”. El agente prepara la siguiente opción más barata (factoring de exportación) y volverá a preguntar.`,
    verifying: `Verificando con ${N.lender}`,
    status: { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" }, tierL3: "DUEÑO+CÓDIGO", risk: "Riesgo: medio", executed: "Ejecutada", ttl: "Vence en", eac: "CAE",
    errLen: "Escribe los 6 dígitos del código.", errLock: "Demasiados códigos incorrectos. Pide un código nuevo para volver a intentarlo.", errBad: (n: number) => `El código no coincide. ${n === 1 ? "Queda 1 intento" : `Quedan ${n} intentos`}; revisa el SMS y vuelve a probar.`,
    otpGroup: "Código de un solo uso", digit: "Dígito", filter: "Filtro",
    resend: "Enviar código nuevo", resetSandbox: "Reiniciar el sandbox", reassure: `La caja queda sobre el colchón en el ${N.coverage} de los escenarios · sandbox · sin dinero real`,
    notes: { "within limit · allowlisted": "dentro del límite · cuenta autorizada", "\"Too expensive, check other options\"": "\"Muy caro, revisa otras opciones\"", "Cherry Crisis plan": "Plan Cherry Crisis" } as Record<string, string>,
  },
  zh: {
    plain: `简单来说：您正在批准一笔 ${usd(N.loanUsd, "zh")}（${cny(N.loanClp)}）的贷款，于${longDate(N.crunchDate, "zh")}到账，用于发放采收工资。成本${pesos(N.planCost, "zh")}（${cny(N.planCost)}），比普通银行贷款少${pesos(N.savings, "zh")}（${cny(N.savings)}）。请输入短信收到的6位验证码确认。`,
    queue: "待处理", awaiting: "1 项操作等待您批准", clear: "无待处理事项", approvedAt: (t: string) => `已于 ${t} 批准 · 验证码已确认`, back: "返回首页", audit: "审计日志", compare: "比较方案", expires: "验证码有效期", reasonPh: "> 先致电进口商", reasonReq: "请简单写明原因，代理据此准备下一个方案。",
    filters: { all: "全部", approved: "已批准", rejected: "已拒绝", auto: "自动" } as Record<Filter, string>, dec: { approved: "已批准", rejected: "已拒绝", auto: "自动" } as Record<HistoryRow["decision"], string>,
    cols: ["时间", "编号", "操作", "级别", "金额", "决定", "渠道", "备注"], none: "暂无操作",
    request: "申请出口前融资（PAE）", bridges: `为发票 ${RECEIVABLE.id} 过桥 · 上海鸿信`, cost: "方案成本", term: "期限", coverage: "高于安全垫",
    what: "执行内容", whatBody: `${N.lender} 于${longDate(N.crunchDate, "zh")}（采收工资发放日）放款 ${usd(N.loanUsd, "zh")}，您最晚于${longDate(S.plan.maturity ?? N.crunchDate, "zh")}以出口美元收入还款。`,
    ifRejected: "若拒绝", ifRejectedBody: `${longDate(N.crunchDate, "zh")}现金为负的概率为 ${N.pNeg}（工资 ${clpM(N.payroll, "zh")}）。代理将准备次优方案：出口保理。`,
    approvedBody: `贷款申请已发送至 ${N.lender}（沙盒）。每一步均已哈希链接并上链锚定。`,
    rejectedBody: (r: string) => `原因：“${r}”。代理正在准备次优方案（出口保理），稍后将再次请求审批。`,
    verifying: `正在与 ${N.lender} 验证`,
    status: { pending: "待批准", approved: "已批准", rejected: "已拒绝" }, tierL3: "企业主+验证码", risk: "风险：中", executed: "已执行", ttl: "剩余", eac: "年化成本",
    errLen: "请输入完整的6位验证码。", errLock: "错误次数过多。请获取新验证码后再试。", errBad: (n: number) => `验证码不正确，还剩 ${n} 次机会，请核对短信后重试。`,
    otpGroup: "一次性验证码", digit: "第几位", filter: "筛选",
    resend: "发送新验证码", resetSandbox: "重置沙盒", reassure: `${N.coverage}的情景中现金高于安全垫 · 沙盒 · 不涉及真实资金`,
    notes: { "within limit · allowlisted": "未超限额 · 白名单账户", "\"Too expensive, check other options\"": "\"太贵了，看看其他方案\"", "Cherry Crisis plan": "樱桃危机方案" } as Record<string, string>,
  },
};

const DECISION_BADGE: Record<HistoryRow["decision"], { cls: string; label: string }> = {
  approved: { cls: "badge ok", label: "Approved" },
  rejected: { cls: "badge crit", label: "Rejected" },
  auto: { cls: "badge acc", label: "Auto" },
};

/** A clock that really runs: "23:41:06" counting down from the moment the screen opens. */
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(left / 3600);
  return h ? `${p(h)}:${p(Math.floor((left % 3600) / 60))}:${p(left % 60)}` : `${p(Math.floor(left / 60))}:${p(left % 60)}`;
}

function OtpInput({ disabled, onChange, group, digit, focus = false }: { disabled: boolean; onChange: (code: string) => void; group: string; digit: string; focus?: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // pasted the whole code
      const next = clean.slice(0, 6).split("");
      const filled = [...next, ...Array(6 - next.length).fill("")];
      setDigits(filled);
      refs.current[Math.min(next.length, 5)]?.focus();
      onChange(filled.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    onChange(next.join(""));
  };

  return (
    <div className="otp" role="group" aria-label={group}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          id={i === 0 ? "tta-otp1" : undefined}
          autoFocus={focus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          value={d}
          disabled={disabled}
          aria-label={`${digit} ${i + 1}`}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

export default function ApprovalsPage() {
  const lang = useLang();
  const x = TX[lang];
  const ttl = useCountdown(23 * 3600 + 41 * 60 + 6);
  const expires = useCountdown(4 * 60 + 12);
  const plainClosed = useDismissed("approvals-plain");
  const t = useT();
  const { mode, receipt, approval, approvalId, otpAttemptsLeft, rejectReason, history, submitOtp, resendOtp, reject, resetDemo } = useDesk();
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [otpKey, setOtpKey] = useState(0);

  const pending = approval === "pending";
  const rows = history.filter((r) => filter === "all" || r.decision === filter);

  const locked = otpAttemptsLeft <= 0;
  const newCode = async () => {
    if (await resendOtp()) {
      setOtpError(null);
      setCode("");
      setOtpKey((k) => k + 1);
    }
  };

  const approve = async (value = code) => {
    if (value.length < 6) {
      setOtpError(x.errLen);
      return;
    }
    const r = await submitOtp(value);
    if (r.status === "ok" || r.status === "cancelled") setOtpError(null);
    else {
      setOtpError(r.status === "locked" || r.attemptsLeft <= 0 ? x.errLock : x.errBad(r.attemptsLeft));
      setCode("");
      setOtpKey((k) => k + 1);
    }
  };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
        <div className="tick"><span className="l">{x.queue}</span><span className={`v${pending ? " down" : ""}`}>{pending || approval === "verifying" ? 1 : 0}</span></div>
        <span className="status"><span className={`dot${pending ? " warn" : ""}`} />{pending ? x.awaiting : x.clear}</span>
      </Topbar>

      <div className="content">
        <h1 className="h1">{t("approvals.title")}</h1>
        {pending && !plainClosed && (
          <div className="owner-alert info" data-guide="appr-plain"><span className="owner-alert-ic" aria-hidden="true">i</span><div className="owner-alert-txt"><span>{x.plain}</span></div><CloseButton onClick={() => setDismissed("approvals-plain")} /></div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(360px, 1fr)", gap: 12, alignItems: "start" }}>
          <div className="card" data-guide="appr-request">
            <div className="card-h">
              <span className="h3">{pending || approval === "verifying" ? x.status.pending : approval === "approved" ? x.status.approved : x.status.rejected} · {approvalId}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tier t3"><b>L3</b><span>{x.tierL3}</span></span>
                <span className="badge warn">{x.risk}</span>
                {approval === "approved" ? <span className="badge ok">{x.executed}</span> : approval === "rejected" ? <span className="badge crit">{x.status.rejected}</span> : <span className="badge">{x.ttl} <span className="num">{ttl}</span></span>}
              </div>
            </div>
            <div className="card-b" style={{ gap: 14, padding: 18 }}>
              <span className="kpi-l">{x.request}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}><span className="num" style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 700, lineHeight: 1 }}>{usd(N.loanUsd, lang)}</span><span className="mono muted">≈ {clpFull(N.loanClp, lang)}{lang === "zh" ? ` · ${cny(N.loanClp)}` : ""}</span></div>
              <span className="small">{N.lender} <span className="badge">sandbox</span> · {x.bridges}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <div className="kpi"><span className="kpi-l">{x.eac}</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{pct(PAE.eac)}</span></div>
              <div className="kpi"><span className="kpi-l">{x.cost}</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{clpM(N.planCost, lang)}</span></div>
              <div className="kpi"><span className="kpi-l">{x.term}</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{N.termDays}D</span></div>
              <div className="kpi"><span className="kpi-l">{x.coverage}</span><span className="num up" style={{ fontSize: 20, fontWeight: 700 }}>{N.coverage}</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: approval === "approved" ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))" }}>
              <div className="card-b" style={{ borderRight: approval === "approved" ? 0 : "1px solid var(--line)" }}><span className="h3">{x.what}</span><span className="small">{x.whatBody}</span></div>
              {approval !== "approved" && <div className="card-b"><span className="h3" style={{ color: "var(--warn)" }}>{x.ifRejected}</span><span className="small">{x.ifRejectedBody}</span></div>}
            </div>
          </div>

          <div className="card" data-guide="appr-authorize" style={{ borderColor: approval === "approved" ? "var(--ok)" : approval === "rejected" ? "var(--crit)" : "var(--accent)" }}>
            <div className="card-h" style={{ background: approval === "approved" ? "var(--ok-soft)" : approval === "rejected" ? "var(--crit-soft)" : "var(--accent-soft)" }}>
              <span className="h3" style={{ color: "var(--text)" }}>{t("approvals.authorize")}</span>
              <span className="hint">SMS → +56 9 •••• 4127</span>
            </div>
            {approval === "approved" ? (
              <div className="card-b" style={{ gap: 12, padding: 18 }}>
                <span className="badge ok" style={{ alignSelf: "flex-start" }}>{x.approvedAt(receipt.time)}</span>
                <span className="small">{x.approvedBody}</span>
                <Receipt />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link className="btn btn-primary" href="/cockpit">{x.back}</Link>
                  <Link className="btn btn-secondary" href="/security">{x.audit}</Link>
                </div>
              </div>
            ) : approval === "rejected" ? (
              <div className="card-b" style={{ gap: 12, padding: 18 }}>
                <span className="badge crit" style={{ alignSelf: "flex-start" }}>{x.status.rejected}</span>
                <span className="small">{x.rejectedBody(rejectReason)}</span>
                <Link className="btn btn-secondary" href="/financing">{x.compare}</Link>
              </div>
            ) : (
              <form className="card-b" style={{ gap: 14, padding: 18 }} onSubmit={(e) => { e.preventDefault(); approve(); }}>
                <div className="field">
                  <label htmlFor="tta-otp1">{t("approvals.otp")}</label>
                  <OtpInput key={otpKey} focus={otpKey > 0} disabled={approval === "verifying" || locked} onChange={setCode} group={x.otpGroup} digit={x.digit} />
                  <span className="hint">{t("approvals.sandboxCode")}: <b className="mono">{SANDBOX_OTP.slice(0, 3)} {SANDBOX_OTP.slice(3)}</b> · {x.expires} <span className="num">{expires}</span></span>
                  {(otpError || locked) && <span className="otp-msg" role="alert">{otpError ?? x.errLock}</span>}
                  {approval === "verifying" && <span className="hint">{x.verifying}<span className="blink">_</span></span>}
                  <span className="otp-resend">
                    <button className={`btn btn-sm ${locked ? "btn-primary" : "btn-ghost"}`} type="button" disabled={approval === "verifying"} onClick={() => void newCode()}>{x.resend}</button>
                    {locked && mode === "live" && <button className="btn btn-ghost btn-sm" type="button" onClick={() => void resetDemo()}>{x.resetSandbox}</button>}
                  </span>
                </div>
                <button className="btn btn-cherry" type="submit" disabled={approval === "verifying" || locked} style={{ minHeight: 52, fontSize: 13 }}>
                  {t("approvals.approve")} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>⏎</span>
                </button>
                <span className="approve-assure"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>{x.reassure}</span>
                <hr className="rule" />
                <div className="field">
                  <label htmlFor="tta-reason">{t("approvals.reason")}</label>
                  <input id="tta-reason" className={`input${reasonError ? " err" : ""}`} placeholder={x.reasonPh} value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(false); }} />
                  {reasonError && <span className="otp-msg" role="alert">{x.reasonReq}</span>}
                </div>
                <button className="btn btn-danger" type="button" disabled={approval === "verifying"} onClick={() => (reason.trim() ? reject(reason.trim()) : setReasonError(true))}>
                  {t("approvals.reject")} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>X</span>
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="card" data-guide="appr-history">
          <div className="card-h">
            <span className="h3">{t("approvals.history")}</span>
            <div className="seg" role="group" aria-label={x.filter}>
              {(["all", "approved", "rejected", "auto"] as Filter[]).map((f) => (
                <button key={f} className={filter === f ? "on" : undefined} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{x.filters[f]}</button>
              ))}
            </div>
          </div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>{x.cols.map((c, i) => <th key={c} className={i === 4 ? "r" : undefined}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id + r.decision}>
                  <td className="num">{r.time}</td><td className="num">{r.id}</td><td title={r.label ? r.action : undefined}>{r.label?.[lang] ?? r.action}</td>
                  <td><span className={`tier t${r.tier}`}><b>L{r.tier}</b></span></td>
                  <td className="r num">{r.amount ? money(r.amount.value, r.amount.currency, lang) : "—"}</td>
                  <td><span className={DECISION_BADGE[r.decision].cls}>{x.dec[r.decision]}</span></td>
                  <td className="mono small">{r.channel}</td>
                  <td className={r.note.startsWith('"') ? "small" : "muted small"}>{x.notes[r.note] ?? r.note}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="mono small muted">{x.none}</td></tr>}
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
