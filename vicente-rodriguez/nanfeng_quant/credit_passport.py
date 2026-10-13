"""Credit Passport: explainable financial-health score the SME can share with a lender.

A transparent scorecard (no black box): each factor maps to 0-100 with fixed linear bands,
and the score is the weighted sum. Every factor reports its raw value, sub-score, weight and
points, so a lender (or a judge) can recompute it by hand.

The weights and bands are HEURISTIC (expert choices, v1), not fitted: calibrating them needs
repayment or default outcomes of real SMEs, which a hackathon does not have (our companies are
synthetic). Every passport says so in `method`. `weight_robustness` checks that the conclusions we
show (the plan improves the score) do not depend on the chosen weights.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from typing import Any

import numpy as np

from .catalog import spot
from .model import Company
from .montecarlo import ForecastResult

# factor: (weight, value at sub-score 100, value at sub-score 0, description)
FACTORS = {
    "liquidity": (0.30, 0.00, 0.60, "Probability of negative cash within 90 days (Monte Carlo, no new financing)"),
    "buffer_months": (0.15, 2.0, 0.0, "Median minimum cash over 90 days, in months of average payroll"),
    "concentration": (0.20, 0.20, 0.70, "Herfindahl index of expected inflows by customer"),
    "customer_delay": (0.15, 0.0, 30.0, "Inflow-weighted median customer delay, days"),
    "debt_service": (0.10, 0.05, 0.40, "Debt service as a share of expected inflows in the horizon"),
    "fx_exposure": (0.10, 0.30, 1.00, "Share of expected inflows in foreign currency"),
}
GRADES = [(80, "A"), (65, "B"), (50, "C"), (35, "D"), (0, "E")]
METHOD = ("Heuristic scorecard v1: expert weights and linear bands, not fitted to repayment data. "
          "To calibrate with a lender's portfolio (logistic regression of default on the six factors).")


def _band(value: float, best: float, worst: float) -> float:
    if best == worst:
        return 100.0
    return float(np.clip((value - worst) / (best - worst), 0.0, 1.0) * 100.0)


def factor_values(company: Company, res: ForecastResult, cash: np.ndarray | None = None) -> dict[str, float]:
    """`cash` (paths x days) replaces the forecast's cash paths, e.g. the paths after a financing plan."""
    cash = res.cash if cash is None else cash
    fx = spot(company)
    by_customer: dict[str, float] = {}
    foreign = total = delay_w = 0.0
    for r in company.receivables:
        v = r.amount * fx[r.currency]
        by_customer[r.customer_id] = by_customer.get(r.customer_id, 0.0) + v
    for s in company.shipments:
        v = s.expected_amount * fx[s.currency]
        by_customer[s.customer_id] = by_customer.get(s.customer_id, 0.0) + v
    for cid, v in by_customer.items():
        c = company.customer(cid)
        total += v
        delay_w += v * c.delay_median_days
        if c.currency != "CLP":
            foreign += v
    shares = np.array(list(by_customer.values())) / max(total, 1.0)
    payroll = [p.amount * fx[p.currency] for p in company.payables if p.category == "payroll"]
    monthly_payroll = (sum(payroll) / max(len(payroll), 1)) if payroll else 1.0
    debt = sum(p.amount * fx[p.currency] for p in company.payables if p.category == "debt_service")
    return {
        "liquidity": float((cash.min(axis=1) < 0).mean()),
        "buffer_months": float(np.median(cash.min(axis=1))) / monthly_payroll,
        "concentration": float((shares ** 2).sum()),
        "customer_delay": delay_w / max(total, 1.0),
        "debt_service": debt / max(total, 1.0),
        "fx_exposure": foreign / max(total, 1.0),
    }


def credit_passport(company: Company, res: ForecastResult, consent: bool = False,
                    cash: np.ndarray | None = None) -> dict[str, Any]:
    values = factor_values(company, res, cash)
    factors = []
    score = 0.0
    for key, (weight, best, worst, desc) in FACTORS.items():
        sub = _band(values[key], best, worst)
        pts = weight * sub
        score += pts
        factors.append({"factor": key, "description": desc, "value": round(values[key], 4),
                        "best_at": best, "worst_at": worst, "sub_score": round(sub, 1) + 0.0,
                        "weight": weight, "points": round(pts, 1) + 0.0})
    grade = next(g for t, g in GRADES if score >= t)
    factors.sort(key=lambda f: f["points"] - f["weight"] * 100)  # biggest gaps first
    weakest = factors[0]
    out = {
        "company_id": company.id,
        "company": company.name,
        "as_of": company.as_of.isoformat(),
        "score": round(score, 1),
        "grade": grade,
        "factors": factors,
        "summary": (f"Score {score:.0f}/100 (grade {grade}). Weakest factor: "
                    f"{weakest['description'].lower()} = {weakest['value']}."),
        "method": METHOD,
        "consent": consent,
        "shareable": consent,
        "synthetic": company.synthetic,
    }
    if consent:
        payload = json.dumps({k: out[k] for k in ("company_id", "as_of", "score", "grade", "factors")}, sort_keys=True)
        out["digest_sha256"] = hashlib.sha256(payload.encode()).hexdigest()  # can be anchored on-chain
        out["issued_at"] = dt.date.today().isoformat()
    return out


def weight_robustness(before: dict[str, Any], after: dict[str, Any], n: int = 10_000,
                      seed: int = 0) -> dict[str, Any]:
    """How much the before/after comparison depends on the heuristic weights.

    Sub-scores do not depend on the weights, so the score under any weights w is sum(w_i * sub_i).
    Two families of weights: "perturbed" (Dirichlet centred on v1, each weight typically within about
    +-50% of its value) and "any" (uniform over every possible weighting of the six factors)."""
    rng = np.random.default_rng(seed)
    keys = list(FACTORS)
    v1 = np.array([FACTORS[k][0] for k in keys])
    sub_b = np.array([next(f["sub_score"] for f in before["factors"] if f["factor"] == k) for k in keys])
    sub_a = np.array([next(f["sub_score"] for f in after["factors"] if f["factor"] == k) for k in keys])

    def grade(x: np.ndarray) -> np.ndarray:
        return np.select([x >= t for t, _ in GRADES], [g for _, g in GRADES], "E")

    out: dict[str, Any] = {"n": n, "seed": seed, "v1": {"before": round(float(v1 @ sub_b), 1), "after": round(float(v1 @ sub_a), 1)}}
    for name, w in (("perturbed", rng.dirichlet(v1 * 20, n)), ("any", rng.dirichlet(np.ones(len(keys)), n))):
        b, a = w @ sub_b, w @ sub_a
        out[name] = {
            "after_better_share": round(float((a > b).mean()), 4),
            "before_p5_p95": [round(float(np.percentile(b, 5)), 1), round(float(np.percentile(b, 95)), 1)],
            "after_p5_p95": [round(float(np.percentile(a, 5)), 1), round(float(np.percentile(a, 95)), 1)],
            "grade_up_share": round(float((grade(a) < grade(b)).mean()), 4),  # "A" < "B": a better letter
        }
    return out
