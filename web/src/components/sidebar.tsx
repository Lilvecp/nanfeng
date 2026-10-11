"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { useCrisisNumbers } from "@/lib/desk-state";
import { useT } from "@/lib/i18n";
import { SECTIONS, sectionOf } from "@/lib/sections";

// Line icons in the spirit of SF Symbols (16px, 1.6 stroke).
const ICONS: Record<string, React.ReactNode> = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10M10 20v-6h4v6" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
  bars: <path d="M4 20h16M7 20v-7M12 20V6M17 20v-10" />,
  chat: <path d="M4 5h12v9H9l-4 3v-3H4zM18 9h2v8h-2v3l-3-3h-4" />,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  gear: <><path d="M18.69 9.93 L20.87 10.48 L20.87 13.52 L18.69 14.07 L18.19 15.27 L19.35 17.20 L17.20 19.35 L15.27 18.19 L14.07 18.69 L13.52 20.87 L10.48 20.87 L9.93 18.69 L8.73 18.19 L6.80 19.35 L4.65 17.20 L5.81 15.27 L5.31 14.07 L3.13 13.52 L3.13 10.48 L5.31 9.93 L5.81 8.73 L4.65 6.80 L6.80 4.65 L8.73 5.81 L9.93 5.31 L10.48 3.13 L13.52 3.13 L14.07 5.31 L15.27 5.81 L17.20 4.65 L19.35 6.80 L18.19 8.73Z" /><circle cx="12" cy="12" r="3" /></>,
};

const Icon = ({ name }: { name: string }) => (
  <span className="ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg></span>
);

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const { pendingCount } = useCrisisNumbers();
  const [open, setOpen] = useState(false);
  const inDemo = pathname === "/demo";
  const current = sectionOf(pathname);

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
      <div className="workspace" title={t("shell.demoNote")}>
        <span className="workspace-eyebrow">{t("shell.demoCompany")}</span>
        <div className="workspace-row">
          <span className="workspace-mark" aria-hidden="true">HA</span>
          <span className="workspace-text"><b>Huerto Austral</b><span>{t("shell.workspace")}</span></span>
        </div>
      </div>
      <nav className="nav" aria-label="App">
        {SECTIONS.map((s) => {
          const on = current?.href === s.href;
          return (
            <Link key={s.href} className={on ? "on" : undefined} href={s.href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}>
              <Icon name={s.icon} />
              {t(s.key)}
              {s.href === "/approvals" && pendingCount > 0 && <span className="count">{pendingCount}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="side-foot">
        <Link className={`side-link${pathname === "/settings" ? " on" : ""}`} href="/settings" onClick={() => setOpen(false)} aria-current={pathname === "/settings" ? "page" : undefined}>
          <Icon name="gear" />{t("nav.settings")}
        </Link>
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
