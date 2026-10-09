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

## Tasks

- [ ] `r4-01` **Oct 8** · Must — **Threat model** with STRIDE and the OWASP Top 10 for LLM apps (LLM01 prompt injection, LLM06 excessive agency).
- [ ] `r4-03` **Oct 8** · Must — **Anti-injection design** for Renato: quarantined LLM, marking of untrusted content and guard classifier.
- [ ] `r4-02` **Oct 9** · Must — Deterministic **policy engine** outside the LLM: levels L0–L3, limits per amount and per day, velocity, beneficiary allowlist, kill switch.
- [ ] `r4-04` **Oct 10** · Must — **BEC anti-fraud**: detect a supplier's bank account change against its history → block and verify through another channel.
- [ ] `r4-05` **Oct 10** · Must — **Step-up**: SMS OTP (Zavu) for L3. Voice never approves L3 and we explain why (deepfakes).
- [ ] `r4-07` **Oct 11** · Should — **Privacy and compliance**: data minimization, PII masking before the LLM, encryption, Ley 21.719 (Chile), PIPL (China), simulated sanctions screening.
- [ ] `r4-06` **Oct 12** · Must — **Red team** with 40 or more attacks: poisoned invoice, hidden text in PDF, instruction in image, fake approval, exfiltration, split payments. Before and after metrics.
- [ ] `r4-08` **Oct 14** · Should — **Regulatory slide** for the deck: which regulations we comply with and how.
- [ ] `r4-11` **Oct 14** · Should — **Compliance for China** in the deck and docs: PIPL, cross-border data transfer and the Interim Measures for generative AI (2023), plus Ley 21.719 in Chile.
- [ ] `r4-09` **Oct 15** · Must — **Security Self-Assessment Report**: how the permission levels are implemented and an honest list of known risks.
- [ ] `r4-10` **Oct 16** · Must — **Execution evidence**: review logs and hashes with Camilo and assemble package 06.
