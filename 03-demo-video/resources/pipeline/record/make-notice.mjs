// The importer's delay notice that the video uploads with "Send a document": a PDF for the agent
// and a PNG of the same page for the on-screen thumbnail.
import { chromium } from "playwright";
const dir = new URL("../assets/", import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}notice.html`);
await page.pdf({ path: `${dir}hongxin-payment-notice.pdf`, format: "A4", printBackground: true });
await page.screenshot({ path: new URL("../public/notice.png", import.meta.url).pathname });
await browser.close();
