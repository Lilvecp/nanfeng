import { ImageResponse } from "next/og";
import { N, clpM } from "@/lib/scenario";

// Link preview for WhatsApp, email and social cards (1200×630, rendered at build time).
// Numbers come from the same scenario file as the site.

export const alt = "NanFeng, the AI CFO for exporters: 81% chance a Chilean cherry exporter runs out of cash in 19 days";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#1F3358";
const CHERRY = "#E0607A";
const INK = "#F3F3EF";
const MUTED = "#B9C3D6";

export default function OpengraphImage() {
  const stats: [string, string, boolean][] = [
    [N.pNeg, "chance cash runs out", true],
    [`${N.crunchDay} days`, "to the harvest payroll", false],
    [clpM(N.gapClp), "gap to cover", false],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: NAVY, color: INK, padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="54" height="54" viewBox="0 0 24 24"><path d="M12 2 L19 18 H5 Z" fill={INK} /><path d="M3 20 Q12 24 21 20" stroke={CHERRY} strokeWidth="2" fill="none" /></svg>
            <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>NanFeng</span>
          </div>
          <span style={{ fontSize: 24, color: MUTED, letterSpacing: 2 }}>SANTIAGO → SHANGHAI</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>The AI CFO for exporters.</span>
          <span style={{ fontSize: 30, color: MUTED, lineHeight: 1.3, maxWidth: 980 }}>
            Sees the cash gap coming, finds the cheapest financing and acts only with the owner&apos;s code.
          </span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {stats.map(([v, l, hot]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", flex: 1, padding: "22px 26px", borderRadius: 18, background: "rgba(255,255,255,0.08)", borderLeft: hot ? `6px solid ${CHERRY}` : "6px solid rgba(255,255,255,0.18)" }}>
              <span style={{ fontSize: 54, fontWeight: 700, color: hot ? CHERRY : INK }}>{v}</span>
              <span style={{ fontSize: 24, color: MUTED }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
