"""NanFeng-Bench: 50 scenarios with a known correct answer.

- 40 stochastic cases: a synthetic SME plus one stress event (late-payment notice, FX shock,
  cherry price drop, new hires, customer default, or none). The correct answer comes from an
  oracle: the same simulation model on 50,000 paths with an independent seed. It checks the optimizer
  and the plans out of sample, not the model itself (that is the backtest's job). The system under test
  runs exactly as in production (10,000 paths, seed 7, MILP on 200 scenarios).
- 10 deterministic cases: all uncertainty switched off, so the cash path, crunch day and
  minimum cash can be computed by hand with a plain ledger (independent code below).

Per case the system must (1) flag correctly whether financing is needed to keep the buffer
in 90% of scenarios, (2) find the crunch day within +-2 days, and (3) when financing is
needed, return a plan that keeps cash above the buffer in >= 89% of the oracle's paths
(1 pp tolerance for Monte Carlo noise) and costs no more than the default bank loan.
"""
from __future__ import annotations

import copy
import json
import statistics
import time
from pathlib import Path
from typing import Any

import numpy as np

from .catalog import Catalog, spot
from .model import Company
from .montecarlo import simulate
from .optimizer import PlanResult, lever_flows, optimize, optimize_pair

ROOT = Path(__file__).resolve().parents[1]
SMES_FILE = ROOT / "data" / "synthetic" / "smes.json"
RESULTS_DIR = ROOT / "results"

TARGET = 0.90
ORACLE_PATHS = 50_000
ORACLE_SEED = 12_345
SYSTEM_PATHS = 10_000
SYSTEM_SEED = 7
CRUNCH_TOL_DAYS = 2
COVERAGE_TOL = 0.01
OFFLINE_LIMIT_S = 30.0
WORKERS = 8
EVENTS = ["late_notice", "fx_shock", "price_drop", "new_hires", "customer_default", "none"]


def _largest_receivable(company: Company):
    fx = spot(company)
    return max(company.receivables, key=lambda r: r.amount * fx[r.currency], default=None)


def _largest_customer(company: Company) -> str:
    fx = spot(company)
    totals: dict[str, float] = {}
    for r in company.receivables:
        totals[r.customer_id] = totals.get(r.customer_id, 0.0) + r.amount * fx[r.currency]
    for s in company.shipments:
        totals[s.customer_id] = totals.get(s.customer_id, 0.0) + s.expected_amount * fx[s.currency]
    return max(totals, key=totals.get)


def apply_event(company: Company, event: str, rng: np.random.Generator) -> tuple[Company, dict[str, Any], str]:
    company = copy.deepcopy(company)
    overrides: dict[str, Any] = {}
    if event == "late_notice":
        r = _largest_receivable(company)
        if r is None:
            return company, overrides, "none (no receivables)"
        r.announced_delay_days = int(rng.integers(30, 61))
        text = f"importer announces {r.id} will be paid {r.announced_delay_days} days late"
    elif event == "fx_shock":
        overrides = {"usd_shift_pct": -6.0, "cny_shift_pct": -8.0}
        text = "peso appreciates: USD -6%, CNY -8%"
    elif event == "price_drop":
        overrides = {"cherry_price_pct": -15.0}
        text = "cherry price in China falls 15%"
    elif event == "new_hires":
        overrides = {"extra_hires": 40}
        text = "40 extra harvest workers"
    elif event == "customer_default":
        cid = _largest_customer(company)
        overrides = {"defaulted_customers": [cid]}
        text = f"largest customer {cid} stops paying"
    else:
        text = "no event (control)"
    return company, overrides, text


# ---------------------------------------------------------------------------
# deterministic cases and the independent ledger
# ---------------------------------------------------------------------------

def make_deterministic(company: Company) -> Company:
    company = copy.deepcopy(company)
    for c in company.customers:
        c.delay_sigma = 0.0
        c.p_default = 0.0
    company.price_volatility = 0.0
    return company


def ledger_cash(company: Company) -> np.ndarray:
    """Plain day-by-day ledger at spot FX with every delay at its median. Independent of the simulator."""
    fx = spot(company)
    T = company.horizon_days
    flow = np.zeros(T + 1)
    for r in company.receivables:
        c = company.customer(r.customer_id)
        d = max(company.day(r.due_date) + r.announced_delay_days + int(round(c.delay_median_days)), 1)
        if d <= T:
            flow[d] += r.amount * fx[r.currency]
    for s in company.shipments:
        c = company.customer(s.customer_id)
        ship = company.day(s.ship_date)
        if ship < 0:
            continue
        if s.advance_pct > 0 and ship <= T:
            flow[ship] += s.expected_amount * s.advance_pct * fx[s.currency]
        d = ship + s.terms_days + int(round(c.delay_median_days))
        if d <= T:
            flow[d] += s.expected_amount * (1 - s.advance_pct) * fx[s.currency]
    for p in company.payables:
        d = company.day(p.date)
        if 0 <= d <= T:
            flow[d] -= p.amount * fx[p.currency]
    return company.opening_cash_clp + np.cumsum(flow)


# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------

def _coverage_on(plan: PlanResult, res, catalog: Catalog) -> float:
    paths = np.arange(res.n_paths)
    flows = res.flows.copy()
    by_key = {lv.key: lv for lv in plan.levers}
    for key, v in plan.values.items():
        flows += v * lever_flows(by_key[key], res.company, catalog, res, paths)
    cash = res.company.opening_cash_clp + np.cumsum(flows, axis=1)
    return float((cash[:, 1:].min(axis=1) >= plan.buffer_clp).mean())


def run_stochastic(case_id: int, company: Company, event: str, catalog: Catalog, rng) -> dict[str, Any]:
    company, overrides, text = apply_event(company, event, rng)
    B = company.min_cash_buffer_clp

    t0 = time.perf_counter()
    sys_res = simulate(company, SYSTEM_PATHS, SYSTEM_SEED, overrides)
    forecast_ms = (time.perf_counter() - t0) * 1000
    oracle = simulate(company, ORACLE_PATHS, ORACLE_SEED, overrides)

    o_breach = oracle.p_below(B)
    s_breach = sys_res.p_below(B)
    o_need = o_breach > 1 - TARGET
    borderline = abs(o_breach - (1 - TARGET)) <= 0.01
    s_need = s_breach > 1 - TARGET
    detect_ok = borderline or (o_need == s_need)

    o_crunch, s_crunch = oracle.crunch_day(), sys_res.crunch_day()
    o_peak = float(oracle.p_negative_by_day.max())
    crunch_borderline = 0.45 <= o_peak <= 0.55
    if o_crunch is None or s_crunch is None:
        crunch_ok = crunch_borderline or (o_crunch is None and s_crunch is None)
    else:
        crunch_ok = abs(o_crunch - s_crunch) <= CRUNCH_TOL_DAYS

    row: dict[str, Any] = {
        "case": case_id, "kind": "stochastic", "company_id": company.id, "event": event, "event_text": text,
        "oracle_p_below_buffer": round(o_breach, 4), "system_p_below_buffer": round(s_breach, 4),
        "needs_financing": bool(o_need), "borderline": bool(borderline),
        "detect_ok": bool(detect_ok), "oracle_crunch_day": o_crunch, "system_crunch_day": s_crunch,
        "crunch_ok": bool(crunch_ok), "forecast_ms": round(forecast_ms),
    }
    plan_ok = True
    if s_need:
        t1 = time.perf_counter()
        best, default = optimize_pair(sys_res, catalog, confidence=TARGET)  # online solver budget
        row["optimize_ms"] = round((time.perf_counter() - t1) * 1000)
        row["plan_status"] = best.status
        if best.total_cost_clp is not None:
            cov = _coverage_on(best, oracle, catalog)
            # How far is the online plan (2 s budget) from what a long offline solve finds?
            ref = optimize(sys_res, catalog, confidence=TARGET, exact_time_limit_s=OFFLINE_LIMIT_S, max_retries=0)
            excess = (best.total_cost_clp / ref.total_cost_clp - 1) if ref.total_cost_clp else 0.0
            row.update(plan_cost_clp=round(best.total_cost_clp), oracle_coverage=round(cov, 4),
                       plan_actions=[a["summary"] for a in best.actions],
                       optimality_gap=best.meta.get("optimality_gap"),
                       offline_cost_clp=None if ref.total_cost_clp is None else round(ref.total_cost_clp),
                       excess_vs_offline=round(max(excess, 0.0), 4))
            cost_ok = True
            if default.total_cost_clp is not None:
                row["default_cost_clp"] = round(default.total_cost_clp)
                row["savings_clp"] = round(default.total_cost_clp - best.total_cost_clp)
                row["savings_pct"] = round(1 - best.total_cost_clp / default.total_cost_clp, 4) if default.total_cost_clp else 0.0
                cost_ok = best.total_cost_clp <= default.total_cost_clp + 1.0
            plan_ok = (cov >= TARGET - COVERAGE_TOL) and cost_ok
        else:
            # Correct only if a bigger oracle optimization agrees that no feasible plan exists.
            ref = optimize(oracle, catalog, confidence=TARGET, n_scenarios=400, exact_time_limit_s=20.0, max_retries=0)
            row["oracle_plan_status"] = ref.status
            plan_ok = ref.total_cost_clp is None
    elif o_need and not borderline:
        plan_ok = False  # missed a needed plan
    row["plan_ok"] = bool(plan_ok)
    row["success"] = bool(detect_ok and crunch_ok and plan_ok)
    return row


