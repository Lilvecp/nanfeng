"use client";

import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { SANDBOX_OTP, useDesk } from "@/lib/desk-state";
import { GUIDE_UI, resetTours, setGuideOn, useGuideOn } from "@/lib/guide";
import { useLang, useT } from "@/lib/i18n";

const CREDIT_LINE = 400_000_000;
type LimitKey = "l2Action" | "l2Month" | "l3Action" | "l3Month";
const SAVED: Record<LimitKey, number> = { l2Action: 25_000_000, l2Month: 80_000_000, l3Action: 400_000_000, l3Month: 400_000_000 };
const POLICY_KEY: Record<LimitKey, string> = { l2Action: "tiers.L2.per_action", l2Month: "tiers.L2.per_month", l3Action: "tiers.L3.per_action", l3Month: "tiers.L3.per_month" };

const clp = (n: number) => "CLP " + n.toLocaleString("es-CL");
const parse = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const snake = (n: number) => n.toLocaleString("en-US").replace(/,/g, "_");

type Payee = { name: string; bank: string; acct: string; ccy: string; added: string };
const PAYEES: Payee[] = [
  { name: "Cartonera Sur Ltda.", bank: "Banco Pacífico", acct: "•••• 2210", ccy: "CLP", added: "2026-03-02" },
  { name: "Frío Rancagua SpA", bank: "Banco Andino", acct: "•••• 7781", ccy: "CLP", added: "2025-11-18" },
  { name: "Pacific Reefer Lines", bank: "HSBC HK", acct: "•••• 0934", ccy: "USD", added: "2025-12-05" },
];

