# Privacy and compliance (r4-07 · r4-08 · r4-11)

**Owner:** Andy · **Status:** v1, Oct 10 · Source for the regulatory slide, the compliance section of the technical documentation and the Security Self-Assessment Report.

> Everything in the demo is synthetic data, declared as such. This section describes how NanFeng is built so that the same design holds when real data arrives. It is our reading of the rules, not legal advice; a lawyer reviews it before any pilot with real companies.

## What personal data NanFeng touches

| Data | Example | Where it lives | Reaches an LLM? |
|------|---------|----------------|-----------------|
| Owner's phone | `+56 9 •••• 4127` | Backend config (secret manager) | Never |
| OTP codes | 6 digits | Only `HMAC(approval, amount, code)` in `otp_challenges`; deleted on use | Never |
| Payroll totals | `CLP 238,000,000` | Ledger (aggregate, no per-worker data) | Amounts only |
| Supplier/customer contacts | e-mail, phone, tax id | `payee_profiles`, documents | Masked (`POST /privacy/mask`) |
| Bank accounts | `CL-BANCOSUR-7781203` | `payees`, `payee_accounts` | Masked; alerts show last 4 digits |
| Documents | invoices, statements | Storage by `doc_id` | OCR yes (processor); planner never sees raw text |

## Controls in the code

| Control | Where | Status |
|---------|-------|--------|
| **Minimization**: the planner receives typed fields, never documents | [anti-injection-design.md](anti-injection-design.md) | Designed → Renato |
| **PII masking before any LLM call**: RUT, PRC ID, phones (CL/CN), e-mails, bank accounts, IBAN become `⟦KIND_n⟧`; the mapping never leaves the backend | `backend/app/privacy.py`, `POST /privacy/mask` | Done |
| **No PII in logs we publish**: audit and SSE carry masked phones and last-4 account digits; OTP never logged | `backend/app/otp.py`, `backend/app/bec.py` | Done |
| **Encryption in transit**: HTTPS only (Vercel + backend host) | Deploy | Camilo |
| **Encryption at rest**: managed Postgres (Supabase) encrypts storage; OTPs stored as HMAC, not plaintext | Deploy, `otp.py` | Partly done |
| **Secrets**: `.env` git-ignored, secret scanning in CI, spend limits on every provider | `.gitignore`, `.github/workflows/ci.yml` | Done |
| **Sanctions screening** of every counterparty (payee, factored customer, lender) before money moves; a hit blocks and escalates | `backend/app/sanctions.py` + policy rule `sanctions_hit` | Done (synthetic watchlist) |
| **Human in the loop** for every financing decision (L3 + OTP), with an explanation the owner can read | Policy engine | Done |
| **Right to an explanation / human review** of automated decisions | Every approval stores the policy reason and rules; the owner can reject with a reason | Done |
| **Retention**: documents and conversations deleted after 90 days in production; audit hashes kept (they contain no PII) | Policy, not yet automated | Declared |

## Chile

| Rule | What it asks | How NanFeng answers |
|------|--------------|---------------------|
| **Ley 21.719** (new personal data protection law, amends Ley 19.628; creates the Agencia de Protección de Datos Personales; in force from Dec 2026) | Lawful basis, purpose limitation, proportionality, security, transparency; data-subject rights; safeguards for international transfers; rights regarding automated individual decisions | Masking + minimization; every automated money decision is explainable and reviewable by a human (L3); data processors listed (below); transfers abroad only to providers under contract |
| **Ley 19.628** (current regime until 21.719 takes effect) | Consent / legal basis, data quality, security | Same controls |
| **Ley 21.521 "Ley Fintec"** (CMF; Open Finance System) | Regulated access to bank data and payment initiation | The sandbox bank stands in for the Open Finance APIs; production would connect through a registered provider, never screen-scraping |
| **AML / sanctions** (UAF reporting duties for obliged entities; UN Security Council sanctions) | Screen counterparties, report suspicious operations | Sanctions screening on every counterparty; structuring detection (split payments) in the policy engine |

## China (r4-11)

NanFeng's user is a Chilean SME. Chinese law matters because the counterparties (importers in Shanghai, Guangzhou) are in China and the jury is WeBank.

| Rule | What it asks | How NanFeng answers |
|------|--------------|---------------------|
| **PIPL** (Personal Information Protection Law, 2021) — Art. 3 extraterritorial scope | Applies when processing abroad aims to provide products/services to individuals in China or analyse their behaviour | We process **business contact data** of importers' staff only to collect invoices; we do not profile individuals in China |
| PIPL — sensitive personal information (financial accounts) | Specific purpose, necessity, separate consent, impact assessment (PIPIA) | Bank accounts are masked before any LLM and only used to detect fraud; a PIPIA is part of a pilot checklist |
| PIPL — cross-border transfer (Art. 38–39) and the 2024 CAC provisions on cross-border data flows | Security assessment, standard contract or certification, with exemptions such as transfers necessary to perform a contract with the individual (e.g. cross-border trade) | NanFeng does not export personal data **out of** China: the importer sends its own invoice to the exporter, which is contract performance. No data is stored in mainland China |
| **Interim Measures for Generative AI Services** (CAC, 2023) | Apply to generative AI services offered to the public in mainland China: lawful data, content labelling, security duties | NanFeng is a B2B tool for Chilean companies, not offered to the PRC public. The simulated WeCom channel labels every message as AI-generated anyway |
| **Measures for Labelling AI-Generated Synthetic Content** (CAC, in force Sept 2025) | Explicit labels on AI-generated content shown to users in China | Messages to Chinese importers carry an "AI-generated / 由AI生成" label |
| **Data Security Law** (2021) | Data classification, protection of "important data" | We hold no important data from China; trade documents only |

## Data processors (for the transparency notice)

| Provider | Purpose | Data sent |
|----------|---------|-----------|
| Mistral | OCR of documents, quarantined extraction | Document images (contain business PII) |
| OpenRouter → model providers | Planning, classification | Masked text and typed fields only |
| Zavu | SMS / WhatsApp: OTP, alerts, collections | Owner phone, message text |
| ElevenLabs | Voice briefing | Briefing text (amounts, no personal data) |
| Supabase / Vercel | Database, hosting | All backend data / front only |
| EVM testnet / FISCO BCOS | Audit anchoring | Merkle roots only (hashes, no data) |

## Regulatory slide (deck, r4-08)

**Title:** Built to be trusted with a company's money

| Chile 🇨🇱 | China 🇨🇳 | Everywhere |
|-----------|-----------|------------|
| Ley 21.719 data protection: PII masked before any AI model | PIPL: no profiling of individuals in China; no data exported out of China | OWASP Top 10 for LLM apps: policy engine outside the LLM |
| Ley Fintec: built for Open Finance APIs | Generative AI measures: every message to an importer labelled AI-generated | Every money decision explainable, human-approved with OTP |
| AML: structuring detection + sanctions screening | WeBank-ready: audit anchored on FISCO BCOS-compatible chain | Tamper-evident audit log, 40+ attack red team |

**Speaker line:** "NanFeng never lets the AI touch money or personal data directly. The AI proposes; deterministic rules decide; the owner approves with a one-time code; every step is hashed on-chain."
