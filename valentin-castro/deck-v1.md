# Deck v1 · 10 minutes (r1-06, r1-10)

Target: **9:30 spoken**, 30 s of margin. English, one idea per slide, every number from [scope-moscow.md](scope-moscow.md) or `vicente-rodriguez/docs/market-data.md`. Visual style: Private desk (`design/private-desk/`), screenshots from the web on branch `valentin-castro`. No maps with borders (plan/risks.md).

| # | Slide | Time | Speaker |
|---|---|---|---|
| 1 | Title | 0:20 | Valentín |
| 2 | The problem | 0:50 | Valentín |
| 3 | Meet Huerto Austral | 0:40 | Vicente |
| 4 | Demo · Cherry Crisis | 2:30 | Valentín (video) |
| 5 | How it works | 0:50 | Renato |
| 6 | The math | 0:50 | Vicente |
| 7 | Security you can watch | 1:00 | Andy |
| 8 | Compliance | 0:30 | Andy |
| 9 | One agent, every market's channel | 0:40 | Camilo |
| 10 | Results, business model, roadmap | 0:40 | Valentín |

---

## 1 · NanFeng 南风 — the autonomous CFO for exporters

- Sail logo, tagline: *"Sees the cash crunch coming, finds the cheapest money, acts with your approval."*
- Topic E · SME Finance Copilot · Universidad del Desarrollo · five names.
- Say: "南风, south wind: the wind that carries Chile to China."

## 2 · The problem: exporters get paid late and borrow expensive

