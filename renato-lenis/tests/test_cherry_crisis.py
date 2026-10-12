"""Cherry Crisis end to end (r2-09, r2-10): every scenario task of the agent has a test here."""

import json

from conftest import SANDBOX_OTP, _result

from nanfeng_agent import fixtures


def _events(client, type_=None):
    evs = client.get("/agent/events/recent", params={"limit": 500}).json()
    return [e for e in evs if type_ is None or e["type"] == type_]


def test_shanghai_notice_runs_forecast_plan_and_waits_for_owner(agent, backend, client, hub):
    run = agent.handle_document(fixtures.shanghai_notice())

    assert run.status == "awaiting_approval"
    pi = run.planner_input
    assert pi.fields["doc_type"] == "payment_notice"
    assert pi.fields["invoice_number"] == "INV-2026-118"
    assert pi.fields["currency"] == "USD" and float(pi.fields["amount"]) == 180000
    assert pi.fields["new_due_date"] == "2027-02-01"
    assert pi.customer_id == "C-SHA" and pi.payee_check.verdict == "skipped"

    tools = [s["tool"] for s in run.steps]
    for t in ("security.scan", "quarantine.extract", "forecast_run", "financing_quote", "optimize_plan",
              "propose_plan", "send_collection"):
        assert t in tools, t

    # The approval is exactly the MILP's approval_request, and the policy engine made it L3.
    [appr] = run.approvals
    expected = _result("plan")["approval_request"]
    assert appr["status"] == "pending" and appr["tier"] == 3
    assert appr["operations"] == [{"op": o["op"], "params": o["params"]} for o in expected["operations"]]

    # Owner: alert, plan and approval on WhatsApp in Spanish; the importer gets the reminder in Chinese.
    kinds = [(d.channel, d.message.kind, d.message.language) for d in hub.outbox]
    assert ("whatsapp", "alert", "es") in kinds and ("whatsapp", "approval", "es") in kinds
    assert ("wecom", "collection", "zh") in kinds
    alert = next(d for d in hub.outbox if d.message.kind == "alert").message.text
    assert "81%" in alert and "45 días" in alert and "2026-12-30" in alert
    approval_msg = next(d for d in hub.outbox if d.message.kind == "approval").message.text
    assert SANDBOX_OTP not in approval_msg  # the agent never carries the code

    # Mission Control saw every step.
    steps = [e["data"] for e in _events(client, "agent.step") if e["data"].get("run_id") == run.id]
    assert {"forecast_run", "optimize_plan", "propose_plan"} <= {s["tool"] for s in steps}
    assert all(e["source"] == "agent" for e in _events(client, "agent.step"))


def test_owner_approves_then_agent_resumes_anchors_and_confirms(agent, client, owner, hub):
    run = agent.handle_document(fixtures.shanghai_notice())
    appr_id = run.approvals[0]["id"]

    # The agent cannot approve its own request, even with the right code.
    r = client.post(f"/approvals/{appr_id}/approve", json={"otp": SANDBOX_OTP},
                    headers={"Authorization": f"Bearer {agent.backend.token}"})
    assert r.status_code in (401, 403)
    assert agent.resume(run.id).status == "awaiting_approval"

    r = client.post(f"/approvals/{appr_id}/approve", json={"otp": SANDBOX_OTP, "channel": "WA+OTP"}, headers=owner)
    assert r.status_code == 200 and r.json()["status"] == "approved"

    run = agent.resume_approval(appr_id)
    assert run.status == "completed"
    assert run.approvals[0]["status"] == "approved"
    assert any(d.message.kind == "approved" for d in hub.outbox)
    assert client.get("/audit/verify").json()["valid"] is True
    assert client.get("/audit/anchors").json(), "the approved plan was anchored"


def test_owner_rejects(agent, client, owner, hub):
    run = agent.handle_document(fixtures.shanghai_notice())
    appr_id = run.approvals[0]["id"]
    client.post(f"/approvals/{appr_id}/reject", json={"reason": "prefer factoring"}, headers=owner)
    run = agent.resume(run.id)
    assert run.status == "completed"
    msg = next(d for d in hub.outbox if d.message.kind == "rejected").message.text
    assert "prefer factoring" in msg


def test_bec_invoice_1031_is_blocked_and_owner_alerted_out_of_band(agent, client, hub):
    before = client.get("/approvals").json()
    run = agent.handle_document(fixtures.bec_invoice())

    assert run.status == "blocked"
    pi = run.planner_input
    assert {"doc-instruction", "hidden-text"} <= set(pi.guard.rules)
    assert {"bank-change", "domain-mismatch"} <= set(pi.payee_check.rules)
    assert pi.fields == {} and run.plan is None
    assert client.get("/approvals").json() == before  # no approval was created

    [alert] = [d for d in hub.outbox if d.message.kind == "blocked"]
    assert alert.channel != "email"  # the attack came by email
    assert "+56229876543" in alert.message.text  # call-back number on file, never the document's
    kinds = {e["type"] for e in _events(client)}
    assert "security.attack_blocked" in kinds


