// Title cards. Frame 0 of the opening is the thumbnail, so it starts fully composed and only moves
// (a slow push, the sail breathing) until its staggered exit. The end card lands piece by piece and
// holds: the last frame is complete. No repository link: the repository is private.
import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SailMark, Wordmark } from "../brand";
import { sectionFrames, type Section } from "./data";
import { breathe, Enter, exitK, Grade, Grain, ramp, Sfx } from "./fx";
import { theme as T } from "./theme";

const tagline: React.CSSProperties = { fontFamily: T.fonts.display, fontWeight: 600, fontSize: 48, letterSpacing: "-0.01em", color: T.colors.text };
const kicker: React.CSSProperties = { fontFamily: T.fonts.mono, fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", color: T.colors.gold };

export function Opening({ s }: { s: Section }) {
  const f = useCurrentFrame();
  const n = sectionFrames(s);
  const push = 1 + 0.035 * ramp(f, 0, n, T.ease.inOut);
  // staggered exit, top to bottom
  const out = (i: number) => exitK(f, n - T.t.exit - 8 + i * 2);
  const item = (i: number, el: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ opacity: 1 - out(i), transform: `translateY(${-out(i) * 30}px)`, ...style }}>{el}</div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, transform: `scale(${push})` }}>
        {item(0, <div style={{ transform: `scale(${breathe(f, 18, 0.02)})` }}><SailMark size={128} /></div>)}
        {item(1, <Wordmark size={84} />)}
        {item(2, <div style={tagline}>NanFeng doesn’t advise. It acts, with your permission.</div>, { marginTop: 8 })}
        {item(3, <div lang="zh-CN" style={{ fontFamily: T.fonts.zh, fontSize: 32, color: T.colors.zh }}>南风不止于建议。它在您的授权下行动。</div>)}
        {item(4, <div style={kicker}>FinTechathon 2026 · Topic E · SME Finance Copilot</div>, { marginTop: 16 })}
      </div>
      <Sfx name="whoosh" at={n - T.t.exit - 8} />
      <Grade />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}

export function EndCard({ s }: { s: Section }) {
  const f = useCurrentFrame();
  const n = sectionFrames(s);
  const settle = interpolate(f, [0, n], [1.02, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: T.ease.out });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${settle})` }}>
      <Enter at={0} config={T.spring.bouncy}><SailMark size={136} /></Enter>
      <Enter at={4} style={{ marginTop: 22 }}><Wordmark size={88} /></Enter>
      <Enter at={8} style={{ marginTop: 18 }}><div style={{ ...tagline, fontSize: 38 }}>The AI CFO for exporters · it acts, with your permission</div></Enter>
      <Enter at={13} style={{ marginTop: 40 }}>
        <div style={{ padding: "14px 34px", borderRadius: 999, border: `2px solid ${T.colors.gold}`, boxShadow: `0 0 50px ${T.colors.glow}`, fontFamily: T.fonts.mono, fontWeight: 600, fontSize: 40, color: T.colors.text }}>www.nanfengcfo.com</div>
      </Enter>
      <Enter at={18} style={{ marginTop: 40 }}>
        <div style={{ fontFamily: T.fonts.body, fontSize: 20, color: T.colors.muted }}>Universidad del Desarrollo, Chile · Sandbox demo · Huerto Austral is a fictional company · no real funds move</div>
      </Enter>
      <Grade />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
}
