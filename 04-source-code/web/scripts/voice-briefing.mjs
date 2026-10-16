// The 10:13 alert call (Messages screen) in ES / EN / 中文, voiced by ElevenLabs.
// Run from web/: `npm run voice:briefing` with ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID)
// in the repo's .env. Writes public/audio/briefing-<lang>.mp3 and src/data/briefing.json with each
// line's real start time from ElevenLabs' character alignment, so the transcript follows the audio.
// `--text-only` rewrites briefing.json (estimated timing, no audio) without calling the API.
// The key is only read here; it never reaches the repo or the browser.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const S = JSON.parse(readFileSync(join(here, "..", "src", "data", "cherry-crisis.json"), "utf8"));
const out = join(here, "..", "src", "data", "briefing.json");
const audioDir = join(here, "..", "public", "audio");
const textOnly = process.argv.includes("--text-only");

// .env in 04-source-code/, next to .env.example (KEY=value lines); real environment variables win
const env = { ...Object.fromEntries((existsSync(join(root, ".env")) ? readFileSync(join(root, ".env"), "utf8") : "")
  .split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean)
  .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")])), ...process.env };
const KEY = env.ELEVENLABS_API_KEY;
const VOICE = env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // premade multilingual voice
const MODEL = "eleven_multilingual_v2";

// Spoken numbers from the scenario (same sources as the screens).
const pct = (p) => Math.round(p * 100);
const pNeg = pct(S.after.probNegByCrunch);
const delay = S.event.delay_days;
const cashM = Math.round(S.openingCashClp / 1e6);
const savM = (S.plan.savings_clp / 1e6).toFixed(1);
const savingsPct = pct(S.plan.savings_pct);
const day = Number(S.after.crunchDate.slice(8, 10));

const LINES = {
  es: [
    `Buenos días, habla NanFeng. Caja de hoy: ${cashM} millones de pesos.`,
    `Shanghai Hongxin pagará con ${delay} días de atraso. Hay ${pNeg} por ciento de riesgo de que no alcance para los sueldos de la cosecha del ${day} de diciembre.`,
    `Encontré un crédito de pre-exportación ${savM.replace(".", ",")} millones de pesos más barato que el crédito del banco. Te lo dejé para aprobar con tu código.`,
  ],
  en: [
    `Good morning, this is NanFeng. Cash today: ${cashM} million pesos.`,
    `Shanghai Hongxin will pay ${delay} days late. There is an ${pNeg} percent risk of not covering the harvest payroll on December ${day}.`,
    `I found a pre-export loan ${savM} million pesos cheaper than the bank loan, ${savingsPct} percent less. It is waiting for your approval code.`,
  ],
  zh: [
    `早上好，我是南风。今日现金${(S.openingCashClp / 1e8).toFixed(2)}亿智利比索。`,
    `上海鸿信将延迟${delay}天付款，12月${day}日的采收工资有百分之${pNeg}的风险无法足额发放。`,
    `我找到一笔出口前融资，比银行贷款便宜${savM}百万比索，已提交给您，请用验证码批准。`,
  ],
};

async function voice(lang) {
  const text = LINES[lang].join(" ");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, ...(lang === "zh" ? {} : { language_code: lang }) }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${lang}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const { audio_base64: b64, alignment } = await res.json();
  mkdirSync(audioDir, { recursive: true });
  writeFileSync(join(audioDir, `briefing-${lang}.mp3`), Buffer.from(b64, "base64"));
  // each line starts where its first character is spoken
  let offset = 0;
  const lines = LINES[lang].map((t) => {
    const at = alignment.character_start_times_seconds[offset] ?? 0;
    offset += t.length + 1;
    return { at: Math.round(at * 10) / 10, text: t };
  });
  const ends = alignment.character_end_times_seconds;
  return { audio: `/audio/briefing-${lang}.mp3`, duration: Math.ceil(ends[ends.length - 1] ?? 0), lines };
}

function estimate(lang) {
  const perChar = lang === "zh" ? 0.22 : 0.065; // rough speaking pace, used only without audio
  let t = 0;
  const lines = LINES[lang].map((text) => {
    const line = { at: Math.round(t * 10) / 10, text };
    t += text.length * perChar + 0.6;
    return line;
  });
  return { audio: null, duration: Math.ceil(t), lines };
}

if (!textOnly && !KEY) {
  console.error("ELEVENLABS_API_KEY is not set (repo .env or environment). Use --text-only to skip the audio.");
  process.exit(1);
}
const data = {};
for (const lang of ["es", "en", "zh"]) {
  data[lang] = textOnly ? estimate(lang) : await voice(lang);
  console.log(`${lang}: ${data[lang].duration}s${data[lang].audio ? ` -> public${data[lang].audio}` : " (text only)"}`);
}
data.voice = textOnly ? null : { provider: "ElevenLabs", model: MODEL, voice_id: VOICE };
writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
console.log(`wrote ${out}`);
