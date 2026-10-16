// Builds a deliverable PDF from markdown files: cover, contents, the documents in order,
// Mermaid diagrams and KaTeX formulas rendered, relative links pointed at GitHub.
// usage: node build.mjs <repo root> <tech|security> <out.pdf>   (needs Google Chrome installed)
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import { chromium } from "playwright";

const [root, which, out] = process.argv.slice(2);
const GH = "https://github.com/Lilvecp/nanfeng/blob/main/";
const TEAM = "Universidad del Desarrollo, Chile · Valentín Castro, Renato Lenis, Camilo Bufadel, Andy Villarroel, Vicente Rodríguez";

const CONFIGS = {
  tech: {
    dir: "01-technical-documentation",
    title: "Technical documentation",
    footer: "NanFeng 南风 · Technical documentation",
    lead: "System architecture, core algorithm description and security design of NanFeng, the AI CFO for SMEs that export to China, acting with the owner's approval.",
    files: ["technical-documentation.md", "core-algorithm.md", "agent.md", "security-design.md"],
  },
  security: {
    dir: "05-security-self-assessment-report",
    title: "Security self-assessment report",
    footer: "NanFeng 南风 · Security self-assessment report",
    lead: "Permission-tier implementation, threat model, anti-injection design, privacy and compliance, and the known-risk list of NanFeng.",
    files: ["security-self-assessment.md", "threat-model.md", "anti-injection-design.md", "privacy-compliance.md"],
  },
};
const cfg = CONFIGS[which];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");

