// Screenshots of the live site's screens with the owner session, to script the recording.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "https://www.nanfengcfo.com";
const API = "https://api.nanfengcfo.com";
const OUT = new URL("../.explore/live/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const routes = (process.argv[2] ?? "/cockpit,/documents,/financing,/scenario,/mission,/channels,/approvals,/security,/nosotros,/health").split(",");

const browser = await chromium.launch({ args: ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "America/Santiago", colorScheme: "light",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36" });
let login;
for (let i = 0; i < 5 && !login; i++) { const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "huerto-demo-2026" }) }); if (r.ok) login = await r.json(); else await new Promise((s) => setTimeout(s, 2000)); }
await ctx.addInitScript((tok) => { try { localStorage.setItem("nanfeng.guide", "off"); localStorage.setItem("nanfeng.lang", "en"); localStorage.setItem("nanfeng.theme", "light"); sessionStorage.setItem("nanfeng.session", tok); } catch {} }, login.token);
const page = await ctx.newPage();
for (const r of routes) {
  await page.goto(BASE + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const name = r.slice(1).replace(/\//g, "_") || "landing";
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });
  const txt = await page.evaluate(() => document.querySelector("main, .content, body").innerText);
  fs.writeFileSync(`${OUT}${name}.txt`, txt);
  console.log(r, "ok");
}
await browser.close();
