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

/** Full CLP for tickers and tables: "CLP $176.000.000" (Chilean grouping in every language). */
export const clpFull = (v: number) => `CLP $${Math.round(v).toLocaleString("es-CL")}`;

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
  const n = m < 10 ? num(m, lang, 1) : num(Math.round(m), lang);
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
};
