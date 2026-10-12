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

## Sandbox data

Accounts, receivables, lenders and FX rates come from Vicente's engine so the bank matches the forecast and the MILP plan (e.g. the PAE loan, lender `LEN-PAE`). After the scenario or the catalog changes:

```sh
cd vicente-rodriguez
python -c "import json; from nanfeng_quant.tools import sandbox_seed; json.dump(sandbox_seed('cherry_crisis'), open('../backend/app/data/sandbox_seed.json', 'w'), indent=1, ensure_ascii=False)"
```

Then reset the sandbox (`POST /bank/reset`, or delete `nanfeng.db` locally).

## Owner sign-in (threat model F1)

Approve, reject, resend a code, the kill switch and `POST /bank/reset` are owner-only. The owner signs in with `POST /auth/login {password}` and sends `Authorization: Bearer <token>` (an HMAC-signed session, 8 h, ended by `POST /auth/logout`). Failed sign-ins are rate limited (5 per 5 min per client). The agent token is never accepted as the owner (403).

- Kill switch: the owner or the agent may turn it **on**; turning it **off** needs the owner's session **and** a one-time code (`otp`; in SMS mode ask for one with `POST /policy/kill-switch/otp`). It is stored in the database (`app_state`), so a restart, a deploy or a sleeping host never turns it off.
- `POST /bank/reset` exists only with `NANFENG_DEMO=true`.
- Demo builds use the public password `huerto-demo-2026` and show it on the sign-in screen (`GET /auth/config`). With `NANFENG_DEMO=false` the backend refuses to start on that password.
- Reads (`/bank/*`, `/audit/*`, `/approvals` GET, the SSE stream) stay public for now (F11).

## Demo Mode replay (fe-10)

`POST /demo/step/{1..6}` (owner, demo builds only) makes each Cherry Crisis step really happen, so every open screen follows the video over SSE: **1** resets the sandbox · **2–3** publish the forecast and quotes · **4** creates the approval request through the policy engine · **5** approves it with the sandbox code (executes in the bank, anchors on-chain) · **6** closes the run. Agent steps carry `source: "agent-replay"`. The cockpit's Demo page calls it as it plays (`web/src/lib/demo-replay.ts`); without a backend the same steps drive the local desk state. In SMS OTP mode step 5 refuses (the owner approves with the texted code).

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
- Single instance: SSE history and plan jobs live in memory (the kill switch is in the database).
- `POST /bank/reset` is open so Demo Mode can call it; lock it down before a public deploy.
