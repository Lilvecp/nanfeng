from sqlalchemy import update

from app.db import SessionLocal
from app.models import AuditEntry

FACTORING = {"action": "factoring INV-2026-118", "explanation": "Cherry Crisis plan",
             "operation": {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.5}}}


def clp_balance(client) -> float:
    return next(a["balance"] for a in client.get("/bank/accounts").json() if a["id"] == "ACC-CLP")


def test_health_and_seed(client):
    assert client.get("/health").json()["status"] == "ok"
    assert clp_balance(client) == 175_500_000
    assert len(client.get("/bank/receivables").json()) == 6


def test_small_payment_runs_automatically(client):
    r = client.post("/approvals", json={"action": "pay Cartonera Sur", "operation": {
        "op": "payment", "params": {"payee_id": "PAY-CARTONERA", "amount": 500_000}}})
    assert r.status_code == 201
    body = r.json()
    assert body["tier"] == 1 and body["status"] == "auto"
    assert body["result"]["audit_hash"]
    assert clp_balance(client) == 175_000_000


def test_financing_needs_otp_and_runs_once(client):
    appr = client.post("/approvals", json=FACTORING).json()
    assert appr["tier"] == 3 and appr["status"] == "pending"
    assert clp_balance(client) == 175_500_000

    bad = client.post(f"/approvals/{appr['id']}/approve", json={"otp": "000000"})
    assert bad.status_code == 403
    assert bad.json()["detail"]["attempts_left"] == 2

    ok = client.post(f"/approvals/{appr['id']}/approve", json={"otp": "482913"}).json()
    assert ok["status"] == "approved"
    assert ok["result"]["proceeds_clp"] > 0
    assert clp_balance(client) == 175_500_000 + ok["result"]["proceeds_clp"]

    again = client.post(f"/approvals/{appr['id']}/approve", json={"otp": "482913"})
    assert again.status_code == 409


def test_same_invoice_cannot_be_financed_twice(client):
    for _ in range(2):
        a = client.post("/approvals", json=FACTORING).json()
        last = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()
    assert last["status"] == "failed"
    assert last["note"].startswith("already_financed")


def test_otp_locks_after_three_failures(client):
    a = client.post("/approvals", json=FACTORING).json()
    codes = [client.post(f"/approvals/{a['id']}/approve", json={"otp": "111111"}).status_code for _ in range(3)]
    assert codes == [403, 403, 423]
    assert client.get(f"/approvals/{a['id']}").json()["status"] == "locked"


def test_reject_requires_reason(client):
    a = client.post("/approvals", json=FACTORING).json()
    assert client.post(f"/approvals/{a['id']}/reject", json={"reason": ""}).status_code == 422
    r = client.post(f"/approvals/{a['id']}/reject", json={"reason": "Too expensive"}).json()
    assert r["status"] == "rejected" and r["note"] == "Too expensive"


def test_kill_switch_blocks_everything(client):
    client.post("/policy/kill-switch", json={"on": True})
    r = client.post("/approvals", json={"action": "pay", "operation": {
        "op": "payment", "params": {"payee_id": "PAY-CARTONERA", "amount": 1000}}}).json()
    assert r["status"] == "blocked"
    assert clp_balance(client) == 175_500_000


def test_insufficient_funds_fails_cleanly(client):
    a = client.post("/approvals", json={"action": "huge payroll", "operation": {
        "op": "payment", "params": {"payee_id": "PAY-PAYROLL", "amount": 999_000_000}}}).json()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()
    assert r["status"] == "failed" and r["note"].startswith("insufficient_funds")
    assert clp_balance(client) == 175_500_000


def test_audit_chain_detects_tampering(client):
    client.post("/approvals", json=FACTORING)
    assert client.get("/audit/verify").json()["valid"] is True
    with SessionLocal() as db:
        db.execute(update(AuditEntry).where(AuditEntry.seq == 1).values(actor="mallory"))
        db.commit()
    v = client.get("/audit/verify").json()
    assert v["valid"] is False and v["broken_at_seq"] == 1


def test_anchor_and_inclusion_proof(client):
    import hashlib

    client.post("/approvals", json=FACTORING)
    anchor = client.post("/audit/anchor").json()
    assert anchor["from_seq"] == 1 and anchor["backend"] == "local"
    # the next anchor starts with the "audit.anchored" entry of this one, so anchors chain too
    assert client.post("/audit/anchor").json()["from_seq"] == anchor["to_seq"] + 1

    p = client.get("/audit/proof/2").json()
    node = bytes.fromhex(p["leaf"])
    for step in p["proof"]:
        sib = bytes.fromhex(step["hash"])
        node = hashlib.sha256(sib + node if step["position"] == "left" else node + sib).digest()
    assert node.hex() == anchor["merkle_root"]


def test_bank_log_export_is_jsonl(client):
    client.post("/approvals", json={"action": "pay", "operation": {
        "op": "payment", "params": {"payee_id": "PAY-FRIO", "amount": 2_000_000}}})
    r = client.get("/bank/logs")
    lines = r.text.strip().splitlines()
    assert r.headers["content-type"].startswith("application/x-ndjson")
    assert len(lines) == 1 and '"kind":"bank.payment"' in lines[0]


def test_agent_events_round_trip(client):
    e = client.post("/agent/events", json={"type": "agent.step", "data": {"tool": "forecast_run", "tier": 0}}).json()
    recent = client.get("/agent/events/recent", params={"after_id": e["id"] - 1}).json()
    assert recent[0]["type"] == "agent.step" and recent[0]["data"]["tool"] == "forecast_run"


def test_quant_proxy_reports_unreachable_engine(client):
    r = client.post("/quant/forecast", json={"scenario": "cherry_crisis"})
    assert r.status_code == 503
