# R5 · Quant & Data Scientist — Vicente Rodríguez

**Mission:** The math nobody else will have. Owner of the forecast, the optimizer and the benchmark that backs every number in the pitch.

**Owns:**
- Synthetic data
- Cash Monte Carlo
- MILP optimizer
- Financial catalog
- NanFeng-Bench

**Deliverables:** 01 (algorithms) · Benchmark results

**Tools:** Python · NumPy / SciPy · OR-Tools / PuLP · Jupyter

## Tasks

- [ ] `r5-01` **Oct 8** · Must — **Cherry Crisis scenario numbers** with Valentín and **synthetic data generator**: 50 exporting SMEs with cherry seasonality (Nov–Feb), customers with delay distributions, costs and debts.
- [ ] `r5-02` **Oct 8** · Must — **Real FX data** CLP/USD (Banco Central de Chile) and historical USD/CNY for the bootstrap.
- [ ] `r5-03` **Oct 9** · Must — **Catalog of realistic financial products** (factoring, confirming, working capital, FOGAPE, letter of credit, forward) with reference rates.
- [ ] `r5-04` **Oct 9** · Must — **90-day Monte Carlo**: delay per customer (lognormal), FX via log-return bootstrap and seasonality → P10/P50/P90, days to crunch, P(cash < 0).
- [ ] `r5-07` **Oct 10** · Must — **MILP optimizer**: minimize total financing cost with cash above a buffer in the P90 scenarios, respecting credit lines, terms and collateral.
- [ ] `r5-08` **Oct 11** · Should — **Explainability**: which customer or variable causes the crunch and why each option was included or excluded.
- [ ] `r5-09` **Oct 11** · Could — **Credit Passport**: explainable financial health score the SME shares with a lender, with its consent.
- [ ] `r5-06` **Oct 12** · Should — **Backtest** of the forecast (CRPS and interval coverage) with numbers for the docs.
- [ ] `r5-05` **Oct 13** · Should — **Market data** with sources for the deck: SME financing gap, Chile → China exports, payment terms.
- [ ] `r5-10` **Oct 13** · Must — **NanFeng-Bench**: 50 scenarios with a correct answer → success rate, savings vs. default loan, latency.
- [ ] `r5-11` **Oct 14** · Must — **Core algorithm description** for the documentation, with formulas, assumptions and results.
