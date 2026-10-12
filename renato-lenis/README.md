# R2 · AI Agent Engineer — Renato Lenis

**Mission:** Make the agent close real tasks end to end (40% of the grade). Owner of NanFeng's brain and how it talks over WhatsApp and voice.

**Owns:**
- Agent orchestrator
- Agent tools
- Ingestion with Mistral OCR
- OpenRouter router
- Zavu and ElevenLabs channels

**Deliverables:** 01 (agent) · 04 (with Camilo)

**Tools:** Python · LangGraph · OpenRouter · Mistral · Zavu · ElevenLabs

## Status (Oct 12)

The agent lives in [`nanfeng_agent/`](nanfeng_agent) and is documented in [`docs/agent.md`](docs/agent.md) (r2-11). It runs as a service on :8200 (`docker compose up`, service `agent`): Zavu webhook, document uploads, "ask it why", the daily briefing, and a listener that resumes a paused run as soon as the owner approves in the cockpit. 49 tests run against the real backend (CI job "Agent tests"), and the whole Cherry Crisis was run live with the backend, the quant engine and Mistral OCR.

Still open: **r2-01** for OpenRouter, Zavu and ElevenLabs (Mistral is live with a USD 10 limit). Their code is written and tested against mocked APIs; each needs its key, then one live run. Every provider is optional: without a key the agent uses deterministic stand-ins, so the demo and CI never depend on a paid API. Handoff to the front: the cockpit's "Ask it why" and an upload button can call the service (see the doc).

```sh
cd renato-lenis
python3 -m venv .venv && .venv/bin/pip install -e "../backend[dev]" -e ".[dev,service]"
.venv/bin/pytest -q
.venv/bin/python -m nanfeng_agent status          # which providers are live
.venv/bin/uvicorn nanfeng_agent.service:app --port 8200
.venv/bin/python -m nanfeng_agent cherry          # CLI, against a running backend (+ quant profile)
```

## Tasks

- [ ] `r2-01` **Oct 8** · Must — **Accounts and API keys** for OpenRouter, Mistral, Zavu and ElevenLabs with spending limits; keys only in Camilo's secret manager.
- [x] `r2-02` **Oct 9** · Must — **Ingestion**: invoices, bank statements and notices via WhatsApp or upload → Mistral OCR → schema-validated JSON.
- [x] `r2-03` **Oct 9** · Must — **Quarantined LLM** (Andy's design): reads documents and only returns typed fields; the agent never sees the raw text.
- [x] `r2-04` **Oct 9** · Must — **Orchestrator**: planner → tool → policy check → execution, with a pause for human approval.
- [x] `r2-05` **Oct 10** · Should — **Model router** with OpenRouter: cheap to classify, strong to plan, fallback, and cost and latency logging.
- [x] `r2-06` **Oct 10** · Must — **Tools**: `ledger_query`, `forecast_run`, `financing_quote`, `optimize_plan`, `send_collection`, `schedule_payment`, `request_factoring`, `anchor_audit`.
- [x] `r2-07` **Oct 10** · Must — **Zavu**: alerts, approvals and OTP via WhatsApp/SMS; collections to the importer in Chinese or English.
- [x] `r2-12` **Oct 10** · Must — **Decoupled channel layer** (`ChannelAdapter`): WhatsApp, SMS, email and voice via Zavu behind a single interface. Adding a new channel means writing an adapter, not touching the agent.
- [x] `r2-08` **Oct 11** · Should — **ElevenLabs**: daily cash briefing and alert call in ES / EN / 中文.
- [x] `r2-09` **Oct 11** · Must — **Full integration** of the Cherry Crisis scenario with Valentín, Camilo, Vicente and Andy.
- [x] `r2-13` **Oct 11** · Could — **Simulated WeCom adapter**: the Chinese importer receives the collection in Chinese in a chat-style view marked as mock, to show the Chinese channel already fits in the architecture.
- [x] `r2-10` **Oct 13** · Must — **Agent tests**: every scenario task has a test that passes in CI.
- [x] `r2-11` **Oct 14** · Must — **Agent section** in the technical documentation: flow, prompts, tools and error handling.
