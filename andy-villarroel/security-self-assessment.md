# Security Self-Assessment Report (deliverable 05, r4-09)

**NanFeng — the autonomous CFO for SMEs that export to China** · FinTechathon 2026, Topic E · Owner: Andy Villarroel (Security & Compliance) · v2, Oct 12, 2026 (v1: Oct 10) · Final edit: Valentín

## 1. Summary

NanFeng lets an AI agent move a company's money, so its security model starts from one assumption: **the LLM will eventually be fooled.** It is therefore never the component that decides. The agent proposes; a deterministic policy engine outside the LLM assigns a permission level (L0–L3); anything that creates debt, changes a bank account or exceeds a limit waits for the owner's one-time code; every step is written to a hash chain anchored on a public blockchain. Only the signed-in owner can approve, reject, stop or re-arm the agent.

| Evidence | Result |
|----------|--------|
| Red team, 43 outcome-based attacks in 7 categories | **4/43 stopped before → 43/43 after** ([report](redteam/results/REPORT.md)) |
| Same attacks through the real agent | **21 attacks** through Renato's agent (12 document injections, 4 chat / exfiltration messages, 5 bank-detail swaps): **none moves money** ([test](../renato-lenis/tests/test_redteam_via_agent.py)) |
| Automated tests | **Backend 104**: security/BEC 24, policy 20, API 16, OTP 12, owner sign-in 10, privacy 7, invoice registry 6, demo 5, anchoring 4. **Agent 69**, including the red team replay |
| CI gate | Fails the build if any of the 43 red team attacks gets through |
| Execution evidence | Cherry Crisis end to end: the bank executes exactly the CLP 2,106,329 the MILP planned; chain verified; Merkle proofs ([evidence](evidence/out/SUMMARY.md)) |

## 2. Where decisions are made

```
document / message ──► guard (deterministic) ──► quarantined LLM (typed fields only) ──► planner LLM
                                                                                           │ proposes
                                                                                           ▼
owner session + code ◄── L3 ── policy engine (deterministic, outside the LLM) ── L1/L2 ──► sandbox bank
                                         │                                                     │
                                         └──────────── hash-chained audit log ◄────────────────┘
                                                              │ Merkle root
                                                              ▼
                                                     public chain (Sepolia testnet today)
```

The LLM has no tool that takes a bank account, a phone number or an approval code. It cannot approve, reject, re-arm the kill switch or sign audit entries as the owner: those routes need the owner's session, and the API answers the agent's token with 403 and an anonymous caller with 401.

## 3. Permission levels

| Level | Meaning | Examples | Who acts |
|-------|---------|----------|----------|
| **L0** | Read only | ledger queries, forecasts, quotes, optimizer | Agent, freely |
| **L1** | Act and notify | payment ≤ CLP 1M to an allowlisted payee; FX between own accounts | Agent; owner notified |
| **L2** | Act within limits | payment ≤ CLP 25M per action; agent spend ≤ CLP 40M / 24 h and ≤ CLP 80M / 30 days | Agent |
| **L3** | Owner approval with OTP | factoring, loans, FX forwards, payee bank-account changes, any payee off the allowlist, anything above an L2 limit | Owner, one-time code by SMS |
| **Blocked** | Not even the owner, from the app | above CLP 400M per action or per 30 days; sanctions match; kill switch on | Bank / compliance, outside NanFeng |

### How the levels are enforced

- **Policy engine** (`backend/app/policy.py`): a pure function of the request, the history of executed requests and the clock. Limits are data with the same keys as the Settings screen and are published at `GET /policy`. The rules that escalate a request:

| Rule | Stops |
|------|-------|
| `financing` | new debt or FX commitments without the owner |
| `payee_not_allowlisted` | payments to new beneficiaries |
| `l2_per_action`, `request_total` | large payments, and several medium ones packed into one request |
| `l2_per_day`, `l2_per_month` (rolling 24 h / 30 days) | slow draining |
| `velocity` (5 automatic actions in 10 min) | runaway loops |
| `structuring` | one payment split into several to the same payee within 24 h |
| `recent_account_change` (72 h) | paying a beneficiary right after its account changed (BEC) |
| `sanctions_hit` | counterparties on the watchlist (blocked) |
| `l3_per_action`, `l3_per_month` | amounts that should never go through an app (blocked) |

  Decision and execution run under one lock, so two concurrent requests cannot both fit under a cumulative limit (verified by a test that fails without the lock). Every decision records the rules that fired and the policy version in the audit chain.

- **Step-up authentication** (`backend/app/otp.py`): in SMS mode each L3 approval gets its own random 6-digit code sent by Zavu to the owner's phone. Only `HMAC(approval id | amount | code)` is stored: the code works once, for that approval and that amount, for 5 minutes, and is never written to the audit log, the event stream or the agent's context. Three wrong codes lock the approval. Resends are rate-limited.
- **Voice never approves L3.** Any approval whose channel includes "voice" is refused and logged: a cloned voice costs a few seconds of audio.
- **Owner session** (`backend/app/auth.py`): the owner signs in with a password and gets an HMAC-signed token valid for 8 hours; sign-out revokes it; failed sign-ins are rate limited (5 per 5 minutes per client). The backend refuses to start with the public demo password unless it is a demo build.
- **Kill switch**: blocks every money operation and approval. The owner or the agent may turn it on; turning it off needs the owner's session **and** a one-time code. It is stored in the database, so a restart or a deploy never turns it off.

