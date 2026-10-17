// Voice for the 3-minute pitch cut (pitch.mjs). Most lines are the team's approved ElevenLabs takes in
// public/audio/; this script only adds what the cut needs on top of them, in public/audio/pitch/:
//   - new lines, voiced with the same voice and settings as tts/tts.mjs (the deck's tagline, and the
//     Sepolia line with a respelling the voice says right);
//   - single sentences cut out of approved takes, at the pause between two sentences;
//   - timing.json: for every clip the cut uses, its length and where the speech starts and ends.
// A new line is voiced only when its file is missing or its text changed: the takes in git are the
// ones the team heard, and a fresh request reads differently.
// Usage: node tts/pitch-voice.mjs [--force name ...]
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { NEW_LINES, SPLITS, usedClips } from "../pitch.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const AUDIO = `${ROOT}public/audio/`;
const OUT = `${AUDIO}pitch/`;
fs.mkdirSync(OUT, { recursive: true });
const TIMING = `${OUT}timing.json`;
const timing = fs.existsSync(TIMING) ? JSON.parse(fs.readFileSync(TIMING, "utf8")) : {};
const force = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const sh = (args) => execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats ${args} 2>&1 >/dev/null`]).toString();
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const duration = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const loudness = (f) => Number(sh(`-i '${f}' -af ebur128 -f null -`).match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/)?.[1]);
const TARGET = -26; // LUFS, as tts/polish.mjs leaves the approved lines

function env() {
  const file = `${ROOT}.env`;
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function voice(line, file) {
  env();
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set (environment or pipeline/.env)");
  const body = {
    text: line.say,
    model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
    voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: Number(process.env.ELEVENLABS_SPEED || 0.9) },
    apply_text_normalization: "auto",
    ...(line.previous ? { previous_text: line.previous } : {}),
    ...(line.next ? { next_text: line.next } : {}),
    ...(line.seed !== undefined ? { seed: line.seed } : {}),
  };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const raw = `${file}.raw.mp3`;
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  // same trim as tts/tts.mjs: the timeline controls every pause
  ff(["-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse", "-c:a", "libmp3lame", "-b:a", "192k", file]);
  fs.rmSync(raw);
}

/** Bring a clip to the loudness of the approved lines (no change when it is already there). */
function level(file) {
  const gain = TARGET - loudness(file);
  if (!Number.isFinite(gain) || Math.abs(gain) < 0.3) return;
  const tmp = `${file}.tmp.mp3`;
  ff(["-i", file, "-af", `volume=${gain.toFixed(2)}dB`, "-c:a", "libmp3lame", "-b:a", "192k", tmp]);
  fs.renameSync(tmp, file);
}

const hashOf = (x) => crypto.createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 12);
env(); // before any hash: a line's hash includes the voice ID

// 1. new lines
for (const line of NEW_LINES) {
  const file = `${OUT}${line.id}.mp3`;
  const hash = hashOf([process.env.ELEVENLABS_VOICE_ID ?? "", line.say, line.previous, line.next, line.seed]);
  const known = timing[line.id]?.hash;
  // a take already on disk without a record is adopted as is (the takes chosen by ear)
  if (fs.existsSync(file) && !force.includes(line.id) && (known === hash || known === undefined)) {
    timing[line.id] = { ...timing[line.id], hash };
    continue;
  }
  await voice(line, file);
  timing[line.id] = { hash };
  console.log(`voiced ${line.id}: ${line.say}`);
}
for (const line of NEW_LINES) level(`${OUT}${line.id}.mp3`);

// 2. sentences cut out of approved takes, inside the pause after (or before) the sentence
for (const s of SPLITS) {
  const src = `${AUDIO}${s.from}.mp3`;
  const file = `${OUT}${s.id}.mp3`;
  const hash = hashOf([s.from, s.start, s.end, fs.statSync(src).size]);
  if (fs.existsSync(file) && timing[s.id]?.hash === hash) continue;
  const end = s.end ?? duration(src);
  const len = end - s.start;
  ff(["-ss", String(s.start), "-t", len.toFixed(3), "-i", src, "-af",
    `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, len - 0.06).toFixed(3)}:d=0.06`, "-c:a", "libmp3lame", "-b:a", "192k", file]);
  timing[s.id] = { hash };
  console.log(`cut ${s.id} from ${s.from} ${s.start}–${end.toFixed(2)} s`);
}

// 3. length and speech span of every clip the cut plays (the pitch timeline packs lines on speech,
//    not on the silent tail a clip may keep)
for (const name of usedClips()) {
  const file = fs.existsSync(`${OUT}${name}.mp3`) ? `${OUT}${name}.mp3` : `${AUDIO}${name}.mp3`;
  if (!fs.existsSync(file)) throw new Error(`missing clip ${name}`);
  const dur = duration(file);
  const sd = sh(`-i '${file}' -af silencedetect=noise=-40dB:d=0.12 -f null -`);
  const starts = [...sd.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  // leading silence: one that starts at 0; trailing: the last one when it runs to the end
  const lead = starts[0] !== undefined && starts[0] < 0.02 ? ends[0] ?? 0 : 0;
  const last = starts.length - 1;
  const tail = last >= 0 && (ends.length <= last || ends[last] >= dur - 0.03) ? starts[last] : dur;
  timing[name] = { ...timing[name], dur: r3(dur), speech: [r3(lead), r3(Math.max(lead, tail))], src: file.replace(`${ROOT}public/`, "") };
}
fs.writeFileSync(TIMING, JSON.stringify(timing, null, 2));
console.log(`timing for ${usedClips().length} clips → public/audio/pitch/timing.json`);

function r3(x) { return Math.round(x * 1000) / 1000; }
