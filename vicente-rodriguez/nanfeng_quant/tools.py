"""Agent-facing tools (JSON in, JSON out) for Renato's orchestrator.

Names match the battle plan: forecast_run, financing_quote, optimize_plan, credit_passport. Every
number the agent shows comes from here; the LLM never computes. Each response carries `source` so
the UI can show where a figure comes from. `TOOL_SPECS` are the function-calling schemas
(OpenAI / OpenRouter format) exported to api/agent_tools.json.

optimize_plan also returns `approval_request`: the plan already in the shape of the backend's
POST /approvals body (Camilo's sandbox bank), so the agent proposes exactly what the MILP chose.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

import numpy as np

from . import __version__
from .catalog import CATALOG_FILE, Catalog, financing_quote as _quote, spot
from .credit_passport import credit_passport as _passport
from .explain import forecast_drivers, plan_explanation
from .model import Company
from .montecarlo import simulate
from .optimizer import EXACT_TIME_LIMIT_S, compare, optimize_pair, plan_cash

SCENARIO_DIR = Path(__file__).resolve().parents[1] / "data" / "scenarios"
_CACHE: OrderedDict[str, dict[str, Any]] = OrderedDict()
_CACHE_SIZE = 64


def load_scenario(scenario: str | dict[str, Any] | Company) -> Company:
    if isinstance(scenario, Company):
        return scenario
    if isinstance(scenario, dict):
        return Company.from_dict(scenario)
    path = Path(scenario)
    if not path.exists():
        path = SCENARIO_DIR / f"{scenario}.json"
    return Company.load(path)


def _clean(obj: Any) -> Any:
    """Make results strictly JSON-serializable (numpy types, NaN -> None)."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, np.generic):
        obj = obj.item()
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def _source(tool: str, **extra: Any) -> dict[str, Any]:
    return {"tool": tool, "engine": f"nanfeng_quant {__version__}", "deterministic": True, **extra}


def _cache_key(tool: str, scenario: Any, **args: Any) -> str | None:
    """Same inputs -> same answer (fixed seeds), so repeated calls are served from memory.
    Scenario files are keyed by their modification time so an edited file is recomputed."""
    if isinstance(scenario, Company):
        return None
    if isinstance(scenario, str):
        path = Path(scenario) if Path(scenario).exists() else SCENARIO_DIR / f"{scenario}.json"
        scen = f"{scenario}@{path.stat().st_mtime_ns if path.exists() else 0}"
    else:
        scen = hashlib.sha256(json.dumps(scenario, sort_keys=True, default=str).encode()).hexdigest()
    return json.dumps({"t": tool, "s": scen, "c": CATALOG_FILE.stat().st_mtime_ns, **args}, sort_keys=True, default=str)


def _cached(key: str | None, compute) -> dict[str, Any]:
    if key is not None and key in _CACHE:
        _CACHE.move_to_end(key)
        out = json.loads(json.dumps(_CACHE[key]))
        out["source"]["cached"] = True
        return out
    out = compute()
    if key is not None:
        _CACHE[key] = out
        while len(_CACHE) > _CACHE_SIZE:
            _CACHE.popitem(last=False)
    return json.loads(json.dumps(out))


# ---------------------------------------------------------------------------
# tools
# ---------------------------------------------------------------------------

def forecast_run(scenario: str | dict[str, Any], overrides: dict[str, Any] | None = None,
                 n_paths: int = 10_000, seed: int = 7, explain: bool = True) -> dict[str, Any]:
    def compute():
        t0 = time.perf_counter()
        company = load_scenario(scenario)
        res = simulate(company, n_paths, seed, overrides)
        out = {"summary": res.summary(), "fan_chart": res.fan_chart()}
        if explain:
            out["drivers"] = forecast_drivers(res)
        out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
        out["source"] = _source("forecast_run", method="Monte Carlo", seed=seed, n_paths=n_paths)
        return _clean(out)
    return _cached(_cache_key("forecast_run", scenario, overrides=overrides, n_paths=n_paths, seed=seed,
                              explain=explain), compute)


def financing_quote(scenario: str | dict[str, Any], amount_clp: float | None = None,
                    need_date: str | None = None, need_days: int = 30,
                    overrides: dict[str, Any] | None = None, seed: int = 7) -> dict[str, Any]:
    """Quote every catalog product. Without amount/date, uses the P10 shortfall on the crunch day."""
    company = load_scenario(scenario)
    catalog = Catalog.load()
    if amount_clp is None or need_date is None:
        res = simulate(company, 10_000, seed, overrides)
        day = res.crunch_day()
        if day is None:
            day = int(np.argmax(res.p_negative_by_day))
        q10 = float(res.quantiles((0.10,))["p10"][day])
        amount_clp = amount_clp if amount_clp is not None else max(company.min_cash_buffer_clp - q10, 0.0)
        need_day = day
    else:
        need_day = company.day(dt.date.fromisoformat(need_date))
    quotes = _quote(company, catalog, amount_clp, need_day, need_days)
    return _clean({"amount_clp": round(amount_clp), "need_date": company.dates()[need_day].isoformat(),
                   "need_days": need_days, "quotes": quotes, "catalog_status": catalog.status,
                   "source": _source("financing_quote", catalog_version=catalog.raw.get("version"))})