export default function SettingsPage() {
  const t = useT();
  const { notify } = useDesk();
  const [saved, setSaved] = useState(SAVED);
  const [draft, setDraft] = useState<Record<LimitKey, string>>(() => Object.fromEntries(Object.entries(SAVED).map(([k, v]) => [k, clp(v)])) as Record<LimitKey, string>);
  const [version, setVersion] = useState(14);
  const [payees, setPayees] = useState(PAYEES);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState<string | null>(null);

  const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, parse(v)])) as Record<LimitKey, number>;
  const changed = (Object.keys(values) as LimitKey[]).filter((k) => values[k] !== saved[k]);
  const errors: Partial<Record<LimitKey, string>> = {};
  if (values.l3Action > CREDIT_LINE) errors.l3Action = `ERR > CREDIT LINE ${clp(CREDIT_LINE)}`;
  if (values.l2Action > values.l3Action) errors.l2Action = "ERR L2 MUST BE ≤ L3";
  if (values.l2Action > values.l2Month) errors.l2Month = "ERR MONTH < PER ACTION";
  const hasErrors = Object.keys(errors).length > 0;

  const input = (k: LimitKey, label: string) => (
    <>
      <input className={`input${errors[k] ? " err" : ""}`} aria-label={label} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} onBlur={() => setDraft((d) => ({ ...d, [k]: clp(parse(d[k])) }))} />
      {errors[k] && <span className="hint err">{errors[k]}</span>}
    </>
  );

  const discard = () => {
    setDraft(Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, clp(v)])) as Record<LimitKey, string>);
    setOtpOpen(false);
  };

  const confirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\D/g, "") !== SANDBOX_OTP) {
      setOtpErr("ERR OTP_MISMATCH");
      return;
    }
    setSaved(values);
    setVersion((v) => v + 1);
    setOtpOpen(false);
    setOtp("");
    setOtpErr(null);
    notify(`Policy v${version + 1} saved · change logged in the audit chain`);
  };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">Policy</span><span className="v">v{version} · 2026-10-{version > 14 ? "09" : "07"}</span></div>
        {changed.length > 0 && <span className="status"><span className="dot warn" />{changed.length} UNSAVED CHANGE{changed.length > 1 ? "S" : ""} · OTP REQUIRED</span>}
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="h1">{t("nav.settings")}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" type="button" disabled={changed.length === 0} onClick={discard}>Discard</button>
            <button className="btn btn-primary" type="button" disabled={changed.length === 0 || hasErrors} onClick={() => setOtpOpen(true)}>Save with OTP <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>⌘S</span></button>
          </div>
        </div>

        {otpOpen && (
          <form className="alert warn" style={{ alignItems: "center", flexWrap: "wrap" }} onSubmit={confirmSave}>
            <span className="ic">OTP</span>
            <label htmlFor="set-otp" className="small" style={{ flex: "1 1 260px" }}>Policy changes are L3. Enter the code sent to +56 9 •••• 4127 (sandbox: <b className="mono">{SANDBOX_OTP}</b>).</label>
            <input id="set-otp" className={`input${otpErr ? " err" : ""}`} inputMode="numeric" autoComplete="one-time-code" style={{ width: 140 }} value={otp} onChange={(e) => { setOtp(e.target.value); setOtpErr(null); }} />
            <button className="btn btn-primary btn-sm" type="submit">Confirm</button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setOtpOpen(false)}>Cancel</button>
            {otpErr && <span className="hint err" role="alert">{otpErr}</span>}
          </form>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div className="card-h"><span className="h3">Spending limits by tier</span><span className="hint">ABOVE LIMIT → NEXT TIER</span></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Tier</th><th>Per action</th><th>Per month</th><th>Scope</th></tr></thead>
                <tbody>
                  <tr><td><span className="tier t1"><b>L1</b><span>DRAFT</span></span></td><td className="mono small muted">CLP 0 · no payments</td><td className="mono small muted">—</td><td className="small">Reminders, quotes</td></tr>
                  <tr><td><span className="tier t2"><b>L2</b><span>ACT</span></span></td><td>{input("l2Action", "L2 per action")}</td><td>{input("l2Month", "L2 per month")}</td><td className="small">Allowlisted payees · FX ≤ ¥500k</td></tr>
                  <tr><td><span className="tier t3"><b>L3</b><span>OTP</span></span></td><td>{input("l3Action", "L3 per action")}</td><td>{input("l3Month", "L3 per month")}</td><td className="small">Any, with owner OTP</td></tr>
                </tbody>
              </table></div>
            </div>

            <div className="card">
              <div className="card-h"><span className="h3">Beneficiary allowlist · {payees.length}</span><button className="btn btn-secondary btn-sm" type="button" onClick={() => notify("Adding a payee is L3: owner OTP + call-back. Available once the bank API is connected.")}>+ Add (L3)</button></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Name</th><th>Bank</th><th>Account</th><th>Ccy</th><th>Added</th><th /></tr></thead>
                <tbody>
                  {payees.map((p) => (
                    <tr key={p.name}><td>{p.name}</td><td>{p.bank}</td><td className="num">{p.acct}</td><td className="num">{p.ccy}</td><td className="num">{p.added}</td><td className="r"><button className="btn btn-ghost btn-sm" type="button" onClick={() => { setPayees((ps) => ps.filter((x) => x !== p)); notify(`${p.name} removed · agent can no longer pay it`); }}>Remove</button></td></tr>
                  ))}
                  {payees.length === 0 && <tr><td colSpan={6} className="mono small muted">NO PAYEES → AGENT CAN DRAFT BUT NEVER PAY</td></tr>}
                </tbody>
              </table></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div className="card">
                <div className="card-h"><span className="h3">Approval channels</span></div>
                <div className="card-b">
                  <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }} className="small"><input type="checkbox" defaultChecked style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />WhatsApp + SMS OTP</label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }} className="small"><input type="checkbox" defaultChecked style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />Web + authenticator</label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }} className="small muted"><input type="checkbox" disabled style={{ width: 18, height: 18 }} />Voice (blocked by policy)</label>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><span className="h3">Languages</span></div>
                <div className="card-b">
                  <div className="field"><label htmlFor="tts-lo">Owner</label><select id="tts-lo" className="input" defaultValue="ES-CL"><option>ES-CL</option><option>EN</option><option>ZH-CN</option></select></div>
                  <div className="field"><label htmlFor="tts-li">Importers</label><select id="tts-li" className="input" defaultValue="zh"><option value="zh">ZH-CN · formal · 2026年10月09日</option><option value="en">EN</option></select></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <GuideSettings />
            <div className="card">
              <div className="card-h"><span className="h3">Connected channels</span></div>
              <div className="tbl-wrap"><table className="tbl"><tbody>
                <tr><td>WhatsApp Business</td><td className="r"><span className="badge ok">Up</span></td></tr>
                <tr><td>SMS gateway</td><td className="r"><span className="badge ok">Up</span></td></tr>
                <tr><td>WeCom</td><td className="r"><span className="badge warn">Sim</span></td></tr>
                <tr><td>LINE · KakaoTalk</td><td className="r"><button className="btn btn-secondary btn-sm" type="button" onClick={() => notify("LINE and KakaoTalk adapters are on the roadmap")}>Connect</button></td></tr>
                <tr><td>Banco Pacífico API</td><td className="r"><span className="badge crit">Token exp</span></td></tr>
              </tbody></table></div>
            </div>
            <div className="card">
              <div className="card-h"><span className="h3">policy.diff · {changed.length ? "unsaved" : "clean"}</span></div>
              <div className="card-b mono small" style={{ gap: 2, lineHeight: 1.6 }}>
                {(Object.keys(POLICY_KEY) as LimitKey[]).map((k) =>
                  changed.includes(k) ? (
                    <span key={k} style={{ display: "contents" }}>
                      <span className="down">- {POLICY_KEY[k]}: {snake(saved[k])} CLP</span>
                      <span className="up">+ {POLICY_KEY[k]}: {snake(values[k])} CLP</span>
                    </span>
                  ) : (
                    <span key={k} className="muted">  {POLICY_KEY[k]}: {snake(saved[k])} CLP</span>
                  ),
                )}
                <span className="muted">  approval.voice: false  # locked</span>
                <span className="muted">  allowlist.size: {payees.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Guide on/off and "show the tours again" (lib/guide.ts). */
function GuideSettings() {
  const ui = GUIDE_UI[useLang()];
  const on = useGuideOn();
  const { notify } = useDesk();
  return (
    <div className="card">
      <div className="card-h"><span className="h3">{ui.settingsTitle}</span></div>
      <div className="card-b" style={{ gap: 12 }}>
        <span className="small">{ui.settingsBody}</span>
        <div className="seg" role="group" aria-label={ui.settingsTitle} style={{ alignSelf: "flex-start" }}>
          <button type="button" className={on !== false ? "on" : undefined} aria-pressed={on !== false} onClick={() => setGuideOn(true)}>{ui.on}</button>
          <button type="button" className={on === false ? "on" : undefined} aria-pressed={on === false} onClick={() => setGuideOn(false)}>{ui.offLabel}</button>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => { resetTours(); setGuideOn(true); notify(ui.replayed); }}>{ui.replay}</button>
      </div>
    </div>
  );
}
