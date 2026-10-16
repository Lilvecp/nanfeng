"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api, type DemoAgentStep } from "./api";
import { CHERRY_PLAN, useDesk } from "./desk-state";
import { N, S, SHORT_CUSTOMER, clpFull, usd } from "./scenario";

// Demo Mode replay (fe-10, Camilo): Valentín's Demo page shows the six steps; this makes each one
// really happen, so every other screen follows the video.
// - Live API: POST /demo/step/n does the work on the backend (reset, the approval request through
//   the policy engine, execution in the sandbox bank, the on-chain anchor) and the SSE stream
//   carries it to Mission Control, Approvals, Security or a phone in another window.
// - No backend: nothing to do here; the Demo page itself restarts and finishes the local desk
//   (resetDemo / finishDemo), still fully offline.
// Runs only when the viewer plays or picks a step, never on page load, and always in order.

// Every step is tagged "Replay": these are scripted steps posted to /demo/step, not a measured agent
// run, so they carry no latency or cost. The only timing is the solver's own (quant engine output).
const R = "Replay · ";

export const AGENT_STEPS: Record<number, DemoAgentStep[]> = {
  1: [
    { step: `${R}Read the importer's email (OCR)`, tool: "ocr.extract", model: "Mistral OCR",
      detail: `${SHORT_CUSTOMER}: ${S.event.invoice} ${usd(N.overdueUsd)} paid ${N.delayDays} days late` },
    { step: `${R}Document guard`, tool: "security.scan", model: "guard", detail: "clean: no hidden instructions" },
  ],
  2: [
    { step: `${R}Re-ran 10,000 cash scenarios`, tool: "forecast_run", model: "Monte Carlo",
      detail: `P(cash < 0) ${N.pNeg} by day ${N.crunchDay} (${N.crunchDate}), harvest payroll` },
  ],
  3: [
    { step: `${R}Checked ${N.products} financing products`, tool: "financing_quote", tier: 1, model: "catalog",
      detail: `${N.eligible} eligible · cover the gap · need ${clpFull(S.need?.amount_clp ?? N.loanClp)}` },
  ],
  4: [
    { step: `${R}Optimizer selected the plan`, tool: "optimize_plan", model: "MILP · CBC", latency_s: S.plan.solveSeconds,
      detail: `${usd(N.loanUsd)} PAE ${N.termDays}D · ${clpFull(N.planCost)} vs ${clpFull(N.defaultCost)} (${N.savingsPct} cheaper)` },
    { step: `${R}Approval requested`, tool: "approvals.create", tier: 3, detail: "WhatsApp + one-time code (sandbox code) to the owner" },
  ],
  5: [{ step: `${R}Owner approved with the one-time code (sandbox code)`, tool: "approvals.approve", tier: 3, detail: "WA+OTP" }],
  6: [
    { step: `${R}Run complete · gap closed`, tool: "forecast_run", model: "Monte Carlo",
      detail: `P(cash < 0) ${N.pNegAfterPlan} after the plan · cash above the buffer in ${N.coverage} of scenarios` },
  ],
};

export type ReplayStatus = { live: boolean; state: "idle" | "running" | "ok" | "error"; message?: string };

export function useDemoReplay(step: number, playing: boolean): ReplayStatus {
  const { mode } = useDesk();
  const [status, setStatus] = useState<ReplayStatus>({ live: false, state: "idle" });
  const done = useRef(0); // highest step already played in this take
  const chain = useRef<Promise<void>>(Promise.resolve());
  const prev = useRef({ step, playing });
  const live = useRef(mode === "live");
  const visitor = useRef(false); // the API said "owner only": this take plays on this screen only
  const [asVisitor, setAsVisitor] = useState(false);
  useEffect(() => {
    live.current = mode === "live";
  });

  useEffect(() => {
    const was = prev.current;
    prev.current = { step, playing };
    const pressedPlay = playing && !was.playing && step === 1;
    if (step === was.step && !pressedPlay) return; // page load or nothing new: never replay by itself

    // Step 1 starts a clean take; otherwise play every step not played yet, in order.
    const from = step === 1 ? 1 : done.current === 0 ? 1 : done.current + 1;
    const todo = Array.from({ length: Math.max(0, step - from + 1) }, (_, i) => from + i);
    if (step === 1) {
      done.current = 0;
      visitor.current = false;
      chain.current = chain.current.then(() => setAsVisitor(false));
    }
    for (const n of todo) {
      chain.current = chain.current.then(async () => {
        if (n <= done.current) return;
        if (!live.current || visitor.current) {
          done.current = n; // offline: the Demo page drives the local desk itself
          return;
        }
        setStatus({ live: true, state: "running" });
        try {
          await api.demo.step(n, { agent_steps: AGENT_STEPS[n], plan: n === 4 || n === 5 ? CHERRY_PLAN : undefined });
          done.current = n;
          setStatus({ live: true, state: "ok" });
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            visitor.current = true; // not the owner: keep playing locally, no error, no sign-in prompt
            done.current = n;
            setAsVisitor(true);
            setStatus({ live: false, state: "idle" });
            return;
          }
          const message = err instanceof ApiError
            ? err.status === 401 ? "Sign in as the owner to replay on the live API"
              : typeof err.detail === "string" ? err.detail : (err.detail as { detail?: string })?.detail ?? `HTTP ${err.status}`
            : "Backend unreachable";
          setStatus({ live: true, state: "error", message });
        }
      });
    }
  }, [step, playing]);

  return { ...status, live: mode === "live" && !asVisitor };
}
