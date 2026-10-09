"""Forecast backtests: CRPS and interval coverage.

1. FX (real data). Rolling origins every 10 business days since 2018. At each origin only the
   history up to that day is used; the bootstrap forecast of the 30/60/90-day log change in
   CLP per USD and CLP per CNY is scored against what actually happened, and compared with a
   Gaussian random walk using trailing one-year volatility.
2. Cash (synthetic truth). We have no real SME ledgers, so the "truth" paths are generated
   (a) from the model itself with an independent seed (well specified: checks the pipeline),
   and (b) from a deliberately different process: fatter payment-delay tails, more volatile
   cherry prices and a different FX regime (misspecified: checks robustness). Forecasts are
   scored against a deterministic point forecast (median delays, spot FX) as the benchmark.

CRPS (continuous ranked probability score) is the probabilistic analogue of the absolute
error: lower is better, and for a point forecast it equals the MAE.
"""
from __future__ import annotations

import copy
import datetime as dt
import json
from pathlib import Path
from typing import Any

import numpy as np
from scipy import stats

from .fx import load_history, simulate_fx
from .model import Company
from .montecarlo import simulate

ROOT = Path(__file__).resolve().parents[1]
RESULTS_DIR = ROOT / "results"
SMES_FILE = ROOT / "data" / "synthetic" / "smes.json"


def crps_samples(samples: np.ndarray, y: float) -> float:
    """CRPS of an empirical distribution: E|X - y| - 0.5 E|X - X'| (sorted-sample identity)."""
    x = np.sort(np.asarray(samples, dtype=float))
    n = x.size
    term1 = np.mean(np.abs(x - y))
    term2 = np.sum((2 * np.arange(1, n + 1) - n - 1) * x) / (n * n)
    return float(term1 - term2)


def crps_gaussian(mu: float, sigma: float, y: float) -> float:
    z = (y - mu) / sigma
    return float(sigma * (z * (2 * stats.norm.cdf(z) - 1) + 2 * stats.norm.pdf(z) - 1 / np.sqrt(np.pi)))


# ---------------------------------------------------------------------------
# 1. FX backtest on real data
# ---------------------------------------------------------------------------

def fx_backtest(start: str = "2018-01-01", step_bdays: int = 10, horizons=(30, 60, 90),
                n_paths: int = 2000, seed: int = 0) -> dict[str, Any]:
    hist = load_history()
    dates = hist.dates.astype("datetime64[D]").astype(object)
    rng = np.random.default_rng(seed)
    last_origin = dates[-1] - dt.timedelta(days=max(horizons) + 5)
    origins = [d for d in dates[::step_bdays] if dt.date.fromisoformat(start) <= d <= last_origin]
    names = ("clp_per_usd", "clp_per_cny")
    level = {"clp_per_usd": hist.clp_per_usd, "clp_per_cny": hist.clp_per_usd / hist.cny_per_usd}
    rets_all = np.diff(np.log(np.column_stack([level[n] for n in names])), axis=0)
    rows = {(n, h): {"crps_boot": [], "crps_gauss": [], "cover_boot": [], "cover_gauss": []}
            for n in names for h in horizons}

    for o in origins:
        i0 = int(np.searchsorted(dates, o))
        sub = hist.window(end=o)
        paths = simulate_fx(o, max(horizons), n_paths, rng, spot=sub.spot(), history=sub)
        trailing = rets_all[max(0, i0 - 252):i0]
        for k, n in enumerate(names):
            sim = paths.clp_per_usd if n == "clp_per_usd" else paths.clp_per_cny
            s0 = level[n][i0]
            for h in horizons:
                j = int(np.searchsorted(dates, o + dt.timedelta(days=h)))
                y = float(np.log(level[n][j] / s0))
                fc = np.log(sim[:, h] / sim[:, 0])
                lo, hi = np.quantile(fc, [0.10, 0.90])
                bdays = int(np.busday_count(np.datetime64(o), np.datetime64(o + dt.timedelta(days=h))))
                sig = float(trailing[:, k].std(ddof=1) * np.sqrt(bdays))
                z = stats.norm.ppf(0.90)
                r = rows[(n, h)]
                r["crps_boot"].append(crps_samples(fc, y))
                r["crps_gauss"].append(crps_gaussian(0.0, sig, y))
                r["cover_boot"].append(lo <= y <= hi)
                r["cover_gauss"].append(-z * sig <= y <= z * sig)

    table = []
    for (n, h), r in rows.items():
        cb, cg = np.mean(r["crps_boot"]), np.mean(r["crps_gauss"])
        table.append({"series": n, "horizon_days": h, "n_origins": len(r["crps_boot"]),
                      "crps_bootstrap_bp": round(cb * 1e4, 1), "crps_gaussian_rw_bp": round(cg * 1e4, 1),
                      "crps_skill_vs_gaussian": round(1 - cb / cg, 4),
                      "coverage_p10_p90_bootstrap": round(float(np.mean(r["cover_boot"])), 4),
                      "coverage_p10_p90_gaussian": round(float(np.mean(r["cover_gauss"])), 4)})
    return {"origins": len(origins), "first_origin": str(origins[0]), "last_origin": str(origins[-1]),
            "nominal_coverage": 0.80, "table": table}


# ---------------------------------------------------------------------------
# 2. Cash backtest on synthetic truth
# ---------------------------------------------------------------------------

def _misspecified(company: Company) -> Company:
    c = copy.deepcopy(company)
    for cu in c.customers:
        cu.delay_sigma *= 1.5  # fatter payment-delay tails than the model assumes
        cu.p_default = min(cu.p_default * 2, 0.2)
    c.price_volatility *= 1.4
    return c


