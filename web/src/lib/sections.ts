import type { I18nKey } from "./i18n";

// Five sections in the sidebar; related screens live as tabs inside their section (shown in the
// top bar). Routes stay as they were, so every existing link keeps working.

export type Section = { href: string; key: I18nKey; icon: string; tabs?: { href: string; key: I18nKey }[] };

export const SECTIONS: Section[] = [
  { href: "/cockpit", key: "nav.cockpit", icon: "home" },
  { href: "/approvals", key: "nav.approvals", icon: "lock" },
  {
    href: "/financing", key: "nav.financing", icon: "bars",
    tabs: [{ href: "/financing", key: "tab.options" }, { href: "/scenario", key: "tab.whatif" }],
  },
  {
    href: "/channels", key: "nav.inbox", icon: "chat",
    tabs: [{ href: "/channels", key: "tab.conversations" }, { href: "/documents", key: "tab.documents" }],
  },
  {
    href: "/security", key: "nav.security", icon: "shield",
    tabs: [{ href: "/security", key: "tab.protection" }, { href: "/mission", key: "tab.agent" }],
  },
];

/** The section a route belongs to (a section's own route or one of its tabs). */
export function sectionOf(pathname: string): Section | undefined {
  return SECTIONS.find((s) => s.href === pathname || s.tabs?.some((t) => t.href === pathname));
}
