// Screen recorder for one scene: Chrome's screencast (CDP) frames on a scene clock that can be
// paused around page loads or run fast (a long agent run shown at 4×), an injected cursor with a
// click ripple, and cursor moves and scrolls eased on the wall clock so they play back smoothly.
// The frames become a constant-frame-rate H.264 clip; focus boxes (for the compositor's zooms),
// marks, speed changes and notes are written next to it.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { FPS, VIEWPORT, DSF } from "../scenes.mjs";

const W = Math.round(VIEWPORT.width * DSF);
const H = Math.round(VIEWPORT.height * DSF);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const wall = () => performance.now() / 1000;

// Chrome on the GPU (Vulkan): the screencast keeps up at 60 fps where SwiftShader gave 3–15.
export const CHROME_ARGS = ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--hide-scrollbars"];

// Injected into every page: a cursor that follows the mouse and a ripple on each click.
// The cursor sits at the last known position across full page loads (window.name).
export const CURSOR_INIT = () => {
  const install = () => {
    if (document.getElementById("__rec_cursor")) return;
    const st = document.createElement("style");
    st.textContent = `
      #__rec_cursor{position:fixed;left:0;top:0;width:26px;height:26px;pointer-events:none;z-index:2147483647;
        transform:translate(-3px,-2px);transition:transform .08s ease;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
      #__rec_cursor.down{transform:translate(-3px,-2px) scale(.86)}
      .__rec_ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;
        z-index:2147483646;border:2.5px solid rgba(201,168,102,.95);background:rgba(201,168,102,.18);
        animation:__rec_rip .55s ease-out forwards}
      @keyframes __rec_rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.35);opacity:0}}
      *{cursor:none!important}`;
    document.documentElement.appendChild(st);
    const c = document.createElement("div");
    c.id = "__rec_cursor";
    c.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.5 L11.6 15.2 L18.5 15.2 Z" fill="#14171C" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    document.documentElement.appendChild(c);
    let pos = { x: -50, y: -50 };
    try { pos = JSON.parse(window.name || "{}").__rec || pos; } catch {}
    c.style.left = pos.x + "px"; c.style.top = pos.y + "px";
    window.addEventListener("mousemove", (e) => {
      c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px";
      try { window.name = JSON.stringify({ __rec: { x: e.clientX, y: e.clientY } }); } catch {}
    }, true);
    window.addEventListener("mousedown", (e) => {
      c.classList.add("down");
      const r = document.createElement("div");
      r.className = "__rec_ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
    window.addEventListener("mouseup", () => c.classList.remove("down"), true);
  };
  if (document.documentElement) install();
  document.addEventListener("DOMContentLoaded", install);
};

export class Recorder {
  constructor(page, outDir, id, { dry = false } = {}) {
    this.page = page; this.outDir = outDir; this.id = id; this.dry = dry;
    this.frameDir = path.join(outDir, `.frames-${id}`);
    this.frames = []; this.focus = []; this.marks = []; this.speed = []; this.notes = {};
    // scene clock: scene time = t0 + (wall − w0) / rate while running, frozen while paused;
    // rate 4 plays 4 s of wall time in 1 s of video
    this.paused = true; this.rate = 1; this.t0 = 0; this.w0 = 0;
    this.mouse = { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.55 };
    this.shot = 0;
  }

  now() {
    return this.paused ? this.t0 : this.t0 + (wall() - this.w0) / this.rate;
  }

  async start() {
    fs.rmSync(this.frameDir, { recursive: true, force: true });
    fs.mkdirSync(this.frameDir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", async (f) => {
      this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      if (this.paused || this.dry) return;
      this.addFrame(Buffer.from(f.data, "base64"));
    });
    this.t0 = 0;
    await this.resume();
  }

  addFrame(buf) {
    const t = this.now();
    const file = path.join(this.frameDir, `${String(this.frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, buf);
    this.frames.push({ t, file });
  }

  async startCast() {
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 }).catch(() => {});
  }

  /** Stop the scene clock (page loads, waiting on the network): nothing is recorded meanwhile. */
  async pause() {
    if (this.paused) return;
    this.t0 = this.now();
    this.paused = true;
    await this.cdp.send("Page.stopScreencast").catch(() => {});
  }

  async resume() {
    if (!this.paused) return;
    // The screencast only sends a frame when the page changes: grab the current picture first.
    const buf = this.dry ? null : await this.page.screenshot({ type: "jpeg", quality: 92, scale: "device" }).catch(() => null);
    this.w0 = wall();
    this.paused = false;
    if (buf) this.addFrame(buf);
    await this.startCast();
  }

  /** From now on the clip plays `rate` times faster than real time (4 = 4×): the scene clock runs slower. */
  setRate(rate) {
    this.t0 = this.now();
    this.w0 = wall();
    this.rate = rate;
    this.speed.push({ t: round(this.t0), rate });
  }

  /** Wait until the scene clock reaches t seconds. */
  async at(t) {
    for (;;) {
      const d = t - this.now();
      if (d <= 0 || this.paused) return;
      await sleep(Math.min(250, d * this.rate * 1000));
    }
  }

  async goto(url, settleMs = 1800) {
    await this.pause();
    await this.page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
    await this.page.waitForTimeout(settleMs);
    await this.page.mouse.move(this.mouse.x, this.mouse.y);
    await this.resume();
  }

  async box(target) {
    if (target && typeof target.x === "number" && typeof target.width === "number") return target;
    const loc = typeof target === "string" ? this.page.locator(target).first() : target;
    await loc.waitFor({ state: "visible", timeout: 15000 });
    return loc.boundingBox();
  }

  /** Move the cursor along an eased path that takes `dur` seconds of wall time, whatever the CDP latency. */
  async moveTo(target, dur = 0.7, offset = { x: 0.5, y: 0.5 }) {
    let x, y;
    if (typeof target?.x === "number" && target.width === undefined) ({ x, y } = target);
    else {
      const b = await this.box(target);
      x = b.x + b.width * offset.x; y = b.y + b.height * offset.y;
    }
    const from = { ...this.mouse };
    const w0 = wall();
    for (;;) {
      const k = Math.min(1, (wall() - w0) / dur);
      const e = ease(k);
      await this.page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
      if (k >= 1) break;
      await sleep(8);
    }
    this.mouse = { x, y };
  }

  async click(target, { dur = 0.7, dwell = 160, offset } = {}) {
    await this.moveTo(target, dur, offset);
    await sleep(dwell);
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
  }

  async type(text, charMs = 110) {
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await sleep(charMs * (0.7 + Math.random() * 0.6));
    }
  }

  /** Scroll so the element sits at the top ("start") or middle ("center") of its scroll container,
   * eased over `dur` seconds with requestAnimationFrame (smoother than the browser's smooth scroll). */
  async scrollTo(target, block = "center", dur = 1.1, { offset = 0 } = {}) {
    const loc = typeof target === "string" ? this.page.locator(target).first() : target;
    await loc.evaluate((el, { block, dur, offset }) => new Promise((done) => {
      const scrollable = (e) => {
        for (let p = e.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 4) return p;
        }
        return document.scrollingElement;
      };
      const box = scrollable(el);
      const isDoc = box === document.scrollingElement;
      const view = isDoc ? { top: 0, height: innerHeight } : box.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const nav = isDoc ? 64 : 0; // the landing's fixed nav
      const want = block === "start" ? view.top + nav + 16 : view.top + (view.height - r.height) / 2;
      const max = box.scrollHeight - box.clientHeight;
      const from = box.scrollTop;
      const to = Math.max(0, Math.min(max, from + r.top - want + offset));
      const t0 = performance.now();
      const ez = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      // CSS smooth scrolling would animate every step again and lag behind: off while we drive it
      const html = document.documentElement, sb = [box.style.scrollBehavior, html.style.scrollBehavior];
      box.style.scrollBehavior = "auto"; html.style.scrollBehavior = "auto";
      const finish = () => { box.style.scrollBehavior = sb[0]; html.style.scrollBehavior = sb[1]; done(); };
      const step = (now) => {
        const k = Math.min(1, (now - t0) / (dur * 1000));
        box.scrollTop = from + (to - from) * ez(k);
        if (k < 1) requestAnimationFrame(step); else finish();
      };
      if (Math.abs(to - from) < 2) finish(); else requestAnimationFrame(step);
    }), { block, dur, offset });
    await sleep(120);
  }

  /** Ask the compositor to zoom on this box for `dur` seconds (box in CSS px of the viewport). */
  async zoom(target, dur = 2.5, { pad = 24, maxScale = 1.6, spot = false } = {}) {
    const b = await this.box(target);
    const box = { x: b.x - pad, y: b.y - pad, w: b.width + 2 * pad, h: b.height + 2 * pad };
    this.focus.push({ t: round(this.now()), dur, box, maxScale, ...(spot ? { spot: true } : {}) });
    if (this.dry) await this.page.screenshot({ path: path.join(this.outDir, `.dry-${this.id}-${++this.shot}.png`) });
  }

  /** A named moment on the scene clock, for the compositor's callouts. */
  mark(name) {
    this.marks.push({ name, t: round(this.now()) });
  }

  /** A value measured during the take (an anchor's root, a tx hash) that a callout shows. */
  note(key, value) {
    this.notes[key] = value;
  }

  async snap(label) {
    if (this.dry) await this.page.screenshot({ path: path.join(this.outDir, `.dry-${this.id}-${++this.shot}-${label}.png`) });
  }

  /** Stop at `duration` (scene clock) and encode the clip. */
  async finish(duration) {
    if (this.rate !== 1) this.setRate(1);
    await this.at(duration + 0.4);
    await this.pause();
    await this.cdp.detach().catch(() => {});
    const meta = { id: this.id, duration, focus: this.focus, marks: this.marks, speed: this.speed, notes: this.notes, viewport: VIEWPORT };
    fs.writeFileSync(path.join(this.outDir, `${this.id}${this.dry ? ".dry" : ""}.json`), JSON.stringify(meta, null, 2));
    if (this.dry) return;
    const list = [];
    const fr = this.frames.filter((f) => f.t <= duration + 0.4);
    fr.forEach((f, i) => {
      const next = i + 1 < fr.length ? fr[i + 1].t : duration + 0.4;
      list.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
    });
    list.push(`file '${fr[fr.length - 1].file}'`);
    const listFile = path.join(this.frameDir, "list.txt");
    fs.writeFileSync(listFile, list.join("\n"));
    const out = path.join(this.outDir, `${this.id}.mp4`);
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile,
      "-vf", `scale=${W}:${H}:flags=lanczos,fps=${FPS}`, "-t", String(duration + 0.3),
      "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${this.id}`);
    fs.rmSync(this.frameDir, { recursive: true, force: true });
    return out;
  }
}

const round = (x) => Math.round(x * 1000) / 1000;
