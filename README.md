# NanFeng 南风

**The autonomous CFO for SMEs that export to China.**

FinTechathon 2026 · International Track · Topic E: SME Finance Copilot

An agent that acts, not a chatbot that advises: NanFeng sees the cash crunch before it happens, finds the cheapest financing and executes it with the owner's permission — via WhatsApp, voice or web.

> 南风 (nánfēng) means "south wind": that is how Chile reaches China.

| | |
|---|---|
| **Live app** | https://www.nanfengcfo.com |
| **API** | https://api.nanfengcfo.com/docs |
| **Repository** | https://github.com/Lilvecp/nanfeng |
| **Technical documentation** | [docs/technical-documentation.md](docs/technical-documentation.md) |
| **Deployment guide** | [docs/deployment.md](docs/deployment.md) |

All company, customer, invoice, lender and approval data is synthetic; no real money moves (sandbox bank, EVM testnet).

## What it does

A Chilean cherry exporter learns that its largest Chinese importer will pay USD 180,000 45 days late. NanFeng reads the notice, forecasts cash on 10,000 paths (**81% probability of negative cash in 19 days**, on payroll day), compares 9 financing products with an exact optimizer, and proposes a USD pre-export loan that costs **CLP 2.1M instead of CLP 3.8M** for the bank loan (45% cheaper). The owner approves with a one-time code; the sandbox bank executes exactly the planned amount, and the audit log is anchored on a public chain. A fake supplier invoice with a hidden prompt injection, sent the same morning, is blocked before any LLM reads it.

| Topic E asks for | NanFeng |
|---|---|
| Financing-option matching | Chance-constrained MILP over 9 Chilean financing products, compared fairly with the default bank loan (NanFeng-Bench 50/50, 41% cheaper on average) |
| Cash-flow management with alerts | 90-day Monte Carlo forecast; WhatsApp alerts and a daily voice briefing |
| Business financial analysis | Business health screen and WhatsApp report: cash budget by month, where the money goes, customer concentration, DSO, currency exposure, payroll safety and plain findings; Credit Passport (34 E → 67 B); Scenario Lab |

Security is enforced outside the LLM: a policy engine with permission levels L0–L3, the owner's one-time code for anything that creates debt or changes a payee, a hash-chained audit log anchored on Sepolia, and a red team of 43 attacks (4/43 stopped before the controls, 43/43 after; CI fails if one gets through).

## Quick start

Needs Docker and Node 22. From the repository root:

```sh
cp .env.example .env                       # set NANFENG_AGENT_TOKEN (instructions in the file)
docker compose --profile quant up --build  # backend :8000 · agent :8200 · quant engine :8100 · Postgres

cd web && cp .env.example .env.local && npm ci && npm run dev -- -p 3100   # http://localhost:3100
```

The web also runs alone (`cd web && npm ci && npm run dev`): with no backend it plays the Cherry Crisis on an in-browser sandbox. Provider keys are optional; without them the agent uses deterministic stand-ins. Running each service without Docker, and the public deploy (Vercel + Railway), are in [docs/deployment.md](docs/deployment.md).

## Tests

| Suite | Command | Result | CI job |
|---|---|---|---|
| Backend: security, policy, API, owner sign-in, OTP, privacy, registry, anchoring, demo | `cd backend && pip install -e ".[dev]" && pytest -q` | 116 passed | Backend tests |
| Red team regression gate (43 attacks against the API) | `cd backend && python ../andy-villarroel/redteam/run.py --backend . --label local --min-stopped 43` | 43/43 stopped | Backend tests |
| OpenAPI contract is up to date | `cd backend && python -m app.main ../contracts/openapi.json && git diff --exit-code ../contracts/openapi.json` | no drift | Backend tests |
| Agent: pipeline, Cherry Crisis, service, red team through the agent | `cd renato-lenis && pip install -e "../backend[dev]" -e ".[dev]" && pytest -q` | 91 passed | Agent tests |
| Quant engine: Monte Carlo, MILP, Credit Passport, business analysis, API | `cd vicente-rodriguez && pip install -e ".[dev]" && pytest -q` | 36 passed | Quant tests |
| NanFeng-Bench: 50 scenarios with a known answer | `cd vicente-rodriguez && python -m nanfeng_quant bench` (~5 min) | 50/50 ([summary](vicente-rodriguez/results/bench_summary.md)) | — |
| Web: lint and production build | `cd web && npm ci && npm run lint && npm run build` | clean | Web lint and build |
| Secret scanning | gitleaks | no findings | Secret scanning |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every push to `main` and on every pull request.

## Submission package

