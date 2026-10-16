// The 3-minute pitch: a re-edit of the same live take as the 5-minute demo (scenes.mjs), after a
// judge's second review. Every app shot is a piece of a recorded scene (public/rec/sNN.mp4), so the
// sandbox is not reset and no new Sepolia transaction is sent. Motion-graphics sections (the problem,
// the results, the tagline, the team) are drawn in Remotion. The narration is the team's approved
// ElevenLabs takes; the deck's tagline and the Sepolia line are new takes in the same voice
// (tts/pitch-voice.mjs).
//
// A section is one of:
//   card  a title card (Opening, EndCard) of fixed length
//   mg    a motion-graphics scene; its narration lines follow each other with `gap` seconds between
//   shot  pieces of one recorded scene, played in order; a line placed with `src` starts at that time
//         of the scene clock (so the picture stays in sync with the words), one placed with `at` at
//         that offset into the section
// join (shots): how the section opens. "dip": the screen blinks to the next page (a new page, so a
// crossfade would show two pages at once); "cut": a hard cut on the same page, with the camera
// carried over. A piece may also open with its own join.
// Lines: a clip name (public/audio/<clip>.mp3, or public/audio/pitch/<clip>.mp3), with the subtitle
// (en, zh) taken from scenes.mjs for an approved line, or given here for a new or shortened one.
import fs from "node:fs";
import { SCENES, CHAPTERS } from "./scenes.mjs";

export const PITCH_CHAPTERS = CHAPTERS;

// New takes, same voice and settings as tts/tts.mjs. `say` is what the voice reads.
const P_SEPOLIA = "Its fingerprint is written to a public blockchain.";
const N_SEPOLIA = "No one can quietly change it. Not the agent, and not even us.";
const P_TAG = "Across fifty benchmark cases, NanFeng solved all fifty, and cut financing costs by forty-one percent on average.";
const N_TAG = "Behind NanFeng are five students from Universidad del Desarrollo, in Chile:";
export const NEW_LINES = [
  // "Sepolia" came out as "Sapolia"; with this spelling the first vowel matches the /ɛ/ of "test"
  // in the same clip, and Whisper hears "Sepolia"
  { id: "s10-03-sepolia", say: "Here is that transaction on Sepp-olia, the Ethereum test network.", previous: P_SEPOLIA, next: N_SEPOLIA,
    en: "Here’s that transaction on Sepolia, the Ethereum test network.", zh: "这是该交易在以太坊测试网 Sepolia 上的记录。" },
  // the deck's wording, in two takes so the full stop lands between them
  { id: "s13-02-tagline-a", say: "NanFeng doesn't advise.", previous: P_TAG, next: "It acts, with your permission.", seed: 11,
    en: "NanFeng doesn't advise.", zh: "南风不止于建议。" },
  { id: "s13-02-tagline-b", say: "It acts, with your permission.", previous: `${P_TAG} NanFeng doesn't advise.`, next: N_TAG, seed: 11,
    en: "It acts, with your permission.", zh: "它在您的授权下行动。" },
];

// One sentence out of an approved take, cut inside the pause next to it (seconds into the clip).
export const SPLITS = [
  { id: "s03-05a", from: "s03-05", start: 0, end: 1.55, en: "All of that took under a minute.", zh: "整个过程不到一分钟。" },
  { id: "s05-01a", from: "s05-01", start: 0, end: 2.15, en: "Then it shops the market for the owner.", zh: "接着，它替企业主货比三家。" },
  { id: "s07-02b", from: "s07-02", start: 3.15, en: "Every number comes from the optimizer, not from the language model.", zh: "每个数字都来自优化器，而不是语言模型。" },
  { id: "s12-01a", from: "s12-01", start: 0, end: 2.4, en: "NanFeng also speaks Chinese.", zh: "南风也说中文。" },
];

const caption = (id) => SCENES.find((s) => s.id === id)?.caption ?? null;

