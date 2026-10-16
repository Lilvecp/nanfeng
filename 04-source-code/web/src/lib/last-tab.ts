"use client";

import { useSyncExternalStore } from "react";
import { SECTIONS, type Section } from "./sections";

// Each section remembers its last tab for the visit (sessionStorage): open Financing → What if…,
// go elsewhere, come back through the sidebar and you land on What if… again. A new visit starts
// every section on its first tab.

const KEY = "nanfeng.lastTab.";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): string {
  try {
    return SECTIONS.map((s) => window.sessionStorage.getItem(KEY + s.href) ?? "").join("|");
  } catch {
    return "";
  }
}

/** Call with the current route; only tabs of a section are remembered. */
export function rememberTab(pathname: string) {
  const section = SECTIONS.find((s) => s.tabs?.some((t) => t.href === pathname));
  if (!section) return;
  try {
    if (window.sessionStorage.getItem(KEY + section.href) === pathname) return;
    window.sessionStorage.setItem(KEY + section.href, pathname);
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

/** Where the sidebar link of each section should go: its last tab this visit, or its first one. */
export function useSectionHrefs(): Record<string, string> {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "");
  const saved = snap.split("|");
  return Object.fromEntries(
    SECTIONS.map((s: Section, i) => [s.href, s.tabs?.some((t) => t.href === saved[i]) ? saved[i] : s.href]),
  );
}
