"""What the jury sees on the live deploy: one execution per approval, the morning's attack and the
L3 tier in the chain, and a shared sandbox that goes back to the crisis on its own."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app import autoreset
from app.db import SessionLocal
from app.models import Approval, utcnow

PLAN = {"action": "Pre-export loan in USD (PAE)", "channel": "WEB", "explanation": "MILP plan", "operations": [
    {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}]}


def entries(client):
    return client.get("/audit/entries", params={"limit": 1000}).json()


def test_seeded_chain_holds_the_0847_attack_with_real_rules(client):
    blocked = [e for e in entries(client) if e["kind"] == "security.attack_blocked"]
    assert {e["payload"]["check"] for e in blocked} == {"scan", "payee"}
    rules = {r for e in blocked for r in e["payload"]["rules"]}
    assert {"doc-instruction", "hidden-text", "bank-change", "domain-mismatch"} <= rules
    assert all(e["payload"]["doc_id"] == "SEC-0038" for e in blocked)


def test_loan_disbursement_is_recorded_as_the_l3_action_it_is(client):
    a = client.post("/approvals", json=PLAN).json()
    client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"})
    loans = [e for e in entries(client) if e["kind"] == "bank.loan"]
    assert len(loans) == 1
    assert loans[0]["payload"]["tier"] == 3 and loans[0]["payload"]["approval_id"] == a["id"]


def test_an_approval_already_being_decided_never_runs_twice(client):
    a = client.post("/approvals", json=PLAN).json()
    with SessionLocal() as db:  # another request claimed it a moment ago and is executing it
        db.execute(update(Approval).where(Approval.id == a["id"]).values(decided_at=utcnow()))
        db.commit()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"})
    assert r.status_code == 409
    assert not [e for e in entries(client) if e["kind"] == "bank.loan"]


def test_demo_step_five_after_the_owner_approved_on_screen_executes_once(client):
    for n in (1, 4):
        client.post(f"/demo/step/{n}", json={"plan": PLAN})
    appr = client.get("/approvals").json()[0]
    client.post(f"/approvals/{appr['id']}/approve", json={"otp": "482913", "channel": "WEB+OTP"})
    r = client.post("/demo/step/5", json={"plan": PLAN})
    assert r.status_code == 200 and r.json()["approval"]["status"] == "approved"
    assert len([e for e in entries(client) if e["kind"] == "bank.loan"]) == 1


def test_idle_sandbox_goes_back_to_the_crisis(client):
    a = client.post("/approvals", json=PLAN).json()
    client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"})
    now = datetime.now(timezone.utc)
    assert autoreset.reset_if_idle(now) is False  # just used: never interrupt a take
    assert autoreset.reset_if_idle(now + timedelta(hours=1)) is True
    approvals = client.get("/approvals").json()
    assert len(approvals) == 1 and approvals[0]["status"] == "pending" and approvals[0]["action"] == PLAN["action"]
    kinds = {e["kind"] for e in entries(client)}
    assert "bank.loan" not in kinds and "security.attack_blocked" in kinds
    assert autoreset.reset_if_idle(now + timedelta(hours=2)) is False  # opening state: nothing to undo


def test_idle_reset_restores_the_agents_plan_not_a_request_typed_by_hand(client):
    """An evidence run (or a visitor with the demo password) asks the owner to approve something else
    after the agent's plan: the next visitor still starts from the agent's plan."""
    from app.config import get_settings

    agent = {"Authorization": f"Bearer {get_settings().agent_token}"}
    assert client.post("/approvals", json=PLAN, headers=agent).status_code == 201
    other = {"action": "factor INV-2026-109 elsewhere", "operations": [
        {"op": "factoring", "params": {"receivable_id": "INV-2026-109", "lender_id": "LEN-FINTECH", "share": 0.5}}]}
    o = client.post("/approvals", json=other).json()  # the signed-in owner
    client.post(f"/approvals/{o['id']}/approve", json={"otp": "482913"})
    now = datetime.now(timezone.utc)
    assert autoreset.reset_if_idle(now + timedelta(hours=1)) is True
    [restored] = client.get("/approvals").json()
    assert restored["action"] == PLAN["action"] and restored["status"] == "pending"
