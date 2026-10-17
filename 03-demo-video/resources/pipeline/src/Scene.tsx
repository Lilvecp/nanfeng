import { Audio } from "@remotion/media";
// OffthreadVideo: frames are decoded by Remotion's compositor outside Chrome, which keeps memory low
// with 2400×1350 clips (the in-browser decoder ran the machine out of memory).
import { AbsoluteFill, Freeze, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, CHIP, F } from "./brand";
import { camera, spotlight, type Focus } from "./zoom";

export type Line = { say: string; en: string; zh: string; start: number; end: number; audio: string | null };
export type Mark = { name: string; t: number };
export type SceneT = {
  id: string; title: string; chips: (keyof typeof CHIP)[]; caption: { en: string; zh: string } | null;
  chapter: number; chapterStart: boolean; cut?: boolean; lead: number; duration: number; clip?: number;
  lines: Line[]; focus: Focus[]; marks: Mark[]; speed: { t: number; rate: number }[];
  notes: Record<string, string | number>; video: string | null;
};
export type Chapter = { id: string; en: string; zh: string };

// Layout of a 1920×1080 frame: the chapter rail on top, the recorded screen, then a band with the
// subtitles in the middle, the rubric chips on the left and the source of the footage on the right.
export const VIEW = { w: 1600, h: 900 }; // recorded viewport, CSS px
export const FRAME = { x: 160, y: 64, w: 1600, h: 900 };
const K = FRAME.w / VIEW.w;
export const BAND_TOP = FRAME.y + FRAME.h;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** 0 → 1 → 0 over [from, to] with fades of `f` seconds. */
function window_(t: number, from?: number, to?: number, f = 0.35) {
  if (from === undefined) return 0;
  const end = to ?? Infinity;
  return Math.max(0, Math.min(interpolate(t, [from, from + f], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), interpolate(t, [end - f, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
}

export function Scene({ scene, chapters }: { scene: SceneT; chapters: Chapter[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = camera(scene.focus, t, VIEW.w, VIEW.h);
  const mark = (name: string) => scene.marks.find((m) => m.name === name)?.t;
  const clipLast = scene.clip ? Math.round(scene.clip * fps) - 1 : Infinity;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: FRAME.x, top: FRAME.y, width: FRAME.w, height: FRAME.h, overflow: "hidden", borderRadius: 12, background: C.paper }}>
        {scene.video ? (
          // a scene a little longer than its recording holds the recording's last frame
          <Freeze frame={Math.min(frame, clipLast)} active={frame > clipLast}>
            <OffthreadVideo
              src={staticFile(scene.video)}
              muted
              style={{ position: "absolute", left: 0, top: 0, width: FRAME.w, height: FRAME.h, transformOrigin: "0 0", transform: `scale(${cam.s}) translate(${-cam.lx * K}px, ${-cam.ly * K}px)` }}
            />
          </Freeze>
        ) : (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 28, color: C.ink }}>
            {scene.id} · {scene.title} · not recorded yet
          </AbsoluteFill>
        )}
        <Spotlight scene={scene} t={t} cam={cam} />
        <FastForward scene={scene} t={t} />
        <Caption scene={scene} chapters={chapters} t={t} />
        <Callouts scene={scene} t={t} mark={mark} />
      </div>

      <Subtitles lines={scene.lines} t={t} />
      <Chips chips={scene.chips} />
      <Source t={t} mark={mark} />

      {scene.lines.map((l, i) =>
        l.audio ? (
          <Sequence key={i} from={Math.round(l.start * fps)} premountFor={fps}>
            <Audio src={staticFile(l.audio)} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
}

/** Dims and blurs everything around a `spot` focus box, so the eye goes to the right rows. */
export function Spotlight({ scene, t, cam }: { scene: SceneT; t: number; cam: { s: number; lx: number; ly: number } }) {
  const sp = spotlight(scene.focus, t);
  if (!sp || sp.k <= 0) return null;
  const x0 = Math.max(0, (sp.box.x - cam.lx) * cam.s * K);
  const y0 = Math.max(0, (sp.box.y - cam.ly) * cam.s * K);
  const x1 = Math.min(FRAME.w, (sp.box.x + sp.box.w - cam.lx) * cam.s * K);
  const y1 = Math.min(FRAME.h, (sp.box.y + sp.box.h - cam.ly) * cam.s * K);
  const shade = { position: "absolute", background: `rgba(14,23,38,${0.5 * sp.k})`, backdropFilter: `blur(${3 * sp.k}px)` } as const;
  return (
    <>
      <div style={{ ...shade, left: 0, top: 0, width: FRAME.w, height: y0 }} />
      <div style={{ ...shade, left: 0, top: y1, width: FRAME.w, height: FRAME.h - y1 }} />
      <div style={{ ...shade, left: 0, top: y0, width: x0, height: y1 - y0 }} />
      <div style={{ ...shade, left: x1, top: y0, width: FRAME.w - x1, height: y1 - y0 }} />
      <div style={{ position: "absolute", left: x0 - 2, top: y0 - 2, width: x1 - x0 + 4, height: y1 - y0 + 4, border: `2.5px solid rgba(201,168,102,${0.9 * sp.k})`, borderRadius: 8, boxShadow: `0 0 24px rgba(201,168,102,${0.25 * sp.k})` }} />
    </>
  );
}

/** "4×" while the recorder ran the scene clock faster than real time (a long agent run). */
export function FastForward({ scene, t, hold = 0.6 }: { scene: SceneT; t: number; hold?: number }) {
  const segs = scene.speed ?? [];
  let from: number | undefined, to: number | undefined, rate = 1;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].rate > 1) { from = segs[i].t; to = segs[i + 1]?.t ?? scene.duration; rate = segs[i].rate; break; }
  }
  const o = window_(t, from, to === undefined ? undefined : to + hold, 0.25);
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", right: 22, top: 22, opacity: o, display: "flex", alignItems: "center", gap: 12, background: "rgba(14,23,38,0.92)", color: C.text, borderRadius: 999, padding: "10px 20px 10px 16px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
      <svg width="30" height="20" viewBox="0 0 30 20"><path d="M2 2 L14 10 L2 18 Z M15 2 L27 10 L15 18 Z" fill={C.gold} /></svg>
      <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 26 }}>{rate}×</span>
      <span style={{ fontFamily: F.body, fontSize: 19, color: C.muted }}>real run · real timings</span>
    </div>
  );
}