def point_forecast(company: Company) -> np.ndarray:
    """Deterministic benchmark: median delays, spot FX, expected price, no defaults."""
    det = copy.deepcopy(company)
    for cu in det.customers:
        cu.delay_sigma = 0.0
        cu.p_default = 0.0
    det.price_volatility = 0.0
    return simulate(det, 1, 0, {"freeze_fx": True}).cash[0]


def cash_backtest(n_companies: int = 20, n_truths: int = 25, n_paths: int = 4000,
                  days=(30, 60, 90)) -> dict[str, Any]:
    smes = [Company.from_dict(d) for d in json.loads(SMES_FILE.read_text(encoding="utf-8"))][:n_companies]
    out = {}
    for label in ("well_specified", "misspecified"):
        acc = {d: {"crps": [], "crps_point": [], "cover": [], "scale": []} for d in days}
        brier, brier_clim, events = [], [], []
        for i, comp in enumerate(smes):
            fc = simulate(comp, n_paths, seed=7)
            point = point_forecast(comp)
            if label == "well_specified":
                truth = simulate(comp, n_truths, seed=10_000 + i)
            else:
                truth = simulate(_misspecified(comp), n_truths, seed=10_000 + i,
                                 fx_kwargs={"lookback_years": 15, "mean_block": 30.0})
            p_breach = fc.p_below(comp.min_cash_buffer_clp)
            hit = (truth.cash[:, 1:].min(axis=1) < comp.min_cash_buffer_clp).astype(float)
            brier.extend((p_breach - hit) ** 2)
            events.extend(hit)
            for d in days:
                q10, q90 = np.quantile(fc.cash[:, d], [0.10, 0.90])
                for y in truth.cash[:, d]:
                    acc[d]["crps"].append(crps_samples(fc.cash[:, d], y))
                    acc[d]["crps_point"].append(abs(point[d] - y))
                    acc[d]["cover"].append(q10 <= y <= q90)
                    acc[d]["scale"].append(abs(y))
        base_rate = float(np.mean(events))
        brier_clim = [(base_rate - e) ** 2 for e in events]
        table = []
        for d in days:
            a = acc[d]
            c, cp = np.mean(a["crps"]), np.mean(a["crps_point"])
            table.append({"day": d, "crps_mclp": round(c / 1e6, 2), "mae_point_mclp": round(cp / 1e6, 2),
                          "crps_skill_vs_point": round(1 - c / cp, 4),
                          "relative_crps": round(c / np.mean(a["scale"]), 4),
                          "coverage_p10_p90": round(float(np.mean(a["cover"])), 4)})
        out[label] = {"n_companies": len(smes), "truth_paths_per_company": n_truths, "table": table,
                      "breach_event_rate": round(base_rate, 4),
                      "brier_breach": round(float(np.mean(brier)), 4),
                      "brier_climatology": round(float(np.mean(brier_clim)), 4),
                      "brier_skill": round(1 - float(np.mean(brier)) / float(np.mean(brier_clim)), 4) if np.mean(brier_clim) else None}
    return out


def run(out_dir: Path = RESULTS_DIR) -> dict[str, Any]:
    result = {"fx": fx_backtest(), "cash": cash_backtest()}
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "backtest_results.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    (out_dir / "backtest_summary.md").write_text(render_markdown(result), encoding="utf-8")
    return result


def render_markdown(r: dict[str, Any]) -> str:
    fx = r["fx"]
    lines = ["# Forecast backtest", "", "Generated by `python -m nanfeng_quant backtest`.", "",
             f"## 1. FX, real data ({fx['origins']} rolling origins, {fx['first_origin']} → {fx['last_origin']})", "",
             "CRPS of the log change, in basis points (lower is better). Nominal P10–P90 coverage is 80%.", "",
             "| Series | Horizon | CRPS bootstrap | CRPS Gaussian RW | Skill | Coverage bootstrap | Coverage Gaussian |",
             "|---|---|---|---|---|---|---|"]
    for t in fx["table"]:
        lines.append(f"| {t['series']} | {t['horizon_days']} d | {t['crps_bootstrap_bp']} | {t['crps_gaussian_rw_bp']} | "
                     f"{t['crps_skill_vs_gaussian']:+.1%} | {t['coverage_p10_p90_bootstrap']:.1%} | {t['coverage_p10_p90_gaussian']:.1%} |")
    for label, title in (("well_specified", "well-specified truth"), ("misspecified", "misspecified truth")):
        c = r["cash"][label]
        lines += ["", f"## 2. Cash, {title} ({c['n_companies']} synthetic SMEs × {c['truth_paths_per_company']} truth paths)", "",
                  "| Day | CRPS (MCLP) | MAE point forecast (MCLP) | CRPS skill vs point | Relative CRPS | P10–P90 coverage |",
                  "|---|---|---|---|---|---|"]
        for t in c["table"]:
            lines.append(f"| {t['day']} | {t['crps_mclp']} | {t['mae_point_mclp']} | {t['crps_skill_vs_point']:+.1%} | "
                         f"{t['relative_crps']:.1%} | {t['coverage_p10_p90']:.1%} |")
        lines.append(f"\nBuffer-breach probability: Brier {c['brier_breach']} vs climatology {c['brier_climatology']} "
                     f"(skill {c['brier_skill']:+.1%}), event rate {c['breach_event_rate']:.1%}.")
    return "\n".join(lines) + "\n"
