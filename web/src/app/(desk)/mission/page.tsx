"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import type { ApiEvent } from "@/lib/api";
import { fmtLocal, useDesk } from "@/lib/desk-state";
import { useT } from "@/lib/i18n";
import { N, S, clpFull, clpM, pct, usd } from "@/lib/scenario";

type Step = { n: number; step: string; tool: string; tier: 0 | 1 | 3; model: string; left: number; width: number; latency: string; cost: string };

const STEPS: Step[] = [
  { n: 1, step: "Read delay notice via OCR", tool: "ocr.extract", tier: 0, model: "Mistral OCR", left: 0, width: 11.2, latency: "2.8s", cost: "0.004" },
  { n: 2, step: "Re-ran 10,000 scenarios", tool: "montecarlo.run", tier: 0, model: "— numerical", left: 12, width: 16.8, latency: "4.2s", cost: "0.000" },
  { n: 3, step: `Quoted ${S.arena.length} financing options`, tool: `bank.quote×${S.arena.length}`, tier: 1, model: "Qwen3-32B", left: 29.6, width: 24.4, latency: "6.1s", cost: "0.011" },
  { n: 4, step: "Optimizer selected plan", tool: "optimize_plan", tier: 0, model: "MILP OR-Tools CBC", left: 54.4, width: 3.6, latency: `${S.plan.solveSeconds.toFixed(1)}s`, cost: "0.000" },
];

const REPLIES: { match: RegExp; text: string }[] = [
  { match: /on time|a tiempo|day ?10|día ?10|第10天/i, text: `If Shanghai pays on its due date, P(cash < 0) on ${N.crunchDate} drops from ${N.pNeg} to ${pct(S.after.probNegIfOnTime)} and no new financing is needed.` },
  { match: /fogape/i, text: `FOGAPE has a low rate, but its shortest term is 365 days: interest keeps running long after the gap closes. On its own it would cost ${clpM(S.explanation.find((e) => e.productId.startsWith("FOGAPE"))?.aloneCostClp ?? 0)} vs ${clpM(N.planCost)} for the PAE loan.` },
  { match: /forward|cny|hedge/i, text: "The CNY invoices are collected in mid-January, after the crunch day. A forward would lock their rate but brings no cash for the payroll, so the optimizer leaves it out at this confidence level." },
];

/** One line per backend event: what happened and the fields worth showing. */
function describe(e: ApiEvent): string {
  const d = e.data as Record<string, unknown>;
  const pick = (...keys: string[]) => keys.filter((k) => d[k] !== undefined && d[k] !== null).map((k) => `${k}=${typeof d[k] === "object" ? JSON.stringify(d[k]) : d[k]}`).join(" · ");
  if (e.type.startsWith("approval.")) return pick("id", "action", "tier", "status", "otp_attempts_left");
  if (e.type.startsWith("bank.")) return pick("receivable_id", "payee", "currency", "amount_clp", "proceeds_clp", "audit_seq");
  if (e.type === "audit.anchored") return pick("anchor_id", "from_seq", "to_seq", "backend");
  if (e.type.startsWith("quant.")) return pick("job_id", "message", "error");
  return pick("step", "tool", "tier", "model", "cost_usd", "status", "on") || JSON.stringify(d).slice(0, 120);
}

