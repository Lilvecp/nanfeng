"""One request, one approval: the agent asking twice for the same plan gets the one already waiting (and
the owner one code), and a newer financing plan replaces the older one instead of queueing a second loan."""

from datetime import datetime, timedelta, timezone

import pytest

from app import autoreset, otp
from app.config import get_settings

PAE = {"action": "Pre-export loan in USD (PAE)", "channel": "WEB", "explanation": "MILP plan", "operations": [
    {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}]}
FACTORING = {"action": "factoring INV-2026-118", "operations": [
    {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.5}}]}
PAYEE_CHANGE = {"action": "new account for Frío Austral", "operations": [
    {"op": "payee_bank_change", "params": {"payee_id": "PAY-FRIO", "bank_account": "CL-BANCOSUR-5550001",
                                           "verified_by": "call-back to number on file"}}]}


@pytest.fixture()
def sms(client, monkeypatch):
    """SMS mode with Zavu replaced by an outbox we can read."""
    s = get_settings()
    monkeypatch.setattr(s, "otp_mode", "sms")
    monkeypatch.setattr(s, "owner_phone", "+56911112222")
    monkeypatch.setattr(s, "zavu_api_key", "zv_test_dummy")
    monkeypatch.setattr(s, "otp_resend_after_s", 0)
    outbox: list[str] = []
    monkeypatch.setattr(otp, "send_sms", lambda to, text: outbox.append(text) or f"msg_{len(outbox)}")
    return outbox


def kinds(client) -> list[str]:
    return [e["kind"] for e in client.get("/audit/entries", params={"limit": 1000}).json()]


def test_same_plan_twice_is_one_approval_and_one_code(client, sms):
    a = client.post("/approvals", json=PAE).json()
    b = client.post("/approvals", json={**PAE, "channel": "WA", "action": "PAE again",
                                        "explanation": "re-run after reset"})
    assert b.status_code == 201 and b.json()["id"] == a["id"]
    assert len(sms) == 1  # no second code on the owner's phone
    assert [x["id"] for x in client.get("/approvals", params={"status": "pending"}).json()] == [a["id"]]
    assert "approval.repeated" in kinds(client)


def test_a_newer_financing_plan_supersedes_the_pending_one(client):
    old = client.post("/approvals", json=FACTORING).json()
    new = client.post("/approvals", json=PAE).json()
    assert new["id"] != old["id"] and new["status"] == "pending"
    old = client.get(f"/approvals/{old['id']}").json()
    assert old["status"] == "rejected" and old["note"] == f"superseded by {new['id']}"
    assert client.post(f"/approvals/{old['id']}/approve", json={"otp": "482913"}).status_code == 409
    assert "approval.superseded" in kinds(client)


def test_one_click_never_takes_two_loans(client):
    first = client.post("/approvals", json=PAE).json()
    bigger = {**PAE, "operations": [{"op": "loan", "params": {**PAE["operations"][0]["params"],
                                                               "amount_clp": 150_000_000}}]}
    second = client.post("/approvals", json=bigger).json()
    assert client.post(f"/approvals/{first['id']}/approve", json={"otp": "482913"}).status_code == 409
    assert client.post(f"/approvals/{second['id']}/approve", json={"otp": "482913"}).json()["status"] == "approved"
    assert kinds(client).count("bank.loan") == 1


def test_only_financing_is_superseded_and_only_by_a_request_that_can_run(client):
    change = client.post("/approvals", json=PAYEE_CHANGE).json()
    loan = client.post("/approvals", json=PAE).json()
    assert client.get(f"/approvals/{change['id']}").json()["status"] == "pending"  # not new money

    client.post("/policy/kill-switch", json={"on": True})
    blocked = client.post("/approvals", json=FACTORING).json()
    assert blocked["status"] == "blocked"
    assert client.get(f"/approvals/{loan['id']}").json()["status"] == "pending"  # a blocked plan replaces nothing


def test_a_decided_plan_can_be_requested_again(client):
    a = client.post("/approvals", json=PAE).json()
    client.post(f"/approvals/{a['id']}/reject", json={"reason": "not today"})
    b = client.post("/approvals", json=PAE).json()
    assert b["id"] != a["id"] and b["status"] == "pending"


def test_agent_asking_again_after_the_idle_reset_keeps_the_opening_state(client):
    a = client.post("/approvals", json=PAE).json()
    client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"})
    now = datetime.now(timezone.utc)
    assert autoreset.reset_if_idle(now + timedelta(hours=1)) is True
    restored = client.get("/approvals").json()
    again = client.post("/approvals", json=PAE).json()  # the agent's run comes back with the same plan
    assert [x["id"] for x in client.get("/approvals").json()] == [restored[0]["id"]] == [again["id"]]
    assert autoreset.reset_if_idle(now + timedelta(hours=2)) is False  # still the opening state
