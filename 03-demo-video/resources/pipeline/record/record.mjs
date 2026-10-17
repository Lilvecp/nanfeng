// Records the demo in one take on the live site (www.nanfengcfo.com): the sandbox is reset once,
// then every scene runs in order in the same browser, so the clock, the audit log, the event stream
// and the on-chain anchor all belong to the same session. Usage:
//   node record/record.mjs              the full take → public/rec/sNN.mp4 + sNN.json (zoom boxes)
//   node record/record.mjs s13 s14      only these scenes, no reset (scenes that change nothing)
//   node record/record.mjs --dry s05    no video: screenshots at each zoom, to check the script
//   node record/record.mjs --pitch      the take of the pitch cut (pitch.mjs): see PITCH below
// Scenes s03 (document upload), s08 (approval) and s10 (its anchor) change the live sandbox: they
// only make sense in the full take.
import { chromium } from "playwright";
import fs from "node:fs";
import { VIEWPORT, DSF } from "../scenes.mjs";
import { buildTimeline } from "../plan.mjs";
import { Recorder, CURSOR_INIT, CHROME_ARGS } from "./recorder.mjs";

const LIVE = "https://www.nanfengcfo.com";
const API = "https://api.nanfengcfo.com";
const OTP = "482913";                // the sandbox code (the live build runs NANFENG_OTP_MODE=sandbox)
const PASSWORD = "huerto-demo-2026"; // the public demo password (GET /auth/config)
const NOTICE = new URL("../assets/hongxin-payment-notice.pdf", import.meta.url).pathname;

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const PITCH = args.includes("--pitch");
const only = args.filter((a) => /^[sp]\d\d$/.test(a));
const fullTake = only.length === 0 && !dry;
// the pitch take keeps its own clips: the full cut (scenes.mjs) still plays the full take
const OUT = new URL(PITCH ? "../public/rec/pitch/" : "../public/rec/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const tl = buildTimeline();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the pitch take (--pitch) ----
// Only what the pitch cut shows, in its order, on the scenario's clock: the importer's letter goes
// to the agent at 10:12 and the owner approves at 10:15, as the deck and Home's day list tell it.
// The browser's time zone is one where it is 10:12 at the upload; the scene clock holds (nothing is
// recorded) until then, and again before the approval if the take runs ahead. Encoding waits until
// the end. Three scenes exist only here: p02 Demo Mode before the notice, p04 Business health, p06
// the owner's WhatsApp thread. Lines: [start, end] on the scene clock, as pitch.mjs places them.
const PITCH_ORDER = ["p02", "s03", "s04", "p04", "s05", "p06", "s07", "s08", "s09", "s10", "s11", "s12"];
const PITCH_SCENES = {
  p02: { title: "Demo Mode · before the notice", duration: 18, lines: [[1.0, 8.7], [9.2, 16.3]] },
  p04: { title: "Business health", duration: 14, lines: [[1.0, 3.8], [4.3, 12.4]] },
  p06: { title: "Messages · the owner's WhatsApp", duration: 8, lines: [[1.0, 4.6]] },
};
const PITCH_DURATION = { s03: 20, s04: 15, s07: 14.5 }; // the cut ends these scenes early: so does the take

/** The next moment, at least `leadS` seconds away, when it is 10:12 in some time zone, and that zone. */
function nextTenTwelve(leadS) {
  const zones = [...Array.from({ length: 27 }, (_, i) => i - 12).map((h) => (h === 0 ? "Etc/GMT" : `Etc/GMT${h > 0 ? "-" : "+"}${Math.abs(h)}`)),
    "Asia/Kolkata", "Asia/Kathmandu", "Asia/Yangon", "Asia/Tehran", "Australia/Darwin", "Australia/Eucla", "Pacific/Marquesas"];
  const fmt = zones.map((z) => [z, new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })]);
  const t0 = Math.ceil((Date.now() + leadS * 1000) / 60000) * 60000;
  for (let t = t0; t < t0 + 2 * 3600e3; t += 60000) for (const [zone, f] of fmt) if (f.format(t) === "10:12") return { at: t, zone };
  throw new Error("no time zone at 10:12 in the next two hours");
}
const CLOCK = PITCH && !dry ? (() => {
  const { at, zone } = nextTenTwelve(Number(process.env.PITCH_LEAD_S || 150));
  return { zone, upload: at + 2000, approve: at + 182000 };
})() : null;

/** Pitch take: hold the scene clock (nothing is recorded, the screen does not change) until `when`. */
async function holdUntil(r, when, what) {
  const wait = when - Date.now();
  if (wait <= 0) { console.warn(`  ${what}: ${(-wait / 1000).toFixed(1)} s late`); return; }
  console.log(`  ${what}: holding ${(wait / 1000).toFixed(1)} s`);
  await r.pause();
  await sleep(wait);
  await r.resume();
}

