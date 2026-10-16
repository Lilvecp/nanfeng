// Renders single frames of a composition, to look at them before a full render (one bundle for all).
// Usage: node stills.mjs <composition> <out dir> <time…>     times in seconds (12.5) or frames (f375)
//        node stills.mjs NanFengPitch out/check --every 3        a frame every 3 s, plus a contact sheet
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [id, outDir, ...rest] = process.argv.slice(2);
if (!id || !outDir) {
  console.error("usage: node stills.mjs <composition> <out dir> <seconds|fNNN …> | --every <seconds>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const comp = await selectComposition({ serveUrl, id });
let frames;
const every = rest.indexOf("--every");
if (every >= 0) {
  const step = Math.round(Number(rest[every + 1]) * comp.fps);
  frames = [];
  for (let f = 0; f < comp.durationInFrames; f += step) frames.push(f);
} else {
  frames = rest.map((x) => (x.startsWith("f") ? Number(x.slice(1)) : Math.round(Number(x) * comp.fps)));
}
const files = [];
for (const frame of frames) {
  const f = Math.min(frame, comp.durationInFrames - 1);
  const output = path.join(outDir, `${id}-${String(f).padStart(5, "0")}.jpg`);
  await renderStill({ composition: comp, serveUrl, output, frame: f, imageFormat: "jpeg", jpegQuality: 85, scale: every >= 0 ? 0.5 : 1 });
  files.push(output);
  process.stdout.write(`${(f / comp.fps).toFixed(2)}s `);
}
console.log();
if (every >= 0 && files.length) {
  // contact sheets of 4×4, each frame labelled with its time
  for (let i = 0; i < files.length; i += 16) {
    const group = files.slice(i, i + 16);
    const args = ["-hide_banner", "-loglevel", "error", "-y"];
    group.forEach((g) => args.push("-i", g));
    const w = 960, h = 540;
    const lab = group.map((g, k) => `[${k}]drawtext=text='${(Number(path.basename(g).match(/(\d+)\.jpg$/)[1]) / comp.fps).toFixed(1)}s':x=8:y=8:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.7[v${k}]`).join(";");
    const layout = group.map((_, k) => `${(k % 4) * w}_${Math.floor(k / 4) * h}`).join("|");
    const stack = group.length > 1 ? `;${group.map((_, k) => `[v${k}]`).join("")}xstack=inputs=${group.length}:layout=${layout}:fill=black` : "";
    execFileSync("ffmpeg", [...args, "-filter_complex", lab + stack, "-frames:v", "1", path.join(outDir, `sheet-${String(i / 16 + 1).padStart(2, "0")}.jpg`)]);
  }
  console.log(`sheets in ${outDir}`);
}
