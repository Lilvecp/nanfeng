"""Explainability: what causes the crunch, and why each financing option is in or out.

Forecast drivers use counterfactual re-runs on common random numbers (same seed): only the
switched-off factor changes, so the difference in probability is attributable to it.
Plan explanations use eligibility checks, quotes for the same need, and ablation
(re-solve the MILP without a selected product and report the extra cost).
"""
from __future__ import annotations

from typing import Any

import numpy as np

from .catalog import Catalog, eligibility, financing_quote
from .montecarlo import ForecastResult, simulate
from .optimizer import PlanResult, optimize


def _probe_day(res: ForecastResult) -> int:
    crunch = res.crunch_day()
    if crunch is not None:
        return crunch
    return int(np.argmax(res.p_negative_by_day))


def forecast_drivers(res: ForecastResult) -> dict[str, Any]:
    company = res.company
    day = _probe_day(res)
    n = res.n_paths
    base_p = float(res.p_negative_cumulative[day])
    base_h = float(res.p_negative_cumulative[-1])

    def run(**ov) -> ForecastResult:
        merged = {**res.overrides.__dict__, **ov}
        return simulate(company, n, res.seed, merged)

    drivers = []
    for c in company.customers:
        alt = run(on_time_customers=[*res.overrides.on_time_customers, c.id])
        drivers.append(("customer", c.id, f"{c.name} pays every invoice on its due date", alt))
    if any(r.announced_delay_days for r in company.receivables):
        drivers.append(("announced_delay", None, "announced payment delays do not happen", run(ignore_announced_delays=True)))
    drivers.append(("fx", None, "exchange rates stay at today's spot", run(freeze_fx=True)))
    drivers.append(("price", None, "cherry price matches the plan exactly", run(freeze_price=True)))

    rows = []
    for kind, ref, text, alt in drivers:
        p_day = float(alt.p_negative_cumulative[day])
        rows.append({
            "driver": kind, "id": ref, "counterfactual": text,
            "prob_negative_by_day": round(p_day, 4),
            "delta_vs_base": round(p_day - base_p, 4),
            "prob_negative_horizon": round(float(alt.p_negative_cumulative[-1]), 4),
        })
    rows.sort(key=lambda r: r["delta_vs_base"])

    dates = res.dates
    outflows = [{"id": p.id, "name": p.name, "amount": p.amount, "currency": p.currency}
                for p in company.payables if company.day(p.date) == day]
    top = rows[0]
    sentence = (f"Probability of negative cash by {dates[day].isoformat()} is {base_p:.0%}. "
                f"If {top['counterfactual']}, it would be {top['prob_negative_by_day']:.0%}.")
    if outflows:
        big = max(outflows, key=lambda o: o["amount"])
        sentence += f" The crunch day carries {big['name']} ({big['currency']} {big['amount']:,.0f})."
    return {"probe_day": day, "probe_date": dates[day].isoformat(), "prob_negative_by_day": round(base_p, 4),
            "prob_negative_horizon": round(base_h, 4), "drivers": rows, "outflows_on_probe_day": outflows,
            "explanation": sentence}


def plan_explanation(res: ForecastResult, catalog: Catalog, plan: PlanResult, ablate: bool = True,
                     **opt_kw) -> list[dict[str, Any]]:
    company = res.company
    day = _probe_day(res)
    q10 = res.quantiles((0.10,))["p10"]
    need = max(company.min_cash_buffer_clp - float(q10[day]), 0.0)
    quotes = {q["product_id"]: q for q in financing_quote(company, catalog, need, day, 30)}
    chosen = {a["product_id"] for a in plan.actions}
    out = []
    for p in catalog.products:
        ok, why = eligibility(company, catalog, p)
        q = quotes.get(p.id, {})
        row: dict[str, Any] = {"product_id": p.id, "name": p.name, "selected": p.id in chosen,
                               "quote_for_need": {k: q.get(k) for k in ("amount_clp", "cost_clp", "eac", "term_days")}}
        if p.id in chosen:
            used = [a for a in plan.actions if a["product_id"] == p.id]
            row["reason"] = "; ".join(a["summary"] for a in used)
            if ablate and plan.total_cost_clp:
                alt = optimize(res, catalog, confidence=plan.confidence, exclude=(p.id,), **opt_kw)
                if alt.total_cost_clp is None:
                    row["without_it"] = "no feasible plan without this product"
                else:
                    row["without_it"] = f"cost rises by CLP {alt.total_cost_clp - plan.total_cost_clp:,.0f}"
                    row["extra_cost_without_clp"] = round(alt.total_cost_clp - plan.total_cost_clp)
        elif not ok:
            row["reason"] = f"not eligible: {why}"
        elif not q.get("eligible", True):
            row["reason"] = q.get("reason")
        elif p.kind == "forward":
            row["reason"] = ("a hedge brings no cash; at this confidence level the CNY downside it removes is "
                             "small next to the late-payment gap, so its spread is not worth paying")
        else:
            alone = optimize(res, catalog.subset([p.id]), confidence=plan.confidence, max_retries=0, **opt_kw)
            if alone.total_cost_clp is None:
                row["reason"] = ("on its own it cannot keep cash above the buffer in the target share of "
                                 "scenarios (credit limit, lead time or repayment date)")
                if p.kind == "loan" and p.term_days <= 60:
                    row["reason"] += f"; its {p.term_days}-day repayment lands on a later cash low"
            else:
                extra = alone.total_cost_clp - (plan.total_cost_clp or 0.0)
                row["alone_cost_clp"] = round(alone.total_cost_clp)
                row["reason"] = f"on its own it costs CLP {alone.total_cost_clp:,.0f}, CLP {extra:,.0f} more than the chosen mix"
                if p.kind == "loan" and p.term_days > 60:
                    row["reason"] += f" (minimum term {p.term_days} days: interest runs long after the gap closes)"
        out.append(row)
    return out
