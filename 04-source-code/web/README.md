# NanFeng web cockpit

Live at **https://www.nanfengcfo.com** (Vercel, region `hkg1`; deployment in [deployment.md](../deployment.md)).

The web app the jury sees: landing page plus the full cockpit, built on the **Private desk** design direction (`07-team-workspace/design/private-desk`). Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 (theme + utilities only).

Two modes, picked automatically (badge in the top bar):

- **API LIVE**: with `NEXT_PUBLIC_API_URL` set (see `.env.example`) and the backend up, Approvals (OTP, reject, history), Mission Control (kill switch, live SSE event stream) and Security (audit chain, verify, anchors) use the real API in `../backend`.
- **Agent**: with `NEXT_PUBLIC_AGENT_URL` also set and the agent service up (`../agent`), Home gets an "Ask NanFeng" card (questions to the agent, and "Send a document": a PDF, photo or text the agent reads, forecasts on and turns into a plan or blocks), and the detailed view's ask box asks the agent. What-ifs still come from the quant engine's runs; the sandbox answers are the fallback when the agent is unreachable. The agent checks the same owner session as the backend.
- **SANDBOX**: no URL or the backend is down, so every screen runs on the Cherry Crisis mocks in the browser. Demo Mode never depends on the network.

The typed client lives in `src/lib/api.ts`; types are generated from `../contracts/openapi.json` with `npm run api:types`.

## Run it

```sh
cd 04-source-code/web
npm install
npm run dev -- -p 3100   # any free port; open http://localhost:3100
# live mode: run the backend (see ../backend/README.md), then
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- -p 3100
# with the agent too (see ../agent/README.md)
NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_AGENT_URL=http://localhost:8200 npm run dev -- -p 3100
```

Production build: `npm run build && npm start`.

## Routes

| Route | Screen | What works today |
|-------|--------|------------------|
| `/` | Landing | 3D globe (Santiago → Shanghai, crisis loop), language and theme switch, links into the cockpit and the demo |
| `/cockpit` | Home: owner's simple view and the detailed Cash Cockpit (fe-03) | Ask NanFeng (the live agent when `NEXT_PUBLIC_AGENT_URL` is set, sandbox answers otherwise), send a document to the agent, 90-day fan chart, KPIs and blotter that update after approval |
| `/health` | Business health | The quant engine's business analysis: findings, cash budget by month, where the money goes, customers, receivables aging, currency exposure, payroll safety; "Send to my WhatsApp" when the agent is connected |
| `/mission` | Agent Mission Control (fe-04) | Execution trace, pause, kill switch with confirm, "Ask why" chat |
| `/approvals` | Approval Center (fe-05) | 6-digit OTP (sandbox code `482913`, paste works), wrong-code attempts, reject with required reason, history filters |
| `/financing` | Financing Arena (fe-06) | Option book and scatter are selectable, verdict per option, send the recommended plan to approval |
| `/scenario` | Scenario Lab (fe-07) | Sliders for delay, CNY, cherry price and hires recompute the forecast instantly |
| `/security` | Security Console (fe-08) | Blocked attack detail, mark reviewed, verify audit chain, anchors update after execution |
| `/channels` | Channels (fe-09) | WhatsApp and WeCom mirrors, voice-briefing transcript player in ES / EN / 中文 |
| `/documents` | Documents Inbox | Filters, per-document extraction, upload (stays in the browser), keep blocked / report sender |
| `/settings` | Settings | Limit editing with validation, live `policy.diff`, save with OTP, allowlist removal |
| `/demo` | Demo Mode (fe-10) | Six-step Cherry Crisis replay: play/pause, next, reset, click a step, keyboard (space, ← →) |
| `/design-system` | Design system reference | Tokens and components |

State is shared across screens: approving in `/approvals` closes the gap in the cockpit, removes the badge in the sidebar, completes the trace in Agent activity and adds anchors in Security. Sandbox decisions (and wrong-code attempts) last for the browser tab's session, so a reload keeps them; **Reset sandbox** in Settings or Demo Mode starts over, and **Send a new code** on Approvals gives three fresh attempts.

## How it is organised

```
src/
├── app/
│   ├── layout.tsx          # fonts, theme boot script, shared desk state
│   ├── globals.css         # Tailwind layers + responsive rules + app-only styles
│   ├── page.tsx            # landing
│   ├── design-system/
│   └── (desk)/             # every cockpit screen; layout.tsx adds the sidebar
├── components/             # sidebar, topbar (language + theme), forecast chart, hero globe
├── lib/
│   ├── desk-state.tsx      # Cherry Crisis sandbox state (approval, plan, history, toasts)
│   ├── i18n.ts             # EN / ES / 中文 strings
│   ├── prefs.ts            # language + theme, persisted in localStorage
│   └── prefs-boot.ts       # inline script that applies the theme before first paint
└── styles/private-desk.css # the design system, ported verbatim from the mockups
public/textures/            # NASA Black Marble + topology for the globe
```

## China-ready

- Fonts (IBM Plex Sans, IBM Plex Sans Condensed, JetBrains Mono) are committed as woff2 files in `src/fonts` (Fontsource 5.3.0, latin + latin-ext) and declared in `src/styles/fonts.css`. Neither the build nor the browser calls Google Fonts, so `npm run build` works offline and from mainland China.
- The globe library and its textures are bundled; no CDN at runtime.
- No analytics, no reCAPTCHA.

## Languages

Every screen switches between EN / ES / 中文 (fe-11); key amounts are also shown in yuan in the 中文 view. Shared strings live in `src/lib/i18n.ts`, screen copy next to each screen.

## Next steps

- Loading and error states and an accessibility pass (fe-12).
- Record a short clip of the globe loop for phones and reduced motion.

## Licenses

| Package | License |
|---------|---------|
| Next.js, React, React DOM | MIT |
| Tailwind CSS | MIT |
| react-globe.gl, globe.gl, three-globe, three.js | MIT |
| IBM Plex Sans, IBM Plex Sans Condensed, JetBrains Mono | SIL Open Font License 1.1 |
| `earth-night.jpg`, `earth-topology.png` (from the three-globe examples, NASA imagery) | Public domain (NASA) |
