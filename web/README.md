# NanFeng web cockpit

The web app the jury sees: landing page plus the full cockpit, built on the **Private desk** design direction (`design/private-desk`). Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 (theme + utilities only).

Two modes, picked automatically (badge in the top bar):

- **API LIVE**: with `NEXT_PUBLIC_API_URL` set (see `.env.example`) and the backend up, Approvals (OTP, reject, history), Mission Control (kill switch, live SSE event stream) and Security (audit chain, verify, anchors) use the real API in `../backend`.
- **SANDBOX**: no URL or the backend is down, so every screen runs on the Cherry Crisis mocks in the browser. Demo Mode never depends on the network.

The typed client lives in `src/lib/api.ts`; types are generated from `../contracts/openapi.json` with `npm run api:types`.

## Run it

```sh
cd web
npm install
npm run dev -- -p 3100   # any free port; open http://localhost:3100
# live mode: run the backend (see ../backend/README.md), then
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev -- -p 3100
```

Production build: `npm run build && npm start`.

## Routes

| Route | Screen | What works today |
|-------|--------|------------------|
| `/` | Landing | 3D globe (Santiago → Shanghai, crisis loop), language and theme switch, links into the cockpit and the demo |
| `/cockpit` | Cash Cockpit (fe-03) | Ask NanFeng with sandbox answers, 90-day fan chart, KPIs and blotter that update after approval |
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

The shell (sidebar, topbar), landing, cockpit, approvals, channels transcript and demo captions switch between EN / ES / 中文. The other screens are still English only; strings live in `src/lib/i18n.ts`.

## Next steps

- Replace the mocks in `src/lib/desk-state.tsx` with the API client and the SSE stream (fe-02, fe-04).
- Real OTP from Zavu instead of the sandbox code.
- Record a short clip of the globe loop for phones and reduced motion.

## Licenses

| Package | License |
|---------|---------|
| Next.js, React, React DOM | MIT |
| Tailwind CSS | MIT |
| react-globe.gl, globe.gl, three-globe, three.js | MIT |
| IBM Plex Sans, IBM Plex Sans Condensed, JetBrains Mono | SIL Open Font License 1.1 |
| `earth-night.jpg`, `earth-topology.png` (from the three-globe examples, NASA imagery) | Public domain (NASA) |
