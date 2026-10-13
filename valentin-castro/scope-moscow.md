# Frozen scope · MoSCoW (r1-04)

Feature freeze: **Sunday Oct 11, 23:59 (Chile)**. After the freeze nothing new goes in: only fixes, tests, docs, deck, video and rehearsals. Anything below that is not working by the freeze is cut. The lead (Valentín) has the veto on new features.

## The one scenario everyone uses

**Cherry Crisis** · Huerto Austral Export SpA (fictional). Numbers come only from the quant engine (`vicente-rodriguez/results/cherry_crisis_story.json`, seed 7, 10,000 paths). The web copies them with `npm run sync:scenario`; the deck and video quote the table below and nothing else.

| Figure | Value |
|---|---|
| As-of date · opening cash · buffer | 2026-12-11 · CLP 176,000,000 · CLP 25,000,000 |
| Event | Shanghai Hongxin Fresh Fruit Import Co. (fictional) will pay INV-2026-118, USD 180,000, 45 days late (due 2026-12-18) |
| Risk before the notice | 13% probability of negative cash within 90 days |
| Risk after the notice | **81% probability of negative cash in 19 days (2026-12-30)**, the day of the CLP 238M harvest payroll; 1% if Shanghai paid on time |
| Financing need | CLP 55.6M on 2026-12-30 |
| Products checked | 9 (7 eligible) |
| Plan (exact chance-constrained MILP) | **60-day USD pre-export loan (PAE) of USD 142,400** from Banco del Pacífico Sur (fictional) |
| Cost | **CLP 2.1M vs CLP 3.8M** for the default bank loan → **CLP 1.7M saved (45%)** |
| After the plan | Cash above the buffer in 96% of 10,000 scenarios · 2% probability of negative cash |
| Credit Passport | 34 (E) → 67 (B) |
| Benchmark | NanFeng-Bench 50/50 cases · −41% average financing cost vs default loan |
| Red team | 4/43 attacks stopped before → 43/43 after |

Decided on Oct 11: the web, deck and video use the engine's plan (PAE loan). The earlier "partial factoring + CNY forward, CLP 4.1M cheaper" story is retired everywhere.

## Must (without this we do not submit)

| Item | Owner | State on Oct 11 |
|---|---|---|
| Cherry Crisis end to end in the sandbox: notice → forecast → quotes → plan → OTP approval → execution → audit hash | Renato · Camilo · Vicente · Andy | Pieces exist on branches; the agent pipeline (Renato) is the missing link |
| Monte Carlo forecast + MILP plan + explanations | Vicente | Done (merged in main) |
| Policy engine L0–L3, OTP for L3, BEC block, red team with metrics | Andy | Done on branch `andy` |
| Backend + sandbox bank + audit log + SSE | Camilo | Done on branch `camilo-backend` (inside `andy`) |
| Web cockpit: Cockpit, Approvals, Financing, Mission Control, Demo Mode | Valentín · Camilo | Done; numbers aligned on branch `valentin-castro` |
| Demo Mode that runs offline with a fixed seed | Valentín · Camilo | UI done; API replay pending (Camilo) |
| Deployed URL on our own domain (not *.vercel.app) | Camilo | Done: https://www.nanfengcfo.com |
| Deliverables 01–06 and the UDD email | Everyone → Valentín | In production week |

## Should (this makes us win)

- Scenario Lab with real engine runs (done) · Security Console with hash verification (done on branch) · EN / ES / 中文 (shell, landing and business screens done) · voice briefing with ElevenLabs (Renato) · WhatsApp approvals through Zavu (Renato + Andy) · on-chain anchoring (Sepolia done; FISCO BCOS pending) · "One agent, every market's channel" slide · Chinese subtitles in the video.

## Could (only if time is left)

- On-chain invoice registry against double financing (blocked in the database already) · simulated WeCom adapter · real Zavu conversation mirrored in Channels · free-form what-if questions answered by the planner.

## Won't (this round)

- Real bank integrations or real money · WeChat/WeCom production channel (roadmap slide only) · new screens · new financial products in the catalog · mobile app.

## Team rules (unchanged)

Daily 15-minute standup · `main` always works, pull requests with one review · contracts before code · everything in English in the repo · one source of truth for numbers (the engine's story JSON) · whoever builds a module writes its section of the technical documentation.