// ---- helpers on the desk ----
// Sidebar entries by position: their href is the section's last tab and their label follows the language.
const NAV = { home: 0, health: 1, approvals: 2, agent: 3, financing: 4, messages: 5, security: 6 };
const sidebar = (r, key) => r.page.locator("aside.side a:has(.ico)").nth(NAV[key]);
const tab = (r, href) => r.page.locator(`.ptabs a[href="${href}"]`).first();
const text = (r, t, exact = false) => r.page.getByText(t, { exact }).filter({ visible: true }).first();
const button = (r, name) => r.page.getByRole("button", { name }).filter({ visible: true }).first();

/** Box of the nearest ancestor of `loc` whose rendered text has every needle (case-insensitive),
 * or, with `chart`, the nearest one holding a wide SVG. */
const around = (loc, needles = [], chart = false) =>
  loc.evaluate((el, { ns, chart }) => {
    let e = el;
    const ok = (x) => chart
      ? [...x.querySelectorAll("svg")].some((g) => g.getBoundingClientRect().width > 400)
      : ns.every((n) => (x.innerText || "").toLowerCase().includes(n));
    while (e.parentElement && !ok(e)) e = e.parentElement;
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, { ns: needles.map((n) => n.toLowerCase()), chart });

/** Union of several boxes. */
const union = (...bs) => {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
};

/** Client-side navigation from the sidebar, then let the page settle. With `ready`, the clock stops
 * until that locator shows, so a page that is still loading never reaches the video. */
async function go(r, key, { dur = 0.7, settle = 900, ready } = {}) {
  await r.click(sidebar(r, key), { dur });
  if (ready && !r.dry) {
    await r.pause();
    await ready.waitFor({ state: "visible", timeout: 45000 }).catch(() => console.warn(`  ${key}: still loading`));
    await sleep(500);
    await r.resume();
  }
  await sleep(settle);
}

/** Stop the clock until `loc` shows: a slow answer from the live API never reaches the video. */
async function waitPaused(r, loc, timeout = 45000) {
  if (r.dry || (await loc.isVisible().catch(() => false))) return;
  await r.pause();
  await loc.waitFor({ state: "visible", timeout }).catch(() => console.warn(`  ${r.id}: still waiting`));
  await sleep(400);
  await r.resume();
}

/** Security once the live audit chain is on screen: this take's approval row (the permission matrix
 * above it also names "bank.quote", so only the approval row proves the chain has loaded). */
const chainReady = (r) => r.page.locator("tr", { hasText: "approval.approved" }).filter({ visible: true }).first();

async function homeView(r, view) {
  const b = button(r, view === "detail" ? "Full detail" : "Summary");
  if ((await b.getAttribute("aria-pressed").catch(() => null)) === "true" || (await b.getAttribute("aria-selected").catch(() => null)) === "true") return;
  await r.click(b, { dur: 0.5 });
  await sleep(700);
}

async function api(path, { method = "GET", token, body } = {}) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${API}${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    if (res?.ok) return res.json();
    await sleep(1500 * (i + 1));
  }
  throw new Error(`${method} ${path} failed`);
}

/** Load a page: wait for the network to go quiet, or settle for the load event when it never does. */
async function open(page, url) {
  for (let i = 0; i < 3; i++) {
    try { return await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }); }
    catch { if (await page.waitForLoadState("load", { timeout: 15000 }).then(() => true, () => false)) return; }
  }
  throw new Error(`could not load ${url}`);
}

