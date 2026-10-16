"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { S } from "@/lib/scenario";

// Home's short version of /health: the top findings of the quant engine's business analysis.
const COPY: Record<Lang, { title: string; more: string }> = {
  en: { title: "Business health", more: "See the full analysis" },
  es: { title: "Salud del negocio", more: "Ver el análisis completo" },
  zh: { title: "经营健康", more: "查看完整分析" },
};
const DOT: Record<string, string> = { high: "crit", medium: "warn", low: "idle", ok: "" };

export function HealthCard() {
  const lang = useLang();
  const c = COPY[lang];
  return (
    <section className="card owner-card" data-guide="home-health">
      <h2 className="owner-h">{c.title}</h2>
      <ul className="owner-log">
        {S.analysis.insights.slice(0, 3).map((i) => (
          <li key={i.id} style={{ gridTemplateColumns: "12px minmax(0, 1fr)" }}><span className={`dot ${DOT[i.severity] ?? ""}`} aria-hidden style={{ marginTop: 6 }} /><span>{i.text[lang]}</span></li>
        ))}
      </ul>
      <Link className="btn btn-ghost btn-sm" href="/health" style={{ alignSelf: "flex-start" }}>{c.more} →</Link>
    </section>
  );
}
