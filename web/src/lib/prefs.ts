"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEY } from "./prefs-boot";

// Viewer preferences kept in localStorage. Server render always uses the defaults;
// useSyncExternalStore swaps in the stored value right after hydration without a mismatch error.
// The Home view (Summary / Full detail) lasts for the visit only (sessionStorage): coming back to
// Home keeps the tab you chose, and a new visit starts again on the owner's plain Summary.

export type Lang = "en" | "es" | "zh";
export type Theme = "light" | "dark";
/** "simple" is the owner's plain-language view; "detail" shows the full desk. */
export type View = "simple" | "detail";
export type Intro = "new" | "seen";

const DEFAULTS = { lang: "en" as Lang, theme: "light" as Theme, view: "simple" as View, intro: "new" as Intro };
type Key = keyof typeof DEFAULTS;

const listeners = new Set<() => void>();

const store = (key: Key) => (key === "view" ? window.sessionStorage : window.localStorage);

function read<K extends Key>(key: K): (typeof DEFAULTS)[K] {
  try {
    const v = store(key).getItem(STORAGE_KEY[key]);
    if (key === "lang" && (v === "en" || v === "es" || v === "zh")) return v as (typeof DEFAULTS)[K];
    if (key === "theme" && (v === "light" || v === "dark")) return v as (typeof DEFAULTS)[K];
    if (key === "view" && (v === "simple" || v === "detail")) return v as (typeof DEFAULTS)[K];
    if (key === "intro" && (v === "new" || v === "seen")) return v as (typeof DEFAULTS)[K];
  } catch {
    // storage blocked (private mode): fall back to defaults
  }
  return DEFAULTS[key];
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function setPref<K extends Key>(key: K, value: (typeof DEFAULTS)[K]) {
  try {
    store(key).setItem(STORAGE_KEY[key], value);
  } catch {
    // ignore
  }
  if (key === "theme") document.body.dataset.theme = value;
  if (key === "lang") document.documentElement.lang = value === "zh" ? "zh-CN" : value;
  listeners.forEach((l) => l());
}

export function usePref<K extends Key>(key: K): (typeof DEFAULTS)[K] {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => DEFAULTS[key],
  );
}