export const CUT = [
  { id: "open", kind: "card", card: "Opening", dur: 2.2 },
  { id: "problem", kind: "mg", mg: "Problem", chapter: "problem", chips: [], head: 0.4, gap: 0.32, tail: 1.15,
    lines: ["s01-01", "s01-02", "s01-03", "s01-04"] },
  { id: "meet", kind: "shot", scene: "s02", chapter: "problem", chips: ["TC", "II"], caption: caption("s02"),
    // after "Got it": the welcome card is gone from Home
    pieces: [{ from: 7.25, to: 14.1 }], lines: [{ clip: "s02-01", at: 0.25 }] },
  { id: "news", kind: "shot", scene: "s02", join: "cut", chapter: "problem", chips: ["TC", "II"],
    pieces: [{ from: 20.6, to: 27.95 }], lines: [{ clip: "s02-04", src: 20.98 }] },
  { id: "agent", kind: "shot", scene: "s03", join: "cut", chapter: "risk", chips: ["TC", "II"], caption: caption("s03"),
    pieces: [{ from: 0.2, to: 14.75 }, { from: 16.2, to: 22.75 }],
    lines: [{ clip: "s03-01", src: 1.0 }, { clip: "s03-02", src: 4.51 }, { clip: "s03-03", src: 8.76 }, { clip: "s03-04", src: 16.5 }, { clip: "s03-05a", src: 20.97 }] },
  { id: "verdict", kind: "shot", scene: "s04", chapter: "risk", chips: ["TC"], caption: caption("s04"),
    // "13%" right after the verdict (the take ends in a long silence)
    pieces: [{ from: 1.0, to: 11.5 }], lines: [{ clip: "s04-01", src: 1.4 }, { clip: "s04-02", src: 8.6 }] },
  { id: "deal", kind: "shot", scene: "s05", chapter: "deal", chips: ["TC"], caption: caption("s05"),
    pieces: [{ from: 1.1, to: 3.6 }, { from: 6.6, to: 21.1 }],
    lines: [{ clip: "s05-01a", src: 1.4 }, { clip: "s05-02", src: 6.87 }, { clip: "s05-03", src: 11.14 }, { clip: "s05-04", src: 16.33 }] },
  { id: "why", kind: "shot", scene: "s07", chapter: "deal", chips: ["II", "SC"], caption: caption("s07"),
    pieces: [{ from: 8.95, to: 13.75 }], lines: [{ clip: "s07-02b", src: 9.15 }] },
  { id: "approve", kind: "shot", scene: "s08", chapter: "approve", chips: ["SC", "II"], caption: caption("s08"),
    // the code being typed, then the owner's click right after "never approve"
    pieces: [{ from: 1.0, to: 6.75 }, { from: 9.1, to: 10.7 }, { from: 14.55, to: 16.95 }],
    lines: [{ clip: "s08-01", src: 1.4 }, { clip: "s08-03", at: 6.25 }] },
  { id: "done", kind: "shot", scene: "s09", join: "cut", chapter: "approve", chips: ["TC"],
    pieces: [{ from: 0.5, to: 9.95 }], lines: [{ clip: "s09-01", src: 0.8 }, { clip: "s09-02", src: 3.81 }] },
  { id: "proof", kind: "shot", scene: "s10", chapter: "proof", chips: ["ON", "SC"], caption: caption("s10"),
    pieces: [{ from: 1.0, to: 13.35 }, { from: 18.85, to: 23.15, join: "dip" }],
    lines: [{ clip: "s10-01", src: 1.2 }, { clip: "s10-02", src: 6.33 }, { clip: "s10-03-sepolia", src: 9.08 }, { clip: "s10-05", src: 19.11 }] },
  { id: "fraud", kind: "shot", scene: "s11", chapter: "fraud", chips: ["SC"], caption: caption("s11"),
    pieces: [{ from: 0.55, to: 24.0 }], lines: [{ clip: "s11-01", src: 1.0 }, { clip: "s11-02", src: 9.2 }, { clip: "s11-03", src: 14.03 }, { clip: "s11-04", src: 19.21 }] },
  { id: "china", kind: "shot", scene: "s12", chapter: "china", chips: ["II", "SC"], caption: caption("s12"),
    // "Chinese" lands as the screen switches to 中文
    // the Messages page shows Documents for a moment before the WeCom thread: cut straight to the thread
    pieces: [{ from: 1.55, to: 4.75 }, { from: 8.95, to: 18.2, join: "dip" }],
    lines: [{ clip: "s12-01a", src: 1.9 }, { clip: "s12-02", src: 9.1, en: "And it writes to the importer on WeCom, China's business chat, labelling every message as AI-generated, as Chinese rules require." }] },
  { id: "results", kind: "mg", mg: "Results", chapter: "team", chips: ["TC", "II"], head: 0.35, gap: 0.5, tail: 1.0,
    lines: ["s13-01", { clip: "s13-02-tagline-a", gap: 0.55 }, { clip: "s13-02-tagline-b", gap: 0.42 }] },
  { id: "team", kind: "mg", mg: "Team", chapter: "team", chips: [], head: 0.3, gap: 0.5, tail: 0.7,
    lines: ["s14-01", "s14-04"] },
  { id: "end", kind: "card", card: "EndCard", dur: 2.6 },
];

