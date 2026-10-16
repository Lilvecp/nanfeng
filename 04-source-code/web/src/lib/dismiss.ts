"use client";

import { useSyncExternalStore } from "react";

// Notices the viewer closed stay closed while they move around the app (sessionStorage), and come
// back in a new session. Server render always shows the notice.

const PREFIX = "nanfeng.dismissed.";
const listeners = new Set<() => void>();

function read(id: string) {
  try {
    return window.sessionStorage.getItem(PREFIX + id) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setDismissed(id: string, value = true) {
  try {
    if (value) window.sessionStorage.setItem(PREFIX + id, "1");
    else window.sessionStorage.removeItem(PREFIX + id);
  } catch {
    // storage blocked: the notice just reappears on the next visit
  }
  listeners.forEach((l) => l());
}

export function useDismissed(id: string) {
  return useSyncExternalStore(subscribe, () => read(id), () => false);
}
