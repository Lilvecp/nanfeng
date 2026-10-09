# Overview

## The bet: an agent that acts, not a chatbot that advises

Chilean SMEs that export to China get paid at 60–90 days, pay seasonal wages in pesos and sell in dollars or yuan. A late payment from Shanghai can break their cash in weeks. **NanFeng sees the crunch before it happens, finds the cheapest financing and executes it with the owner's permission**, via WhatsApp, voice or web.

Behind it are three things almost no team will have together: probabilistic forecasting with Monte Carlo, a MILP optimizer that picks the financing mix, and a security layer the jury can watch blocking an attack live.

> 南风 (nánfēng) means "south wind": that is how Chile reaches China.

## Demo script · "Cherry Crisis"

| Time | Event |
|------|-------|
| 08:00 | Huerto Austral Export SpA (fictional) receives its cash briefing by voice, in Spanish, with ElevenLabs. |
| 10:12 | The Shanghai importer emails that it will pay USD 180,000 45 days late. Mistral OCR reads the notice. |
| 10:13 ⚠ | NanFeng re-runs 10,000 scenarios: 81% probability of negative cash in 19 days, right at harvest payroll. |
| 10:14 | Quotes 4 options and the MILP picks partial factoring + CNY forward, cheaper than the default bank loan. |
| 10:15 | WhatsApp to the owner via Zavu: summary, cost, why. Approves with OTP (level L3). Executed in the sandbox and the hash goes on-chain. |
| 10:31 ⚠ | A "supplier" invoice arrives with a changed bank account and a hidden instruction. NanFeng blocks it and alerts through another channel. |

_Illustrative figures: Valentín and Vicente set the real scenario numbers on Oct 8._

## How we are scored — every rubric point has an owner

| Criterion | Weight | How we cover it | Owners |
|-----------|--------|-----------------|--------|
| Task completion | 40% | 6 real tasks closed end to end in the sandbox · NanFeng-Bench: 50 scenarios with measured success rate | Renato, Camilo, Vicente |
| Security & compliance | 30% | Policy engine L0–L3 outside the LLM · Red team with before/after metrics · Audit log anchored on-chain | Andy |
| Innovation & interaction | 30% | Explainable Monte Carlo + MILP · Each market's channel (WhatsApp, voice, web; WeChat on roadmap), in EN / ES / 中文 · Interactive Scenario Lab | Valentín, Camilo, Vicente |
| Challenge bonus | +0–5 | Audit anchoring on FISCO BCOS (WeBank's blockchain) · Invoice registry against double financing | Camilo builds it; Valentín confirms with the organization whether it applies to Topic E |

## Differentiators — why this project wins and isn't "just another one"

- **Speaks to the jury — WeBank lives off lending to SMEs.** We use their own technology (FISCO BCOS) and their language: cash flow as alternative credit data.
- **Real math — probabilities, not averages.** "81% chance of going red in 19 days" is memorable. A bar chart of expenses is not.
- **Visible security — an attack blocked live.** Account-change fraud (BEC) is the most common theft against SMEs. Showing it stopped is worth more than a slide.
- **Interaction — the channel each market already uses.** WhatsApp for the Chilean SME, WeChat/WeCom for the Chinese importer, LINE or KakaoTalk in the rest of Asia. One agent, any channel. Chinese interface for the judges.
- **Our own numbers — published benchmark.** Success rate, financing cost savings and blocked-attack rate, measured over 50 scenarios.
- **Story — Chile → China, cherries and yuan.** A concrete, authentic case from Chile's most important trade corridor.
