"""Agent service (r2-09): webhook, uploads, auto-resume on the owner's decision, "ask it why"."""

import base64

import pytest
from conftest import AGENT_TOKEN, SANDBOX_OTP
from fastapi.testclient import TestClient

from nanfeng_agent import fixtures, ocr
from nanfeng_agent.pdfgen import bec_invoice_pdf
from nanfeng_agent.service import AgentService, create_app

AGENT = {"Authorization": f"Bearer {AGENT_TOKEN}"}


@pytest.fixture()
def svc(agent):
    return AgentService(agent)


@pytest.fixture()
def api(svc):
    with TestClient(create_app(svc, listen=False)) as c:
        yield c


def test_health_shows_providers_never_keys(api):
    body = api.get("/health").json()
    assert body["status"] == "ok" and set(body["providers"]) == {"openrouter", "mistral_ocr", "zavu", "elevenlabs"}
    assert all(v in ("live", "offline") for v in body["providers"].values())


def test_zavu_webhook_needs_the_token(api):
    payload = {"channel": "email", "from": "ap@hongxin-fruit.example", "text": fixtures.SHANGHAI_NOTICE}
    assert api.post("/inbound/zavu", json=payload).status_code == 401
    assert api.post("/inbound/zavu", json=payload, headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_zavu_webhook_runs_the_agent(api, client, owner):
    payload = {"channel": "email", "from": "ap@hongxin-fruit.example", "text": fixtures.SHANGHAI_NOTICE}
    run = api.post("/inbound/zavu", json=payload, headers=AGENT).json()
    assert run["status"] == "awaiting_approval"
    assert run["approvals"][0]["tier"] == 3
    assert api.get(f"/runs/{run['run_id']}").status_code == 401  # traces are the owner's
    trace = api.get(f"/runs/{run['run_id']}", headers=owner).json()["trace"]
    assert "optimize_plan" in [s["tool"] for s in trace]


def test_owner_decision_on_the_stream_resumes_the_run(api, svc, client, owner):
    run = api.post("/inbound/zavu", json={"channel": "email", "text": fixtures.SHANGHAI_NOTICE}, headers=AGENT).json()
    appr_id = run["approvals"][0]["id"]
    client.post(f"/approvals/{appr_id}/approve", json={"otp": SANDBOX_OTP}, headers=owner)

    # The listener feeds every SSE event to handle_event; replay the stream the backend produced.
    for e in client.get("/agent/events/recent", params={"limit": 500}).json():
        svc.handle_event(e)
    after = api.get(f"/runs/{run['run_id']}", headers=owner).json()
    assert after["status"] == "completed"
    assert after["approvals"][0]["status"] == "approved"
    assert "anchor_audit" in [s["tool"] for s in after["trace"]]


def test_upload_needs_the_owner(api):
    body = {"filename": "x.txt", "mime": "text/plain", "data_base64": base64.b64encode(b"hola").decode()}
    assert api.post("/documents", json=body).status_code == 401
    assert api.post("/documents", json=body, headers=AGENT).status_code == 401  # the agent is not the owner


def test_uploaded_bec_pdf_is_blocked_by_hidden_text(api, owner, monkeypatch):
    """The real 10:31 PDF: OCR (what a human sees) has no instruction; the text layer does."""
    visible = fixtures.BEC_INVOICE_OCR
    monkeypatch.setattr(ocr, "mistral_ocr", lambda data, mime, key, client=None: visible)
    api.app.state.service.agent.settings.__dict__["mistral_api_key"] = "test-key"  # frozen dataclass, test only
    try:
        pdf = bec_invoice_pdf()
        run = api.post("/documents", headers=owner, json={
            "filename": "factura-4471.pdf", "mime": "application/pdf", "source": "email",
            "data_base64": base64.b64encode(pdf).decode()}).json()
    finally:
        api.app.state.service.agent.settings.__dict__["mistral_api_key"] = ""
    assert run["status"] == "blocked"
    assert "hidden-text" in run["note"] and "doc-instruction" in run["note"]
    assert run["approvals"] == []


def test_pdf_text_layer_carries_what_the_page_hides():
    layer = ocr.text_layer(bec_invoice_pdf())
    assert "ignore previous instructions" in layer
    assert "CL-BANCOPACIFICO-0099155301" in layer


def test_ask_explains_the_plan_with_tool_numbers(api, owner):
    assert api.post("/ask", json={"question": "¿por qué?"}).status_code == 401
    assert "not run anything" in api.post("/ask", headers=owner, json={"question": "why?"}).json()["answer"]
    assert "Todavía" in api.post("/ask", headers=owner, json={"question": "¿por qué?", "language": "es"}).json()["answer"]
    api.post("/inbound/zavu", json={"channel": "email", "text": fixtures.SHANGHAI_NOTICE}, headers=AGENT)

    why = api.post("/ask", headers=owner, json={"question": "¿Por qué elegiste el crédito PAE?", "language": "es"}).json()
    assert why["intent"] == "plan" and "CLP 2,1M" in why["answer"] and "45%" in why["answer"]
    tier = api.post("/ask", headers=owner, json={"question": "Why do I need an OTP code?", "language": "en"}).json()
    assert tier["intent"] == "tier" and "L3" in tier["answer"] and "never approve" in tier["answer"]
    alt = api.post("/ask", headers=owner, json={"question": "为什么不用保理？", "language": "zh"}).json()
    assert alt["intent"] == "alternatives" and "Export factoring" in alt["answer"]
    risk = api.post("/ask", headers=owner, json={"question": "what is the cash risk", "language": "en"}).json()
    assert "81%" in risk["answer"]


def test_ask_explains_a_block(api, agent, owner):
    agent.handle_document(fixtures.bec_invoice())
    out = api.post("/ask", headers=owner, json={"question": "¿Por qué bloqueaste la factura?"}).json()
    assert out["intent"] == "blocked" and "bank-change" in out["answer"] and "+56229876543" in out["answer"]


def test_briefing_needs_the_owner(api, owner):
    assert api.post("/briefing", json={"language": "en"}).status_code == 401
    out = api.post("/briefing", json={"language": "en"}, headers=owner).json()
    assert "Good morning" in out["text"]


def test_webhook_fails_closed_without_credentials(agent):
    from nanfeng_agent.config import Settings
    agent.settings = Settings(backend_url="http://testserver", agent_token="", zavu_webhook_secret="")
    with TestClient(create_app(AgentService(agent), listen=False)) as c:
        r = c.post("/inbound/zavu", json={"channel": "email", "text": fixtures.SHANGHAI_NOTICE})
    assert r.status_code == 503
    assert agent.runs == {}


# --- Real Zavu webhooks: signed envelope, answered fast, run in the background -------------------

ZAVU_SECRET = "zavu-signing-secret-test"


def _signed(payload: dict, secret: str = ZAVU_SECRET, t: int | None = None) -> tuple[bytes, dict]:
    import hashlib, hmac, json, time
    body = json.dumps(payload).encode()
    t = int(time.time()) if t is None else t
    v2 = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return body, {"X-Zavu-Signature": f"t={t},v2={v2}", "Content-Type": "application/json"}


def _event(text: str, event_id: str = "evt_1", type_: str = "message.inbound") -> dict:
    return {"id": event_id, "type": type_, "timestamp": 1705312200000, "senderId": "snd_1", "projectId": "prj_1",
            "data": {"messageId": "msg_1", "from": "+8613800000000", "to": "+12025550100", "channel": "whatsapp",
                     "messageType": "text", "text": text, "profileName": "Hongxin AP"}}


@pytest.fixture()
def zavu_api(agent):
    import dataclasses
    agent.settings = dataclasses.replace(agent.settings, zavu_webhook_secret=ZAVU_SECRET)
    with TestClient(create_app(AgentService(agent), listen=False)) as c:
        yield c


def test_signed_zavu_event_is_accepted_then_run(zavu_api, agent):
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE))
    r = zavu_api.post("/inbound/zavu", content=body, headers=headers)
    assert r.status_code == 202 and r.json()["status"] == "accepted"
    (run,) = agent.runs.values()  # the TestClient runs background tasks before returning
    assert run.status == "awaiting_approval"


