import data from "@/data/cherry-crisis.json";
import type { Lang } from "./prefs";

// Single source for every Cherry Crisis number in the web. The JSON is generated from the quant
// engine's results (vicente-rodriguez/results) by `npm run sync:scenario`; never edit it by hand.

export const S = data;

export const PLAN = S.plan.actions[0];
export const RECEIVABLE = S.receivables.find((r) => r.id === S.event.invoice)!;

const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-CL", zh: "zh-CN" };
const num = (v: number, lang: Lang, digits = 0) =>
  v.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 0.8128 → "81%" */
export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Compact CLP: "CLP 2.1M" · "CLP 2,1M" · "211万智利比索". */
export function clpM(v: number, lang: Lang = "en") {
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (lang === "zh") return `${sign}${num(Math.round(a / 1e4), "zh")}万智利比索`;
  return `${sign}CLP ${num(a / 1e6, lang, a >= 1e8 ? 0 : 1)}M`;
}

/** Full CLP for tables, grouped the way the reader writes numbers: "CLP 176,000,000" · "CLP $176.000.000" · "176,000,000 智利比索". */
export function clpFull(v: number, lang: Lang = "en") {
  const n = num(Math.round(Math.abs(v)), lang);
  const sign = v < 0 ? "−" : "";
  if (lang === "zh") return `${sign}${n} 智利比索`;
  return lang === "es" ? `${sign}CLP $${n}` : `${sign}CLP ${n}`;
}

/** Cash in the top bar: one compact format everywhere, plus yuan in the 中文 view. */
export const cashTick = (v: number, lang: Lang = "en") => (lang === "zh" ? `${clpM(v, "zh")} · ${cny(v)}` : clpM(v, lang));

/** An amount in its own currency, for mixed tables: "CNY 450,000" · "CNY 450.000" · "450,000 元". */
export function money(v: number, currency: "CLP" | "USD" | "CNY", lang: Lang = "en") {
  if (currency === "CLP") return clpFull(v, lang);
  if (currency === "USD") return usd(v, lang);
  return lang === "zh" ? `${num(v, "zh")} 元` : `CNY ${num(v, lang)}`;
}

/** "USD 180,000" · "USD 180.000" · "180,000 美元" */
export function usd(v: number, lang: Lang = "en") {
  return lang === "zh" ? `${num(v, "en")} 美元` : `USD ${num(v, lang)}`;
}

/** Short date: "Dec 30" · "30 dic" · "12月30日". ISO (2026-12-30) is kept for tables. */
export function shortDate(iso: string, lang: Lang = "en") {
  const d = new Date(`${iso}T12:00:00`);
  if (lang === "zh") return `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.toLocaleDateString(LOCALE[lang], { month: "short", day: "numeric" }).replace(".", "");
}

/** Long date for plain-language copy: "December 30" · "30 de diciembre" · "12月30日". */
export function longDate(iso: string, lang: Lang = "en") {
  const d = new Date(`${iso}T12:00:00`);
  if (lang === "zh") return `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.toLocaleDateString(LOCALE[lang], { month: "long", day: "numeric" });
}

/** Pesos the way an owner says them: "CLP 238 million" · "$238 millones" · "2.38亿智利比索". */
export function pesos(v: number, lang: Lang = "en") {
  const m = Math.abs(v) / 1e6;
  // one decimal below 100 million, like clpM, so the same amount never reads 16.7 here and 17 there
  const n = m < 100 ? num(m, lang, 1) : num(Math.round(m), lang);
  if (lang === "es") return `$${n} millones`;
  if (lang === "zh") return Math.abs(v) >= 1e8 ? `${num(Math.abs(v) / 1e8, "zh", 2)}亿智利比索` : `${num(Math.round(Math.abs(v) / 1e4), "zh")}万智利比索`;
  return `CLP ${n} million`;
}

/** 0.8128 → 8 (out of 10). */
export const outOf10 = (p: number) => Math.round(p * 10);

/** Days between the as-of date and an ISO date. */
export const dayOf = (iso: string) => Math.round((Date.parse(iso) - Date.parse(S.asOf)) / 864e5);

/** Short product labels for charts and tags. */
export const PRODUCT_SHORT: Record<string, string> = {
  "Export factoring, non-recourse (bank)": "Factoring (bank)",
  "Pre-export loan in USD (PAE)": "PAE loan (USD)",
  "Working capital loan (default bank credit)": "Bank loan",
  "Credit line / overdraft": "Credit line",
  "Fintech factoring, with recourse (fast onboarding)": "Factoring (fintech)",
  "Confirming (supplier payment extension)": "Confirming",
  "FOGAPE-guaranteed working capital loan": "FOGAPE loan",
  "CNY forward (sell CNY, cash-settled)": "CNY forward",
  "Letter of credit discounting": "LC discounting",
};

