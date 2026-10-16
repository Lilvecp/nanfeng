# PDF build for deliverables 01 and 05

Joins the four markdown files of each deliverable into one PDF: cover with contents, Mermaid diagrams and KaTeX formulas rendered, links between the joined files kept inside the PDF and every other relative link pointed at GitHub (`main`). Rebuild after editing any of those markdown files.

```sh
cd 07-team-workspace/pdf-build
npm install
node build.mjs ../.. tech ../../01-technical-documentation/NanFeng-Technical-Documentation.pdf
node build.mjs ../.. security ../../05-security-self-assessment-report/NanFeng-Security-Self-Assessment-Report.pdf
```

Uses Google Chrome when it is installed (Playwright's `channel: "chrome"`), otherwise Playwright's Chromium (`npx playwright install chromium`). Needs network access for the fonts, Mermaid and KaTeX.
