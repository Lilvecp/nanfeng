"""Financing MILP: cheapest mix of products that keeps cash above the buffer in P90 scenarios.

Scenario-based chance constraint (Luedtke & Ahmed, 2008): S scenarios are sampled from the
Monte Carlo; binary z_s marks a scenario allowed to breach the buffer, and at most
floor(alpha * S) may do so. Every financing decision ("lever") is linear in the cash of each
scenario, so the model is a MILP:

    min   sum_v cost_v * x_v + sum_p fixed_p * y_p
    s.t.  base[s,t] + sum_v A_v[s,t] * x_v >= B - M_s * z_s     for s in S, t in check days
          sum_s z_s <= floor(alpha * S)
          credit lines per lender, collateral, product min/max tickets, one financing per invoice,
          forward notional <= unhedged CNY receivable

The plan is then validated out of sample on every Monte Carlo path.
"""
from __future__ import annotations

import datetime as dt
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from ortools.linear_solver import pywraplp

from .catalog import Catalog, Product, eligibility, eligible_receivable, expected_collection_day, spot
from .model import Company
from .montecarlo import ForecastResult

MAX_ACTIONS = 5  # at most this many operations per plan: the owner approves it on a phone
SOLVERS = ["CBC", "SCIP"]  # tried in order; CBC is ~5x faster here, SCIP is the fallback


@dataclass
class Lever:
    key: str
    product: Product
    kind: str
    day: int
    ub: float
    unit_cost: float  # objective coefficient per unit (CLP)
    unit: str  # fraction | CLP | CNY
    target: str | None = None
    target_index: int | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass
class PlanResult:
    status: str
    total_cost_clp: float | None
    actions: list[dict[str, Any]]
    levers: list[Lever]
    values: dict[str, float]
    in_sample_coverage: float | None
    out_of_sample_coverage: float | None
    solve_seconds: float
    n_scenarios: int
    confidence: float
    buffer_clp: float
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "total_cost_clp": None if self.total_cost_clp is None else round(self.total_cost_clp),
            "actions": self.actions,
            "confidence_target": self.confidence,
            "buffer_clp": self.buffer_clp,
            "in_sample_coverage": self.in_sample_coverage,
            "out_of_sample_coverage": self.out_of_sample_coverage,
            "n_scenarios": self.n_scenarios,
            "solve_seconds": round(self.solve_seconds, 3),
            **self.meta,
        }


# ---------------------------------------------------------------------------
# Lever construction and cash effects
# ---------------------------------------------------------------------------

def build_levers(company: Company, catalog: Catalog, res: ForecastResult, sample: np.ndarray,
                 funding_days: list[int]) -> list[Lever]:
    fx0 = spot(company)
    T = company.horizon_days
    levers: list[Lever] = []
    for p in catalog.products:
        ok, _ = eligibility(company, catalog, p)
        if not ok:
            continue
        lead = p.get("lead_days", 0)
        days = sorted({max(lead, d) for d in funding_days if max(lead, d) <= T})
        if p.kind in ("factoring", "lc_discount"):
            for j, r in enumerate(company.receivables):
                if not eligible_receivable(p, r):
                    continue
                face_clp = r.amount * fx0[r.currency]
                if face_clp * p.advance_rate < p.get("min_amount_clp", 0) * 0.25:
                    continue
                first_pay = int(res.receivable_pay_day[sample, j].min())
                exp_day = expected_collection_day(company, r)
                for d in days:
                    if d >= first_pay:
                        continue  # invoice may already be paid by then
                    cost = face_clp * catalog.factoring_unit_cost(p, exp_day - d)
                    meta = {"face_clp": face_clp, "days_charged": max(exp_day - d, p.min_days_charged)}
                    if p.get("recourse"):
                        meta["recourse_day"] = exp_day + p.get("recourse_days", 30)
                    ub = min(1.0, p.max_ticket() / (face_clp * p.advance_rate))  # one operation per invoice
                    levers.append(Lever(f"{p.id}:{r.id}:d{d}", p, p.kind, d, ub, cost, "fraction", r.id, j, meta))
        elif p.kind == "loan":
            cur = p.currencies[0]
            k = fx0[cur]  # CLP per unit of the loan currency
            for d in days:
                for term in p.terms():  # the lender offers several terms: the MILP picks the cheapest that works
                    levers.append(Lever(f"{p.id}:d{d}:t{term}", p, "loan", d, min(float(p.max_amount_clp), p.max_ticket()) / k,
                                        catalog.loan_unit_cost(p, term) * k, cur,
                                        meta={"clp_per_unit": k, "currency": cur, "term_days": term}))
        elif p.kind == "confirming":
            for j, x in enumerate(company.payables):
                d = company.day(x.date)
                if x.confirming_eligible and x.currency == "CLP" and lead <= d <= T:
                    levers.append(Lever(f"{p.id}:{x.id}", p, "confirming", d, min(1.0, p.max_ticket() / x.amount),
                                        x.amount * catalog.confirming_unit_cost(p), "fraction", x.id, j,
                                        {"amount_clp": x.amount}))
        elif p.kind == "forward":
            for j, r in enumerate(company.receivables):
                tenor = expected_collection_day(company, r)
                if r.currency != "CNY" or tenor > min(T, p.max_tenor_days):
                    continue
                k = catalog.forward_rate(fx0["CNY"], tenor, p)
                levers.append(Lever(f"{p.id}:{r.id}", p, "forward", tenor, float(r.amount),
                                    fx0["CNY"] * p.spread_pct, "CNY", r.id, j, {"forward_rate": k}))
    return levers


