import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, SailMark, Wordmark } from "./brand";
import { FRAME, Scene, VIEW, type Chapter, type SceneT } from "./Scene";
import { carryFocus } from "./zoom";
import timeline from "./timeline.json";

export const FPS = 30;
export const XFADE = 9; // frames of crossfade between scenes
export const OPEN_S = 3.4;
export const END_S = 3;
const SCENES = timeline.scenes as unknown as SceneT[];
const CHAPTERS = timeline.chapters as Chapter[];

export const frames = (s: number) => Math.round(s * FPS);

/** Frames scene k of `list` overlaps the one before it: a crossfade, or none for a hard cut. */
const overlap = (list: SceneT[], k: number) => (k > 0 && list[k].cut ? 0 : XFADE);

/** At a hard cut the camera (and spotlight) start where the scene before ended, then ease out. */
function withCarry(list: SceneT[], k: number): SceneT {
  const s = list[k];
  if (k === 0 || !s.cut) return s;
  const prev = list[k - 1];
  const c = carryFocus(prev.focus, (frames(prev.duration) - 1) / FPS, VIEW.w, VIEW.h);
  return c ? { ...s, focus: [c, ...s.focus] } : s;
}

/** Length in frames of a cut made of these scenes (crossfades overlap), with its title cards. */
export function cutFrames(ids: string[], opening = true, endCard = true) {
  const list = SCENES.filter((s) => ids.includes(s.id));
  let n = list.reduce((a, s, k) => a + frames(s.duration) - (k > 0 ? overlap(list, k) : 0), 0);
  if (opening) n += frames(OPEN_S) - XFADE;
  if (endCard) n += frames(END_S) - XFADE;
  return n;
}

export const ALL = SCENES.map((s) => s.id);
// The 2:30 cut for slide 4 of the deck: the live run, the plan, the approval and its proof.
export const SHORT = ["s03", "s04", "s05", "s07", "s08", "s09", "s10"];

