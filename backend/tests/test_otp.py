import re
from datetime import timedelta

import pytest
from sqlalchemy import update

from app import otp
from app.config import get_settings
from app.db import SessionLocal
from app.models import Approval, OtpChallenge, utcnow
from app.seed import FX_RATES

FACTORING = {"action": "factoring INV-2026-118", "operations": [
    {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.5}}]}


@pytest.fixture()
def sms(client, monkeypatch):
    """SMS mode with Zavu replaced by an outbox we can read."""
    s = get_settings()
    monkeypatch.setattr(s, "otp_mode", "sms")
    monkeypatch.setattr(s, "owner_phone", "+56911112222")
    monkeypatch.setattr(s, "zavu_api_key", "zv_test_dummy")
    monkeypatch.setattr(s, "otp_resend_after_s", 0)
    outbox: list[dict] = []

    def fake_send(to: str, text: str) -> str:
        outbox.append({"to": to, "text": text})
        return f"msg_{len(outbox)}"

    monkeypatch.setattr(otp, "send_sms", fake_send)
    return outbox


def code_in(msg: dict) -> str:
    return re.search(r"\b(\d{6})\b", msg["text"]).group(1)


def test_l3_request_texts_a_fresh_code_to_the_owner(client, sms):
    a = client.post("/approvals", json=FACTORING).json()
    assert a["status"] == "pending" and len(sms) == 1
    clp = round(180_000 * 0.5 * FX_RATES["USD"])  # half of INV-2026-118 at the seed's spot
    assert sms[0]["to"] == "+56911112222" and f"CLP {clp:,}" in sms[0]["text"]
    done = client.post(f"/approvals/{a['id']}/approve", json={"otp": code_in(sms[0])}).json()
    assert done["status"] == "approved"


def test_sandbox_code_does_not_work_in_sms_mode(client, sms):
    a = client.post("/approvals", json=FACTORING).json()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": get_settings().sandbox_otp})
    assert r.status_code == 403 or code_in(sms[0]) == get_settings().sandbox_otp


def test_code_is_bound_to_its_approval(client, sms):
    client.post("/approvals", json=FACTORING)  # its code is sms[0]
    b = client.post("/approvals", json={**FACTORING, "operations": [
        {"op": "factoring", "params": {"receivable_id": "INV-2026-115"}}]}).json()
    r = client.post(f"/approvals/{b['id']}/approve", json={"otp": code_in(sms[0])})
    assert r.status_code == 403  # a's code does not open b


def test_code_is_bound_to_the_amount(client, sms):
    a = client.post("/approvals", json=FACTORING).json()
    with SessionLocal() as db:
        db.execute(update(Approval).where(Approval.id == a["id"]).values(amount_clp=1))
        db.commit()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": code_in(sms[0])})
    assert r.status_code == 403


def test_code_expires(client, sms):
    a = client.post("/approvals", json=FACTORING).json()
    with SessionLocal() as db:
        db.execute(update(OtpChallenge).values(expires_at=utcnow() - timedelta(seconds=1)))
        db.commit()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": code_in(sms[0])})
    assert r.status_code == 410 and r.json()["detail"]["error"] == "otp_expired"


def test_resend_replaces_the_old_code(client, sms):
    a = client.post("/approvals", json=FACTORING).json()
    r = client.post(f"/approvals/{a['id']}/otp")
    assert r.status_code == 200 and "delivery_id" not in r.json() and len(sms) == 2
    old, new = code_in(sms[0]), code_in(sms[1])
    if old != new:
        assert client.post(f"/approvals/{a['id']}/approve", json={"otp": old}).status_code == 403
    assert client.post(f"/approvals/{a['id']}/approve", json={"otp": new}).json()["status"] == "approved"


def test_resend_is_rate_limited(client, sms, monkeypatch):
    monkeypatch.setattr(get_settings(), "otp_resend_after_s", 30)
    a = client.post("/approvals", json=FACTORING).json()
    assert client.post(f"/approvals/{a['id']}/otp").status_code == 429


def test_code_never_leaves_through_logs_or_events(client, sms):
    a = client.post("/approvals", json=FACTORING).json()
    code = code_in(sms[0])
    events = client.get("/agent/events/recent", params={"limit": 500}).text
    audit = client.get("/audit/entries", params={"limit": 1000}).text
    assert code not in events and code not in audit
    assert any(e["kind"] == "approval.otp_sent" for e in client.get("/audit/entries").json())
    client.post(f"/approvals/{a['id']}/approve", json={"otp": code})


def test_missing_sms_config_keeps_request_pending(client, sms, monkeypatch):
    monkeypatch.setattr(get_settings(), "owner_phone", "")
    a = client.post("/approvals", json=FACTORING).json()
    assert a["status"] == "pending" and not sms
    r = client.post(f"/approvals/{a['id']}/otp")
    assert r.status_code == 503 and r.json()["detail"]["error"] == "otp_unconfigured"


def test_voice_never_approves(client):
    a = client.post("/approvals", json=FACTORING).json()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913", "channel": "VOICE"})
    assert r.status_code == 403 and r.json()["detail"]["error"] == "voice_cannot_approve"
    assert client.get(f"/approvals/{a['id']}").json()["status"] == "pending"


def test_agent_token_cannot_approve(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "agent_token", "agent-secret")
    agent = {"Authorization": "Bearer agent-secret"}
    a = client.post("/approvals", json=FACTORING, headers=agent).json()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}, headers=agent)
    assert r.status_code == 403
    assert client.post(f"/approvals/{a['id']}/reject", json={"reason": "nope"}, headers=agent).status_code == 403
    assert client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()["status"] == "approved"


def test_zavu_request_shape(monkeypatch):
    import httpx

    seen = {}

    def fake_post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return httpx.Response(200, json={"id": "msg_abc123"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(get_settings(), "zavu_api_key", "zv_test_dummy")
    monkeypatch.setattr(httpx, "post", fake_post)
    assert otp.send_sms("+56911112222", "hi") == "msg_abc123"
    assert seen["url"] == "https://api.zavu.dev/v1/messages"
    assert seen["json"] == {"to": "+56911112222", "text": "hi", "channel": "sms"}
    assert seen["headers"]["Authorization"] == "Bearer zv_test_dummy"