export default function MissionPage() {
  const t = useT();
  const { approval, notify, mode, events, killSwitch: killed, setKillSwitch } = useDesk();
  const [paused, setPaused] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  // Re-arming on the live API is L3: the owner types the one-time code (sandbox code 482913).
  const [rearm, setRearm] = useState(false);
  const [rearmCode, setRearmCode] = useState("");
  const [chat, setChat] = useState<{ who: "out" | "in"; text: string }[]>([
    { who: "out", text: "why the PAE loan over the bank loan?" },
    { who: "in", text: `Both close the gap, but the PAE loan costs ${clpM(N.planCost)} vs ${clpM(N.defaultCost)} (${N.savingsPct} cheaper) and is repaid in USD with the export proceeds. Bank factoring will not buy ${S.event.invoice} because its buyer already announced a delay.` },
  ]);
  const [q, setQ] = useState("");
  const done = approval === "approved";

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const reply = REPLIES.find((r) => r.match.test(q))?.text ?? "In the sandbox I answer questions about the Cherry Crisis run: try “on time”, FOGAPE or the CNY forward.";
    setChat((c) => [...c, { who: "out", text: q }, { who: "in", text: reply }]);
    setQ("");
  };

  const status = killed ? { dot: "crit", text: "AGENT HALTED · KILL SWITCH" } : paused ? { dot: "idle", text: "RUN PAUSED" } : done ? { dot: "", text: "RUN COMPLETE · EXECUTED" } : { dot: "warn blink", text: "AWAITING APPROVAL · L3" };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">{clpFull(S.openingCashClp)}</span></div>
        <div className="tick"><span className="l">Run</span><span className="v">#0412</span></div>
        <span className="status"><span className={`dot ${status.dot}`} />{status.text}</span>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 className="h1">{t("tab.agent")}</h1><span className="mono small muted">TRIGGER email:shanghai-hongxin · START 10:12:41.032 · ELAPSED 25.1S · COST USD 0.015</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" disabled={killed} aria-pressed={paused} onClick={() => { setPaused((p) => !p); notify(paused ? "Run resumed" : "Run paused · no new tool calls"); }}>{paused ? "Resume" : "Pause"} <span className="key">P</span></button>
            {killed ? (
              mode === "live" && rearm ? (
                <form style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onSubmit={async (e) => {
                  e.preventDefault();
                  if (await setKillSwitch(false, rearmCode)) { setRearm(false); setPaused(false); }
                  setRearmCode("");
                }}>
                  <input className="input mono" style={{ width: 120 }} inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="OTP" aria-label="One-time code to re-arm the agent"
                    value={rearmCode} onChange={(e) => setRearmCode(e.target.value.replace(/\D/g, ""))} autoFocus />
                  <button className="btn btn-primary" type="submit" disabled={rearmCode.length !== 6}>Re-arm with code</button>
                  <button className="btn btn-secondary" type="button" onClick={() => { setRearm(false); setRearmCode(""); }}>Cancel</button>
                </form>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => { if (mode === "live") setRearm(true); else { setPaused(false); void setKillSwitch(false); } }}>Re-arm agent</button>
              )
            ) : confirmKill ? (
              <>
                <button className="btn btn-danger" type="button" style={{ minHeight: 48 }} onClick={() => { setConfirmKill(false); void setKillSwitch(true); }}>Confirm kill</button>
                <button className="btn btn-secondary" type="button" onClick={() => setConfirmKill(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-danger" type="button" style={{ minHeight: 48, padding: "0 20px" }} onClick={() => setConfirmKill(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" /></svg>Kill switch <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>⇧K</span>
              </button>
            )}
          </div>
        </div>

        {killed && (
          <div className="alert crit"><span className="ic">STOP</span><span className="small">Kill switch engaged. The agent cannot call any tool until it is re-armed. Pending approvals stay frozen; nothing executes.</span></div>
        )}

        <div className="card">
          <div className="card-h"><span className="h3">Execution trace · waterfall</span><div className="legend"><span><i className="sw" style={{ background: "var(--ok)" }} />DONE</span><span><i className="sw" style={{ background: "var(--crit)" }} />WAITING ON OWNER</span></div></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>#</th><th>Step</th><th>Tool</th><th>Tier</th><th>Model</th><th style={{ width: "32%" }}>0s ─────────── 12.5s ─────────── 25s</th><th className="r">Latency</th><th className="r">Cost USD</th></tr></thead>
            <tbody>
              {STEPS.map((s) => (
                <tr key={s.n}>
                  <td className="num">{s.n}</td><td>{s.step}</td><td className="num">{s.tool}</td>
                  <td><span className={`tier t${s.tier}`}><b>L{s.tier}</b></span></td>
                  <td className="num small">{s.model}</td>
                  <td><div style={{ position: "relative", height: 12, background: "var(--surface-2)" }}><div style={{ position: "absolute", left: `${s.left}%`, width: `${s.width}%`, top: 0, bottom: 0, background: "var(--ok)" }} /></div></td>
                  <td className="r num">{s.latency}</td><td className="r num">{s.cost}</td>
                </tr>
              ))}
              <tr className={done ? undefined : "pick"}>
                <td className="num">5</td>
                <td><b>{done ? "Approved by owner (OTP)" : approval === "rejected" ? "Rejected by owner" : "Awaiting approval"}</b></td>
                <td className="num">loan.request</td>
                <td><span className="tier t3"><b>L3</b><span>OTP</span></span></td>
                <td className="num small">—</td>
                <td><div style={{ position: "relative", height: 12, background: "var(--surface-2)" }}><div style={{ position: "absolute", left: "58.4%", right: done ? "6%" : 0, top: 0, bottom: 0, background: done ? "var(--ok)" : "repeating-linear-gradient(90deg, var(--crit) 0 6px, transparent 6px 9px)" }} /></div></td>
                <td className={`r num ${done ? "" : "down"}`}>{done ? "9m 41s" : approval === "rejected" ? "closed" : "open"}</td>
                <td className="r num">—</td>
              </tr>
              {done && (
                <tr>
                  <td className="num">6</td><td>Executed in sandbox · hash anchored</td><td className="num">audit.anchor</td>
                  <td><span className="tier t0"><b>L0</b></span></td><td className="num small">FISCO BCOS</td>
                  <td><div style={{ position: "relative", height: 12, background: "var(--surface-2)" }}><div style={{ position: "absolute", left: "94%", right: 0, top: 0, bottom: 0, background: "var(--ok)" }} /></div></td>
                  <td className="r num">1.3s</td><td className="r num">0.000</td>
                </tr>
              )}
            </tbody>
          </table></div>
        </div>

        {mode === "live" && (
          <div className="card">
            <div className="card-h">
              <span className="h3">Live event stream · SSE</span>
              <span className="status"><span className="dot" />{events.length} EVENTS</span>
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 280, overflowY: "auto" }} aria-live="polite"><table className="tbl">
              <thead><tr><th>#</th><th>Time</th><th>Source</th><th>Event</th><th>Detail</th></tr></thead>
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
                {events.length === 0 && <tr><td colSpan={5} className="mono small muted">WAITING FOR EVENTS FROM THE AGENT<span className="blink">_</span></td></tr>}
              </tbody>
            </table></div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 12 }}>
          <div className="card">
            <div className="card-h">
              <span className="h3">Step 5 · detail</span>
              {done ? <span className="badge ok">Executed</span> : <Link className="btn btn-primary btn-sm" href="/approvals">Open approval <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>A</span></Link>}
            </div>
            <div className="card-b mono small" style={{ gap: 6 }}>
              <span><span className="muted">action    </span> loan.request(lender=&quot;{S.approvalRequest.operations[0].params.lender_id}&quot;, amount={usd(N.loanUsd)}, term={N.termDays}D, env=sandbox)</span>
              <span><span className="muted">cost      </span> {clpM(N.planCost)} vs {clpM(N.defaultCost)} default bank loan</span>
              <span><span className="muted">why L3    </span> new money · counterparty first use this season · &gt; L2 cap CLP 25M</span>
              <span><span className="muted">notified  </span> WhatsApp 10:15:06 · web 10:15:06</span>
              <span><span className="muted">timeout   </span> 23:41:06 → auto-cancel, no action</span>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><span className="h3">Ask why</span></div>
            <div className="card-b">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }} aria-live="polite">
                {chat.map((m, i) => <div key={i} className={`bubble ${m.who}`} style={{ maxWidth: "100%" }}>{m.text}</div>)}
              </div>
              <form className="field" onSubmit={ask}>
                <label htmlFor="ttmc-ask">Query agent</label>
                <input id="ttmc-ask" className="input" placeholder="> what if Shanghai pays on time?" value={q} onChange={(e) => setQ(e.target.value)} disabled={killed} />
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
