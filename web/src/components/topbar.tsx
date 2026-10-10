"use client";

import { setPref, usePref, type Lang } from "@/lib/prefs";
import { useT } from "@/lib/i18n";

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "es", label: "ES" },
  { id: "zh", label: "中文" },
];

export function LangSwitch() {
  const lang = usePref("lang");
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} className={lang === l.id ? "on" : undefined} type="button" aria-pressed={lang === l.id} onClick={() => setPref("lang", l.id)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const theme = usePref("theme");
  const t = useT();
  return (
    <button className="icon-btn" type="button" aria-label={t("shell.theme")} aria-pressed={theme === "dark"} onClick={() => setPref("theme", theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}

/** Ticker row on top of every desk screen; each screen passes its own ticks. */
export function Topbar({ children, controls = true }: { children: React.ReactNode; controls?: boolean }) {
  return (
    <div className="topbar">
      <div className="tick">
        <span className="v" style={{ fontFamily: "var(--f-body)" }}>Huerto Austral Export SpA</span>
      </div>
      {children}
      {controls && (
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <LangSwitch />
          <ThemeToggle />
        </div>
      )}
    </div>
  );
}