def approval_request(company: Company, catalog: Catalog, actions: list[dict[str, Any]],
                     headline: str, channel: str = "WEB") -> dict[str, Any]:
    """The plan as the body of the backend's POST /approvals (camilo-bufadel backend/app/schemas.py).

    Each action becomes one sandbox operation; the lender ids are the sandbox ones listed in the
    catalog (`sandbox` field) and seeded by GET /quant/sandbox/seed. Operations the sandbox does not
    support yet are listed in `unsupported` instead of being sent.
    """
    ops, unsupported = [], []
    for a in actions:
        p = catalog.product(a["product_id"])
        sb = p.get("sandbox") or {}
        op = sb.get("op")
        if a["kind"] in ("factoring", "lc_discount"):
            params = {"receivable_id": a["receivable_id"], "lender_id": sb.get("lender_id"), "share": a["fraction"]}
        elif a["kind"] == "loan":
            params = {"lender_id": sb.get("lender_id"), "amount_clp": a["amount_clp"], "term_days": a["term_days"]}
        elif a["kind"] == "forward":
            params = {"currency": "CNY", "notional": a["notional_cny"], "lender_id": sb.get("lender_id"),
                      "tenor_days": max((dt.date.fromisoformat(a["settlement_date"]) - company.as_of).days, 1)}
        else:
            params = {"payable_id": a.get("payable_id"), "share": a.get("fraction"), "lender_id": sb.get("lender_id")}
        item = {"op": op, "params": params}
        a["operation"] = {**item, "execute_on": a["date"]}
        (ops if op in ("factoring", "loan", "forward") else unsupported).append(item)
    names = []
    for a in actions:
        label = {"factoring": "factoring", "lc_discount": "LC discounting", "loan": a.get("product", "loan"),
                 "confirming": "confirming", "forward": "CNY forward"}[a["kind"]]
        if label not in names:
            names.append(label)
    return {"action": " + ".join(names) or "no financing needed", "operations": ops,
            "explanation": headline, "channel": channel,
            "execute_on": {f"{i}": a["date"] for i, a in enumerate(actions)},
            "unsupported": unsupported}


def optimize_plan(scenario: str | dict[str, Any], confidence: float = 0.90,
                  overrides: dict[str, Any] | None = None, n_paths: int = 10_000, seed: int = 7,
                  explain: bool = True, n_scenarios: int = 200,
                  exact_time_limit_s: float = EXACT_TIME_LIMIT_S, channel: str = "WEB") -> dict[str, Any]:
    def compute():
        t0 = time.perf_counter()
        company = load_scenario(scenario)
        catalog = Catalog.load()
        res = simulate(company, n_paths, seed, overrides)
        best, default = optimize_pair(res, catalog, confidence=confidence, n_scenarios=n_scenarios,
                                      exact_time_limit_s=exact_time_limit_s)
        out = compare(best, default, catalog)
        out["forecast"] = res.summary()
        out["headline"] = plan_headline(out, company)
        if best.total_cost_clp is not None:
            out["approval_request"] = approval_request(company, catalog, out["optimal"]["actions"],
                                                       out["headline"], channel)
            cash = plan_cash(best, res, catalog)
            q = np.quantile(cash, (0.10, 0.50, 0.90), axis=0)
            out["after_plan"] = {
                "prob_negative_cash_horizon": round(float((cash[:, 1:].min(axis=1) < 0).mean()), 4),
                "prob_below_buffer_horizon": round(float((cash[:, 1:].min(axis=1) < company.min_cash_buffer_clp).mean()), 4),
                "fan_chart": {"dates": [d.isoformat() for d in res.dates], "p10": np.round(q[0]).tolist(),
                              "p50": np.round(q[1]).tolist(), "p90": np.round(q[2]).tolist(),
                              "p_negative": np.round((cash < 0).mean(axis=0), 4).tolist(),
                              "buffer": company.min_cash_buffer_clp},
            }
            before = _passport(company, res)
            after = _passport(company, res, cash=cash)
            out["credit_passport"] = {"before": {k: before[k] for k in ("score", "grade")},
                                      "after_plan": {k: after[k] for k in ("score", "grade")}}
        if explain and best.total_cost_clp is not None:
            out["explanation"] = plan_explanation(res, catalog, best, default=default, n_scenarios=n_scenarios)
        out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
        out["source"] = _source("optimize_plan", method="scenario chance-constrained MILP (OR-Tools CBC)",
                                seed=seed, n_paths=n_paths, solver_budget_s=exact_time_limit_s,
                                deterministic=exact_time_limit_s >= 60)
        return _clean(out)
    return _cached(_cache_key("optimize_plan", scenario, confidence=confidence, overrides=overrides,
                              n_paths=n_paths, seed=seed, explain=explain, n_scenarios=n_scenarios,
                              limit=exact_time_limit_s, channel=channel), compute)


