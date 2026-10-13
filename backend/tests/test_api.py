from sqlalchemy import update

from app.db import SessionLocal
from app.seed import ACCOUNTS
from app.models import AuditEntry

OPENING = next(b for i, _, _, b in ACCOUNTS if i == "ACC-CLP")

FACTORING = {"action": "factoring INV-2026-118", "explanation": "Cherry Crisis plan",
             "operations": [{"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.5}}]}


def clp_balance(client) -> float:
    return next(a["balance"] for a in client.get("/bank/accounts").json() if a["id"] == "ACC-CLP")


def test_health_and_seed(client):
    assert client.get("/health").json()["status"] == "ok"
    assert clp_balance(client) == OPENING
    assert len(client.get("/bank/receivables").json()) == 6


def test_small_payment_runs_automatically(client):
    r = client.post("/approvals", json={"action": "pay Cartonera Sur", "operations": [{
        "op": "payment", "params": {"payee_id": "PAY-CARTONERA", "amount": 500_000}}]})
    assert r.status_code == 201
    body = r.json()
    assert body["tier"] == 1 and body["status"] == "auto"
    assert body["results"][0]["audit_hash"]
    assert clp_balance(client) == OPENING - 500_000


def test_financing_needs_otp_and_runs_once(client):
    appr = client.post("/approvals", json=FACTORING).json()
    assert appr["tier"] == 3 and appr["status"] == "pending"
    assert clp_balance(client) == OPENING

    bad = client.post(f"/approvals/{appr['id']}/approve", json={"otp": "000000"})
    assert bad.status_code == 403
    assert bad.json()["detail"]["attempts_left"] == 2

    ok = client.post(f"/approvals/{appr['id']}/approve", json={"otp": "482913"}).json()
    assert ok["status"] == "approved"
    assert ok["results"][0]["proceeds_clp"] > 0
    assert clp_balance(client) == OPENING + ok["results"][0]["proceeds_clp"]

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
    r = client.post("/approvals", json={"action": "pay", "operations": [{
        "op": "payment", "params": {"payee_id": "PAY-CARTONERA", "amount": 1000}}]}).json()
    assert r["status"] == "blocked"
    assert clp_balance(client) == OPENING


def test_insufficient_funds_fails_cleanly(client):
    a = client.post("/approvals", json={"action": "huge payroll", "operations": [{
        "op": "payment", "params": {"payee_id": "PAY-PAYROLL", "amount": 300_000_000}}]}).json()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()
    assert r["status"] == "failed" and r["note"].startswith("insufficient_funds")
    assert clp_balance(client) == OPENING


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
    client.post("/approvals", json={"action": "pay", "operations": [{
        "op": "payment", "params": {"payee_id": "PAY-FRIO", "amount": 2_000_000}}]})
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


def test_cherry_crisis_plan_executes_both_operations_and_anchors(client):
    plan = {"action": "factoring + CNY forward", "operations": [
        {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.6667}},
        {"op": "forward", "params": {"currency": "CNY", "notional": 1_200_000, "tenor_days": 60}},
    ]}
    a = client.post("/approvals", json=plan).json()
    assert a["tier"] == 3 and a["status"] == "pending"
    done = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()
    assert done["status"] == "approved" and len(done["results"]) == 2
    anchors = client.get("/audit/anchors").json()
    assert len(anchors) == 1 and anchors[0]["to_seq"] >= done["results"][1]["audit_seq"]
    assert client.get("/audit/verify").json()["valid"] is True


def test_partial_failure_reports_what_ran(client):
    plan = {"action": "forward then double factoring", "operations": [
        {"op": "forward", "params": {"currency": "CNY", "notional": 100_000, "tenor_days": 30}},
        {"op": "factoring", "params": {"receivable_id": "INV-2026-118"}},
        {"op": "factoring", "params": {"receivable_id": "INV-2026-118"}},
    ]}
    a = client.post("/approvals", json=plan).json()
    r = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()
    assert r["status"] == "failed" and len(r["results"]) == 2
    assert "already_financed" in r["note"] and "1-2 executed" in r["note"]


def test_cherry_crisis_pae_loan_from_the_quant_plan(client):
    """The exact body the quant engine produces (web/src/data/cherry-crisis.json approvalRequest)."""
    plan = {"action": "Pre-export loan in USD (PAE)", "operations": [
        {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}]}
    a = client.post("/approvals", json=plan).json()
    assert a["tier"] == 3 and a["status"] == "pending"
    done = client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()
    r = done["results"][0]
    assert done["status"] == "approved" and r["lender_id"] == "LEN-PAE" and r["annual_rate"] == 0.068
    assert clp_balance(client) == OPENING + r["proceeds_clp"]
    # Same cost as the engine's plan (CLP 2,106,329): 0.3% + the CLP 120,000 fixed fee, no stamp tax (exempt)
    assert r["fee_clp"] == round(140098568 * 0.003 + 120000, 2) and r["stamp_tax_clp"] == 0
    assert abs(r["cost_clp"] - 2106329) < 5


PAE_PLAN = {"action": "Pre-export loan in USD (PAE)", "operations": [
    {"op": "loan", "params": {"lender_id": "LEN-PAE", "amount_clp": 140098568, "term_days": 60}}]}


def test_two_simultaneous_approvals_execute_the_loan_once(client):
    """WhatsApp and the web approving the same plan 80 ms apart (seen on the deploy): one wins, the
    other gets 409, and the bank shows one loan whose balance matches."""
    from concurrent.futures import ThreadPoolExecutor

    a = client.post("/approvals", json=PAE_PLAN).json()
    go = lambda ch: client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913", "channel": ch})  # noqa: E731
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(r.status_code for r in pool.map(go, ["WA+OTP", "WEB+OTP"]))
    assert codes == [200, 409]
    loans = [line for line in client.get("/bank/logs").text.splitlines() if '"kind":"bank.loan"' in line]
    assert len(loans) == 1
    done = client.get(f"/approvals/{a['id']}").json()
    assert clp_balance(client) == OPENING + done["results"][0]["proceeds_clp"]


def test_approved_l3_entries_carry_their_tier_in_the_chain(client):
    a = client.post("/approvals", json=PAE_PLAN).json()
    client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"})
    entries = {e["kind"]: e for e in client.get("/audit/entries").json()}
    assert entries["approval.approved"]["payload"]["tier"] == 3
    assert entries["bank.loan"]["payload"]["tier"] == 3


def test_a_decided_approval_cannot_be_rejected_or_approved_again(client):
    a = client.post("/approvals", json=PAE_PLAN).json()
    assert client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).status_code == 200
    assert client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).status_code == 409
    assert client.post(f"/approvals/{a['id']}/reject", json={"reason": "late"}).status_code == 409


def test_parallel_wrong_codes_get_three_tries_in_total(client):
    """Guesses sent at the same time must not each see "3 attempts left": the attempt is reserved
    atomically before the code is compared (threat model F14)."""
    import threading

    appr = client.post("/approvals", json=FACTORING).json()
    codes = [f"{n:06d}" for n in range(100000, 100030)]
    statuses: list[int] = []

    def guess(code):
        statuses.append(client.post(f"/approvals/{appr['id']}/approve", json={"otp": code}).status_code)

    threads = [threading.Thread(target=guess, args=(c,)) for c in codes]
    [t.start() for t in threads]
    [t.join() for t in threads]

    assert statuses.count(403) <= 3  # a wrong code was really compared at most three times
    final = client.get(f"/approvals/{appr['id']}").json()
    assert final["status"] == "locked" and final["otp_attempts_left"] == 0
    # once locked, even the right code is refused and nothing executes
    assert client.post(f"/approvals/{appr['id']}/approve", json={"otp": "482913"}).status_code in (409, 423)
    assert clp_balance(client) == OPENING
