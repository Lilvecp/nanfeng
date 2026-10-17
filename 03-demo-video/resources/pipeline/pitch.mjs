// The pitch cut, the submitted video. Every app shot is a piece of a scene of its own live take
// (node record/record.mjs --pitch → public/rec/pitch/), recorded on the scenario's clock: the letter
// reaches the agent at 10:12 and the owner approves at 10:15. Motion-graphics sections (the problem,
// the results, the tagline, the team) are drawn in Remotion. The narration is the team's approved
// ElevenLabs takes plus new takes in the same voice where the cut needs other words
// (tts/pitch-voice.mjs).
//
// A section is one of:
//   card  a title card (Opening, EndCard) of fixed length
//   mg    a motion-graphics scene; its narration lines follow each other with `gap` seconds between
//   shot  pieces of one recorded scene, played in order; a line placed with `src` starts at that time
//         of the scene clock (so the picture stays in sync with the words), one placed with `at` at
//         that offset into the section. `refocus` replaces the box of one of the recorder's zooms
//         ({ index: { box, maxScale } }, viewport px), when the cut wants a tighter frame
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
const P_TAG_25 = "Across fifty benchmark cases, NanFeng solved all fifty. On the twenty-five that needed financing, it cost forty-one percent less than the bank loan, on average.";
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
  // Third review (Oct 16): the claims as the deck, the web and deliverables 01 and 05 now word them
  // (an AI CFO acting with the owner's approval, tamper-evident, masked before any language model,
  // WeCom simulated, -41% on the 25 cases that need financing), the Business health screen, the
  // owner's WhatsApp thread, "three minutes" from the letter to the approval, and the judges' try-it path.
  { id: "s02-01-ai", say: "Meet Huerto Austral, a fictional cherry exporter, and NanFeng: an AI CFO that acts with the owner's approval.",
    previous: "And most of them have no finance team to see it coming.", next: "Then, bad news from Shanghai: the buyer will pay one hundred eighty thousand dollars forty-five days late.",
    en: "Meet Huerto Austral, a fictional cherry exporter, and NanFeng: an AI CFO that acts with the owner's approval.", zh: "这是虚构的樱桃出口商 Huerto Austral，以及南风：经企业主批准才行动的 AI CFO。" },
  { id: "p04-health-a", say: "It also checks the health of the whole business.",
    previous: "Before the notice, that risk was thirteen percent.", next: "One buyer in Shanghai brings fifty-eight percent of the cash due in the next ninety days, so one delay moves the whole season.",
    en: "It also checks the health of the whole business.", zh: "它还会检查整个企业的经营健康状况。" },
  { id: "p04-health-b", say: "One buyer in Shanghai brings fifty-eight percent of the cash due in the next ninety days, so one delay moves the whole season.",
    previous: "It also checks the health of the whole business.", next: "Then it shops the market for the owner.",
    en: "One buyer in Shanghai brings 58% of the cash due in the next 90 days, so one delay moves the whole season.", zh: "一位上海买家占未来90天应收现金的58%，一笔延迟就会牵动整个季节。" },
  { id: "p06-whatsapp", say: "The owner gets the alert and the plan on WhatsApp, and can ask why.",
    previous: "Forty-five percent cheaper, and it explains why every other option lost.", next: "Every number comes from the optimizer, not from the language model.",
    en: "The owner gets the alert and the plan on WhatsApp, and can ask why.", zh: "企业主在 WhatsApp 上收到预警和方案，还可以问“为什么”。" },
  { id: "s09-three", say: "From the importer's letter to an approved loan: three minutes.",
    previous: "The payroll is covered, and the owner saved one point seven million pesos against a regular bank loan.", next: "Every step, including this approval, is sealed in a tamper-evident audit log.",
    en: "From the importer's letter to an approved loan: three minutes.", zh: "从进口商来信到贷款获批：只用了三分钟。" },
  { id: "s10-01-evident", say: "Every step, including this approval, is sealed in a tamper-evident audit log.",
    previous: "From the importer's letter to an approved loan: three minutes.", next: P_SEPOLIA,
    en: "Every step, including this approval, is sealed in a tamper-evident audit log.", zh: "每一步，包括这次批准，都记录在审计日志中，任何篡改都会留下痕迹。" },
  { id: "s11-03-lm", say: "NanFeng quarantined it before any language model could read it, and warned the owner.",
    previous: "plus a hidden line, white on white, telling the AI to approve the payment.", next: "Our red team threw forty-six attacks at it. All forty-six were stopped.", seed: 5,
    en: "NanFeng quarantined it before any language model could read it, and warned the owner.", zh: "南风在任何语言模型读取之前就将其隔离，并提醒了企业主。" },
  { id: "s12-02-sim", say: "And on WeCom, China's business chat, simulated in this demo, every message to the importer is labelled as AI-generated, as Chinese rules require.",
    previous: "NanFeng also speaks Chinese.", next: P_TAG_25,
    en: "And on WeCom, China's business chat, simulated in this demo, every message to the importer is labelled as AI-generated, as Chinese rules require.",
    zh: "在企业微信（本演示为模拟）上，发给进口商的每条消息都按中国规定标注“由AI生成”。" },
  { id: "s13-01-25", say: P_TAG_25, previous: "NanFeng also speaks Chinese.", next: "NanFeng doesn't advise.",
    en: "Across 50 benchmark cases, NanFeng solved all 50. On the 25 that needed financing, it cost 41% less than the bank loan, on average.",
    zh: "在50个基准案例中，南风全部解决；在需要融资的25个案例中，成本平均比银行贷款低41%。" },
  { id: "s14-04-two", say: "Try it yourself in two minutes, at Nan Feng C F O dot com.", previous: N_TAG,
    en: "Try it yourself in two minutes at www.nanfengcfo.com", zh: "两分钟亲自体验：www.nanfengcfo.com" },
];