def plan_headline(out: dict[str, Any], company: Company) -> str:
    o, d = out["optimal"], out["default"]
    f = out.get("forecast", {})
    if o["total_cost_clp"] is None:
        return "No financing mix keeps cash above the buffer in the target share of scenarios."
    if not o["actions"]:
        return "No financing needed: cash stays above the buffer in the target share of scenarios."
    acts = "; ".join(a["summary"] for a in o["actions"])
    text = (f"{f.get('headline', '')}. Plan: {acts}. Cost CLP {o['total_cost_clp']:,.0f}")
    if d.get("total_cost_clp"):
        text += (f" vs CLP {d['total_cost_clp']:,.0f} for the default bank loan "
                 f"({out['savings_pct']:.0%} cheaper)")
    text += f"; cash stays above the buffer in {o['out_of_sample_coverage']:.0%} of 10,000 scenarios."
    return text


def credit_passport(scenario: str | dict[str, Any], consent: bool = False, seed: int = 7) -> dict[str, Any]:
    company = load_scenario(scenario)
    res = simulate(company, 10_000, seed)
    out = _passport(company, res, consent=consent)
    out["source"] = _source("credit_passport", seed=seed)
    return _clean(out)


def sandbox_seed(scenario: str | dict[str, Any] = "cherry_crisis") -> dict[str, Any]:
    """State for the sandbox bank, taken from the same scenario and catalog the engine uses, so the
    bank, the forecast and the front tell the same story (field names follow Camilo's seed.py)."""
    company = load_scenario(scenario)
    catalog = Catalog.load()
    fx = spot(company)
    product_type = {"factoring": "factoring", "lc_discount": "factoring", "confirming": "confirming",
                    "forward": "forward"}
    lenders = []
    for p in catalog.products:
        sb = p.get("sandbox") or {}
        if not sb.get("lender_id"):
            continue
        if p.kind == "loan":
            ptype = "fogape" if p.id == "FOGAPE" else "wc_loan"
            rate = p.get("rate_annual", p.get("rate_monthly", 0) * 12) + p.get("guarantee_fee_annual", 0.0)
            advance = 1.0
        else:
            ptype = product_type[p.kind]
            rate = p.get("rate_monthly", 0) * 12 if p.kind != "forward" else 0.0
            advance = p.get("advance_rate", 1.0)
        fee = p.get("spread_pct", 0.0) if p.kind == "forward" else p.get("fee_pct", 0.0)
        lenders.append({"id": sb["lender_id"], "name": f"{catalog.lenders[p.lender_id]['name']} · {p.name}",
                        "product": ptype, "annual_rate": round(rate, 6), "advance_pct": advance, "fee_pct": fee,
                        "catalog_product_id": p.id})
    return _clean({
        "company": f"{company.name} (fictional)" if "fictional" not in company.name else company.name,
        "as_of": company.as_of.isoformat(), "synthetic": company.synthetic,
        "accounts": [{"id": "ACC-CLP", "name": "Operating account CLP", "currency": "CLP", "balance": company.opening_cash_clp},
                     {"id": "ACC-USD", "name": "Export proceeds USD", "currency": "USD", "balance": 0},
                     {"id": "ACC-CNY", "name": "Export proceeds CNY", "currency": "CNY", "balance": 0}],
        "receivables": [{"id": r.id, "customer": company.customer(r.customer_id).name, "currency": r.currency,
                         "amount": r.amount, "due_date": r.due_date.isoformat(),
                         "announced_delay_days": r.announced_delay_days,
                         "factoring_eligible": r.factoring_eligible} for r in company.receivables],
        "lenders": lenders,
        "fx_rates_clp": {"USD": round(fx["USD"], 4), "CNY": round(fx["CNY"], 4), "CLP": 1.0},
        "source": _source("sandbox_seed", catalog_version=catalog.raw.get("version")),
    })


TOOLS = {"forecast_run": forecast_run, "financing_quote": financing_quote,
         "optimize_plan": optimize_plan, "credit_passport": credit_passport}

