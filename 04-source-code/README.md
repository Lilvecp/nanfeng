# 04 · Source code

All of NanFeng's code (submission checklist item 04). Repository: https://github.com/Lilvecp/nanfeng. Quick start, every test command and the licenses are in the [root README](../README.md); local and public deployment, with every variable, is in [deployment.md](deployment.md).

| Folder | What | Tests |
|---|---|---|
| [web/](web/) | Web cockpit (Next.js): landing and every cockpit screen, on the live API or an in-browser sandbox | lint + production build |
| [backend/](backend/) | API gateway (FastAPI): owner sign-in, policy engine L0–L3, step-up OTP, sandbox bank, audit log, Merkle anchoring, invoice registry, agent event stream, quant proxy | [backend/tests/](backend/tests/) |
| [agent/](agent/) | Agent service (`nanfeng_agent`): reads documents and messages, plans, calls tools, proposes approvals; WhatsApp, SMS, voice | [agent/tests/](agent/tests/) |
| [quant/](quant/) | Quant engine (`nanfeng_quant`): Monte Carlo forecast, financing MILP, Credit Passport, business analysis, NanFeng-Bench, results | [quant/tests/](quant/tests/) |
| [contracts/](contracts/) | OpenAPI contract, generated from the backend | CI fails if it drifts |
| [redteam/](redteam/) | 46 attacks against the API, judged by outcome | CI regression gate |

| File | What |
|---|---|
| [docker-compose.yml](docker-compose.yml) | One-command stack: Postgres, backend, agent (+ quant engine with `--profile quant`) |
| [.env.example](.env.example) | Every backend and agent variable, with safe defaults; copy it to `.env` here |
| [deployment.md](deployment.md) | One machine with or without Docker, and the public deploy (Vercel + Railway) |
