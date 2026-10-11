"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Topbar } from "@/components/topbar";
import { SANDBOX_OTP, useDesk, type HistoryRow } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import { N, RECEIVABLE, S, SHORT_CUSTOMER, clpFull, clpM, pct, usd } from "@/lib/scenario";

type Filter = "all" | "approved" | "rejected" | "auto";

const PAE = S.arena.find((a) => a.product === "Pre-export loan in USD (PAE)")!;

// Copy for the request card (fe-11). Numbers come from the quant engine (lib/scenario.ts).
const TX = {
  en: {
    request: "Request pre-export loan (PAE)", bridges: `bridges ${RECEIVABLE.id} · ${SHORT_CUSTOMER}`, cost: "Plan cost", term: "Term", coverage: "Above buffer",
    what: "What happens", whatBody: `${N.lender} lends ${usd(N.loanUsd)} on ${N.crunchDate}, the day of the harvest payroll. You repay it in USD with the export proceeds on ${S.plan.maturity}.`,
    ifRejected: "If rejected", ifRejectedBody: `${N.pNeg} chance of cash < 0 on ${N.crunchDate} (payroll ${clpM(N.payroll)}). The agent prepares the next-cheapest option: export factoring.`,
    approvedBody: `Loan request sent to ${N.lender} (sandbox). Every step is hash-chained and anchored on-chain.`,
    rejectedBody: (r: string) => `Reason: “${r}”. The agent is preparing the next-cheapest option (export factoring) and will ask again.`,
    verifying: `VERIFYING WITH ${N.lender.toUpperCase()}`,
  },
  es: {
    request: "Solicitar crédito de pre-exportación (PAE)", bridges: `cubre la ${RECEIVABLE.id} · ${SHORT_CUSTOMER}`, cost: "Costo del plan", term: "Plazo", coverage: "Sobre el colchón",
    what: "Qué pasa", whatBody: `${N.lender} presta ${usd(N.loanUsd, "es")} el ${N.crunchDate}, el día de la nómina de cosecha. Lo pagas en USD con el retorno de la exportación el ${S.plan.maturity}.`,
    ifRejected: "Si lo rechazas", ifRejectedBody: `${N.pNeg} de probabilidad de caja < 0 el ${N.crunchDate} (nómina ${clpM(N.payroll, "es")}). El agente prepara la siguiente opción más barata: factoring de exportación.`,
    approvedBody: `Solicitud de crédito enviada a ${N.lender} (sandbox). Cada paso queda con hash encadenado y anclado on-chain.`,
    rejectedBody: (r: string) => `Motivo: “${r}”. El agente prepara la siguiente opción más barata (factoring de exportación) y volverá a preguntar.`,
    verifying: `VERIFICANDO CON ${N.lender.toUpperCase()}`,
  },
  zh: {
    request: "申请出口前融资（PAE）", bridges: `为发票 ${RECEIVABLE.id} 过桥 · 上海鸿信`, cost: "方案成本", term: "期限", coverage: "高于安全垫",
    what: "执行内容", whatBody: `${N.lender} 于 ${N.crunchDate}（采收工资发放日）放款 ${usd(N.loanUsd, "zh")}，您将于 ${S.plan.maturity} 以出口美元收入还款。`,
    ifRejected: "若拒绝", ifRejectedBody: `${N.crunchDate} 现金为负的概率为 ${N.pNeg}（工资 ${clpM(N.payroll, "zh")}）。代理将准备次优方案：出口保理。`,
    approvedBody: `贷款申请已发送至 ${N.lender}（沙盒）。每一步均已哈希链接并上链锚定。`,
    rejectedBody: (r: string) => `原因：“${r}”。代理正在准备次优方案（出口保理），稍后将再次请求审批。`,
    verifying: `正在与 ${N.lender} 验证`,
  },
};

const DECISION_BADGE: Record<HistoryRow["decision"], { cls: string; label: string }> = {
  approved: { cls: "badge ok", label: "Approved" },
  rejected: { cls: "badge crit", label: "Rejected" },
  auto: { cls: "badge acc", label: "Auto" },
};

