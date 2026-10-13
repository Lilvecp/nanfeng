"use client";

import { N, S } from "./scenario";
import type { Lang } from "./prefs";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { API_URL, ApiError, api, useEventStream, type ApiEvent, type Approval, type ApprovalCreate } from "./api";
import { useLang } from "./i18n";
import { useSignedIn } from "./owner-session";

// Front-end state for the Cherry Crisis desk. Two modes with the same shape:
// - "live": NEXT_PUBLIC_API_URL is set and the backend answers; approvals, OTP, kill switch and
//   history come from the API and update over the SSE stream.
// - "sandbox": no backend (or it is down); everything runs on the local mocks below, so Demo Mode
//   never depends on the network.

export type ApprovalStatus = "pending" | "verifying" | "approved" | "rejected";
export type PlanId = string; // quant product id, e.g. "PAE-USD"
// The plan the MILP picks in the Cherry Crisis (see lib/scenario.ts).
export const DEFAULT_PLAN: PlanId = "PAE-USD";
const APPROVED_ACTION = `pae.loan ${N.termDays}D`;
const APPROVED_LABEL: Record<Lang, string> = { en: `Pre-export loan · ${N.termDays} days`, es: `Crédito de pre-exportación · ${N.termDays} días`, zh: `出口前融资 · ${N.termDays}天` };

// Notices the desk shows after an action, in the viewer's language.
const TOASTS = {
  en: {
    approved: "Plan approved · executed in the sandbox · audit hash anchored",
    failed: "Execution failed",
    retry: "Backend unreachable · try again",
    rejected: "Rejected · the agent is preparing the next-cheapest option (export factoring)",
    rejectFail: "Backend unreachable · rejection not saved",
    killFail: "Backend unreachable · kill switch not changed",
    killOn: "Kill switch engaged · all tool calls stopped",
    killOff: "Agent re-armed · monitoring every 15 minutes",
    resetFail: "Backend unreachable · reset only applied locally",
    reset: "Sandbox reset · Cherry Crisis at 10:13",
    planOk: "Recommended plan selected",
    planChanged: "Plan changed · approval request updated",
    signInReject: "Sign in as the owner to reject",
    signInKill: "Sign in as the owner to change the kill switch",
    wrongCode: "Wrong or missing code · kill switch stays on",
    codeSent: "New code sent. You have 3 attempts again.",
    codeSentSandbox: "New code ready. In the sandbox it is always 482 913.",
    codeTooSoon: "A code was just sent. Wait half a minute and try again.",
    codeLocked: "This request is locked after 3 wrong codes. Reset the sandbox to start over.",
  },
  es: {
    approved: "Plan aprobado · ejecutado en el sandbox · hash de auditoría anclado",
    failed: "La ejecución falló",
    retry: "Sin conexión con el servidor · inténtalo de nuevo",
    rejected: "Rechazado · el agente prepara la siguiente opción más barata (factoring de exportación)",
    rejectFail: "Sin conexión con el servidor · el rechazo no se guardó",
    killFail: "Sin conexión con el servidor · el freno no cambió",
    killOn: "Freno de emergencia activado · el agente no ejecuta nada",
    killOff: "Agente reactivado · vigila cada 15 minutos",
    resetFail: "Sin conexión con el servidor · el reinicio solo se aplicó aquí",
    reset: "Demo reiniciada · Cherry Crisis a las 10:13",
    planOk: "Plan recomendado seleccionado",
    planChanged: "Plan cambiado · solicitud de aprobación actualizada",
    signInReject: "Inicia sesión como dueño para rechazar",
    signInKill: "Inicia sesión como dueño para cambiar el freno de emergencia",
    wrongCode: "Código incorrecto o vacío · el freno sigue activado",
    codeSent: "Código nuevo enviado. Tienes 3 intentos otra vez.",
    codeSentSandbox: "Código nuevo listo. En el sandbox siempre es 482 913.",
    codeTooSoon: "Acabamos de enviar un código. Espera medio minuto y vuelve a intentarlo.",
    codeLocked: "Esta solicitud quedó bloqueada tras 3 códigos incorrectos. Reinicia el sandbox para empezar de nuevo.",
  },
  zh: {
    approved: "方案已批准 · 已在沙盒执行 · 审计哈希已上链",
    failed: "执行失败",
    retry: "无法连接服务器 · 请重试",
    rejected: "已拒绝 · 代理正在准备下一个最便宜的方案（出口保理）",
    rejectFail: "无法连接服务器 · 拒绝未保存",
    killFail: "无法连接服务器 · 紧急停止未更改",
    killOn: "紧急停止已启动 · 代理不再执行任何操作",
    killOff: "代理已恢复 · 每15分钟监控一次",
    resetFail: "无法连接服务器 · 仅在本地重置",
    reset: "演示已重置 · Cherry Crisis 10:13",
    planOk: "已选择推荐方案",
    planChanged: "方案已更改 · 审批请求已更新",
    signInReject: "请以企业主身份登录后再拒绝",
    signInKill: "请以企业主身份登录后再更改紧急停止",
    wrongCode: "验证码错误或为空 · 紧急停止保持开启",
    codeSent: "新验证码已发送，您再次有3次机会。",
    codeSentSandbox: "新验证码已就绪。沙盒中验证码始终为 482 913。",
    codeTooSoon: "验证码刚刚发送，请等待半分钟后再试。",
    codeLocked: "连续3次输错，此请求已锁定。请重置沙盒后重新开始。",
  },
};

