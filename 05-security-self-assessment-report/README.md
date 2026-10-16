# 05 · Security self-assessment report

Permission-tier implementation and known-risk list (submission checklist item 05).

| File | What |
|---|---|
| **[NanFeng-Security-Self-Assessment-Report.pdf](NanFeng-Security-Self-Assessment-Report.pdf)** | The four documents below in one PDF, ready to read or print |
| [security-self-assessment.md](security-self-assessment.md) | **The report.** Where decisions are made, permission levels L0–L3 and how each is enforced, other controls, the known-risk list (K1–K9) and how to reproduce the results |
| [threat-model.md](threat-model.md) | STRIDE per trust boundary and the OWASP Top 10 for LLM applications; findings F1–F15 and their fixes |
| [anti-injection-design.md](anti-injection-design.md) | How documents written by strangers are kept away from the decisions: quarantined extraction, guard, typed fields |
| [privacy-compliance.md](privacy-compliance.md) | Data minimisation, PII masking, sanctions screening; Ley 21.719 (Chile), PIPL and the CAC measures (China) |

Red team results (46/46 attacks stopped): [`04-source-code/redteam/results/REPORT.md`](../04-source-code/redteam/results/REPORT.md). Security design in the technical documentation: [`01-technical-documentation/security-design.md`](../01-technical-documentation/security-design.md).
