# Financial product catalog (r5-03)

File: [`data/catalog.json`](../data/catalog.json), version 0.2.0, 9 products. Lenders are **fictional**. Rates are **reference values, not quotes**, checked on 2026-10-10 against the sources below.

**How we chose the rates.** Where an official average exists (the CMF interest-rate certificate) we set our rate **below** it on purpose: the default bank loan is then cheaper than the market average, so the savings we claim against it are a lower bound, not an inflated number.

| Product | Kind | Key terms | Rate used | Source and check |
|---|---|---|---|---|
| Export factoring, **non-recourse** (bank) | factoring | 85% advance, 0.25% fee + CLP 60k per operation, 2-day lead, min CLP 10M. **Does not buy an invoice whose buyer already announced a delay** | 1.50%/month on face value | Public Chilean ranges 2026: non-recourse 1.5%–2.2%/month, with recourse 1.2%–1.8% ([chita.cl](https://chita.cl/blog/noticias/que-es-factoring-como-funciona/), [simpli.cl](https://simpli.cl/blog/educacion-financiera/factoring-chile-2026-partner-liquidez/)). Low end because the buyer is insured |
| Fintech factoring, **with recourse** | factoring | 90% advance, 0.5% fee, 1-day lead, min CLP 3M. Buys delayed invoices, but the exporter repays the advance if the buyer has not paid 30 days after the expected date | 1.75%/month | Fintech rate cards: Xepelin 0.5%–1.8%, GoCapital 0.6%–2.0%, Crecer 0.8%–2.2%/month ([portalinnova.cl](https://portalinnova.cl/algunas-de-las-mejores-empresas-para-obtener-factoring-en-chile-2026/)) |
| Letter of credit discounting | lc_discount | 95% advance, only LC-backed invoices | 0.85%/month | Bank trade-finance lists (SOFR + spread) |
| Confirming | confirming | Extends an enrolled supplier payable by 60 days | 1.10%/month | Bank confirming programs |
| Working capital loan (**default**) | loan | **Terms 30 / 60 / 90 / 180 days** (the optimizer picks), 5-day lead, 50% collateral, 0.5% fee + CLP 150k per loan, min CLP 20M per loan | 14.0%/year | **CMF certificate 09/2026** (Diario Oficial 2026-09-15): bank average 20.06%/yr for non-adjustable CLP loans of 90 days or more between 200 and 5,000 UF; 33.34%/yr under 90 days up to 5,000 UF. Ours is lower on purpose |
| FOGAPE-guaranteed loan | loan | 365-day term, 12-day lead, sales ≤ 100,000 UF, 50% guarantee for medium firms | 10.2%/year + 1.3%/year guarantee fee | FOGAPE rules ([BancoEstado](https://www.bancoestado.cl/content/bancoestado-public/cl/es/home/inicio---bancoestado-pequena-empresa/productos/garantias-estatales---bancoestado-pequena-empresa/fogape-para-el-pequeno-empresario---bancoestado-pequenas-empresa.html)) |
| Pre-export loan in USD (PAE) | loan (USD) | **Terms 60 / 90 / 120 / 180 days**, 3-day lead, 30% collateral, repaid in USD with export proceeds | 6.8%/year | CMF certificate 09/2026: foreign-currency bank average 10.26%/yr up to 2,000 UF and 5.78%/yr above (the Cherry Crisis PAE of USD 142k ≈ 3,400 UF) |
| Credit line / overdraft | loan | 30 days, immediate, max CLP 60M | 2.1%/month (25.2%/yr) | Under the CMF short-term average of 33.34%/yr |
| CNY forward (sell CNY) | forward | Cash-settled, tenor ≤ 180 days | 0.35% spread over the covered-interest-parity forward | Bank FX desks |

## Market inputs and tax rules (verified)

| Input | Value | Source |
|---|---|---|
| BCCh monetary policy rate (TPM) | 4.50%, held unanimously on 2026-09-08 | [BCCh communiqué](https://www.bcentral.cl/documents/33528/8618392/Comunicado+RPM+septiembre+2026.pdf/3cec1aa3-00d3-8486-98d6-1eeddb7d997e?t=1788898567406) |
| UF | CLP 41,131 (2026-10-09) | uf-hoy.com / SII |
| Stamp tax (ITE) | 0.066% per month or fraction, cap 0.8%; 0.332% for sight credits | DL 3.475 art. 1 no. 3 ([SII](https://www.sii.cl/normativa_legislacion/leyimpuestoyestampillas.pdf)) |
| Stamp tax on factoring | None: assigning an invoice (Ley 19.983) is a sale of credits, not a credit operation | Ley 19.983 |
| Stamp tax on the PAE | **Exempt**: DL 3.475 art. 24 no. 11 (credits that finance exports), provided the export is made for at least the loan amount before it matures | [SII Ord. 2402/2016](https://www.sii.cl/pagina/jurisprudencia/adminis/2016/otras/ja2402.htm) |
| CNY rate for the forward | 1.5% (assumption) | Only affects the forward, which is never chosen |

## How each product enters the model

- **Factoring / LC discounting** — decision: fraction φ of one invoice, on one day. Cash: `+φ·advance·face·FX(day) − cost` on the funding day. Non-recourse: `−φ·advance·face·FX(τ)` when the buyer pays on day τ (the factor collects). With recourse: the same if the buyer pays by the recourse day; otherwise the exporter repays the advance on the recourse day. Cost: `face·(rate·days/30 + fee)` with days = expected collection − funding day (min 15).
- **Loans** — decision: amount L drawn on a day **with one of the offered terms**. Each draw is its own loan (own fixed fee, own minimum ticket). Cash: `+L·(1 − fee − stamp)` at draw, `−L·(1 + interest)` at maturity; USD loans are converted at each scenario's USD/CLP on both dates. Cost counts the whole term.
- **Confirming** — decision: fraction of an enrolled payable. Cash: the payment moves 60 days later and grows by the interest.
- **Forward** — decision: CNY notional on a CNY invoice, settled on its expected collection day. Cash: `h·(K − S(T))` per scenario; cost: spread × notional.

## Sandbox mapping (for Camilo's bank)

Each product carries `sandbox: {op, lender_id}`. `GET /quant/sandbox/seed` returns the lenders in the backend's `Lender` shape (`id, name, product, annual_rate, advance_pct, fee_pct`), so the operations in a plan's `approval_request` reference lenders that exist in the bank.

| Product | Sandbox op | Sandbox lender |
|---|---|---|
| FACT-BANK | factoring | LEN-FACTOR |
| FACT-FINTECH | factoring | LEN-FINTECH |
| LC-DISC | factoring | LEN-LC |
| WC-BANK | loan | LEN-ANDINO |
| FOGAPE | loan | LEN-FOGAPE |
| PAE-USD | loan | LEN-PAE |
| OVERDRAFT | loan | LEN-OVERDRAFT |
| FWD-CNY | forward | LEN-FXDESK |
| CONF-BANK | confirming (**not in the sandbox yet**: listed under `unsupported`) | LEN-CONFIRMING |

## Still not modeled

Export credit insurance premiums, prepayment of loans before maturity, CORFO programs other than FOGAPE, overlapping credit-line balances over time (usage is counted at the full drawn amount, which is conservative).
