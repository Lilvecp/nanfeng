"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { N, usd } from "./scenario";

// Front-end state for the Cherry Crisis sandbox. Everything here is mock data until the API lands;
// the shape mirrors what the backend will own (approval status, chosen plan, history).

export type ApprovalStatus = "pending" | "verifying" | "approved" | "rejected";
export type PlanId = string; // quant product id, e.g. "PAE-USD"

export const SANDBOX_OTP = "482913";

// The plan the MILP picks in the Cherry Crisis (see lib/scenario.ts).
export const DEFAULT_PLAN: PlanId = "PAE-USD";
const APPROVED_ACTION = `pae.loan ${N.termDays}D`;
const APPROVED_AMOUNT = usd(N.loanUsd);
const NEXT_BEST = "export factoring";

export type HistoryRow = {
  time: string;
  id: string;
  action: string;
  tier: 1 | 2 | 3;
  amount: string;
  decision: "approved" | "rejected" | "auto";
  channel: string;
  note: string;
};

const INITIAL_HISTORY: HistoryRow[] = [
  { time: "2026-12-07 16:22", id: "APR-0398", action: "fx.forward 30D", tier: 3, amount: "¥450,000", decision: "approved", channel: "WA+OTP", note: "—" },
  { time: "2026-12-03 10:05", id: "AUT-0377", action: "pay Cartonera Sur", tier: 2, amount: "CLP 6.240.000", decision: "auto", channel: "—", note: "within limit · allowlisted" },
  { time: "2026-11-29 18:40", id: "APR-0361", action: "wc.loan Banco Andino", tier: 3, amount: "CLP 90.000.000", decision: "rejected", channel: "WEB", note: "\"Too expensive, check other options\"" },
  { time: "2026-11-22 09:00", id: "AUT-0350", action: "reminder.send WeCom", tier: 1, amount: "—", decision: "auto", channel: "—", note: "—" },
];

type DeskState = {
  approval: ApprovalStatus;
  otpAttemptsLeft: number;
  rejectReason: string;
  plan: PlanId;
  history: HistoryRow[];
  toast: string | null;
  submitOtp: (code: string) => "ok" | "mismatch" | "locked";
  reject: (reason: string) => void;
  choosePlan: (plan: PlanId) => void;
  resetDemo: () => void;
  notify: (msg: string) => void;
};

const Ctx = createContext<DeskState | null>(null);

export function DeskStateProvider({ children }: { children: React.ReactNode }) {
  const [approval, setApproval] = useState<ApprovalStatus>("pending");
  const [otpAttemptsLeft, setAttempts] = useState(3);
  const [rejectReason, setRejectReason] = useState("");
  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const verifyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(verifyTimer.current);
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const submitOtp = useCallback(
    (code: string) => {
      if (otpAttemptsLeft <= 0) return "locked" as const;
      if (code !== SANDBOX_OTP) {
        setAttempts((n) => n - 1);
        return "mismatch" as const;
      }
      setApproval("verifying");
      verifyTimer.current = setTimeout(() => {
        setApproval("approved");
        setHistory((h) => [
          { time: "2026-12-11 10:15", id: "APR-0412", action: APPROVED_ACTION, tier: 3, amount: APPROVED_AMOUNT, decision: "approved", channel: "WEB+OTP", note: "Cherry Crisis plan" },
          ...h,
        ]);
        notify("Plan approved · executing in sandbox · hash anchored");
      }, 1400);
      return "ok" as const;
    },
    [otpAttemptsLeft, notify],
  );

  const reject = useCallback(
    (reason: string) => {
      setApproval("rejected");
      setRejectReason(reason);
      setHistory((h) => [
        { time: "2026-12-11 10:15", id: "APR-0412", action: APPROVED_ACTION, tier: 3, amount: APPROVED_AMOUNT, decision: "rejected", channel: "WEB", note: `"${reason}"` },
        ...h,
      ]);
      notify(`Rejected · agent is preparing the next-cheapest option (${NEXT_BEST})`);
    },
    [notify],
  );

  const choosePlan = useCallback(
    (p: PlanId) => {
      setPlan(p);
      notify(p === DEFAULT_PLAN ? "Recommended plan selected" : "Plan changed · approval request updated");
    },
    [notify],
  );

  const resetDemo = useCallback(() => {
    clearTimeout(verifyTimer.current);
    setApproval("pending");
    setAttempts(3);
    setRejectReason("");
    setPlan(DEFAULT_PLAN);
    setHistory(INITIAL_HISTORY);
    notify("Sandbox reset · Cherry Crisis at 10:13");
  }, [notify]);

  const value = useMemo(
    () => ({ approval, otpAttemptsLeft, rejectReason, plan, history, toast, submitOtp, reject, choosePlan, resetDemo, notify }),
    [approval, otpAttemptsLeft, rejectReason, plan, history, toast, submitOtp, reject, choosePlan, resetDemo, notify],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDesk() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDesk must be used inside DeskStateProvider");
  return v;
}

/** Derived numbers every screen agrees on. */
export function useCrisisNumbers() {
  const { approval } = useDesk();
  const resolved = approval === "approved";
  return {
    resolved,
    pendingCount: approval === "pending" || approval === "verifying" ? 1 : 0,
    pNeg: resolved ? N.pNegAfterPlan : N.pNeg,
    runway: resolved ? "90D+" : `${N.crunchDay}D`,
  };
}