def lever_flows(lever: Lever, company: Company, catalog: Catalog, res: ForecastResult,
                paths: np.ndarray) -> np.ndarray:
    """Daily CLP flows (len(paths), T+1) caused by one unit of the lever."""
    T = company.horizon_days
    out = np.zeros((len(paths), T + 1))
    p, d = lever.product, lever.day
    if lever.kind in ("factoring", "lc_discount"):
        r = company.receivables[lever.target_index]
        rate = res.fx.rate(r.currency)[paths]
        tau = res.receivable_pay_day[paths, lever.target_index]
        valid = tau > d  # cannot factor an invoice that was already collected
        rows = np.nonzero(valid)[0]
        out[rows, d] += p.advance_rate * r.amount * rate[rows, d] - lever.unit_cost
        adv = p.advance_rate * r.amount
        rd = lever.meta.get("recourse_day")
        if rd is None:  # non-recourse: the factor collects the advance from the buyer, whenever it pays
            paid = rows[tau[rows] <= T]
            out[paid, tau[paid]] -= adv * rate[paid, tau[paid]]
        else:  # with recourse: buyer pays the factor, or the exporter repays the advance on the recourse day
            paid = rows[tau[rows] <= min(rd, T)]
            out[paid, tau[paid]] -= adv * rate[paid, tau[paid]]
            if rd <= T:
                late = rows[tau[rows] > rd]
                out[late, rd] -= adv * rate[late, rd]
    elif lever.kind == "loan":
        rate = res.fx.rate(lever.meta.get("currency", "CLP"))[paths]  # ones for CLP loans
        term = lever.meta.get("term_days", p.term_days)
        out[:, d] += (1.0 - catalog.loan_upfront(p, term)) * rate[:, d]
        m = d + term
        if m <= T:
            out[:, m] -= (1.0 + catalog.loan_interest(p, term)) * rate[:, m]
    elif lever.kind == "confirming":
        a = lever.meta["amount_clp"]
        upfront = p.get("fee_pct", 0.0) + catalog.product_stamp(p)
        out[:, d] += a * (1.0 - upfront)
        m = d + p.term_days
        if m <= T:
            out[:, m] -= a * (1.0 + p.rate_monthly * p.term_days / 30)
    elif lever.kind == "forward":
        out[:, d] += lever.meta["forward_rate"] - res.fx.clp_per_cny[paths, d]
    return out


# ---------------------------------------------------------------------------
# MILP
# ---------------------------------------------------------------------------

# Online solver budget. The exact MILP finds a plan within ~1% of the optimum in 1-2 s; proving
# optimality can take 20 s more. Demo artifacts are solved offline without this limit, and the
# bench measures how far the online plan is from the proven optimum (results/bench_summary.md).
EXACT_TIME_LIMIT_S = 2.0
HEURISTIC_TIME_LIMIT_S = 20.0


