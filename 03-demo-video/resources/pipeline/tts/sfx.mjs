// A small sound kit for the pitch cut's motion graphics, synthesised with ffmpeg (no downloads, the
// same files on every run): a soft whoosh for a new beat, a pop when a number lands, a tick.
//   node tts/sfx.mjs   → public/sfx/*.wav (16-bit, 48 kHz, mono)
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = new URL("../public/sfx/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const KIT = {
  // pink noise through a band-pass, swelling in and out
  whoosh: ["-f", "lavfi", "-i", "anoisesrc=d=0.6:c=pink:r=48000:a=0.5:seed=7", "-af",
    "highpass=f=300,lowpass=f=4200,afade=t=in:st=0:d=0.34:curve=qsin,afade=t=out:st=0.34:d=0.26:curve=qsin"],
  // a short pitch drop with a fast decay
  pop: ["-f", "lavfi", "-i", "aevalsrc='0.5*sin(2*PI*(170*t+380*(1-exp(-t*30))/30))*exp(-t*24)':d=0.2:s=48000"],
  tick: ["-f", "lavfi", "-i", "aevalsrc='0.35*sin(2*PI*1750*t)*exp(-t*95)':d=0.06:s=48000"],
};
for (const [name, args] of Object.entries(KIT)) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args, "-ac", "1", "-c:a", "pcm_s16le", `${OUT}${name}.wav`]);
  console.log(`public/sfx/${name}.wav`);
}