| # | Deliverable | Where |
|---|---|---|
| 01 | Technical documentation: system architecture, core algorithm, security design | [docs/technical-documentation.md](docs/technical-documentation.md), with the full sections: [core algorithm](vicente-rodriguez/docs/core-algorithm.md) · [agent](renato-lenis/docs/agent.md) · [security design](andy-villarroel/docs/security-design.md) |
| 02 | Presentation deck (≤ 10 min) | Outline: [valentin-castro/deck-v1.md](valentin-castro/deck-v1.md). The slides are made on the final product |
| 03 | Demo video (≤ 5 min) | Script: [valentin-castro/video-script.md](valentin-castro/video-script.md). Recorded on the final product |
| 04 | Source code: README, repository link, deployment instructions, test cases | This README · [docs/deployment.md](docs/deployment.md) · tests in `backend/tests`, `renato-lenis/tests`, `vicente-rodriguez/tests`, `andy-villarroel/redteam` |
| 05 | Security self-assessment: permission tiers, known-risk list | [andy-villarroel/security-self-assessment.md](andy-villarroel/security-self-assessment.md) |
| 06 | Execution evidence: sandbox operation logs (+ on-chain hashes) and demo video | [andy-villarroel/evidence/out-live/](andy-villarroel/evidence/out-live/SUMMARY.md) (live deploy: bank logs, hash chain, Merkle proofs, Sepolia anchor) · video as in 03 |

## Repository structure

```
.
├── README.md                  # This file: overview, quick start, tests, submission map, licenses
├── docs/
│   ├── technical-documentation.md   # Deliverable 01: architecture, algorithms, agent, security
│   └── deployment.md                # Local and public deployment, every variable
├── web/                       # Web cockpit (Next.js): landing + every cockpit screen, live API or in-browser sandbox
├── backend/                   # API gateway (FastAPI): owner sign-in, policy L0–L3, OTP, sandbox bank, audit log,
│                              #   Merkle anchoring, invoice registry, agent SSE, quant proxy
├── contracts/                 # OpenAPI contract (generated from the backend; CI checks it)
├── docker-compose.yml         # One-command stack: Postgres + backend + agent (+ quant profile)
├── .env.example               # Every backend and agent variable, with safe defaults
├── .github/workflows/ci.yml   # Secret scanning, backend, agent, quant, web
├── design/
│   └── private-desk/          # Visual direction: static mockups the web app is built from
├── plan/                      # Planning: battle plan projection, roles, timeline, deliverables checklist
├── valentin-castro/           # R1 · Lead & Product Strategist: scope, business model, deck outline, video script
├── renato-lenis/              # R2 · AI Agent Engineer: the agent service (nanfeng_agent), its docs and tests
├── camilo-bufadel/            # R3 · Full-Stack & Blockchain Developer: task card (code in backend/ and web/)
├── andy-villarroel/           # R4 · Security & Compliance Lead: threat model, red team, self-assessment, evidence
└── vicente-rodriguez/         # R5 · Quant & Data Scientist: quant engine (nanfeng_quant), bench, docs, results
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
| IBM Plex Sans, IBM Plex Sans Condensed | SIL Open Font License 1.1 | Web (woff2 files committed in `web/src/fonts`, served from our own origin) and design mockups |
| JetBrains Mono | SIL Open Font License 1.1 | Web and design mockups |
| `earth-night.jpg`, `earth-topology.png` (three-globe examples, NASA imagery) | Public domain (NASA) | Globe textures |
| NanFeng logo (Sail) and all UI design | Ours | `web/src/components/logo.tsx`, `design/private-desk/` |
| `design/private-desk/vendor/`: React / ReactDOM 18.3.1, globe.gl 2.46.2 (minified, unmodified) | MIT | Static design mockups only, not part of the app |
| `design/private-desk/vendor/dc-runtime.js` (generated runtime) | **To confirm** (Valentín) | Static design mockups only, not part of the app |

### Data

| Dataset | Provider | Terms |
|---|---|---|
| USD/CLP "dólar observado" 2010–2026 | Banco Central de Chile, via the mindicador.cl open API | BCCh terms allow reuse citing the Bank as owner: attribution "Banco Central de Chile" (mindicador.cl has no terms of its own; checked 2026-10-12) |
| USD/CNY (DEXCHUS) 2010–2026 | Board of Governors of the Federal Reserve System, via FRED | Public domain (Fed Board); FRED citation, no implied endorsement (checked 2026-10-12) |
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
| Vercel, Railway | Each host's terms of service | Hosting: the web on Vercel; backend, agent and quant engine on Railway |
