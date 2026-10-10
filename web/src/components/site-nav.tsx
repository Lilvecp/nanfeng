"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { LangSwitch, ThemeToggle } from "@/components/topbar";
import { useT, type I18nKey } from "@/lib/i18n";

const LINKS: { id: string; key: I18nKey }[] = [
  { id: "top", key: "lp.nav.product" },
  { id: "how", key: "lp.nav.how" },
  { id: "channels", key: "lp.nav.channels" },
  { id: "security", key: "lp.nav.security" },
  { id: "team", key: "lp.nav.team" },
];

/** Landing navigation in the apple.com manner: thin frosted bar, quiet centered links, full-screen menu on phones. */
export function SiteNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("top");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the section in view.
  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // Lock the page behind the open menu; Escape closes it.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className={`site-nav${scrolled || open ? " scrolled" : ""}`}>
        <div className="inner">
          <a className="home" href="#top" aria-label="NanFeng home" onClick={() => setOpen(false)}>
            <Logo size={24} stacked={false} />
          </a>
          <nav className="links" aria-label="Primary">
            {LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} aria-current={active === l.id ? "true" : undefined}>{t(l.key)}</a>
            ))}
          </nav>
          <div className="actions">
            <span className="desk-only"><LangSwitch /></span>
            <span className="desk-only"><ThemeToggle /></span>
            <Link className="pill-sm" href="/cockpit">{t("lp.signin")}</Link>
            <button className="burger" type="button" aria-label={t("shell.menu")} aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
              <span /><span />
            </button>
          </div>
        </div>
      </header>
      <nav id="site-menu" className={`site-menu${open ? " open" : ""}`} aria-label="Menu" aria-hidden={!open} inert={!open}>
        {LINKS.map((l, i) => (
          <a key={l.id} href={`#${l.id}`} style={{ "--i": i } as React.CSSProperties} onClick={() => setOpen(false)}>{t(l.key)}</a>
        ))}
        <Link href="/demo" style={{ "--i": LINKS.length } as React.CSSProperties} onClick={() => setOpen(false)}>{t("lp.cta.demo")}</Link>
        <div className="menu-foot">
          <LangSwitch />
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
