import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// NanFeng brand, from web/src/styles (private-desk.css, apple-nav.css) and the kit palette.
export const C = {
  night: "#0E1726",
  navy: "#1F3358",
  navyDeep: "#14223D",
  paper: "#F6F6F3",
  ink: "#14171C",
  text: "#F3F5FA",
  muted: "#A3AAB5",
  gold: "#C9A866",
  line: "rgba(255,255,255,0.10)",
};

// Criterion chips on a dark band: the kit's dark-mode palette.
export const CHIP = {
  TC: { color: "#A9BEE6", label: "Task completion" },
  SC: { color: "#EE8A9C", label: "Security & compliance" },
  II: { color: "#D6B676", label: "Innovation & interaction" },
  ON: { color: "#8FCBA3", label: "On-chain" },
} as const;

export const F = {
  display: '"IBM Plex Sans Condensed", "Arial Narrow", sans-serif',
  body: '"IBM Plex Sans", "Noto Sans CJK SC", sans-serif',
  mono: '"JetBrains Mono", "Noto Sans Mono CJK SC", monospace',
  zh: '"Noto Sans CJK SC", "IBM Plex Sans", sans-serif',
};

export const fontsReady = Promise.all([
  loadFont({ family: "IBM Plex Sans", url: staticFile("fonts/ibm-plex-sans-latin-wght-normal.woff2"), weight: "100 700" }),
  loadFont({ family: "IBM Plex Sans", url: staticFile("fonts/ibm-plex-sans-latin-ext-wght-normal.woff2"), weight: "100 700" }),
  loadFont({ family: "IBM Plex Sans Condensed", url: staticFile("fonts/ibm-plex-sans-condensed-latin-600-normal.woff2"), weight: "600" }),
  loadFont({ family: "IBM Plex Sans Condensed", url: staticFile("fonts/ibm-plex-sans-condensed-latin-700-normal.woff2"), weight: "700" }),
  loadFont({ family: "JetBrains Mono", url: staticFile("fonts/jetbrains-mono-latin-wght-normal.woff2"), weight: "100 800" }),
]);

/** The sail logo, light variant for dark backgrounds (apple-nav.css, dark theme). */
export function SailMark({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 560) / 600} viewBox="20 20 600 560">
      <path d="M422,32 C505,120 568,235 586,364 C497,370 410,378 322,388 Z" fill="#f3f5fa" />
      <path d="M380,126 C322,236 250,326 166,388 L290,384 Z" fill="#c9d6f0" />
      <path d="M30,518 C92,436 190,398 300,398 C392,398 458,414 508,422 C462,448 392,466 300,458 C205,450 118,460 30,518 Z" fill="#7fb3d5" />
      <path d="M92,518 C190,474 292,498 398,480 C482,466 546,430 597,394 C568,478 492,557 390,574 C285,590 185,532 92,518 Z" fill="#ee6a80" />
    </svg>
  );
}

export function Wordmark({ size = 64 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: size * 0.28, color: C.text }}>
      <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: size, letterSpacing: "-0.01em" }}>NanFeng</span>
      <span style={{ fontFamily: F.zh, fontWeight: 500, fontSize: size * 0.8, color: "#c9d6f0" }}>南风</span>
    </div>
  );
}
