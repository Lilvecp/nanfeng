# R5 · Quant & Data Scientist — Vicente Rodríguez

**Mission:** The math nobody else will have. Owner of the forecast, the optimizer and the benchmark that backs every number in the pitch.

**Owns:** Synthetic data · Cash Monte Carlo · MILP optimizer · Financial catalog · NanFeng-Bench

**Deliverables:** 01 (algorithms) · Benchmark results

**Tools:** Python · NumPy / SciPy · OR-Tools · Jupyter-free (plain scripts, reproducible from the CLI)

This directory is a self-contained Python package, `nanfeng_quant`, plus its data, results and docs. Everything is deterministic (fixed seeds) so Demo Mode can replay the exact same numbers.

---

## Status at a glance

| ID | Due | Priority | Task | Status | Where |
|----|-----|----------|------|--------|-------|
| r5-01 | Oct 8 | Must | Cherry Crisis numbers + synthetic data generator | ✅ Done — numbers need Valentín's sign-off | `data/scenarios/cherry_crisis.json`, `nanfeng_quant/synthetic.py` |
| r5-02 | Oct 8 | Must | Real FX data CLP/USD + USD/CNY | ✅ Done — source terms to confirm | `scripts/fetch_fx.py`, `data/fx/` |
| r5-03 | Oct 9 | Must | Catalog of financial products with reference rates | ✅ Built — **rates to verify** | `data/catalog.json`, `docs/financial-catalog.md` |
| r5-04 | Oct 9 | Must | 90-day Monte Carlo | ✅ Done | `nanfeng_quant/montecarlo.py`, `fx.py` |
| r5-07 | Oct 10 | Must | MILP optimizer | ✅ Done | `nanfeng_quant/optimizer.py` |
| r5-08 | Oct 11 | Should | Explainability | ✅ Done | `nanfeng_quant/explain.py` |
| r5-09 | Oct 11 | Could | Credit Passport | ✅ Done (v1 scorecard, weights uncalibrated) | `nanfeng_quant/credit_passport.py` |
| r5-06 | Oct 12 | Should | Forecast backtest (CRPS, coverage) | ✅ Done | `nanfeng_quant/backtest.py`, `results/backtest_summary.md` |
| r5-05 | Oct 13 | Should | Market data with sources | 🟡 Collected — **every figure needs confirming at the source** | `docs/market-data.md` |
| r5-10 | Oct 13 | Must | NanFeng-Bench (50 scenarios) | ✅ Done | `nanfeng_quant/bench.py`, `results/bench_summary.md` |
| r5-11 | Oct 14 | Must | Core algorithm description | ✅ Draft ready for Valentín's English edit | `docs/core-algorithm.md` |

Tests: `14 passed` (`pytest`).

---

## Quick start

```bash
cd vicente-rodriguez
python -m venv .venv
.venv/Scripts/activate          # Windows; on macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"         # numpy, scipy, pandas, ortools, pytest

python -m nanfeng_quant forecast cherry_crisis      # Monte Carlo summary + drivers
python -m nanfeng_quant quote cherry_crisis         # Financing Arena quotes
python -m nanfeng_quant optimize cherry_crisis      # MILP plan vs. default loan + explanation
python -m nanfeng_quant passport cherry_crisis --consent
python -m nanfeng_quant forecast cherry_crisis --overrides '{"cny_shift_pct": -5}'   # Scenario Lab

python -m nanfeng_quant demo        # rewrite every results/cherry_crisis_* file (~30 s)
python -m nanfeng_quant bench       # NanFeng-Bench, 50 cases (~5 min)
python -m nanfeng_quant backtest    # FX + cash backtests (~5 min)
python -m nanfeng_quant generate    # regenerate the 50 synthetic SMEs
python scripts/fetch_fx.py          # re-download FX history
pytest                              # tests
```

## Layout