const norm = (l) => (typeof l === "string" ? { clip: l } : l);

/** Every clip the cut plays, for tts/pitch-voice.mjs. */
export function usedClips() {
  return [...new Set(CUT.flatMap((s) => (s.lines ?? []).map((l) => norm(l).clip)))];
}

/** Subtitle of a clip: given in the cut, or of a new/shortened line, or of the approved line. */
function subtitle(l) {
  const own = [...NEW_LINES, ...SPLITS].find((x) => x.id === l.clip);
  const m = l.clip.match(/^(s\d\d)-(\d\d)$/);
  const approved = m ? SCENES.find((s) => s.id === m[1])?.lines[Number(m[2]) - 1] : null;
  const src = own ?? approved;
  if (!src) throw new Error(`no subtitle for ${l.clip}`);
  return { en: l.en ?? src.en, zh: l.zh ?? src.zh };
}

const r3 = (x) => Math.round(x * 1000) / 1000;

export function buildPitch() {
  const TIMING = new URL("./public/audio/pitch/timing.json", import.meta.url);
  if (!fs.existsSync(TIMING)) throw new Error("run node tts/pitch-voice.mjs first");
  const timing = JSON.parse(fs.readFileSync(TIMING, "utf8"));
  const warn = [];
  let at = 0;
  const sections = CUT.map((s, k) => {
    const out = { id: s.id, kind: s.kind, start: r3(at), chapter: s.chapter ? CHAPTERS.findIndex((c) => c.id === s.chapter) : -1, chips: s.chips ?? [], caption: s.caption ?? null };
    let lines = [];
    if (s.kind === "card") {
      out.dur = s.dur;
      out.card = s.card;
    } else if (s.kind === "mg") {
      let t = s.head ?? 0.3;
      lines = s.lines.map(norm).map((l, i) => {
        const tm = timing[l.clip];
        if (i > 0) t += l.gap ?? s.gap ?? 0.4;
        const line = { clip: l.clip, start: r3(t), end: r3(t + tm.speech[1] - tm.speech[0]) };
        t = line.end;
        return line;
      });
      out.dur = r3(t + (s.tail ?? 0.6));
      out.mg = s.mg;
    } else {
      const meta = JSON.parse(fs.readFileSync(new URL(`./public/rec/${s.scene}.json`, import.meta.url), "utf8"));
      let o = 0;
      out.pieces = s.pieces.map((p, i) => {
        const rate = p.rate ?? 1;
        const piece = { from: p.from, to: p.to, rate, at: r3(o), join: i === 0 ? (s.join ?? "dip") : (p.join ?? "cut") };
        o += (p.to - p.from) / rate;
        if (p.to > meta.duration + 0.35) warn.push(`${s.id}: piece ${i} runs to ${p.to}s, the recording ends at ${meta.duration}s`);
        return piece;
      });
      out.dur = r3(o);
      out.scene = s.scene;
      out.join = s.join ?? "dip";
      out.video = `rec/${s.scene}.mp4`;
      out.clip = meta.duration;
      out.focus = meta.focus ?? [];
      out.marks = meta.marks ?? [];
      out.speed = meta.speed ?? [];
      out.notes = meta.notes ?? {};
      const toOut = (src) => {
        const p = out.pieces.find((x) => src >= x.from - 1e-6 && src <= x.to + 1e-6);
        if (!p) return null;
        if (p.rate !== 1) warn.push(`${s.id}: a line at ${src}s falls in a sped-up piece`);
        return p.at + (src - p.from) / p.rate;
      };
      lines = s.lines.map(norm).map((l) => {
        const tm = timing[l.clip];
        const start = l.src !== undefined ? toOut(l.src) : l.at;
        if (start === null || start === undefined) throw new Error(`${s.id}: ${l.clip} at ${l.src}s is outside the pieces`);
        return { clip: l.clip, start: r3(start), end: r3(start + tm.speech[1] - tm.speech[0]) };
      });
    }
    // audio file, lead (silence before the first word), subtitles
    out.lines = lines.map((line, i) => {
      const src = norm(s.lines[i]);
      const tm = timing[line.clip];
      return { ...line, ...subtitle(src), audio: tm.src, lead: tm.speech[0] };
    });
    for (let i = 1; i < out.lines.length; i++) if (out.lines[i].start < out.lines[i - 1].end + 0.15) warn.push(`${s.id}: ${out.lines[i].clip} starts ${(out.lines[i - 1].end - out.lines[i].start).toFixed(2)}s before ${out.lines[i - 1].clip} ends`);
    const last = out.lines[out.lines.length - 1];
    if (last && last.end > out.dur - 0.05) warn.push(`${s.id}: ${last.clip} ends at ${last.end}s, the section at ${out.dur}s`);
    out.chapterStart = k > 0 && s.chapter && CUT[k - 1].chapter !== s.chapter;
    at += out.dur;
    return out;
  });
  // the narration across a section boundary: the silence a viewer hears between two lines
  const gaps = [];
  let prevEnd = null;
  for (const s of sections) for (const l of s.lines) {
    const st = s.start + l.start;
    if (prevEnd !== null) gaps.push({ at: r3(st), gap: r3(st - prevEnd), clip: l.clip });
    prevEnd = s.start + l.end;
  }
  return { fps: 30, chapters: CHAPTERS, sections, total: r3(at), gaps, warn };
}

