// An app shot of the pitch cut: pieces of one recorded scene played in order on the screen frame, with
// the recorder's zooms, spotlight, 4× badge and callouts evaluated on the scene's own clock, so they
// line up with the footage exactly as in the full demo. Pieces may run faster (rate), and a piece can
// open with a hard cut or a short blink to the next page.
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Callouts, FastForward, FRAME, Spotlight, VIEW, type SceneT } from "../Scene";
import { camera, RAMP, type Cam, type Focus } from "../zoom";
import { CHAPTERS, FPS, sectionFrames, type Piece, type Section } from "./data";
import { clamp, ramp } from "./fx";
import { theme as T } from "./theme";

const K = FRAME.w / VIEW.w;

/** Scene time shown at `t` seconds into the section (the pieces' clock mapping). */
export function srcAt(s: Section, t: number) {
  const ps = s.pieces ?? [];
  let p = ps[0];
  for (const x of ps) if (t >= x.at - 1e-6) p = x;
  return p.from + (t - p.at) * p.rate;
}

/** Across a hard cut on the same page, where the camera of the shot before ended. */
function carryCam(s: Section, prev?: Section): Cam | null {
  if (s.join !== "cut" || prev?.kind !== "shot" || !prev.pieces || !prev.focus) return null;
  const last = prev.pieces[prev.pieces.length - 1];
  return camera(prev.focus, last.to - 1 / FPS, VIEW.w, VIEW.h);
}

/** 0 → 1 → 0 across every camera hold longer than 2 s (a zoom that holds, or the wide view between
 * zooms): the screen keeps moving a little while the narration explains it. Scene clock. */
function holdBump(focus: Focus[], t: number): { k: number; wide: boolean } {
  const fs = [...focus].sort((a, b) => a.t - b.t);
  const bump = (a: number, b: number) => (t >= a && t <= b && b - a > 2 ? Math.sin((Math.PI * (t - a)) / (b - a)) : 0);
  let prevEnd = 0;
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    const e = Math.min(f.t + f.dur, fs[i + 1]?.t ?? Infinity);
    const wide = bump(i === 0 ? 0 : prevEnd + RAMP, f.t);
    if (wide > 0) return { k: wide, wide: true };
    const held = bump(f.t + RAMP, e);
    if (held > 0) return { k: held, wide: false };
    prevEnd = e;
  }
  return { k: bump(fs.length ? prevEnd + RAMP : 0, 1e6), wide: true };
}

function pushCam(c: Cam, amount: number): Cam {
  if (amount <= 0) return c;
  const cx = c.lx + VIEW.w / c.s / 2, cy = c.ly + VIEW.h / c.s / 2;
  const sc = c.s * (1 + amount);
  return { s: sc, lx: Math.min(Math.max(cx - VIEW.w / sc / 2, 0), VIEW.w - VIEW.w / sc), ly: Math.min(Math.max(cy - VIEW.h / sc / 2, 0), VIEW.h - VIEW.h / sc) };
}

/** From camera a to camera b: the log of the scale and the centre of the view move together. */
function blendCam(a: Cam, b: Cam, k: number): Cam {
  const c = (x: Cam) => ({ cx: x.lx + VIEW.w / x.s / 2, cy: x.ly + VIEW.h / x.s / 2 });
  const ca = c(a), cb = c(b);
  const sc = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k);
  const cx = ca.cx + (cb.cx - ca.cx) * k, cy = ca.cy + (cb.cy - ca.cy) * k;
  return { s: sc, lx: Math.min(Math.max(cx - VIEW.w / sc / 2, 0), VIEW.w - VIEW.w / sc), ly: Math.min(Math.max(cy - VIEW.h / sc / 2, 0), VIEW.h - VIEW.h / sc) };
}

export function Shot({ s, prev, next }: { s: Section; prev?: Section; next?: Section }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = sectionFrames(s);
  const focus = s.focus ?? [];
  const carry = carryCam(s, prev);
  const fromMg = !prev || prev.kind !== "shot";
  const toMg = !next || next.kind !== "shot";
  const dipIn = s.join !== "cut";
  const dipOut = !!next && next.join !== "cut";

  // how the screen arrives: from a motion-graphics scene it rises in; on a new page it blinks in
  let o = 1, sc = 1, y = 0, blur = 0;
  if (dipIn && fromMg) {
    const p = spring({ frame, fps, config: T.spring.smooth });
    o = Math.min(1, p * 1.4); sc = interpolate(p, [0, 1], [0.93, 1]); y = interpolate(p, [0, 1], [46, 0]);
  } else if (dipIn) {
    const k = ramp(frame, 0, T.t.dipIn);
    o = k; sc = interpolate(k, [0, 1], [1.018, 1]); blur = (1 - k) * 7;
  }
  if (dipOut) {
    const k = ramp(frame, n - (toMg ? T.t.exit : T.t.dipOut), n - 1, T.ease.in);
    o *= 1 - k; sc *= toMg ? 1 - k * 0.05 : 1 - k * 0.012; blur += k * (toMg ? 4 : 6); y -= toMg ? k * 24 : 0;
  }
  const pieces = s.pieces ?? [];
  const scene = { id: s.scene, focus, marks: s.marks ?? [], speed: s.speed ?? [], notes: s.notes ?? {}, duration: s.clip ?? s.dur, clip: s.clip } as unknown as SceneT;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y, width: FRAME.w, height: FRAME.h, borderRadius: 12, overflow: "hidden", background: T.colors.paper,
        boxShadow: "0 24px 70px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.08)", opacity: o, transform: `translateY(${y}px) scale(${sc})`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
        {pieces.map((p, i) => {
          const a = Math.round(p.at * fps);
          const b = i + 1 < pieces.length ? Math.round(pieces[i + 1].at * fps) : n;
          return (
            <Sequence key={i} from={a} durationInFrames={b - a} layout="none">
              <PieceView scene={scene} video={s.video!} clip={s.clip ?? 0} p={p} carry={i === 0 ? carry : null} frames={b - a} dipIn={i > 0 && p.join === "dip"} dipOut={i + 1 < pieces.length && pieces[i + 1].join === "dip"} />
            </Sequence>
          );
        })}
        <Caption s={s} />
      </div>
    </AbsoluteFill>
  );
}

