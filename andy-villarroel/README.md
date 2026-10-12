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

Daily log: [progress-2026-10-10.md](progress-2026-10-10.md)

| Task | Where |
|------|-------|
| r4-01 Threat model | [threat-model.md](threat-model.md) |
| r4-03 Anti-injection design | [anti-injection-design.md](anti-injection-design.md) |
| r4-02 Policy engine | [`backend/app/policy.py`](../backend/app/policy.py) · tests in [`backend/tests/test_policy.py`](../backend/tests/test_policy.py) · rules in the [backend README](../backend/README.md#policy-engine-r4-02) |
| r4-04 BEC anti-fraud + guard | [`backend/app/bec.py`](../backend/app/bec.py), [`backend/app/guard.py`](../backend/app/guard.py), [`backend/app/routers/security.py`](../backend/app/routers/security.py) |
| r4-05 Step-up OTP | [`backend/app/otp.py`](../backend/app/otp.py) · tests in [`backend/tests/test_otp.py`](../backend/tests/test_otp.py) |
| r4-07 Privacy and compliance | [privacy-compliance.md](privacy-compliance.md) · [`backend/app/privacy.py`](../backend/app/privacy.py), [`backend/app/sanctions.py`](../backend/app/sanctions.py) |
| r4-06 Red team | [redteam/](redteam/) · [results](redteam/results/REPORT.md): 4/43 → 43/43 stopped |
| r4-08 / r4-11 Regulatory slide, China compliance | [privacy-compliance.md](privacy-compliance.md#regulatory-slide-deck-r4-08) |
| r4-09 Security Self-Assessment (05) | [security-self-assessment.md](security-self-assessment.md) |
| r4-10 Execution evidence (06) | [evidence/](evidence/) · [sample run](evidence/out/SUMMARY.md); live export from the deployed backend pending with Camilo |

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
- [x] `r4-09` **Oct 15** · Must — _(v1; refresh after the freeze)_ **Security Self-Assessment Report**: how the permission levels are implemented and an honest list of known risks.
- [ ] `r4-10` **Oct 16** · Must — _(builder + sample done; live export from Camilo's deploy pending)_ **Execution evidence**: review logs and hashes with Camilo and assemble package 06.
