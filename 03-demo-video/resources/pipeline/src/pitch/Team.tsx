// The team: five cards with the portraits cut out of their backgrounds (assets/cutouts.py), names on
// screen only (the narration does not read them), then the live URL. CUE: seconds into the takes.
import type React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { sectionFrames, type Section } from "./data";
import { Enter, exitK, float, Grade, Grain, Sfx } from "./fx";
import { theme as T } from "./theme";

const CUE = { five: 1.52, univ: 2.56, url: 2.04 }; // s14-01, s14-01, s14-04-two

// cx, cy: centre of the head in the 800×800 cutout; s: scale that gives every head about the same
// size on its card (Renato's photo is a close-up: a little larger, so his shoulders reach the edge)
const PEOPLE = [
  { file: "valentin", name: "Valentín Castro", role: "Lead & product strategy", cx: 397, cy: 147, s: 0.715 },
  { file: "renato", name: "Renato Lenis", role: "AI agent engineering", cx: 439, cy: 304, s: 0.39 },
  { file: "camilo", name: "Camilo Bufadel", role: "Full-stack & blockchain", cx: 370, cy: 312, s: 0.41 },
  { file: "andy", name: "Andy Villarroel", role: "Security & compliance", cx: 481, cy: 297, s: 0.8 },
  { file: "vicente", name: "Vicente Rodríguez", role: "Quant & data science", cx: 391, cy: 307, s: 0.8 },
];
const CARD = { w: 288, photo: 300, head: { x: 144, y: 128 } };
const display = (size: number, weight = 700): React.CSSProperties => ({ fontFamily: T.fonts.display, fontWeight: weight, fontSize: size, letterSpacing: "-0.02em", lineHeight: 1.05, color: T.colors.text });

export function Team({ s }: { s: Section }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = sectionFrames(s);
  const F = (sec: number) => Math.round(sec * fps);
  const L = s.lines.map((l) => ({ a: F(l.start), b: F(l.end) }));
  const exit = n - T.t.exit - 1;
  const urlAt = L[1].a + F(CUE.url) - 8;
  const url = spring({ frame: f - urlAt, fps, config: T.spring.bouncy });
  const dim = 1 - 0.12 * Math.min(1, url);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 108 }}>
      <Enter at={1} exitAt={exit}>
        <div style={{ display: "flex", gap: 22, alignItems: "baseline" }}>
          <span style={display(76)}>Five students.</span>
          <span style={{ ...display(76), color: T.colors.mist }}>One agent that acts.</span>
        </div>
      </Enter>
      <Enter at={L[0].a + F(CUE.univ) - 10} exitAt={exit} style={{ marginTop: 18 }}>
        <span style={{ fontFamily: T.fonts.mono, fontWeight: 600, fontSize: 25, letterSpacing: "0.14em", textTransform: "uppercase", color: T.colors.text, textShadow: "0 2px 14px rgba(0,0,0,0.45)" }}>
          Universidad del Desarrollo <span style={{ color: T.colors.gold }}>·</span> Chile <span style={{ color: T.colors.gold }}>·</span> FinTechathon 2026
        </span>
      </Enter>
      <div style={{ display: "flex", gap: 24, marginTop: 52, opacity: dim }}>
        {PEOPLE.map((p, i) => <Person key={p.file} p={p} at={L[0].a + F(CUE.five) - 8 + i * T.t.stagger + i} exit={exit} />)}
      </div>
      <Enter at={urlAt} exitAt={exit} config={T.spring.bouncy} style={{ marginTop: 46 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 34px", borderRadius: 999, background: "rgba(14,23,38,0.9)", border: `2px solid ${T.colors.gold}`,
          boxShadow: `0 0 ${60 * url}px ${T.colors.glow}` }}>
          <span style={{ fontFamily: T.fonts.mono, fontSize: 19, letterSpacing: "0.16em", textTransform: "uppercase", color: T.colors.gold }}>Try it in two minutes</span>
          <span style={{ fontFamily: T.fonts.mono, fontWeight: 600, fontSize: 40, color: T.colors.text }}>www.nanfengcfo.com</span>
        </div>
      </Enter>
      <Sfx name="whoosh" at={L[0].a + F(CUE.five) - 8} />
      <Sfx name="pop" at={urlAt + 4} />
      <Grade />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

function Person({ p, at, exit }: { p: (typeof PEOPLE)[number]; at: number; exit: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - at, fps, config: T.spring.smooth });
  const x = exitK(f, exit - 2);
  // Ken Burns on every still: a slow push from the moment the card lands
  const kb = 1 + 0.045 * interpolate(f - at, [0, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: T.ease.inOut });
  const w = 800 * p.s;
  return (
    <div style={{ width: CARD.w, opacity: k * (1 - x), transform: `translateY(${interpolate(k, [0, 1], [60, 0]) - x * 24 + float(f + at * 7, 36, 2.5)}px) scale(${interpolate(k, [0, 1], [0.92, 1])})`,
      borderRadius: 22, overflow: "hidden", background: `linear-gradient(180deg, rgba(31,51,88,0.9), rgba(14,23,38,0.95))`, border: `1.5px solid ${T.colors.cardLine}`, boxShadow: "0 30px 70px rgba(0,0,0,0.38)" }}>
      <div style={{ position: "relative", width: CARD.w, height: CARD.photo, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: CARD.head.x - 120, top: CARD.head.y - 120, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${T.colors.sky}55, transparent 68%)` }} />
        <Img src={staticFile(`team/${p.file}.png`)} style={{ position: "absolute", width: w, height: w, left: CARD.head.x - p.cx * p.s, top: CARD.head.y - p.cy * p.s,
          transformOrigin: `${p.cx * p.s}px ${p.cy * p.s}px`, transform: `scale(${kb})` }} />
      </div>
      <div style={{ padding: "16px 18px 20px", borderTop: `1px solid ${T.colors.cardLine}` }}>
        <div style={{ ...display(30), whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ fontFamily: T.fonts.mono, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: T.colors.gold, marginTop: 8 }}>{p.role}</div>
      </div>
    </div>
  );
}