function PieceView({ scene, video, clip, p, carry, frames, dipIn, dipOut }: { scene: SceneT; video: string; clip: number; p: Piece; carry: Cam | null; frames: number; dipIn: boolean; dipOut: boolean }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = p.from + (f / fps) * p.rate; // scene clock
  const own = camera(scene.focus, t, VIEW.w, VIEW.h);
  // a hard cut starts on the camera the shot before ended on, then eases into this shot's own
  const moved = carry && t < p.from + RAMP ? blendCam(carry, own, T.ease.inOut(Math.max(0, (t - p.from) / RAMP))) : own;
  const hold = holdBump(scene.focus, t);
  const cam = pushCam(moved, hold.k * (hold.wide ? 0.022 : 0.03));
  const mark = (name: string) => scene.marks.find((m) => m.name === name)?.t;
  const first = Math.round(p.from * fps);
  // past the end of the recording, hold its last frame
  const lastLocal = Math.floor((Math.round(clip * fps) - 1 - first) / p.rate);
  // a spotlight on the page before a page change (the audit row, before Etherscan) ends with that page
  const eth = mark("etherscan");
  const spotScene = eth === undefined ? scene : { ...scene, focus: scene.focus.map((x) => (x.spot && x.t < eth && x.t + x.dur > eth - 0.5 ? { ...x, dur: Math.max(0.1, eth - 0.5 - x.t) } : x)) };
  const shade = Math.max(dipIn ? 1 - ramp(f, 0, T.t.dipIn) : 0, dipOut ? ramp(f, frames - T.t.dipOut, frames - 1, T.ease.in) : 0);
  return (
    <AbsoluteFill>
      <Freeze frame={Math.max(0, Math.min(f, lastLocal))} active={f > lastLocal}>
        <OffthreadVideo src={staticFile(video)} muted trimBefore={first} playbackRate={p.rate}
          style={{ position: "absolute", left: 0, top: 0, width: FRAME.w, height: FRAME.h, transformOrigin: "0 0", transform: `scale(${cam.s}) translate(${-cam.lx * K}px, ${-cam.ly * K}px)` }} />
      </Freeze>
      <Spotlight scene={spotScene} t={t} cam={cam} />
      <FastForward scene={scene} t={t} />
      <Callouts scene={scene} t={t} mark={mark} />
      {shade > 0 ? <AbsoluteFill style={{ background: T.colors.night, opacity: shade }} /> : null}
    </AbsoluteFill>
  );
}

/** What the viewer is looking at, for a few seconds when the section starts. */
function Caption({ s }: { s: Section }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!s.caption || s.chapter < 0) return null;
  const at = Math.round(0.35 * fps);
  const p = spring({ frame: frame - at, fps, config: T.spring.smooth });
  const x = ramp(frame, Math.round(3.9 * fps), Math.round(3.9 * fps) + T.t.exit, T.ease.in);
  const o = p * (1 - x);
  if (o <= 0.001) return null;
  const ch = CHAPTERS[s.chapter];
  const kicker = s.chapterStart ? `Step ${s.chapter + 1} of ${CHAPTERS.length} · ${ch.en}` : ch.en;
  return (
    <div style={{ position: "absolute", left: 22, bottom: 22, opacity: o, transform: `translateY(${interpolate(p, [0, 1], [18, 0], clamp) + x * 10}px) scale(${interpolate(p, [0, 1], [0.97, 1], clamp)})`, transformOrigin: "0 100%",
      background: "rgba(14,23,38,0.93)", borderLeft: `5px solid ${T.colors.gold}`, borderRadius: 10, padding: "14px 22px 14px 18px", display: "flex", flexDirection: "column", gap: 5, boxShadow: "0 10px 34px rgba(0,0,0,0.3)", maxWidth: 900 }}>
      <span style={{ fontFamily: T.fonts.mono, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: T.colors.gold }}>{kicker}</span>
      <span style={{ fontFamily: T.fonts.body, fontWeight: 600, fontSize: 27, color: T.colors.text, lineHeight: 1.2 }}>{s.caption.en}</span>
      <span lang="zh-CN" style={{ fontFamily: T.fonts.zh, fontSize: 20, color: T.colors.zh }}>{s.caption.zh}</span>
    </div>
  );
}
