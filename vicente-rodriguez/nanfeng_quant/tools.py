"""Agent-facing tools (JSON in, JSON out) for Renato's orchestrator.

Names match the battle plan: forecast_run, financing_quote, optimize_plan. Every number the
agent shows comes from here; the LLM never computes. Each response carries `source` so the
UI can show where a figure comes from.
"""
from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any

import numpy as np

from . import __version__
from .catalog import Catalog, financing_quote as _quote
from .credit_passport import credit_passport as _passport
from .explain import forecast_drivers, plan_explanation
from .model import Company
from .montecarlo import simulate
from .optimizer import compare, optimize_pair

SCENARIO_DIR = Path(__file__).resolve().parents[1] / "data" / "scenarios"


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


def forecast_run(scenario: str | dict[str, Any], overrides: dict[str, Any] | None = None,
                 n_paths: int = 10_000, seed: int = 7, explain: bool = True) -> dict[str, Any]:
    t0 = time.perf_counter()
    company = load_scenario(scenario)
    res = simulate(company, n_paths, seed, overrides)
    out = {"summary": res.summary(), "fan_chart": res.fan_chart()}
    if explain:
        out["drivers"] = forecast_drivers(res)
    out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
    out["source"] = _source("forecast_run", method="Monte Carlo", seed=seed, n_paths=n_paths)
    return _clean(out)


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
        import datetime as dt
        need_day = company.day(dt.date.fromisoformat(need_date))
    quotes = _quote(company, catalog, amount_clp, need_day, need_days)
    return _clean({"amount_clp": round(amount_clp), "need_date": company.dates()[need_day].isoformat(),
                   "need_days": need_days, "quotes": quotes, "catalog_status": catalog.status,
                   "source": _source("financing_quote", catalog_version=catalog.raw.get("version"))})


def optimize_plan(scenario: str | dict[str, Any], confidence: float = 0.90,
                  overrides: dict[str, Any] | None = None, n_paths: int = 10_000, seed: int = 7,
                  explain: bool = True, n_scenarios: int = 200,
                  exact_time_limit_s: float = 20.0) -> dict[str, Any]:
    t0 = time.perf_counter()
    company = load_scenario(scenario)
    catalog = Catalog.load()
    res = simulate(company, n_paths, seed, overrides)
    best, default = optimize_pair(res, catalog, confidence=confidence, n_scenarios=n_scenarios,
                                  exact_time_limit_s=exact_time_limit_s)
    out = compare(best, default, catalog)
    out["forecast"] = res.summary()
    if explain and best.total_cost_clp is not None:
        out["explanation"] = plan_explanation(res, catalog, best, n_scenarios=n_scenarios)
    out["latency_ms"] = round((time.perf_counter() - t0) * 1000)
    out["source"] = _source("optimize_plan", method="scenario chance-constrained MILP (OR-Tools)",
                            seed=seed, n_paths=n_paths)
    return _clean(out)


def credit_passport(scenario: str | dict[str, Any], consent: bool = False, seed: int = 7) -> dict[str, Any]:
    company = load_scenario(scenario)
    res = simulate(company, 10_000, seed)
    out = _passport(company, res, consent=consent)
    out["source"] = _source("credit_passport", seed=seed)
    return _clean(out)


TOOLS = {"forecast_run": forecast_run, "financing_quote": financing_quote,
         "optimize_plan": optimize_plan, "credit_passport": credit_passport}


def call(name: str, arguments: dict[str, Any] | str) -> str:
    """Single entry point for the orchestrator: tool name + JSON arguments -> JSON string."""
    args = json.loads(arguments) if isinstance(arguments, str) else arguments
    return json.dumps(TOOLS[name](**args), ensure_ascii=False)
