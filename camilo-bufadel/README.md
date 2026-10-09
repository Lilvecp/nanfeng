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

- [ ] `r3-01` **Oct 8** · Must — **GitHub repo** with CI, .env, secret manager and secret scanning.
- [ ] `r3-02` **Oct 8** · Must — **OpenAPI contracts** between front, agent, quant and security, with mocks so nobody waits on anybody.
- [ ] `r3-03` **Oct 9** · Must — **FastAPI + Postgres backend** and SSE event stream for Mission Control.
- [ ] `r3-04` **Oct 9** · Must — **Sandbox Bank**: simulated API for accounts, payments, FX, factoring and lenders, with exportable logs (evidence 06).
- [ ] `r3-05` **Oct 10** · Should — **Audit log** with chained hash and Merkle root anchored on FISCO BCOS (Docker). If it doesn't work by Saturday the 10th at noon, switch to an EVM testnet.
- [ ] `r3-06` **Oct 11** · Could — **On-chain invoice registry** to prevent the same invoice from being financed twice.
- [ ] `r3-07` **Oct 11** · Must — **Stable deployment** of the backend outside China and the front on Vercel, with a URL for the jury.
- [ ] `r3-10` **Oct 11** · Must — **Own domain for the demo**: *.vercel.app is blocked in China. Test the URL with a China access-test service.
- [ ] `r3-08` **Oct 13** · Must — **README** with one-command deployment (docker compose), tests and licenses of everything used.
- [ ] `r3-09` **Oct 15** · Must — **Export evidence**: sandbox logs and on-chain hashes organized, together with Andy.

## Shared frontend (lead: Camilo)

See [plan/frontend-shared.md](../plan/frontend-shared.md) for the full card.

- [ ] `fe-02` **Oct 8** · Must — Project base (Next.js on Vercel, typed API client, SSE hooks)
- [ ] `fe-04` **Oct 9** · Must — Agent Mission Control
- [ ] `fe-08` **Oct 10** · Should — Security Console
- [ ] `fe-09` **Oct 11** · Could — WhatsApp mirror
- [ ] `fe-10` **Oct 11** · Must — Demo Mode (both: Camilo the replay)
- [ ] `fe-14` **Oct 11** · Must — China-ready front
- [ ] `fe-12` **Oct 13** · Must — Polish (both)
