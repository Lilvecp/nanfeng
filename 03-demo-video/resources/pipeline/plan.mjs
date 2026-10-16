// Timeline of the video: when each narration line starts and ends inside its scene, and how long
// each scene lasts. The recorder schedules its clicks on this timeline and the compositor plays
// the voice and the subtitles on it, so picture, voice and subtitles stay in sync.
import fs from "node:fs";
import { SCENES, CHAPTERS, HEAD_S, TAIL_S, GAP_S, OPEN_S, END_S, estimateSeconds } from "./scenes.mjs";

const TIMING = new URL("./public/audio/timing.json", import.meta.url);
const XFADE_S = 0.3; // crossfade between scenes (Video.tsx XFADE frames / FPS)

/** Narration lengths from the generated voice track, or estimates while there is none. */
function lineDurations() {
  const tts = fs.existsSync(TIMING) ? JSON.parse(fs.readFileSync(TIMING, "utf8")) : {};
  return Object.fromEntries(SCENES.map((s) => [s.id, s.lines.map((l, i) => tts[s.id]?.[i]?.dur ?? estimateSeconds(l.say))]));
}

export function buildTimeline() {
  const durs = lineDurations();
  const voiced = fs.existsSync(TIMING);
  const scenes = SCENES.map((s, k) => {
    let t = HEAD_S;
    const lines = s.lines.map((l, i) => {
      const start = Math.max(t, l.at ?? 0);
      const end = start + durs[s.id][i];
      t = end + GAP_S;
      return { ...l, start: round(start), end: round(end), audio: voiced ? `audio/${s.id}-${String(i + 1).padStart(2, "0")}.mp3` : null };
    });
    const last = lines[lines.length - 1].end;
    const duration = round(Math.max(last + TAIL_S, s.minDur ?? 0));
    const chapter = CHAPTERS.findIndex((c) => c.id === s.chapter);
    const chapterStart = k === 0 || SCENES[k - 1].chapter !== s.chapter;
    return { id: s.id, title: s.title, chips: s.chips, caption: s.caption ?? null, chapter, chapterStart, cut: Boolean(s.cut), lead: 0, duration, lines };
  });
  // opening card + scenes + closing card, minus the crossfades that overlap them (hard cuts don't)
  const fades = scenes.filter((s, k) => k === 0 || !s.cut).length + 1;
  const total = OPEN_S + scenes.reduce((a, s) => a + s.duration, 0) + END_S - XFADE_S * fades;
  return { voiced, chapters: CHAPTERS, scenes, total: round(total) };
}

const round = (x) => Math.round(x * 1000) / 1000;

/** The timeline plus what the recorder measured (zoom boxes, marks, notes) and the clips it made. */
export function writeTimeline() {
  const tl = buildTimeline();
  for (const s of tl.scenes) {
    const rec = new URL(`./public/rec/${s.id}.json`, import.meta.url);
    const meta = fs.existsSync(rec) ? JSON.parse(fs.readFileSync(rec, "utf8")) : {};
    s.focus = meta.focus ?? [];
    s.marks = meta.marks ?? [];
    s.speed = meta.speed ?? [];
    s.notes = meta.notes ?? {};
    s.video = fs.existsSync(new URL(`./public/rec/${s.id}.mp4`, import.meta.url)) ? `rec/${s.id}.mp4` : null;
    s.clip = meta.duration ?? null;
    // a scene may run up to 1.5 s past its recording (the last frame holds); anything else is out of sync
    const over = s.duration - (meta.duration ?? s.duration);
    if (meta.duration && (over < -0.05 || over > 1.5)) console.warn(`${s.id}: recorded for ${meta.duration}s, timeline says ${s.duration}s — re-record it`);
  }
  fs.writeFileSync(new URL("./src/timeline.json", import.meta.url), JSON.stringify(tl, null, 2));
  return tl;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tl = process.argv.includes("--write") ? writeTimeline() : buildTimeline();
  for (const s of tl.scenes) console.log(s.id, s.duration.toFixed(1), s.lines.map((l) => `${l.start.toFixed(1)}–${l.end.toFixed(1)}`).join("  "));
  const m = Math.floor(tl.total / 60);
  console.log("total", tl.total.toFixed(1), `s (${m}:${String(Math.round(tl.total - m * 60)).padStart(2, "0")})`, tl.voiced ? "(voice track)" : "(estimated, no voice yet)");
}
