# Market data for the deck (r5-05)

Figures for the problem and market slides, each with its source. **Status: collected from web search on 2026-10-09; every figure must be opened at the source and confirmed before it goes in the deck** (see the checklist in the README).

## Chile → China corridor

| Figure | Value | Source | Check |
|---|---|---|---|
| Chilean goods exports, 2024 | USD 100,163 million (+5.9% y/y) | Banco Central de Chile, Indicadores de Comercio Exterior Q4 2024 ([BCCh on X](https://x.com/bcentralchile/status/1894130534483177947)) | Confirm in the BCCh publication itself |
| Share of Chilean exports going to Mainland China, 2024 | ~36% (USD 37.3 bn); other sources say 36–40% | [Marca Chile, "Chile en cifras 2024"](https://www.marcachile.cl/en/cifras-economicas-chile-2024-exportaciones-inversion/), [Statista](https://www.statista.com/statistics/1105972/chile-trade-value-china/) | Use the BCCh number |
| Share of Chile's cherry exports going to China (incl. Hong Kong SAR), 2024/25 | 90.9% (568,504 t) | [Frutas de Chile 2024/25 cherry handbook (Produce Report)](https://www.producereport.com/article/frutas-de-chile-releases-2024-25-cherry-trade-statistics-handbook) | Confirm in the Frutas de Chile handbook |
| Chile's share of China's cherry imports, 2024/25 | ~98% | [Produce Report](https://www.producereport.com/article/chiles-fresh-cherry-exports-china-hit-record-high) | Secondary source |
| Cherry export volume, 2024/25 (to week 9) | 626,013 t, +51% vs 413,979 t | [FreshFruitPortal, 2025-03-19](https://www.freshfruitportal.com/news/2025/03/19/final-stretch-of-chilean-cherry-season-sees-51-rise-in-exports/) | – |
| Cherry FOB price, Sep–Dec 2024 vs. 2023 | USD 5,837/t vs. USD 8,862/t (−34%) | [FreshPlaza](https://www.freshplaza.com/north-america/article/9698304/chilean-fruit-exports-grow-in-volume-and-value/) | Supports the "price risk" story |
| Cherry export value | USD 1.1 bn FOB Sep–Dec 2024; a source reports USD 2.60 bn for a full season (dates unclear) | [FreshPlaza](https://www.freshplaza.com/north-america/article/9698304/chilean-fruit-exports-grow-in-volume-and-value/), [USDA FAS Stone Fruit Annual 2025](https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=Stone+Fruit+Annual_Santiago_Chile_CI2025-0017.pdfc) | **Ambiguous — take the full-season value from the USDA report** |

## SME financing gap

| Figure | Value | Source | Check |
|---|---|---|---|
| MSME finance gap in emerging markets | USD 5.7 trillion; USD 8 trillion including informal firms | [SME Finance Forum, MSME Finance Gap report](https://www.smefinanceforum.org/post/msme-finance-gap-report); [IFC FIG MSME factsheet](https://www.ifc.org/content/dam/ifc/doclink/latest/msme-s-factsheet-ifc-financial-institutions-group.pdf) | Quote the IFC wording exactly |
| MSMEs: share of firms / employment / GDP | >90% / ~70% / ~50% | [IFC MSME Day](https://www.ifc.org/en/what-we-do/msme-day) | – |

## Payment terms (why cash breaks)

| Figure | Value | Source | Check |
|---|---|---|---|
| Legal maximum invoice payment term in Chile | 30 calendar days (Ley 21.131, in force since 2020-04-01; longer terms only by written agreement) | [Defontana](https://www.defontana.com/blog/cl/las-claves-de-la-nueva-ley-de-pago-a-30-dias), [Presidencia](https://prensa.presidencia.cl/comunicado.aspx?id=89464) | Confirm in the law text (BCN) |
| Share of companies paid after the legal term (private sector) | ~60% | [Duemint](https://duemint.com/blog/morosidad-y-ley-de-pago-a-30-dias-cuando-entra-en-vigencia-y-que-impacto-tendra) | **Weak source — find the original survey** |
| Cherry exports to China: typical commercial terms | Consignment with partial advance, liquidation 60–90 days after arrival (assumption used in the model) | — | **Needs a source (ASOEX / Frutas de Chile / exporter interview)** |

## Rates and regulation used by the catalog

| Figure | Value | Source |
|---|---|---|
| BCCh monetary policy rate (TPM) | 4.50%, held at the September 2026 meeting; next meeting Oct 26–27 | [BCCh communiqué, Sep 2026](https://www.bcentral.cl/documents/33528/8618392/Comunicado+RPM+septiembre+2026.pdf/3cec1aa3-00d3-8486-98d6-1eeddb7d997e?t=1788898567406), [calendar](https://www.bcentral.cl/en/content/-/detalle/calendario-de-politica-monetaria-2026) |
| UF | CLP 41,130.94 on 2026-10-09 | [uf-hoy.com](https://www.uf-hoy.com/) (confirm against SII/BCCh) |
| FOGAPE eligibility | Net annual sales ≤ 100,000 UF; coverage 80% (≤ 25,000 UF) / 50% (25,001–100,000 UF); up to 15,000 UF financing | [BancoEstado FOGAPE](https://www.bancoestado.cl/content/bancoestado-public/cl/es/home/inicio---bancoestado-pequena-empresa/productos/garantias-estatales---bancoestado-pequena-empresa/fogape-para-el-pequeno-empresario---bancoestado-pequenas-empresa.html), [Hacienda](https://www.hacienda.cl/noticias-y-eventos/noticias/gobierno-concreta-cambios-al-reglamento-del-credito-fogape-incluira-a-todas-las) |
| Stamp tax (ITE) on credit operations | 0.066% per month or fraction, cap 0.8%; 0.332% flat for sight credits / no maturity | [SII, Ley de Timbres y Estampillas](https://www.sii.cl/normativa_legislacion/timbres.pdf) |

## Data used by the model

| Dataset | Source | License / terms | File |
|---|---|---|---|
| USD/CLP "dólar observado", daily 2010–2026 | Banco Central de Chile, via [mindicador.cl](https://mindicador.cl) public API | Public statistics; mindicador.cl is a free mirror — **confirm terms or switch to the official BDE API (needs registration)** | `data/fx/usdclp_observado.csv` |
| USD/CNY spot (DEXCHUS), daily 2010–2026 | Board of Governors of the Federal Reserve System, via [FRED](https://fred.stlouisfed.org/series/DEXCHUS) | Public domain (Fed H.10); FRED terms of use apply | `data/fx/usdcny_fred.csv` |
| SMEs, customers, invoices, costs | Generated by `nanfeng_quant.synthetic` | Synthetic, ours | `data/synthetic/smes.json` |