/** What the viewer is looking at, for a few seconds when the scene starts. */
function Caption({ scene, chapters, t }: { scene: SceneT; chapters: Chapter[]; t: number }) {
  if (!scene.caption) return null;
  const o = window_(t, 0.35, 4.2, 0.4);
  if (o <= 0) return null;
  const ch = chapters[scene.chapter];
  const kicker = scene.chapterStart ? `Step ${scene.chapter + 1} of ${chapters.length} · ${ch.en}` : ch.en;
  return (
    <div style={{ position: "absolute", left: 22, bottom: 22, opacity: o, transform: `translateY(${(1 - ease(Math.min(1, (t - 0.35) / 0.5))) * 12}px)`, background: "rgba(14,23,38,0.93)", borderLeft: `5px solid ${C.gold}`, borderRadius: 10, padding: "14px 22px 14px 18px", display: "flex", flexDirection: "column", gap: 5, boxShadow: "0 10px 34px rgba(0,0,0,0.3)", maxWidth: 900 }}>
      <span style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold }}>{kicker}</span>
      <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 27, color: C.text, lineHeight: 1.2 }}>{scene.caption.en}</span>
      <span lang="zh-CN" style={{ fontFamily: F.zh, fontSize: 20, color: "#E6D3A6" }}>{scene.caption.zh}</span>
    </div>
  );
}

function Subtitles({ lines, t }: { lines: Line[]; t: number }) {
  const i = lines.findIndex((l, k) => t >= l.start - 0.08 && t < Math.min(l.end + 0.4, (lines[k + 1]?.start ?? Infinity) - 0.08));
  if (i < 0) return null;
  const l = lines[i];
  const hide = Math.min(l.end + 0.4, (lines[i + 1]?.start ?? Infinity) - 0.08);
  const o = interpolate(t, [l.start - 0.08, l.start + 0.07, hide - 0.15, hide], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 300, right: 300, top: BAND_TOP + 6, height: 1080 - BAND_TOP - 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, opacity: o, textAlign: "center" }}>
      <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 28, lineHeight: 1.22, color: C.text, letterSpacing: "0.003em", textWrap: "balance" }}>{l.en}</div>
      <div lang="zh-CN" style={{ fontFamily: F.zh, fontWeight: 400, fontSize: 24, lineHeight: 1.3, color: "#E6D3A6" }}>{l.zh}</div>
    </div>
  );
}

/** Rubric criteria the scene proves: filled pills, readable at phone size. */
function Chips({ chips }: { chips: SceneT["chips"] }) {
  if (!chips.length) return null;
  return (
    <div style={{ position: "absolute", left: 18, top: BAND_TOP, height: 1080 - BAND_TOP, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", gap: 7 }}>
      {chips.map((c) => (
        <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: CHIP[c].color, color: C.night, borderRadius: 999, padding: "5px 14px 5px 6px", whiteSpace: "nowrap", lineHeight: 1 }}>
          <span style={{ fontFamily: F.mono, fontWeight: 800, fontSize: 15, background: C.night, color: CHIP[c].color, borderRadius: 999, padding: "4px 7px" }}>{c}</span>
          <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 19 }}>{CHIP[c].label}</span>
        </span>
      ))}
    </div>
  );
}

