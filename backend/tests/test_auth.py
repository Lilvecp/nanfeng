"""Owner sign-in and the routes it protects (threat model F1, red team API-02 / API-03)."""

from app import auth
from app.config import DEMO_OWNER_PASSWORD, get_settings

import os

OWNER_PASSWORD = os.environ["NANFENG_OWNER_PASSWORD"]

PLAN = {"action": "Pre-export loan in USD (PAE)", "operations": [
    {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}]}


def test_login_gives_a_session_and_wrong_password_does_not(anon):
    assert anon.post("/auth/login", json={"password": "nope"}).status_code == 401
    r = anon.post("/auth/login", json={"password": OWNER_PASSWORD}).json()
    me = anon.get("/auth/me", headers={"Authorization": f"Bearer {r['token']}"}).json()
    assert me["owner"] is True and me["expires_at"] == r["expires_at"]
    assert anon.get("/auth/me").json()["owner"] is False


def test_failed_logins_are_rate_limited(anon):
    codes = [anon.post("/auth/login", json={"password": f"guess-{i}"}).status_code for i in range(6)]
    assert codes[:5] == [401] * 5 and codes[5] == 429
    # even the right password waits once the limit is hit
    assert anon.post("/auth/login", json={"password": OWNER_PASSWORD}).status_code == 429


def test_tampered_expired_or_revoked_sessions_are_refused(client, anon):
    token = client.headers["Authorization"].removeprefix("Bearer ")
    v, exp, nonce, sig = token.split(".")
    for bad in (f"{v}.{int(exp) + 9999}.{nonce}.{sig}", f"{v}.{exp}.{nonce}.{'0' * 64}", "garbage"):
        assert anon.get("/auth/me", headers={"Authorization": f"Bearer {bad}"}).json()["owner"] is False
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").json()["owner"] is False


def test_api02_anonymous_cannot_touch_the_kill_switch(client, anon):
    assert anon.post("/policy/kill-switch", json={"on": True}).status_code == 401
    client.post("/policy/kill-switch", json={"on": True})
    assert anon.post("/policy/kill-switch", json={"on": False, "otp": "482913"}).status_code == 401
    assert anon.get("/policy/kill-switch").json() == {"on": True}


def test_rearming_needs_a_correct_code(client):
    client.post("/policy/kill-switch", json={"on": True})
    assert client.post("/policy/kill-switch", json={"on": False, "otp": "000000"}).status_code == 403
    assert client.get("/policy/kill-switch").json() == {"on": True}


def test_api03_anonymous_cannot_reset_and_production_has_no_reset(client, anon, monkeypatch):
    assert anon.post("/bank/reset").status_code == 401
    assert client.post("/bank/reset").json() == {"reset": True}
    monkeypatch.setattr(get_settings(), "demo", False)
    assert client.post("/bank/reset").status_code == 404


def test_anonymous_cannot_approve_reject_or_resend(client, anon):
    a = client.post("/approvals", json=PLAN).json()
    assert anon.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).status_code == 401
    assert anon.post(f"/approvals/{a['id']}/reject", json={"reason": "not me"}).status_code == 401
    assert anon.post(f"/approvals/{a['id']}/otp").status_code == 401
    assert client.get(f"/approvals/{a['id']}").json()["status"] == "pending"
    assert client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()["status"] == "approved"


def test_agent_token_is_never_an_owner_session(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "agent_token", "agent-secret")
    agent = {"Authorization": "Bearer agent-secret"}
    a = client.post("/approvals", json=PLAN, headers=agent).json()
    assert client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}, headers=agent).status_code == 403
    assert client.post("/bank/reset", headers=agent).status_code == 403


def test_demo_password_is_only_shown_in_demo_builds_that_use_it(anon, monkeypatch):
    assert anon.get("/auth/config").json() == {"demo_password": None}  # tests use their own password
    monkeypatch.setattr(get_settings(), "owner_password", DEMO_OWNER_PASSWORD)
    assert anon.get("/auth/config").json() == {"demo_password": DEMO_OWNER_PASSWORD}
    monkeypatch.setattr(get_settings(), "demo", False)
    assert auth.demo_hint() is None