// ---- the scenes. L(i)/E(i): start/end of narration line i on the scene clock. ----
const SCENES = {
  async s01(r, { L }) {
    // The hero holds while Chile and China are named, then the globe takes over (story section).
    await r.at(L(0) + 2.6);
    await r.scrollTo("#story", "start", 2.4, { offset: -40 });
  },

  async s02(r, { L, E }) {
    await r.at(L(0) + 0.6);
    const welcome = text(r, "Welcome to NanFeng");
    await r.moveTo(welcome, 0.9);
    await r.zoom(await around(welcome, ["got it"]), Math.max(2.4, L(1) - r.now() - 0.2), { pad: 10, maxScale: 1.5 });
    // the owner has read the welcome: "Got it" removes the card from every Home shot after this one
    await r.at(L(1) - 1.0);
    await r.click(button(r, "Got it"), { dur: 0.6 });
    await sleep(500);
    await r.at(L(1));
    const hello = r.page.locator("h1").first();
    await r.zoom(await around(r.page.locator(".owner-alert").first(), ["payroll"]).then((a) => hello.boundingBox().then((h) => union(h, a))), 4.2, { pad: 16, maxScale: 1.5 });
    await r.moveTo(r.page.locator(".owner-alert").first(), 1.0, { x: 0.35, y: 0.6 });
    await r.at(L(2));
    await r.moveTo(text(r, "CLP 176M"), 0.8);
    await r.zoom(await around(text(r, "CLP 176M"), ["cash"]), 2.4, { pad: 14, maxScale: 1.8 });
    await r.at(L(2) + 2.6);
    const what = text(r, "What happened", true);
    await r.zoom(await around(what, ["december 30"]), E(3) - r.now() + 0.3, { pad: 14, maxScale: 1.6 });
    await r.moveTo(text(r, "On December 30 you pay"), 0.9);
    await r.at(L(3));
    await r.moveTo(text(r, "Shanghai Hongxin, your buyer"), 0.9);
  },

  async s03(r, { L }) {
    // The real agent: the importer's PDF goes to the live agent, which runs for about 40 s.
    // The run is shown at 4× (the compositor says so); every row is a real event.
    const ask = text(r, "Ask NanFeng", true);
    const send = button(r, "Send a document");
    // the pitch opens on the card alone (Home is already scrolled to it): the plan and the day's list
    // that Home shows stay dimmed outside the spotlight, so nothing on screen runs ahead of the letter
    const frame = { pad: 14, maxScale: PITCH ? 1.9 : 1.7, spot: PITCH };
    if (PITCH) {
      await r.zoom(await around(ask, ["send a document"]), 30, frame);
      await r.at(2.2);
      await r.moveTo(send, 0.8);
      await r.at(3.4);
    } else {
      await r.at(0.2);
      await r.scrollTo(ask, "center", 1.0);
      await r.at(L(0) + 0.8);
      await r.moveTo(send, 0.8);
      await r.zoom(await around(ask, ["send a document"]), 30, frame);
    }
    await sleep(250);
    if (CLOCK) await holdUntil(r, CLOCK.upload, "letter at 10:12");
    const lastEvent = r.dry ? 0 : Math.max(0, ...(await api("/agent/events/recent?after_id=0&limit=500")).map((e) => e.id));
    const chooser = r.page.waitForEvent("filechooser", { timeout: 8000 });
    await r.click(send, { dur: 0.2 });
    if (!r.dry) {
      await (await chooser).setFiles(NOTICE);
      r.mark("upload");
      r.note("uploadWall", Date.now());
    } else {
      await chooser.then((c) => c.setFiles([])).catch(() => {});
    }
    // the run is over when the agent reports anything but "running" for a run that started after the upload
    const since = () => api(`/agent/events/recent?after_id=${lastEvent}&limit=500`).catch(() => []);
    const finished = (evs) => evs.find((e) => e.type === "agent.run" && e.data?.status && e.data.status !== "running");
    if (!r.dry) {
      r.setRate(4);
      r.mark("live");
      await sleep(700);
      // the card says it is reading the document: frame it with that line
      await r.zoom(await around(ask, ["send a document"]), 30, frame);
      // stay here until the run's own events fill the stream card: the rows before the upload (the
      // reset that starts this take, earlier runs) are then below the shot
      for (let i = 0; i < 240; i++) {
        const evs = await since();
        if (evs.length >= 12 || finished(evs)) break;
        await sleep(500);
      }
    }
    await go(r, "agent", { settle: 400 });
    // only the live stream card: the scripted trace above it stays out of the spotlight
    const card = r.page.locator(".card", { has: r.page.getByText(/live event stream/i) }).first();
    const inCard = (t) => card.getByText(t).filter({ visible: true }).first();
    await card.waitFor({ timeout: 15000 });
    if (PITCH) {
      // the scripted trace above the live card ("Scripted replay") scrolls out of the shot
      await r.pause();
      await card.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await sleep(400);
      await r.resume();
    }
    await r.zoom(await card.boundingBox(), 60, { pad: 6, maxScale: 1.6, spot: true });
    if (!r.dry) {
      for (let i = 0; i < 180; i++) {
        const done = finished(await since());
        if (done) { r.note("run", `${done.data.run_id} · ${done.data.status}`); break; }
        await sleep(1000);
      }
      await sleep(1200);
      r.setRate(1);
    }
    r.mark("run-done");
    // back at real speed: point at what the narration names (a missing row only skips its move)
    const point = async (t, dur) => { if (await inCard(t).isVisible().catch(() => false)) await r.moveTo(inCard(t), dur).catch(() => {}); };
    await r.at(L(3) + 0.9);
    await point(/tool=forecast_run/, 0.8);
    await r.at(L(3) + 2.0);
    await point(/mistral/i, 0.8);
    await r.at(L(3) + 3.0);
    await point(/latency_s/, 0.8);
    if (PITCH) return; // the cut leaves here: the take moves on to keep the clock
    await r.at(L(4) + 4.2);
    await point(/awaiting_approval/, 0.9);
  },

  async s04(r, { L, E }) {
    await r.at(0.1);
    await go(r, "home", { settle: 700, ready: r.page.locator(".owner-alert").first() });
    await homeView(r, "detail");
    const kpi = text(r, "CHANCE OF NEGATIVE CASH");
    await r.scrollTo(kpi, "center", 0.8);
    await r.at(L(0) - 0.2);
    await r.moveTo(kpi, 0.8);
    await r.zoom(await around(kpi, ["before the notice"]), 9.5, { pad: 16, maxScale: 1.9 });
    await r.at(L(1));
    await r.moveTo(text(r, "before the notice"), 0.8);
    await r.at(E(1) + 0.4);
    const fc = text(r, "CASH FORECAST");
    await r.scrollTo(fc, "start", 0.9);
    await r.zoom(await around(fc, [], true), Math.max(4, E(2) - r.now() + 0.6), { pad: 0, maxScale: 1.5 });
  },

  async s05(r, { L }) {
    await r.at(0.1);
    await go(r, "financing", { settle: 900 });
    await r.at(L(0));
    await r.zoom(await around(text(r, "OPTION BOOK"), ["fogape"]), 4.8, { pad: 8, maxScale: 1.3 });
    await r.moveTo(text(r, "OPTION BOOK"), 0.8, { x: 0.3, y: 2.5 });
    await r.at(L(1));
    await r.click(text(r, "Pre-export loan in USD (PAE)"));
    await r.at(L(2) - 0.4);
    const cost = text(r, "WHAT EACH OPTION WOULD COST");
    await r.scrollTo(cost, "start", 1.0);
    await r.zoom(await around(cost, ["fogape"]), 5.2, { pad: 12, maxScale: 1.6 });
    await r.moveTo(text(r, "PAE loan (USD)"), 0.8);
    await r.at(L(3));
    await r.zoom(await around(text(r, "WHY NOT THE OTHERS"), ["fogape"]), 5, { pad: 12, maxScale: 1.4 });
    await r.moveTo(text(r, "WHY NOT THE OTHERS"), 0.8);
  },

  async s06(r, { L }) {
    await r.at(0.1);
    await r.click(tab(r, "/scenario"), { dur: 0.6 });
    await sleep(1000);
    await r.at(L(0) + 0.4);
    const chip = r.page.getByRole("button", { name: /Cherry price −10%|Cherry price -10%/ }).first();
    await r.moveTo(chip, 1.0);
    await r.at(L(1) - 0.5);
    await r.click(chip, { dur: 0.3 });
    await sleep(900);
    // the scenario's own risk (95% in 19 days); the 90-day base (83%) stays out of the shot
    const kpis = r.page.locator('[data-guide="wif-kpis"] .kpi');
    await r.zoom(await kpis.nth(0).boundingBox(), L(2) - r.now(), { pad: 12, maxScale: 1.9, spot: true });
    await r.moveTo(kpis.nth(0), 0.8);
    // the plan re-priced for that season, and what it saves against the bank loan
    await r.at(L(2) - 0.2);
    await r.zoom(union(await kpis.nth(2).boundingBox(), await kpis.nth(3).boundingBox()), 7, { pad: 12, maxScale: 1.9, spot: true });
    await r.moveTo(kpis.nth(3), 0.9);
  },

  async s07(r, { L }) {
    await r.at(0.1);
    await go(r, "home", { settle: 600, ready: r.page.locator(".owner-alert").first() });
    await homeView(r, "summary");
    const input = r.page.locator("#agent-ask");
    await waitPaused(r, input);
    const ask = text(r, "Ask NanFeng", true);
    await r.scrollTo(ask, "center", 0.9);
    await r.at(L(0));
    await r.click(input, { dur: 0.7 });
    await r.zoom(await around(ask, ["send a document"]), 9, { pad: 14, maxScale: 1.7 });
    await r.type("Why did you choose this plan?", 75);
    await sleep(250);
    await r.click(button(r, "Ask"), { dur: 0.5 });
    await sleep(900); // "Thinking…" shows, then the clock waits for the live answer
    await waitPaused(r, r.page.locator(".answer").first(), 60000);
    await r.at(L(1));
    const ans = r.page.locator(".answer").first();
    await r.zoom(await around(ans, ["optimizer"]), 7, { pad: 12, maxScale: 1.8, spot: true });
    await r.moveTo(ans, 1.0, { x: 0.55, y: 0.8 });
  },

  async s08(r, { L, E }) {
    await r.at(0.1);
    await go(r, "approvals", { settle: 900, ready: text(r, "USD 142,400") });
    await r.at(L(0));
    const req = text(r, "USD 142,400");
    await r.moveTo(req, 0.8);
    await r.zoom(await around(req, ["above buffer"]), 4.4, { pad: 10, maxScale: 1.5 });
    await r.at(L(1) - 0.2);
    await r.click(r.page.locator(".otp input, input[inputmode=numeric]").first(), { dur: 0.7 });
    r.mark("otp");
    const auth = r.page.getByText(/^authorize$/i).first();
    await r.zoom(await around(auth, ["approve usd", "reject"]), 9, { pad: 10, maxScale: 1.45 });
    await sleep(500);
    await r.moveTo(text(r, "Sandbox code"), 0.6);
    await sleep(500);
    if (!r.dry) await r.type(OTP, 150);
    await r.at(E(2) + 0.2);
    const approve = r.page.getByRole("button", { name: /Approve USD/ }).first();
    if (!r.dry) {
      await r.moveTo(approve, 0.6);
      if (CLOCK) await holdUntil(r, CLOCK.approve, "approval at 10:15");
      await r.click(approve, { dur: 0.15 });
      await sleep(900);
      // approving runs the loan and sends the anchor transaction: cut the wait
      await r.pause();
      await r.page.locator(".receipt").first().waitFor({ timeout: 60000 }).catch(() => {});
      await sleep(1200);
      await r.resume();
    } else {
      await r.moveTo(approve, 0.6);
    }
    r.mark("otp-end");
  },

  async s09(r, { L, E }) {
    await r.at(0.2);
    const receipt = r.page.locator(".receipt").first();
    if (await receipt.count()) await r.zoom(await receipt.boundingBox(), 3.4, { pad: 12, maxScale: 1.6 });
    await r.at(L(1) - 0.9);
    await go(r, "home", { settle: 600, ready: r.page.locator(".owner-alert").first() });
    await homeView(r, "summary");
    await r.scrollTo(r.page.locator("h1").first(), "start", 0.4);
    const done = text(r, "Done.");
    await r.zoom(await around(done, ["saved"]), 5, { pad: 20, maxScale: 1.6 });
    await r.moveTo(text(r, "You saved"), 0.9);
    await r.at(L(2) - 0.6);
    await homeView(r, "detail");
    const p96 = text(r, "96% of paths").or(text(r, "96%")).first();
    await r.scrollTo(p96, "center", 0.7);
    await r.zoom(await around(p96, ["buffer"]), 4.6, { pad: 20, maxScale: 1.7 });
    // the morning in one list: from the importer's letter to the funded payroll
    await r.at(L(3) - 0.7);
    await homeView(r, "summary");
    const day = text(r, "What NanFeng did for you today");
    await r.scrollTo(day, "center", 0.8);
    await r.zoom(await around(day, ["10:12"]), E(3) - r.now() + 0.6, { pad: 14, maxScale: 1.7 });
    await r.moveTo(text(r, "10:12"), 0.9);
  },

  async s10(r, { L, token }) {
    await r.at(0.1);
    await go(r, "security", { settle: 700, ready: chainReady(r) });
    const chain = text(r, "AUDIT CHAIN");
    await r.scrollTo(chain, "start", 1.2);
    await r.at(L(0));
    const appr = text(r, "approval.approved");
    await r.zoom(await around(appr, ["tier"]), 5.2, { pad: 6, maxScale: 1.25 });
    await r.moveTo(appr, 0.9);
    // the anchor of the approval row: a Sepolia transaction that covers it
    const row = r.page.locator("tr", { has: r.page.getByText("approval.approved") }).first();
    const link = row.locator('a[href*="etherscan.io/tx"]').first();
    await r.at(L(1));
    await r.moveTo(link, 0.9);
    await r.zoom(await around(link, ["approval.approved"]), 3.4, { pad: 8, maxScale: 1.9, spot: true });
    const href = await link.getAttribute("href");
    await r.at(L(2) - 0.9);
    await link.evaluate((a) => a.removeAttribute("target"));
    await r.click(link, { dur: 0.4 });
    await r.pause();
    if (token) {
      // the anchor behind the clicked link, for the input-data callout (fetched while the clock waits)
      const anchors = await api("/audit/anchors", { token }).catch(() => []);
      const a = anchors.find((x) => x.tx_hash && href?.includes(x.tx_hash));
      if (a) { r.note("root", a.merkle_root); r.note("from", a.from_seq); r.note("to", a.to_seq); r.note("tx", a.tx_hash); }
      else console.warn("  s10: no anchor matches the link", href);
    }
    await r.page.waitForURL(/etherscan/, { timeout: 30000 }).catch(() => r.page.goto(href));
    await r.page.waitForLoadState("networkidle").catch(() => {});
    // the transaction is a few seconds old: wait until Etherscan shows it mined
    for (let i = 0; i < 12 && !(await r.page.getByText("Success").first().isVisible().catch(() => false)); i++) {
      await sleep(5000);
      await r.page.reload({ waitUntil: "networkidle" }).catch(() => {});
    }
    await r.page.getByText("Got it!").click({ timeout: 4000 }).catch(() => {});
    await r.page.waitForTimeout(800);
    await r.resume();
    r.mark("etherscan");
    await r.zoom(await around(text(r, "Transaction Hash:"), ["status:", "block:"]), 5, { pad: 14, maxScale: 1.4 });
    await r.moveTo(text(r, "Sepolia Testnet transaction only"), 0.9);
    await r.at(L(3) - 3.0);
    // Etherscan shows a tooltip on most fields under a resting cursor: park it in the empty right
    // margin while the page scrolls under it
    await r.moveTo({ x: VIEWPORT.width - 70, y: 520, width: 1, height: 1 }, 0.6);
    await r.scrollTo(text(r, "More Details:"), "center", 0.9);
    await r.click(text(r, "Click to show more"));
    await sleep(900);
    r.mark("input");
    await r.zoom(r.page.locator("#inputdata").or(text(r, "Input Data:")).first(), 8, { pad: 50, maxScale: 1.4 });
  },

  async s11(r, { L }) {
    await r.goto(`${LIVE}/documents`, 1600);
    const inv = text(r, "Invoice 4471");
    await r.click(inv, { dur: 0.6 });
    await r.at(L(0) + 0.8);
    const preview = r.page.getByText(/^preview$/i).filter({ visible: true }).first();
    await r.zoom(await around(preview, ["factura"]), 5.6, { pad: 6, maxScale: 1.6 });
    await r.moveTo(text(r, "billing@frioaustral-logistica.com"), 0.8);
    await r.at(L(0) + 4.2);
    await r.moveTo(text(r, "Please note our new bank details"), 0.8);
    await r.at(L(1));
    const hidden = text(r, "SYSTEM NOTE");
    await r.zoom(await hidden.boundingBox(), 4.6, { pad: 40, maxScale: 2.2, spot: true });
    await r.moveTo(hidden, 0.8);
    await r.at(L(2));
    const read = text(r, "WHAT NANFENG READ");
    await r.zoom(await around(read, ["keep blocked"]), 4.4, { pad: 8, maxScale: 1.5 });
    await r.moveTo(text(r, "Keep blocked"), 0.9);
    await r.at(L(3) - 0.8);
    await go(r, "security", { settle: 700, ready: chainReady(r) });
    const red = text(r, "RED TEAM");
    await r.zoom(await around(red, ["public api"]), 5.4, { pad: 8, maxScale: 1.6 });
    await r.moveTo(text(r, "46/46", true), 0.8);
  },

  async s12(r, { L }) {
    await r.at(0.1);
    await go(r, "home", { settle: 600, ready: r.page.locator(".owner-alert").first() });
    await homeView(r, "summary");
    await r.scrollTo(r.page.locator("h1").first(), "start", 0.4);
    await r.at(L(0) + 1.8);
    await r.click(button(r, "中文"), { dur: 0.7 });
    await sleep(900);
    await r.zoom(await around(r.page.locator(".owner-alert").first(), ["12"]).then(async (a) => union(await r.page.locator("h1").first().boundingBox(), a)), 3.4, { pad: 16, maxScale: 1.5 });
    await r.at(L(1) - 1.4);
    await go(r, "messages", { settle: 700 });
    if (!r.page.url().endsWith("/channels")) { await r.click(tab(r, "/channels"), { dur: 0.5 }); await sleep(800); }
    const thread = text(r, "Huerto Austral · 应收账款");
    await r.zoom(await around(thread, ["由ai生成", "收到"]), 9.5, { pad: 4, maxScale: 1.5, spot: true });
    await r.at(L(1) + 4.5);
    await r.moveTo(text(r, "本消息由AI生成"), 0.9);
  },

  async s13(r, { L }) {
    await r.pause();
    await r.page.evaluate(() => localStorage.setItem("nanfeng.lang", "en"));
    await open(r.page, `${LIVE}/`);
    await r.page.waitForTimeout(3200); // the entrance curtain lifts
    await r.page.locator("#security").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await r.page.waitForTimeout(900);
    await r.resume();
    await r.scrollTo(".metrics-section", "center", 1.3);
    await r.at(L(0));
    await r.zoom(".metrics-section .wrap", 7.6, { pad: 0, maxScale: 1.25 });
    await r.moveTo(text(r, "Benchmark cases solved"), 0.9);
    await r.at(L(0) + 4.4);
    await r.moveTo(text(r, "Average financing cost"), 0.9);
    await r.at(L(1) - 0.3);
    await r.scrollTo("#team", "center", 1.3);
    await r.moveTo(r.page.locator("#team .team-cta").first(), 1.0);
  },

  async s14(r, { L }) {
    await r.at(0.2);
    await r.click(r.page.locator("#team .team-cta").first(), { dur: 0.4 });
    await r.pause();
    await r.page.waitForURL(/nosotros/, { timeout: 15000 }).catch(() => r.page.goto(`${LIVE}/nosotros`));
    await r.page.waitForLoadState("networkidle").catch(() => {});
    await r.page.waitForTimeout(1800);
    await r.page.mouse.move(VIEWPORT.width - 30, VIEWPORT.height - 30);
    r.mouse = { x: VIEWPORT.width - 30, y: VIEWPORT.height - 30 };
    await r.resume();
    await r.at(L(1) - 0.3);
    const cards = r.page.locator("img[src*='/team/'], img[srcset*='team']");
    const n = await cards.count();
    if (n >= 5) {
      const boxes = [];
      for (let i = 0; i < 5; i++) boxes.push(await around(cards.nth(i), ["·"]).catch(() => null));
      const ok = boxes.filter(Boolean);
      if (ok.length) await r.zoom(union(...ok), 8.2, { pad: 10, maxScale: 1.3 });
    }
  },

  // ---- pitch take only ----
  // Demo Mode, step 1: the morning of the notice. Risk still 13%, no plan yet ("Searching…"), the
  // importer's letter in Chinese. Nothing is clicked; the page is the state before NanFeng acts.
  async p02(r, { L }) {
    await r.at(L(0) + 0.6);
    await r.moveTo(text(r, "Huerto Austral", true), 1.0);
    await r.at(L(0) + 3.6);
    await r.moveTo(text(r, "SEARCHING"), 1.1);
    await r.at(L(1) - 0.5);
    const letter = r.page.locator(".demo-mail").first();
    await r.zoom(await around(letter, ["new date"]), 9, { pad: 12, maxScale: 1.8 });
    await r.moveTo(letter, 1.0, { x: 0.3, y: 0.5 });
    const read = r.page.locator(".demo-stage").first();
    await r.at(L(1) + 3.4);
    await r.moveTo(read.getByText("USD 180,000", { exact: true }), 0.8);
    await r.at(L(1) + 5.0);
    await r.moveTo(read.getByText("+45D", { exact: true }), 0.7);
  },

  // Business health (Topic E's business analysis): what the run found in the whole business.
  async p04(r, { L }) {
    await r.at(0.1);
    const sees = text(r, "What NanFeng sees in the business");
    await go(r, "health", { settle: 500, ready: sees });
    await r.at(L(0) - 0.2);
    await r.zoom(await around(sees, ["healthy"]), L(1) - r.now() - 0.3, { pad: 6, maxScale: 1.3 });
    await r.moveTo(text(r, "Harvest payroll (December)"), 0.9);
    await r.at(L(1) - 0.2);
    const share = text(r, "58% of expected inflows");
    const top = text(r, "Largest customer");
    await r.zoom(union(await around(share, ["act now"]), await around(top, ["concentration"])), 9, { pad: 12, maxScale: 1.6 });
    await r.moveTo(share, 0.9, { x: 0.3, y: 0.5 });
    await r.at(L(1) + 2.0);
    await r.moveTo(top, 0.8, { x: 0.2, y: 3.2 });
    await r.at(L(1) + 5.0);
    await r.moveTo(share, 0.9, { x: 0.85, y: 0.5 });
  },

  // The owner's WhatsApp thread on Messages, as the page shows it: a recorded replay, labelled so.
  async p06(r, { L }) {
    await r.at(0.1);
    await go(r, "messages", { settle: 600 });
    if (!r.page.url().endsWith("/channels")) { await r.click(tab(r, "/channels"), { dur: 0.5 }); await sleep(800); }
    const phone = r.page.locator('[data-guide="msg-owner"]').first();
    const fig = r.page.locator("figure", { has: phone }).first();
    await r.zoom(await fig.boundingBox(), 8, { pad: 10, maxScale: 1.5, spot: true });
    await r.at(L(0) - 0.2);
    await r.moveTo(phone.getByText("ALERT", { exact: true }), 0.8);
    await r.at(L(0) + 1.4);
    await r.moveTo(phone.getByText(/Reply APPROVE or WHY/), 0.8, { x: 0.7, y: 0.85 });
    await r.at(L(0) + 2.7);
    await r.moveTo(phone.locator(".bubble.out", { hasText: /^WHY/ }).first(), 0.6);
  },
};