def test_planner_never_sees_document_text(agent):
    seen = []
    original = agent.planner.plan
    agent.planner.plan = lambda pi, scenario: seen.append(pi) or original(pi, scenario)

    agent.handle_document(fixtures.shanghai_notice())
    dumped = json.dumps(seen[0].model_dump(mode="json"), ensure_ascii=False)
    for fragment in ("customs inspection", "上海海关", "Best regards", "Dear Huerto"):
        assert fragment not in dumped
    assert seen[0].provenance == "untrusted:email"


def test_clean_supplier_invoice_runs_within_limits(agent, hub):
    run = agent.handle_document(fixtures.cartonera_invoice())
    assert run.status == "completed"
    [appr] = run.approvals
    assert appr["status"] == "auto" and appr["tier"] == 1
    assert appr["operations"][0]["params"]["payee_id"] == "PAY-CARTONERA"
    assert appr["operations"][0]["params"]["amount"] == 820000
    assert any(d.message.kind == "auto_done" for d in hub.outbox)


def test_unknown_supplier_never_gets_paid(agent):
    from nanfeng_agent.ingest import Document

    doc = Document("From: Logística Express Global Ltda\nFactura N° 77 · Total CLP 5.000.000\n", source="whatsapp")
    run = agent.handle_document(doc)
    assert run.status == "completed"
    assert run.approvals == []
    assert run.planner_input.payee_check.verdict == "suspicious"
    assert "schedule_payment" not in [s["tool"] for s in run.steps]


def test_kill_switch_stops_before_any_step(agent, client, owner, hub):
    client.post("/policy/kill-switch", json={"on": True}, headers=owner)
    run = agent.handle_document(fixtures.shanghai_notice())
    assert run.status == "halted"
    assert run.approvals == []
    assert any(d.message.kind == "halted" for d in hub.outbox)


def test_kill_switch_mid_run_stops_before_money_moves(agent, backend, client, owner):
    """The switch is checked before every step, not only before money moves."""
    original = backend.plan

    def plan_then_stop(*a, **kw):
        res = original(*a, **kw)
        client.post("/policy/kill-switch", json={"on": True}, headers=owner)
        return res

    backend.plan = plan_then_stop
    run = agent.handle_document(fixtures.shanghai_notice())
    assert run.status == "halted"
    assert run.approvals == []
    assert "propose_plan" not in [s["tool"] for s in run.steps]


def test_no_risk_means_no_financing(agent, backend):
    calm = _result("forecast")
    calm["summary"] = {**calm["summary"], "prob_negative_by_crunch_day": 0.01, "prob_negative_cash_horizon": 0.02}
    backend.forecast = calm
    run = agent.handle_document(fixtures.shanghai_notice())
    assert run.status == "completed"
    assert run.approvals == []
    skipped = [s["tool"] for s in run.steps if s["status"] == "skipped"]
    assert skipped == ["financing_quote", "optimize_plan", "propose_plan"]


def test_daily_briefing_in_three_languages(agent, hub):
    texts = {}
    for lang in ("es", "en", "zh"):
        out = agent.briefing(lang)
        assert out["run"]["status"] == "completed"
        assert out["delivery"]["channel"] == "voice"
        texts[lang] = out["text"]
    assert "81%" in texts["es"] and "Buenos días" in texts["es"]
    assert "Good morning" in texts["en"] and "2026-12-30" in texts["en"]
    assert "早上好" in texts["zh"]
    assert "plan" in texts["en"]  # at risk: tells the owner a plan is waiting


def test_spoofed_notice_cannot_leak_another_customers_invoice(agent, hub):
    """A notice 'from Shanghai' citing Guangzhou's invoice: no reminder goes to Shanghai about it."""
    from nanfeng_agent.ingest import Document

    text = fixtures.SHANGHAI_NOTICE.replace("INV-2026-118", "INV-2026-121")
    run = agent.handle_document(Document(text, source="email", doc_id="DOC-SPOOF"))
    assert not any(d.message.kind == "collection" for d in hub.outbox)
    failed = [s for s in run.steps if s["tool"] == "send_collection"]
    assert failed and failed[0]["status"] == "failed" and "does not belong" in failed[0]["detail"]
    assert run.status == "awaiting_approval"  # the cash plan still reaches the owner