// One sentence out of an approved take, cut inside the pause next to it (seconds into the clip).
export const SPLITS = [
  { id: "s03-05a", from: "s03-05", start: 0, end: 1.55, en: "All of that took under a minute.", zh: "整个过程不到一分钟。" },
  { id: "s05-01a", from: "s05-01", start: 0, end: 2.15, en: "Then it shops the market for the owner.", zh: "接着，它替企业主货比三家。" },
  { id: "s07-02b", from: "s07-02", start: 3.15, en: "Every number comes from the optimizer, not from the language model.", zh: "每个数字都来自优化器，而不是语言模型。" },
  { id: "s12-01a", from: "s12-01", start: 0, end: 2.4, en: "NanFeng also speaks Chinese.", zh: "南风也说中文。" },
];

// The voice, third pass (Oct 17): every line of the cut again, in the team's voice on ElevenLabs v3,
// which takes a delivery direction per line, so the narration follows the story: worry in the problem,
// energy when NanFeng finds the deal, calm firmness on security, pride at the end. The subtitles stay
// as written above. Numbers are spelled out; the URL is read as written (v3 says it right).
export const VOICE_V3 = {
  model: "eleven_v3", stability: 0.5, seed: 7,
  // takes voiced again with another seed: an added word, "NanFeng" misread, a clipped plural
  seeds: { "s04-02": 21, "s11-03-lm": 47, "s05-02": 21 },
  lines: {
    "s01-01": "[serious] Chile ships two point eight billion dollars of cherries a season, almost all of it to China.",
    "s01-02": "[concerned] The fruit arrives in three weeks. The money takes months.",
    "s01-03": "[worried] For a family exporter, one late payment can mean missing payroll.",
    "s01-04": "[serious] And most of them have no finance team to see it coming.",
    "s02-01-ai": "[warmly] Meet Huerto Austral, a fictional cherry exporter, [excited] and NanFeng: an AI CFO that acts with the owner's approval.",
    "s02-04": "[concerned] Then, bad news from Shanghai: the buyer will pay one hundred eighty thousand dollars forty-five days late.",
    "s03-01": "[upbeat] The owner simply forwards the importer's letter to NanFeng.",
    "s03-03": "[excited] It reads the letter, re-runs ten thousand cash simulations, and prices every financing option.",
    "s03-04": "[confident] Every step is on the record: which tool, which model, how long it took.",
    "s04-01": "[serious] The verdict: an eighty-one percent chance that cash runs out on December thirtieth, exactly on payroll day.",
    "s04-02": "[concerned] Before the notice, that risk was thirteen percent.",
    "p04-health-a": "[curious] It also checks the health of the whole business.",
    "p04-health-b": "[serious] One buyer in Shanghai brings fifty-eight percent of the cash due in the next ninety days, so one delay moves the whole season.",
    "s05-01a": "[upbeat] Then it shops the market for the owner.",
    "s05-02": "[confident] Its optimizer picks a sixty-day pre-export loan in dollars:",
    "s05-03": "[excited] two point one million pesos, against three point eight million for the usual bank loan.",
    "s05-04": "[excited] Forty-five percent cheaper, and it explains why every other option lost.",
    "p06-whatsapp": "[friendly] The owner gets the alert and the plan on WhatsApp, and can ask why.",
    "s07-02b": "[confident] Every number comes from the optimizer, not from the language model.",
    "s08-01": "[serious] Borrowing is a level-three action: only the owner can approve it, with a one-time code.",
    "s08-03": "[firmly] The agent can propose. It can never approve.",
    "s09-01": "[relieved] Approved, and executed in the sandbox.",
    "s09-02": "[happy] The payroll is covered, and the owner saved one point seven million pesos against a regular bank loan.",
    "s09-three": "[impressed] From the importer's letter to an approved loan: three minutes.",
    "s10-01-evident": "[confident] Every step, including this approval, is sealed in a tamper-evident audit log.",
    "s10-02": "[confident] Its fingerprint is written to a public blockchain.",
    "s10-03-sepolia": "[confident] Here's that transaction on Sepolia, the Ethereum test network.",
    "s10-05": "[firmly] No one can quietly change it. Not the agent, and not even us.",
    "s11-01": "[serious] Fraud is the other threat. At eight forty-seven that morning, a supplier's invoice arrived with a new bank account,",
    "s11-02": "[tense] plus a hidden line, white on white, telling the AI to approve the payment.",
    "s11-03-lm": "[reassuring] NanFeng quarantined it before any language model could read it, and warned the owner.",
    "s11-04": "[proud] Our red team threw forty-six attacks at it. All forty-six were stopped.",
    "s12-01a": "[cheerful] NanFeng also speaks Chinese.",
    "s12-02-sim": "[warmly] And on WeCom, China's business chat, simulated in this demo, every message to the importer is labelled as AI-generated, as Chinese rules require.",
    "s13-01-25": "[proud] Across fifty benchmark cases, NanFeng solved all fifty. On the twenty-five that needed financing, it cost forty-one percent less than the bank loan, on average.",
    "s13-02-tagline-a": "[confident] NanFeng doesn't advise.",
    "s13-02-tagline-b": "[excited] It acts, with your permission.",
    "s14-01": "[warmly] Behind NanFeng are five students from Universidad del Desarrollo, in Chile:",
    "s14-04-two": "[excited] Try it yourself in two minutes, at www.nanfengcfo.com.",
  },
};