_OVERRIDES_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "description": "Scenario Lab what-ifs. Omit for the current situation.",
    "properties": {
        "global_delay_extra_days": {"type": "number", "description": "Every customer pays this many extra days late"},
        "customer_delay_extra_days": {"type": "object", "additionalProperties": {"type": "number"},
                                      "description": "Extra delay per customer id, e.g. {\"C-SHA\": 30}"},
        "cny_shift_pct": {"type": "number", "description": "CNY moves this % against the peso from today (negative = CNY weaker)"},
        "usd_shift_pct": {"type": "number", "description": "USD moves this % against the peso from today"},
        "cherry_price_pct": {"type": "number", "description": "Change in the cherry price of shipments not yet invoiced, %"},
        "extra_hires": {"type": "integer", "minimum": 0, "description": "Extra harvest workers on every payroll"},
        "hire_monthly_wage_clp": {"type": "number", "description": "Monthly cost per extra worker, CLP (default 750,000)"},
        "defaulted_customers": {"type": "array", "items": {"type": "string"}, "description": "Customers that stop paying"},
        "ignore_announced_delays": {"type": "boolean", "description": "Forecast as if announced delays had not happened"},
    },
}
_SCENARIO_ARG = {"type": "string", "description": "Scenario id, e.g. \"cherry_crisis\"", "default": "cherry_crisis"}

TOOL_SPECS = [
    {"type": "function", "function": {
        "name": "forecast_run",
        "description": ("90-day cash forecast with 10,000 Monte Carlo scenarios. Returns the headline (probability of "
                        "negative cash and crunch date), P10/P50/P90 per day, and which customer or factor drives the "
                        "risk. Use it whenever a document or event may change future cash, and for what-if questions. "
                        "Read-only (tier L0). Quote its numbers verbatim; never recompute them."),
        "parameters": {"type": "object", "required": ["scenario"], "additionalProperties": False, "properties": {
            "scenario": _SCENARIO_ARG, "overrides": _OVERRIDES_SCHEMA,
            "explain": {"type": "boolean", "default": True, "description": "Include the drivers analysis (~1 s more)"}}}}},
    {"type": "function", "function": {
        "name": "financing_quote",
        "description": ("Quote every financing product for a cash need: cost in CLP, effective annual cost, term, lead "
                        "time, requirements and eligibility. Without amount/date it quotes the forecast's own gap. "
                        "Read-only (L0). For a recommendation use optimize_plan instead."),
        "parameters": {"type": "object", "required": ["scenario"], "additionalProperties": False, "properties": {
            "scenario": _SCENARIO_ARG,
            "amount_clp": {"type": "number", "description": "Cash needed, CLP"},
            "need_date": {"type": "string", "format": "date", "description": "When the cash is needed (ISO date)"},
            "need_days": {"type": "integer", "minimum": 1, "default": 30, "description": "For how long"},
            "overrides": _OVERRIDES_SCHEMA}}}},
    {"type": "function", "function": {
        "name": "optimize_plan",
        "description": ("Cheapest financing mix (MILP) that keeps cash above the buffer in `confidence` of the "
                        "scenarios, compared with the default bank loan, with why each product is in or out. "
                        "Returns `approval_request`: send it unchanged to POST /approvals so the owner approves "
                        "exactly this plan (financing is always tier L3: OTP). Takes 3-10 s."),
        "parameters": {"type": "object", "required": ["scenario"], "additionalProperties": False, "properties": {
            "scenario": _SCENARIO_ARG,
            "confidence": {"type": "number", "minimum": 0.8, "maximum": 0.99, "default": 0.9},
            "overrides": _OVERRIDES_SCHEMA,
            "channel": {"type": "string", "default": "WEB", "description": "Channel the approval is requested on (WEB, WHATSAPP)"}}}}},
    {"type": "function", "function": {
        "name": "credit_passport",
        "description": ("Explainable financial-health score (0-100, grade A-E) the SME can share with a lender. Only "
                        "set consent=true if the owner explicitly agreed to share it; that adds a SHA-256 digest "
                        "for the audit log. Read-only (L0) without consent; sharing is L2."),
        "parameters": {"type": "object", "required": ["scenario"], "additionalProperties": False, "properties": {
            "scenario": _SCENARIO_ARG,
            "consent": {"type": "boolean", "default": False}}}}},
]


def call(name: str, arguments: dict[str, Any] | str) -> str:
    """Single entry point for the orchestrator: tool name + JSON arguments -> JSON string."""
    args = json.loads(arguments) if isinstance(arguments, str) else arguments
    if name not in TOOLS:
        return json.dumps({"error": f"unknown tool {name!r}", "tools": sorted(TOOLS)})
    try:
        return json.dumps(TOOLS[name](**args), ensure_ascii=False)
    except (TypeError, ValueError, KeyError, FileNotFoundError) as e:  # bad arguments from the LLM
        return json.dumps({"error": f"{type(e).__name__}: {e}", "tool": name})
