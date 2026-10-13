# Quant API — contract (agreed shape, see the README decision log)

The backend (`camilo-backend`, `backend/app/routers/quant.py`) proxies these paths **unchanged** under `/quant` and adds `POST /quant/plan/jobs` (background job + SSE events `quant.plan.*`). So this file and [`api/openapi.json`](../api/openapi.json) are the contract the front and the agent see.

- Contract: [`api/openapi.json`](../api/openapi.json) (generated from the code: `python -m nanfeng_quant.api --export`)
- Scenario schema: [`api/scenario.schema.json`](../api/scenario.schema.json)
- Agent tool schemas (OpenAI / OpenRouter function calling): [`api/agent_tools.json`](../api/agent_tools.json), also at `GET /quant/tools`
- Reference server: `uvicorn nanfeng_quant.api:app --port 8100` (`pip install -e ".[api]"`); docs at `http://localhost:8100/docs`

| Method | Path | What | Latency |
|---|---|---|---|
| GET | `/quant/health` | Liveness + engine version | – |
| GET | `/quant/scenarios` | Scenario ids in `data/scenarios` | – |
| GET | `/quant/scenarios/{id}` | Full scenario object | – |
| GET | `/quant/schema/scenario` | JSON Schema of a scenario | – |
| POST | `/quant/forecast` | Monte Carlo summary, fan chart, drivers (Cash Cockpit, Scenario Lab) | 0.1–0.5 s (+~1 s with `explain`) |
| POST | `/quant/quote` | Financing Arena rows: cost, EAC, term, requirements, eligibility | ~0.5 s |
| POST | `/quant/plan` | MILP plan vs. default loan, savings, out-of-sample coverage, why each product is in or out, **`approval_request`**, **`after_plan`** fan chart, Credit Passport before/after | ~5 s first call on Cherry Crisis (30–50 s on hard SMEs); ~0 s repeated (cached) |
| POST | `/quant/passport` | Credit Passport; `consent: true` adds a SHA-256 digest for on-chain anchoring | ~0.3 s |
| POST | `/quant/analysis` | Business financial analysis: cash budget by month, outflows by category, customers, DSO and aging, currency exposure, payroll safety and findings in EN / ES / 中文 | ~0.1 s |
| GET | `/quant/sandbox/seed` | Accounts, receivables, lenders and FX for the sandbox bank, from the same scenario + catalog | – |
| GET | `/quant/tools` | Agent tool schemas | – |
| GET | `/quant/demo/{artifact}` | Precomputed Cherry Crisis results for Demo Mode: `before`, `forecast`, `quotes`, `plan`, `passport`, `scenario_lab`, **`story`**, `analysis` | – |

Request bodies take `scenario` as an id (`"cherry_crisis"`) or a full scenario object, plus optional `overrides` (Scenario Lab knobs: `global_delay_extra_days`, `customer_delay_extra_days`, `cny_shift_pct`, `usd_shift_pct`, `cherry_price_pct`, `extra_hires`, `hire_monthly_wage_clp`, …). Unknown override keys are rejected with 422.

Every response has a `source` block (`tool`, `engine`, `seed`, `deterministic`) so the UI can show where each number comes from (the "LLM never calculates" rule). `source.cached: true` means the answer was served from memory (same inputs, same seed, same answer).

## The plan → approval → bank flow

1. Agent or front calls `POST /quant/plan` (through the backend: `POST /quant/plan/jobs`, then read the job).
2. The response's `approval_request` is **already the body of the backend's `POST /approvals`**: `{action, operations: [{op, params}], explanation, channel}`, at most 5 operations, ops in `factoring | loan | forward`, lender ids from `GET /quant/sandbox/seed`. Extra keys (`execute_on`, `unsupported`) are ignored by the backend.
3. The backend's policy marks financing as L3 → OTP → the sandbox bank executes.

Cherry Crisis example (`results/cherry_crisis_story.json` → `approval_request`):

```json
{
 "action": "Pre-export loan in USD (PAE)",
 "operations": [
  {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}
 ],
 "channel": "WEB"
}
```

## Notes for integration

- `/quant/plan` is CPU-bound for several seconds the first time: keep calling it through the backend's job endpoint and stream "optimizing…" to Mission Control. Demo Mode reads `/quant/demo/plan` or `/quant/demo/story` and computes nothing.
- The Scenario Lab sliders should call `/quant/forecast` live (fast) and only call `/quant/plan` on "re-plan". `results/cherry_crisis_scenario_lab.json` already has the plan cost for each preset.
- Plan actions carry `cost_clp` and `proceeds_clp` / `amount_clp`: those are the amounts Andy's policy engine should check against the L0–L3 limits.
- The engine needs no network at runtime (FX history is local), so it runs next to the backend outside China.