const caption = (id) => SCENES.find((s) => s.id === id)?.caption ?? null;

export const CUT = [
  { id: "open", kind: "card", card: "Opening", dur: 2.2 },
  { id: "problem", kind: "mg", mg: "Problem", chapter: "problem", chips: [], head: 0.4, gap: 0.32, tail: 1.15,
    lines: ["s01-01", "s01-02", "s01-03", "s01-04"] },
  // Demo Mode, step 1: the state before NanFeng acts (13%, no plan yet, the letter in Chinese)
  { id: "before", kind: "shot", scene: "p02", chapter: "problem", chips: ["TC", "II"],
    caption: { en: "Demo Mode, step 1 · the morning of the notice: 13% risk, no plan yet", zh: "演示模式第1步 · 通知当天上午：风险13%，尚无方案" },
    pieces: [{ from: 0.5, to: 18.0 }], lines: [{ clip: "s02-01-ai", src: 0.95 }, { clip: "s02-04", src: 9.63 }] },
  // the letter goes to the live agent at 10:12 (the card alone, in a spotlight), then its live events at 4×
  { id: "agent", kind: "shot", scene: "s03", chapter: "risk", chips: ["TC", "II"], caption: caption("s03"),
    // the wait on Home while the run fills the stream is cut (the frames either side are the same)
    pieces: [{ from: 0.9, to: 12.1 }, { from: 14.15, to: 20.2 }],
    lines: [{ clip: "s03-01", src: 1.35 }, { clip: "s03-03", src: 4.85 }, { clip: "s03-04", src: 14.45 }] },
  { id: "verdict", kind: "shot", scene: "s04", chapter: "risk", chips: ["TC"], caption: caption("s04"),
    pieces: [{ from: 2.9, to: 14.65 }], lines: [{ clip: "s04-01", src: 3.3 }, { clip: "s04-02", src: 10.8 }] },
  { id: "health", kind: "shot", scene: "p04", chapter: "risk", chips: ["TC"],
    caption: { en: "Business health · the whole business at a glance", zh: "经营健康 · 企业全貌一目了然" },
    // the 58% finding and the "Largest customer" card, without the right half of the row
    refocus: { 1: { box: { x: 236, y: 236, w: 1014, h: 316 }, maxScale: 1.6 } },
    pieces: [{ from: 1.8, to: 14.3 }], lines: [{ clip: "p04-health-a", src: 2.0 }, { clip: "p04-health-b", src: 4.8 }] },
  { id: "deal", kind: "shot", scene: "s05", chapter: "deal", chips: ["TC"], caption: caption("s05"),
    // one piece: "picks a 60-day pre-export loan" lands on the click on that loan, "3.8 million" on the
    // cost chart, "why every other option lost" on the reasons
    pieces: [{ from: 1.1, to: 21.5 }],
    lines: [{ clip: "s05-01a", src: 1.4 }, { clip: "s05-02", src: 3.75 }, { clip: "s05-03", src: 8.2 }, { clip: "s05-04", src: 15.15 }] },
  // the owner's WhatsApp thread as the app shows it (labelled a recorded replay on the page)
  { id: "whatsapp", kind: "shot", scene: "p06", chapter: "deal", chips: ["II"],
    caption: { en: "Messages · the owner's WhatsApp (recorded replay)", zh: "消息 · 企业主的 WhatsApp（录制回放）" },
    pieces: [{ from: 1.9, to: 6.35 }], lines: [{ clip: "p06-whatsapp", src: 2.3 }] },
  { id: "why", kind: "shot", scene: "s07", chapter: "deal", chips: ["II", "SC"], caption: caption("s07"),
    pieces: [{ from: 9.0, to: 13.7 }], lines: [{ clip: "s07-02b", src: 9.75 }] },
  { id: "approve", kind: "shot", scene: "s08", chapter: "approve", chips: ["SC", "II"], caption: caption("s08"),
    // the code being typed, then the owner's click right after "never approve"
    pieces: [{ from: 1.0, to: 6.75 }, { from: 9.1, to: 10.7 }, { from: 14.55, to: 17.8 }],
    lines: [{ clip: "s08-01", src: 1.4 }, { clip: "s08-03", at: 6.45 }] },
  // the receipt (approved 10:15), Home, then the day's list: the letter at 10:12, done at 10:15
  { id: "done", kind: "shot", scene: "s09", join: "cut", chapter: "approve", chips: ["TC"],
    pieces: [{ from: 0.5, to: 11.1 }, { from: 17.3, to: 22.4, join: "dip" }],
    lines: [{ clip: "s09-01", src: 0.8 }, { clip: "s09-02", src: 4.43 }, { clip: "s09-three", src: 17.5 }] },
  { id: "proof", kind: "shot", scene: "s10", chapter: "proof", chips: ["ON", "SC"], caption: caption("s10"),
    // the spotlight on this take's rows, from the reset (sandbox.seeded) to the approval's anchor; the
    // rows under it are the previous sandbox's (a reset keeps the chain)
    refocus: { 0: { dur: 3.6, spot: true, spotBox: { x: 226, y: 338, w: 1360, h: 340 } } },
    pieces: [{ from: 1.0, to: 13.85 }, { from: 18.85, to: 24.3, join: "dip" }],
    lines: [{ clip: "s10-01-evident", src: 1.2 }, { clip: "s10-02", src: 7.0 }, { clip: "s10-03-sepolia", src: 10.15 }, { clip: "s10-05", src: 19.1 }] },
  { id: "fraud", kind: "shot", scene: "s11", chapter: "fraud", chips: ["SC"], caption: caption("s11"),
    pieces: [{ from: 0.55, to: 25.5 }], lines: [{ clip: "s11-01", src: 1.0 }, { clip: "s11-02", src: 8.4 }, { clip: "s11-03-lm", src: 14.5 }, { clip: "s11-04", src: 19.55 }] },
  { id: "china", kind: "shot", scene: "s12", chapter: "china", chips: ["II", "SC"], caption: caption("s12"),
    // "Chinese" lands as the screen switches to 中文
    // the Messages page shows Documents for a moment before the WeCom thread: cut straight to the thread
    // "WeCom" lands on the cut to the importer's thread
    pieces: [{ from: 1.55, to: 5.2 }, { from: 8.95, to: 18.4, join: "dip" }],
    lines: [{ clip: "s12-01a", src: 1.9 }, { clip: "s12-02-sim", src: 4.45 }] },
  { id: "results", kind: "mg", mg: "Results", chapter: "team", chips: ["TC", "II"], head: 0.35, gap: 0.5, tail: 1.0,
    lines: ["s13-01-25", { clip: "s13-02-tagline-a", gap: 0.55 }, { clip: "s13-02-tagline-b", gap: 0.42 }] },
  { id: "team", kind: "mg", mg: "Team", chapter: "team", chips: [], head: 0.3, gap: 0.5, tail: 0.7,
    lines: ["s14-01", "s14-04-two"] },
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
      const meta = JSON.parse(fs.readFileSync(new URL(`./public/rec/pitch/${s.scene}.json`, import.meta.url), "utf8"));
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
      out.video = `rec/pitch/${s.scene}.mp4`;
      out.clip = meta.duration;
      out.focus = (meta.focus ?? []).map((f, i) => (s.refocus?.[i] ? { ...f, ...s.refocus[i] } : f));
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
    "The app shots are one live take on https://www.nanfengcfo.com, on the scenario's clock (the letter reaches the agent at 10:12, the owner approves at 10:15); the problem, results and team sections are motion graphics.",
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
