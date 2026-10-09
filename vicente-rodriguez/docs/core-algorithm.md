# Core algorithm description (r5-11)

Section of the technical documentation (deliverable 01) for the quant engine. Every number the agent shows comes from these deterministic tools; the LLM never calculates. Results quoted here come from `results/` and are regenerated with `python -m nanfeng_quant demo|bench|backtest`.

## 1. Cash Monte Carlo (90 days)

**State.** Opening cash C₀ (CLP), a buffer B, receivables (invoiced), planned shipments (not yet invoiced) and payables, each in CLP, USD or CNY.

**Uncertainty per path s (N = 10,000 paths, fixed seed):**

- *Payment delay* of customer c beyond the due date: `D = (1 + m_c)·exp(σ_c·Z) − 1`, floored at 0 and rounded to days, with Z ~ N(0,1). m_c is the median delay, σ_c the dispersion (lognormal: right-skewed, a few very late payments). An announced delay (e.g. "45 days late") is added on top.
- *Default*: with probability p_c the customer does not pay inside the horizon.
- *FX*: daily log-returns of CLP/USD and CLP/CNY are resampled **jointly** (same historical day for both, so their correlation is kept) with a stationary block bootstrap (Politis & Romano 1994, mean block 10 business days) from the last 5 years of real data. Weekends have no move.
- *Cherry price*: one factor per path `P = exp(σ_p·Z − σ_p²/2)` (mean 1) multiplies every shipment not yet invoiced.
- *Parameter uncertainty* (τ = 0.35): the parameters above are estimates, so per path each customer's median delay and dispersion and the price volatility are multiplied by `exp(τ·Z − τ²/2)`. This fattens the tails. τ was chosen on the backtest: P10–P90 coverage goes from 68–70% to 73–75% when reality has fatter tails than assumed, at the cost of 83–86% (instead of 80–82%) when the parameters are exactly right; CRPS is unchanged.

**Cash path.** `C_s(t) = C₀ + Σ_{u ≤ t} flow_s(u)`, where receipts are converted at the simulated FX of the day they arrive and payables at the FX of their date.

**Outputs.** P10/P50/P90 per day (fan chart), `P(C(t) < 0)` per day, `P(min_{u≤t} C(u) < 0)` (cumulative), probability of going below the buffer, and the **crunch day** = first day where `P(C(t) < 0) ≥ 50%`. Headline: "X% probability of negative cash in N days".

**Explainability.** Counterfactual re-runs with **common random numbers** (same seed, same draws, one factor switched off): "this customer pays on time", "announced delays don't happen", "FX stays at spot", "price as planned". The change in probability is attributable to that factor alone.

*Cherry Crisis result:* 10% probability of negative cash within 90 days before the Shanghai notice → **81% probability of negative cash in 19 days (2026-12-30, harvest payroll)** after it. If the Shanghai importer paid on time, it would be 1%.

## 2. Financing optimizer (MILP)

