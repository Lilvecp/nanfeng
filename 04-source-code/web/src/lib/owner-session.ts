"use client";

import { useSyncExternalStore } from "react";

// The owner's session token for the live API (threat model F1). Kept for the browser tab only
// (sessionStorage). When an owner-only call answers 401, `requestLogin()` opens the sign-in
// screen and resolves once the owner signs in (or rejects if they cancel), so the call can retry.

const KEY = "nanfeng.session";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let prompt: { resolve: () => void; reject: (e: Error) => void; promise: Promise<void> } | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getToken(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the session lasts until the page reloads
  }
  emit();
}

/** Opens the sign-in screen; resolves after a successful sign-in, rejects on cancel. */
export function requestLogin(): Promise<void> {
  if (!prompt) {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    prompt = { resolve, reject, promise };
    emit();
  }
  return prompt.promise;
}

export function finishLogin(ok: boolean) {
  const p = prompt;
  prompt = null;
  emit();
  if (!p) return;
  if (ok) p.resolve();
  else p.reject(new Error("sign-in cancelled"));
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, () => getToken() !== "", () => false);
}

export function useLoginOpen(): boolean {
  return useSyncExternalStore(subscribe, () => prompt !== null, () => false);
}
