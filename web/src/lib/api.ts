"use client";

import { useEffect, useRef } from "react";
import type { components } from "./api-types";

// Typed client for the NanFeng backend. Types come from contracts/openapi.json (npm run api:types).
// Without NEXT_PUBLIC_API_URL, or when the backend is down, the desk falls back to its local sandbox.

type S = components["schemas"];
export type Approval = S["ApprovalOut"];
export type ApprovalCreate = S["ApprovalCreate"];
export type AuditEntry = S["AuditEntryOut"];
export type Anchor = S["AnchorOut"];
export type Account = S["AccountOut"];
export type ChainCheck = { valid: boolean; entries: number; broken_at_seq: number | null; head?: string };
export type ApiEvent = { id: number; type: string; ts: string; source: string; data: Record<string, unknown> };

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : `API ${status}`);
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { detail?: unknown })?.detail ?? data);
  return data as T;
}

const get = <T,>(path: string) => request<T>("GET", path);
const post = <T,>(path: string, body: unknown = {}) => request<T>("POST", path, body);

export const api = {
  health: () => get<{ status: string; version: string; audit_head_seq: number }>("/health"),
  approvals: {
    list: (status?: string) => get<Approval[]>(`/approvals${status ? `?status=${status}` : ""}`),
    create: (body: ApprovalCreate) => post<Approval>("/approvals", body),
    approve: (id: string, otp: string, channel = "WEB+OTP") => post<Approval>(`/approvals/${id}/approve`, { otp, channel }),
    reject: (id: string, reason: string) => post<Approval>(`/approvals/${id}/reject`, { reason, channel: "WEB" }),
  },
  killSwitch: {
    get: () => get<{ on: boolean }>("/policy/kill-switch"),
    set: (on: boolean) => post<{ on: boolean }>("/policy/kill-switch", { on }),
  },
  audit: {
    entries: (afterSeq = 0, limit = 1000) => get<AuditEntry[]>(`/audit/entries?after_seq=${afterSeq}&limit=${limit}`),
    verify: () => get<ChainCheck>("/audit/verify"),
    anchors: () => get<Anchor[]>("/audit/anchors"),
    anchor: () => post<Anchor>("/audit/anchor"),
  },
  bank: {
    accounts: () => get<Account[]>("/bank/accounts"),
    reset: () => post<{ reset: boolean }>("/bank/reset"),
  },
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
