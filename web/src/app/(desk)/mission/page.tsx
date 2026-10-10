"use client";

import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/topbar";
import type { ApiEvent } from "@/lib/api";
import { fmtLocal, useDesk } from "@/lib/desk-state";
import { useT } from "@/lib/i18n";

type Step = { n: number; step: string; tool: string; tier: 0 | 1 | 3; model: string; left: number; width: number; latency: string; cost: string };

const STEPS: Step[] = [
  { n: 1, step: "Read email via OCR", tool: "ocr.extract", tier: 0, model: "Qwen2.5-VL-7B", left: 0, width: 11.2, latency: "2.8s", cost: "0.004" },
  { n: 2, step: "Re-ran 10,000 scenarios", tool: "montecarlo.run", tier: 0, model: "— numerical", left: 12, width: 16.8, latency: "4.2s", cost: "0.000" },
  { n: 3, step: "Quoted 4 financing options", tool: "bank.quote×4", tier: 1, model: "Qwen3-32B", left: 29.6, width: 24.4, latency: "6.1s", cost: "0.011" },
  { n: 4, step: "Optimizer selected plan", tool: "optimizer.solve", tier: 0, model: "MILP OR-Tools", left: 54.4, width: 3.6, latency: "0.9s", cost: "0.000" },
];

const REPLIES: { match: RegExp; text: string }[] = [
  { match: /day ?10|día ?10|第10天/i, text: "If Shanghai pays on day 10, P(cash < 0) drops to 9% and the plan shrinks to the CNY forward only. I would still keep the factoring quote warm until the money lands." },
  { match: /fogape/i, text: "FOGAPE is the cheapest rate (9.6%) but disburses in ~21 days, two days after payroll. I suggest applying now so it is ready for next season." },
  { match: /forward|cny|hedge/i, text: "The forward locks 0.1404 CNY/USD on ¥1.2M for 60 days. Without it, a 3% CNY move costs about CLP 4.9M." },
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
  const [chat, setChat] = useState<{ who: "out" | "in"; text: string }[]>([
    { who: "out", text: "why factoring over the WC loan?" },
    { who: "in", text: "Loan funds in ~15 business days → day 21, after the D19 gap. Factoring funds in 48h. Forward removes CNY risk on the remaining ¥1.2M." },
  ]);
  const [q, setQ] = useState("");
  const done = approval === "approved";

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    const reply = REPLIES.find((r) => r.match.test(q))?.text ?? "In the sandbox I answer questions about the Cherry Crisis run: try day 10, FOGAPE or the CNY forward.";
    setChat((c) => [...c, { who: "out", text: q }, { who: "in", text: reply }]);
    setQ("");
  };

  const status = killed ? { dot: "crit", text: "AGENT HALTED · KILL SWITCH" } : paused ? { dot: "idle", text: "RUN PAUSED" } : done ? { dot: "", text: "RUN COMPLETE · EXECUTED" } : { dot: "warn blink", text: "AWAITING APPROVAL · L3" };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{t("tick.cash")}</span><span className="v">CLP $142.300.000</span></div>
        <div className="tick"><span className="l">Run</span><span className="v">#0412</span></div>
        <span className="status"><span className={`dot ${status.dot}`} />{status.text}</span>
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 className="h1">{t("nav.mission")}</h1><span className="mono small muted">TRIGGER email:shanghai-fresh · START 09:08:41.032 · ELAPSED 25.1S · COST USD 0.015</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" type="button" disabled={killed} aria-pressed={paused} onClick={() => { setPaused((p) => !p); notify(paused ? "Run resumed" : "Run paused · no new tool calls"); }}>{paused ? "Resume" : "Pause"} <span className="key">P</span></button>
            {killed ? (
              <button className="btn btn-primary" type="button" onClick={() => { setPaused(false); void setKillSwitch(false); }}>Re-arm agent</button>
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
                <td className="num">factoring.request</td>
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
              <span><span className="muted">action    </span> factoring.request(amount=USD 120,000, bank=&quot;Banco Pacífico&quot;, env=sandbox)</span>
              <span><span className="muted">+ hedge    </span> fx.forward(¥1,200,000, tenor=60D)</span>
              <span><span className="muted">why L3    </span> new money · counterparty first use this season · &gt; L2 cap CLP 25M</span>
              <span><span className="muted">notified  </span> WhatsApp 09:09:06 · web 09:09:06</span>
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
                <input id="ttmc-ask" className="input" placeholder="> what if importer pays on day 10?" value={q} onChange={(e) => setQ(e.target.value)} disabled={killed} />
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