// ---- setup: owner session, one reset, a clean browser ----
if (CLOCK) {
  // start about two minutes before the letter: the reset, Demo Mode's page and Home's card come first
  const hhmm = (t) => new Date(t).toISOString().slice(11, 19);
  console.log(`pitch take: letter at ${hhmm(CLOCK.upload)} UTC (10:12 in ${CLOCK.zone}), approval at ${hhmm(CLOCK.approve)} UTC`);
  const wait = CLOCK.upload - 130000 - Date.now();
  if (wait > 0) { console.log(`starting in ${Math.round(wait / 1000)} s`); await sleep(wait); }
}
const login = await api("/auth/login", { method: "POST", body: { password: PASSWORD } });
const token = login.token;
if (fullTake) {
  await api("/bank/reset", { method: "POST", token });
  console.log("sandbox reset");
}

// The scenario is set at 10:12 on the owner's morning; show the clock in a zone where it is morning
// now, so the times the live app prints (audit log, receipt) read like that morning.
const utcH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
let off = Math.round(10.2 - utcH);
if (off > 14) off -= 24;
if (off < -12) off += 24;
// CLOCK_ZONE=Etc/GMT-7 keeps the zone of an earlier take when scenes are recorded again later.
const timezoneId = CLOCK?.zone || process.env.CLOCK_ZONE || (off === 0 ? "Etc/GMT" : `Etc/GMT${off > 0 ? "-" : "+"}${Math.abs(off)}`);
console.log("clock zone", timezoneId);

