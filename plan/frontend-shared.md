# R1+R3 · Frontend & Experience (shared)

**Members:** Valentín Castro + Camilo Bufadel

**Mission:** Valentín and Camilo split the cockpit the jury sees: Valentín takes design and business screens, Camilo the technical base, real time and security views. Each task says who leads it.

**Owns:** Full web cockpit · Demo Mode · i18n EN / ES / 中文 · Demo video (captures) · Front ↔ API integration

**Deliverables:** 03 · 02 (captures)

**Tools:** Next.js · Tailwind · shadcn/ui · Recharts / visx · Vercel

## Tasks

| ID | Due | Priority | Lead | Task |
|----|-----|----------|------|------|
| fe-01 | Oct 8 | Must | Valentín | **Design system and wireframes** of the screens. |
| fe-02 | Oct 8 | Must | Camilo | **Project base** Next.js on Vercel, typed API client and hooks for the SSE stream. |
| fe-03 | Oct 9 | Must | Valentín | **Cash Cockpit**: 90-day P10/P50/P90 fan chart, days until the crunch and probability of negative cash. |
| fe-04 | Oct 9 | Must | Camilo | **Agent Mission Control**: live timeline (SSE) of each agent step with tool, L0–L3 level, model used and cost. |
| fe-05 | Oct 10 | Must | Valentín | **Approval Center**: pending actions with amount, risk and explanation; approve or reject with OTP. |
| fe-06 | Oct 10 | Must | Valentín | **Financing Arena**: comparison of options with effective annual cost, term, requirements and why one was chosen. |
| fe-08 | Oct 10 | Should | Camilo | **Security Console**: blocked attacks, audit log with hash verification and links to the on-chain explorer. |
| fe-07 | Oct 11 | Should | Valentín | **Scenario Lab**: sliders for customer delay, CNY ±%, cherry price and hires that recompute the forecast. |
| fe-09 | Oct 11 | Could | Camilo | **WhatsApp mirror**: phone mockup showing the real Zavu conversation next to the cockpit. |
| fe-10 | Oct 11 | Must | Both | **Demo Mode**: "Run Cherry Crisis" button that replays the scenario with a fixed seed, without depending on the network. Camilo does the replay, Valentín the UI. |
| fe-11 | Oct 11 | Should | Valentín | **Languages** EN and 中文 on the key screens. |
| fe-14 | Oct 11 | Must | Camilo | **China-ready front**: self-hosted fonts (next/font), no Google Analytics, reCAPTCHA or Google CDNs; amounts in CNY/RMB and Chinese date format in the 中文 view. |
| fe-12 | Oct 13 | Must | Both | **Polish**: loading and error states, responsive, dark mode, accessibility. |
| fe-13 | Oct 15 | Must | Valentín | **Record the demo video** (max. 5 min) and take captures for the deck and documentation. |