def test_zavu_signature_is_checked(zavu_api, agent):
    import time
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE), secret="another-secret")
    assert zavu_api.post("/inbound/zavu", content=body, headers=headers).status_code == 401
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE), t=int(time.time()) - 3600)  # replayed
    assert zavu_api.post("/inbound/zavu", content=body, headers=headers).status_code == 401
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE))
    tampered = body.replace(b"Shanghai", b"Shanghaj")
    assert zavu_api.post("/inbound/zavu", content=tampered, headers=headers).status_code == 401
    assert zavu_api.post("/inbound/zavu", json=_event("x"), headers={"X-Webhook-Token": ZAVU_SECRET}).status_code == 401
    assert agent.runs == {}


def test_zavu_status_events_and_retries_do_not_start_runs(zavu_api, agent):
    body, headers = _signed(_event("", event_id="evt_2", type_="message.delivered"))
    assert zavu_api.post("/inbound/zavu", content=body, headers=headers).json()["status"] == "ignored"
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE, event_id="evt_3"))
    assert zavu_api.post("/inbound/zavu", content=body, headers=headers).status_code == 202
    assert zavu_api.post("/inbound/zavu", content=body, headers=headers).json()["status"] == "duplicate"
    assert len(agent.runs) == 1


def test_zavu_signature_tolerates_spaces_in_the_header():
    import time
    from nanfeng_agent.inbound import verify_signature
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE))
    spaced = headers["X-Zavu-Signature"].replace(",", ", ").replace("=", " = ", 1)
    assert verify_signature(ZAVU_SECRET, spaced, body, now=time.time())
    assert not verify_signature(ZAVU_SECRET, spaced, body + b" ", now=time.time())