def run_deterministic(case_id: int, company: Company) -> dict[str, Any]:
    company = make_deterministic(company)
    # Lower opening cash so the ledger dips below zero: makes the crunch day a real test.
    total_out = sum(p.amount * spot(company)[p.currency] for p in company.payables)
    company.opening_cash_clp -= float(ledger_cash(company).min()) + 0.05 * total_out
    t0 = time.perf_counter()
    res = simulate(company, 200, SYSTEM_SEED, {"freeze_fx": True}, param_uncertainty=0.0)
    forecast_ms = (time.perf_counter() - t0) * 1000
    truth = ledger_cash(company)
    max_err = float(np.max(np.abs(res.cash - truth[None, :])))
    neg = np.nonzero(truth < 0)[0]
    true_crunch = int(neg[0]) if neg.size else None
    sys_crunch = res.crunch_day()
    exact = max_err < 1.0  # CLP
    return {
        "case": case_id, "kind": "deterministic", "company_id": company.id, "event": "none (all uncertainty off)",
        "true_crunch_day": true_crunch, "system_crunch_day": sys_crunch,
        "true_min_cash_clp": round(float(truth.min())), "system_min_cash_clp": round(float(res.cash.min())),
        "max_abs_error_clp": round(max_err, 6), "forecast_ms": round(forecast_ms),
        "detect_ok": exact, "crunch_ok": true_crunch == sys_crunch, "plan_ok": True,
        "success": bool(exact and true_crunch == sys_crunch),
    }


def _case(i: int) -> dict[str, Any]:
    smes = json.loads(SMES_FILE.read_text(encoding="utf-8"))
    company = Company.from_dict(smes[i])
    if i < 40:
        # one generator per case: results do not depend on the order cases run in
        return run_stochastic(i + 1, company, EVENTS[i % len(EVENTS)], Catalog.load(), np.random.default_rng(99 + i))
    return run_deterministic(i + 1, company)


def run(limit: int | None = None, out_dir: Path = RESULTS_DIR, verbose: bool = True,
        workers: int = WORKERS) -> dict[str, Any]:
    """Cases run in parallel processes; latencies are therefore measured with `workers` cases
    sharing the machine (conservative)."""
    from concurrent.futures import ProcessPoolExecutor
    n = 50 if limit is None else limit
    t_start = time.perf_counter()
    with ProcessPoolExecutor(max_workers=workers) as ex:
        rows = list(ex.map(_case, range(n)))
    for row in rows:
        if verbose:
            print(f"case {row['case']:02d} {row['kind'][:5]} {row['company_id']} {row['event']:<17} "
                  f"success={row['success']} detect={row['detect_ok']} crunch={row['crunch_ok']} plan={row['plan_ok']}"
                  + (f" cov={row.get('oracle_coverage')} save={row.get('savings_pct')}" if 'oracle_coverage' in row else ""),
                  flush=True)
    summary = summarize(rows, time.perf_counter() - t_start)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "bench_results.json").write_text(json.dumps({"summary": summary, "cases": rows}, indent=1), encoding="utf-8")
    (out_dir / "bench_summary.md").write_text(render_markdown(summary, rows), encoding="utf-8")
    return summary