```
vicente-rodriguez/
├── nanfeng_quant/
│   ├── model.py            # scenario schema (company, customers, receivables, shipments, payables)
│   ├── fx.py               # FX history + joint stationary block bootstrap
│   ├── montecarlo.py       # 90-day cash simulation, fan chart, crunch day
│   ├── catalog.py          # products, pricing (stamp tax, EAC), Financing Arena quotes
│   ├── optimizer.py        # chance-constrained MILP (OR-Tools CBC/SCIP)
│   ├── explain.py          # counterfactual drivers + why each product is in/out
│   ├── credit_passport.py  # explainable score
│   ├── synthetic.py        # 50 synthetic cherry exporters
│   ├── bench.py            # NanFeng-Bench
│   ├── backtest.py         # CRPS / coverage backtests
│   ├── tools.py            # agent tools: forecast_run, financing_quote, optimize_plan, credit_passport
│   ├── demo.py             # regenerates the Cherry Crisis results
│   └── __main__.py         # CLI
├── data/
│   ├── scenarios/cherry_crisis.json   # Huerto Austral Export SpA (fictional)
│   ├── catalog.json                   # financial products (fictional lenders, reference rates)
│   ├── synthetic/smes.json            # 50 synthetic SMEs
│   └── fx/                            # real FX history (BCCh via mindicador.cl, FRED)
├── results/                # every number for the deck, docs and Demo Mode
├── docs/                   # core-algorithm.md, financial-catalog.md, market-data.md
├── scripts/fetch_fx.py
└── tests/test_quant.py
```

---

## Objectives, one by one

### r5-01 · Cherry Crisis numbers + synthetic data generator (Must)

**What it is.** One shared set of numbers everyone uses in the demo (company, customers, amounts, dates), and a generator of 50 realistic exporting SMEs for testing and the benchmark.

**What was built.**
- `data/scenarios/cherry_crisis.json`: *Huerto Austral Export SpA* (fictional), as of **2026-12-11**, opening cash CLP 174M, buffer CLP 25M, annual sales USD 3.8M. Four importers (Shanghai and Guangzhou in Mainland China, Kowloon in Hong Kong SAR, Miami in the US), 6 open invoices (USD and CNY), 4 upcoming consignment shipments, and 19 payables (three harvest payrolls of CLP 238M / 205M / 128M, packing, packaging, freight in USD, loan installments, PPM tax, utilities). The Shanghai invoice **INV-2026-118 for USD 180,000 is announced 45 days late** — the 10:12 event of the demo script.
- The numbers were tuned so the demo story holds with the real model: **before the notice 8% probability of negative cash in 90 days; after it, 81% probability of negative cash in 19 days**, exactly on the December harvest payroll (2026-12-30). Same result on 5 different seeds.
- `nanfeng_quant/synthetic.py` → `data/synthetic/smes.json`: 50 SMEs with Nov–Feb cherry seasonality (weekly shipments peaking mid-December), 3–6 customers each (70% Mainland China; USD or CNY invoicing), three customer reliability classes with lognormal delay distributions, consignment advances, harvest payroll, packing/packaging, ocean freight in USD, debt service and taxes. Opening cash is calibrated against each SME's own projected need, so the 50 range from comfortable to distressed. All flagged `synthetic: true`.

### r5-02 · Real FX data (Must)

- `scripts/fetch_fx.py` downloads **USD/CLP "dólar observado" (Banco Central de Chile)**, 4,178 daily observations 2010-01-04 → 2026-10-09 (last 981.61), via the public mirror mindicador.cl — the official BDE API needs registered credentials — and **USD/CNY (FRED DEXCHUS)**, 4,191 observations 2010-01-04 → 2026-10-02 (last 6.7038).
- The bootstrap uses the last 5 years of joint daily returns (only days with both quotes, so the CLP–CNY correlation is kept).

### r5-03 · Catalog of financial products (Must)

- `data/catalog.json`, 8 products: export factoring (bank and fintech), letter of credit discounting, confirming, **working capital loan (the "default" bank credit)**, FOGAPE-guaranteed loan, credit line/overdraft, and CNY forward. Each has rate, advance, fees, lead time, term, minimum/maximum ticket, collateral, eligibility and a pointer to the source to verify against.
- Real rules built in: Chilean **stamp tax** (0.066%/month, cap 0.8%; flat 0.332% for credit lines, confirmed in DL 3.475), **FOGAPE threshold** (net sales ≤ 100,000 UF, confirmed), **UF CLP 41,131** (2026-10-09), **TPM 4.50%** (BCCh, Sep 2026) for the forward's interest parity.
- Lenders are fictional on purpose (no impersonation of real banks). Details: `docs/financial-catalog.md`.

### r5-04 · 90-day Monte Carlo (Must)