const PRODUCT_SHORT_L: Record<string, Record<Exclude<Lang, "en">, string>> = {
  "Pre-export loan in USD (PAE)": { es: "Crédito PAE (USD)", zh: "PAE 贷款（美元）" },
  "Export factoring, non-recourse (bank)": { es: "Factoring (banco)", zh: "保理（银行）" },
  "Fintech factoring, with recourse (fast onboarding)": { es: "Factoring (fintech)", zh: "保理（金融科技）" },
  "Confirming (supplier payment extension)": { es: "Confirming", zh: "Confirming" },
  "Working capital loan (default bank credit)": { es: "Crédito bancario", zh: "银行贷款" },
  "FOGAPE-guaranteed working capital loan": { es: "Crédito FOGAPE", zh: "FOGAPE 贷款" },
  "Credit line / overdraft": { es: "Línea de crédito", zh: "信用额度" },
  "CNY forward (sell CNY, cash-settled)": { es: "Forward CNY", zh: "人民币远期" },
  "Letter of credit discounting": { es: "Descuento de carta de crédito", zh: "信用证贴现" },
};
/** Short product label in the view language. */
export const productShort = (p: string, lang: Lang = "en") =>
  lang === "en" ? PRODUCT_SHORT[p] ?? p : PRODUCT_SHORT_L[p]?.[lang] ?? PRODUCT_SHORT[p] ?? p;

/** CLP in yuan for the 中文 view, at the scenario's BCCh / FRED rate: "约 1.4 万元" · "约 162 万元". */
export function cny(clp: number) {
  const y = Math.abs(clp) / S.fx.clp_per_cny;
  if (y >= 1e4) return `约 ${num(y / 1e4, "zh", y >= 1e6 ? 0 : 1)} 万元`;
  return `约 ${num(Math.round(y), "zh")} 元`;
}

const PRESET_NAME: Record<string, Record<Lang, string>> = {
  "Base (after the Shanghai notice)": { en: "Base · after the Shanghai notice", es: "Base · tras el aviso de Shanghái", zh: "基准 · 上海通知之后" },
  "Before the notice": { en: "Before the notice", es: "Antes del aviso", zh: "通知之前" },
  "All customers +15 days late": { en: "All customers +15 days late", es: "Todos los clientes +15 días", zh: "所有客户再延迟15天" },
  "CNY -5% vs CLP": { en: "CNY −5% vs CLP", es: "CNY −5% vs CLP", zh: "人民币兑比索 −5%" },
  "CNY +5% vs CLP": { en: "CNY +5% vs CLP", es: "CNY +5% vs CLP", zh: "人民币兑比索 +5%" },
  "USD -5% vs CLP": { en: "USD −5% vs CLP", es: "USD −5% vs CLP", zh: "美元兑比索 −5%" },
  "Cherry price -10%": { en: "Cherry price −10%", es: "Precio de la cereza −10%", zh: "樱桃价格 −10%" },
  "Cherry price +10%": { en: "Cherry price +10%", es: "Precio de la cereza +10%", zh: "樱桃价格 +10%" },
  "30 extra harvest workers": { en: "30 extra harvest workers", es: "30 temporeros más", zh: "增加30名采收工人" },
};
/** Scenario Lab preset name in the view language. */
export const presetName = (preset: string, lang: Lang = "en") => PRESET_NAME[preset]?.[lang] ?? preset;

/** Customer short names for tight spots. */
export const SHORT_CUSTOMER = "Shanghai Hongxin";
export const SHORT_CUSTOMER_ZH = "上海鸿信";

/** The derived headline numbers every screen agrees on. */
export const N = {
  pNeg: pct(S.after.probNegByCrunch), // 81%
  pNegBefore: pct(S.before.probNeg90d), // 13%
  pNegAfterPlan: pct(S.plan.prob_negative_after_plan), // 2%
  coverage: pct(S.plan.coverage), // 96%
  savingsPct: pct(S.plan.savings_pct), // 45%
  crunchDay: S.after.crunchDay, // 19
  crunchDate: S.after.crunchDate, // 2026-12-30
  payroll: S.after.crunchOutflow.amount, // 238M
  planCost: S.plan.cost_clp,
  defaultCost: S.plan.default_cost_clp,
  savings: S.plan.savings_clp,
  loanUsd: Math.round(PLAN.amount / 100) * 100, // 142,400
  loanClp: PLAN.amount_clp,
  termDays: PLAN.term_days,
  lender: PLAN.lender.replace(" (fictional)", ""),
  overdueUsd: S.event.amount,
  delayDays: S.event.delay_days,
  gapClp: S.need.amount_clp, // what has to be covered on payroll day
  // NanFeng-Bench and the red team, from their result files (npm run sync:scenario).
  benchCases: S.bench.cases,
  benchSolved: S.bench.solved,
  benchSavingsPct: pct(S.bench.meanSavingsPct), // average over the benchmark cases, not the Cherry Crisis
  rtAttacks: S.redTeam.attacks,
  rtStopped: S.redTeam.stoppedAfter,
  rtStoppedBefore: S.redTeam.stoppedBefore,
};
