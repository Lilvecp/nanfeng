"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { useCrisisNumbers } from "@/lib/desk-state";
import { useT, type I18nKey } from "@/lib/i18n";

// Line icons in the spirit of SF Symbols (16px, 1.6 stroke).
const ICONS: Record<string, React.ReactNode> = {
  "/cockpit": <path d="M3 13a9 9 0 0 1 18 0M12 13l4-5M5 17h14" />,
  "/mission": <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  "/approvals": <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
  "/financing": <path d="M4 20h16M7 20v-7M12 20V6M17 20v-10" />,
  "/scenario": <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />,
  "/security": <><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  "/channels": <path d="M4 5h12v9H9l-4 3v-3H4zM18 9h2v8h-2v3l-3-3h-4" />,
  "/documents": <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  "/settings": <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
};

// Owner-facing screens first; the agent trace, security console and settings are grouped below.
const NAV: { group: I18nKey; items: { href: string; key: I18nKey }[] }[] = [
  {
    group: "nav.group.business",
    items: [
      { href: "/cockpit", key: "nav.cockpit" },
      { href: "/approvals", key: "nav.approvals" },
      { href: "/financing", key: "nav.financing" },
      { href: "/scenario", key: "nav.scenario" },
      { href: "/channels", key: "nav.channels" },
      { href: "/documents", key: "nav.documents" },
    ],
  },
  {
    group: "nav.group.hood",
    items: [
      { href: "/mission", key: "nav.mission" },
      { href: "/security", key: "nav.security" },
      { href: "/settings", key: "nav.settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const { pendingCount } = useCrisisNumbers();
  const [open, setOpen] = useState(false);
  const inDemo = pathname === "/demo";

  return (
    <aside className={`side${open ? " open" : ""}`} style={{ viewTransitionName: "desk-side" }}>
      <div className="brand">
        <Link href="/" aria-label="NanFeng home" style={{ display: "flex", alignItems: "center", color: "inherit", textDecoration: "none" }}>
          <Logo size={26} />
        </Link>
        <button className="icon-btn side-toggle" type="button" aria-expanded={open} aria-label={t("shell.menu")} onClick={() => setOpen((o) => !o)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      <nav className="nav" aria-label="App">
        {NAV.map((g) => [
          <span key={g.group} className="nav-group">{t(g.group)}</span>,
          ...g.items.map((n) => (
          <Link key={n.href} className={pathname === n.href ? "on" : undefined} href={n.href} onClick={() => setOpen(false)} aria-current={pathname === n.href ? "page" : undefined}>
            <span className="ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[n.href]}</svg></span>
            {t(n.key)}
            {n.href === "/approvals" && pendingCount > 0 && <span className="count">{pendingCount}</span>}
          </Link>
          )),
        ])}
      </nav>
      <div className="side-foot">
        {inDemo ? (
          <span className="badge warn" style={{ alignSelf: "flex-start" }}>Demo · REC</span>
        ) : (
          <Link className="btn btn-secondary btn-sm" href="/demo" onClick={() => setOpen(false)}>{t("shell.demo")}</Link>
        )}
        <span>{t("shell.sandbox")}</span>
      </div>
    </aside>
  );
}
