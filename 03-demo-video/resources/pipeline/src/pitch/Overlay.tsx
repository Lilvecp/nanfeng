// What stays on top of every section: the chapter rail, the subtitles (EN + 中文), the rubric chips
// and, on app shots, where the footage comes from.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CHIP } from "../brand";
import { BAND_TOP, FRAME } from "../Scene";
import { CHAPTERS, FPS, SECTIONS, type Section } from "./data";
import { clamp, ramp } from "./fx";
import { srcAt } from "./Shot";
import { theme as T } from "./theme";

const told = SECTIONS.filter((s) => s.chapter >= 0);
const railFrom = Math.round(told[0].start * FPS);
const railTo = Math.round((told[told.length - 1].start + told[told.length - 1].dur) * FPS);

/** The story's chapters across the top: where we are, what came before, what is next. */
export function Rail() {
  const frame = useCurrentFrame();
  const o = Math.min(ramp(frame, railFrom - 2, railFrom + 12), 1 - ramp(frame, railTo - 12, railTo - 1, T.ease.in));
  if (o <= 0) return null;
  const t = frame / FPS;
  const cur = [...told].reverse().find((s) => t >= s.start) ?? told[0];
  const chapter = cur.chapter;
  const inCh = told.filter((s) => s.chapter === chapter);
  const c0 = inCh[0].start, c1 = inCh[inCh.length - 1].start + inCh[inCh.length - 1].dur;
  const prog = Math.min(1, Math.max(0, (t - c0) / (c1 - c0)));
  const segW = FRAME.w / CHAPTERS.length;
  return (
    <div style={{ position: "absolute", left: FRAME.x, top: 0, width: FRAME.w, height: FRAME.y, display: "flex", opacity: o }}>
      {CHAPTERS.map((ch, ci) => {
        const state = ci < chapter ? "done" : ci === chapter ? "now" : "next";
        const fill = state === "done" ? 1 : state === "now" ? prog : 0;
        return (
          <div key={ch.id} style={{ width: segW, height: FRAME.y, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 10px", boxSizing: "border-box", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, opacity: state === "next" ? 0.5 : state === "done" ? 0.72 : 1 }}>
              <span style={{ width: 22, height: 22, borderRadius: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: T.fonts.mono, fontSize: 12, fontWeight: 700,
                background: state === "now" ? T.colors.gold : "transparent", color: state === "now" ? T.colors.night : T.colors.text, border: state === "now" ? "none" : `1.5px solid ${state === "done" ? T.colors.gold : "rgba(243,245,250,0.6)"}` }}>{ci + 1}</span>
              <span style={{ fontFamily: T.fonts.display, fontWeight: state === "now" ? 700 : 600, fontSize: 19, color: state === "now" ? T.colors.text : T.colors.muted, whiteSpace: "nowrap" }}>{ch.en}</span>
            </div>
            <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div style={{ width: `${fill * 100}%`, height: "100%", background: state === "now" ? T.colors.gold : "rgba(201,168,102,0.55)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CUES = SECTIONS.flatMap((s) => s.lines.map((l) => ({ ...l, start: s.start + l.start, end: s.start + l.end })));

export function Subtitles() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const i = CUES.findIndex((l, k) => t >= l.start - 0.08 && t < Math.min(l.end + 0.35, (CUES[k + 1]?.start ?? Infinity) - 0.08));
  if (i < 0) return null;
  const l = CUES[i];
  const hide = Math.min(l.end + 0.35, (CUES[i + 1]?.start ?? Infinity) - 0.08);
  const o = interpolate(t, [l.start - 0.08, l.start + 0.08, hide - 0.15, hide], [0, 1, 1, 0], clamp);
  const rise = interpolate(t, [l.start - 0.08, l.start + 0.16], [8, 0], { ...clamp, easing: T.ease.out });
  return (
    <div style={{ position: "absolute", left: 300, right: 300, top: BAND_TOP + 6, height: 1080 - BAND_TOP - 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, opacity: o, transform: `translateY(${rise}px)`, textAlign: "center" }}>
      <div style={{ fontFamily: T.fonts.body, fontWeight: 500, fontSize: 28, lineHeight: 1.22, color: T.colors.text, letterSpacing: "0.003em", textWrap: "balance" }}>{l.en}</div>
      <div lang="zh-CN" style={{ fontFamily: T.fonts.zh, fontWeight: 400, fontSize: 24, lineHeight: 1.3, color: T.colors.zh }}>{l.zh}</div>
    </div>
  );
}

const same = (a?: Section, b?: Section) => !!a && !!b && a.chips.join() === b.chips.join();

/** Rubric criteria of a section, bottom left; they only animate when they change. */
export function Chips({ s, prev, next }: { s: Section; prev?: Section; next?: Section }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!s.chips.length) return null;
  const x = same(s, next) ? 0 : ramp(frame, durationInFrames - 8, durationInFrames - 1, T.ease.in);
  return (
    <div style={{ position: "absolute", left: 18, top: BAND_TOP, height: 1080 - BAND_TOP, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 7 }}>
      {s.chips.map((c, i) => {
        const p = same(prev, s) ? 1 : spring({ frame: frame - 4 - i * 4, fps, config: T.spring.snappy });
        return (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: CHIP[c].color, color: T.colors.night, borderRadius: 999, padding: "5px 14px 5px 6px", whiteSpace: "nowrap", lineHeight: 1,
            opacity: p * (1 - x), transform: `translateX(${interpolate(p, [0, 1], [-24, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})` }}>
            <span style={{ fontFamily: T.fonts.mono, fontWeight: 800, fontSize: 15, background: T.colors.night, color: CHIP[c].color, borderRadius: 999, padding: "4px 7px" }}>{c}</span>
            <span style={{ fontFamily: T.fonts.display, fontWeight: 700, fontSize: 19 }}>{CHIP[c].label}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Where the footage comes from: the live deploy, or the public block explorer. */
export function Source({ s }: { s: Section }) {
  const frame = useCurrentFrame();
  const t = srcAt(s, frame / FPS);
  const eth = s.marks?.find((m) => m.name === "etherscan")?.t;
  const onChain = eth !== undefined && t >= eth - 0.1;
  return (
    <div style={{ position: "absolute", right: 22, top: BAND_TOP, height: 1080 - BAND_TOP, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 5 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.fonts.mono, fontSize: 14, letterSpacing: "0.1em", color: T.colors.green }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: T.colors.green, boxShadow: `0 0 10px ${T.colors.green}` }} />
        {onChain ? "PUBLIC TESTNET" : "LIVE SITE"}
      </span>
      <span style={{ fontFamily: T.fonts.mono, fontSize: 17, color: T.colors.text }}>{onChain ? "sepolia.etherscan.io" : "nanfengcfo.com"}</span>
    </div>
  );
}
