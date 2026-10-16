# R3 · Full-Stack & Blockchain Developer — Camilo Bufadel

**Mission:** The backbone: backend, sandbox bank, deployment and chain. Also co-leads the frontend with Valentín: the one who wires the screens to the real API (see [shared card](../plan/frontend-shared.md)).

**Owns:**
- Repo, CI and deployment
- Backend and sandbox bank
- API contracts
- On-chain audit log
- Frontend, shared with Valentín

**Deliverables:** 04 · 06 (logs and hashes) · 01 (architecture)

**Tools:** FastAPI · Postgres / Supabase · Docker · FISCO BCOS · Vercel

## Tasks

- [x] `r3-01` _(CI: secret scanning, backend, agent, quant, web; `.env.example`; secrets only in the hosts)_ **Oct 8** · Must — **GitHub repo** with CI, .env, secret manager and secret scanning.
- [x] `r3-02` _([04-source-code/contracts/openapi.json](../../04-source-code/contracts/openapi.json), generated; CI fails on drift)_ **Oct 8** · Must — **OpenAPI contracts** between front, agent, quant and security, with mocks so nobody waits on anybody.
- [x] `r3-03` **Oct 9** · Must — **FastAPI + Postgres backend** and SSE event stream for Mission Control.
- [x] `r3-04` **Oct 9** · Must — **Sandbox Bank**: simulated API for accounts, payments, FX, factoring and lenders, with exportable logs (evidence 06).
- [x] `r3-05` _(EVM testnet: Merkle roots on Sepolia; FISCO BCOS is one more backend in `anchoring.py`)_ **Oct 10** · Should — **Audit log** with chained hash and Merkle root anchored on FISCO BCOS (Docker). If it doesn't work by Saturday the 10th at noon, switch to an EVM testnet.
- [x] `r3-06` _(`InvoiceRegistry.sol` + `registry.py`, 6 tests; not yet deployed on Sepolia)_ **Oct 11** · Could — **On-chain invoice registry** to prevent the same invoice from being financed twice.
- [x] `r3-07` _(backend, agent and quant on Railway; web on Vercel)_ **Oct 11** · Must — **Stable deployment** of the backend outside China and the front on Vercel, with a URL for the jury.
- [x] `r3-10` _(https://www.nanfengcfo.com, API at https://api.nanfengcfo.com; the China access test is r1-12)_ **Oct 11** · Must — **Own domain for the demo**: *.vercel.app is blocked in China. Test the URL with a China access-test service.
- [x] `r3-08` _([README](../../README.md), [04-source-code/deployment.md](../../04-source-code/deployment.md))_ **Oct 13** · Must — **README** with one-command deployment (docker compose), tests and licenses of everything used.
- [x] `r3-09` _(with Andy: [evidence/out-live](../../06-execution-evidence/out-live/SUMMARY.md))_ **Oct 15** · Must — **Export evidence**: sandbox logs and on-chain hashes organized, together with Andy.

## Shared frontend (lead: Camilo)

See [07-team-workspace/plan/frontend-shared.md](../plan/frontend-shared.md) for the full card.

- [x] `fe-02` **Oct 8** · Must — Project base (Next.js on Vercel, typed API client, SSE hooks)
- [x] `fe-04` **Oct 9** · Must — Agent Mission Control
- [x] `fe-08` **Oct 10** · Should — Security Console
- [x] `fe-09` **Oct 11** · Could — WhatsApp mirror
- [x] `fe-10` **Oct 11** · Must — Demo Mode (both: Camilo the replay)
- [x] `fe-14` **Oct 11** · Must — China-ready front
- [ ] `fe-12` **Oct 13** · Must — Polish (both)
