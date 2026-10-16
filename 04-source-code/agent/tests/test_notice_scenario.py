"""The notice drives the plan: the delay the importer announces (new due date − due date) is what the
quant engine sees, and the plan the owner gets is honest about what it can and cannot do."""

import copy
import sys

import pytest
from conftest import ROOT, _result, _scenario

from nanfeng_agent import fixtures
from nanfeng_agent.ingest import Document
from nanfeng_agent.tools import scenario_from_notice

QUANT_PATHS = ("/quant/forecast", "/quant/quote", "/quant/plan/jobs")


def _notice(new_due: str, doc_id: str = "DOC-NOTICE") -> Document:
    return Document(fixtures.SHANGHAI_NOTICE.replace("2027-02-01", new_due), source="email", doc_id=doc_id)


def _sent_scenarios(backend) -> dict[str, object]:
    return {path: body["scenario"] for path, body in backend.quant_calls if path in QUANT_PATHS}


def _delays(scen: dict) -> dict[str, int]:
    return {r["id"]: r["announced_delay_days"] for r in scen["receivables"]}


def test_45_day_notice_sends_the_canonical_scenario(agent, backend):
    run = agent.handle_document(fixtures.shanghai_notice())
    sent = _sent_scenarios(backend)
    assert set(sent) == set(QUANT_PATHS)
    base = _scenario("cherry_crisis")
    for scen in sent.values():
        assert isinstance(scen, dict)
        assert _delays(scen) == {r["id"]: 45 if r["id"] == "INV-2026-118" else 0 for r in base["receivables"]}
        # Nothing but the announced delays changes.
        assert {k: v for k, v in scen.items() if k != "receivables"} == {k: v for k, v in base.items() if k != "receivables"}
    # The planner (an LLM when online) only ever names the scenario id.
    assert {s.args.get("scenario") for s in run.plan.steps if "scenario" in s.args} == {"cherry_crisis"}
    assert any(s["tool"] == "quant.scenario" and s["detail"] == "INV-2026-118 +45 days" for s in run.steps)
    assert run.status == "awaiting_approval"


@pytest.mark.parametrize(("new_due", "delay"), [("2027-03-18", 90), ("2028-06-01", 180), ("2026-12-01", 0)])
def test_notice_delay_is_new_due_date_minus_due_date_clamped(agent, backend, new_due, delay):
    run = agent.handle_document(_notice(new_due))
    for scen in _sent_scenarios(backend).values():
        assert _delays(scen)["INV-2026-118"] == delay
        assert sum(_delays(scen).values()) == delay
    alert = next((d for d in agent.hub.outbox if d.message.kind == "alert"), None)
    assert alert is None or f"{delay} days late" in alert.message.text
    assert run.scenario_obj is not None


def test_notice_without_a_known_invoice_keeps_the_scenario_id():
    base = _scenario("cherry_crisis")
    assert scenario_from_notice(base, {"invoice_number": "INV-9999", "new_due_date": "2027-02-01"})[0] is None
    assert scenario_from_notice(base, {"invoice_number": "INV-2026-118"})[0] is None
    assert scenario_from_notice(base, {"invoice_number": "INV-2026-118", "new_due_date": "soon"})[0] is None
    assert base == _scenario("cherry_crisis")  # the base is never modified


def test_other_documents_use_the_scenario_id(agent, backend):
    agent.handle_document(Document("From: Logística Express Global Ltda\nFactura N° 77 · Total CLP 5.000.000\n",
                                   source="whatsapp"))
    assert all(isinstance(s, str) for s in _sent_scenarios(backend).values())
    assert not any(p.startswith("/quant/scenarios/") for p, _ in backend.quant_calls)


def test_eligible_count_leaves_the_forward_out(agent):
    run = agent.handle_document(fixtures.shanghai_notice())
    step = next(s for s in run.steps if s["tool"] == "financing_quote")
    assert step["detail"].startswith("9 options, 7 eligible")  # the CNY forward is a hedge, not cash


# --- guards on the optimizer's answer ------------------------------------------------------------

def test_plan_with_only_unsupported_operations_is_not_proposed(agent, backend, hub):
    plan = _result("plan")
    req = plan["approval_request"]
    req["unsupported"], req["operations"] = [{"op": "confirming", "params": {}}], []
    backend.plan_result = plan
    run = agent.handle_document(fixtures.shanghai_notice())

    assert run.approvals == [] and run.status == "completed"
    step = next(s for s in run.steps if s["tool"] == "propose_plan")
    assert step["detail"].startswith("nothing proposed") and "confirming" in step["detail"]
    msg = next(d for d in hub.outbox if d.message.kind == "plan_none").message.text
    assert "not proposing" in msg and "confirming" in msg
    assert not any(d.message.kind in ("plan", "approval") for d in hub.outbox)


