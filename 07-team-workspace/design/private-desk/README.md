# Private desk — design direction

Direction 4 of the NanFeng design exploration, and the one we build the web cockpit from. A private bank's treasury desk: porcelain and ink navy, terminal density, monospaced figures, brass for fine lines and cherry red only for cash at risk.

These are static, high-fidelity mockups (fe-01). The working app built from them lives in [`web/`](../../web); this folder stays as the visual reference.

## How to view

The pages load fonts, React and the globe component from sibling folders, so serve the folder instead of opening the files directly:

```sh
cd design/private-desk
python3 -m http.server 8000
# open http://localhost:8000
```

`index.html` shows every screen on one board; each screen also opens on its own from `pages/`, and the sidebar links navigate between screens.

## Screens

| File | Screen | Frame |
|------|--------|-------|
| `pages/00-design-system.html` | Design system: color tokens (light + dark), type, buttons, inputs, permission tiers, KPI cells, badges, blotter table, alerts | 1440 |
| `pages/01-landing-1440.html` | Landing, desktop | 1440 |
| `pages/01-landing-390.html` | Landing, mobile | 390 |
| `pages/02-cash-cockpit.html` | Cash Cockpit (fe-03) | 1440 |
| `pages/03-agent-mission-control.html` | Agent Mission Control (fe-04) | 1440 |
| `pages/04-approval-center.html` | Approval Center (fe-05) | 1440 |
| `pages/04-approval-390.html` | Approval, mobile | 390 |
| `pages/05-financing-arena.html` | Financing Arena (fe-06) | 1440 |
| `pages/06-scenario-lab.html` | Scenario Lab (fe-07) | 1440 |
| `pages/07-security-console.html` | Security Console (fe-08) | 1440 |
| `pages/08-channels-and-conversations.html` | Channels & Conversations (fe-09) | 1440 |
| `pages/09-documents-inbox.html` | Documents Inbox | 1440 |
| `pages/10-settings.html` | Settings | 1440 |
| `pages/11-demo-mode.html` | Demo Mode (fe-10) | 1440 |
| `pages/nanfeng-globe-hero-visual.html` | 南风 globe, Santiago → Shanghai hero visual (standalone copy of the component) | 720 |
| `pages/nv-globe.dc.html` | Globe component embedded by the landing pages | — |

Every screen except the globe has a `theme` prop (`light` default, `dark`); the dark tokens are in the design system page.

## Folder layout

```
private-desk/
├── index.html   # board with all screens
├── pages/       # one HTML file per screen
├── fonts/       # self-hosted woff2 subsets (no Google Fonts at runtime)
├── textures/    # NASA Earth textures for the globe
└── vendor/      # React 18.3.1 UMD, globe.gl 2.46.2 (bundles three.js) and the mockup runtime (dc-runtime.js)
```

## The 南风 globe

`pages/nv-globe.dc.html` is a real 3D globe built with [globe.gl](https://github.com/vasturiano/globe.gl) (three.js underneath; in Next.js use `react-globe.gl` loaded with `dynamic(..., { ssr: false })`).

- **Texture:** NASA Black Marble (`earth-night.jpg`): the continents are drawn by city lights. `earth-topology.png` adds relief. No political borders.
- **Atmosphere:** a soft blue halo (`#5fa8d3`, altitude 0.18).
- **Route:** real coordinates, Santiago (−33.45, −70.67) → Shanghai (31.23, 121.47). The cities are ~170° apart, so a standard arc would cut through the planet. Instead the route samples the great circle and lifts it slightly off the surface like a flight path; it hides when it goes behind the globe.
- **One accent:** cherry, only on the route. Small labels, no other decoration.
- **Story loop (~19 s):** the camera starts over Santiago, follows the route over the mid-Pacific and lands on Shanghai. The payment delay flickers the route intense red for 2 s, it returns to soft cherry while NanFeng negotiates, then the globe rotates slowly once the plan is approved and flies back to Santiago. The chip under the globe follows the same phases.
- **Reduced motion** (`prefers-reduced-motion` or `motion={false}`): one still frame with both cities in view. In the real app, show a short pre-recorded clip of the loop here and on phones; the same clip works for the demo video.
- **Self-hosted:** library and textures load from our own origin, so it works from mainland China. In Next.js, put the textures in `/public/textures`.

## Licenses

| Asset | License |
|-------|---------|
| IBM Plex Sans, IBM Plex Sans Condensed | SIL Open Font License 1.1 |
| JetBrains Mono | SIL Open Font License 1.1 |
| React, ReactDOM 18.3.1 | MIT |
| globe.gl 2.46.2 (bundles three.js and three-globe) | MIT |
| `earth-night.jpg`, `earth-topology.png` (from the three-globe examples, NASA imagery) | Public domain (NASA) |