def optimize(res: ForecastResult, catalog: Catalog, confidence: float = 0.90, n_scenarios: int = 200,
             in_sample_alpha: float | None = None, buffer_clp: float | None = None, seed: int = 0,
             time_limit_s: float = HEURISTIC_TIME_LIMIT_S, exact_time_limit_s: float = EXACT_TIME_LIMIT_S,
             exclude: tuple[str, ...] = (), max_retries: int = 2,
             max_actions: int | None = MAX_ACTIONS, exact: bool = True) -> PlanResult:
    """Solve, then validate on every Monte Carlo path; if the out-of-sample coverage misses the
    target, tighten the in-sample breach budget and solve again (at most `max_retries` times).

    exact=False skips the chance-constrained MILP and keeps the scenario-elimination heuristic
    (an upper bound on the optimal cost; used for the fast "why not this product" checks)."""
    alpha = (1 - confidence) * 0.6 if in_sample_alpha is None else in_sample_alpha
    exact_limit = exact_time_limit_s if exact else 0.0
    plan = None
    for attempt in range(max_retries + 1):
        # Fast path without the action cap; add the cap (more binaries) only if the plan needs it.
        plan = _optimize_once(res, catalog, confidence, n_scenarios, alpha, buffer_clp, seed,
                              time_limit_s, exact_limit, exclude, None)
        if max_actions is not None and len(plan.actions) > max_actions:
            capped = _optimize_once(res, catalog, confidence, n_scenarios, alpha, buffer_clp, seed,
                                    time_limit_s, exact_limit, exclude, max_actions)
            capped.meta["uncapped_cost_clp"] = None if plan.total_cost_clp is None else round(plan.total_cost_clp)
            capped.meta["uncapped_actions"] = len(plan.actions)
            plan = capped if capped.total_cost_clp is not None else plan
        plan.meta["max_actions"] = max_actions
        plan.meta["in_sample_alpha"] = round(alpha, 4)
        plan.meta["attempts"] = attempt + 1
        if plan.out_of_sample_coverage is None or plan.out_of_sample_coverage >= confidence:
            break
        alpha *= 0.5
    return plan


def _optimize_once(res, catalog, confidence, n_scenarios, alpha, buffer_clp, seed,
                   time_limit_s, exact_time_limit_s, exclude, max_actions=MAX_ACTIONS) -> PlanResult:
    company = res.company
    B = company.min_cash_buffer_clp if buffer_clp is None else buffer_clp
    catalog = catalog.subset([p.id for p in catalog.products if p.id not in exclude])
    rng = np.random.default_rng(seed)
    S = min(n_scenarios, res.n_paths)
    sample = np.sort(rng.choice(res.n_paths, S, replace=False))
    base = res.cash[sample]
    T = company.horizon_days

    # Day 0 is today's known balance: no financing can change it, so checks start on day 1.
    out_days = (set(np.nonzero((res.flows[sample] < 0).any(axis=0))[0].tolist()) | {T}) - {0}
    risk_days = sorted(t for t in out_days if (base[:, t] < B).mean() > 0.005)
    t0 = time.perf_counter()
    if not risk_days:
        return _empty_plan(res, catalog, B, confidence, S, time.perf_counter() - t0)

    levers = build_levers(company, catalog, res, sample, funding_days(base, risk_days, B))
    # No point borrowing more than the worst shortfall in the sample: keeps big-M values tight.
    shortfall = float(np.max(B - base)) * 1.25 + 1.0
    for lv in levers:
        if lv.kind == "loan":
            lv.ub = min(lv.ub, shortfall / lv.meta["clp_per_unit"])
    for lv in levers:  # repayments and settlements create new potential minima
        if lv.kind == "loan" and lv.day + lv.meta["term_days"] <= T:
            out_days.add(lv.day + lv.meta["term_days"])
        if lv.meta.get("recourse_day") is not None and lv.meta["recourse_day"] <= T:
            out_days.add(lv.meta["recourse_day"])
        if lv.kind == "confirming" and lv.day + lv.product.term_days <= T:
            out_days.add(lv.day + lv.product.term_days)
        if lv.kind == "forward":
            out_days.add(lv.day)
    check_days = np.array(sorted(out_days))

    cum = np.stack([np.cumsum(lever_flows(lv, company, catalog, res, sample), axis=1)[:, check_days]
                    for lv in levers], axis=2) if levers else np.zeros((S, len(check_days), 0))
    ub = np.array([lv.ub for lv in levers])
    base_c = base[:, check_days]
    worst = base_c + (np.minimum(cum, 0.0) @ ub if levers else 0.0)

    k = int(np.floor(alpha * S))
    args = (res, catalog, levers, cum, base_c, worst, B, alpha, S, confidence)

    # 1) Heuristic: drop the k scenarios with the largest shortfall and solve the rest as hard
    #    constraints (no scenario binaries, fast). Gives a feasible plan and a MIP start.
    shortfall = np.max(B - base_c, axis=1)
    drop = set(np.argsort(-shortfall)[:k].tolist())
    heur = _solve_any(*args, time_limit_s=time_limit_s, t0=t0, drop=drop, max_actions=max_actions)
    # 2) Exact chance-constrained MILP, warm-started from the heuristic, under a time limit.
    if exact_time_limit_s > 0:
        exact = _solve_any(*args, time_limit_s=exact_time_limit_s, t0=t0, max_actions=max_actions,
                           hint=heur.values if heur.total_cost_clp is not None else None)
    else:
        exact = PlanResult("skipped", None, [], levers, {}, None, None, 0.0, S, confidence, B)
    candidates = [p for p in (heur, exact) if p.total_cost_clp is not None]
    if not candidates:
        return exact if exact.status == "infeasible" else heur
    best = min(candidates, key=lambda p: p.total_cost_clp)
    if best is exact:
        best.meta["method"] = "exact chance-constrained MILP"
    elif exact.status == "skipped":
        best.meta["method"] = "scenario-elimination heuristic (fast mode)"
    else:
        best.meta["method"] = "scenario-elimination heuristic (exact MILP did not improve within the time limit)"
    best.meta["exact_status"] = exact.status
    best.meta["heuristic_cost_clp"] = None if heur.total_cost_clp is None else round(heur.total_cost_clp)
    if exact.meta.get("best_bound_clp") is not None:
        best.meta["lower_bound_clp"] = exact.meta["best_bound_clp"]
        best.meta["optimality_gap"] = round(max(0.0, 1 - exact.meta["best_bound_clp"] / best.total_cost_clp), 4) if best.total_cost_clp else 0.0
    best.solve_seconds = time.perf_counter() - t0
    return best


