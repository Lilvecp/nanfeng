"""A customer's late-payment notice makes the agent borrow (45 days late = a CLP 140M loan), so the sender
is checked against the customer's domain on file even though the notice carries no bank account.
Red team BEC-09 attacks the same check straight at the API."""

from nanfeng_agent import fixtures
from nanfeng_agent.ingest import Document


def _spoof(sender: str) -> Document:
    return Document(fixtures.SHANGHAI_NOTICE, source="email", sender_domain=sender, doc_id="DOC-SPOOF")


def test_the_real_notice_from_the_domain_on_file_still_runs_the_plan(agent):
    run = agent.handle_document(fixtures.shanghai_notice())
    pi = run.planner_input
    assert pi.customer_id == "C-SHA" and pi.payee_check.verdict == "skipped" and not pi.blocked
    assert "security.check_payee" in [s["tool"] for s in run.steps]  # the sender was checked
    assert run.status == "awaiting_approval"


def test_notice_from_a_lookalike_domain_is_blocked(agent, client):
    appr0, tx0 = client.get("/approvals").json(), client.get("/bank/transactions").json()
    run = agent.handle_document(_spoof("ap@hongxin-fruit.co"))
    pi = run.planner_input
    assert pi.blocked and pi.payee_check.verdict == "malicious" and "domain-mismatch" in pi.payee_check.rules
    assert run.status == "blocked" and pi.customer_id is None
    assert client.get("/approvals").json() == appr0 and client.get("/bank/transactions").json() == tx0
    kinds = [e["kind"] for e in client.get("/audit/entries", params={"limit": 1000}).json()]
    assert "security.attack_blocked" in kinds


def test_notice_from_another_domain_is_not_the_customer(agent, client, hub):
    appr0 = client.get("/approvals").json()
    run = agent.handle_document(_spoof("hongxin.ap@gmail.com"))
    pi = run.planner_input
    assert pi.payee_check.verdict == "suspicious" and not pi.blocked
    assert pi.customer_id is None  # read-only: no loan proposed, no reminder to the real customer
    assert client.get("/approvals").json() == appr0
    assert not any(d.message.kind == "collection" for d in hub.outbox)
