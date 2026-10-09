# Quant API — proposal for the OpenAPI contract (for Camilo)

The battle plan asks for OpenAPI contracts between front, agent, quant and security. This is the **quant side, as a proposal**: change anything, but tell me so the tools match.

- Contract: [`api/openapi.json`](../api/openapi.json) (generated from the code, so it can't drift: `python -m nanfeng_quant.api --export`)
- Scenario schema: [`api/scenario.schema.json`](../api/scenario.schema.json)
- Reference server: `uvicorn nanfeng_quant.api:app --port 8100` (needs `pip install -e ".[api]"`); docs at `http://localhost:8100/docs`

| Method | Path | What | Typical latency |
|---|---|---|---|
| GET | `/quant/health` | Liveness + engine version | – |
| GET | `/quant/scenarios` | Scenario ids in `data/scenarios` | – |
| GET | `/quant/scenarios/{id}` | Full scenario object | – |
| GET | `/quant/schema/scenario` | JSON Schema of a scenario | – |
| POST | `/quant/forecast` | Monte Carlo summary, fan chart, drivers (Cash Cockpit, Scenario Lab) | 0.1–1 s |
| POST | `/quant/quote` | Financing Arena rows: cost, EAC, term, requirements, eligibility | ~1 s |
| POST | `/quant/plan` | MILP plan vs. default loan, savings, out-of-sample coverage, why each product is in/out | 5–30 s |
| POST | `/quant/passport` | Credit Passport; with `consent: true` adds a SHA-256 digest for on-chain anchoring | ~1 s |
| GET | `/quant/demo/{artifact}` | Precomputed Cherry Crisis results for Demo Mode (no computation, no network) | – |

Request bodies take `scenario` as an id (`"cherry_crisis"`) or a full scenario object, plus optional `overrides` (Scenario Lab knobs: `global_delay_extra_days`, `customer_delay_extra_days`, `cny_shift_pct`, `usd_shift_pct`, `cherry_price_pct`, `extra_hires`, …). Unknown override keys are rejected with 422.

Every response has a `source` block (`tool`, `engine`, `seed`, `deterministic: true`) so the UI can show where each number comes from (the "LLM never calculates" rule).

## Notes for integration

- `/quant/plan` is CPU-bound for several seconds: call it from a background job and stream "optimizing…" over the SSE channel to Mission Control. For the live demo, Demo Mode should read `/quant/demo/plan`.
- Plan actions carry `cost_clp` and `proceeds_clp` / `amount_clp`: those are the amounts Andy's policy engine should check against the L0–L3 limits before anything is executed in the sandbox bank.
- The engine needs no network at runtime (FX history is local), so it can run next to the backend outside China.