MAX_FUNDING_DAYS = 10


def funding_days(base: np.ndarray, risk_days: list[int], B: float, k: int = MAX_FUNDING_DAYS) -> list[int]:
    """Days on which new money may arrive. Funding only helps from the day it lands, so the useful
    candidates are the days where the share of scenarios below the buffer jumps up from the previous
    risk day (the onset of each risk episode, including later ones after cash recovers). Keeps the k
    largest jumps plus the first risk day. Cash is still checked on every risk day; this only limits
    when financing can be drawn, which keeps the MILP small on long, noisy horizons."""
    share = [float((base[:, t] < B).mean()) for t in risk_days]
    steps = [(share[i] - (share[i - 1] if i else 0.0), t) for i, t in enumerate(risk_days)]
    keep = {t for d, t in sorted(steps, reverse=True)[:k] if d > 1e-9} | {risk_days[0]}
    return sorted(keep)


def _solve_any(*args, **kw) -> PlanResult:
    plan = None
    for solver_name in SOLVERS:
        plan = _solve(solver_name, *args, **kw)
        if plan.status in ("optimal", "feasible", "infeasible"):
            break
        if kw.get("hint"):  # warm-started exact stage hit its time limit: keep the heuristic plan
            break
    return plan


def _solve(solver_name, res, catalog, levers, cum, base_c, worst, B, alpha, S, confidence, time_limit_s, t0,
           drop: set[int] | None = None, hint: dict[str, float] | None = None,
           max_actions: int | None = MAX_ACTIONS) -> PlanResult:
    """Build and solve the MILP in millions (MCLP / MCNY) to keep coefficients well scaled.

    drop: scenarios fixed as allowed breaches (heuristic mode, no z binaries).
    hint: lever values of a known feasible plan used as a MIP start.
    """
    company = res.company
    U = 1e6
    scale = np.array([U if lv.unit in ("CLP", "CNY", "USD") else 1.0 for lv in levers])
    solver = pywraplp.Solver.CreateSolver(solver_name)
    if solver is None:
        return PlanResult("error", None, [], levers, {}, None, None, time.perf_counter() - t0, S, confidence, B)
    solver.SetTimeLimit(int(time_limit_s * 1000))
    x = [solver.NumVar(0.0, lv.ub / scale[i], lv.key) for i, lv in enumerate(levers)]
    products = sorted({lv.product.id for lv in levers})
    y = {pid: solver.BoolVar(f"y:{pid}") for pid in products}
    z = [solver.BoolVar(f"z{s}") for s in range(S)] if drop is None else None

    for i, lv in enumerate(levers):
        solver.Add(x[i] <= (lv.ub / scale[i]) * y[lv.product.id])
    for pid in products:  # loan exposure per product
        p = catalog.product(pid)
        if p.kind == "loan":
            idx = [i for i, lv in enumerate(levers) if lv.product.id == pid]
            drawn = sum(x[i] * levers[i].meta["clp_per_unit"] for i in idx)  # MCLP
            solver.Add(drawn <= p.max_amount_clp / U * y[pid])
    # factoring: each (product, invoice, day) is one operation with its own fixed fee and min ticket
    ops: dict[int, pywraplp.Variable] = {}
    # loans: each (product, day, term) draw is one loan with its own fixed fee and minimum ticket
    for i, lv in enumerate(levers):
        if lv.kind == "loan":
            ops[i] = solver.BoolVar(f"w:{lv.key}")
            solver.Add(x[i] <= (lv.ub / scale[i]) * ops[i])
            solver.Add(x[i] * lv.meta["clp_per_unit"] >= lv.product.get("min_amount_clp", 0) / U * ops[i])
    for i, lv in enumerate(levers):
        if lv.kind in ("factoring", "lc_discount"):
            ops[i] = solver.BoolVar(f"w:{lv.key}")
            solver.Add(x[i] <= ops[i])
            solver.Add(x[i] * lv.product.advance_rate * lv.meta["face_clp"] / U
                       >= lv.product.get("min_amount_clp", 0) / U * ops[i])
    # confirming: each extended payable is one operation with the product's minimum ticket
    for i, lv in enumerate(levers):
        if lv.kind == "confirming" and lv.product.get("min_amount_clp", 0) > 0:
            ops[i] = solver.BoolVar(f"w:{lv.key}")
            solver.Add(x[i] <= ops[i])
            solver.Add(x[i] * lv.meta["amount_clp"] / U >= lv.product.min_amount_clp / U * ops[i])
    # every other lever (loan draw, forward, confirming without ticket) counts as one action too
    act: dict[int, pywraplp.Variable] = {}
    if max_actions is not None:
        for i, lv in enumerate(levers):
            if i not in ops:
                act[i] = solver.BoolVar(f"a:{lv.key}")
                solver.Add(x[i] <= (lv.ub / scale[i]) * act[i])
        solver.Add(sum(ops.values()) + sum(act.values()) <= max_actions)
    # each receivable financed at most once; forward only on the unfinanced part
    for j, r in enumerate(company.receivables):
        fin = [i for i, lv in enumerate(levers) if lv.kind in ("factoring", "lc_discount") and lv.target_index == j]
        fwd = [i for i, lv in enumerate(levers) if lv.kind == "forward" and lv.target_index == j]
        if fin:
            solver.Add(sum(x[i] for i in fin) <= 1.0)
            solver.Add(sum(ops[i] for i in fin) <= 1)  # a single operation per invoice
        if fwd:
            solver.Add(sum(x[i] for i in fwd) + r.amount / U * sum(x[i] for i in fin) <= r.amount / U)
    # credit lines (usage counted at full drawn amount, conservative)
    for lid, lender in catalog.lenders.items():
        use = []
        for i, lv in enumerate(levers):
            if lv.product.lender_id != lid:
                continue
            if lv.kind in ("factoring", "lc_discount"):
                use.append(x[i] * lv.product.advance_rate * lv.meta["face_clp"] / U)
            elif lv.kind == "loan":
                use.append(x[i] * lv.meta["clp_per_unit"])
            elif lv.kind == "confirming":
                use.append(x[i] * lv.meta["amount_clp"] / U)
        if use:
            solver.Add(sum(use) <= lender["credit_line_clp"] / U)
    coll = [x[i] * lv.meta["clp_per_unit"] * lv.product.get("collateral_pct", 0.0)
            for i, lv in enumerate(levers) if lv.kind == "loan"]
    if coll:
        solver.Add(sum(coll) <= company.collateral_available_clp / U)

    # chance constraint: scenario s may breach the buffer only if z_s = 1
    coef = cum * (scale / U)
    for s in range(S):
        if drop is not None and s in drop:
            continue
        for k in range(base_c.shape[1]):
            if worst[s, k] >= B:
                continue  # never binding
            nz = np.nonzero(np.abs(coef[s, k]) > 1e-9)[0]
            rhs = (B - base_c[s, k]) / U
            if nz.size == 0:  # no lever can move cash on this day for this scenario
                if rhs <= 0:
                    continue
                if z is None:
                    return PlanResult("infeasible", None, [], levers, {}, None, None,
                                      time.perf_counter() - t0, S, confidence, B)
                solver.Add(z[s] >= 1)
                continue
            lhs = sum(float(coef[s, k, i]) * x[i] for i in nz)
            if z is not None:
                m_sk = (B - worst[s, k]) / U + 1e-3  # tightest valid big-M for this row
                lhs = lhs + m_sk * z[s]
            solver.Add(lhs >= rhs)
    if z is not None:
        solver.Add(sum(z) <= int(np.floor(alpha * S)))

    fixed = {pid: catalog.product(pid).get("fee_fixed_clp", 0.0) for pid in products
             if catalog.product(pid).kind not in ("factoring", "lc_discount", "loan")}
    solver.Minimize(sum(lv.unit_cost * scale[i] / U * x[i] for i, lv in enumerate(levers))
                    + sum(fixed[p] / U * y[p] for p in fixed)
                    + sum(levers[i].product.get("fee_fixed_clp", 0.0) / U * w for i, w in ops.items()))
    if hint:
        vec = np.array([hint.get(lv.key, 0.0) for lv in levers])
        cash = base_c + cum @ vec
        hv, hx = [], []
        for i, lv in enumerate(levers):
            hv.append(x[i]); hx.append(vec[i] / scale[i])
        for pid, var in y.items():
            hv.append(var); hx.append(float(any(vec[i] > 0 for i, lv in enumerate(levers) if lv.product.id == pid)))
        for i, var in ops.items():
            hv.append(var); hx.append(float(vec[i] > 0))
        for i, var in act.items():
            hv.append(var); hx.append(float(vec[i] > 0))
        if z is not None:
            for s_, var in enumerate(z):
                hv.append(var); hx.append(float((cash[s_] < B - 1.0).any()))
        solver.SetHint(hv, hx)
    status = solver.Solve()
    elapsed = time.perf_counter() - t0
    names = {pywraplp.Solver.OPTIMAL: "optimal", pywraplp.Solver.FEASIBLE: "feasible",
             pywraplp.Solver.INFEASIBLE: "infeasible"}
    status_name = names.get(status, "error")
    if status_name not in ("optimal", "feasible"):
        return PlanResult(status_name, None, [], levers, {}, None, None, elapsed, S, confidence, B)

    values = {lv.key: x[i].solution_value() * scale[i] for i, lv in enumerate(levers) if x[i].solution_value() > 1e-7}
    vec = np.array([values.get(lv.key, 0.0) for lv in levers])
    in_cov = float(((base_c + cum @ vec) >= B - 1.0).all(axis=1).mean()) if levers else 1.0
    plan = PlanResult(status_name, solver.Objective().Value() * U, [], levers, values, round(in_cov, 4), None,
                      elapsed, S, confidence, B)
    plan.meta = {"solver": solver_name}
    if z is not None:
        plan.meta["best_bound_clp"] = round(solver.Objective().BestBound() * U)
    plan.actions = describe_actions(plan, company, catalog)
    plan.out_of_sample_coverage = round(coverage(plan, res, catalog), 4)
    return plan


