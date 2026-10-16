# Deployment

How to run NanFeng on one machine, and how the public deploy is set up. Every variable is listed with a safe default in [`.env.example`](../.env.example) (backend and agent) and [`web/.env.example`](../web/.env.example) (web). Real values never go in the repo: locally they live in `.env` (git-ignored), on the hosts in their environment-variable settings.

## 1. The public deploy

| Service | Address | Health check |
|---|---|---|
| Web (Vercel, region `hkg1`) | https://www.nanfengcfo.com | the landing page loads |
| Backend (Railway) | https://api.nanfengcfo.com | `GET /health` → `{"status":"ok", "anchor_backend":"evm", ...}`; API docs at `/docs` |
| Quant engine (Railway, behind the backend) | via https://api.nanfengcfo.com/quant | `GET /quant/health` |
| Agent service (Railway) | the URL in the web's `NEXT_PUBLIC_AGENT_URL` | `GET /health` → providers `live` or `offline` (never the keys) |

`nanfengcfo.com` redirects to `www.nanfengcfo.com`. The demo owner password is shown on the sign-in screen while `NANFENG_DEMO=true`.

## 2. One machine, one command

Needs Docker. From the repository root:

```sh
cp .env.example .env                      # then set NANFENG_AGENT_TOKEN (see the comment in the file)
docker compose --profile quant up --build
```

| Service | URL |
|---|---|
| Backend + API docs | http://localhost:8000/docs |
| Agent service | http://localhost:8200/health |
| Quant engine | http://localhost:8100/docs |
| Postgres | inside the compose network |

Then the web:

```sh
cd web
cp .env.example .env.local                # NEXT_PUBLIC_API_URL=http://localhost:8000, NEXT_PUBLIC_AGENT_URL=http://localhost:8200
npm ci
npm run dev -- -p 3100                    # http://localhost:3100
```

Without `NEXT_PUBLIC_API_URL` (or with the backend down) the web runs on the Cherry Crisis sandbox in the browser, so the demo never depends on the network. Without provider keys the agent uses deterministic stand-ins for every provider.

### Without Docker

Python 3.12 and Node 22. Each service in its own terminal:

```sh
# quant engine (:8100)
cd vicente-rodriguez && python -m venv .venv && .venv/bin/pip install -e ".[api,dev]"
.venv/bin/uvicorn nanfeng_quant.api:app --port 8100

# backend (:8000), SQLite by default
cd backend && python -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --port 8000

# agent (:8200)
cd renato-lenis && python -m venv .venv && .venv/bin/pip install -e "../backend[dev]" -e ".[dev,service]"
.venv/bin/uvicorn nanfeng_agent.service:app --port 8200
```

On Windows use `.venv\Scripts\` instead of `.venv/bin/`.

## 3. Deploying

Each Python service is a container built from its own `Dockerfile`; any container host works. We use Railway for the three services and Vercel for the web.

### Quant engine

- Build: `vicente-rodriguez/Dockerfile`, port 8100. It listens on IPv4 and IPv6 (`::`), so it is reachable on Railway's private network; it does not need a public domain.
- No secrets.

### Backend

- Build: `backend/Dockerfile`, port 8000. Attach a Postgres database.

| Variable | Value on a public deploy |
|---|---|
| `NANFENG_DATABASE_URL` | `postgresql+psycopg://…` of the database |
| `NANFENG_QUANT_URL` | the quant engine's private address, port 8100 |
| `NANFENG_AGENT_TOKEN` | long random value, the same as the agent's |
| `NANFENG_SESSION_SECRET` | long random value (empty = every restart signs the owner out) |
| `NANFENG_CORS_ORIGINS` | `["https://www.nanfengcfo.com"]` |
| `NANFENG_DEMO`, `NANFENG_OWNER_PASSWORD` | `true` + the demo password for the jury; `false` + your own password otherwise |
| `NANFENG_OTP_MODE` | `sandbox` (shared demo code) or `sms` with `NANFENG_OTP_SECRET`, `ZAVU_API_KEY`, `NANFENG_OWNER_PHONE` |
| `NANFENG_ANCHOR_BACKEND` | `evm`, with `NANFENG_EVM_RPC_URL` and `NANFENG_EVM_PRIVATE_KEY` (a testnet-only wallet funded from a Sepolia faucet) |
| `NANFENG_REGISTRY_BACKEND` | `local`, or `evm` with `NANFENG_INVOICE_REGISTRY_ADDRESS` (deploy the contract once with `python chain/deploy.py`) |
| `NANFENG_ALLOW_OPEN_AGENT` | never set on a deploy |

The full security checklist for a public deploy is in [`backend/README.md`](../backend/README.md#security-checklist-for-a-public-deploy-andy).

### Agent service

- Build: `renato-lenis/Dockerfile`, port 8200, public domain (the web and Zavu's webhook call it).

| Variable | Value |
|---|---|
| `NANFENG_BACKEND_URL` | the backend's address |
| `NANFENG_AGENT_TOKEN` | the same value as the backend's |
| `NANFENG_CORS_ORIGINS` | `["https://www.nanfengcfo.com"]` |
| `NANFENG_COCKPIT_URL` | `https://www.nanfengcfo.com` (the link in the owner's messages) |
| `NANFENG_OWNER_LANGUAGE` | `en` (also `es`, `zh`) |
| `NANFENG_OWNER_PHONE` | the owner's WhatsApp number, E.164 |
| `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `ZAVU_API_KEY`, `ELEVENLABS_API_KEY` | provider keys, each with a spend limit; any of them may be empty |
| `NANFENG_ZAVU_WEBHOOK_SECRET` | the signing secret Zavu shows when the webhook is added to the sender (event `message.inbound`, URL `https://<agent>/inbound/zavu`) |

### Web

- Vercel project with root directory `web/` (framework Next.js, region from `web/vercel.json`: `hkg1`).
- `NEXT_PUBLIC_API_URL=https://api.nanfengcfo.com` and `NEXT_PUBLIC_AGENT_URL=<agent URL>`. They are read at build time: redeploy after changing them.
- Domain: `www.nanfengcfo.com`, with the apex redirecting to it. `*.vercel.app` is blocked in mainland China, so the jury link is always the own domain.

## 4. After a deploy

1. Check the health endpoints in section 1.
2. Re-export the execution evidence (deliverable 06) from the deployed backend and commit it:

   ```sh
   cd andy-villarroel/evidence
   python build.py --url https://api.nanfengcfo.com --out out-live
   ```

3. Contract and tests run in CI on every push to `main` (see the root README).
