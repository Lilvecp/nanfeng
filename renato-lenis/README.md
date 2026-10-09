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

## Tasks

- [ ] `r2-01` **Oct 8** · Must — **Accounts and API keys** for OpenRouter, Mistral, Zavu and ElevenLabs with spending limits; keys only in Camilo's secret manager.
- [ ] `r2-02` **Oct 9** · Must — **Ingestion**: invoices, bank statements and notices via WhatsApp or upload → Mistral OCR → schema-validated JSON.
- [ ] `r2-03` **Oct 9** · Must — **Quarantined LLM** (Andy's design): reads documents and only returns typed fields; the agent never sees the raw text.
- [ ] `r2-04` **Oct 9** · Must — **Orchestrator**: planner → tool → policy check → execution, with a pause for human approval.
- [ ] `r2-05` **Oct 10** · Should — **Model router** with OpenRouter: cheap to classify, strong to plan, fallback, and cost and latency logging.
- [ ] `r2-06` **Oct 10** · Must — **Tools**: `ledger_query`, `forecast_run`, `financing_quote`, `optimize_plan`, `send_collection`, `schedule_payment`, `request_factoring`, `anchor_audit`.
- [ ] `r2-07` **Oct 10** · Must — **Zavu**: alerts, approvals and OTP via WhatsApp/SMS; collections to the importer in Chinese or English.
- [ ] `r2-12` **Oct 10** · Must — **Decoupled channel layer** (`ChannelAdapter`): WhatsApp, SMS, email and voice via Zavu behind a single interface. Adding a new channel means writing an adapter, not touching the agent.
- [ ] `r2-08` **Oct 11** · Should — **ElevenLabs**: daily cash briefing and alert call in ES / EN / 中文.
- [ ] `r2-09` **Oct 11** · Must — **Full integration** of the Cherry Crisis scenario with Valentín, Camilo, Vicente and Andy.
- [ ] `r2-13` **Oct 11** · Could — **Simulated WeCom adapter**: the Chinese importer receives the collection in Chinese in a chat-style view marked as mock, to show the Chinese channel already fits in the architecture.
- [ ] `r2-10` **Oct 13** · Must — **Agent tests**: every scenario task has a test that passes in CI.
- [ ] `r2-11` **Oct 14** · Must — **Agent section** in the technical documentation: flow, prompts, tools and error handling.