## 4. Other controls

| Control | Implementation |
|---------|----------------|
| Document guard before any LLM | `POST /security/scan`: instructions aimed at an AI (ES / EN / 中文), hidden PDF text (text layer vs OCR), invisible Unicode, base64-encoded instructions, exfiltration requests, urgency/secrecy |
| BEC anti-fraud | `POST /security/check-payee`: changed bank account, look-alike sender domain, unknown issuer; answers with the call-back number on file; alerts the owner on a different channel |
| Bank-account changes | Only through an L3 approval that records the call-back; old accounts kept in `payee_accounts` |
| PII minimization | `POST /privacy/mask` before any LLM call; audit and alerts show last-4 digits and masked phones |
| Tamper evidence | SHA-256 hash chain over every audit entry, Merkle roots anchored on chain, inclusion proofs per entry. Every document the agent reads leaves its SHA-256 fingerprint in the chain (never the text) |
| Double financing | Invoice registry (`backend/app/registry.py`): an invoice's fingerprint is registered before the bank pays out on it, in our database and (with `NANFENG_REGISTRY_BACKEND=evm`) in an on-chain contract; an invoice already registered is refused |
| Quarantined extraction | The agent's document reader returns typed fields only; the planner never sees raw text (`renato-lenis/nanfeng_agent/quarantine.py`) |
| Secrets | `.env` git-ignored, gitleaks in CI, testnet-only anchor wallet, spend limits per provider |
| Machine callers | Agent routes fail closed when no agent token is configured; the `.env.example` placeholder is refused at startup; anchoring needs the agent token or the owner session, so nobody else can spend the anchoring wallet (threat model F6, F13) |
| Compliance | Ley 21.719, PIPL, CAC generative AI measures: [privacy-compliance.md](privacy-compliance.md). The AI-generated label for Chinese importers is planned, not built |

## 5. Known risks (honest list)

| # | Risk | Impact | Why it is still open | Mitigation today |
|---|------|--------|----------------------|------------------|
| K1 | **Owner sign-in is a single shared password**, and demo builds show it on the sign-in screen. Anyone with the password is the owner. (Fixed: anonymous callers can no longer approve, reject, turn the kill switch off or reset the sandbox; red team API-02, API-03 stopped.) | Medium in production | One owner per company in the MVP; per-user accounts come with Supabase auth | Startup refuses the demo password outside demo builds; failed sign-ins rate limited; turning the kill switch off and approving still need the SMS code |
| K2 | Demo Mode uses a shared sandbox code shown on screen | High if used with real money | The jury must be able to run the demo | SMS mode exists and is what the red team and evidence use |
| K3 | The document guard is heuristic, and its author also wrote the attacks | Medium | Time | It is one layer; the policy engine and OTP do not depend on it. Through the real agent, 8 of the 12 document attacks are only `suspicious`: the agent continues with typed fields and does not pay, but nothing blocks the run. A blind set from the rest of the team is next |
| K4 | ~~Quarantined-LLM pipeline only designed~~ **Fixed**: integrated in the agent (r2-03) and red-teamed through it | — | — | — |
| K5 | SMS OTP can be defeated by SIM swap | Medium | SMS is what SMEs have | Production: authenticator app or device binding |
| K6 | Single backend instance: the policy lock and the event history live in memory | Low | Demo architecture | The kill switch is now stored in the database (a restart no longer turns it off); a distributed lock is needed before running several instances |
| K7 | Read endpoints are public (balances, audit entries) | Low with synthetic data | Writes were closed first; reads come after the delivery (threat model F11) | Account numbers and phones masked in the audit log |
| K8 | Sanctions list is synthetic | Low (demo) | No licensed list in a hackathon | The matching is real; production loads official lists |
| K9 | Anchoring and the invoice registry run on an EVM testnet (Sepolia), not FISCO BCOS | Low | FISCO BCOS needs its own node (Docker) | Same Merkle format; FISCO BCOS is one more backend |
| K10 | Policy limits change only by deploy; the Settings screen does not save to the backend yet | Low | Not in the frozen scope | Limits are versioned and logged with every decision; a write API would sit behind the owner session |

## 6. Reproduce

```sh
cd backend && pytest -q                                       # 104 tests
cd ../renato-lenis && pytest -q                               # 69 agent tests, red team replay included
cd ../andy-villarroel/redteam && python run.py --backend ../../backend --label after --min-stopped 43 && python report.py
cd ../evidence && python build.py --backend ../../backend     # Cherry Crisis evidence
python build.py --url <deployed backend> --out out-live      # same export from the live deploy
```
