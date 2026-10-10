# NanFeng backend (R3 · Camilo)

API gateway for the cockpit and the agent. FastAPI + Postgres (SQLite locally). All data is synthetic.

| Area | Prefix | Task |
|------|--------|------|
| Sandbox Bank: accounts, transactions, receivables, payees, lenders, FX, JSONL log export | `/bank` | r3-04 |
| Approval Center: policy tier, OTP approval, reject with reason, kill switch | `/approvals`, `/policy` | r3-03 (+ Andy) |
| Audit log: hash chain, verify, Merkle anchors, inclusion proofs | `/audit` | r3-05 |
| Agent event stream (SSE) for Mission Control + publish endpoint for the agent | `/agent/events` | r3-03 |
| Vicente's quant engine, same paths as his contract, plus background plan jobs | `/quant` | r3-02 |

Full contract: [`contracts/openapi.json`](../contracts/openapi.json) (generated, CI fails if it drifts). Live docs at `/docs`.

## Run

```sh
# whole stack (Postgres + backend), from the repo root
cp .env.example .env
docker compose up --build                    # http://localhost:8000/docs
docker compose --profile quant up --build    # + Vicente's engine (needs vicente-rodriguez/ merged)

# or locally, no Docker
cd backend
uv venv --python 3.12 .venv && uv pip install -e ".[dev]"   # or: python3.12 -m venv .venv && pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --reload --port 8000
.venv/bin/pytest -q
.venv/bin/python -m app.main ../contracts/openapi.json      # re-export the contract after changing routes
```

## How money moves

Nothing calls the bank directly. Every operation is posted to `POST /approvals` as `{action, operations: [{op, params}, ...]}` (1–5 operations, e.g. factoring + forward):

1. The backend computes the CLP exposure and asks the policy (`app/policy.py`) for a tier.
2. L1/L2 run immediately (`status: auto`). L3 waits (`pending`) until `POST /approvals/{id}/approve` with the OTP (sandbox `482913`, 3 attempts, then `locked`) or `/reject` with a reason.
3. The sandbox bank executes the operations in order (stopping at the first failure, the note says which ran), writes the transactions, appends to the audit log and publishes SSE events. An approved L3 request is anchored right away.

Operations: `payment`, `fx_convert`, `factoring` (refuses an invoice that was already financed), `loan`, `forward`.

## For the rest of the team

- **Renato (agent):** publish each step with `POST /agent/events` (`{type: "agent.step", data: {tool, tier, model, cost_usd, status}}`) and propose actions with `POST /approvals`. Send `Authorization: Bearer $NANFENG_AGENT_TOKEN`.
- **Andy (policy):** `app/policy.py` is a placeholder with the same L0–L3 shape; swap `evaluate()` for your engine. Security events go to `POST /audit/entries` so they are hash-chained and anchored.
- **Vicente (quant):** your API is proxied unchanged under `/quant`. For the plan, the front calls `POST /quant/plan/jobs` and gets `quant.plan.*` events.
- **Front:** one origin for everything; listen to `GET /agent/events` (SSE, supports `Last-Event-ID`) or poll `/agent/events/recent`.

## Not done yet

- Chain anchoring: `NANFENG_ANCHOR_BACKEND=local` stores roots in the DB only. FISCO BCOS / EVM go in `app/anchoring.py` (r3-05).
- The policy is a placeholder until Andy's engine lands.
- Single instance: SSE history, plan jobs and the kill switch live in memory.
- `POST /bank/reset` is open so Demo Mode can call it; lock it down before a public deploy.
