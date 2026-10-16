// Last pass on the voice clips: every line at the same loudness, and silence after its last word.
// The clips keep their length, so the timeline (public/audio/timing.json) does not change.
//   node tts/polish.mjs            all lines in scenes.mjs
// Runs again safely: a clip already at the target gets no gain, and a silent tail stays silent.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { SCENES } from "../scenes.mjs";

const OUT = new URL("../public/audio/", import.meta.url).pathname;
const TARGET = -26; // LUFS per line; the final mix is normalised to -16 LUFS afterwards

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { stdio: ["ignore", "pipe", "pipe"] });
const stderr = (args) => execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats ${args} 2>&1 >/dev/null`]).toString();
const duration = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

for (const s of SCENES) {
  for (let i = 0; i < s.lines.length; i++) {
    const file = `${OUT}${s.id}-${String(i + 1).padStart(2, "0")}.mp3`;
    if (!fs.existsSync(file)) continue;
    const dur = duration(file);
    const loud = Number(stderr(`-i '${file}' -af ebur128 -f null -`).match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/)?.[1]);
    // the last word ends where the final quiet stretch (below -35 dB) begins, but only if that stretch
    // runs to the end of the clip: a pause between two sentences is followed by more speech
    const sd = stderr(`-i '${file}' -af silencedetect=noise=-35dB:d=0.25 -f null -`);
    const starts = [...sd.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
    const last = starts.length - 1;
    const trailing = last >= 0 && (ends.length <= last || ends[last] >= dur - 0.05);
    const lastWord = trailing ? starts[last] : dur;
    const gain = Number.isFinite(loud) ? TARGET - loud : 0;
    const filters = [`volume=${gain.toFixed(2)}dB`];
    if (dur - lastWord > 0.25) filters.push(`afade=t=out:st=${(lastWord + 0.06).toFixed(3)}:d=0.12`);
    if (Math.abs(gain) < 0.3 && filters.length === 1) continue;
    const tmp = `${file}.tmp.mp3`;
    ff(["-y", "-i", file, "-af", filters.join(","), "-c:a", "libmp3lame", "-b:a", "192k", tmp]);
    fs.renameSync(tmp, file);
    console.log(`${s.id}-${String(i + 1).padStart(2, "0")}  ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB${filters.length > 1 ? `  silent after ${lastWord.toFixed(2)}s of ${dur.toFixed(2)}s` : ""}`);
  }
}