def _empty_plan(res, catalog, B, confidence, S, elapsed) -> PlanResult:
    plan = PlanResult("optimal", 0.0, [], [], {}, 1.0, None, elapsed, S, confidence, B)
    plan.out_of_sample_coverage = round(coverage(plan, res, catalog), 4)
    return plan


def plan_cash(plan: PlanResult, res: ForecastResult, catalog: Catalog) -> np.ndarray:
    """Cash paths (all Monte Carlo paths) after applying the plan."""
    paths = np.arange(res.n_paths)
    flows = res.flows.copy()
    by_key = {lv.key: lv for lv in plan.levers}
    for key, v in plan.values.items():
        flows += v * lever_flows(by_key[key], res.company, catalog, res, paths)
    return res.company.opening_cash_clp + np.cumsum(flows, axis=1)


def coverage(plan: PlanResult, res: ForecastResult, catalog: Catalog) -> float:
    cash = plan_cash(plan, res, catalog)
    return float((cash[:, 1:].min(axis=1) >= plan.buffer_clp).mean())


def describe_actions(plan: PlanResult, company: Company, catalog: Catalog) -> list[dict[str, Any]]:
    fx0 = spot(company)
    by_key = {lv.key: lv for lv in plan.levers}
    dates = company.dates()
    actions = []
    fee_charged: set[str] = set()
    for key, v in sorted(plan.values.items(), key=lambda kv: by_key[kv[0]].day):
        lv = by_key[key]
        p = lv.product
        fee = p.get("fee_fixed_clp", 0.0)
        if lv.kind not in ("factoring", "lc_discount", "loan"):  # per-operation fee for these three
            fee = 0.0 if p.id in fee_charged else fee
            fee_charged.add(p.id)
        a: dict[str, Any] = {"lever": key, "product_id": p.id, "product": p.name, "kind": lv.kind,
                             "lender": catalog.lenders[p.lender_id]["name"],
                             "date": dates[lv.day].isoformat(), "day": lv.day,
                             "cost_clp": round(lv.unit_cost * v + fee)}
        if lv.kind in ("factoring", "lc_discount"):
            a.update(receivable_id=lv.target, fraction=round(v, 4),
                     proceeds_clp=round(v * p.advance_rate * lv.meta["face_clp"]),
                     days_charged=lv.meta["days_charged"], recourse=bool(p.get("recourse")),
                     summary=f"Factor {v:.0%} of {lv.target} with {p.name}")
        elif lv.kind == "loan":
            cur = lv.meta.get("currency", "CLP")
            term = lv.meta.get("term_days", p.term_days)
            a.update(amount_clp=round(v * lv.meta["clp_per_unit"]), currency=cur, amount=round(v, 2), term_days=term,
                     maturity=(company.as_of + dt.timedelta(days=lv.day + term)).isoformat(),
                     summary=f"Borrow {cur} {v:,.0f} for {term} days from {p.name}")
        elif lv.kind == "confirming":
            a.update(payable_id=lv.target, fraction=round(v, 4), amount_clp=round(v * lv.meta["amount_clp"]),
                     summary=f"Extend {v:.0%} of {lv.target} by {p.term_days} days via {p.name}")
        elif lv.kind == "forward":
            a.update(receivable_id=lv.target, notional_cny=round(v), forward_rate=round(lv.meta["forward_rate"], 4),
                     spot_rate=round(fx0["CNY"], 4), settlement_date=dates[lv.day].isoformat(),
                     summary=f"Sell CNY {v:,.0f} forward at {lv.meta['forward_rate']:.2f} CLP/CNY")
        actions.append(a)
    return actions


def optimize_pair(res: ForecastResult, catalog: Catalog, **kw) -> tuple[PlanResult, PlanResult]:
    """(optimal mix, default bank loan alone) under the same constraints."""
    best = optimize(res, catalog, **kw)
    default = optimize(res, catalog.subset([catalog.default_product().id]), **kw)
    return best, default


def compare(best: PlanResult, default: PlanResult, catalog: Catalog) -> dict[str, Any]:
    out = {"optimal": best.to_dict(), "default": default.to_dict(), "default_product": catalog.default_product().id}
    if best.total_cost_clp is not None and default.total_cost_clp is not None:
        out["savings_clp"] = round(default.total_cost_clp - best.total_cost_clp)
        out["savings_pct"] = round(1 - best.total_cost_clp / default.total_cost_clp, 4) if default.total_cost_clp else 0.0
    return out


def optimize_with_default(res: ForecastResult, catalog: Catalog, **kw) -> dict[str, Any]:
    """Optimal mix vs. the default bank loan alone; the savings figure for the pitch."""
    return compare(*optimize_pair(res, catalog, **kw), catalog)
