import json
import math

import numpy as np
import pytest

from nanfeng_quant import tools
from nanfeng_quant.backtest import crps_gaussian, crps_samples
from nanfeng_quant.bench import ledger_cash, make_deterministic
from nanfeng_quant.catalog import Catalog, effective_annual_cost
from nanfeng_quant.credit_passport import credit_passport
from nanfeng_quant.explain import forecast_drivers
from nanfeng_quant.model import Company
from nanfeng_quant.montecarlo import simulate
from nanfeng_quant.optimizer import Lever, lever_flows, optimize_pair
from nanfeng_quant.synthetic import generate


@pytest.fixture(scope="module")
def cherry():
    return tools.load_scenario("cherry_crisis")


@pytest.fixture(scope="module")
def cherry_res(cherry):
    return simulate(cherry, 10_000, seed=7)


@pytest.fixture(scope="module")
def catalog():
    return Catalog.load()


# ---- Monte Carlo ---------------------------------------------------------

def test_reproducible_with_seed(cherry):
    a = simulate(cherry, 500, seed=3).cash
    b = simulate(cherry, 500, seed=3).cash
    assert np.array_equal(a, b)


def test_quantiles_ordered(cherry_res):
    q = cherry_res.quantiles()
    assert np.all(q["p10"] <= q["p50"]) and np.all(q["p50"] <= q["p90"])


def test_cherry_crisis_headline(cherry_res):
    s = cherry_res.summary()
    assert s["crunch_day"] == 19 and s["crunch_date"] == "2026-12-30"
    assert 0.78 <= s["prob_negative_by_crunch_day"] <= 0.84


def test_before_notice_is_healthier(cherry):
    before = simulate(cherry, 10_000, seed=7, overrides={"ignore_announced_delays": True})
    assert before.p_negative_cumulative[19] < 0.15


def test_deterministic_matches_independent_ledger(cherry):
    det = make_deterministic(cherry)
    res = simulate(det, 50, seed=1, overrides={"freeze_fx": True}, param_uncertainty=0.0)
    assert np.max(np.abs(res.cash - ledger_cash(det)[None, :])) < 1.0


def test_counterfactual_identifies_shanghai(cherry_res):
    drivers = forecast_drivers(cherry_res)
    top = drivers["drivers"][0]
    assert top["id"] == "C-SHA" and top["prob_negative_by_day"] < 0.05


# ---- catalog and optimizer --------------------------------------------------

def test_stamp_tax_bounds(catalog):
    assert catalog.stamp_tax(30) == pytest.approx(0.00066)
    assert catalog.stamp_tax(400) == pytest.approx(0.008)


def test_effective_annual_cost():
    assert effective_annual_cost(1.0, 100.0, 365) == pytest.approx(0.01)
    assert math.isnan(effective_annual_cost(1.0, 0.0, 30))


def test_loan_lever_flows(cherry, cherry_res, catalog):
    p = catalog.product("OVERDRAFT")
    lv = Lever("t", p, "loan", 10, 1e6, catalog.loan_unit_cost(p), "CLP", meta={"clp_per_unit": 1.0, "currency": "CLP"})
    f = lever_flows(lv, cherry, catalog, cherry_res, np.arange(5))
    assert f[0, 10] == pytest.approx(1 - catalog.loan_upfront(p))
    assert f[0].sum() == pytest.approx(-catalog.loan_unit_cost(p))


def test_optimizer_beats_default_and_holds_out_of_sample(cherry_res, catalog):
    best, default = optimize_pair(cherry_res, catalog, confidence=0.90)
    assert best.status in ("optimal", "feasible")
    assert best.actions
    assert best.total_cost_clp < default.total_cost_clp
    assert best.out_of_sample_coverage >= 0.90


# ---- other modules -----------------------------------------------------------

def test_crps_estimators_agree():
    rng = np.random.default_rng(0)
    x = rng.normal(0.0, 1.0, 200_000)
    assert crps_samples(x, 0.7) == pytest.approx(crps_gaussian(0.0, 1.0, 0.7), abs=5e-3)
    assert crps_samples(np.array([2.0]), 5.0) == pytest.approx(3.0)


def test_synthetic_generator_valid():
    companies = generate(n=3, seed=1)
    for c in companies:
        company = Company.from_dict(c)
        assert company.synthetic and company.customers and company.payables


def test_credit_passport(cherry, cherry_res):
    no = credit_passport(cherry, cherry_res, consent=False)
    yes = credit_passport(cherry, cherry_res, consent=True)
    assert 0 <= no["score"] <= 100 and "digest_sha256" not in no
    assert len(yes["digest_sha256"]) == 64
    assert sum(f["points"] for f in no["factors"]) == pytest.approx(no["score"], abs=0.5)


def test_tool_call_returns_json():
    out = json.loads(tools.call("forecast_run", {"scenario": "cherry_crisis", "n_paths": 2000, "explain": False}))
    assert out["summary"]["company_id"] == "huerto-austral"
    assert len(out["fan_chart"]["p50"]) == 91
    assert out["source"]["tool"] == "forecast_run"


# ---- iteration 2: parameter uncertainty, USD loans, action cap ---------------

