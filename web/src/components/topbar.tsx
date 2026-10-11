"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { setPref, usePref, type Lang } from "@/lib/prefs";
import { sectionOf } from "@/lib/sections";
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

/** Tabs of the current section (e.g. Financing → Options · What if…), from lib/sections.ts. */
function SectionTabs() {
  const pathname = usePathname();
  const t = useT();
  const section = sectionOf(pathname);
  if (!section?.tabs) return null;
  return (
    <nav className="ptabs" aria-label={t(section.key)}>
      {section.tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "on" : undefined} aria-current={pathname === tab.href ? "page" : undefined}>{t(tab.key)}</Link>
      ))}
    </nav>
  );
}

/**
 * Top bar of every desk screen: the section's tabs (or `lead`) on the left, up to a few key
 * figures passed by the screen, and language / theme on the right. One row; figures that do not
 * fit are hidden on narrow screens instead of wrapping over the content.
 */
export function Topbar({ children, controls = true, lead }: { children?: React.ReactNode; controls?: boolean; lead?: React.ReactNode }) {
  return (
    <div className="topbar">
      {lead ?? <SectionTabs />}
      <div className="topbar-ticks">{children}</div>
      {controls && (
        <div className="topbar-ctl">
          <LangSwitch />
          <ThemeToggle />
        </div>
      )}
    </div>
  );
}
