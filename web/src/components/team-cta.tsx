"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export const TEAM_IDS = ["valentin", "renato", "camilo", "andy", "vicente"] as const;
const LABEL = { en: "Meet the team", es: "Conoce al equipo", zh: "认识团队" } as const;

/** The call to the About page: the five faces plus a pulsing cherry pill. `compact` for tight bars. */
export function TeamCta({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  const lang = useLang();
  return (
    <Link href="/nosotros" className={`team-cta${compact ? " compact" : ""}`} onClick={onClick}>
      <span className="team-cta-faces" aria-hidden="true">
        {TEAM_IDS.map((id, i) => (
          <Image key={id} src={`/team/${id}.jpg`} alt="" width={64} height={64} quality={80} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </span>
      <span className="team-cta-label">{LABEL[lang]}</span>
      <svg className="team-cta-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </Link>
  );
}
