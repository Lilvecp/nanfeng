# NanFeng 南风

**The autonomous CFO for SMEs that export to China.**

FinTechathon 2026 · International Track · Topic E: SME Finance Copilot

An agent that acts, not a chatbot that advises: NanFeng sees the cash crunch before it happens, finds the cheapest financing and executes it with the owner's permission — via WhatsApp, voice or web.

> 南风 (nánfēng) means "south wind": that is how Chile reaches China.

## Repository structure

```
.
├── web/                       # Web cockpit (Next.js): landing + all cockpit screens, runs on Cherry Crisis mocks
├── backend/                   # API gateway (FastAPI): sandbox bank, approvals + OTP, audit log, agent SSE, quant proxy
├── contracts/                 # OpenAPI contracts (generated)
├── docker-compose.yml         # One-command stack: Postgres + backend (+ quant profile)
├── design/
│   └── private-desk/          # Chosen visual direction: static mockups the web app is built from
├── plan/                      # Main planning: projection of the battle plan
│   ├── README.md              # Index + key dates
│   ├── overview.md            # The bet, demo script, scoring, differentiators
│   ├── stack.md               # Tools + architecture diagram
│   ├── roles.md               # Who does what (summary)
│   ├── frontend-shared.md     # Shared frontend card (Valentín + Camilo)
│   ├── timeline.md            # Sprints and gates
│   ├── deliverables.md        # Competition package + UDD/admin checklist
│   ├── risks.md               # Risks and mitigations
│   └── team-rules.md          # How we work
├── valentin-castro/           # R1 · Lead & Product Strategist (+ shared frontend)
├── renato-lenis/              # R2 · AI Agent Engineer
├── camilo-bufadel/            # R3 · Full-Stack & Blockchain Developer (+ shared frontend)
├── andy-villarroel/           # R4 · Security & Compliance Lead
└── vicente-rodriguez/         # R5 · Quant & Data Scientist
```

## Team

| Role | Member | Title |
|------|--------|-------|
| R1 | Valentín Castro | Lead & Product Strategist |
| R1+R3 | Valentín Castro + Camilo Bufadel | Frontend & Experience (shared) |
| R2 | Renato Lenis | AI Agent Engineer |
| R3 | Camilo Bufadel | Full-Stack & Blockchain Developer |
| R4 | Andy Villarroel | Security & Compliance Lead |
| R5 | Vicente Rodríguez | Quant & Data Scientist |

## Key dates

| Milestone | When |
|-----------|------|
| Feature freeze | Sun Oct 11 · 23:59 |
| Internal UDD submission | Sun Oct 18 · nbarra@udd.cl |
| Official close | Tue Oct 20 · 12:59 Chile (23:59 Beijing) |
| Finalists announced | Oct 31 |
| Grand final | Nov 21–23 · Shenzhen |

## Licenses

Every library, model and dataset used is listed here with its license (IP rule of the competition). Versions are the ones installed when this list was made (Oct 2026). **All company, customer, invoice, lender and approval data is synthetic** and every company and lender is fictional. No model weights are shipped and no third-party source code is copied into the repo; the only vendored files are minified, unmodified libraries in the design mockups.

### Web cockpit (`web/`)

| Package | Version | License | Used for |
|---|---|---|---|
| Next.js | 16.4.0 | MIT | App framework |
| React, React DOM | 19.3.0 | MIT | UI |
| react-globe.gl (globe.gl, three-globe) | 2.38.0 | MIT | 3D globe on the landing |
| three.js | 0.186.1 | MIT | WebGL rendering for the globe |
| Tailwind CSS, @tailwindcss/turbopack | 4.3.3 | MIT | Styles |
| TypeScript | 5.9.3 | Apache-2.0 | Type checking |
| ESLint, eslint-config-next | 9.39.5 / 16.4.0 | MIT | Lint |
| openapi-typescript | 7.4.4 | MIT | API types generated from `contracts/openapi.json` |
| @types/node, @types/react, @types/react-dom, @types/three | various | MIT | Type definitions |

### Backend (`backend/`)

| Package | Version | License | Used for |
|---|---|---|---|
| FastAPI | 0.143.0 | MIT | API gateway |
| Starlette | 1.7.0 | BSD-3-Clause | (FastAPI dependency) |
| Pydantic, pydantic-settings | 2.14.0 / 2.15.0 | MIT | Request models, configuration |
| Uvicorn | 0.54.0 | BSD-3-Clause | ASGI server |
| SQLAlchemy | 2.1.4 | MIT | Database access |
| psycopg (binary) | 3.3.6 | LGPL-3.0-only | Postgres driver, used unmodified as a library |
| httpx | 0.28.1 | BSD-3-Clause | Quant engine proxy, Zavu SMS calls |
| web3.py, eth-account | 8.0.0 / 0.14.0 | MIT | Anchoring Merkle roots on the Sepolia testnet |
| pytest | 9.1.1 | MIT | Tests |
| eth-tester, py-evm | 0.14.0b1 / 0.12.1b1 | MIT | In-memory EVM for the anchoring tests |

