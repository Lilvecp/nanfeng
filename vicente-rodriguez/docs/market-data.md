# Market data for the deck (r5-05)

Figures for the problem and market slides, each with its source. Re-checked on **2026-10-10**: the 2025/26 cherry season replaces the older 2024/25 numbers, and the weak "60% paid late" figure is replaced by the Bolsa de Productos ranking. Column "Status": ✅ confirmed at an official or primary source · 🟡 reputable secondary source (fine for a slide, cite it).

## Chile → China corridor

| Figure | Value | Source | Status |
|---|---|---|---|
| Chilean cherry exports, 2025/26 season | **USD 2.6 bn FOB** (Sep 2025–Feb 2026), 113.8 M boxes ≈ 569 kt; down 8% in value vs 2024/25 as prices fell | [FreshPlaza](https://www.freshplaza.com/north-america/article/9812438/chile-cherry-exports-reach-113-8-million-boxes-as-prices-fall/), [FreshFruitPortal](https://www.freshfruitportal.com/news/2026/09/23/chilean-fruit-exports/) (Frutas de Chile data) | 🟡 |
| Share going to China, 2025/26 | **~87%** of value and volume (98.9 M boxes); 92% the season before | Same sources | 🟡 |
| Cherries in Chile's fresh-fruit exports | 60% of value, 38% of volume | [FreshFruitPortal](https://www.freshfruitportal.com/news/2026/09/23/chilean-fruit-exports/) | 🟡 |
| Chile's share of China's cherry imports | ~98% (2024/25) | [Produce Report](https://www.producereport.com/article/chiles-fresh-cherry-exports-china-hit-record-high) | 🟡 |
| Price risk | FOB price Sep–Dec 2024 USD 5,837/t vs USD 8,862/t a year earlier (−34%) | [FreshPlaza](https://www.freshplaza.com/north-america/article/9698304/chilean-fruit-exports-grow-in-volume-and-value/) | 🟡 |
| Chilean goods exports, 2024 | USD 100.2 bn (+5.9%); ~36% to Mainland China | Banco Central de Chile; [Marca Chile](https://www.marcachile.cl/en/cifras-economicas-chile-2024-exportaciones-inversion/) | 🟡 (use the BCCh figure) |
| Logistics | Express services reach China in 21–23 days; ~4,000 containers arrived in the first week of January 2026 | [Xinhua](https://english.news.cn/20260113/0eb97c8640c940b69957e611e52bf62b/c.html) | 🟡 |

## Late payment (why cash breaks)

| Figure | Value | Source | Status |
|---|---|---|---|
| Legal maximum invoice term in Chile | 30 calendar days (Ley 21.131, since 2020) | Ley 21.131 (BCN) | ✅ |
| Invoices paid after 30 days | **63% of the amount** invoiced by SMEs; average payment term **44 days** (Jul 2025–Jun 2026) | Bolsa de Productos, Ranking de Pagadores, as reported by the press in 2026 ([Orsan](https://www.orsancheque.cl/pagos-fuera-de-plazo-problemas-de-liquidez-en-2026/), [La Tercera](https://www.latercera.com/pulso/noticia/estudio-muestra-que-el-50-de-las-facturas-emitidas-por-pymes-se-pagan-a-mas-de-30-dias/)) | 🟡 open the ranking itself before quoting 63% |
| SME invoices paid after 30 / 60 days | ~50% / ~15% | Xepelin analysis ([fintechile.org](https://fintechile.org/noticias/estudio-muestra-que-el-50-de-las-facturas-emitidas-por-pymes-se-pagan-a-mas-de-30-dias)) | 🟡 |
| SMEs reporting late payments from customers | ~80% | ASECH + CobranzaOnline national survey, Jul–Aug 2025 | 🟡 |
| Cherry exports to China: commercial terms | Consignment with partial advance, liquidation after sale in China (we model 15% advance and 75 days) | No public source found | **Assumption — say so if asked** |

## SME financing

| Figure | Value | Source | Status |
|---|---|---|---|
| MSME finance gap in emerging markets | USD 5.7 trillion; USD 8 trillion including informal firms | [SME Finance Forum / IFC](https://www.smefinanceforum.org/post/msme-finance-gap-report) | ✅ |
| MSMEs: share of firms / employment / GDP | >90% / ~70% / ~50% | [IFC](https://www.ifc.org/en/what-we-do/msme-day) | ✅ |
| What Chilean banks charge SMEs | 20.06%/yr average (CLP loans ≥ 90 days, 200–5,000 UF); 33.34%/yr under 90 days; 6.64%/yr for large loans above 5,000 UF | **CMF certificate 09/2026**, Diario Oficial 2026-09-15 | ✅ |
| Factoring as the SME fallback | Factored invoice volume up 16% as bank credit tightened (2026) | [G5 Noticias](https://g5noticias.cl/2026/07/27/ante-el-freno-del-credito-bancario-pymes-se-vuelcan-al-factoring-y-disparan-en-16-el-monto-de-sus-facturas-adelantadas/) | 🟡 |
| Monetary policy rate | 4.50% (held 2026-09-08); GDP growth 2026 cut to 0.25–0.75% | [BCCh](https://www.bcentral.cl/en/content/-/detalle/prensa/nota-de-prensa/bcch-publica-ipom-septiembre-2026) | ✅ |

**Slide line that holds up:** *"Chile ships USD 2.6 bn of cherries a season, ~87% to China. Chilean SMEs wait 44 days on average to get paid, and 63% of what they invoice arrives late. When cash runs short, banks charge them 20% a year."*

## Data used by the model

| Dataset | Source | License / terms | File |
|---|---|---|---|
| USD/CLP "dólar observado", daily 2010–2026 | Banco Central de Chile, via the [mindicador.cl](https://mindicador.cl) public API | Official BCCh public statistics; mindicador.cl is a free, open mirror that republishes them. Decision: keep it (the BDE API needs a registered account and returns the same series); cite the BCCh as the source | `data/fx/usdclp_observado.csv` |
| USD/CNY spot (DEXCHUS), daily 2010–2026 | Board of Governors of the Federal Reserve, via [FRED](https://fred.stlouisfed.org/series/DEXCHUS) | Public domain (Fed H.10); FRED terms of use ask for attribution | `data/fx/usdcny_fred.csv` |
| SMEs, customers, invoices, costs | Generated by `nanfeng_quant.synthetic` | Synthetic, ours | `data/synthetic/smes.json` |