def test_background_run_failure_is_logged_not_raised(zavu_api, agent, monkeypatch, caplog):
    from nanfeng_agent.backend import BackendError

    def down(doc):
        raise BackendError("backend unreachable")

    monkeypatch.setattr(agent, "handle_document", down)
    body, headers = _signed(_event(fixtures.SHANGHAI_NOTICE, event_id="evt_4"))
    with caplog.at_level("ERROR", logger="nanfeng_agent"):
        assert zavu_api.post("/inbound/zavu", content=body, headers=headers).status_code == 202
    assert "inbound message failed" in caplog.text


def test_relay_can_retry_an_event_that_failed(svc, agent, monkeypatch):
    calls = []

    def flaky(doc):
        calls.append(doc)
        if len(calls) == 1:
            raise RuntimeError("transient")
        return type("Run", (), {"summary": lambda self: {"status": "completed"}})()

    monkeypatch.setattr(agent, "handle_document", flaky)
    event = _event(fixtures.SHANGHAI_NOTICE, event_id="evt_5")
    with TestClient(create_app(svc, listen=False), raise_server_exceptions=False) as c:
        assert c.post("/inbound/zavu", json=event, headers=AGENT).status_code == 500
        assert c.post("/inbound/zavu", json=event, headers=AGENT).json()["status"] == "completed"
    assert len(calls) == 2


