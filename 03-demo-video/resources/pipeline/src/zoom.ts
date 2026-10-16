// Camera moves on the recorded screen: each focus box from the recorder becomes a zoom that eases
// in, holds and eases out. Back-to-back zooms glide from one box to the next without going wide.
// Moves interpolate the centre of the view and the log of the scale, so a zoom heads straight for
// its target instead of swinging around the top-left corner.
export type Focus = {
  t: number; dur: number; box: { x: number; y: number; w: number; h: number }; maxScale?: number; spot?: boolean;
  spotBox?: Focus["box"]; spotK?: number; // spotlight on another box than the camera's, at this strength
};
export type Cam = { s: number; lx: number; ly: number }; // scale, visible left/top in viewport px

export const RAMP = 0.9;
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
type View = { s: number; cx: number; cy: number };

export function camera(focus: Focus[], t: number, vw: number, vh: number): Cam {
  const wide: View = { s: 1, cx: vw / 2, cy: vh / 2 };
  const target = (f: Focus): View => {
    const s = Math.max(1, Math.min(f.maxScale ?? 1.6, (0.94 * vw) / f.box.w, (0.94 * vh) / f.box.h));
    return { s, cx: f.box.x + f.box.w / 2, cy: f.box.y + f.box.h / 2 };
  };
  const lerp = (a: View, b: View, k: number): View => ({
    s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k),
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
  });
  const toCam = (v: View): Cam => {
    const lx = Math.min(Math.max(v.cx - vw / v.s / 2, 0), vw - vw / v.s);
    const ly = Math.min(Math.max(v.cy - vh / v.s / 2, 0), vh - vh / v.s);
    return { s: v.s, lx, ly };
  };
  // clamped targets, so a move between two boxes near an edge does not drift outside the screen
  const clamped = (f: Focus): View => {
    const v = target(f);
    const c = toCam(v);
    return { s: v.s, cx: c.lx + vw / v.s / 2, cy: c.ly + vh / v.s / 2 };
  };

  const fs = [...focus].sort((a, b) => a.t - b.t);
  const end = (i: number) => Math.min(fs[i].t + fs[i].dur, fs[i + 1]?.t ?? Infinity);
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    if (t < f.t) break;
    const chained = i > 0 && f.t - end(i - 1) < RAMP;
    const from = chained ? clamped(fs[i - 1]) : wide;
    const to = clamped(f);
    if (t < f.t + RAMP) return toCam(lerp(from, to, ease((t - f.t) / RAMP)));
    const e = end(i);
    if (t < e) return toCam(to);
    const next = fs[i + 1];
    if (next && next.t - e < RAMP) {
      if (t < next.t) return toCam(to);
      continue;
    }
    if (t < e + RAMP) return toCam(lerp(to, wide, ease((t - e) / RAMP)));
  }
  return toCam(wide);
}

/** How strongly the spotlight of a `spot` focus shows at time t (0…1), and its box. */
export function spotlight(focus: Focus[], t: number): { k: number; box: Focus["box"] } | null {
  const fs = [...focus].sort((a, b) => a.t - b.t);
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i];
    if (!f.spot) continue;
    const e = Math.min(f.t + f.dur, fs[i + 1]?.t ?? Infinity);
    if (t < f.t || t > e + 0.5) continue;
    const k = Math.min(f.spotK ?? 1, (t - f.t) / 0.6, (e + 0.5 - t) / 0.5);
    return { k: Math.max(0, k), box: f.spotBox ?? f.box };
  }
  return null;
}

/** The view a scene ends on, as a focus that holds until t = 0 of the next scene. A scene that opens
 * with a hard cut on the same page starts from it and eases out, so the cut reads as one shot. */
export function carryFocus(prev: Focus[], prevEnd: number, vw: number, vh: number): Focus | null {
  const c = camera(prev, prevEnd, vw, vh);
  const sp = spotlight(prev, prevEnd);
  if (c.s < 1.001 && !(sp && sp.k > 0)) return null;
  const w = (0.94 * vw) / c.s, h = (0.94 * vh) / c.s;
  const cx = c.lx + vw / c.s / 2, cy = c.ly + vh / c.s / 2;
  return {
    t: -10, dur: 10, box: { x: cx - w / 2, y: cy - h / 2, w, h }, maxScale: c.s,
    ...(sp && sp.k > 0 ? { spot: true, spotBox: sp.box, spotK: sp.k } : {}),
  };
}