export function DemoVideo({ ids, opening = true, endCard = true }: { ids: string[]; opening?: boolean; endCard?: boolean }) {
  const list = SCENES.filter((s) => ids.includes(s.id));
  const { fps } = useVideoConfig();
  // where each scene starts in this cut, for the chapter rail
  const starts: number[] = [];
  let at = opening ? frames(OPEN_S) - XFADE : 0;
  list.forEach((s, k) => {
    if (k > 0) at -= overlap(list, k);
    starts.push(at);
    at += frames(s.duration);
  });
  const items = [
    ...(opening ? [{ key: "open", n: frames(OPEN_S), fade: XFADE, el: <Opening /> }] : []),
    ...list.map((s, k) => ({ key: s.id, n: frames(s.duration), fade: k === 0 ? XFADE : overlap(list, k), el: <Scene scene={withCarry(list, k)} chapters={CHAPTERS} /> })),
    ...(endCard ? [{ key: "end", n: frames(END_S), fade: XFADE, el: <EndCard /> }] : []),
  ];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 30%, ${C.navy} 0%, ${C.navyDeep} 55%, ${C.night} 100%)` }}>
      <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y, width: FRAME.w, height: FRAME.h, borderRadius: 12, boxShadow: "0 18px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)" }} />
      <TransitionSeries>
        {items.flatMap((it, i) => [
          i > 0 && it.fade > 0 ? <TransitionSeries.Transition key={`t${it.key}`} presentation={fade()} timing={linearTiming({ durationInFrames: it.fade })} /> : null,
          <TransitionSeries.Sequence key={it.key} durationInFrames={it.n} premountFor={fps}>
            {it.el}
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      <Rail list={list} starts={starts} />
    </AbsoluteFill>
  );
}

/** The story's chapters across the top: where we are, what came before, what is next. */
function Rail({ list, starts }: { list: SceneT[]; starts: number[] }) {
  const frame = useCurrentFrame();
  if (!list.length) return null;
  const lastEnd = starts[starts.length - 1] + frames(list[list.length - 1].duration);
  const o = Math.min(
    interpolate(frame, [starts[0] - 4, starts[0] + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [lastEnd - 14, lastEnd - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  if (o <= 0) return null;
  let cur = 0;
  for (let i = 0; i < starts.length; i++) if (frame >= starts[i] + (i > 0 && list[i].cut ? 0 : XFADE / 2)) cur = i;
  const chapter = list[cur].chapter;
  // progress inside the current chapter: from its first scene's start to its last scene's end
  const inCh = list.map((s, i) => ({ s, i })).filter((x) => x.s.chapter === chapter);
  const c0 = starts[inCh[0].i];
  const c1 = starts[inCh[inCh.length - 1].i] + frames(inCh[inCh.length - 1].s.duration);
  const prog = Math.min(1, Math.max(0, (frame - c0) / (c1 - c0)));
  const used = [...new Set(list.map((s) => s.chapter))];
  const segW = FRAME.w / used.length;
  return (
    <div style={{ position: "absolute", left: FRAME.x, top: 0, width: FRAME.w, height: FRAME.y, display: "flex", opacity: o }}>
      {used.map((ci) => {
        const ch = CHAPTERS[ci];
        const state = ci < chapter ? "done" : ci === chapter ? "now" : "next";
        const fill = state === "done" ? 1 : state === "now" ? prog : 0;
        return (
          <div key={ch.id} style={{ width: segW, height: FRAME.y, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 10px", boxSizing: "border-box", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, opacity: state === "next" ? 0.5 : state === "done" ? 0.72 : 1 }}>
              <span style={{ width: 22, height: 22, borderRadius: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 12, fontWeight: 700, background: state === "now" ? C.gold : "transparent", color: state === "now" ? C.night : C.text, border: state === "now" ? "none" : `1.5px solid ${state === "done" ? C.gold : "rgba(243,245,250,0.6)"}` }}>{ci + 1}</span>
              <span style={{ fontFamily: F.display, fontWeight: state === "now" ? 700 : 600, fontSize: 19, color: state === "now" ? C.text : C.muted, whiteSpace: "nowrap" }}>{ch.en}</span>
            </div>
            <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div style={{ width: `${fill * 100}%`, height: "100%", background: state === "now" ? C.gold : "rgba(201,168,102,0.55)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Opening title, held clean for the thumbnail: the tagline the kit asks to repeat at the start. */
function Opening() {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const rise = interpolate(t, [0, 0.9], [16, 0], { extrapolateRight: "clamp" });
  const o = Math.min(interpolate(t, [0, 0.45], [0.001, 1], { extrapolateRight: "clamp" }), interpolate(t, [OPEN_S - 0.75, OPEN_S - 0.3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  // frame 0 is the thumbnail: start with the card already readable
  const first = frame === 0 ? 1 : o;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${C.navy} 0%, ${C.navyDeep} 60%, ${C.night} 100%)`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: frame === 0 ? 1 : first, transform: `translateY(${frame === 0 ? 0 : rise}px)` }}>
        <SailMark size={120} />
        <Wordmark size={76} />
        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 44, color: C.text, marginTop: 6 }}>NanFeng doesn’t advise. It acts, with your permission.</div>
        <div style={{ fontFamily: F.zh, fontSize: 30, color: "#E6D3A6" }}>南风不只是建议——它在您的授权下行动。</div>
        <div style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginTop: 14 }}>FinTechathon 2026 · Topic E · SME Finance Copilot</div>
      </div>
    </AbsoluteFill>
  );
}

/** Last frame, 3 s: logo, the live URL and the repository. */
function EndCard() {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${C.navy} 0%, ${C.navyDeep} 60%, ${C.night} 100%)`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, opacity: o }}>
        <SailMark size={132} />
        <Wordmark size={84} />
        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 34, color: C.text, marginTop: 4 }}>The AI CFO for exporters · it acts, with your permission</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 26 }}>
          <span style={{ fontFamily: F.mono, fontSize: 36, fontWeight: 600, color: C.text }}>www.nanfengcfo.com</span>
          <span style={{ fontFamily: F.mono, fontSize: 26, color: C.muted }}>github.com/Lilvecp/nanfeng</span>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 19, color: C.muted, marginTop: 30 }}>Universidad del Desarrollo, Chile · Sandbox demo · Huerto Austral is a fictional company · no real funds move</div>
      </div>
    </AbsoluteFill>
  );
}
