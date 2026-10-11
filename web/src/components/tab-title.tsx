"use client";

import { useT, type I18nKey } from "@/lib/i18n";

/** A translated page title, for screens that do not otherwise use the dictionary. */
export function TabTitle({ k }: { k: I18nKey }) {
  const t = useT();
  return <>{t(k)}</>;
}
