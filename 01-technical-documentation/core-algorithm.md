# Core algorithm description

Section of the technical documentation (deliverable 01) for the quant engine. Every number the agent shows comes from these deterministic tools; the LLM never calculates. Results quoted here come from `04-source-code/quant/results/` and are regenerated with `python -m nanfeng_quant demo|bench|backtest|sensitivity`.

## 0. The problem the engine solves

A Chilean cherry exporter pays harvest wages in pesos every month but is paid in USD or CNY 60–90 days after shipping, by importers who are sometimes late. One late invoice can leave the company unable to pay its payroll. The engine answers three questions, in this order:

1. **Will cash run out, when, and how likely?** (Monte Carlo forecast)
2. **What is the cheapest way to make sure it doesn't?** (MILP over a catalog of real Chilean financing products)
3. **Why that plan, and how much better than the obvious bank loan?** (explanations, comparison, validation)

## 1. Cash Monte Carlo (90 days)

**State.** Opening cash C₀ (CLP), a buffer B, receivables (invoiced), planned shipments (not yet invoiced) and payables, each in CLP, USD or CNY.

**Uncertainty per path s (N = 10,000 paths, fixed seed):**

- *Payment delay* of customer c beyond the due date: `D = (1 + m_c)·exp(σ_c·Z) − 1`, floored at 0 and rounded to days, Z ~ N(0,1). m_c is the median delay, σ_c the dispersion (lognormal: right-skewed, a few very late payments). An announced delay ("we will pay 45 days late") is added on top.
- *Default*: with probability p_c the customer does not pay inside the horizon.
- *Seasonality*: the cherry season (Nov–Feb) enters through the dated cash calendar itself: weekly shipments peaking in mid-December (each with its consignment advance and a 75-day balance), monthly harvest payrolls that peak in December, and packing/freight costs tied to each shipment. The synthetic generator builds this calendar for each of the 50 SMEs; the Monte Carlo then randomizes when each inflow actually arrives.
- *FX*: daily log-returns of CLP/USD and CLP/CNY are resampled **jointly** (same historical day for both, so their correlation is kept) with a stationary block bootstrap (Politis & Romano 1994, mean block 10 business days) from the last 5 years of real data (BCCh, FRED). Weekends have no move.
- *Cherry price*: one factor per path `P = exp(σ_p·Z − σ_p²/2)` (mean 1) multiplies every shipment not yet invoiced.
- *Parameter uncertainty* (τ = 0.5): the parameters above are estimates, so per path each customer's median delay and dispersion and the price volatility are multiplied by `exp(τ·Z − τ²/2)`.
- *Systemic delays* (ρ = 0.6): in a bad season every importer is late at once (port congestion, a price collapse in China, Lunar New Year). The customer shocks share a common factor: `Z_c = ρ·Z_common + √(1−ρ²)·Z_c'`. This is what fattens the tails of total cash; independent customers would diversify the risk away.

τ and ρ were chosen on the backtest (section 4): with them the P10–P90 band covers **79–83%** of outcomes even when reality has fatter tails than the model assumes (nominal 80%; it was 68–70% with τ = ρ = 0), at the price of over-covering (86–90%) when the parameters are exactly right. For a risk tool, erring on the cautious side is the right trade.

**Cash path.** `C_s(t) = C₀ + Σ_{u ≤ t} flow_s(u)`, where receipts are converted at the simulated FX of the day they arrive and payables at the FX of their date.

**Outputs.** P10/P50/P90 per day (fan chart), `P(C(t) < 0)` per day, `P(min_{u≤t} C(u) < 0)` (cumulative), probability of going below the buffer, and the **crunch day** = first day where `P(C(t) < 0) ≥ 50%`. Headline: "X% probability of negative cash in N days".

**Explainability.** Counterfactual re-runs with **common random numbers** (same seed, same draws, one factor switched off): "this customer pays on time", "announced delays don't happen", "FX stays at spot", "price as planned". The change in probability is attributable to that factor alone.

