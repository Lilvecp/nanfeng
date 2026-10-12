"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api, type DemoAgentStep } from "./api";
import { CHERRY_PLAN, SANDBOX_OTP, useDesk } from "./desk-state";
import { N, S, SHORT_CUSTOMER, clpFull, usd } from "./scenario";

// Demo Mode replay (fe-10, Camilo): Valentín's Demo page shows the six steps; this makes each one
// really happen, so every other screen follows the video.
// - Live API: POST /demo/step/n does the work on the backend (reset, the approval request through
//   the policy engine, execution in the sandbox bank, the on-chain anchor) and the SSE stream
//   carries it to Mission Control, Approvals, Security or a phone in another window.
// - No backend: the same steps drive the local desk state (reset, approve), still fully offline.
// Runs only when the viewer plays or picks a step, never on page load, and always in order.

const eligible = S.arena.filter((a) => a.covers_need).length;

const AGENT_STEPS: Record<number, DemoAgentStep[]> = {
  1: [
    { step: "Read the importer's email (OCR)", tool: "ocr.extract", model: "Mistral OCR", latency_s: 2.8, cost_usd: 0.004,
      detail: `${SHORT_CUSTOMER}: ${S.event.invoice} ${usd(N.overdueUsd)} paid ${N.delayDays} days late` },
    { step: "Document guard", tool: "security.scan", model: "guard", latency_s: 0.2, detail: "clean: no hidden instructions" },
  ],
  2: [
    { step: "Re-ran 10,000 cash scenarios", tool: "forecast_run", model: "Monte Carlo", latency_s: 4.2,
      detail: `P(cash < 0) ${N.pNeg} by day ${N.crunchDay} (${N.crunchDate}), harvest payroll` },
  ],
  3: [
    { step: `Quoted ${S.arena.length} financing options`, tool: "financing_quote", tier: 1, model: "catalog", latency_s: 1.1,
      detail: `${eligible} cover the gap · need ${clpFull(S.need?.amount_clp ?? N.loanClp)}` },
  ],
  4: [
    { step: "Optimizer selected the plan", tool: "optimize_plan", model: "MILP · CBC", latency_s: S.plan.solveSeconds,
      detail: `${usd(N.loanUsd)} PAE ${N.termDays}D · ${clpFull(N.planCost)} vs ${clpFull(N.defaultCost)} (${N.savingsPct} cheaper)` },
    { step: "Approval requested", tool: "approvals.create", tier: 3, detail: "WhatsApp + SMS code to the owner" },
  ],
  5: [{ step: "Owner approved with the SMS code", tool: "approvals.approve", tier: 3, detail: "WA+OTP" }],
  6: [
    { step: "Run complete · gap closed", tool: "forecast_run", model: "Monte Carlo", latency_s: 3.9,
      detail: `P(cash < 0) ${N.pNegAfterPlan} after the plan · cash above the buffer in ${N.coverage} of scenarios` },
  ],
};

export type ReplayStatus = { live: boolean; state: "idle" | "running" | "ok" | "error"; message?: string };

export function useDemoReplay(step: number, playing: boolean): ReplayStatus {
  const { mode, resetDemo, submitOtp } = useDesk();
  const [status, setStatus] = useState<ReplayStatus>({ live: false, state: "idle" });
  const done = useRef(0); // highest step already played in this take
  const chain = useRef<Promise<void>>(Promise.resolve());
  const prev = useRef({ step, playing });
  const ctx = useRef({ mode, resetDemo, submitOtp });
  useEffect(() => {
    ctx.current = { mode, resetDemo, submitOtp };
  });

  useEffect(() => {
    const was = prev.current;
    prev.current = { step, playing };
    const pressedPlay = playing && !was.playing && step === 1;
    if (step === was.step && !pressedPlay) return; // page load or nothing new: never replay by itself

    // Step 1 starts a clean take; otherwise play every step not played yet, in order.
    const from = step === 1 ? 1 : done.current === 0 ? 1 : done.current + 1;
    const todo = Array.from({ length: Math.max(0, step - from + 1) }, (_, i) => from + i);
    if (step === 1) done.current = 0;
    for (const n of todo) {
      chain.current = chain.current.then(async () => {
        if (n <= done.current) return;
        const { mode: m, resetDemo: reset, submitOtp: approve } = ctx.current;
        const live = m === "live";
        setStatus({ live, state: "running" });
        try {
          if (live) {
            await api.demo.step(n, { agent_steps: AGENT_STEPS[n], plan: n === 4 || n === 5 ? CHERRY_PLAN : undefined });
          } else if (n === 1) {
            await reset();
          } else if (n === 5) {
            await approve(SANDBOX_OTP);
          }
          done.current = n;
          setStatus({ live, state: "ok" });
        } catch (err) {
          const message = err instanceof ApiError
            ? err.status === 401 ? "Sign in as the owner to replay on the live API"
              : typeof err.detail === "string" ? err.detail : (err.detail as { detail?: string })?.detail ?? `HTTP ${err.status}`
            : "Backend unreachable";
          setStatus({ live, state: "error", message });
        }
      });
    }
  }, [step, playing]);

  return { ...status, live: mode === "live" };
}
