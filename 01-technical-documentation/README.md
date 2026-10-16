# 01 · Technical documentation

System architecture, core algorithm description and security design (submission checklist item 01).

| File | What | Owner |
|---|---|---|
| **[NanFeng-Technical-Documentation.pdf](NanFeng-Technical-Documentation.pdf)** | The four documents below in one PDF, ready to read or print | Team |
| [technical-documentation.md](technical-documentation.md) | **Start here.** What NanFeng does, system architecture, the agent loop, algorithms, security, testing and known limitations | Team |
| [core-algorithm.md](core-algorithm.md) | Quant engine in full: Monte Carlo cash forecast, chance-constrained MILP, fair comparison with the bank loan, validation | Vicente Rodríguez |
| [agent.md](agent.md) | Agent in full: document intake, quarantined extraction, planner, tools, channels, service endpoints | Renato Lenis |
| [security-design.md](security-design.md) | Security design in full: policy engine L0–L3, step-up OTP, document guard, BEC checks, audit chain and anchoring | Andy Villarroel |

Related: the quant package's own docs (financial catalog, market data, quant API) are in [`04-source-code/quant/docs/`](../04-source-code/quant/docs/); the security self-assessment report is in [`05-security-self-assessment-report/`](../05-security-self-assessment-report/).