def summarize(rows: list[dict[str, Any]], seconds: float) -> dict[str, Any]:
    def rate(key, subset=None):
        sub = [r for r in rows if subset is None or subset(r)]
        return round(sum(r[key] for r in sub) / len(sub), 4) if sub else None

    planned = [r for r in rows if "savings_pct" in r]
    cov = [r["oracle_coverage"] for r in rows if "oracle_coverage" in r]
    return {
        "n_cases": len(rows),
        "success_rate": rate("success"),
        "success_rate_stochastic": rate("success", lambda r: r["kind"] == "stochastic"),
        "success_rate_deterministic": rate("success", lambda r: r["kind"] == "deterministic"),
        "detect_accuracy": rate("detect_ok"),
        "crunch_day_accuracy": rate("crunch_ok"),
        "plan_validity": rate("plan_ok", lambda r: "plan_status" in r),
        "cases_needing_financing": sum(1 for r in rows if r.get("needs_financing")),
        "plans_built": sum(1 for r in rows if "plan_cost_clp" in r),
        "mean_oracle_coverage": round(statistics.mean(cov), 4) if cov else None,
        "min_oracle_coverage": round(min(cov), 4) if cov else None,
        "mean_savings_vs_default_pct": round(statistics.mean(r["savings_pct"] for r in planned), 4) if planned else None,
        "median_savings_vs_default_pct": round(statistics.median(r["savings_pct"] for r in planned), 4) if planned else None,
        "total_savings_clp": sum(r["savings_clp"] for r in planned),
        "median_forecast_ms": round(statistics.median(r["forecast_ms"] for r in rows)),
        "median_optimize_ms": round(statistics.median(r["optimize_ms"] for r in rows if "optimize_ms" in r)) if any("optimize_ms" in r for r in rows) else None,
        "p90_optimize_ms": round(float(np.quantile([r["optimize_ms"] for r in rows if "optimize_ms" in r], 0.9))) if any("optimize_ms" in r for r in rows) else None,
        "mean_excess_vs_offline": round(statistics.mean(r["excess_vs_offline"] for r in rows if "excess_vs_offline" in r), 4) if any("excess_vs_offline" in r for r in rows) else None,
        "max_excess_vs_offline": round(max(r["excess_vs_offline"] for r in rows if "excess_vs_offline" in r), 4) if any("excess_vs_offline" in r for r in rows) else None,
        "runtime_s": round(seconds, 1),
    }


def render_markdown(summary: dict[str, Any], rows: list[dict[str, Any]]) -> str:
    pct = lambda v: "n/a" if v is None else f"{v:.1%}"
    lines = [
        "# NanFeng-Bench results", "",
        "Generated by `python -m nanfeng_quant bench`. All companies are synthetic.", "",
        "| Metric | Value |", "|---|---|",
        f"| Cases | {summary['n_cases']} (40 stochastic, 10 deterministic) |",
        f"| **Success rate** | **{pct(summary['success_rate'])}** |",
        f"| Success rate, stochastic | {pct(summary['success_rate_stochastic'])} |",
        f"| Success rate, deterministic (exact ledger) | {pct(summary['success_rate_deterministic'])} |",
        f"| Risk detection accuracy | {pct(summary['detect_accuracy'])} |",
        f"| Crunch day within ±{CRUNCH_TOL_DAYS} days | {pct(summary['crunch_day_accuracy'])} |",
        f"| Plan validity (oracle coverage ≥ {TARGET - COVERAGE_TOL:.0%} and cost ≤ default) | {pct(summary['plan_validity'])} |",
        f"| Plans built | {summary['plans_built']} |",
        f"| Mean / min oracle coverage of plans | {pct(summary['mean_oracle_coverage'])} / {pct(summary['min_oracle_coverage'])} |",
        f"| Mean / median savings vs. default bank loan | {pct(summary['mean_savings_vs_default_pct'])} / {pct(summary['median_savings_vs_default_pct'])} |",
        f"| Total savings across plans | CLP {summary['total_savings_clp']:,.0f} |",
        f"| Median latency forecast / optimize (plan + default loan) | {summary['median_forecast_ms']} ms / {summary['median_optimize_ms']} ms |",
        f"| p90 latency optimize | {summary['p90_optimize_ms']} ms |",
        f"| Online plan cost vs. {OFFLINE_LIMIT_S:.0f} s offline solve (mean / max excess) | {pct(summary['mean_excess_vs_offline'])} / {pct(summary['max_excess_vs_offline'])} |",
        f"| Runtime | {summary['runtime_s']} s ({WORKERS} cases in parallel; latencies measured under that load) |", "",
        "## Cases", "",
        "| # | Kind | SME | Event | Oracle P(<buffer) | System | Crunch (oracle/system) | Coverage | Savings | OK |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        if r["kind"] == "stochastic":
            lines.append(f"| {r['case']} | stoch | {r['company_id']} | {r['event_text']} | {pct(r['oracle_p_below_buffer'])} | "
                         f"{pct(r['system_p_below_buffer'])} | {r['oracle_crunch_day']} / {r['system_crunch_day']} | "
                         f"{pct(r.get('oracle_coverage'))} | {pct(r.get('savings_pct'))} | {'✅' if r['success'] else '❌'} |")
        else:
            lines.append(f"| {r['case']} | determ | {r['company_id']} | exact ledger, max error CLP {r['max_abs_error_clp']} | – | – | "
                         f"{r['true_crunch_day']} / {r['system_crunch_day']} | – | – | {'✅' if r['success'] else '❌'} |")
    return "\n".join(lines) + "\n"
