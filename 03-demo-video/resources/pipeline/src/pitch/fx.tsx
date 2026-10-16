// Building blocks of the pitch cut's look: the moving background, grade, grain and vignette, and the
// entrance/exit helpers every motion-graphics element goes through (springs and eased curves only).
import { Audio } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme as T } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 between frames a and b on an eased curve (never linear). */
export const ramp = (f: number, a: number, b: number, easing: (x: number) => number = T.ease.out) =>
  b <= a ? (f >= a ? 1 : 0) : interpolate(f, [a, b], [0, 1], { ...clamp, easing });

/** Seconds → frames at the composition's rate. */
export function useSec() {
  const { fps } = useVideoConfig();
  return (s: number) => Math.round(s * fps);
}

/** Exit progress: 0 until `at`, 1 after `at` + the exit length (exits are faster than entrances). */
export const exitK = (f: number, at: number | undefined, len: number = T.t.exit) => (at === undefined ? 0 : ramp(f, at, at + len, T.ease.in));

type EnterProps = {
  at: number; exitAt?: number; rise?: number; from?: number; config?: { damping: number; stiffness: number; mass: number };
  style?: React.CSSProperties; children: React.ReactNode;
};
/** Entrance with three properties at once (opacity, rise, scale); exit up and out. Frames. */
export function Enter({ at, exitAt, rise = 34, from = 0.94, config = T.spring.smooth, style, children }: EnterProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config });
  const x = exitK(frame, exitAt);
  return (
    <div style={{ opacity: p * (1 - x), transform: `translateY(${interpolate(p, [0, 1], [rise, 0]) - x * 26}px) scale(${interpolate(p, [0, 1], [from, 1]) - x * 0.03})`, ...style }}>
      {children}
    </div>
  );
}

/** A line of text that lands word by word. `mark` styles one word (the highlighted one). Frames. */
export function Words({ text, at, exitAt, per = T.t.words, style, mark }: {
  text: string; at: number; exitAt?: number; per?: number; style?: React.CSSProperties; mark?: (w: string, i: number) => React.CSSProperties | undefined;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = exitK(frame, exitAt);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.24em", ...style, opacity: 1 - x, transform: `translateY(${-x * 24}px)` }}>
      {text.split(" ").map((w, i) => {
        const p = spring({ frame: frame - at - i * per, fps, config: T.spring.snappy });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [28, 0])}px) scale(${interpolate(p, [0, 1], [0.96, 1])})`, ...mark?.(w, i) }}>
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** A number that counts up to `to` with a spring, digits at fixed width. Frames. */
export function Counter({ at, to, decimals = 0, style, prefix = "", suffix = "" }: {
  at: number; to: number; decimals?: number; style?: React.CSSProperties; prefix?: string; suffix?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: T.spring.count });
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{prefix}{(to * p).toFixed(decimals)}{suffix}</span>;
}

/** Slow sine micro-motion for anything that stays on screen for more than two seconds. */
export const breathe = (f: number, period = 26, amp = 0.012) => 1 + Math.sin(f / period) * amp;
export const float = (f: number, period = 34, amp = 3) => Math.sin(f / period) * amp;

/** The background: navy base with three soft blobs drifting (never a flat colour). */
export function BgMesh() {
  const f = useCurrentFrame();
  const d1 = Math.sin(f / 70) * 60, d2 = Math.cos(f / 90) * 50, d3 = Math.sin(f / 110 + 1) * 40;
  const blob = (s: React.CSSProperties) => <div style={{ position: "absolute", borderRadius: "50%", ...s }} />;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 30%, ${T.colors.navy} 0%, ${T.colors.navyDeep} 55%, ${T.colors.night} 100%)`, overflow: "hidden" }}>
      {blob({ width: 1300, height: 1300, top: -620, left: -380 + d1, filter: "blur(60px)", background: `radial-gradient(circle, ${T.colors.sky}2e, transparent 62%)` })}
      {blob({ width: 1100, height: 1100, bottom: -560, right: -320 - d2, filter: "blur(70px)", background: `radial-gradient(circle, ${T.colors.gold}26, transparent 64%)` })}
      {blob({ width: 800, height: 800, top: 260 + d3, left: 1180, filter: "blur(80px)", background: `radial-gradient(circle, ${T.colors.coral}14, transparent 66%)` })}
    </AbsoluteFill>
  );
}

/** Colour grade over motion graphics (not over the app footage, whose UI must stay true). */
export function Grade() {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: T.colors.navy, mixBlendMode: "soft-light", opacity: 0.2 }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12), transparent 26%, transparent 74%, rgba(0,0,0,0.18))" }} />
    </AbsoluteFill>
  );
}

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;
/** Film grain, moving every frame. */
export function Grain({ opacity = 0.05 }: { opacity?: number }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: NOISE, backgroundSize: "240px", backgroundPosition: `${(f * 37) % 240}px ${(f * 61) % 240}px`, opacity, mixBlendMode: "overlay" }} />;
}

export function Vignette({ strength = 0.32 }: { strength?: number }) {
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,${strength}) 100%)` }} />;
}

/** A sound from the synthesised kit (public/sfx), `lead` frames before the visual it belongs to. */
export function Sfx({ name, at, lead = 2 }: { name: keyof typeof T.sfx; at: number; lead?: number }) {
  if (process.env.REMOTION_SFX === "0") return null;
  return (
    <Sequence from={Math.max(0, at - lead)} durationInFrames={30} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={T.sfx[name]} />
    </Sequence>
  );
}