export const SANDBOX_OTP = "482913";

/** What the sandbox bank and the audit chain return when the plan runs (Approvals, Home, Security). */
export const SANDBOX_RECEIPT = { ref: "APR-0412", time: "10:16", seq: 1043, hash: "c90e…77b2", tx: "0x7d3a…e21c", block: "Sepolia #7,291,604" };

/** The executed plan as every screen quotes it: one reference, one time, one audit entry. */
export type Receipt = { ref: string; time: string; seq: number | null; hash: string | null };

export type ApiMode = "checking" | "live" | "sandbox";
export type OtpResult = { status: "ok" | "mismatch" | "locked" | "cancelled"; attemptsLeft: number };
/** Live API refused because the owner did not sign in (sign-in screen cancelled). */
const signInCancelled = (err: unknown) => err instanceof ApiError && err.status === 401;

/** The approval the agent requests at 10:15: the MILP's plan as the quant engine writes it
 * (approvalRequest in data/cherry-crisis.json, regenerated by `npm run sync:scenario`). */
export const CHERRY_PLAN = {
  action: S.approvalRequest.action,
  explanation: S.approvalRequest.explanation,
  channel: S.approvalRequest.channel,
  operations: S.approvalRequest.operations as ApprovalCreate["operations"],
};

export type HistoryRow = {
  time: string;
  id: string;
  action: string;
  /** What the action means in plain words; the tool name stays as a tooltip. */
  label?: Record<Lang, string>;
  tier: 1 | 2 | 3;
  /** Amount in its own currency, formatted for the viewer's language on screen (lib/scenario money()). */
  amount: { value: number; currency: "CLP" | "USD" | "CNY" } | null;
  decision: "approved" | "rejected" | "auto";
  channel: string;
  note: string;
};

const INITIAL_HISTORY: HistoryRow[] = [
  { time: "2026-12-07 16:22", id: "APR-0398", action: "fx.forward 30D", label: { en: "CNY forward · 30 days", es: "Forward en CNY · 30 días", zh: "人民币远期 · 30天" }, tier: 3, amount: { value: 450000, currency: "CNY" }, decision: "approved", channel: "WA+OTP", note: "—" },
  { time: "2026-12-03 10:05", id: "AUT-0377", action: "pay Cartonera Sur", label: { en: "Pay Cartonera Sur (boxes)", es: "Pago a Cartonera Sur (cajas)", zh: "支付 Cartonera Sur（纸箱）" }, tier: 2, amount: { value: 6240000, currency: "CLP" }, decision: "auto", channel: "—", note: "within limit · allowlisted" },
  { time: "2026-11-29 18:40", id: "APR-0361", action: "wc.loan Banco Andino", label: { en: "Working-capital loan · Banco Andino", es: "Crédito de capital de trabajo · Banco Andino", zh: "流动资金贷款 · Banco Andino" }, tier: 3, amount: { value: 90000000, currency: "CLP" }, decision: "rejected", channel: "WEB", note: "\"Too expensive, check other options\"" },
  { time: "2026-11-22 09:00", id: "AUT-0350", action: "reminder.send WeCom", label: { en: "Payment reminder on WeCom", es: "Recordatorio de pago por WeCom", zh: "企业微信付款提醒" }, tier: 1, amount: null, decision: "auto", channel: "—", note: "—" },
];

