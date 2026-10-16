// Screenshots of every screen plus a dump of its clickable texts, to script the recording.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = new URL("../.explore/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const routes = (process.argv[2] ?? "/,/cockpit,/documents,/financing,/scenario,/mission,/channels,/approvals,/security,/demo,/health").split(",");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const login = await (await fetch("http://localhost:8000/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "huerto-demo-2026" }) })).json();
await ctx.addInitScript((tok) => { try { localStorage.setItem("nanfeng.guide", "off"); sessionStorage.setItem("nanfeng.session", tok); } catch {} }, login.token);
const page = await ctx.newPage();
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const name = r === "/" ? "landing" : r.slice(1).replace(/\//g, "_");
  await page.screenshot({ path: `${OUT}${name}.png` });
  const clicks = await page.$$eval("button, a, [role=tab]", (els) =>
    els.filter((e) => e.offsetParent).map((e) => `${e.tagName.toLowerCase()} | ${(e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 70)} | ${e.getAttribute("href") ?? ""}`));
  fs.writeFileSync(`${OUT}${name}.txt`, clicks.join("\n"));
  console.log(r, "ok", clicks.length);
}
await browser.close();
