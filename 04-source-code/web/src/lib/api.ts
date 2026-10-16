"use client";

import { useEffect, useRef } from "react";
import type { components } from "./api-types";
import { getToken, requestLogin, setToken } from "./owner-session";

// Typed client for the NanFeng backend. Types come from contracts/openapi.json (npm run api:types).
// Without NEXT_PUBLIC_API_URL, or when the backend is down, the desk falls back to its local sandbox.

type S = components["schemas"];
export type Approval = S["ApprovalOut"];
export type ApprovalCreate = S["ApprovalCreate"];
export type AuditEntry = S["AuditEntryOut"];
export type Anchor = S["AnchorOut"];
export type Account = S["AccountOut"];
export type DemoAgentStep = { step: string; tool: string; tier?: number; model?: string; cost_usd?: number; latency_s?: number; detail?: string };
export type ChainCheck = { valid: boolean; entries: number; broken_at_seq: number | null; head?: string };
export type ApiEvent = { id: number; type: string; ts: string; source: string; data: Record<string, unknown> };

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
// The agent service (renato-lenis, :8200). It checks the same owner session with the backend.
export const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : `API ${status}`);
  }
}

type Opts = { auth?: "prompt" | "silent"; base?: string; timeoutMs?: number };

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, opts: Opts = {}, retried = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${opts.base ?? API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    // a cold or unreachable backend must not leave the desk on "Connecting…": fall back instead
    signal: AbortSignal.timeout(opts.timeoutMs ?? (path === "/health" ? 10_000 : 30_000)),
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : res.status === 204 ? null : await res.text();
  // Owner-only route without a valid session: ask the owner to sign in, then try once more.
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (token) setToken("");
    if (opts.auth !== "silent" && !retried) {
      try {
        await requestLogin();
      } catch {
        throw new ApiError(401, (data as { detail?: unknown })?.detail ?? data);
      }
      return request<T>(method, path, body, opts, true);
    }
  }
  if (!res.ok) throw new ApiError(res.status, (data as { detail?: unknown })?.detail ?? data);
  return data as T;
}

const get = <T,>(path: string, opts: Opts = {}) => request<T>("GET", path, undefined, opts);
const post = <T,>(path: string, body: unknown = {}, opts: Opts = {}) => request<T>("POST", path, body, opts);

export const api = {
  health: () => get<{ status: string; version: string; audit_head_seq: number }>("/health"),
  auth: {
    login: (password: string) => post<{ token: string; expires_at: number }>("/auth/login", { password }),
    logout: () => post<null>("/auth/logout"),
    config: () => get<{ demo_password: string | null }>("/auth/config"),
  },
  approvals: {
    list: (status?: string) => get<Approval[]>(`/approvals${status ? `?status=${status}` : ""}`),
    // silent: on page load the cockpit only creates the demo plan if it may; it never pops the sign-in.
    create: (body: ApprovalCreate) => post<Approval>("/approvals", body, { auth: "silent" }),
    // SMS mode: texts the owner a fresh code (429 if asked again too soon, 409 once locked).
    resendCode: (id: string) => post<{ mode: string; sent_to?: string; expires_at?: string }>(`/approvals/${id}/otp`),
    approve: (id: string, otp: string, channel = "WEB+OTP") => post<Approval>(`/approvals/${id}/approve`, { otp, channel }),
    reject: (id: string, reason: string) => post<Approval>(`/approvals/${id}/reject`, { reason, channel: "WEB" }),
  },
  // The policy engine's limits (threat model F4: the backend is the source of truth for Settings).
  policy: {
    get: () => get<{ version: number; tiers: Record<string, Record<string, number>> }>("/policy"),
  },
  killSwitch: {
    get: () => get<{ on: boolean }>("/policy/kill-switch"),
    set: (on: boolean, otp?: string) => post<{ on: boolean }>("/policy/kill-switch", otp ? { on, otp } : { on }),
  },
  audit: {
    entries: (afterSeq = 0, limit = 1000) => get<AuditEntry[]>(`/audit/entries?after_seq=${afterSeq}&limit=${limit}`),
    verify: () => get<ChainCheck>("/audit/verify"),
    anchors: () => get<Anchor[]>("/audit/anchors"),
    anchor: () => post<Anchor>("/audit/anchor"),
  },
  demo: {
    // Demo Mode replay (owner, demo builds): the step really happens on the backend.
    // silent: a visitor watching the demo is never asked for the owner's password; the replay then
    // plays on their screen only (the tour signs in first on purpose, see useStartTour).
    step: (n: number, body: { agent_steps?: DemoAgentStep[]; plan?: ApprovalCreate }) =>
      post<{ step: number; approval?: { id: string; status: string } }>(`/demo/step/${n}`, body, { auth: "silent" }),
  },
  bank: {
    accounts: () => get<Account[]>("/bank/accounts"),
    reset: () => post<{ reset: boolean }>("/bank/reset"),
  },
};

export type AgentAnswer = { answer: string; intent: string; run_id: string | null; model: string };
export type AgentRun = {
  run_id: string; kind: string; status: string; note: string; steps: number; planner: string | null;
  approvals: { id: string; tier: number; status: string }[];
};
export type AgentUpload = { filename: string; mime: string; data_base64: string; source?: "upload"; language?: string };

// A document run reads it (OCR), forecasts, optimizes and proposes: allow more than the default 30 s.
const AGENT = { base: AGENT_URL, timeoutMs: 120_000 } as const;

export const agent = {
  health: () => get<{ status: string; providers: Record<string, string>; planner: string }>("/health", { base: AGENT_URL, auth: "silent" }),
  ask: (question: string, language: string) => post<AgentAnswer>("/ask", { question, language }, AGENT),
  upload: (body: AgentUpload) => post<AgentRun>("/documents", { source: "upload", ...body }, AGENT),
  report: (language: string) => post<{ text: string; delivery: { channel: string; status: string } | null }>("/report", { language }, AGENT),
};

/** Subscribes to the backend SSE stream; the browser reconnects and resumes with Last-Event-ID. */
export function useEventStream(enabled: boolean, onEvent: (e: ApiEvent) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!enabled || !API_URL) return;
    const es = new EventSource(`${API_URL}/agent/events`);
    es.onmessage = (m) => {
      try {
        handler.current(JSON.parse(m.data) as ApiEvent);
      } catch {
        // ignore malformed frames
      }
    };
    return () => es.close();
  }, [enabled]);
}