type DeskState = {
  mode: ApiMode;
  approval: ApprovalStatus;
  approvalId: string;
  /** Reference, time and audit entry of the executed plan (live: the real ones from the API). */
  receipt: Receipt;
  otpAttemptsLeft: number;
  rejectReason: string;
  plan: PlanId;
  history: HistoryRow[];
  events: ApiEvent[];
  killSwitch: boolean;
  toast: string | null;
  submitOtp: (code: string) => Promise<OtpResult>;
  /** Asks for a fresh code. Sandbox: the attempts start over. Live: the backend texts a new code. */
  resendOtp: () => Promise<boolean>;
  reject: (reason: string) => Promise<void>;
  choosePlan: (plan: PlanId) => void;
  /** Turning it off on the live API needs the owner's one-time code (L3). Returns false if refused. */
  setKillSwitch: (on: boolean, otp?: string) => Promise<boolean>;
  resetDemo: () => Promise<void>;
  /** Demo Mode reached its last step: the sandbox desk shows the plan approved everywhere. */
  finishDemo: () => void;
  notify: (msg: string) => void;
};

const Ctx = createContext<DeskState | null>(null);

// Sandbox decisions survive a reload or a direct link for the rest of the visit (sessionStorage),
// so a refresh in the middle of the demo does not send the desk back to 10:13.
type Saved = { approval: "pending" | "approved" | "rejected"; attempts: number; reason: string };
const SAVED_KEY = "nanfeng.sandbox";
const SAVED_DEFAULT: Saved = { approval: "pending", attempts: 3, reason: "" };
const savedListeners = new Set<() => void>();
const readSaved = () => {
  try {
    return window.sessionStorage.getItem(SAVED_KEY) ?? "";
  } catch {
    return "";
  }
};
function writeSaved(v: Saved | null) {
  try {
    if (v) window.sessionStorage.setItem(SAVED_KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(SAVED_KEY);
  } catch {
    // storage blocked: the decision lasts until reload
  }
  savedListeners.forEach((l) => l());
}
function parseSaved(raw: string): Saved {
  try {
    return raw ? { ...SAVED_DEFAULT, ...(JSON.parse(raw) as Partial<Saved>) } : SAVED_DEFAULT;
  } catch {
    return SAVED_DEFAULT;
  }
}
const subscribeSaved = (cb: () => void) => {
  savedListeners.add(cb);
  return () => savedListeners.delete(cb);
};

const pad = (n: number) => String(n).padStart(2, "0");
/** API timestamps are UTC; show them in the viewer's local time like the rest of the desk. */
export const fmtLocal = (iso: string, withDate = true) => {
  // the API speaks UTC; a timestamp without an offset (SQLite drops it) is UTC too, not local time
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (!withDate) return `${time}:${pad(d.getSeconds())}`;
  // The desk lives on the scenario's day (the cockpit says "Today · December 11"): what happened today
  // on the API is dated on that day too, so it sorts above the December history instead of in October.
  const ymd = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return `${ymd(d) === ymd(new Date()) ? S.asOf : ymd(d)} ${time}`;
};
const fmtTime = (iso: string) => fmtLocal(iso);

function toHistoryRow(a: Approval): HistoryRow {
  const decision: HistoryRow["decision"] = a.status === "approved" ? "approved" : a.status === "auto" ? "auto" : "rejected";
  return {
    time: fmtTime(a.decided_at ?? a.created_at),
    id: a.id,
    action: a.action,
    tier: Math.min(3, Math.max(1, a.tier)) as HistoryRow["tier"],
    amount: a.amount_clp ? { value: Number(a.amount_clp), currency: "CLP" } : null,
    decision,
    channel: a.channel || "—",
    note: a.status === "rejected" ? `"${a.note}"` : a.status === "auto" ? a.note : a.status === "approved" ? "—" : `${a.status}: ${a.note}`,
  };
}

function liveStatus(a: Approval | null): ApprovalStatus {
  if (!a || a.status === "pending" || a.status === "locked") return "pending";
  return a.status === "approved" ? "approved" : "rejected";
}

export function DeskStateProvider({ children }: { children: React.ReactNode }) {
  const T = TOASTS[useLang()];
  const [mode, setMode] = useState<ApiMode>(API_URL ? "checking" : "sandbox");
  const savedRaw = useSyncExternalStore(subscribeSaved, readSaved, () => "");
  const saved = useMemo(() => parseSaved(savedRaw), [savedRaw]);
  const [checking, setChecking] = useState(false);
  const approval: ApprovalStatus = checking ? "verifying" : saved.approval;
  const otpAttemptsLeft = saved.attempts;
  const rejectReason = saved.reason;
  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);
  const history = useMemo<HistoryRow[]>(() => {
    if (saved.approval === "pending") return INITIAL_HISTORY;
    const approved = saved.approval === "approved";
    return [
      { time: "2026-12-11 10:15", id: "APR-0412", action: APPROVED_ACTION, label: APPROVED_LABEL, tier: 3, amount: { value: N.loanUsd, currency: "USD" }, decision: approved ? "approved" : "rejected", channel: approved ? "WEB+OTP" : "WEB", note: approved ? "Cherry Crisis plan" : `"${saved.reason}"` },
      ...INITIAL_HISTORY,
    ];
  }, [saved]);
  const [toast, setToast] = useState<string | null>(null);
  // live mode
  const [live, setLive] = useState<Approval | null>(null);
  const [liveHistory, setLiveHistory] = useState<HistoryRow[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [killSwitch, setKill] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const verifyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resetting = useRef(false); // this tab is resetting: it recreates the plan itself

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(verifyTimer.current);
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  /** Loads the Cherry Crisis approval (creating it once if the sandbox has none) and the history. */
  const refresh = useCallback(async (create = false) => {
    const all = await api.approvals.list();
    let current = all.find((a) => a.action === CHERRY_PLAN.action) ?? null;
    if (!current && create) {
      // Only the owner or the agent may open an approval (deploys set NANFENG_AGENT_TOKEN). A visitor
      // without a session still gets the live cockpit; the plan is created once the owner signs in.
      try {
        current = await api.approvals.create(CHERRY_PLAN);
      } catch (err) {
        if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) throw err;
      }
    }
    setLive(current);
    setLiveHistory(all.filter((a) => a.status !== "pending" && a.status !== "locked").map(toHistoryRow));
  }, []);

  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        await refresh(true);
        const ks = await api.killSwitch.get();
        if (cancelled) return;
        setKill(ks.on);
        setMode("live");
      } catch {
        if (!cancelled) setMode("sandbox");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // the owner just signed in on a live cockpit with no plan yet: open the demo approval now
  const signedIn = useSignedIn();
  useEffect(() => {
    if (mode !== "live" || !signedIn || live) return;
    const id = setTimeout(() => refresh(true).catch(() => {}), 0);
    return () => clearTimeout(id);
  }, [mode, signedIn, live, refresh]);

  useEventStream(mode === "live", (e) => {
    setEvents((list) => (list.some((x) => x.id === e.id) ? list : [...list, e].slice(-60)));
    if (e.type.startsWith("approval.")) refresh().catch(() => {});
    if (e.type === "sandbox.reset" && !resetting.current) {
      // A reset from the Demo Mode replay starts a clean take: no request until its "plan" step.
      const byDemo = e.data.by === "demo";
      setKill(false);
      if (byDemo) setEvents([e]);
      refresh(!byDemo).catch(() => {});
    }
    if (e.type === "policy.kill_switch") setKill(Boolean(e.data.on));
  });

  const submitOtp = useCallback(
    async (code: string): Promise<OtpResult> => {
      if (mode === "live" && live) {
        setVerifying(true);
        try {
          const a = await api.approvals.approve(live.id, code);
          setLive(a);
          await refresh();
          notify(a.status === "approved" ? T.approved : `${T.failed} · ${a.note}`);
          return { status: "ok", attemptsLeft: a.otp_attempts_left };
        } catch (err) {
          if (signInCancelled(err)) return { status: "cancelled", attemptsLeft: live.otp_attempts_left };
          const left = err instanceof ApiError ? ((err.detail as { attempts_left?: number })?.attempts_left ?? 0) : live.otp_attempts_left;
          setLive((a) => (a ? { ...a, otp_attempts_left: left, status: left <= 0 ? "locked" : a.status } : a));
          if (!(err instanceof ApiError)) notify(T.retry);
          return { status: err instanceof ApiError && err.status === 423 ? "locked" : "mismatch", attemptsLeft: left };
        } finally {
          setVerifying(false);
        }
      }

      if (otpAttemptsLeft <= 0) return { status: "locked", attemptsLeft: 0 };
      if (code !== SANDBOX_OTP) {
        writeSaved({ ...saved, attempts: otpAttemptsLeft - 1 });
        return { status: otpAttemptsLeft - 1 <= 0 ? "locked" : "mismatch", attemptsLeft: otpAttemptsLeft - 1 };
      }
      setChecking(true);
      verifyTimer.current = setTimeout(() => {
        setChecking(false);
        writeSaved({ ...saved, approval: "approved" });
        notify(T.approved);
      }, 1400);
      return { status: "ok", attemptsLeft: otpAttemptsLeft };
    },
    [mode, live, otpAttemptsLeft, saved, notify, refresh, T],
  );

  const resendOtp = useCallback(async () => {
    if (mode === "live" && live) {
      try {
        await api.approvals.resendCode(live.id);
        notify(T.codeSent);
        return true;
      } catch (err) {
        if (signInCancelled(err)) return false;
        notify(err instanceof ApiError ? (err.status === 429 ? T.codeTooSoon : err.status === 409 ? T.codeLocked : T.retry) : T.retry);
        return false;
      }
    }
    writeSaved({ ...saved, attempts: SAVED_DEFAULT.attempts });
    notify(T.codeSentSandbox);
    return true;
  }, [mode, live, saved, notify, T]);

  const reject = useCallback(
    async (reason: string) => {
      if (mode === "live" && live) {
        try {
          setLive(await api.approvals.reject(live.id, reason));
          await refresh();
          notify(T.rejected);
        } catch (err) {
          notify(signInCancelled(err) ? T.signInReject : T.rejectFail);
        }
        return;
      }
      writeSaved({ ...saved, approval: "rejected", reason });
      notify(T.rejected);
    },
    [mode, live, saved, notify, refresh, T],
  );

  const choosePlan = useCallback(
    (p: PlanId) => {
      setPlan(p);
      notify(p === DEFAULT_PLAN ? T.planOk : T.planChanged);
    },
    [notify, T],
  );

  const setKillSwitch = useCallback(
    async (on: boolean, otp?: string) => {
      if (mode === "live") {
        try {
          setKill((await api.killSwitch.set(on, otp)).on);
        } catch (err) {
          notify(signInCancelled(err) ? T.signInKill : err instanceof ApiError && err.status !== 401 && !on ? T.wrongCode : T.killFail);
          return false;
        }
      } else setKill(on);
      notify(on ? T.killOn : T.killOff);
      return true;
    },
    [mode, notify, T],
  );

  const resetDemo = useCallback(async () => {
    clearTimeout(verifyTimer.current);
    setChecking(false);
    writeSaved(null);
    setPlan(DEFAULT_PLAN);
    if (mode === "live") {
      resetting.current = true;
      try {
        await api.bank.reset();  // owner-only; prompts the sign-in if needed
        setKill(false);
        setEvents([]);
        await refresh(true);
      } catch {
        notify(T.resetFail);
        return;
      } finally {
        resetting.current = false;
      }
    }
    notify(T.reset);
  }, [mode, notify, refresh, T]);

  const finishDemo = useCallback(() => {
    if (mode !== "live") writeSaved({ ...SAVED_DEFAULT, approval: "approved" });
  }, [mode]);

  const isLive = mode === "live";
  const liveReceipt = useMemo<Receipt | null>(() => {
    if (!isLive || !live?.decided_at) return null;
    const r = (live.results ?? [])[0] as { audit_seq?: number; audit_hash?: string } | undefined;
    return {
      ref: live.id,
      time: fmtLocal(live.decided_at, false).slice(0, 5),
      seq: r?.audit_seq ?? null,
      hash: r?.audit_hash ? `${r.audit_hash.slice(0, 4)}…${r.audit_hash.slice(-4)}` : null,
    };
  }, [isLive, live]);
  const value = useMemo<DeskState>(
    () => ({
      mode,
      approval: isLive ? (verifying ? "verifying" : liveStatus(live)) : approval,
      approvalId: isLive && live ? live.id : SANDBOX_RECEIPT.ref,
      receipt: liveReceipt ?? { ref: SANDBOX_RECEIPT.ref, time: SANDBOX_RECEIPT.time, seq: SANDBOX_RECEIPT.seq, hash: SANDBOX_RECEIPT.hash },
      // no request open yet on the API: nothing was attempted, so nothing is locked
      otpAttemptsLeft: isLive ? (live?.otp_attempts_left ?? SAVED_DEFAULT.attempts) : otpAttemptsLeft,
      rejectReason: isLive ? (live?.note ?? "") : rejectReason,
      plan,
      history: isLive ? [...liveHistory, ...INITIAL_HISTORY] : history,
      events,
      killSwitch,
      toast,
      submitOtp,
      resendOtp,
      reject,
      choosePlan,
      setKillSwitch,
      resetDemo,
      finishDemo,
      notify,
    }),
    [mode, isLive, verifying, live, liveReceipt, approval, otpAttemptsLeft, rejectReason, plan, liveHistory, history, events, killSwitch, toast, submitOtp, resendOtp, reject, choosePlan, setKillSwitch, resetDemo, finishDemo, notify],
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
  const { approval, mode } = useDesk();
  const resolved = approval === "approved";
  return {
    resolved,
    pendingCount: mode !== "checking" && (approval === "pending" || approval === "verifying") ? 1 : 0,
    pNeg: resolved ? N.pNegAfterPlan : N.pNeg,
    runway: resolved ? "90D+" : `${N.crunchDay}D`,
  };
}
