// The problem, in four beats on the four approved lines of scene 1. Every beat lands on a word of the
// narration (CUE: seconds into each take, from Whisper word timestamps of public/audio/s01-0N.mp3).
// The last beat ends with NanFeng taking the empty finance seat, which hands over to "Meet NanFeng".
import type React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SailMark } from "../brand";
import { sectionFrames, type Section } from "./data";
import { breathe, Counter, Enter, exitK, float, Grade, Grain, ramp, Sfx } from "./fx";
import { theme as T } from "./theme";

const CUE = {
  usd: 0.6, cherries: 2.1, almost: 3.1, china: 4.04, // s01-01
  fruit: 0.24, weeks: 1.12, money: 1.86, months: 2.38, // s01-02
  family: 0.36, late: 1.5, missing: 2.86, // s01-03
  no: 1.2, // s01-04
};

const CENTER: React.CSSProperties = { top: 64, bottom: 1080 - 964, alignItems: "center", justifyContent: "center" };
const kicker: React.CSSProperties = { fontFamily: T.fonts.mono, fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase", color: T.colors.gold };
const display = (size: number, weight = 700): React.CSSProperties => ({ fontFamily: T.fonts.display, fontWeight: weight, fontSize: size, letterSpacing: "-0.02em", lineHeight: 1.05, color: T.colors.text });

export function Problem({ s }: { s: Section }) {
  const { fps } = useVideoConfig();
  const n = sectionFrames(s);
  const F = (sec: number) => Math.round(sec * fps);
  const L = s.lines.map((l) => ({ a: F(l.start), b: F(l.end) }));
  const at = (k: number, cue: number) => L[k].a + F(cue);
  // a beat leaves just before the next line starts; the next one comes in on it
  const out = [L[1].a - 8, L[2].a - 8, L[3].a - 8, n - T.t.exit - 1];
  const inn = [0, L[1].a - 2, L[2].a - 2, L[3].a - 2];
  return (
    <AbsoluteFill>
      <BeatTrade at={(c) => at(0, c)} start={inn[0]} exit={out[0]} />
      <BeatGap at={(c) => at(1, c)} start={inn[1]} exit={out[1]} />
      <BeatPayroll at={(c) => at(2, c)} start={inn[2]} exit={out[2]} />
      <BeatTeam at={(c) => at(3, c)} start={inn[3]} reveal={L[3].b - 2} exit={out[3]} />
      <Sfx name="whoosh" at={inn[1]} />
      <Sfx name="whoosh" at={inn[2]} />
      <Sfx name="whoosh" at={inn[3]} />
      <Grade />
      <Grain opacity={0.055} />
    </AbsoluteFill>
  );
}

type Beat = { at: (cue: number) => number; start: number; exit: number };
const visible = (f: number, start: number, exit: number) => f >= start - 1 && f <= exit + T.t.exit + 1;

/** "Chile ships USD 2.8 billion of cherries a season, almost all of it to China." */
function BeatTrade({ at, start, exit }: Beat) {
  const f = useCurrentFrame();
  if (!visible(f, start, exit)) return null;
  return (
    <AbsoluteFill style={CENTER}>
      <Enter at={start + 1} exitAt={exit}><span style={kicker}>Chile → China · one season</span></Enter>
      <Enter at={at(CUE.usd) - 4} exitAt={exit} style={{ marginTop: 26 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, transform: `scale(${breathe(f, 30, 0.008)})` }}>
          <span style={{ ...display(70, 600), color: T.colors.mist }}>USD</span>
          <Counter at={at(CUE.usd)} to={2.8} decimals={1} style={{ ...display(240), color: T.colors.gold, textShadow: `0 0 60px ${T.colors.glow}` }} />
          <span style={{ ...display(70, 600), color: T.colors.mist }}>billion</span>
        </div>
      </Enter>
      <Enter at={at(CUE.cherries) - 3} exitAt={exit} style={{ marginTop: 6 }}>
        <span style={{ fontFamily: T.fonts.body, fontSize: 40, color: T.colors.text, opacity: 0.86 }}>of cherries, every season</span>
      </Enter>
      <Route at={at} exit={exit} />
      <Sfx name="pop" at={at(CUE.china)} />
    </AbsoluteFill>
  );
}

/** The sea route from Chile to China, drawn on the words "almost all of it to China". */
function Route({ at, exit }: { at: (c: number) => number; exit: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1180, H = 250;
  const A = { x: 120, y: 190 }, B = { x: W - 120, y: 190 }, Cp = { x: W / 2, y: -50 };
  const q = (t: number) => ({ x: (1 - t) ** 2 * A.x + 2 * (1 - t) * t * Cp.x + t ** 2 * B.x, y: (1 - t) ** 2 * A.y + 2 * (1 - t) * t * Cp.y + t ** 2 * B.y });
  let len = 0;
  for (let i = 1, p = q(0); i <= 60; i++) { const c = q(i / 60); len += Math.hypot(c.x - p.x, c.y - p.y); p = c; }
  const draw = ramp(f, at(CUE.almost) - 6, at(CUE.china) + 2, T.ease.inOut);
  const x = exitK(f, exit);
  const node = (p: { x: number; y: number }, label: string, when: number, hero: boolean) => {
    const k = spring({ frame: f - when, fps, config: T.spring.bouncy });
    return (
      <g transform={`translate(${p.x} ${p.y}) scale(${k})`} opacity={k}>
        <circle r={hero ? 15 : 11} fill={hero ? T.colors.gold : T.colors.mist} />
        <circle r={hero ? 30 : 22} fill="none" stroke={hero ? T.colors.gold : T.colors.mist} strokeOpacity={0.35} strokeWidth={2} />
        <text y={58} textAnchor="middle" style={{ fontFamily: T.fonts.mono, fontSize: 24, letterSpacing: "0.18em", fill: T.colors.text }}>{label}</text>
      </g>
    );
  };
  const cherry = q(draw);
  return (
    <div style={{ marginTop: 34, opacity: 1 - x, transform: `translateY(${float(f, 40, 2) - x * 20}px)` }}>
      <svg width={W} height={H + 40} viewBox={`0 -40 ${W} ${H + 40}`} style={{ overflow: "visible" }}>
        <path d={`M${A.x} ${A.y} Q${Cp.x} ${Cp.y} ${B.x} ${B.y}`} fill="none" stroke={T.colors.mist} strokeOpacity={0.18} strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" />
        <path d={`M${A.x} ${A.y} Q${Cp.x} ${Cp.y} ${B.x} ${B.y}`} fill="none" stroke={T.colors.mist} strokeWidth={4} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
        {node(A, "CHILE", at(CUE.almost) - 10, false)}
        {node(B, "CHINA", at(CUE.china) - 2, true)}
        {draw > 0.01 && draw < 0.995 ? <Cherry x={cherry.x} y={cherry.y} /> : null}
      </svg>
    </div>
  );
}

function Cherry({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-2 -8 C 2 -22, 10 -26, 16 -30" stroke={T.colors.green} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={-6} cy={2} r={10} fill={T.colors.coral} />
      <circle cx={8} cy={-2} r={9} fill={T.colors.coral} opacity={0.85} />
      <circle cx={-9} cy={-1} r={3} fill="#fff" opacity={0.5} />
    </g>
  );
}

/** "The fruit arrives in three weeks. The money takes months." */
function BeatGap({ at, start, exit }: Beat) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!visible(f, start, exit)) return null;
  const TRACK = 900;
  const fruit = ramp(f, at(CUE.fruit), at(CUE.weeks) + 2) * (3 / 16);
  const money = ramp(f, at(CUE.money), exit + 4, T.ease.inOut);
  const row = (label: string, sub: string, fill: number, color: string, tag: string, tagAt: number, enterAt: number, hero: boolean) => {
    const tk = spring({ frame: f - tagAt, fps, config: T.spring.snappy });
    return (
      <Enter at={enterAt} exitAt={exit} style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ width: 300, textAlign: "right" }}>
          <div style={display(64)}>{label}</div>
          <div style={{ fontFamily: T.fonts.mono, fontSize: 18, letterSpacing: "0.12em", textTransform: "uppercase", color: T.colors.muted, marginTop: 6 }}>{sub}</div>
        </div>
        <div style={{ position: "relative", width: TRACK, height: 30, borderRadius: 30, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${fill * 100}%`, height: "100%", borderRadius: 30, background: color, boxShadow: hero ? `0 0 34px ${color}88` : undefined }} />
          <span style={{ position: "absolute", left: fill * TRACK + 18, top: -10, whiteSpace: "nowrap", opacity: tk, transform: `translateY(${interpolate(tk, [0, 1], [14, 0])}px)`, ...display(44), color }}>{tag}</span>
        </div>
      </Enter>
    );
  };
  const weeks = [0, 4, 8, 12, 16];
  return (
    <AbsoluteFill style={CENTER}>
      <Enter at={start + 1} exitAt={exit}><span style={kicker}>The cash gap</span></Enter>
      <div style={{ marginTop: 80, display: "flex", flexDirection: "column", gap: 84, transform: "translateX(-60px)" }}>
        {row("Fruit", "Chile → Shanghai", fruit, T.colors.mist, "3 weeks", at(CUE.weeks), start + 3, false)}
        {row("Money", "importer pays", money * 0.82, T.colors.coral, "months…", at(CUE.months), at(CUE.money) - 6, true)}
        <Enter at={start + 8} exitAt={exit} style={{ display: "flex", marginLeft: 340, width: TRACK, justifyContent: "space-between" }}>
          {weeks.map((w) => <span key={w} style={{ fontFamily: T.fonts.mono, fontSize: 17, color: T.colors.muted, letterSpacing: "0.08em" }}>{w === 16 ? "16 WEEKS" : `W${w}`}</span>)}
        </Enter>
      </div>
    </AbsoluteFill>
  );
}

/** "For a family exporter, one late payment can mean missing payroll." */
function BeatPayroll({ at, start, exit }: Beat) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!visible(f, start, exit)) return null;
  const stamp = (text: string, when: number, color: string) => {
    const k = spring({ frame: f - when, fps, config: T.spring.bouncy });
    return (
      <span style={{ position: "absolute", right: -26, top: -30, opacity: Math.min(1, k * 1.5), transform: `rotate(-9deg) scale(${interpolate(k, [0, 1], [1.7, 1])})`,
        border: `5px solid ${color}`, color, borderRadius: 12, padding: "6px 18px", ...display(46), background: "rgba(14,23,38,0.85)" }}>{text}</span>
    );
  };
  const card = (kick: string, title: string, sub: string, enterAt: number, st: React.ReactNode, hero: boolean) => (
    <Enter at={enterAt} exitAt={exit}>
      <div style={{ position: "relative", width: 480, padding: "34px 36px", borderRadius: 22, background: T.colors.card, border: `1.5px solid ${hero ? `${T.colors.coral}88` : T.colors.cardLine}`,
        boxShadow: hero ? `0 0 70px ${T.colors.coral}33` : "0 30px 70px rgba(0,0,0,0.35)", transform: `translateY(${float(f, 30, 3)}px)` }}>
        <div style={{ fontFamily: T.fonts.mono, fontSize: 18, letterSpacing: "0.14em", textTransform: "uppercase", color: T.colors.muted }}>{kick}</div>
        <div style={{ ...display(54), marginTop: 12 }}>{title}</div>
        <div style={{ fontFamily: T.fonts.body, fontSize: 24, color: T.colors.muted, marginTop: 10 }}>{sub}</div>
        {st}
      </div>
    </Enter>
  );
  const arrow = ramp(f, at(CUE.late) + 10, at(CUE.missing) - 2, T.ease.inOut);
  const x = exitK(f, exit);
  return (
    <AbsoluteFill style={CENTER}>
      <Enter at={at(CUE.family) - 6} exitAt={exit}><span style={kicker}>For a family exporter</span></Enter>
      <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 80 }}>
        {card("From the importer", "The payment", "for this season's fruit", start + 3, stamp("LATE", at(CUE.late) + 4, T.colors.gold), false)}
        <svg width={170} height={40} viewBox="0 0 170 40" style={{ opacity: 1 - x }}>
          {arrow > 0.02 ? <line x1={10} y1={20} x2={10 + 140 * arrow} y2={20} stroke={T.colors.mist} strokeWidth={5} strokeLinecap="round" /> : null}
          {arrow > 0.95 ? <path d="M138 6 L156 20 L138 34" fill="none" stroke={T.colors.mist} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /> : null}
        </svg>
        {card("Harvest payroll", "Wages", "for the pickers, on payday", start + 8, stamp("MISSED", at(CUE.missing) + 2, T.colors.coral), true)}
      </div>
      <Sfx name="pop" at={at(CUE.late) + 4} />
      <Sfx name="pop" at={at(CUE.missing) + 2} />
    </AbsoluteFill>
  );
}

/** "And most of them have no finance team to see it coming." Then NanFeng takes the empty seat. */
function BeatTeam({ at, start, exit, reveal }: Beat & { reveal: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!visible(f, start, exit)) return null;
  const gone = ramp(f, at(CUE.no), at(CUE.no) + 8);
  const r = spring({ frame: f - reveal, fps, config: T.spring.bouncy });
  const shake = f >= at(CUE.no) && f < at(CUE.no) + 10 ? Math.sin((f - at(CUE.no)) * 2.2) * 7 * (1 - (f - at(CUE.no)) / 10) : 0;
  const box = (label: string, enterAt: number, children?: React.ReactNode, style?: React.CSSProperties) => (
    <Enter at={enterAt} exitAt={exit} config={T.spring.snappy}>
      <div style={{ width: 300, height: 150, borderRadius: 20, background: T.colors.card, border: `1.5px solid ${T.colors.cardLine}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, ...style }}>
        {children ?? <span style={display(44, 600)}>{label}</span>}
      </div>
    </Enter>
  );
  const line = ramp(f, start + 6, start + 18, T.ease.inOut);
  const x = exitK(f, exit);
  const finance = (
    <div style={{ position: "relative", width: 300, height: 150, transform: `translateX(${shake}px)` }}>
      {/* the empty seat */}
      <div style={{ position: "absolute", inset: 0, borderRadius: 20, border: `3px dashed ${T.colors.coral}`, opacity: gone * (1 - r), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ ...display(54), color: T.colors.coral }}>?</span>
        <span style={{ fontFamily: T.fonts.mono, fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase", color: T.colors.coral }}>no finance team</span>
      </div>
      {/* the seat before it empties */}
      <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: T.colors.card, border: `1.5px solid ${T.colors.cardLine}`, opacity: 1 - gone, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={display(44, 600)}>Finance</span>
      </div>
      {/* NanFeng takes it */}
      <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: "rgba(31,51,88,0.95)", border: `2.5px solid ${T.colors.gold}`, boxShadow: `0 0 60px ${T.colors.glow}`, opacity: Math.min(1, r * 1.4),
        transform: `scale(${interpolate(r, [0, 1], [0.7, 1])})`, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <SailMark size={70} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={display(40)}>NanFeng</span>
          <span style={{ fontFamily: T.fonts.mono, fontSize: 16, letterSpacing: "0.14em", color: T.colors.gold }}>AI CFO</span>
        </div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ ...CENTER, paddingBottom: 30 }}>
      <Enter at={start + 1} exitAt={exit}><span style={kicker}>A family business</span></Enter>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${float(f, 38, 4)}px) scale(${breathe(f, 44, 0.008)})` }}>
      <div style={{ marginTop: 60 }}>{box("Owner", start + 2, undefined, { background: "rgba(201,214,240,0.12)" })}</div>
      <svg width={1100} height={90} viewBox="0 0 1100 90" style={{ opacity: 1 - x }}>
        {[180, 550, 920].map((x2) => (
          <path key={x2} d={`M550 0 L550 40 L${x2} 40 L${x2} 90`} fill="none" stroke={T.colors.mist} strokeOpacity={0.4} strokeWidth={3} strokeDasharray={600} strokeDashoffset={600 * (1 - line)} />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 70 }}>
        {box("Harvest", start + 8)}
        {box("Sales", start + 12)}
        <Enter at={start + 16} exitAt={exit} config={T.spring.snappy}>{finance}</Enter>
      </div>
      </div>
      <Sfx name="pop" at={reveal} />
    </AbsoluteFill>
  );
}

