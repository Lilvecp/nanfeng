// English narration with ElevenLabs: one MP3 per subtitle line, stitched with the lines around it
// (previous_text / next_text) so the delivery flows across cuts. Writes public/audio/sNN-LL.mp3 and
// public/audio/timing.json (the length of each line), which plan.mjs uses for the timeline.
//
// Needs ELEVENLABS_API_KEY in the environment or in ../.env (git-ignored). Optional:
//   ELEVENLABS_VOICE_ID   voice (default: George, a calm narrative voice)
//   ELEVENLABS_MODEL_ID   model (default: eleven_multilingual_v2, which supports request stitching)
//   ELEVENLABS_SPEED      delivery speed, 0.7-1.2 (default 0.9: judges read two subtitle lines)
// Usage: node tts/tts.mjs [--force] [--sample] [sNN-LL ...]
//   --sample: only the first line, to audition a voice; sNN-LL: voice these lines again
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { SCENES } from "../scenes.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const OUT = `${ROOT}public/audio/`;
fs.mkdirSync(OUT, { recursive: true });

// Load ../.env without printing anything from it.
const envFile = `${ROOT}.env`;
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("ELEVENLABS_API_KEY is not set (environment or 03-demo-video/resources/pipeline/.env).");
  process.exit(1);
}
const VOICE = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const SPEED = Number(process.env.ELEVENLABS_SPEED || 0.9);
const force = process.argv.includes("--force");

// Words the voice reads better spelled differently (the subtitles keep the real spelling). Checked by
// transcribing the clips back with Whisper (tts/check.py). Spanish names stay as written: a Spanish
// transcriber hears "Huerto", "Universidad del Desarrollo", "Lenis" and "Villarroel" right; respelled,
// they came back mangled.
const SAY = {
  "nanfengcfo.com": "Nan Feng C F O dot com", // plain: "Nanfengspho.com"
};
const spoken = (text) => Object.entries(SAY).reduce((t, [k, v]) => t.replaceAll(k, v), text);
const sample = process.argv.includes("--sample");
const redo = process.argv.filter((a) => /^s\d\d-\d\d$/.test(a)); // lines to voice again, e.g. s10-03

const all = SCENES.flatMap((s) => s.lines.map((l, i) => ({ scene: s.id, i, say: spoken(l.say) })));
const timingFile = `${OUT}timing.json`;
const timing = fs.existsSync(timingFile) && !sample ? JSON.parse(fs.readFileSync(timingFile, "utf8")) : {};

const duration = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

async function speak(text, previous, next, file) {
  const body = {
    text,
    model_id: MODEL,
    voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: SPEED },
    apply_text_normalization: "auto",
  };
  if (previous) body.previous_text = previous;
  if (next) body.next_text = next;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    }
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${detail}`);
  }
  throw new Error("ElevenLabs: too many retries");
}

const list = sample ? all.slice(0, 1) : all;
for (let k = 0; k < list.length; k++) {
  const { scene, i, say } = list[k];
  const name = `${scene}-${String(i + 1).padStart(2, "0")}`;
  const file = sample ? `${OUT}sample-${VOICE}.mp3` : `${OUT}${name}.mp3`;
  const hash = crypto.createHash("sha1").update(`${VOICE}|${MODEL}|${SPEED}|${say}`).digest("hex").slice(0, 12);
  const prev = timing[scene]?.[i];
  if (!force && !sample && !redo.includes(name) && prev?.hash === hash && fs.existsSync(file)) continue;
  const g = all.findIndex((x) => x.scene === scene && x.i === i);
  await speak(say, all[g - 1]?.say, all[g + 1]?.say, file);
  // Trim leading/trailing silence so the timeline controls every pause.
  const tmp = `${file}.tmp.mp3`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-af",
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse",
    "-c:a", "libmp3lame", "-b:a", "192k", tmp]);
  fs.renameSync(tmp, file);
  const dur = Math.round(duration(file) * 1000) / 1000;
  if (!sample) {
    timing[scene] ??= [];
    timing[scene][i] = { dur, hash };
    fs.writeFileSync(timingFile, JSON.stringify(timing, null, 2));
  }
  console.log(`${name}  ${dur.toFixed(2)}s  ${say.slice(0, 60)}`);
}
if (sample) console.log(`sample written: public/audio/sample-${VOICE}.mp3`);