**Decisions ("levers").** Fraction φ of each eligible invoice factored on a given day; amount L of each loan drawn on a given day; fraction of each enrolled payable extended by confirming; CNY forward notional h per CNY invoice. Candidate days are the days where the buffer is at risk (and each product's lead time).

**Linearity.** Every lever changes the cash of each scenario linearly: `C_s(t; x) = C_s(t) + Σ_v A_v,s(t)·x_v`, where A is computed from the product terms (advance, rebate at the scenario's own collection day, repayment at maturity, forward payoff `K − S_s(T)`).

**Chance constraint (scenario approximation, Luedtke & Ahmed 2008).** Sample S = 200 scenarios. Binary z_s = 1 lets scenario s breach the buffer.

```
min   Σ_v cost_v·x_v + Σ_p fixed_p·y_p + Σ_ops fee·w
s.t.  C_s(t) + Σ_v A_v,s(t)·x_v ≥ B − M_s,t·z_s     ∀ s, ∀ t in check days
      Σ_s z_s ≤ ⌊α·S⌋                                (α = 0.6·(1 − 0.90), tighter in sample)
      x_v ≤ ub_v·y_p,  loan min/max tickets·y_p
      factoring: one operation per invoice, min ticket and fixed fee per operation (binary w)
      Σ financing on an invoice ≤ 100%;  forward notional ≤ unfinanced CNY amount
      lender credit lines;  Σ collateral_p·L_p ≤ collateral available
      Σ active operations ≤ 5   (the owner approves the plan on a phone)
```

USD loans (pre-export loan, PAE) are drawn and repaid in USD, so their cash effect uses the simulated USD/CLP of each scenario. The action cap is only added when the uncapped optimum needs more than 5 operations (it adds one binary per lever and slows the solve).

Check days are the days with an outflow (the only days where the minimum can occur), plus loan maturities and forward settlements. Big-M is the tightest valid value per row, `M_s,t = B − (C_s(t) + Σ_v min(0, A_v,s(t))·ub_v)`. The model is solved in millions of CLP for numerical stability, with OR-Tools (CBC, SCIP as fallback). A fast heuristic (drop the αS worst scenarios, solve without z) provides a MIP start.

**Out-of-sample validation.** The plan is replayed on all 10,000 paths; if fewer than 90% stay above the buffer, α is halved and the model re-solved. Cost is compared with the **default product alone** (working-capital bank loan) under the same constraints.

**Plan explanation.** For each selected product: re-solve without it → extra cost. For each unselected product: eligibility, lead time, or re-solve with only that product → its cost or infeasibility (e.g. the overdraft's 30-day repayment lands on the January payroll).

*Cherry Crisis result:* partial export factoring of three invoices — INV-2026-121 (CNY) 44% and INV-2026-109 (USD) 24% on 2026-12-30, and 21% of the delayed Shanghai invoice INV-2026-118 on 2027-01-20 → total cost **CLP 1,639,278 vs. CLP 5,813,905 for the default bank loan (−72%)**, 92.9% of out-of-sample paths above the buffer, optimal (gap 0) in ~7 s. The CNY forward is not chosen at 90% confidence (see `results/sensitivity_summary.md` for when it would be).

## 3. Credit Passport

Transparent scorecard: six factors (90-day probability of negative cash, buffer in months of payroll, customer concentration (HHI), weighted customer delay, debt service / inflows, foreign-currency share), each mapped linearly to 0–100 between fixed "best" and "worst" values and weighted (30/15/20/15/10/10). Every factor reports value, sub-score and points, so a lender can recompute it. With the SME's consent a SHA-256 digest of the passport is produced (can be anchored on-chain by Camilo's audit log).

## 4. Validation

- **NanFeng-Bench** (`results/bench_summary.md`): 40 stochastic cases (synthetic SME × stress event) judged by an independent 50,000-path oracle with another seed, plus 10 deterministic cases checked against a hand-written ledger.
- **Backtest** (`results/backtest_summary.md`): rolling-origin FX backtest on real data since 2018 (CRPS, P10–P90 coverage) vs. a Gaussian random walk; cash backtest against synthetic truth, well specified and deliberately misspecified (fatter delay tails, more price volatility, different FX regime).

## 5. Assumptions and known limitations

- All companies and customers are synthetic; delay distributions and cost shares are expert assumptions, not estimated from real ledgers.
- Catalog rates are reference values to verify; lenders are fictional.
- FX is resampled from history: no views, no regime switching, no jump risk beyond the sample.
- One common price factor per path (no per-shipment price noise); payables are deterministic.
- Factoring is priced non-recourse with a fixed discount on expected days; real factors may refuse an invoice whose debtor already announced a delay.
- Credit-line usage is counted at the full drawn amount (conservative), not as an overlapping balance over time.
- Parameter uncertainty τ is one number for all companies, tuned on synthetic truth; it should be re-tuned once real ledgers exist.
- The MILP finds the optimum on the sampled scenarios; the out-of-sample check is what guarantees the 90% target, not the in-sample solution.
