// The results and the tagline: three measured numbers land on the words that say them, then the
// deck's line, "NanFeng doesn't advise. It acts, with your permission.", fills the screen.
// CUE: seconds into public/audio/s13-01.mp3 (Whisper word timestamps).
import type React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SailMark } from "../brand";
import { sectionFrames, type Section } from "./data";
import { breathe, Counter, Enter, exitK, float, Grade, Grain, ramp, Sfx, Words } from "./fx";
import { theme as T } from "./theme";

const CUE = { fifty: 0.46, all: 3.22, pct: 7.86 }; // s13-01-25 (v3 take)
const display = (size: number, weight = 700): React.CSSProperties => ({ fontFamily: T.fonts.display, fontWeight: weight, fontSize: size, letterSpacing: "-0.02em", lineHeight: 1.05, color: T.colors.text });

export function Results({ s }: { s: Section }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = sectionFrames(s);
  const F = (sec: number) => Math.round(sec * fps);
  const L = s.lines.map((l) => ({ a: F(l.start), b: F(l.end) }));
  const at = (cue: number) => L[0].a + F(cue);
  const outA = L[1].a - 10; // the numbers leave as the tagline begins
  const glow1 = ramp(f, at(CUE.all) - 2, at(CUE.all) + 8) * (1 - ramp(f, at(CUE.pct) - 6, at(CUE.pct) + 2));
  const glow2 = ramp(f, at(CUE.pct) - 2, at(CUE.pct) + 8);
  const card = (enterAt: number, glow: number, big: React.ReactNode, label: string) => (
    <Enter at={enterAt} exitAt={outA}>
      <div style={{ width: 470, height: 330, borderRadius: 26, background: T.colors.card, border: `1.5px solid ${glow > 0.05 ? `rgba(201,168,102,${0.25 + 0.55 * glow})` : T.colors.cardLine}`,
        boxShadow: `0 30px 70px rgba(0,0,0,0.35), 0 0 ${70 * glow}px rgba(201,168,102,${0.35 * glow})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18,
        transform: `translateY(${float(f + enterAt, 32, 3)}px)` }}>
        {big}
        <span style={{ fontFamily: T.fonts.body, fontSize: 27, color: T.colors.muted, textAlign: "center", maxWidth: 380, lineHeight: 1.3 }}>{label}</span>
      </div>
    </Enter>
  );
  const num = (glow: number): React.CSSProperties => ({ ...display(150), color: glow > 0.5 ? T.colors.gold : T.colors.text, textShadow: glow > 0.05 ? `0 0 ${50 * glow}px ${T.colors.glow}` : undefined });
  const showA = f <= outA + T.t.exit + 1;
  return (
    <AbsoluteFill>
      {showA ? (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
          <Enter at={2} exitAt={outA}><span style={{ fontFamily: T.fonts.mono, fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase", color: T.colors.gold }}>NanFeng-Bench · 50 synthetic cases</span></Enter>
          <Enter at={5} exitAt={outA} style={{ marginTop: 22 }}><span style={display(88)}>Measured, not promised.</span></Enter>
          <div style={{ display: "flex", gap: 40, marginTop: 70 }}>
            {card(at(CUE.fifty) - 5, glow1, <span style={num(glow1)}><Counter at={at(CUE.fifty)} to={50} /><span style={{ color: T.colors.muted, fontSize: 90 }}>/50</span></span>, "benchmark cases solved")}
            {card(at(CUE.pct) - 8, glow2, <span style={num(glow2)}><Counter at={at(CUE.pct) - 2} to={41} prefix="−" suffix="%" /></span>, "cheaper than the bank loan, on the 25 cases that needed financing")}
            {card(at(CUE.pct) + 4, 0, <span style={num(0)}>46<span style={{ color: T.colors.muted, fontSize: 90 }}>/46</span></span>, "of our own red-team attacks stopped")}
          </div>
          <Sfx name="pop" at={at(CUE.all)} />
          <Sfx name="pop" at={at(CUE.pct)} />
        </AbsoluteFill>
      ) : null}
      <Tagline a={L[1].a} b={L[2].a} exit={n - T.t.exit - 1} />
      <Sfx name="whoosh" at={L[1].a - 4} />
      <Grade />
      <Grain opacity={0.055} />
    </AbsoluteFill>
  );
}

function Tagline({ a, b, exit }: { a: number; b: number; exit: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < a - 4) return null;
  // the hero word: a gold bar slides in under "acts," five frames after it lands
  const actsAt = b + 3;
  const bar = spring({ frame: f - actsAt - 5, fps, config: T.spring.smooth });
  const x = exitK(f, exit);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 130, transform: `scale(${breathe(f, 40, 0.006)})` }}>
      <Enter at={a - 4} exitAt={exit} config={T.spring.bouncy}><SailMark size={96} /></Enter>
      <Words text="NanFeng doesn’t advise." at={a - 2} exitAt={exit} style={{ ...display(124), marginTop: 34 }} />
      <Words text="It acts, with your permission." at={b - 2} exitAt={exit} style={{ ...display(124), marginTop: 18 }}
        mark={(w) => (w === "acts," ? { color: T.colors.gold, textShadow: `0 0 60px ${T.colors.glow}`, position: "relative", backgroundImage: `linear-gradient(${T.colors.gold}, ${T.colors.gold})`,
          backgroundRepeat: "no-repeat", backgroundPosition: "0 96%", backgroundSize: `${bar * 100}% 8px`, paddingBottom: 6 } : undefined)} />
      <div lang="zh-CN" style={{ fontFamily: T.fonts.zh, fontSize: 46, color: T.colors.zh, marginTop: 34, opacity: ramp(f, b + 12, b + 26) * (1 - x), transform: `translateY(${interpolate(ramp(f, b + 12, b + 26), [0, 1], [16, 0])}px)` }}>
        南风不止于建议。它在您的授权下行动。
      </div>
    </AbsoluteFill>
  );
}
