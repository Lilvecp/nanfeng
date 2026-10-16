# R4 · Security & Compliance Lead — Andy Villarroel

**Mission:** Owner of the 30% for security and compliance. Turns security into something the jury sees working live.

**Owns:**
- Threat model
- Policy engine L0–L3
- Injection defense
- Red team
- Compliance and security report

**Deliverables:** 05 · 06 (with Camilo) · 01 (security design)

**Tools:** Python · promptfoo / garak · OWASP LLM Top 10

## Work

Daily logs: [Oct 10](progress-2026-10-10.md) · [Oct 12](progress-2026-10-12.md)

| Task | Where |
|------|-------|
| 01 Security design (technical documentation) | [01-technical-documentation/security-design.md](../../01-technical-documentation/security-design.md) |
| r4-01 Threat model | [threat-model.md](../../05-security-self-assessment-report/threat-model.md) |
| r4-03 Anti-injection design | [anti-injection-design.md](../../05-security-self-assessment-report/anti-injection-design.md) |
| r4-02 Policy engine | [`04-source-code/backend/app/policy.py`](../../04-source-code/backend/app/policy.py) · tests in [`04-source-code/backend/tests/test_policy.py`](../../04-source-code/backend/tests/test_policy.py) · rules in the [backend README](../../04-source-code/backend/README.md#policy-engine-r4-02) |
| r4-04 BEC anti-fraud + guard | [`04-source-code/backend/app/bec.py`](../../04-source-code/backend/app/bec.py), [`04-source-code/backend/app/guard.py`](../../04-source-code/backend/app/guard.py), [`04-source-code/backend/app/routers/security.py`](../../04-source-code/backend/app/routers/security.py) |
| r4-05 Step-up OTP | [`04-source-code/backend/app/otp.py`](../../04-source-code/backend/app/otp.py) · tests in [`04-source-code/backend/tests/test_otp.py`](../../04-source-code/backend/tests/test_otp.py) |
| r4-07 Privacy and compliance | [privacy-compliance.md](../../05-security-self-assessment-report/privacy-compliance.md) · [`04-source-code/backend/app/privacy.py`](../../04-source-code/backend/app/privacy.py), [`04-source-code/backend/app/sanctions.py`](../../04-source-code/backend/app/sanctions.py) |
| r4-06 Red team | [redteam/](../../04-source-code/redteam/) · [results](../../04-source-code/redteam/results/REPORT.md): 46/46 stopped (first 43: 4 → 43) · through the agent: [`04-source-code/agent/tests/test_redteam_via_agent.py`](../../04-source-code/agent/tests/test_redteam_via_agent.py) (21 attacks, none moves money) |
| r4-08 / r4-11 Regulatory slide, China compliance | [privacy-compliance.md](../../05-security-self-assessment-report/privacy-compliance.md#regulatory-slide-deck-r4-08) |
| r4-09 Security Self-Assessment (05) | [security-self-assessment.md](../../05-security-self-assessment-report/security-self-assessment.md) |
| r4-10 Execution evidence (06) | [evidence/](../../06-execution-evidence/) · [sample run](../../06-execution-evidence/out/SUMMARY.md) (owner sign-in, PAE plan, 08:47 attack; bank cost = MILP cost); **live** run on the deployed backend: [out-live](../../06-execution-evidence/out-live/SUMMARY.md), anchor on Sepolia [0x67b483e5…](https://sepolia.etherscan.io/tx/0x8b7839ee8c4fa86391f156d58378fb349489876d64f134eb35bebf7b4e11897b) |

## Tasks

- [x] `r4-01` **Oct 8** · Must — **Threat model** with STRIDE and the OWASP Top 10 for LLM apps (LLM01 prompt injection, LLM06 excessive agency).
- [x] `r4-03` **Oct 8** · Must — **Anti-injection design** for Renato: quarantined LLM, marking of untrusted content and guard classifier.
- [x] `r4-02` **Oct 9** · Must — Deterministic **policy engine** outside the LLM: levels L0–L3, limits per amount and per day, velocity, beneficiary allowlist, kill switch.
- [x] `r4-04` **Oct 10** · Must — **BEC anti-fraud**: detect a supplier's bank account change against its history → block and verify through another channel.
- [x] `r4-05` **Oct 10** · Must — **Step-up**: SMS OTP (Zavu) for L3. Voice never approves L3 and we explain why (deepfakes).
- [x] `r4-07` **Oct 11** · Should — **Privacy and compliance**: data minimization, PII masking before the LLM, encryption, Ley 21.719 (Chile), PIPL (China), simulated sanctions screening.
- [x] `r4-06` **Oct 12** · Must — **Red team** with 40 or more attacks: poisoned invoice, hidden text in PDF, instruction in image, fake approval, exfiltration, split payments. Before and after metrics.
- [x] `r4-08` **Oct 14** · Should — _(content ready in privacy-compliance.md; goes into Valentín's deck)_ **Regulatory slide** for the deck: which regulations we comply with and how.
- [x] `r4-11` **Oct 14** · Should — **Compliance for China** in the deck and docs: PIPL, cross-border data transfer and the Interim Measures for generative AI (2023), plus Ley 21.719 in Chile.
- [x] `r4-09` **Oct 15** · Must — _(v2, Oct 12)_ **Security Self-Assessment Report**: how the permission levels are implemented and an honest list of known risks.
- [x] `r4-10` **Oct 16** · Must — _(live export from the Railway deploy, Oct 12: [out-live/SUMMARY.md](../../06-execution-evidence/out-live/SUMMARY.md), anchor confirmed on Sepolia)_ **Execution evidence**: review logs and hashes with Camilo and assemble package 06.
