import { ImageResponse } from "next/og";
import { N } from "@/lib/scenario";

// Link preview for WhatsApp, WeChat, email and social: what NanFeng does and the Cherry Crisis
// numbers in one card. Rendered once at build time; no font or image is fetched.

export const alt = "NanFeng, the AI CFO for exporters";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#1F3358";
const PAPER = "#F6F5F1";
const LOGO = { sail: "#0e2a47", jib: "#17506f", wave: "#155b7c", red: "#c8263a" }; // --logo-* light tokens

export default function Image() {
  const stats: [string, string][] = [
    [`${N.pNeg} → ${N.pNegAfterPlan}`, "chance of running out of cash"],
    [N.savingsPct, "cheaper than the bank loan"],
    [`${N.rtStopped}/${N.rtAttacks}`, "red-team attacks stopped"],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: PAPER, padding: "64px 72px", color: "#14171C" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="60" height="56" viewBox="20 20 600 560">
            <path d="M422,32 C505,120 568,235 586,364 C497,370 410,378 322,388 Z" fill={LOGO.sail} />
            <path d="M380,126 C322,236 250,326 166,388 L290,384 Z" fill={LOGO.jib} />
            <path d="M30,518 C92,436 190,398 300,398 C392,398 458,414 508,422 C462,448 392,466 300,458 C205,450 118,460 30,518 Z" fill={LOGO.wave} />
            <path d="M92,518 C190,474 292,498 398,480 C482,466 546,430 597,394 C568,478 492,557 390,574 C285,590 185,532 92,518 Z" fill={LOGO.red} />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, color: NAVY }}>NanFeng</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>The AI CFO for exporters</div>
          <div style={{ fontSize: 30, color: "#4A5160", lineHeight: 1.3 }}>Sees the cash gap coming, finds the cheapest financing and acts only with the owner&apos;s code.</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {stats.map(([v, l]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", flex: 1, borderTop: `4px solid ${NAVY}`, paddingTop: 16 }}>
              <div style={{ fontSize: 44, fontWeight: 700, color: NAVY }}>{v}</div>
              <div style={{ fontSize: 22, color: "#4A5160" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