function render(file, idx) {
  const rel = path.posix.join(cfg.dir, file);
  const md = fs.readFileSync(path.join(root, rel), "utf8");
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      code({ text, lang }) {
        if (lang === "mermaid") return `<pre class="mermaid">${esc(text)}</pre>`;
        if (lang === "latex") return `<div class="math" data-tex="${esc(text)}"></div>`;
        return `<pre><code>${esc(text)}</code></pre>`;
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const id = `d${idx}-${slug(inner)}`;
        return `<h${depth} id="${id}">${inner}</h${depth}>`;
      },
      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        let url = href;
        if (href.startsWith("#")) url = `#d${idx}-${href.slice(1)}`;
        else if (!/^[a-z]+:/i.test(href)) {
          const [p, frag] = href.split("#");
          const target = path.posix.normalize(path.posix.join(cfg.dir, p));
          const local = cfg.files.indexOf(path.posix.basename(target));
          if (path.posix.dirname(target) === cfg.dir && local >= 0) url = frag ? `#d${local}-${frag}` : `#doc-${local}`;
          else url = GH + target + (frag ? `#${frag}` : "");
        }
        return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ""}>${inner}</a>`;
      },
    },
  });
  const h1 = (md.match(/^# (.+)$/m) || [, file])[1];
  return { h1, html: `<section class="doc" id="doc-${idx}">${marked.parse(md)}</section>` };
}

const docs = cfg.files.map(render);
const contents = docs.map((d, i) => `<li><a href="#doc-${i}">${esc(d.h1)}</a></li>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  :root { --ink:#151a21; --navy:#1f3358; --muted:#5e6573; --gold:#9a7a3a; --line:#d9dbe0; --head:#eef0f4; --code:#f3f4f6; }
  @page { size: A4; margin: 18mm 16mm 20mm; }
  html { font-family: "IBM Plex Sans", sans-serif; font-size: 10pt; color: var(--ink); line-height: 1.5; }
  body { margin: 0; }
  .cover { height: 245mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .eyebrow { font-family: "IBM Plex Mono", monospace; font-size: 8.5pt; letter-spacing: .22em; color: var(--navy); text-transform: uppercase; }
  .cover h1 { font-size: 30pt; color: var(--navy); margin: 10pt 0 8pt; border: 0; }
  .cover .lead { font-size: 13pt; color: var(--navy); max-width: 135mm; margin: 0 0 22pt; }
  .cover .label { color: var(--muted); font-size: 9pt; margin-bottom: 4pt; }
  .cover ol { margin: 0 0 16pt; padding-left: 18pt; }
  .cover ol a { color: var(--ink); text-decoration: none; }
  .cover .meta { color: var(--muted); font-size: 9pt; }
  .doc { page-break-before: always; }
  .doc:first-of-type { page-break-before: auto; }
  h1 { font-size: 20pt; color: var(--navy); margin: 0 0 10pt; padding-bottom: 6pt; border-bottom: 2px solid var(--gold); }
  h2 { font-size: 14pt; color: var(--navy); margin: 18pt 0 6pt; break-after: avoid; }
  h3 { font-size: 11.5pt; color: var(--navy); margin: 14pt 0 4pt; break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 12pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: #2b5cab; text-decoration: none; }
  code { font-family: "IBM Plex Mono", monospace; font-size: 8.6pt; background: var(--code); padding: 0 2pt; border-radius: 2pt; overflow-wrap: anywhere; }
  pre { background: var(--code); padding: 8pt 10pt; border-radius: 3pt; font-size: 8pt; line-height: 1.35; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: inherit; }
  pre.mermaid { background: none; text-align: center; padding: 4pt 0; white-space: pre; }
  pre.mermaid svg { max-width: 100%; height: auto; }
  .math { margin: 8pt 0; overflow: hidden; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 10pt; font-size: 8.6pt; line-height: 1.4; }
  th, td { border: 1px solid var(--line); padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: var(--head); font-weight: 600; }
  tr { break-inside: avoid; }
  blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3px solid var(--gold); color: var(--muted); }
  hr { border: 0; border-top: 1px solid var(--line); }
</style></head><body>
<section class="cover">
  <div class="eyebrow">FinTechathon 2026 · International Track · Topic E: SME Finance Copilot</div>
  <h1>${esc(cfg.title)}</h1>
  <p class="lead">${esc(cfg.lead)}</p>
  <div class="label">Contents</div>
  <ol>${contents}</ol>
  <div class="meta">${esc(TEAM)}<br>Live app: www.nanfengcfo.com · Source: github.com/Lilvecp/nanfeng · All data is synthetic</div>
</section>
${docs.map((d) => d.html).join("\n")}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs";
  await document.fonts.ready;
  const maths = [...document.querySelectorAll(".math")];
  for (const el of maths) katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: true });
  await document.fonts.ready; // KaTeX's fonts load only once a formula uses them; measure after.
  for (const el of maths) {
    // Shrink a formula wider than the column instead of letting it run off the page.
    const width = () => {
      const r = el.getBoundingClientRect(), bs = [...el.querySelectorAll(".katex-html .base")].map((b) => b.getBoundingClientRect());
      return Math.max(...bs.map((b) => b.right)) - Math.min(...bs.map((b) => b.left)) + 2 * Math.max(0, r.left - Math.min(...bs.map((b) => b.left)));
    };
    let size = 10;
    while (width() > el.clientWidth - 4 && size > 5) { size -= 0.25; el.style.fontSize = size + "pt"; }
  }
  mermaid.initialize({ startOnLoad: false, theme: "neutral", fontFamily: "IBM Plex Sans, sans-serif", markdownAutoWrap: false, flowchart: { htmlLabels: false, useMaxWidth: true }, sequence: { useMaxWidth: true } });
  await mermaid.run({ querySelector: "pre.mermaid" });
  window.__done = true;
</script>
</body></html>`;

// Google Chrome when installed; otherwise the Chromium that `npx playwright install chromium` downloads
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
// Lay out at the printed column width (A4 minus 16 mm margins = 178 mm), so measurements match the PDF.
const page = await browser.newPage({ viewport: { width: 673, height: 1000 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__done === true, null, { timeout: 60000 });
const failed = await page.$$eval("pre.mermaid", (els) => els.filter((e) => !e.querySelector("svg")).length);
if (failed) throw new Error(`${failed} mermaid diagrams did not render`);
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;color:#5e6573;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>${cfg.footer}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
  outline: true,
  tagged: true,
});
await browser.close();
console.log("ok", out);