const browser = await chromium.launch({ args: CHROME_ARGS });
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DSF, locale: "en-US", timezoneId, colorScheme: "light",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36" });
await ctx.addInitScript(({ tok, live }) => {
  try {
    localStorage.setItem("nanfeng.guide", "off");
    if (location.origin === live) sessionStorage.setItem("nanfeng.session", tok);
  } catch {}
}, { tok: token, live: LIVE });
await ctx.addInitScript(CURSOR_INIT);
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
if (PITCH) {
  // An owner's desk with no request pending opens the Cherry Crisis request itself (lib/desk-state,
  // refresh(true)): in the take it would exist before the letter. The browser's own POST /approvals
  // gets the 403 a visitor gets, so the only request is the one the live agent proposes after reading
  // the letter. Approving (POST /approvals/{id}/approve) is untouched.
  await page.route(`${API}/approvals`, (route) => (route.request().method() === "POST"
    ? route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ detail: "recording: the agent proposes" }),
      headers: { "access-control-allow-origin": LIVE, "access-control-allow-credentials": "true", vary: "Origin" } })
    : route.continue()));
}
await open(page, `${LIVE}/`);
await page.evaluate(() => { localStorage.setItem("nanfeng.lang", "en"); localStorage.setItem("nanfeng.theme", "light"); });

