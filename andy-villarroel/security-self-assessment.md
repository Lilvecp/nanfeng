# Security Self-Assessment Report (deliverable 05, r4-09)

**NanFeng — the autonomous CFO for SMEs that export to China** · FinTechathon 2026, Topic E · Owner: Andy Villarroel (Security & Compliance) · Draft v1, Oct 10, 2026 · Final edit: Valentín

## 1. Summary

NanFeng lets an AI agent move a company's money, so its security model starts from one assumption: **the LLM will eventually be fooled.** It is therefore never the component that decides. The agent proposes; a deterministic policy engine outside the LLM assigns a permission level (L0–L3); anything that creates debt, changes a bank account or exceeds a limit waits for the owner's one-time code; every step is written to a hash chain anchored on a public blockchain.

| Evidence | Result |
|----------|--------|
| Red team, 43 outcome-based attacks in 7 categories | **4/43 stopped before → 41/43 after** ([report](redteam/results/REPORT.md)) |
| Automated tests (backend) | 79 passing: policy 20, OTP 12, security/BEC 21, privacy 7, API 15, anchoring 4 |
| CI gate | Fails the build if fewer than 41 red team attacks are stopped |
| Execution evidence | Cherry Crisis end to end with chain verification and Merkle proofs ([evidence](evidence/out/SUMMARY.md)) |

## 2. Where decisions are made

```
document / message ──► guard (deterministic) ──► quarantined LLM (typed fields only) ──► planner LLM
                                                                                           │ proposes
                                                                                           ▼
owner + one-time code ◄── L3 ── policy engine (deterministic, outside the LLM) ── L1/L2 ──► sandbox bank
                                         │                                                     │
                                         └──────────── hash-chained audit log ◄────────────────┘
                                                              │ Merkle root
                                                              ▼
                                                     public chain (EVM testnet; FISCO BCOS-compatible)
```

The LLM has no tool that takes a bank account, a phone number or an approval code. It cannot approve, reject, re-arm the kill switch or sign audit entries as the owner: the API refuses the agent's token on those routes.

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
- **Kill switch**: blocks every money operation and approval. The agent may turn it on, never off.

## 4. Other controls

| Control | Implementation |
|---------|----------------|
| Document guard before any LLM | `POST /security/scan`: instructions aimed at an AI (ES / EN / 中文), hidden PDF text (text layer vs OCR), invisible Unicode, base64-encoded instructions, exfiltration requests, urgency/secrecy |
| BEC anti-fraud | `POST /security/check-payee`: changed bank account, look-alike sender domain, unknown issuer; answers with the call-back number on file; alerts the owner on a different channel |
| Bank-account changes | Only through an L3 approval that records the call-back; old accounts kept in `payee_accounts` |
| PII minimization | `POST /privacy/mask` before any LLM call; audit and alerts show last-4 digits and masked phones |
| Tamper evidence | SHA-256 hash chain over every audit entry, Merkle roots anchored on chain, inclusion proofs per entry |
| Secrets | `.env` git-ignored, gitleaks in CI, testnet-only anchor wallet, spend limits per provider |
| Compliance | Ley 21.719, Ley Fintec, PIPL, CAC generative AI measures: [privacy-compliance.md](privacy-compliance.md) |

## 5. Known risks (honest list)

| # | Risk | Impact | Why it is still open | Mitigation today |
|---|------|--------|----------------------|------------------|
| K1 | **No owner login on the public API.** Anyone who reaches it can turn the kill switch off or reset the sandbox (red team API-02, API-03). | High in production | Owner authentication (Supabase) is not wired yet | Approving still needs the SMS code; the agent token cannot do any of this; the demo runs on synthetic data |
| K2 | Demo Mode uses a shared sandbox code shown on screen | High if used with real money | The jury must be able to run the demo | SMS mode exists and is what the red team and evidence use |
| K3 | The document guard is heuristic, and its author also wrote the attacks | Medium | Time | It is one layer; the policy engine and OTP do not depend on it. Blind attacks and promptfoo/garak against the real agent are next |
| K4 | The quarantined-LLM pipeline is a design until the agent integrates it | Medium | Agent work in progress | Tools still cannot take bank accounts; policy holds regardless |
| K5 | SMS OTP can be defeated by SIM swap | Medium | SMS is what SMEs have | Production: authenticator app or device binding |
| K6 | Single backend instance: lock, kill switch and event history live in memory; a restart turns the kill switch off | Medium | Demo architecture | Persist the kill switch; distributed lock for more instances |
| K7 | Read endpoints are public (balances, audit entries) | Low with synthetic data | Same as K1 | Account numbers and phones masked in the audit log |
| K8 | Sanctions list is synthetic | Low (demo) | No licensed list in a hackathon | The matching is real; production loads official lists |
| K9 | Anchoring runs on an EVM testnet, not FISCO BCOS | Low | Time | Same Merkle format; FISCO BCOS is one more backend |
| K10 | Policy limits change only by deploy; the Settings screen does not save to the backend yet | Low | Write API would need K1 first | Limits are versioned and logged with every decision |

## 6. Reproduce

```sh
cd backend && pytest -q                                       # 79 tests
cd ../andy-villarroel/redteam && python run.py --backend ../../backend --label after && python report.py
cd ../evidence && python build.py --backend ../../backend     # Cherry Crisis evidence
```
