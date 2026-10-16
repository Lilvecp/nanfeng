# R2 · AI Agent Engineer — Renato Lenis

**Mission:** Make the agent close real tasks end to end (40% of the grade). Owner of NanFeng's brain and how it talks over WhatsApp and voice.

**Owns:**
- Agent orchestrator
- Agent tools
- Ingestion with Mistral OCR
- OpenRouter router
- Zavu and ElevenLabs channels

**Deliverables:** 01 (agent) · 04 (with Camilo)

**Tools:** Python · FastAPI · OpenRouter · Mistral · Zavu · ElevenLabs

## Status (Oct 13)

The agent lives in [`nanfeng_agent/`](nanfeng_agent) and is documented in [`01-technical-documentation/agent.md`](../../01-technical-documentation/agent.md) (r2-11). It runs as a service on :8200 (`docker compose up`, service `agent`): Zavu webhook, document uploads, "ask it why", the daily briefing, the business health report on WhatsApp, and a listener that resumes a paused run as soon as the owner approves in the cockpit. 113 tests run against the real backend (CI job "Agent tests"), and the whole Cherry Crisis was run live with the backend, the quant engine and Mistral OCR.

All four providers are live on the deploy (`GET /health` on the agent service): Mistral (USD 10 limit), OpenRouter (USD 5 limit), ElevenLabs and Zavu. A full Cherry Crisis run with the LLM planner (Claude Sonnet 5.5) and the quarantined extractor (Mistral Small) costs about USD 0.02. WhatsApp through Zavu was tested live from a team phone; with the test key the phone must write to the Zavu number first (24-hour window, see [`01-technical-documentation/agent.md`](../../01-technical-documentation/agent.md#zavu-with-a-test-key-zv_test_)). The agent service runs on Railway and the web's Home and ask box call it (`NEXT_PUBLIC_AGENT_URL`). Every provider is optional: without a key the agent uses deterministic stand-ins, so the demo and CI never depend on a paid API. Owner messages default to English (`NANFENG_OWNER_LANGUAGE=en`; also `es`, `zh`).

```sh
cd 04-source-code/agent
python3 -m venv .venv && .venv/bin/pip install -e "../backend[dev]" -e ".[dev,service]"
.venv/bin/pytest -q
.venv/bin/python -m nanfeng_agent status          # which providers are live
.venv/bin/uvicorn nanfeng_agent.service:app --port 8200
.venv/bin/python -m nanfeng_agent cherry          # CLI, against a running backend (+ quant profile)
```

## Merged and red-teamed by Andy (Oct 12)

- **PR #4 (`renato-agent`) was merged into `main` as it was.** Nothing in the branch was changed: no commits were pushed to `renato-agent`, and no conflicts came up. Merge commit `41bc42e`. Before merging, the merged tree was tested against the current `main` (owner sign-in, red team gate at 43): backend 95 passed, agent 55 passed, red team 43/43, OpenAPI contract unchanged (that day's suites; today: backend 131, agent 113, red team 46/46). CI on `main` passed all four jobs.
- **Added [`tests/test_redteam_via_agent.py`](tests/test_redteam_via_agent.py)** (Andy's r4-06 work; no agent code changed). It replays the red team's 12 document attacks (PI-01 … PI-12) through `Agent.handle_document`, injected into the clean Cartonera invoice so that only the guard and the quarantine can stop them. A control test checks that the same invoice without the attack is paid (L2), so an agent that blocks everything would not pass.
- **Result: no attack moves money.** The guard flags all 12: 4 are `malicious` and the run is blocked with nothing extracted; 8 are `suspicious`, so extraction continues with typed fields only and the agent neither pays nor creates an approval. That matches `05-security-self-assessment-report/anti-injection-design.md` (suspicious → typed fields; anything citing the document goes to L3).
- **Extended the same day (Andy, branch `andy`):** the red team's chat attacks (SE-01, SE-02, SE-03, EX-02) arrive as WhatsApp / WeCom messages, and five bank-detail swaps (new account, look-alike and typo-squatted domains, unknown supplier, right tax id with another account) arrive on the clean invoice. Again none moves money: the guard flags every chat attack; the payee check stops every swap (`bank-change`, `domain-mismatch`, `unknown-payee`). 21 attacks in total through the agent.
- **Agent code changed by Andy (branch `andy`, PR #7), Oct 12:** `nanfeng_agent/templates.py` gains `AI_LABEL` / `ai_label(lang)`, and `send_collection` in `nanfeng_agent/tools.py` appends that label to every reminder to an importer (CAC labelling measures: 【本消息由AI生成 · NanFeng】 in Chinese, an equivalent label in English and Spanish; messages to the owner are not labelled). Tests: [`tests/test_ai_label.py`](tests/test_ai_label.py). `01-technical-documentation/agent.md`: the fake invoice moved to 08:47 to match the final story. Nothing else in the agent changed.
- **Backend change that affects the agent (F6):** with `NANFENG_AGENT_TOKEN` empty, agent routes now answer 401 instead of accepting anyone. Set the same token in the backend and the agent service; for local work without a token, start the backend with `NANFENG_ALLOW_OPEN_AGENT=true`. Checked live: with the token, the clean invoice is paid and the BEC invoice is blocked; without it the run ends `failed` and nothing moves.
- **If this test fails after a change to the agent**, an injected document got further than it should. Check the guard verdict and what the planner did with a `suspicious` document before you relax the test. The attacks live in `redteam/attacks.py` (ask Andy).

## Checked by Vicente (Oct 13)

- **Agent code changed by Vicente (on `main`), after PR #11 and #12:** `inbound.verify_signature` trims spaces in `X-Zavu-Signature`, so `t=…, v2=…` is accepted too. `AgentService.run_inbound_quietly` logs any background failure with its traceback (before, only a `422` was caught, so a `BackendError` or a network error escaped the task). On the synchronous relay path (agent token), an event that fails is forgotten, so the relay can retry it instead of getting `duplicate`. Tests: the last three in [`tests/test_service.py`](tests/test_service.py). Nothing else in the agent changed.

## Tasks

- [x] `r2-01` **Oct 8** · Must — _(all four live on the deploy; WhatsApp tested from a team phone)_ **Accounts and API keys** for OpenRouter, Mistral, Zavu and ElevenLabs with spending limits; keys only in Camilo's secret manager.
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
