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


def test_zavu_webhook_runs_the_agent(api, client):
    payload = {"channel": "email", "from": "ap@hongxin-fruit.example", "text": fixtures.SHANGHAI_NOTICE}
    run = api.post("/inbound/zavu", json=payload, headers=AGENT).json()
    assert run["status"] == "awaiting_approval"
    assert run["approvals"][0]["tier"] == 3
    trace = api.get(f"/runs/{run['run_id']}").json()["trace"]
    assert "optimize_plan" in [s["tool"] for s in trace]


def test_owner_decision_on_the_stream_resumes_the_run(api, svc, client, owner):
    run = api.post("/inbound/zavu", json={"channel": "email", "text": fixtures.SHANGHAI_NOTICE}, headers=AGENT).json()
    appr_id = run["approvals"][0]["id"]
    client.post(f"/approvals/{appr_id}/approve", json={"otp": SANDBOX_OTP}, headers=owner)

    # The listener feeds every SSE event to handle_event; replay the stream the backend produced.
    for e in client.get("/agent/events/recent", params={"limit": 500}).json():
        svc.handle_event(e)
    after = api.get(f"/runs/{run['run_id']}").json()
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


def test_ask_explains_the_plan_with_tool_numbers(api):
    assert "Todavía" in api.post("/ask", json={"question": "¿por qué?"}).json()["answer"]
    api.post("/inbound/zavu", json={"channel": "email", "text": fixtures.SHANGHAI_NOTICE}, headers=AGENT)

    why = api.post("/ask", json={"question": "¿Por qué elegiste el crédito PAE?", "language": "es"}).json()
    assert why["intent"] == "plan" and "CLP 2,1M" in why["answer"] and "45%" in why["answer"]
    tier = api.post("/ask", json={"question": "Why do I need an OTP code?", "language": "en"}).json()
    assert tier["intent"] == "tier" and "L3" in tier["answer"] and "never approve" in tier["answer"]
    alt = api.post("/ask", json={"question": "为什么不用保理？", "language": "zh"}).json()
    assert alt["intent"] == "alternatives" and "Export factoring" in alt["answer"]
    risk = api.post("/ask", json={"question": "what is the cash risk", "language": "en"}).json()
    assert "81%" in risk["answer"]


def test_ask_explains_a_block(api, agent):
    agent.handle_document(fixtures.bec_invoice())
    out = api.post("/ask", json={"question": "¿Por qué bloqueaste la factura?"}).json()
    assert out["intent"] == "blocked" and "bank-change" in out["answer"] and "+56229876543" in out["answer"]


def test_briefing_needs_the_owner(api, owner):
    assert api.post("/briefing", json={"language": "en"}).status_code == 401
    out = api.post("/briefing", json={"language": "en"}, headers=owner).json()
    assert "Good morning" in out["text"]