The security modules (policy engine, OTP, document guard, BEC checks, PII masking, sanctions screening, red team in `andy-villarroel/`) are our own code on top of the packages above.

### Agent (`renato-lenis/`)

| Package | Version | License | Used for |
|---|---|---|---|
| httpx | 0.28.1 | BSD-3-Clause | Backend, OpenRouter, Mistral OCR, Zavu and ElevenLabs calls |
| Pydantic | 2.14.1 | MIT | Quarantined extraction schema, tool arguments |
| FastAPI, Uvicorn | 0.143.0 / 0.54.0 | MIT / BSD-3-Clause | Agent service (webhook, uploads, "ask it why") |
| pypdf | 6.20.0 | BSD-3-Clause | PDF text layer for the hidden-text check |
| pytest | 9.1.1 | MIT | Tests |

The orchestrator, planners, quarantined extraction, model router, channel layer, templates and the PDF writer are our own code. No model weights are shipped: models run at OpenRouter and Mistral under their terms (see Infrastructure below).

### Quant engine (`vicente-rodriguez/`, details in its `LICENSES.md`)

| Package | Version | License | Used for |
|---|---|---|---|
| NumPy | 2.x | BSD-3-Clause | Monte Carlo, arrays |
| SciPy | 1.x | BSD-3-Clause | Distributions in the backtest (CRPS) |
| pandas | 3.x | BSD-3-Clause | FX history |
| Google OR-Tools | 9.15 | Apache-2.0 | MILP modeling; bundles the **CBC** (EPL-2.0) and **SCIP** (Apache-2.0) solvers |
| FastAPI, Uvicorn, httpx, pytest | see above | MIT / BSD-3-Clause | Quant HTTP API and tests |

### Fonts and images

| Asset | License | Where |
|---|---|---|
| IBM Plex Sans, IBM Plex Sans Condensed | SIL Open Font License 1.1 | Web (via `next/font`, served from our own origin) and design mockups |
| JetBrains Mono | SIL Open Font License 1.1 | Web and design mockups |
| `earth-night.jpg`, `earth-topology.png` (three-globe examples, NASA imagery) | Public domain (NASA) | Globe textures |
| NanFeng logo (Sail) and all UI design | Ours | `web/src/components/logo.tsx`, `design/private-desk/` |
| `design/private-desk/vendor/`: React / ReactDOM 18.3.1, globe.gl 2.46.2 (minified, unmodified) | MIT | Static design mockups only, not part of the app |
| `design/private-desk/vendor/dc-runtime.js` (generated runtime) | **To confirm** (Valentín) | Static design mockups only, not part of the app |

### Data

| Dataset | Provider | Terms |
|---|---|---|
| USD/CLP "dólar observado" 2010–2026 | Banco Central de Chile, via the mindicador.cl open API | Public statistics; attribution "Banco Central de Chile" |
| USD/CNY (DEXCHUS) 2010–2026 | Board of Governors of the Federal Reserve System, via FRED | Public domain; FRED asks for attribution |
| Interest-rate references | CMF certificate 09/2026, BCCh, SII | Official publications |
| Companies, customers, invoices, costs, lenders, approvals (Cherry Crisis, NanFeng-Bench) | Generated by `nanfeng_quant.synthetic` or written by hand | **Synthetic**, ours |

### Infrastructure and external services (not redistributed)

| Item | License / terms | Used for |
|---|---|---|
| `postgres:16-alpine`, `python:3.12-slim` Docker images | PostgreSQL License, PSF License (plus Debian/Alpine packages) | `docker compose` stack |
| GitHub Actions: checkout, setup-python, setup-node | MIT | CI |
| gitleaks / gitleaks-action | MIT; the action is free for personal-account repositories | Secret scanning in CI |
| Ethereum Sepolia testnet, public RPC (publicnode.com) | Public test network; free public endpoint | Audit anchors (test ETH only, no real value) |
| Zavu, OpenRouter, Mistral, ElevenLabs | Each provider's terms of service; keys live only in `.env` / the host's secret manager | Messaging and OTP, LLM routing, OCR, voice |
