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

## Status (Oct 11)

The agent lives in [`nanfeng_agent/`](nanfeng_agent) and is documented in [`docs/agent.md`](docs/agent.md) (r2-11). It runs the whole Cherry Crisis against the real backend in the tests (39 passing, CI job "Agent tests"). Every provider is optional: without its key the agent uses deterministic stand-ins, so the demo and CI never depend on a paid API.

Still open: **r2-09** live (agent ↔ backend ↔ Andy's guard and policy is tested end to end; the quant engine is replayed from Vicente's results in the tests and the cockpit does not trigger agent runs yet), **r2-01** (the real keys with spending limits, then one live run per provider), the Zavu inbound webhook route, and a live run with the quant engine (`docker compose --profile quant up`). Items marked done below that touch a provider (r2-02 OCR, r2-05, r2-07, r2-08) are written and tested against mocked APIs; they go live once the keys exist.

```sh
cd renato-lenis
python3 -m venv .venv && .venv/bin/pip install -e "../backend[dev]" -e ".[dev]"
.venv/bin/pytest -q
.venv/bin/python -m nanfeng_agent status          # which providers are live
.venv/bin/python -m nanfeng_agent cherry          # against a running backend (+ quant profile)
.venv/bin/python -m nanfeng_agent briefing --lang zh
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
- [ ] `r2-09` **Oct 11** · Must — **Full integration** of the Cherry Crisis scenario with Valentín, Camilo, Vicente and Andy.
- [x] `r2-13` **Oct 11** · Could — **Simulated WeCom adapter**: the Chinese importer receives the collection in Chinese in a chat-style view marked as mock, to show the Chinese channel already fits in the architecture.
- [x] `r2-10` **Oct 13** · Must — **Agent tests**: every scenario task has a test that passes in CI.
- [x] `r2-11` **Oct 14** · Must — **Agent section** in the technical documentation: flow, prompts, tools and error handling.