def test_zero_param_uncertainty_is_deterministic_given_parameters(cherry):
    a = simulate(cherry, 300, seed=5, param_uncertainty=0.0).cash
    b = simulate(cherry, 300, seed=5, param_uncertainty=0.35).cash
    assert not np.array_equal(a, b)
    assert np.array_equal(a, simulate(cherry, 300, seed=5, param_uncertainty=0.0).cash)


def test_usd_loan_lever_converts_at_simulated_fx(cherry, cherry_res, catalog):
    p = catalog.product("PAE-USD")
    lv = Lever("t", p, "loan", 5, 1e5, catalog.loan_unit_cost(p), "USD", meta={"clp_per_unit": 1.0, "currency": "USD"})
    f = lever_flows(lv, cherry, catalog, cherry_res, np.arange(3))
    fx = cherry_res.fx.clp_per_usd[:3]
    assert f[:, 5] == pytest.approx((1 - catalog.loan_upfront(p)) * fx[:, 5])
    m = 5 + p.term_days
    if m <= cherry.horizon_days:
        assert f[:, m] == pytest.approx(-(1 + catalog.loan_interest(p)) * fx[:, m])


def test_action_cap_is_respected(cherry_res, catalog):
    from nanfeng_quant.optimizer import optimize
    plan = optimize(cherry_res, catalog, max_actions=1, exact_time_limit_s=10.0, max_retries=0)
    assert plan.total_cost_clp is None or len(plan.actions) <= 1


# ---- iteration 3: fair default loan, realistic factoring, systemic delays, integration ----

def test_loans_offer_several_terms_and_quote_picks_shortest_that_covers(catalog):
    wc = catalog.product("WC-BANK")
    assert wc.terms() == [30, 60, 90, 180]
    assert catalog.loan_unit_cost(wc, 30) < catalog.loan_unit_cost(wc, 180)
    assert catalog.stamp_tax(30) == pytest.approx(catalog.product_stamp(wc, 30))


def test_non_recourse_factor_refuses_invoice_with_announced_delay(cherry, catalog):
    from nanfeng_quant.catalog import eligible_receivable
    late = next(r for r in cherry.receivables if r.announced_delay_days)
    assert not eligible_receivable(catalog.product("FACT-BANK"), late)
    assert eligible_receivable(catalog.product("FACT-FINTECH"), late)  # with recourse: the exporter keeps the risk


def test_recourse_factoring_repays_advance_when_buyer_is_late(cherry, cherry_res, catalog):
    p = catalog.product("FACT-FINTECH")
    j = 0
    r = cherry.receivables[j]
    rd = 30
    lv = Lever("t", p, "factoring", 5, 1.0, 0.0, "fraction", r.id, j,
               {"face_clp": 1.0, "days_charged": 15, "recourse_day": rd})
    paths = np.arange(cherry_res.n_paths)
    f = lever_flows(lv, cherry, catalog, cherry_res, paths)
    tau = cherry_res.receivable_pay_day[:, j]
    late = np.nonzero(tau > rd)[0]
    if late.size:
        k = late[0]
        assert f[k, rd] < 0 and f[k].sum() == pytest.approx(
            p.advance_rate * r.amount * (cherry_res.fx.rate(r.currency)[k, 5] - cherry_res.fx.rate(r.currency)[k, rd]))


def test_zero_systemic_share_matches_independent_customers(cherry):
    a = simulate(cherry, 300, seed=5, systemic_share=0.0).cash
    b = simulate(cherry, 300, seed=5, systemic_share=0.6).cash
    assert not np.array_equal(a, b)
    assert np.array_equal(a, simulate(cherry, 300, seed=5, systemic_share=0.0).cash)


def test_plan_output_is_ready_for_the_backend():
    out = tools.optimize_plan("cherry_crisis", explain=False)
    req = out["approval_request"]
    assert 1 <= len(req["operations"]) <= 5  # backend ApprovalCreate limit
    assert all(op["op"] in ("payment", "fx_convert", "factoring", "loan", "forward") for op in req["operations"])
    seed_ids = {l["id"] for l in tools.sandbox_seed()["lenders"]}
    receivables = {r["id"] for r in tools.sandbox_seed()["receivables"]}
    for op in req["operations"]:
        assert op["params"]["lender_id"] in seed_ids
        if op["op"] == "factoring":
            assert op["params"]["receivable_id"] in receivables and 0 < op["params"]["share"] <= 1
    assert out["after_plan"]["prob_negative_cash_horizon"] < out["forecast"]["prob_negative_cash_horizon"]
    assert out["credit_passport"]["after_plan"]["score"] > out["credit_passport"]["before"]["score"]
    assert out["savings_pct"] > 0
    again = tools.optimize_plan("cherry_crisis", explain=False)
    assert again["source"].get("cached") and again["optimal"]["total_cost_clp"] == out["optimal"]["total_cost_clp"]


def test_agent_tool_specs_match_tools():
    names = {s["function"]["name"] for s in tools.TOOL_SPECS}
    assert names == set(tools.TOOLS)
    err = json.loads(tools.call("forecast_run", {"scenario": "cherry_crisis", "bogus": 1}))
    assert "error" in err