function OtpInput({ disabled, onChange }: { disabled: boolean; onChange: (code: string) => void }) {
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
    <div className="otp" role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          id={i === 0 ? "tta-otp1" : undefined}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
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
  const x = TX[useLang()];
  const t = useT();
  const { approval, otpAttemptsLeft, rejectReason, history, submitOtp, reject } = useDesk();
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [otpKey, setOtpKey] = useState(0);

  const pending = approval === "pending";
  const rows = history.filter((r) => filter === "all" || r.decision === filter);

  const approve = (value = code) => {
    if (value.length < 6) {
      setOtpError("ENTER THE 6-DIGIT CODE");
      return;
    }
    const r = submitOtp(value);
    if (r === "ok") setOtpError(null);
    else {
      setOtpError(r === "locked" || otpAttemptsLeft - 1 <= 0 ? "ERR OTP_LOCKED · REQUEST A NEW CODE" : `ERR OTP_MISMATCH · ${otpAttemptsLeft - 1} ATTEMPTS LEFT`);
      setCode("");
      setOtpKey((k) => k + 1);
    }
  };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{clpFull(S.openingCashClp)}</span></div>
        <div className="tick"><span className="l">Queue</span><span className={`v${pending ? " down" : ""}`}>{pending || approval === "verifying" ? 1 : 0}</span></div>
        <span className="status"><span className={`dot${pending ? " warn" : ""}`} />{pending ? "1 ACTION AWAITING OWNER" : "QUEUE CLEAR"}</span>
      </Topbar>

      <div className="content">
        <h1 className="h1">{t("approvals.title")}</h1>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(360px, 1fr)", gap: 12, alignItems: "start" }}>
          <div className="card">
            <div className="card-h">
              <span className="h3">{pending || approval === "verifying" ? "Pending" : approval === "approved" ? "Approved" : "Rejected"} · APR-0412-05</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tier t3"><b>L3</b><span>OWNER+OTP</span></span>
                <span className="badge warn">Risk MOD</span>
                {approval === "approved" ? <span className="badge ok">Executed</span> : approval === "rejected" ? <span className="badge crit">Rejected</span> : <span className="badge">TTL 23:41:06</span>}
              </div>
            </div>
            <div className="card-b" style={{ gap: 14, padding: 18 }}>
              <span className="kpi-l">{x.request}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}><span className="num" style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 700, lineHeight: 1 }}>{usd(N.loanUsd)}</span><span className="mono muted">≈ {clpFull(N.loanClp)}</span></div>
              <span className="small">{N.lender} <span className="badge">sandbox</span> · {x.bridges}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <div className="kpi"><span className="kpi-l">EAC</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{pct(PAE.eac)}</span></div>
              <div className="kpi"><span className="kpi-l">{x.cost}</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{clpM(N.planCost)}</span></div>
              <div className="kpi"><span className="kpi-l">{x.term}</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{N.termDays}D</span></div>
              <div className="kpi"><span className="kpi-l">{x.coverage}</span><span className="num up" style={{ fontSize: 20, fontWeight: 700 }}>{N.coverage}</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div className="card-b" style={{ borderRight: "1px solid var(--line)" }}><span className="h3">{x.what}</span><span className="small">{x.whatBody}</span></div>
              <div className="card-b"><span className="h3" style={{ color: "var(--warn)" }}>{x.ifRejected}</span><span className="small">{x.ifRejectedBody}</span></div>
            </div>
          </div>

          <div className="card" style={{ borderColor: approval === "approved" ? "var(--ok)" : approval === "rejected" ? "var(--crit)" : "var(--accent)" }}>
            <div className="card-h" style={{ background: approval === "approved" ? "var(--ok-soft)" : approval === "rejected" ? "var(--crit-soft)" : "var(--accent-soft)" }}>
              <span className="h3" style={{ color: "var(--text)" }}>{t("approvals.authorize")}</span>
              <span className="hint">SMS → +56 9 •••• 4127</span>
            </div>
            {approval === "approved" ? (
              <div className="card-b" style={{ gap: 12, padding: 18 }}>
                <span className="badge ok" style={{ alignSelf: "flex-start" }}>Approved 10:15 · OTP verified</span>
                <span className="small">{x.approvedBody}</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link className="btn btn-primary" href="/cockpit">Back to cockpit</Link>
                  <Link className="btn btn-secondary" href="/security">Audit log</Link>
                </div>
              </div>
            ) : approval === "rejected" ? (
              <div className="card-b" style={{ gap: 12, padding: 18 }}>
                <span className="badge crit" style={{ alignSelf: "flex-start" }}>Rejected</span>
                <span className="small">{x.rejectedBody(rejectReason)}</span>
                <Link className="btn btn-secondary" href="/financing">Compare options</Link>
              </div>
            ) : (
              <form className="card-b" style={{ gap: 14, padding: 18 }} onSubmit={(e) => { e.preventDefault(); approve(); }}>
                <div className="field">
                  <label htmlFor="tta-otp1">{t("approvals.otp")}</label>
                  <OtpInput key={otpKey} disabled={approval === "verifying" || otpAttemptsLeft <= 0} onChange={setCode} />
                  <span className="hint">{t("approvals.sandboxCode")}: <b className="mono">{SANDBOX_OTP.slice(0, 3)} {SANDBOX_OTP.slice(3)}</b> · EXPIRES 04:12</span>
                  {otpError && <span className="hint err" role="alert">{otpError}</span>}
                  {approval === "verifying" && <span className="hint">{x.verifying}<span className="blink">_</span></span>}
                </div>
                <button className="btn btn-cherry" type="submit" disabled={approval === "verifying" || otpAttemptsLeft <= 0} style={{ minHeight: 52, fontSize: 13 }}>
                  {t("approvals.approve")} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>⏎</span>
                </button>
                <hr className="rule" />
                <div className="field">
                  <label htmlFor="tta-reason">{t("approvals.reason")}</label>
                  <input id="tta-reason" className={`input${reasonError ? " err" : ""}`} placeholder="> call importer first" value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(false); }} />
                  {reasonError && <span className="hint err" role="alert">A REASON IS REQUIRED TO REJECT</span>}
                </div>
                <button className="btn btn-danger" type="button" disabled={approval === "verifying"} onClick={() => (reason.trim() ? reject(reason.trim()) : setReasonError(true))}>
                  {t("approvals.reject")} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>X</span>
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <span className="h3">{t("approvals.history")}</span>
            <div className="seg" role="group" aria-label="Filter">
              {(["all", "approved", "rejected", "auto"] as Filter[]).map((f) => (
                <button key={f} className={filter === f ? "on" : undefined} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Time</th><th>ID</th><th>Action</th><th>Tier</th><th className="r">Amount</th><th>Decision</th><th>Channel</th><th>Note</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id + r.decision}>
                  <td className="num">{r.time}</td><td className="num">{r.id}</td><td>{r.action}</td>
                  <td><span className={`tier t${r.tier}`}><b>L{r.tier}</b></span></td>
                  <td className="r num">{r.amount}</td>
                  <td><span className={DECISION_BADGE[r.decision].cls}>{DECISION_BADGE[r.decision].label}</span></td>
                  <td className="mono small">{r.channel}</td>
                  <td className={r.note.startsWith('"') ? "small" : "muted small"}>{r.note}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="mono small muted">NO {filter.toUpperCase()} ACTIONS IN RANGE</td></tr>}
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
