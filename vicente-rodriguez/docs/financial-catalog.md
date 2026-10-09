# Financial product catalog (r5-03)

File: [`data/catalog.json`](../data/catalog.json), 9 products. Lenders are **fictional**; rates are realistic order-of-magnitude values for a Chilean exporting SME in late 2026, **not quotes**. Each one has to be checked against the source listed before the deck quotes it.

| Product | Kind | Key terms | Rate used | Check against |
|---|---|---|---|---|
| Export factoring, non-recourse | factoring | 85% advance, 0.25% fee + CLP 60k/op, 2-day lead, min CLP 10M | 1.35%/month on face value | CMF interest-rate statistics; bank export-factoring price lists |
| Fintech factoring | factoring | 90% advance, 0.5% fee, 1-day lead, min CLP 3M | 1.85%/month | Public rate cards of Chilean factoring fintechs |
| Letter of credit discounting | lc_discount | 95% advance, only LC-backed invoices | 0.85%/month | Bank trade-finance price lists (SOFR + spread) |
| Confirming | confirming | Extends an enrolled supplier payable by 60 days | 1.10%/month | Bank confirming programs |
| Working capital loan (**default**) | loan | 180-day minimum term, 5-day lead, 50% collateral, 0.5% fee | 13.2%/year | CMF / BCCh SME commercial rates; TMC cap |
| FOGAPE-guaranteed loan | loan | 365-day term, 12-day lead, sales ≤ 100,000 UF, 50% guarantee for medium firms | 10.2%/year + 1.3%/year guarantee fee | FOGAPE rules; bidding results (BancoEstado/CORFO) |
| Pre-export loan in USD (PAE) | loan (USD) | 120-day term, 3-day lead, 30% collateral, repaid in USD with export proceeds | 6.8%/year; stamp tax assumed exempt (**verify**) | Term SOFR + exporter spread, bank trade-finance lists; DL 3.475 art. 24 exemptions |
| Credit line / overdraft | loan | 30 days, immediate, max CLP 60M | 2.1%/month, flat 0.332% stamp | CMF statistics on current-account credit lines |
| CNY forward (sell CNY) | forward | Cash-settled, tenor ≤ 180 days | 0.35% spread over covered-interest-parity forward | Bank FX desks; CLP and CNY rates |

Market inputs: TPM 4.50% (BCCh, Sep 2026), CNY rate 1.5% (assumption), UF CLP 41,131 (2026-10-09), stamp tax 0.066%/month capped at 0.8% (DL 3.475).

## How each product enters the model

- **Factoring / LC discounting** — decision: fraction φ of one invoice, on one day. Cash: `+φ·advance·face·FX(day) − cost` on the funding day, `−φ·advance·face·FX(τ)` on the day τ the customer pays (the factor keeps the advance). Cost: `face·(rate·days/30 + fee)` with days = expected collection − funding day (min 15).
- **Loans** — decision: amount L drawn on a given day. Cash: `+L·(1 − fee − stamp)` at draw, `−L·(1 + interest)` at maturity if inside the horizon; USD loans are converted at each scenario's USD/CLP on both dates. Cost counts the full contract term, which is why a 180-day loan is expensive for a 40-day gap.
- **Confirming** — decision: fraction of an enrolled payable. Cash: the payment moves 60 days later and grows by the interest.
- **Forward** — decision: CNY notional on a CNY invoice, settled on its expected collection day. Cash: `h·(K − S(T))` per scenario; cost: spread × notional.

Not modeled yet: export credit insurance, prepayment penalties, CORFO programs other than FOGAPE.
