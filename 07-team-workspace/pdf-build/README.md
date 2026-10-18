# PDF build for deliverables 01, 05 and 06

Joins the markdown files of each deliverable (01, 05 and 06) into one PDF: cover with contents, Mermaid diagrams and KaTeX formulas rendered, links between the joined files kept inside the PDF and every other relative link pointed at GitHub (`main`). Rebuild after editing any of those markdown files.

```sh
cd 07-team-workspace/pdf-build
npm install
node build.mjs ../.. tech ../../01-technical-documentation/NanFeng-Technical-Documentation.pdf
node build.mjs ../.. security ../../05-security-self-assessment-report/NanFeng-Security-Self-Assessment-Report.pdf
node build.mjs ../.. evidence ../../06-execution-evidence/NanFeng-Execution-Evidence.pdf
```

Uses Google Chrome when it is installed (Playwright's `channel: "chrome"`), otherwise Playwright's Chromium (`npx playwright install chromium`). Needs network access for the fonts, Mermaid and KaTeX.