- **USD 2.6 bn** of Chilean cherries in the 2025/26 season, **~87% to China**.
- Chilean SMEs wait **44 days** on average to get paid; **63%** of what they invoice arrives after 30 days. *(open the Bolsa de Productos ranking before quoting 63% — Vicente's note)*
- When cash runs short, banks charge SMEs **20.06% a year** (CMF, Sep 2026).
- Payroll is in pesos, every week; revenue is in dollars and yuan, months later.

## 3 · Meet Huerto Austral (fictional)

- Cherry exporter, CLP 176M in the bank on Dec 11, a CLP 238M harvest payroll on Dec 30.
- Four buyers: Shanghai, Guangzhou, Hong Kong SAR, Miami; invoices in USD and CNY.
- Today: a spreadsheet and a phone call to the bank when it is already too late.
- Visual: Cockpit receivables table.

## 4 · Demo · Cherry Crisis (2:30 cut of the demo video)

1. 10:12 — Shanghai emails: USD 180,000 will arrive 45 days late. OCR reads it.
2. 10:13 — 10,000 simulations: **81% chance cash goes negative in 19 days**, on payroll day (1% if Shanghai paid on time).
3. 10:14 — 9 products checked, 7 quotes; the optimizer picks a **60-day USD pre-export loan of USD 142,400**.
4. 10:15 — WhatsApp to the owner: cost, reason, "APPROVE / WHY". Approval needs a 6-digit SMS code (L3).
5. Executed in the sandbox, hash-chained, anchored on-chain. **CLP 2.1M instead of CLP 3.8M** — 45% cheaper.
6. Earlier that morning, 08:47 — a "supplier" invoice with a changed bank account and a hidden instruction: **blocked**, owner warned on another channel.

## 5 · How it works: the LLM never calculates

- Diagram (from plan/stack.md): Channels → API gateway → OCR → quarantined LLM (typed fields only) → planner → **policy engine L0–L3** → deterministic tools (Monte Carlo, MILP, sandbox bank) → audit log → on-chain anchor.
- Every number on screen comes from a deterministic tool and shows its source.
- OpenRouter routes cheap models to classify and strong ones to plan, with cost and latency per step (Mission Control).

## 6 · The math: probabilities, not averages

- Monte Carlo, 10,000 paths, 90 days, customer delays + FX bootstrapped from BCCh and FRED data.
- Exact chance-constrained MILP (OR-Tools CBC): cheapest mix that keeps cash above the buffer in ≥90% of scenarios; optimality gap 0.
- Explains itself: which customer causes the crunch, and why each of the 9 products is in or out (e.g. non-recourse factoring won't buy an invoice whose buyer already announced a delay; FOGAPE's 365-day minimum term keeps charging interest after the gap closes).
- Visual: fan chart before/after + the "what each option would cost" bars.

## 7 · Security you can watch

- Policy engine outside the LLM: L0 read · L1 notify · L2 pay within limits to allowlisted payees · **L3 new money or new payee = owner + OTP**. Kill switch.
- Voice and the agent can never approve L3 (deepfake risk).
- BEC: changed bank account + look-alike domain → block, call-back number, alert on another channel.
- **Red team: 43 attacks, 4 stopped before → 43/43 after**; CI fails if a single one gets through. The same document attacks also run through the agent: none moves money.
- Audit log: hash chain + Merkle root anchored on-chain (Sepolia today; FISCO BCOS if Camilo lands it).
- **Say (Andy, 1:00):** "We assume the AI will be fooled, so it never decides. A rules engine outside the model sets the level; new money or a new beneficiary waits for the owner's one-time code, and a cloned voice can never approve. At 08:47 a fake supplier invoice changed the bank account and hid an instruction: blocked, and the owner was told on another channel. We attacked our own system forty-three ways; all forty-three are stopped, and the build fails if one ever gets through. Every step is hashed and anchored on-chain, so nobody, not even us, can rewrite what happened."

## 8 · Compliance: built to be trusted with a company's money

| Chile | China | Every market |
|---|---|---|
| **Ley 21.719**: personal data masked before any AI model; every automated money decision is explained and reviewable; new debt or a new payee waits for the owner (L3) | **PIPL**: no profiling of individuals in China; no personal data exported out of China; only what the trade contract needs | **AML**: structuring detection + sanctions screening (synthetic list, real matching) |
| Data minimisation: the AI that reads documents returns typed fields only | **CAC AI labelling**: every message to an importer says 由AI生成 (AI-generated) | **Double financing**: every invoice is registered before it is financed |

- Security of the data: HTTPS only; one-time codes stored as HMAC, never in plain text; tamper-evident audit log anchored on-chain.
- Say it plainly: sanctions list is synthetic; production loads OFAC / UN lists.
- Source: [`andy-villarroel/privacy-compliance.md`](../andy-villarroel/privacy-compliance.md).
- **Say (Andy, 0:30):** "NanFeng never lets the AI touch money or personal data directly. The AI proposes; deterministic rules decide; the owner approves with a one-time code; every step is hashed on-chain."

## 9 · One agent, every market's channel

- Same agent, adapters per market: **WhatsApp** for the Chilean SME, **WeChat / WeCom** for the Chinese importer, **LINE** and **KakaoTalk** across Asia, voice and web everywhere.
- A new channel is a new adapter, not a new agent (ChannelAdapter).
- Visual: Channels screen — owner on WhatsApp next to the importer's reminder in Chinese (WeCom, marked simulated).
- Vision: cross-border SME trade in APEC; Chile → China is the first corridor.

## 10 · Results, business model, roadmap

- **Results:** NanFeng-Bench 50/50 cases solved · −41% average financing cost vs the default bank loan · 43/43 attacks stopped.
- **Business model (B2B2B):** banks and trade-finance fintechs license NanFeng for their SME exporters; license per active SME + success fee on financing originated (pricing to validate). See [business-model.md](business-model.md).
- **Roadmap:** WeCom production channel · FISCO BCOS invoice registry against double financing · real lender APIs with a design partner · next corridor in APEC.
- Close: "NanFeng doesn't advise. It acts — with your permission."

---

## Before Oct 14 (deck v1 due)

- [ ] Screenshots from the web (branch `valentin-castro`) in EN, plus Cockpit and Approvals in 中文 for the China-facing slides.
- [ ] Andy confirms slide 8 wording; Vicente confirms slides 2 and 6 numbers and sources.
- [ ] Time the full run with the team (target 9:30).
