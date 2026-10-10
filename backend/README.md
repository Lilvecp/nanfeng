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

1. The backend computes the CLP exposure and asks the policy engine (`app/policy.py`) for a tier. See [Policy engine](#policy-engine-r4-02).
2. L1/L2 run immediately (`status: auto`). L3 waits (`pending`) until `POST /approvals/{id}/approve` with the OTP (sandbox `482913`, 3 attempts, then `locked`) or `/reject` with a reason.
3. The sandbox bank executes the operations in order (stopping at the first failure, the note says which ran), writes the transactions, appends to the audit log and publishes SSE events. An approved L3 request is anchored right away.

Operations: `payment`, `fx_convert`, `factoring` (refuses an invoice that was already financed), `loan`, `forward`.

## Policy engine (r4-02)

Deterministic, outside the LLM: the agent proposes, `app/policy.py` decides. The limits are data (`POLICY`, served at `GET /policy`) with the same keys as the Settings screen.

| Rule | Sends the request to |
|------|----------------------|
| Total ≤ CLP 1M, allowlisted payee | L1 (runs, owner notified) |
| Total ≤ CLP 25M per action | L2 (runs within limits) |
| `factoring`, `loan`, `forward` (new money or a binding FX commitment) | L3 |
| Payee not on the allowlist | L3 |
| Operations in one request add up above CLP 25M | L3 |
| Agent spend above CLP 40M in 24 h or CLP 80M in 30 days (rolling) | L3 |
| 5 automatic actions in 10 min (velocity) | L3 |
| Payments to the same payee in 24 h add up above CLP 25M (split payments) | L3 |
| Total above CLP 400M, owner-approved above CLP 400M in 30 days, kill switch on | blocked |

Also: payee bank-account changes (`payee_bank_change`) are always L3; payments to a payee whose account changed in the last 72 h go to L3; a counterparty on the (synthetic) sanctions watchlist is blocked.

Every decision lists the rules that fired in the `approval.created` audit entry (`policy_rules`, `policy_version`). Evaluation and execution run under one lock so concurrent requests cannot both squeeze under a cumulative limit.

## Step-up OTP (r4-05)

`NANFENG_OTP_MODE=sandbox` (default) accepts the shared demo code. `NANFENG_OTP_MODE=sms` gives every L3 approval its own random code, texted by Zavu to `NANFENG_OWNER_PHONE` (needs `ZAVU_API_KEY` and a long `NANFENG_OTP_SECRET`): HMAC-bound to the approval and its amount, 5 min, single use, never logged. `POST /approvals/{id}/otp` sends a new one. The agent token is refused on approve/reject, any `VOICE` channel is refused on approve, and the agent can turn the kill switch on but not off.

## Security endpoints (r4-03 / r4-04 / r4-07)

| Endpoint | For |
|----------|-----|
| `POST /security/scan` | Guard on a document's raw text (OCR + PDF layer) before any LLM. `clean` / `suspicious` / `malicious` with rule ids |
| `POST /security/check-payee` | BEC: issuer, sender domain and bank account vs master data; returns the call-back number on file |
| `POST /privacy/mask` | Replace personal data with placeholders before an LLM call; keep the mapping in the backend |

Non-clean verdicts are hash-chained (`security.flagged`, `security.attack_blocked`) and streamed on SSE; a malicious one also texts the owner when it did not arrive by SMS.

## On-chain anchoring (r3-05)

`NANFENG_ANCHOR_BACKEND=evm` sends each Merkle root to an EVM testnet (Sepolia via a public RPC) as a 0-value transaction from the anchor wallet to itself; the calldata is `NANFENG1 | root | from_seq | to_seq`, readable on Etherscan. No contract to deploy.

- An approved L3 request is anchored right away; `POST /audit/anchor` anchors whatever is new.
- `GET /audit/anchors/{id}/chain` reads the transaction back and checks it matches our record.
- `GET /audit/anchor-wallet` shows the wallet address and its testnet balance (fund it from a Sepolia faucet).
- If the chain refuses (no funds, RPC down) the approval still executes, `audit.anchor_failed` goes out on SSE and the next anchor covers those entries.
- `local` keeps roots in the DB only (tests, offline demo). FISCO BCOS would be one more backend in `app/anchoring.py`.

## For the rest of the team

- **Renato (agent):** publish each step with `POST /agent/events` (`{type: "agent.step", data: {tool, tier, model, cost_usd, status}}`) and propose actions with `POST /approvals`. Send `Authorization: Bearer $NANFENG_AGENT_TOKEN`.
- **Andy (policy):** `app/policy.py` is the policy engine; `tests/test_policy.py` covers every rule. Security events go to `POST /audit/entries` so they are hash-chained and anchored.
- **Vicente (quant):** your API is proxied unchanged under `/quant`. For the plan, the front calls `POST /quant/plan/jobs` and gets `quant.plan.*` events.
- **Front:** one origin for everything; listen to `GET /agent/events` (SSE, supports `Last-Event-ID`) or poll `/agent/events/recent`.

## Not done yet

- FISCO BCOS backend (Sepolia works today). The on-chain invoice registry (r3-06) is still off-chain only (`financed_by`).
- Single instance: SSE history, plan jobs and the kill switch live in memory.
- `POST /bank/reset` is open so Demo Mode can call it; lock it down before a public deploy.