def test_plan_with_no_operations_is_not_proposed(agent, backend, hub):
    plan = _result("plan")
    plan["optimal"]["actions"], plan["approval_request"]["operations"] = [], []
    plan["optimal"]["total_cost_clp"] = 0
    backend.plan_result = plan
    run = agent.handle_document(fixtures.shanghai_notice())
    assert run.approvals == [] and run.status == "completed"
    assert any(d.message.kind == "plan_none" for d in hub.outbox)


def test_partially_unsupported_plan_is_not_proposed_by_halves(agent, backend):
    plan = _result("plan")
    plan["approval_request"]["unsupported"] = [{"op": "confirming", "params": {}}]
    backend.plan_result = plan
    assert agent.handle_document(fixtures.shanghai_notice()).approvals == []


def test_optimal_dearer_than_the_bank_loan_proposes_the_bank_loan(agent, backend, hub, client):
    plan = _result("plan")
    plan["optimal"]["total_cost_clp"] = plan["default"]["total_cost_clp"] + 1
    plan["savings_pct"] = -0.01
    backend.plan_result = plan
    run = agent.handle_document(fixtures.shanghai_notice())

    [appr] = run.approvals
    assert appr["status"] == "pending" and appr["tier"] == 3
    lenders = {lender["id"]: lender["name"] for lender in client.get("/bank/lenders").json()}
    assert appr["operations"] == [
        {"op": "loan", "params": {"lender_id": "LEN-ANDINO", "amount_clp": a["amount_clp"], "term_days": a["term_days"]}}
        for a in plan["default"]["actions"]]
    assert "Working capital loan" in lenders["LEN-ANDINO"]
    msg = next(d for d in hub.outbox if d.message.kind == "plan_default").message.text
    assert "cheaper" not in msg.replace("nothing cheaper", "") and "found nothing cheaper" in msg
    assert not any(d.message.kind == "plan" for d in hub.outbox)


def test_why_answer_claims_no_savings_for_the_bank_loan(agent, backend):
    from nanfeng_agent import explain

    plan = _result("plan")
    plan["optimal"]["total_cost_clp"] = plan["default"]["total_cost_clp"] + 1
    backend.plan_result = plan
    run = agent.handle_document(fixtures.shanghai_notice())
    text = explain.answer("why this plan?", run)["answer"]
    assert "usual bank loan" in text and "claim no savings" in text and "% cheaper" not in text


# --- the real engine, when it is installed (Vicente's venv): the golden numbers -----------------

@pytest.fixture()
def quant_tools():
    pytest.importorskip("numpy")
    sys.path.insert(0, str(ROOT / "vicente-rodriguez"))
    try:
        from nanfeng_quant import tools
    except ImportError as exc:  # pragma: no cover - engine deps missing
        pytest.skip(f"quant engine unavailable: {exc}")
    return tools


def _engine_scenario(tools, new_due: str) -> dict:
    base = tools.load_scenario("cherry_crisis").to_dict()  # what GET /quant/scenarios/cherry_crisis returns
    scen, _ = scenario_from_notice(copy.deepcopy(base), {"invoice_number": "INV-2026-118", "new_due_date": new_due})
    return scen


def test_real_engine_45_day_notice_reproduces_the_story(quant_tools):
    story = _result("story")
    scen = _engine_scenario(quant_tools, "2027-02-01")
    s = quant_tools.forecast_run(scen, explain=False)["summary"]
    assert s["prob_negative_by_crunch_day"] == story["forecast_after"]["prob_negative_by_crunch"]
    assert s["crunch_date"] == story["forecast_after"]["crunch_date"]
    p = quant_tools.optimize_plan(scen, explain=False)
    assert [a["summary"] for a in p["optimal"]["actions"]] == [a["summary"] for a in story["plan"]["actions"]]
    assert round(p["optimal"]["total_cost_clp"]) == story["plan"]["cost_clp"] == 2106329
    assert round(p["default"]["total_cost_clp"]) == story["plan"]["default_cost_clp"] == 3796513
    assert p["approval_request"]["operations"] == story["approval_request"]["operations"]


def test_real_engine_90_day_notice_gives_another_plan(quant_tools):
    story = _result("story")
    p = quant_tools.optimize_plan(_engine_scenario(quant_tools, "2027-03-18"), explain=False)
    assert p["approval_request"]["operations"] != story["approval_request"]["operations"]
    assert round(p["optimal"]["total_cost_clp"]) != story["plan"]["cost_clp"]
    assert p["optimal"]["total_cost_clp"] < p["default"]["total_cost_clp"]
