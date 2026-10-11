// Copies the Cherry Crisis numbers from the quant engine (vicente-rodriguez/results) into the web,
// so every screen, the deck and the video use the same figures.
// Run from web/: `npm run sync:scenario` after `python -m nanfeng_quant demo` changes the results.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const quant = join(here, "..", "..", "vicente-rodriguez");
const out = join(here, "..", "src", "data", "cherry-crisis.json");

const read = (p) => JSON.parse(readFileSync(join(quant, p), "utf8"));
const story = read("results/cherry_crisis_story.json");
const after = read("results/cherry_crisis_forecast.json");
const before = read("results/cherry_crisis_before.json");
const plan = read("results/cherry_crisis_plan.json");
const input = read("data/scenarios/cherry_crisis.json");

// CLP millions with one decimal keeps the file small and is what the charts plot.
const m = (v) => Math.round(v / 1e5) / 10;
const fan = (f) => ({ p10: f.p10.map(m), p50: f.p50.map(m), p90: f.p90.map(m) });

const customers = Object.fromEntries(input.customers.map((c) => [c.id, c]));

const data = {
  source: `${after.source.engine} · seed ${after.source.seed} · ${after.source.n_paths} paths`,
  company: story.company,
  asOf: story.as_of,
  openingCashClp: story.opening_cash_clp,
  bufferClp: story.buffer_clp,
  fx: story.fx_spot,
  event: story.event,
  before: { probNeg90d: story.forecast_before.prob_negative_90d, headline: story.forecast_before.headline },
  after: {
    probNegByCrunch: story.forecast_after.prob_negative_by_crunch,
    probNeg90d: after.summary.prob_negative_cash_horizon,
    probBelowBuffer90d: story.forecast_after.prob_below_buffer_90d,
    crunchDay: story.forecast_after.crunch_day,
    crunchDate: story.forecast_after.crunch_date,
    crunchOutflow: story.forecast_after.crunch_outflow,
    minCashP10Clp: Math.round(after.summary.min_cash_p10),
    minCashP50Clp: Math.round(after.summary.min_cash_p50),
    probNegIfOnTime: after.drivers.drivers[0].prob_negative_by_day,
    headline: story.forecast_after.headline,
  },
  plan: {
    ...story.plan,
    probBelowBufferAfter: plan.after_plan.prob_below_buffer_horizon,
    maturity: plan.optimal.actions[0]?.maturity ?? null,
    solveSeconds: plan.optimal.solve_seconds,
    solver: plan.optimal.solver,
    nScenarios: plan.optimal.n_scenarios,
  },
  approvalRequest: story.approval_request,
  passport: story.credit_passport,
  arena: story.financing_arena,
  need: story.financing_need,
  explanation: plan.explanation.map((e) => ({
    productId: e.product_id,
    product: e.name,
    selected: e.selected,
    aloneCostClp: e.alone_cost_clp ?? null,
    reason: e.reason,
  })),
  scenarioLab: story.scenario_lab.map((s) => ({
    preset: s.preset,
    overrides: s.overrides,
    headline: s.headline,
    probNeg90d: s.prob_negative_cash_horizon,
    probBelowBuffer90d: s.prob_below_buffer_horizon,
    crunchDate: s.crunch_date,
    minCashP10Clp: s.min_cash_p10,
    planCostClp: s.plan_cost_clp,
    defaultCostClp: s.default_cost_clp,
    savingsPct: s.savings_pct,
    planActions: s.plan_actions,
  })),
  receivables: input.receivables.map((r) => ({
    ...r,
    customer: customers[r.customer_id].name.replace(" (fictional)", ""),
    country: customers[r.customer_id].country,
  })),
  strings: story.strings,
  fan: {
    dates: after.fan_chart.dates,
    before: fan(before.fan_chart),
    after: fan(after.fan_chart),
    afterPlan: fan(plan.after_plan.fan_chart),
  },
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data) + "\n");
console.log(`wrote ${out} (${data.source})`);
