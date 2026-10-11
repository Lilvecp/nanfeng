# Status · Valentín (R1 + shared frontend) · Oct 11, freeze day

The web below is on `main`; the R1 documents are on branch **`valentin-castro`**.

## Done

| Task | What | Where |
|---|---|---|
| r1-01, r1-02 | UDD confirmation + certificates request; email to the organization | Sent (outside the repo) |
| r1-03 | Cherry Crisis numbers fixed: the engine's run is the single source; web, deck and video aligned | [scope-moscow.md](scope-moscow.md), `web/src/data/cherry-crisis.json`, `web/src/lib/scenario.ts` |
| r1-04 | Frozen MoSCoW scope and team rules | [scope-moscow.md](scope-moscow.md) |
| r1-05 | B2B2B business model | [business-model.md](business-model.md) |
| r1-06, r1-10 | Deck v1 outline, incl. "One agent, every market's channel" | [deck-v1.md](deck-v1.md) |
| r1-07, r1-11 | Video script with EN narration and 中文 subtitles | [video-script.md](video-script.md) |
| fe-03 | Cash Cockpit on the engine's real P10/P50/P90 paths (before and after the plan), receivables from the scenario, Credit Passport | `web/src/app/(desk)/cockpit` |
| fe-05 | Approval Center for the PAE loan (USD 142,400, CLP 2.1M, 96% coverage) | `web/src/app/(desk)/approvals` |
| fe-06 | Financing Arena: 9 products, real quotes, plan cost alone, the optimizer's reason for each | `web/src/app/(desk)/financing` |
| fe-07 | Scenario Lab on the 9 precomputed engine runs (no more in-browser guesswork) | `web/src/app/(desk)/scenario` |
| fe-10 (UI) | Demo Mode captions and labels with the real numbers, EN / ES / 中文 | `web/src/app/(desk)/demo` |
| — | **Simple view for the owner** (default on Home): plain-language status, what happened, a cash chart with the payroll day, one recommendation with cost vs bank loan and an approve button, what NanFeng did today, a 3-step welcome on first visit; switch to the Detailed view keeps the full desk. Sidebar grouped into “Your business” and “Under the hood”. Approvals opens with a plain summary. EN / ES / 中文 | `web/src/components/owner-view.tsx`, `web/src/styles/owner.css` |
| — | **Navigation and layout cleanup**: 5 sections (Home, Approvals, Financing, Messages, Security) with related screens as tabs inside them, Settings at the bottom of the sidebar, one-row top bar, company card in the sidebar; checked on desktop, laptop and 390 px phones (no page overflows), light and dark. Security shows the real red team (41/43) | `web/src/lib/sections.ts`, `web/src/components/sidebar.tsx`, `web/src/components/topbar.tsx` |
| — | Landing: globe story, final CTA and benchmark (50/50 · −41% · 41/43) with real figures | `web/src/app/page.tsx`, `web/src/components/` |

`npm run lint` and `npm run build` pass. Checked in the browser: Cockpit, Financing, Scenario Lab, Approvals (EN and 中文).

## Still mine

- [ ] fe-11: Settings and the technical screens (Protection, Agent activity) are still English-only; toasts (`desk-state` notify) too. Messages (Conversations, Documents) is done: the owner's WhatsApp follows the view language, the importer's WeCom stays in Chinese.
- [ ] fe-12 (with Camilo): loading/error states and an accessibility pass.
- [ ] r1-08 final English edit (Oct 16) · r1-12 China access test (Oct 16) · fe-13 record the video (Oct 15) · r1-09 send the UDD email (Oct 18).
- [ ] Deck slides themselves (outline is ready; due Oct 14).

## Missing from others (blocks or affects my part)

| Who | What is missing | Why it matters to me |
|---|---|---|
| **Camilo** | Deploy backend + front on our own domain (r3-07, r3-10) | The video and the jury URL need it |
| **Camilo** | fe-10 replay against the API (`POST /bank/reset`), fe-14 CNY amounts in the 中文 view, fe-09 real Zavu conversation | Demo Mode and China-ready front |
| **Camilo** | FISCO BCOS anchoring (today: Sepolia) | Deck slide 7 says "on-chain"; say "FISCO BCOS" only if it lands |
| **Renato** | No branch on GitHub yet: ingestion → quarantined LLM → planner → tools, Zavu WhatsApp/OTP, ElevenLabs briefing, agent tests, agent section of doc 01 | The "end to end" Must and 40% of the grade; video scenes 3 and 7 show his flow |
| **Andy** | Run the evidence package (06) against the deploy; update the self-assessment (05) after the freeze; confirm slide 8 wording | Deliverables 05 and 06 |
| **Vicente** | Confirm the 63% late-payment figure in the Bolsa de Productos ranking; verify reference rates in the catalog; calibrate Credit Passport weights | Slides 2, 6 and 10 quote them |
| **Everyone** | Regular student certificates in English | Needed for the Oct 18 email |

## Merging this branch

Done on Oct 11: Camilo merged `camilo-backend` (API, sandbox bank, Sepolia anchoring, live Approvals, Mission Control and Security) into `main` on top of this branch's web, keeping the Simple view, the five sections and the one-row top bar; the top bar now also shows the API / SANDBOX badge. `main` was merged back here, so `web/` is the same on both.

If Vicente re-runs the engine, refresh the web with `cd web && npm run sync:scenario`.