*Cherry Crisis result:* 13% probability of negative cash within 90 days before the Shanghai notice → **81% probability of negative cash in 19 days (2026-12-30, the CLP 238M harvest payroll)** after it. If the Shanghai importer paid on time, it would be 1%.

## 2. Financing optimizer (MILP)

**Decisions ("levers").** Fraction φ of each eligible invoice factored on a given day; amount L of each loan drawn on a given day **with one of the terms the lender offers** (e.g. 30/60/90/180 days); fraction of each enrolled payable extended by confirming; CNY forward notional h per CNY invoice. Candidate days are the days where the buffer is at risk (and each product's lead time).

**Product rules that matter.** A non-recourse factor will not buy an invoice whose buyer has already announced a delay (so the late Shanghai invoice can only go to the fintech factor, with recourse). With recourse, if the buyer has not paid 30 days after the expected date, the exporter repays the advance. Every loan draw is a separate loan with its own fixed fee and minimum ticket.

**Linearity.** Every lever changes the cash of each scenario linearly: `C_s(t; x) = C_s(t) + Σ_v A_v,s(t)·x_v`, where A is computed from the product terms (advance, pass-through or recourse repayment at the scenario's own collection day, repayment at maturity, forward payoff `K − S_s(T)`).

**Chance constraint (scenario approximation, Luedtke & Ahmed 2008).** Sample S = 200 scenarios. Binary z_s = 1 lets scenario s breach the buffer.

```
min   Σ_v cost_v·x_v + Σ_ops fee·w
s.t.  C_s(t) + Σ_v A_v,s(t)·x_v ≥ B − M_s,t·z_s     ∀ s, ∀ t in check days
      Σ_s z_s ≤ ⌊α·S⌋                                (α = 0.6·(1 − 0.90), tighter in sample)
      factoring: one operation per invoice, min ticket and fixed fee per operation (binary w)
      loans: each (product, day, term) draw is one loan with min ticket and fixed fee (binary w);
             Σ draws ≤ max exposure per product
      Σ financing on an invoice ≤ 100%;  forward notional ≤ unfinanced CNY amount
      lender credit lines;  Σ collateral_p·L_p ≤ collateral available
      Σ operations ≤ 5   (the owner approves the plan on a phone; the sandbox takes ≤ 5)
```

USD loans (pre-export loan, PAE) are drawn and repaid in USD, so their cash effect uses the simulated USD/CLP of each scenario. Check days are the days with an outflow (the only days where the minimum can occur), plus loan maturities, recourse days and forward settlements. Big-M is the tightest valid value per row, `M_s,t = B − (C_s(t) + Σ_v min(0, A_v,s(t))·ub_v)`. The model is solved in millions of CLP for numerical stability, with OR-Tools (CBC, SCIP as fallback). A fast heuristic (drop the αS worst scenarios, solve without z) provides a MIP start.

**Funding days and solver budget.** Financing may be drawn only on the days where the share of scenarios below the buffer jumps (the onset of each risk episode, at most 10 days); cash is still checked on every risk day. This keeps the MILP at ~100–300 decisions instead of ~900 on long horizons. Online, the exact MILP gets 2 s after the heuristic; on the bench the online plan is on average 2.5% more expensive than a 30 s offline solve (worst case 26%), and plan + bank-loan comparison takes 9.6 s median, 46 s p90 with 8 cases sharing the machine. Demo artifacts are solved offline to proven optimality. Identical requests are served from a cache.

**Out-of-sample validation.** The plan is replayed on all 10,000 paths; if fewer than 90% stay above the buffer, α is halved and the model re-solved.

**A fair comparison.** The plan is compared with the **default product alone** (a working-capital bank loan) solved by the same MILP, with the same constraints and the **same freedom to choose its term** (30–180 days). An earlier version forced the bank loan to 180 days, which inflated the savings to 72%; with the fair comparison they are 45%. The bank loan's rate (14%) is also set below the CMF market average for this loan size (20.06%), so the savings are a lower bound.

**Plan explanation.** For each selected product: re-solve without it → extra cost. For each unselected product: eligibility, lead time, or re-solve with only that product → its cost or infeasibility. These checks run in parallel with a 1 s budget each.

*Cherry Crisis result:* a **single 60-day USD pre-export loan (PAE) of USD 142,400 drawn on 2026-12-30** (stamp-tax exempt, repaid with the export proceeds) → total cost **CLP 2,106,329 vs. CLP 3,796,513 for the bank loan (−45%, CLP 1.69M saved)**; 96.1% of the 10,000 paths stay above the buffer and the probability of negative cash falls from 81% to 2.5%. Proven optimal (gap 0). Factoring is the runner-up (alone: CLP 2.80M), and without a PAE on offer the plan is bank + fintech factoring at CLP 2.41M. The CNY forward is never chosen at 90%: the CNY invoices are collected after the crunch day, so a hedge cannot pay the payroll.

## 3. Credit Passport

Transparent scorecard: six factors (90-day probability of negative cash, buffer in months of payroll, customer concentration (HHI), weighted customer delay, debt service / inflows, foreign-currency share), each mapped linearly to 0–100 between fixed "best" and "worst" values and weighted (30/15/20/15/10/10). Every factor reports value, sub-score and points, so a lender can recompute it. It can be scored on the cash paths **after** a plan: Huerto Austral goes from **34 (E) to 67 (B)** with the recommended plan. With the SME's consent a SHA-256 digest of the passport is produced (anchored on-chain by the audit log).

**The weights and bands are heuristic, not calibrated**, and every passport says so (`method`). Calibrating them means regressing real repayment or default outcomes on the six factors (e.g. a logistic regression on a lender's SME portfolio); we have no such data and our companies are synthetic, so fitting the weights to them would be circular. What we can show is that the conclusion does not hang on the weights: the sub-scores do not depend on them, so we re-score Huerto Austral under 10,000 random weightings (`weight_robustness`, in every `optimize_plan` response). With weights within about ±50% of v1, the score goes from 20–48 (P5–P95) before the plan to 55–78 after, and the grade improves in 99.8% of draws; with **any** weighting of the six factors (uniform Dirichlet), the score after the plan is higher in **100%** of draws and the grade improves in 83%.

| Factor | Weight | Sub-score 100 at | Sub-score 0 at | Why these anchors |
|---|---|---|---|---|
| Liquidity: P(cash < 0) in 90 days | 30% | 0% | 60% | The forecast itself; 60% means default is the likely outcome |
| Buffer: median minimum cash, months of payroll | 15% | 2 months | 0 | Two payrolls of slack is a common lender comfort level |
| Customer concentration (HHI of inflows) | 20% | 0.20 (≈ 5 equal customers) | 0.70 (one dominant customer) | Concentration is the classic SME exporter risk |
| Weighted customer delay | 15% | 0 days | 30 days | 30 days late doubles the legal 30-day term |
| Debt service / inflows | 10% | 5% | 40% | Above ~40% most inflows go to lenders |
| Foreign-currency share of inflows | 10% | 30% | 100% | FX exposure, partly hedgeable, so a lower weight |

## 4. Validation

- **NanFeng-Bench** (`04-source-code/quant/results/bench_summary.md`): **50/50 passed**, 25 plans, mean savings 41% vs. the bank loan, oracle coverage ≥ 90.8%. 40 stochastic cases (synthetic SME × stress event) judged by a 50,000-path oracle: the same simulation model with an independent seed, so it checks the optimizer and the plans out of sample, not the model itself, plus 10 deterministic cases checked against a hand-written ledger. It proves the pipeline is right (risk flag, crunch day, plans that hold out of sample, never worse than the bank loan); it does not prove the model matches reality — that is the backtest's job.
- **Backtest** (`04-source-code/quant/results/backtest_summary.md`): rolling-origin FX backtest on real data 2018–2026 (204 origins): the bootstrap's P10–P90 intervals cover 79–83% (nominal 80%) while a Gaussian random walk over-covers CNY (88–92%); nobody beats a random walk on FX point accuracy and we don't claim to. Cash backtest against synthetic truth: CRPS 32–39% better than a point forecast; P10–P90 coverage 86–90% when the model is right and **79–83%** when reality is deliberately different (fatter delay tails, more price volatility, another FX regime); Brier skill for "will we breach the buffer" +53% to +62% vs. climatology.
- **Sensitivity** (`04-source-code/quant/results/sensitivity_summary.md`): savings stay 30–50% under ±30% on every rate, a missing product (no PAE → factoring, 37% cheaper) and every confidence target from 80% to 97.5%. Forcing the bank loan to 180 days reproduces the old, inflated 80%.

## 5. Assumptions and known limitations

- All companies and customers are synthetic; delay distributions and cost shares are expert assumptions, not estimated from real ledgers. τ and ρ are tuned on synthetic truth and should be re-tuned once real ledgers exist.
- Catalog rates are references checked against public sources (CMF certificate 09/2026 for loans), not lender quotes; lenders are fictional.
- FX is resampled from history: no views, no regime switching, no jump risk beyond the sample.
- One common price factor per path (no per-shipment price noise); payables are deterministic.
- Loans cannot be prepaid; credit-line usage is counted at the full drawn amount (conservative).
- The MILP finds the optimum on the sampled scenarios; the out-of-sample check is what guarantees the 90% target, not the in-sample solution.

## 6. Business financial analysis

`04-source-code/quant/nanfeng_quant/analysis.py` (`business_analysis` tool, `POST /quant/analysis`, artifact `04-source-code/quant/results/cherry_crisis_analysis.json`) answers the third part of Topic E, *business financial analysis*, with the data the engine already has: the scenario's receivables, planned shipments and payables (the same records the sandbox bank is seeded with), today's FX and the Monte Carlo paths. Nothing new is assumed and nothing is fitted.

**Contracted view.** Every invoice is paid at its due date + any announced delay + the customer's median delay; each shipment pays its advance on the ship date and its balance after its terms + the median delay; amounts at today's FX and the expected cherry price. It is the deterministic ledger NanFeng-Bench uses as the independent check (`bench.ledger_cash`), and a test asserts they agree to the peso. From it:

| Output | Definition |
|---|---|
| Cash budget by month | inflows, outflows, net and closing cash per calendar month of the 90-day horizon |
| Where the money goes | outflows by category (payroll, suppliers, freight, debt service, taxes, utilities) and their share |
| Operating cash margin | (inflows − outflows other than debt service) / inflows, over the horizon |
| Customer concentration | each customer's share of expected inflows; Herfindahl index; largest customer |
| DSO | open receivables / (annual sales / 365), at today's FX; plus the amount-weighted days to collect and an aging table (0–30, 31–60, 61–90, 90+ days) |
| Currency exposure | inflows and outflows per currency; natural hedge = foreign-currency outflows / foreign-currency inflows; the CLP effect of the peso 10% stronger on the net foreign position |
| Payroll safety | for each payroll: contracted cash before paying it, coverage (cash before / payroll) and, from the Monte Carlo, `P(cash < 0)` at the end of that day |

**Findings.** `insights` turns the numbers into plain sentences in EN / ES / 中文, most severe first, each with its metric and the threshold that fired: a payroll with `P(cash < 0) ≥ 50%` (high) or ≥ 10% (medium); an announced customer delay (high); the largest customer ≥ 40% (high) or ≥ 25% (medium) of inflows; ≥ 70% of inflows in foreign currency (medium); DSO above 60 days (medium); debt service above 20% of inflows (medium, otherwise reported as healthy). The web's Business health screen and the agent's WhatsApp report quote these sentences verbatim; no LLM writes them.

*Cherry Crisis result:* net cash flow CLP 452M over 90 days (37% operating cash margin) but the contracted low point is −CLP 10.6M on 2026-12-30, the December payroll, with an 81% chance cash is negative after paying it (13% for January, 1% for February); Shanghai Hongxin is 58% of expected inflows (index 0.41); 100% of inflows are in USD or CNY and freight offsets only 6%, so a 10% stronger peso costs CLP 130M; DSO 68 days; debt service only 4% of inflows.