/** The narration of the cut with its time codes, for readers who skim before they watch. */
export function transcript(p) {
  const mm = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const rows = [];
  for (const s of p.sections) {
    s.lines.forEach((l, i) => {
      const ch = i === 0 && s.chapter >= 0 && (s.chapterStart || s.id === "problem") ? `**${p.chapters[s.chapter].en}**` : "";
      rows.push(`| ${mm(s.start + l.start)} | ${ch} | ${l.en} | ${l.zh} |`);
    });
  }
  return [
    "# Transcript of the demo video",
    "",
    `[nanfeng-demo.mp4](nanfeng-demo.mp4), ${mm(p.total)}. The narration as spoken, with the burned-in 中文 subtitle of each line.`,
    "The app shots are one live take on https://www.nanfengcfo.com; the problem, results and team sections are motion graphics.",
    "Generated from the edit (`resources/pipeline/pitch.mjs`), so it always matches the video.",
    "",
    "| Time | Chapter | Narration (EN) | 字幕 (中文) |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

export function writePitch() {
  const p = buildPitch();
  fs.writeFileSync(new URL("./src/pitch.json", import.meta.url), JSON.stringify(p, null, 2));
  fs.writeFileSync(new URL("../../transcript.md", import.meta.url), transcript(p));
  return p;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = process.argv.includes("--write") ? writePitch() : buildPitch();
  const mm = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
  for (const s of p.sections) console.log(`${mm(s.start)}  ${s.id.padEnd(8)} ${s.dur.toFixed(2).padStart(6)}s  ${s.lines.map((l) => `${l.clip}@${l.start.toFixed(1)}`).join(" ")}`);
  console.log(`total ${mm(p.total)} (${p.total.toFixed(1)} s)`);
  const long = p.gaps.filter((g) => g.gap > 1.2);
  console.log(`silences between lines: max ${Math.max(...p.gaps.map((g) => g.gap)).toFixed(2)} s; over 1.2 s: ${long.map((g) => `${mm(g.at)} ${g.gap.toFixed(2)}s before ${g.clip}`).join(", ") || "none"}`);
  for (const w of p.warn) console.warn("warn:", w);
}