const scenes = PITCH
  ? PITCH_ORDER.map((id) => {
    const p = PITCH_SCENES[id];
    if (p) return { id, title: p.title, duration: p.duration, lines: p.lines.map(([start, end]) => ({ start, end })) };
    const s = tl.scenes.find((x) => x.id === id);
    return { ...s, duration: PITCH_DURATION[id] ?? s.duration };
  })
  : tl.scenes;
const encodes = [];
for (const s of scenes) {
  if (only.length && !only.includes(s.id)) continue;
  const L = (i) => s.lines[i].start;
  const Ei = (i) => s.lines[i].end;
  // first scene starts on a fresh landing (after its entrance curtain), the desk on a fresh Home
  if (s.id === "s01") { await open(page, `${LIVE}/`); await page.waitForTimeout(3400); }
  if (s.id === "s02") { await open(page, `${LIVE}/cockpit`); await page.waitForTimeout(2500); }
  if (only.length && !["s01", "s02", "s06", "s11", "s13", "s14"].includes(s.id) && !page.url().includes("/cockpit")) {
    await open(page, `${LIVE}/cockpit`); await page.waitForTimeout(2000);
  }
  if (only.length && s.id === "s06") { await open(page, `${LIVE}/financing`); await page.waitForTimeout(1500); }
  if (s.id === "p02") {
    await open(page, `${LIVE}/demo`);
    await page.waitForTimeout(2500);
    // the floating "Play the Cherry Crisis" button would sit under the caption: the page holds still
    await page.addStyleTag({ content: ".demo-start{visibility:hidden!important}" });
  }
  if (PITCH && s.id === "s03") {
    // Home, already on the "Ask NanFeng" card: the scene opens on it (see s03)
    await sidebar({ page }, "home").click();
    await page.locator(".owner-alert").first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.getByRole("button", { name: "Got it" }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.getByText("Ask NanFeng", { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(900);
  }
  if (only.length && s.id === "s14") { await open(page, `${LIVE}/`); await page.waitForTimeout(3200); await page.locator("#team").evaluate((el) => el.scrollIntoView({ block: "center" })); }
  // The landing has no clicks: keep the cursor out of the way in the corner.
  const rest = s.id === "s01" ? { x: VIEWPORT.width + 40, y: VIEWPORT.height + 40 } : { x: VIEWPORT.width * 0.62, y: VIEWPORT.height * 0.55 };
  await page.mouse.move(rest.x, rest.y);
  const r = new Recorder(page, OUT, s.id, { dry });
  r.mouse = rest;
  console.log(`${dry ? "dry " : "rec "} ${s.id} ${s.duration.toFixed(1)}s ${s.title}`);
  await r.start();
  try {
    await SCENES[s.id](r, { L, E: Ei, token });
  } catch (e) {
    console.error(`  ${s.id}: ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${OUT}.error-${s.id}.png` });
  }
  const late = r.now() - s.duration;
  if (late > 0) console.warn(`  ${s.id} actions ran ${late.toFixed(1)}s past the scene end`);
  const done = await r.finish(s.duration, { defer: !!CLOCK });
  if (typeof done === "function") encodes.push(done);
}
await browser.close();
for (const encode of encodes) console.log("encoded", encode());
