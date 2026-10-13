import type { I18nKey } from "./i18n";

// Six sections in the sidebar (the agent's trace is its own: it is what makes "an agent that acts" auditable); related screens live as tabs inside their section (shown in the
// top bar). Routes stay as they were, so every existing link keeps working.

export type Section = { href: string; key: I18nKey; icon: string; tabs?: { href: string; key: I18nKey }[] };

export const SECTIONS: Section[] = [
  { href: "/cockpit", key: "nav.cockpit", icon: "home" },
  { href: "/approvals", key: "nav.approvals", icon: "lock" },
  { href: "/mission", key: "tab.agent", icon: "pulse" },
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
  },
];

/** The section a route belongs to (a section's own route or one of its tabs). */
export function sectionOf(pathname: string): Section | undefined {
  return SECTIONS.find((s) => s.href === pathname || s.tabs?.some((t) => t.href === pathname));
}
