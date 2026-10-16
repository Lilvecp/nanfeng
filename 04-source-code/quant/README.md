# R5 · Quant & Data Scientist — Vicente Rodríguez

**Mission:** The math nobody else will have. Owner of the forecast, the optimizer and the benchmark that backs every number in the pitch.

**Owns:** Synthetic data · Cash Monte Carlo · MILP optimizer · Financial catalog · NanFeng-Bench

**Deliverables:** 01 (algorithms) · Benchmark results

**Tools:** Python · NumPy / SciPy · OR-Tools · FastAPI — plain scripts, everything reproducible from the CLI

This directory is a self-contained Python package, `nanfeng_quant`, plus its data, results, API contract and docs. Everything is deterministic (fixed seeds), so Demo Mode replays exactly the same numbers.

> **Teammates: read [Decision log](#decision-log-for-teammates) first.** Iteration 3 (2026-10-10) changed the Cherry Crisis plan and the savings figure. The single source of numbers for the front, the deck and the video is [`results/cherry_crisis_story.json`](results/cherry_crisis_story.json) (also `GET /quant/demo/story`).

---

## The problem in one page

**NanFeng** is an autonomous CFO for Chilean SMEs that export to China. A cherry exporter pays its harvest crews in pesos every month, but its Chinese importers pay in USD or CNY 60–90 days after shipping, and sometimes late. One late invoice can leave the company unable to pay its payroll. NanFeng sees the cash crunch coming, finds the cheapest financing, and executes it with the owner's OTP approval over WhatsApp, voice or web.

The app is five layers, one per teammate:

| Layer | Owner | Does |
|---|---|---|
| Channels + agent | Renato | Reads the importer's email/WhatsApp (Mistral OCR), decides which tool to call, talks to the owner |
| **Quant engine (this directory)** | **Vicente** | **Every number: forecast, crunch date, financing quotes, the optimal plan, savings, credit score** |
| Policy + security | Andy | Decides what the agent may do alone (L0–L2) and what needs the owner's OTP (L3); blocks attacks |
| Backend + sandbox bank + chain | Camilo | API gateway, simulated bank that executes the plan, audit log anchored on-chain |
| Cockpit + pitch | Valentín (+ Camilo) | The screens the jury sees, the deck, the video |

**Where the quant engine sits in the demo (Cherry Crisis):**

1. 10:12 — the Shanghai importer says it will pay USD 180,000 45 days late. Renato's agent calls `forecast_run`.
2. 10:13 — the engine re-runs 10,000 scenarios: **81% probability of negative cash in 19 days (2026-12-30), the day of the CLP 238M harvest payroll.** Before the notice it was 13%.
3. 10:14 — `optimize_plan` picks the cheapest mix from 9 real Chilean products: **a single 60-day USD pre-export loan (PAE) of USD 142,400. Cost CLP 2.11M vs CLP 3.80M for the bank loan (45% cheaper); cash stays above the buffer in 96% of scenarios, and the chance of going negative falls from 81% to 2.5%.**
4. 10:15 — the plan's `approval_request` goes unchanged to the backend; Andy's policy marks it L3; the owner approves with OTP; the sandbox bank executes it; the hash goes on-chain. The Credit Passport goes from 34 (E) to 67 (B).

The LLM never computes a number: it calls these tools and quotes them. That is both a security rule (Andy) and what makes the numbers defensible in front of WeBank's judges.

---

## Status at a glance

| ID | Due | Priority | Task | Status | Where |
|----|-----|----------|------|--------|-------|
| r5-01 | Oct 8 | Must | Cherry Crisis numbers + synthetic data generator | ✅ Done — numbers frozen as the source of truth (D5) | `data/scenarios/cherry_crisis.json`, `nanfeng_quant/synthetic.py` |
| r5-02 | Oct 8 | Must | Real FX data CLP/USD + USD/CNY | ✅ Done — source decision D8 | `scripts/fetch_fx.py`, `data/fx/` |
| r5-03 | Oct 9 | Must | Catalog of financial products with reference rates | ✅ Done — rates checked against CMF certificate 09/2026 and public ranges (D9) | `data/catalog.json`, `docs/financial-catalog.md` |
| r5-04 | Oct 9 | Must | 90-day Monte Carlo | ✅ Done — tails fixed (D13) | `nanfeng_quant/montecarlo.py`, `fx.py` |
| r5-07 | Oct 10 | Must | MILP optimizer | ✅ Done — fair comparison, realistic product rules, 2 s budget | `nanfeng_quant/optimizer.py` |
| r5-08 | Oct 11 | Should | Explainability | ✅ Done | `nanfeng_quant/explain.py` |
| r5-09 | Oct 11 | Could | Credit Passport | ✅ Done (heuristic v1 weights, declared; robust to any weighting; before/after plan) | `nanfeng_quant/credit_passport.py` |
| r5-06 | Oct 12 | Should | Forecast backtest (CRPS, coverage) | ✅ Done — coverage now nominal under misspecification | `nanfeng_quant/backtest.py`, `results/backtest_summary.md` |
| r5-05 | Oct 13 | Should | Market data with sources | ✅ Done — re-checked 2026-10-10, 2025/26 season | `docs/market-data.md` |
| r5-10 | Oct 13 | Must | NanFeng-Bench (50 scenarios) | ✅ Done | `nanfeng_quant/bench.py`, `results/bench_summary.md` |
| r5-11 | Oct 14 | Must | Core algorithm description | ✅ Done — ready for Valentín's English edit | `01-technical-documentation/core-algorithm.md` |
| extra | – | – | Plan sensitivity | ✅ Done | `nanfeng_quant/sensitivity.py`, `results/sensitivity_summary.md` |
| extra | – | – | API contract + reference server + sandbox seed + agent tool schemas | ✅ Done (D1, D2, D6) | `nanfeng_quant/api.py`, `api/`, `docs/api.md` |
| extra | Oct 13 | – | Business financial analysis (Topic E): cash budget, customers, DSO, FX exposure, payroll safety, findings EN / ES / 中文 | ✅ Done | `nanfeng_quant/analysis.py`, `POST /quant/analysis`, `results/cherry_crisis_analysis.json`, [core-algorithm §6](../../01-technical-documentation/core-algorithm.md#6-business-financial-analysis) |

Tests: `36 passed` (`pytest`). Bench 50/50.

---

## Iteration 3 — audit of 2026-10-10: what was wrong and what changed

| # | Finding | Fix | Effect |
|---|---|---|---|
| 1 | **The savings were inflated.** The default bank loan was forced to a 180-day term, so it paid interest long after the 40-day gap closed. | Loans now offer several terms (bank loan 30/60/90/180 days, PAE 60/90/120/180); the MILP picks the cheapest for both the plan and the bank-loan comparison. | Savings 72% → **45%**, but now defensible. |
| 2 | Loan fees and minimum tickets were per product, so the "bank loan" could be split into many tiny loans. | Each loan draw is one loan with its own fixed fee and minimum ticket. | Realistic. |
| 3 | **The plan factored the Shanghai invoice that had just been announced late, with a non-recourse factor.** No real factor buys that. | Non-recourse factoring refuses invoices with an announced delay; the fintech factor (with recourse) can, but the exporter repays the advance if the buyer is 30 days later than expected. | Plan no longer depends on an unrealistic operation. |
| 4 | Rates had no official anchor. | Checked against the **CMF interest-rate certificate 09/2026**, BCCh, SII and public factoring ranges. The bank loan (14%) is below the CMF average for its size (20.06%). | Savings are a lower bound. Factoring rate 1.35% → 1.50%/month (non-recourse range 1.5–2.2%). |
| 5 | Tails too thin: the P10–P90 band covered only 73–75% when reality had fatter tails. | Systemic (cross-customer) delay factor ρ = 0.6 and τ = 0.35 → 0.5, tuned on the backtest. | Coverage **79–83%** under misspecification (nominal 80%); 86–90% when the model is right. CRPS unchanged. |
| 6 | Plan + explanation took ~55 s (the backend's proxy times out at 60 s); on long synthetic horizons the MILP grew to ~900 decisions and could time out with no plan. | Financing can only be drawn on the days a new risk episode starts (≤ 10 candidate days; cash still checked every day); 2 s exact-solver budget after the heuristic; parallel 1 s explanation checks; in-memory cache. Demo artifacts still solved to proven optimality offline. | Cherry Crisis ~5 s first call, ~0 s repeated; bench median 9.6 s, p90 46 s with 8 cases sharing the machine; online plans 2.5% above a 30 s offline solve on average. |
| 7 | **The backend and front used different numbers** (FX 940/132, opening cash 175.5M, lender terms, a "factoring + forward" plan, payroll CLP 38.5M on 2026-10-28, …). | `GET /quant/sandbox/seed`, `approval_request` in every plan, and `results/cherry_crisis_story.json` with every number in EN/ES/中文. See D2–D5 and the table of front fixes below. | One story everywhere once teammates pull them in. |
| 8 | No machine-readable tool schemas for the agent. | `api/agent_tools.json` (OpenAI/OpenRouter format), `GET /quant/tools`, `tools.call` returns errors as JSON instead of raising. | Renato can wire the tools directly. |
| 9 | The Cash Cockpit's "after the plan" chart had no data behind it. | `optimize_plan` returns `after_plan.fan_chart` and probabilities; Credit Passport before/after. | Front can draw the "resolved" overlay from real numbers (2.5% after the plan). |
| 10 | Stamp-tax exemption of the PAE was unverified; the "60% paid late" figure had a weak source; cherry figures were a season old. | PAE exempt confirmed (DL 3.475 art. 24 no. 11, SII Ord. 2402/2016); replaced by Bolsa de Productos (63% of SME invoice value paid after 30 days, Q3 2024 report; 44 days average); 2025/26 season (USD 2.6 bn, 87% to China). | `docs/market-data.md` ready for the deck. |

---

## Decision log (for teammates)

Each decision says why and what you need to do. If you disagree, tell me and I re-run `python -m nanfeng_quant demo` in a few minutes.

**D1 · The quant API contract is `api/openapi.json` — closed from the quant side (r3-02).** Camilo's gateway already proxies `/quant/*` unchanged and adds `/quant/plan/jobs`; that's the right design, so the contract stays. Changes in iteration 3 are additive only: new endpoints `GET /quant/sandbox/seed`, `GET /quant/tools`, `GET /quant/demo/story`; new fields in the plan response (`headline`, `approval_request`, `after_plan`, `credit_passport`). *Camilo:* regenerate `web/src/lib/api-types.ts` from `quant/api/openapi.json` when you merge.

**D2 · The sandbox bank is seeded from the quant engine, not from its own constants.** The plan's operations reference lender ids (`LEN-PAE`, `LEN-FACTOR`, …) and invoice ids that must exist in the bank, and the amounts must match. *Camilo:* in `backend/app/seed.py`, take `ACCOUNTS`, `RECEIVABLES`, `LENDERS` and `FX_RATES` from `GET /quant/sandbox/seed` (or a copy of it). Concretely: opening cash **CLP 176,000,000** (was 175.5M), FX **USD 983.84 / CNY 146.76** CLP (was 940 / 132), lenders `LEN-FACTOR, LEN-FINTECH, LEN-LC, LEN-ANDINO, LEN-FOGAPE, LEN-PAE, LEN-OVERDRAFT, LEN-FXDESK` with the rates in the seed (loan lenders use your `wc_loan`/`fogape` product types, so `bank.loan()` works unchanged). Confirming is not a sandbox operation yet; plans that use it list it under `approval_request.unsupported` (the Cherry Crisis plan doesn't).

**D3 · The Cherry Crisis plan is now "a 60-day USD pre-export loan (PAE) of USD 142,400", not "factoring + CNY forward".** Why: (a) a non-recourse factor will not buy the invoice whose buyer just announced a 45-day delay; (b) the CNY forward cannot pay the 2026-12-30 payroll because the CNY invoices are collected in late January — the optimizer never picks it at 90%, even with a zero spread; (c) the PAE is cheap because it is stamp-tax exempt and repaid with the export's own USD (a natural hedge — a good line for the judges). Factoring stays the fallback: with no PAE on offer the plan is bank + fintech factoring, still 37% cheaper than the bank loan. *Valentín:* demo script line 10:14 and the deck. *Front:* `CHERRY_PLAN` in `web/src/lib/desk-state.tsx` should be `story.approval_request` (or `GET /quant/demo/plan` → `approval_request`). *Renato:* the agent's narrative.

**D4 · The savings claim is 45% (CLP 1.69M), not 72%.** The old number compared against a bank loan forced to 180 days. Pitch line: *"45% cheaper than the bank loan — and we priced the bank loan below the CMF market average, so that's a floor."* Across the 25 bench plans: mean 41%, median 43%.

**D5 · The scenario numbers are frozen and are the source of truth.** Headline kept at **81% / 19 days / 2026-12-30** (opening cash re-tuned to CLP 176.0M after the tails fix; 80.7–81.2% across 4 other seeds). "Before the notice" is **13%**. The scenario date is **2026-12-11** (peak harvest), not October. *Front:* see the table below. *Valentín:* if you change any scenario number, tell me; I re-run `demo` and everything regenerates.

**D6 · The agent uses the tool schemas in `api/agent_tools.json` and must not edit the plan.** Rules for Renato: call `forecast_run` when a document can change future cash; call `optimize_plan` for a recommendation; quote numbers verbatim; send `approval_request` **unchanged** to `POST /approvals` (financing is always L3); call it through the backend's `/quant/plan/jobs` and stream progress on SSE. Python: `from nanfeng_quant.tools import call; call("optimize_plan", {"scenario": "cherry_crisis"})`.

**D7 · Demo Mode reads `GET /quant/demo/story`** (fe-10): it has every number of the scenario, the plan, the Financing Arena rows, the Scenario Lab presets (each with its plan cost), the approval request, and EN/ES/中文 strings for the alert, the plan and the OTP prompt. The fan charts are in `/quant/demo/forecast → fan_chart` (before the plan) and `/quant/demo/plan → after_plan.fan_chart` (after it). No computation, no network.

**D8 · FX history stays on mindicador.cl** (a free mirror of the BCCh's official "dólar observado"; the BDE API needs a registered account and returns the same series). Cite "Banco Central de Chile" as the source. USD/CNY is FRED (public domain). Terms of use read on 2026-10-12: the BCCh allows reuse citing it as owner, mindicador.cl has no terms of its own, the Fed's H.10 data is public domain and FRED asks for its citation and no implied endorsement (`docs/market-data.md`, *Terms of use*).

**D9 · Catalog rates are "reference rates", not quotes.** They are anchored to the CMF certificate 09/2026 and public ranges, and the bank loan is deliberately below the market average. Say "reference rates" in the deck, never "quotes". Lenders are fictional. Re-verified on 2026-10-12, including the legal maximum rate (TMC) for every ticket a product can write: four products now cap each operation at the bracket edge (`max_ticket_clp`), which changes no published number (`docs/financial-catalog.md`, *Rate verification*).

**D10 · The CNY forward is out of the pitch story.** It stays in the catalog and the Financing Arena as a hedging option (roadmap / policy setting).

**D11 · Scenario Lab:** live sliders call `/quant/forecast` (0.1–0.5 s); "re-plan" calls `/quant/plan`. Hires default to CLP 750,000/month per harvest worker (`hire_monthly_wage_clp`); the front's "0–5 hires at CLP 1.4M" barely moves a CLP 238M payroll — use 0–50 workers.

**D12 · Credit Passport weights are heuristic (v1), and the passport says so (`method`).** Present it as "a transparent heuristic score, to calibrate with a lender's repayment data". Show it moving **34 (E) → 67 (B)** with the plan, and if asked about the weights: under any weighting of the six factors the score after the plan is higher (10,000 random weightings, `weight_robustness`).

**D13 · Forecast uncertainty τ = 0.5, systemic share ρ = 0.6**, chosen on the backtest (coverage nominal under misspecification, conservative otherwise).

**D14 · Optimizer latency:** ≤ 10 candidate funding days, 2 s exact-solver budget online, cached repeats, offline-optimal demo artifacts. Always call it through `/quant/plan/jobs` (hard SMEs can take 30–50 s). The bench reports how far the online plan is from a 30 s solve (2.5% on average).

**D15 · Licenses:** rows for the root README are in [`LICENSES.md`](LICENSES.md) (Camilo, r3-08).

### Front fixes (what the cockpit shows today → what the engine says)

Found in `camilo-backend:web/src`. All values are in `results/cherry_crisis_story.json`.

| Where | Today | Should be |
|---|---|---|
| Cockpit / approvals: late invoice | "Shanghai Fresh Imports", INV-2026-0871, due 2026-08-25 | Shanghai Hongxin Fresh Fruit Import Co. (fictional), **INV-2026-118**, USD 180,000, due 2026-12-18, 45 days late |
| Cockpit: crunch | payroll CLP 38.5M on 2026-10-28 | harvest payroll **CLP 238M on 2026-12-30** (day 19) |
| Cockpit KPI | "▲ from 22%" | from **13%** (before the notice) to 81%; **2.5%** after the plan |
| Cockpit ticker | USD/CLP 905.40, CNY/USD 0.1404 | USD/CLP **983.84**, CNY per USD **6.7038** (2026-10-02) |
| Plan everywhere | "factoring 67% of INV-2026-118 + 60-day CNY forward", EAC 11.8%, CLP 8.5M, "CLP 4.1M cheaper" | **USD 142,400 pre-export loan (PAE) for 60 days, drawn 2026-12-30**; cost **CLP 2.11M** vs **CLP 3.80M** bank loan; **CLP 1.69M (45%) cheaper** |
| Financing Arena rows | FWD+FACT 11.8%, factoring 13.9%, FOGAPE 9.6%, WC loan 16.4% 12M | `story.financing_arena` (cost, EAC, term, requirements per product) |
| Approval Center amount | USD 120,000 ≈ CLP 108.65M, "bank buys 67% of the overdue invoice" | USD 142,400 ≈ CLP 140.1M, 60-day PAE from Banco del Pacífico Sur (fictional): the operation in `story.approval_request` |
| Scenario Lab | hires 0–5 at CLP 1.4M/month; probability is a formula on the front | call `/quant/forecast` with `overrides`; presets in `story.scenario_lab` |

---

## Headline numbers (Cherry Crisis, seed 7, 10,000 paths)

| | Value |
|---|---|
| Before the notice | 13% probability of negative cash within 90 days |
| After the notice | **81% probability of negative cash in 19 days (2026-12-30)** |
| Main driver | If Shanghai paid on time it would be 1% |
| Plan | USD 142,400 pre-export loan (PAE), 60 days, drawn 2026-12-30 |
| Plan cost vs bank loan | **CLP 2,106,329 vs CLP 3,796,513 → CLP 1,690,184 saved (45%)** |
| Out-of-sample | 96.1% of 10,000 paths above the CLP 25M buffer; P(negative cash) 81% → 2.5% |
| Solver | Exact chance-constrained MILP, proven optimal (gap 0) |
| Credit Passport | 34 (E) → 67 (B) with the plan |

---

## Quick start

```bash
cd 04-source-code/quant
python -m venv .venv
.venv/Scripts/activate          # Windows; on macOS/Linux: source .venv/bin/activate
pip install -e ".[dev,api]"     # numpy, scipy, pandas, ortools, fastapi, uvicorn, httpx, pytest

python -m nanfeng_quant forecast cherry_crisis      # Monte Carlo summary + drivers
python -m nanfeng_quant quote cherry_crisis         # Financing Arena quotes
python -m nanfeng_quant optimize cherry_crisis      # MILP plan vs. default loan + explanation + approval_request
python -m nanfeng_quant passport cherry_crisis --consent
python -m nanfeng_quant analysis cherry_crisis      # business financial analysis (analysis-demo rewrites the results file)
python -m nanfeng_quant forecast cherry_crisis --overrides '{"cny_shift_pct": -5}'   # Scenario Lab

python -m nanfeng_quant demo          # rewrite every results/cherry_crisis_* file (~4 min, proves optimality)
python -m nanfeng_quant story         # rebuild cherry_crisis_story.json from saved results (seconds)
python -m nanfeng_quant bench         # NanFeng-Bench, 50 cases (~5 min, 8 processes)
python -m nanfeng_quant backtest      # FX + cash backtests (~5 min)
python -m nanfeng_quant sensitivity   # plan sensitivity (~10 min)
python -m nanfeng_quant generate      # regenerate the 50 synthetic SMEs
python scripts/fetch_fx.py            # re-download FX history

uvicorn nanfeng_quant.api:app --port 8100     # HTTP API, docs at /docs
python -m nanfeng_quant.api --export          # rewrite api/openapi.json, scenario.schema.json, agent_tools.json
pytest                                        # tests
```

## Layout

```
quant/
├── nanfeng_quant/
│   ├── model.py            # scenario schema (company, customers, receivables, shipments, payables)
│   ├── fx.py               # FX history + joint stationary block bootstrap
│   ├── montecarlo.py       # 90-day cash simulation, parameter + systemic uncertainty, fan chart, crunch day
│   ├── catalog.py          # products, terms, pricing (stamp tax, EAC), eligibility, Financing Arena quotes
│   ├── optimizer.py        # chance-constrained MILP (OR-Tools CBC/SCIP)
│   ├── explain.py          # counterfactual drivers + why each product is in/out
│   ├── credit_passport.py  # explainable score (also on post-plan cash)
│   ├── analysis.py         # business financial analysis: cash budget, customers, FX, payrolls, findings
│   ├── synthetic.py        # 50 synthetic cherry exporters
│   ├── bench.py            # NanFeng-Bench
│   ├── backtest.py         # CRPS / coverage backtests
│   ├── sensitivity.py      # robustness of the plan
│   ├── tools.py            # agent tools, tool schemas, approval_request, sandbox seed, cache
│   ├── api.py              # FastAPI reference server + OpenAPI export
│   ├── demo.py             # regenerates the Cherry Crisis results + story sheet
│   └── __main__.py         # CLI
├── api/                    # openapi.json, scenario.schema.json, agent_tools.json (generated)
├── data/
│   ├── scenarios/cherry_crisis.json   # Huerto Austral Export SpA (fictional)
│   ├── catalog.json                   # financial products (fictional lenders, reference rates, sandbox mapping)
│   ├── synthetic/smes.json            # 50 synthetic SMEs
│   └── fx/                            # real FX history (BCCh via mindicador.cl, FRED)
├── results/                # every number for the deck, docs and Demo Mode (story.json first)
├── docs/                   # financial-catalog.md, market-data.md, api.md (core-algorithm.md: 01-technical-documentation/)
├── LICENSES.md             # rows for the root README
├── scripts/fetch_fx.py
└── tests/                  # test_quant.py, test_api.py
```

---

## Interfaces for the team

| Who | What they get | How |
|-----|---------------|-----|
| **Renato** (agent) | Tools `forecast_run`, `financing_quote`, `optimize_plan`, `credit_passport` with function-calling schemas; every response has a `source` block; `optimize_plan` returns `headline` (one sentence to say to the owner) and `approval_request` | `api/agent_tools.json` or `GET /quant/tools`; `tools.call(name, args)` or HTTP through the backend |
| **Valentín / Camilo** (front) | Fan chart before and after the plan, Financing Arena rows, plan actions, Scenario Lab presets with plan costs, EN/ES/中文 strings | `results/cherry_crisis_story.json` = `GET /quant/demo/story`; live: `/quant/forecast`, `/quant/plan` |
| **Camilo** (backend) | OpenAPI contract, sandbox seed, `approval_request` already in the `POST /approvals` shape; no network at runtime | `docs/api.md`, `GET /quant/sandbox/seed` |
| **Andy** (security) | The LLM never computes: all numbers are deterministic tool outputs with seeds. Amounts to check against L0–L3: `approval_request.operations[*].params.amount_clp` (loans), `share` × invoice (factoring), `notional` (forward) | `optimal.actions[*].cost_clp / proceeds_clp / amount_clp` |
| **Valentín** (pitch) | Headline numbers above; market slide line in `docs/market-data.md`; doc section in `01-technical-documentation/core-algorithm.md` | — |

---

## What's left

Everything in my scope that could be done without a human is done. What remains needs a person:

| # | Item | Who | Why it can't be automated |
|---|---|---|---|
| 1 | Pull D2 (sandbox seed) and D3/D5 (front numbers) into `camilo-backend` | Camilo + Valentín | Their code, their branch |
| 2 | Wire the tools into the orchestrator (D6, r2-09) | Renato | His code |
| 3 | Have a native reader check the ES and 中文 strings in `story.strings` before the video | Valentín | Plan rule (risks.md) |
| 4 | English edit of `01-technical-documentation/core-algorithm.md` | Valentín (r1-08) | Plan rule |
| 5 | Update the deck line: "63% of what SMEs invoice **to large companies** is paid **after the 30-day legal limit**" with the footnote *Bolsa de Productos / ASECH, Ranking de Pagadores Q3 2024* | Valentín | Slide 2; the figure is now confirmed at the primary source (`docs/market-data.md`) |

Known limits that remain (documented in `01-technical-documentation/core-algorithm.md` §5): synthetic companies (no real ledgers to calibrate τ, ρ and the Credit Passport weights, which are therefore declared heuristic), reference rates instead of lender quotes, no loan prepayment, no per-shipment price noise.

### Data-and-sources checklist (closed 2026-10-12)

- [x] **63% late payments:** found in the primary source, Bolsa de Productos / ASECH *Ranking de Pagadores* Q3 2024 (62.99% of the amount SMEs invoice to large companies is paid after 30 days). The two press links we cited did not contain it; replaced. The 44-day average is the Jul 2025–Jun 2026 ranking (trade press). → `docs/market-data.md`
- [x] **Rates of the 9 products:** re-checked against CMF certificate 09/2026, Term SOFR and 2026 factoring ranges, plus the legal maximum rate for every ticket; factoring and LC source notes corrected; ticket caps added where a big ticket would exceed the legal maximum (no published number changes). → `docs/financial-catalog.md`, `test_every_credit_rate_is_under_the_legal_maximum`
- [x] **Credit Passport weights:** declared heuristic in code, API output (`method`) and docs, with the rationale for every band; robustness to the weights measured instead of a fake calibration. → `01-technical-documentation/core-algorithm.md` §3
- [x] **Terms of use of mindicador.cl and FRED:** read and quoted; we comply (attribution, one-off download, no implied endorsement). → `docs/market-data.md`, `LICENSES.md`

---

## Battle-plan checklist (R5)

Every task of the battle plan, with where its acceptance criterion is met.

- [x] `r5-01` **Oct 8** · Must — Cherry Crisis scenario numbers + synthetic data generator: 50 exporting SMEs with cherry seasonality (Nov–Feb), customers with delay distributions, costs and debts → `data/scenarios/cherry_crisis.json`, `data/synthetic/smes.json` (50 SMEs), `nanfeng_quant/synthetic.py`
- [x] `r5-02` **Oct 8** · Must — Real FX data CLP/USD (Banco Central de Chile) and historical USD/CNY for the bootstrap → `data/fx/`, `scripts/fetch_fx.py`
- [x] `r5-03` **Oct 9** · Must — Catalog of realistic products (factoring, confirming, working capital, FOGAPE, letter of credit, forward) with reference rates → `data/catalog.json` (9 products, + PAE and overdraft), `docs/financial-catalog.md`
- [x] `r5-04` **Oct 9** · Must — 90-day Monte Carlo: lognormal delay per customer, FX by log-return bootstrap, seasonality → P10/P50/P90, days to crunch, P(cash < 0) → `nanfeng_quant/montecarlo.py`, `fx.py`; `01-technical-documentation/core-algorithm.md` §1
- [x] `r5-05` **Oct 13** · Should — Market data with sources: SME financing gap, Chile → China exports, payment terms → `docs/market-data.md`
- [x] `r5-06` **Oct 12** · Should — Backtest (CRPS and interval coverage) with numbers for the docs → `results/backtest_summary.md`
- [x] `r5-07` **Oct 10** · Must — MILP: minimize total financing cost with cash above a buffer in the P90 scenarios, respecting credit lines, terms and collateral → `nanfeng_quant/optimizer.py`; `01-technical-documentation/core-algorithm.md` §2
- [x] `r5-08` **Oct 11** · Should — Explainability: which customer or variable causes the crunch and why each option is in or out → `nanfeng_quant/explain.py`; `results/cherry_crisis_summary.md`
- [x] `r5-09` **Oct 11** · Could — Credit Passport: explainable score shared with a lender, with consent → `nanfeng_quant/credit_passport.py`, `POST /quant/passport`
- [x] `r5-10` **Oct 13** · Must — NanFeng-Bench: 50 scenarios with a correct answer → success rate, savings vs. default loan, latency → `results/bench_summary.md` (50/50)
- [x] `r5-11` **Oct 14** · Must — Core algorithm description with formulas, assumptions and results → `01-technical-documentation/core-algorithm.md` (deliverable 01, pending Valentín's English edit)

---

## Objectives, one by one

### r5-01 · Cherry Crisis numbers + synthetic data generator (Must)

- `data/scenarios/cherry_crisis.json`: *Huerto Austral Export SpA* (fictional), as of **2026-12-11**, opening cash CLP 176.0M, buffer CLP 25M, annual sales USD 3.8M. Four importers (Shanghai and Guangzhou in Mainland China, Kowloon in Hong Kong SAR, Miami in the US), 6 open invoices (USD and CNY), 4 consignment shipments, 19 payables (harvest payrolls CLP 238M / 205M / 128M, packing, packaging, freight in USD, loan installments, PPM tax, utilities). The Shanghai invoice **INV-2026-118 for USD 180,000 is announced 45 days late** — the 10:12 event.
- `nanfeng_quant/synthetic.py` → `data/synthetic/smes.json`: 50 SMEs with Nov–Feb cherry seasonality, 3–6 customers each (70% Mainland China), three reliability classes, consignment advances, harvest payroll, packing, freight, debt service and taxes; opening cash calibrated so the 50 range from comfortable to distressed. All flagged `synthetic: true`.

### r5-02 · Real FX data (Must)

USD/CLP "dólar observado" (BCCh) 2010-01-04 → 2026-10-09 via mindicador.cl; USD/CNY (FRED DEXCHUS) 2010-01-04 → 2026-10-02. The bootstrap uses the last 5 years of days with both quotes (keeps the CLP–CNY correlation); spot = last common day (2026-10-02: CLP 983.84 per USD, CLP 146.76 per CNY).

### r5-03 · Catalog of financial products (Must)

9 products (`docs/financial-catalog.md`): non-recourse bank export factoring, fintech factoring with recourse, LC discounting, confirming, working-capital loan (the default bank credit, 30–180 days), FOGAPE loan, USD pre-export loan (PAE, 60–180 days), overdraft, CNY forward. Real rules: stamp tax (0.066%/month, cap 0.8%; 0.332% sight), PAE stamp exemption (art. 24 no. 11), FOGAPE threshold (≤ 100,000 UF), UF CLP 41,131, TPM 4.50%. Rates anchored to CMF certificate 09/2026.

### r5-04 · 90-day Monte Carlo (Must)

10,000 paths, seed 7, 0.1–0.5 s. Lognormal delays per customer + announced delays, defaults, joint FX bootstrap, cherry price factor, parameter uncertainty (τ = 0.5) with a systemic share (ρ = 0.6). Outputs: P10/P50/P90 per day, P(cash < 0) per day and cumulative, P(below buffer), crunch day, headline. Scenario Lab knobs: `global_delay_extra_days`, `customer_delay_extra_days`, `cny_shift_pct`, `usd_shift_pct`, `cherry_price_pct`, `extra_hires` (+ `hire_monthly_wage_clp`). Presets with their plan cost in `results/cherry_crisis_scenario_lab.json`.

### r5-07 · MILP optimizer (Must)

Minimizes total financing cost so that cash stays above the buffer in 90% of scenarios (scenario chance constraint with one binary per scenario), with loan terms chosen by the solver, one loan per draw with its own fee and minimum, one operation per invoice, credit lines, collateral, lead times, recourse, at most 5 operations. Validated out of sample on all 10,000 paths. Always compared with the default bank loan under the same constraints and term freedom. Cherry Crisis: see the headline table.

### r5-08 · Explainability (Should)

- **What causes the crunch** (counterfactuals on common random numbers): *"Probability of negative cash by 2026-12-30 is 81%. If Shanghai Hongxin pays every invoice on its due date, it would be 1%. The crunch day carries the December harvest payroll (CLP 238,000,000)."*
- **Why each product is in or out** (`results/cherry_crisis_summary.md`): e.g. the bank loan "costs CLP 3,796,513, CLP 1,690,184 more"; FOGAPE "shortest term 365 days: interest runs long after the gap closes"; overdraft "cannot keep cash above the buffer… its 30-day repayment lands on a later cash low"; the non-recourse factor "will not buy INV-2026-118, whose buyer already announced a delay"; the forward "brings no cash: the CNY invoices are collected after the crunch day".

### r5-09 · Credit Passport (Could)

Six-factor transparent scorecard (value, sub-score, weight, points per factor); SHA-256 digest with consent for on-chain anchoring. Huerto Austral: **34/100 (E) today, 67/100 (B) with the plan.** Weights are heuristic and labeled so; the improvement holds under any weighting (`weight_robustness`).

### r5-06 · Backtest (Should)

See `results/backtest_summary.md` and `01-technical-documentation/core-algorithm.md` §4: FX intervals calibrated on real data (79–83% for a nominal 80%); cash CRPS 32–39% better than a point forecast; P10–P90 coverage 86–90% when the model is right and 79–83% when reality is deliberately different; Brier skill +53% to +62%.

### r5-05 · Market data (Should)

`docs/market-data.md` (re-checked 2026-10-10, 63% traced to the primary report on 2026-10-12): cherry exports USD 2.6 bn FOB in 2025/26, ~87% to China; SMEs paid in 44 days on average, 63% of what they invoice to large companies paid after 30 days (Bolsa de Productos, Q3 2024); banks charge SMEs 20.06%/yr on average (CMF); MSME finance gap USD 5.7 trillion (IFC).

### r5-10 · NanFeng-Bench (Must)

From `results/bench_summary.md` — 50 scenarios with a correct answer: 40 stochastic (a synthetic SME + one event: late-payment notice, peso appreciation USD −6%/CNY −8%, cherry price −15%, 40 extra hires, largest customer stops paying, or nothing) judged against an **independent oracle** (50,000 paths, another seed); 10 deterministic cases checked against an independently written ledger. A case passes only if the system (1) flags correctly whether financing is needed, (2) finds the crunch day within ±2 days, and (3) when financing is needed, returns a plan that keeps ≥ 89% of the oracle's paths above the buffer and costs no more than the bank loan.

| Metric | Result |
|---|---|
| **Success rate** | **50 / 50 (100%)** — 40/40 stochastic, 10/10 deterministic |
| Risk detection / crunch day ±2 d / plan validity | 100% / 100% / 100% |
| Deterministic cases | Simulator matches the independent ledger to CLP 0.00 on every day |
| Plans built | 25 |
| Oracle coverage of plans | mean 94.3%, min 90.8% (target 90%) |
| Savings vs. bank loan (same term freedom) | mean 41.0%, median 43.1%, total CLP 20.7M |
| Online plan vs. 30 s offline solve | 2.5% more expensive on average, 26% in the worst case |
| Latency (8 cases sharing the machine) | forecast median 0.85 s; plan + bank-loan comparison median 9.6 s, p90 46 s |

**How to read 100%:** the oracle uses the same model as the system, with 5× more paths and an independent seed. So the bench proves the pipeline is correct and robust to sampling; it does **not** prove the model matches reality — that's the backtest (coverage 79–83% when reality has fatter tails than assumed). Say this if a judge asks.

### r5-11 · Core algorithm description (Must)

`01-technical-documentation/core-algorithm.md`: the problem, formulas, the MILP, product rules, the fair comparison, validation and limitations, written for deliverable 01.

### Extra · Plan sensitivity

From `results/sensitivity_summary.md` (Cherry Crisis, offline solves):

- **Confidence target 80% → 97.5%:** plan cost CLP 1.21M → 3.11M, always **45–50% cheaper** than the bank loan; always the PAE plus at most two other operations; out-of-sample coverage always above the target.
- **Rates ±30%:** savings stay at 44–46%; factoring 60% dearer changes nothing. Bank loan 30% cheaper than our (already below-market) rate: savings still **30%**.
- **A product missing:** no PAE on offer → bank + fintech factoring, still **37% cheaper**; no factoring → PAE alone, 45%.
- **The old assumption, reproduced:** forcing the bank loan to 180 days gives 80% "savings" — that is exactly why the 72% of iteration 2 was dropped (D4).
- **CNY forward:** never chosen at 90%. At 95% it enters as a small add-on (saves ≤ 1% of the plan cost). It stays out of the pitch story (D10).
