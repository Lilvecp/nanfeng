"""Demo Mode replay: the six Cherry Crisis steps happen for real on the backend (fe-10)."""

from app.config import get_settings

PLAN = {"action": "Pre-export loan in USD (PAE)", "channel": "WEB", "explanation": "MILP plan", "operations": [
    {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}]}
STEP = {"step": "Re-ran 10,000 scenarios", "tool": "forecast_run", "tier": 0, "model": "Monte Carlo", "detail": "81% · day 19"}


def play(client, n, **body):
    return client.post(f"/demo/step/{n}", json=body)


def test_full_replay_creates_executes_and_reports(client):
    seen = client.get("/agent/events/recent", params={"limit": 500}).json()
    start = seen[-1]["id"] if seen else 0  # the event history is shared across tests
    for n in range(1, 7):
        r = play(client, n, agent_steps=[STEP], plan=PLAN if n in (4, 5) else None)
        assert r.status_code == 200, (n, r.text)
        if n == 4:
            assert r.json()["approval"]["status"] == "pending" and r.json()["approval"]["tier"] == 3
        if n == 5:
            assert r.json()["approval"]["status"] == "approved" and r.json()["approval"]["audit_hashes"]
    events = client.get("/agent/events/recent", params={"after_id": start, "limit": 500}).json()
    types = [e["type"] for e in events]
    assert "sandbox.reset" in types and "approval.requested" in types and "approval.approved" in types
    assert [e["data"]["demo_step"] for e in events if e["type"] == "agent.step"][-6:] == [1, 2, 3, 4, 5, 6]
    assert all(e["source"] == "agent-replay" for e in events if e["type"] == "agent.step")
    assert client.get("/audit/verify").json()["valid"] is True


def test_step_one_resets_for_a_clean_take(client):
    for n in (1, 4, 5):
        play(client, n, plan=PLAN)
    assert play(client, 1).status_code == 200
    assert client.get("/approvals").json() == []  # back to the opening state


def test_steps_are_safe_to_replay(client):
    play(client, 1)
    a = play(client, 4, plan=PLAN).json()["approval"]["id"]
    assert play(client, 4, plan=PLAN).json()["approval"]["id"] == a  # no duplicate request
    play(client, 5, plan=PLAN)
    assert play(client, 5, plan=PLAN).json()["approval"]["status"] == "approved"  # no double execution
    assert len(client.get("/bank/transactions").json()) == 1


def test_approve_before_plan_is_refused(client):
    play(client, 1)
    assert play(client, 5, plan=PLAN).status_code == 409


def test_owner_only_and_demo_only(client, anon, monkeypatch):
    assert anon.post("/demo/step/1", json={}).status_code == 401
    monkeypatch.setattr(get_settings(), "demo", False)
    assert play(client, 1).status_code == 404