/** Where the footage comes from: the live deploy, or the public block explorer. */
function Source({ t, mark }: { t: number; mark: (n: string) => number | undefined }) {
  const eth = mark("etherscan");
  const onChain = eth !== undefined && t >= eth - 0.1;
  return (
    <div style={{ position: "absolute", right: 22, top: BAND_TOP, height: 1080 - BAND_TOP, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: 5 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: F.mono, fontSize: 14, letterSpacing: "0.1em", color: "#8FCBA3" }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: "#8FCBA3", boxShadow: "0 0 10px #8FCBA3" }} />
        {onChain ? "PUBLIC TESTNET" : "LIVE SITE"}
      </span>
      <span style={{ fontFamily: F.mono, fontSize: 17, color: C.text }}>{onChain ? "sepolia.etherscan.io" : "nanfengcfo.com"}</span>
    </div>
  );
}

function Callout({ show, children, at = "bottom", right = false }: { show: number; children: React.ReactNode; at?: "bottom" | "top"; right?: boolean }) {
  if (show <= 0) return null;
  return (
    <div style={{ position: "absolute", [right ? "right" : "left"]: 22, [at]: 22, maxWidth: 1000, opacity: show, transform: `translateY(${(1 - show) * (at === "bottom" ? 10 : -10)}px)`, background: "rgba(14,23,38,0.93)", borderLeft: `5px solid ${C.gold}`, borderRadius: 10, padding: "14px 20px", color: C.text, boxShadow: "0 10px 34px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: 5 }}>
      {children}
    </div>
  );
}

const short = (h: unknown) => (typeof h === "string" && h.length > 12 ? `${h.replace(/^0x/, "").slice(0, 4)}…${h.slice(-4)}` : String(h ?? ""));

export function Callouts({ scene, t, mark }: { scene: SceneT; t: number; mark: (n: string) => number | undefined }) {
  const en = { fontFamily: F.body, fontSize: 23, fontWeight: 500, lineHeight: 1.3 } as const;
  const zh = { fontFamily: F.zh, fontSize: 19, color: "#E6D3A6", lineHeight: 1.3 } as const;
  const tag = { fontFamily: F.mono, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gold } as const;
  if (scene.id === "s03") {
    // the importer's letter, the file the owner sends
    const up = mark("upload");
    const o = window_(t, up === undefined ? undefined : up - 1.3, up === undefined ? undefined : up + 2.0, 0.35);
    if (o <= 0) return null;
    const fly = up === undefined ? 0 : ease(Math.min(1, Math.max(0, (t - up + 0.25) / 0.9)));
    return (
      <div style={{ position: "absolute", left: 120 + fly * 260, top: 150 - fly * 20, opacity: o, transform: `scale(${1 - fly * 0.35}) rotate(${-3 + fly * 3}deg)`, transformOrigin: "50% 50%", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <Img src={staticFile("notice.png")} style={{ width: 340, borderRadius: 6, boxShadow: "0 18px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)" }} />
        <span style={{ fontFamily: F.mono, fontSize: 17, background: "rgba(14,23,38,0.93)", color: C.text, borderRadius: 999, padding: "7px 16px" }}>hongxin-payment-notice.pdf</span>
      </div>
    );
  }
  if (scene.id === "s08") {
    const otp = mark("otp");
    return (
      <Callout show={window_(t, otp === undefined ? undefined : otp + 0.4, (mark("otp-end") ?? scene.duration) + 0.2)}>
        <span style={tag}>Sandbox code</span>
        <span style={en}>The demo shows the code on screen. In production, the owner gets a fresh one-time code by SMS.</span>
        <span style={zh}>演示中验证码显示在屏幕上；正式环境会通过短信向企业主发送新的一次性验证码。</span>
      </Callout>
    );
  }
  if (scene.id === "s10") {
    const eth = mark("etherscan");
    const input = mark("input");
    const n = scene.notes ?? {};
    const range = n.from !== undefined ? `${n.from}–${n.to}` : "";
    return (
      <>
        <Callout at="top" right show={window_(t, eth === undefined ? undefined : eth + 0.3, input ?? scene.duration + 1)}>
          <span style={tag}>sepolia.etherscan.io</span>
          <span style={en}>The anchor of this approval, on a public test network</span>
          <span style={zh}>这次批准的锚定交易，记录在公共测试网上</span>
        </Callout>
        <Callout at="top" show={window_(t, input === undefined ? undefined : input + 0.8, scene.duration + 1)}>
          <span style={tag}>Input data</span>
          <span style={en}>“NANFENG1” + Merkle root {short(n.root)}{range ? ` + audit entries ${range}` : ""}: the same root the API reports at /audit/anchors.</span>
          <span style={zh}>输入数据：“NANFENG1” + 默克尔根 {short(n.root)}{range ? ` + 审计记录 ${range}` : ""}，与 API 在 /audit/anchors 中报告的根一致。</span>
        </Callout>
      </>
    );
  }
  return null;
}
