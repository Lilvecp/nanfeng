"use client";

import { useEffect } from "react";

/**
 * True on weak or constrained devices: few cores, little memory, data saver, or a small touch screen.
 * Decorative motion (orbs, pointer light, tilt, big gradients) is switched off there; content is unchanged.
 */
export function isLite(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    !!nav.connection?.saveData ||
    window.matchMedia("(max-width: 760px)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

/** Marks <html> with .fx-lite on weak devices so CSS can drop the expensive effects. */
export function useLiteClass() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.classList.toggle("fx-lite", isLite());
    apply();
    const mq = window.matchMedia("(max-width: 760px)");
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      root.classList.remove("fx-lite");
    };
  }, []);
}
