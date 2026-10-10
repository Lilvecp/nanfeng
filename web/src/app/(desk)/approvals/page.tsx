"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Topbar } from "@/components/topbar";
import { SANDBOX_OTP, useDesk, type HistoryRow } from "@/lib/desk-state";
import { useT } from "@/lib/i18n";

type Filter = "all" | "approved" | "rejected" | "auto";

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
  const t = useT();
  const { mode, approval, approvalId, otpAttemptsLeft, rejectReason, history, submitOtp, reject } = useDesk();
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [otpKey, setOtpKey] = useState(0);

  const pending = approval === "pending";
  const rows = history.filter((r) => filter === "all" || r.decision === filter);

  const approve = async (value = code) => {
    if (value.length < 6) {
      setOtpError("ENTER THE 6-DIGIT CODE");
      return;
    }
    const r = await submitOtp(value);
    if (r.status === "ok") setOtpError(null);
    else {
      setOtpError(r.status === "locked" || r.attemptsLeft <= 0 ? "ERR OTP_LOCKED · REQUEST A NEW CODE" : `ERR OTP_MISMATCH · ${r.attemptsLeft} ATTEMPTS LEFT`);
      setCode("");
      setOtpKey((k) => k + 1);
    }
  };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">CLP $142.300.000</span></div>
        <div className="tick"><span className="l">Queue</span><span className={`v${pending ? " down" : ""}`}>{pending || approval === "verifying" ? 1 : 0}</span></div>
        <span className="status"><span className={`dot${pending ? " warn" : ""}`} />{pending ? "1 ACTION AWAITING OWNER" : "QUEUE CLEAR"}</span>
      </Topbar>

      <div className="content">
        <h1 className="h1">{t("approvals.title")}</h1>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(360px, 1fr)", gap: 12, alignItems: "start" }}>
          <div className="card">
            <div className="card-h">
              <span className="h3">{pending || approval === "verifying" ? "Pending" : approval === "approved" ? "Approved" : "Rejected"} · {approvalId}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tier t3"><b>L3</b><span>OWNER+OTP</span></span>
                <span className="badge warn">Risk MOD</span>
                {approval === "approved" ? <span className="badge ok">Executed</span> : approval === "rejected" ? <span className="badge crit">Rejected</span> : <span className="badge">TTL 23:41:06</span>}
              </div>
            </div>
            <div className="card-b" style={{ gap: 14, padding: 18 }}>
              <span className="kpi-l">Request invoice factoring</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}><span className="num" style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 700, lineHeight: 1 }}>USD 120,000.00</span><span className="mono muted">≈ CLP 108.650.000</span></div>
              <span className="small">Banco Pacífico <span className="badge">sandbox</span> · INV-2026-0871 · Shanghai Fresh Imports</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <div className="kpi"><span className="kpi-l">EAC</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>11.8%</span></div>
              <div className="kpi"><span className="kpi-l">Fee</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>USD 2,330</span></div>
              <div className="kpi"><span className="kpi-l">Cash in</span><span className="num" style={{ fontSize: 20, fontWeight: 700 }}>48H</span></div>
              <div className="kpi"><span className="kpi-l">D19 gap after</span><span className="num up" style={{ fontSize: 20, fontWeight: 700 }}>+31.0M</span></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div className="card-b" style={{ borderRight: "1px solid var(--line)" }}><span className="h3">What happens</span><span className="small">Bank buys 67% of the overdue invoice today; you receive ~CLP 108.9M in 48 h and the bank collects from the importer.</span></div>
              <div className="card-b"><span className="h3" style={{ color: "var(--warn)" }}>If rejected</span><span className="small">P=0.81 of cash &lt; 0 on 2026-10-28 (payroll CLP 38.5M). Agent proposes next-cheapest: FOGAPE loan.</span></div>
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
                <span className="small">Factoring request sent to Banco Pacífico (sandbox). CNY forward booked. Every step is hash-chained and anchored {mode === "live" ? "with a Merkle root (see the audit log)" : "on FISCO BCOS"}.</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link className="btn btn-primary" href="/cockpit">Back to cockpit</Link>
                  <Link className="btn btn-secondary" href="/security">Audit log</Link>
                </div>
              </div>
            ) : approval === "rejected" ? (
              <div className="card-b" style={{ gap: 12, padding: 18 }}>
                <span className="badge crit" style={{ alignSelf: "flex-start" }}>Rejected</span>
                <span className="small">Reason: “{rejectReason}”. The agent is preparing the next-cheapest option (FOGAPE loan) and will ask again.</span>
                <Link className="btn btn-secondary" href="/financing">Compare options</Link>
              </div>
            ) : (
              <form className="card-b" style={{ gap: 14, padding: 18 }} onSubmit={(e) => { e.preventDefault(); approve(); }}>
                <div className="field">
                  <label htmlFor="tta-otp1">{t("approvals.otp")}</label>
                  <OtpInput key={otpKey} disabled={approval === "verifying" || otpAttemptsLeft <= 0} onChange={setCode} />
                  <span className="hint">{t("approvals.sandboxCode")}: <b className="mono">{SANDBOX_OTP.slice(0, 3)} {SANDBOX_OTP.slice(3)}</b> · EXPIRES 04:12</span>
                  {otpError && <span className="hint err" role="alert">{otpError}</span>}
                  {approval === "verifying" && <span className="hint">VERIFYING WITH BANCO PACÍFICO<span className="blink">_</span></span>}
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