- 10,000 paths, seed 7, **~0.1 s** for the simulation (≈1 s including the driver analysis).
- Per path: lognormal delay per customer + announced delays, defaults, joint FX bootstrap, cherry price factor on uninvoiced shipments.
- Outputs P10/P50/P90 per day (fan chart payload for Valentín's Cash Cockpit), probability of negative cash per day and cumulative, probability of going below the buffer, **crunch day** (first day with ≥ 50% chance of negative cash) and a one-line headline.
- Scenario Lab knobs (Valentín's sliders): `global_delay_extra_days`, `customer_delay_extra_days`, `cny_shift_pct`, `usd_shift_pct`, `cherry_price_pct`, `extra_hires`. Presets are in `results/cherry_crisis_scenario_lab.json` (e.g. cherry price −10% → 96%; +10% → 54%).

### r5-07 · MILP optimizer (Must)

- Minimizes total financing cost so that **cash stays above the buffer in 90% of scenarios** (scenario-based chance constraint with binaries per scenario), respecting credit lines per lender, collateral, minimum/maximum tickets, one operation per invoice, lead times, terms and repayment dates. Forward notional is capped at the unfinanced CNY amount.
- Validated **out of sample on all 10,000 paths**; it re-solves tighter automatically if the 90% target is missed. Always compared against the default bank loan under the same constraints.
- **Cherry Crisis plan:** factor 23% of INV-2026-121 and 57% of INV-2026-112 (two CNY invoices) on 2026-12-30 → **CLP 1,255,853 vs. CLP 5,253,798 for the default bank loan: savings CLP 3,997,945 (76%)**. 91.5% of out-of-sample paths stay above the buffer. Optimal (gap 0) with CBC in ~4 s.
- The battle plan's story said "partial factoring + CNY forward". The optimizer chooses **partial factoring but not the forward**: at 90% confidence the CNY risk it removes is small compared with the late payment. See "needs checking" below.

### r5-08 · Explainability (Should)

- **What causes the crunch:** counterfactual re-runs with common random numbers. Cherry Crisis: *"Probability of negative cash by 2026-12-30 is 81%. If Shanghai Hongxin pays every invoice on its due date, it would be 1%. The crunch day carries the December harvest payroll (CLP 238,000,000)."* FX at spot would barely change it (82%).
- **Why each option is in or out:** for selected products, re-solve without them (factoring: +CLP 335,890); for the rest, re-solve with that product alone. Examples: working capital loan "costs CLP 3,997,945 more (minimum term 180 days: interest runs long after the gap closes)"; overdraft "cannot keep cash above the buffer… its 30-day repayment lands on a later cash low"; LC discounting "every eligible invoice is collected before the need date". Table in `results/cherry_crisis_summary.md`.

### r5-09 · Credit Passport (Could)

- Transparent six-factor scorecard (liquidity, buffer, concentration, customer delay, debt service, FX exposure), every factor with value, sub-score, weight and points, so a lender can recompute it. With consent, it adds a SHA-256 digest that Camilo's audit log can anchor on-chain.
- Huerto Austral in the crisis: **34/100, grade E** (weakest: 82% chance of negative cash).

### r5-06 · Backtest (Should)

From `results/backtest_summary.md`:
- **FX, real data, 204 rolling origins 2018-01 → 2026-06.** The bootstrap's CRPS equals a Gaussian random walk (−0.1% to −1.1%: nobody beats a random walk on FX), but its **P10–P90 intervals are calibrated** (79–83% vs. 80% nominal), while the Gaussian over-covers CNY (88–92%).
- **Cash, synthetic truth (20 SMEs × 25 truth paths).** CRPS **34–37% better than a point forecast**, coverage 80–82% when the truth follows the model. With a deliberately misspecified truth (fatter delay tails, more price volatility, different FX regime) CRPS is still 37–40% better, but coverage drops to **68–70%**: the model is overconfident when reality has fatter tails. Buffer-breach Brier skill +54% to +65% vs. climatology.

### r5-05 · Market data (Should)

`docs/market-data.md`: Chilean exports 2024 USD 100.2 bn (BCCh), ~36% to Mainland China, **90.9% of Chilean cherry exports go to China/Hong Kong (2024/25)**, Chile ~98% of China's cherry imports, cherry FOB price −34% Sep–Dec 2024, IFC MSME finance gap **USD 5.7 trillion** (8 trillion with informal firms), Ley 21.131 30-day payment term, FOGAPE, stamp tax, TPM and UF — each with its link and what to confirm.

### r5-10 · NanFeng-Bench (Must)

- **50 scenarios with a correct answer:** 40 stochastic (a synthetic SME + one event: late-payment notice, peso appreciation USD −6%/CNY −8%, cherry price −15%, 40 extra hires, largest customer stops paying, or nothing) judged against an **independent oracle** (50,000 paths, another seed); 10 deterministic cases (all uncertainty off) checked against an independently written ledger.
- A case passes only if the system (1) correctly flags whether financing is needed, (2) finds the crunch day within ±2 days, and (3) when financing is needed, returns a plan that keeps ≥ 89% of the oracle's paths above the buffer and costs no more than the default loan.
- Results: see the table below and `results/bench_summary.md`.

| Metric | Result |
|---|---|
| **Success rate** | **50 / 50 (100%)** — 40/40 stochastic, 10/10 deterministic |
| Risk detection / crunch day ±2 d / plan validity | 100% / 100% / 100% (1 case was borderline and accepted either way) |
| Deterministic cases | Simulator matches the independent ledger to CLP 0.00 on every day |
| Plans built | 21 (all cases that needed financing); in 2 of them the default loan alone was infeasible |
| Oracle coverage of plans | mean 92.8%, min 90.4% (target 90%) |
| Savings vs. default bank loan (19 comparable cases) | mean 79.5%, median 81.8%, total CLP 87.7M |
| Latency | forecast median 128 ms; optimize (plan + default comparison) median 11.9 s, p90 20.4 s |

**How to read 100%:** the oracle uses the same model as the system, only with 5× more paths and an independent seed. So the bench proves the pipeline is correct and robust to sampling (right flag, right crunch day, plans that really hold out of sample, never worse than the default loan). It does **not** prove the model matches reality — that's what the backtest is for, and it shows the model gets overconfident when reality has fatter tails (coverage ~70%). Say this if a judge asks.

### r5-11 · Core algorithm description (Must)

`docs/core-algorithm.md`: formulas, assumptions, the MILP formulation, validation and known limitations, written for deliverable 01. Ready for Valentín's final English edit.

---

## Interfaces for the team

| Who | What they get | How |
|-----|---------------|-----|
| **Renato** (agent) | Tools `forecast_run`, `financing_quote`, `optimize_plan`, `credit_passport` — JSON in, JSON out, every response has a `source` block so the UI can show where a number comes from | `from nanfeng_quant.tools import call; call("optimize_plan", {"scenario": "cherry_crisis"})` |
| **Valentín / Camilo** (front) | Fan chart (`fan_chart.dates/p10/p50/p90/p_negative/buffer`), Financing Arena rows (cost, EAC, term, requirements, reason), plan actions with dates and costs, Scenario Lab presets | `results/cherry_crisis_*.json` (Demo Mode can load these directly, no network) |
| **Camilo** (backend) | Pure Python package, no network at runtime (FX history is local); forecast ~0.1–1 s, optimize ~4 s on Cherry Crisis (up to ~20 s on harder SMEs) — run it async and stream progress over SSE | Wrap the four tools as FastAPI endpoints once the OpenAPI contract exists |
| **Andy** (security) | The LLM never computes: all numbers are deterministic tool outputs with seeds; amounts in plans are what the policy engine should check against L0–L3 limits | `optimize_plan` → `optimal.actions[*].cost_clp / proceeds_clp / amount_clp` |

---

## What's missing

1. **OpenAPI contract** with Camilo: the JSON shapes above are ready, but no contract has been published yet (it was due Oct 8). The tools must be wired to the FastAPI backend.
2. **Agent integration** (r2-09 with Renato): the tools have not been called from the real orchestrator yet.
3. **Real rates** for the catalog: all values are references, not quotes from real lenders.
4. **Calibration from real data**: payment-delay distributions, cost shares and the Credit Passport weights are expert assumptions. Even one or two real (anonymized) exporter ledgers would help.
5. **Tail risk**: the backtest shows coverage drops to ~70% under fatter-tailed reality. Options: widen the delay dispersion, add a "stress" component to the mixture, or report a stress scenario next to P10.
6. **Plan readability**: on some synthetic SMEs the plan has many small actions (up to 9 in the bench). A per-action admin cost or a cap on actions would make the WhatsApp approval simpler.
7. **USD pre-export loans (PAE)** and export credit insurance are not in the catalog.
8. Not modeled: per-shipment price noise, overlapping credit-line balances over time, prepayment penalties.

## What needs checking / something from you

- [ ] **Confirm the Cherry Crisis numbers with Valentín** (opening cash, payrolls, invoice amounts, dates). If any changes, run `python -m nanfeng_quant demo` and the 81%/19-day headline is recomputed. Opening cash CLP 174M was tuned to hit exactly 81%.
- [ ] **Decide about the CNY forward in the story.** The model doesn't choose it at 90% confidence. Either the pitch says "partial factoring" (honest, what the model does), or we raise the confidence target / hedge policy and check again. Don't present a forward the optimizer didn't pick.
- [ ] **Verify every catalog rate** against its listed source (CMF statistics, bank price lists, fintech rate cards, FOGAPE bidding results). Rates: factoring 1.35% and 1.85%/month, LC 0.85%/month, confirming 1.10%/month, working capital 13.2%/year, FOGAPE 10.2% + 1.3%/year, overdraft 2.1%/month, forward spread 0.35%, CNY rate 1.5%.
- [ ] **Check whether factoring of invoices pays stamp tax.** I set it to no; if it does, edit `stamp_tax` in `data/catalog.json`.
- [ ] **Confirm every figure in `docs/market-data.md`** at the original source, especially the full-season cherry export value (sources are ambiguous) and the "60% paid late" figure (weak source).
- [ ] **FX source terms:** the CLP series comes from mindicador.cl (a free BCCh mirror). Either confirm it's acceptable or register for the official BDE API and re-download. List both datasets with their terms in the root README (IP rule).
- [ ] **Credit Passport weights and thresholds** are my initial choices; review them or present them as "v1, to calibrate with lenders".
- [ ] **Read `docs/core-algorithm.md`** and hand it to Valentín for the English edit (due Oct 14).
- [ ] **Library licenses for the root README:** NumPy (BSD-3), SciPy (BSD-3), pandas (BSD-3), OR-Tools (Apache-2.0, bundles CBC under EPL-2.0 and SCIP under Apache-2.0), pytest (MIT).

## Original task list

- [x] `r5-01` **Oct 8** · Must — **Cherry Crisis scenario numbers** with Valentín and **synthetic data generator**: 50 exporting SMEs with cherry seasonality (Nov–Feb), customers with delay distributions, costs and debts. *(numbers pending Valentín's review)*
- [x] `r5-02` **Oct 8** · Must — **Real FX data** CLP/USD (Banco Central de Chile) and historical USD/CNY for the bootstrap.
- [x] `r5-03` **Oct 9** · Must — **Catalog of realistic financial products** (factoring, confirming, working capital, FOGAPE, letter of credit, forward) with reference rates. *(rates to verify)*
- [x] `r5-04` **Oct 9** · Must — **90-day Monte Carlo**: delay per customer (lognormal), FX via log-return bootstrap and seasonality → P10/P50/P90, days to crunch, P(cash < 0).
- [x] `r5-07` **Oct 10** · Must — **MILP optimizer**: minimize total financing cost with cash above a buffer in the P90 scenarios, respecting credit lines, terms and collateral.
- [x] `r5-08` **Oct 11** · Should — **Explainability**: which customer or variable causes the crunch and why each option was included or excluded.
- [x] `r5-09` **Oct 11** · Could — **Credit Passport**: explainable financial health score the SME shares with a lender, with its consent.
- [x] `r5-06` **Oct 12** · Should — **Backtest** of the forecast (CRPS and interval coverage) with numbers for the docs.
- [ ] `r5-05` **Oct 13** · Should — **Market data** with sources for the deck: SME financing gap, Chile → China exports, payment terms. *(collected, to confirm)*
- [x] `r5-10` **Oct 13** · Must — **NanFeng-Bench**: 50 scenarios with a correct answer → success rate, savings vs. default loan, latency.
- [x] `r5-11` **Oct 14** · Must — **Core algorithm description** for the documentation, with formulas, assumptions and results. *(draft, pending English edit)*