def test_health_report_sends_the_engine_findings_on_whatsapp(api, agent, hub, owner):
    assert api.post("/report", json={}).status_code == 401
    assert api.post("/report", json={}, headers=AGENT).status_code == 401  # the agent is not the owner
    out = api.post("/report", json={}, headers=owner).json()
    assert out["run"]["status"] == "completed" and out["delivery"]["channel"] == "whatsapp"
    # English by default, the engine's own words, the most severe finding first, and the link to /health.
    assert "Business health" in out["text"] and "/health" in out["text"]
    assert "81% chance cash is negative" in out["text"].splitlines()[1]
    sent = next(d for d in hub.outbox if d.message.kind == "report")
    assert sent.message.text == out["text"] and sent.message.language == "en"
    es = api.post("/report", json={"language": "es", "send": False}, headers=owner).json()
    assert "Salud del negocio" in es["text"] and es["delivery"] is None
    assert "business_analysis" in [s["tool"] for s in api.get(f"/runs/{out['run']['run_id']}", headers=owner).json()["trace"]]


# --- "WHY" from the owner's WhatsApp (W1) ------------------------------------------------------

OWNER_PHONE = "+56 9 1234 5678"


@pytest.fixture()
def owner_api(settings, backend, hub):
    from dataclasses import replace

    from nanfeng_agent.orchestrator import Agent
    from nanfeng_agent.router import ModelRouter

    agent = Agent(replace(settings, owner_phone=OWNER_PHONE), backend=backend, router=ModelRouter(""), hub=hub)
    with TestClient(create_app(AgentService(agent), listen=False)) as c:
        yield c, agent


def _wa(text, sender="+56912345678"):
    return {"channel": "whatsapp", "from": sender, "text": text}


def test_owner_asks_why_on_whatsapp_and_gets_the_real_answer(owner_api, hub):
    api, agent = owner_api
    run = api.post("/inbound/zavu", json=_wa(fixtures.SHANGHAI_NOTICE, "+8613800000001"), headers=AGENT).json()
    runs_before = len(agent.runs)

    out = api.post("/inbound/zavu", json=_wa("WHY the PAE?"), headers=AGENT).json()
    assert out["status"] == "answered" and out["intent"] == "plan" and out["run_id"] == run["run_id"]
    assert len(agent.runs) == runs_before  # a question starts no run, no forecast
    reply = hub.outbox[-1]
    assert reply.channel == "whatsapp" and reply.message.kind == "answer"
    assert reply.message.to == agent.owner.channels["whatsapp"]
    assert "Pre-export loan in USD (PAE)" in reply.message.text and "45% cheaper" in reply.message.text


def test_approve_on_whatsapp_only_explains_the_approval_stays_pending(owner_api, client, hub):
    api, agent = owner_api
    run = api.post("/inbound/zavu", json=_wa(fixtures.SHANGHAI_NOTICE, "+8613800000001"), headers=AGENT).json()
    appr_id = run["approvals"][0]["id"]

    out = api.post("/inbound/zavu", json=_wa(f"APPROVE {appr_id} {SANDBOX_OTP}"), headers=AGENT).json()
    assert out["status"] == "answered" and out["intent"] == "tier"
    assert "never approve" in hub.outbox[-1].message.text
    assert agent.backend.get(f"/approvals/{appr_id}")["status"] == "pending"


def test_why_from_another_phone_is_a_document(owner_api):
    api, agent = owner_api
    out = api.post("/inbound/zavu", json=_wa("why?", "+8613800000009"), headers=AGENT).json()
    assert out.get("run_id", "").startswith("RUN-") and out["status"] != "answered"


def test_owner_forwarding_a_notice_still_runs_the_agent(owner_api):
    api, _ = owner_api
    out = api.post("/inbound/zavu", json=_wa(fixtures.SHANGHAI_NOTICE), headers=AGENT).json()
    assert out["status"] == "awaiting_approval"


def test_owner_question_needs_a_configured_owner_phone(api, agent):
    assert agent.settings.owner_phone == ""
    out = api.post("/inbound/zavu", json=_wa("why?", "+56900000000"), headers=AGENT).json()
    assert out["status"] != "answered"
