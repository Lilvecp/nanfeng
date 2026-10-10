"""90-day cash Monte Carlo.

Per path: customer payment delays (lognormal), joint FX bootstrap (USD/CLP, CNY/CLP),
cherry price shock on not-yet-invoiced shipments, and customer defaults. Payables are
deterministic in their own currency and converted with the simulated FX.

Every random draw is made in a fixed order with fixed shapes, so two runs with the same
seed but different overrides share common random numbers (used for explainability).
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .fx import FxPaths, simulate_fx
from .model import Company

NEVER = np.iinfo(np.int64).max // 2  # pay-day sentinel: not paid inside the horizon
# Parameter uncertainty: per path, each customer's median delay and dispersion and the cherry
# price volatility are scaled by exp(tau * Z - tau^2 / 2). This fattens the tails to reflect that
# the parameters themselves are estimates (calibrated in results/backtest_summary.md).
PARAM_UNCERTAINTY = 0.5
# Systemic share of that uncertainty: in a bad season every importer pays late at once (port
# congestion, a price collapse in China, Lunar New Year). Per path, each customer's parameter
# shock is rho * Z_common + sqrt(1 - rho^2) * Z_customer, so delays are correlated across customers.
SYSTEMIC_SHARE = 0.6


@dataclass
class Overrides:
    """Scenario Lab knobs and counterfactual switches."""
    customer_delay_extra_days: dict[str, float] = field(default_factory=dict)  # per customer id
    global_delay_extra_days: float = 0.0
    cny_shift_pct: float = 0.0
    usd_shift_pct: float = 0.0
    cherry_price_pct: float = 0.0
    extra_hires: int = 0
    hire_monthly_wage_clp: float = 750_000.0  # assumption: harvest crew cost incl. employer contributions
    on_time_customers: list[str] = field(default_factory=list)  # counterfactual: pays on the due date
    defaulted_customers: list[str] = field(default_factory=list)  # stress: never pays inside the horizon
    ignore_announced_delays: bool = False
    freeze_fx: bool = False
    freeze_price: bool = False

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "Overrides":
        return cls(**(data or {}))


@dataclass
class ForecastResult:
    company: Company
    dates: list[dt.date]
    cash: np.ndarray  # (n_paths, T+1) end-of-day cash in CLP
    flows: np.ndarray  # (n_paths, T+1) net daily flow in CLP
    fx: FxPaths
    receivable_pay_day: np.ndarray  # (n_paths, n_receivables), NEVER if unpaid in horizon
    seed: int
    overrides: Overrides

    # ---- statistics ----------------------------------------------------
    @property
    def n_paths(self) -> int:
        return self.cash.shape[0]

    def quantiles(self, qs=(0.10, 0.50, 0.90)) -> dict[str, np.ndarray]:
        values = np.quantile(self.cash, qs, axis=0)
        return {f"p{int(round(q * 100))}": v for q, v in zip(qs, values)}

    @property
    def p_negative_by_day(self) -> np.ndarray:
        """Marginal probability that cash is below zero at the end of each day."""
        return (self.cash < 0).mean(axis=0)

    @property
    def p_negative_cumulative(self) -> np.ndarray:
        """Probability that cash has gone below zero at least once up to each day."""
        return (np.minimum.accumulate(self.cash, axis=1) < 0).mean(axis=0)

    def p_below(self, level: float) -> float:
        """Probability of going below `level` on some day 1..T (today's balance is a fact, not a forecast)."""
        return float((self.cash[:, 1:].min(axis=1) < level).mean())

    def crunch_day(self, threshold: float = 0.5) -> int | None:
        """First day where the marginal probability of negative cash reaches `threshold`."""
        hit = np.nonzero(self.p_negative_by_day >= threshold)[0]
        return int(hit[0]) if hit.size else None

    def first_negative_day(self) -> np.ndarray:
        neg = self.cash < 0
        first = np.where(neg.any(axis=1), neg.argmax(axis=1), -1)
        return first[first >= 0]

    def summary(self) -> dict[str, Any]:
        q = self.quantiles()
        crunch = self.crunch_day()
        first = self.first_negative_day()
        p_cum = self.p_negative_cumulative
        out = {
            "company_id": self.company.id,
            "as_of": self.company.as_of.isoformat(),
            "horizon_days": self.company.horizon_days,
            "n_paths": self.n_paths,
            "seed": self.seed,
            "prob_negative_cash_horizon": round(float(p_cum[-1]), 4),
            "prob_below_buffer_horizon": round(self.p_below(self.company.min_cash_buffer_clp), 4),
            "crunch_day": crunch,
            "crunch_date": self.dates[crunch].isoformat() if crunch is not None else None,
            "prob_negative_by_crunch_day": round(float(p_cum[crunch]), 4) if crunch is not None else None,
            "first_negative_day_median": float(np.median(first)) if first.size else None,
            "min_cash_p10": float(np.quantile(self.cash.min(axis=1), 0.10)),
            "min_cash_p50": float(np.quantile(self.cash.min(axis=1), 0.50)),
            "ending_cash": {k: float(v[-1]) for k, v in q.items()},
        }
        if crunch is not None:
            out["headline"] = (f"{p_cum[crunch]:.0%} probability of negative cash in {crunch} days "
                               f"({self.dates[crunch].isoformat()})")
        else:
            out["headline"] = f"{p_cum[-1]:.0%} probability of negative cash within {self.company.horizon_days} days"
        return out

    def fan_chart(self) -> dict[str, Any]:
        """Payload for the Cash Cockpit fan chart (P10/P50/P90 per day)."""
        q = self.quantiles()
        return {
            "dates": [d.isoformat() for d in self.dates],
            "p10": np.round(q["p10"]).tolist(),
            "p50": np.round(q["p50"]).tolist(),
            "p90": np.round(q["p90"]).tolist(),
            "p_negative": np.round(self.p_negative_by_day, 4).tolist(),
            "buffer": self.company.min_cash_buffer_clp,
        }


def _delays(rng_z: np.ndarray, median: float, sigma: float) -> np.ndarray:
    return np.maximum(np.rint((1.0 + median) * np.exp(sigma * rng_z) - 1.0), 0.0)


def simulate(company: Company, n_paths: int = 10_000, seed: int = 7,
             overrides: Overrides | dict | None = None, fx_kwargs: dict | None = None,
             param_uncertainty: float | None = None, systemic_share: float | None = None) -> ForecastResult:
    ov = overrides if isinstance(overrides, Overrides) else Overrides.from_dict(overrides)
    tau = PARAM_UNCERTAINTY if param_uncertainty is None else param_uncertainty
    rho = SYSTEMIC_SHARE if systemic_share is None else systemic_share
    rng = np.random.default_rng(seed)
    T = company.horizon_days
    n_items = len(company.receivables) + len(company.shipments)

    # Fixed draw order: FX, delays, defaults, price.
    fx = simulate_fx(company.as_of, T, n_paths, rng, spot=company.fx_spot,
                     cny_shift_pct=ov.cny_shift_pct, usd_shift_pct=ov.usd_shift_pct, freeze=ov.freeze_fx,
                     **(fx_kwargs or {}))
    z_delay = rng.standard_normal((n_paths, max(n_items, 1)))
    u_default = rng.random((n_paths, max(n_items, 1)))
    z_price = rng.standard_normal(n_paths)
    # Drawn last and always with the same shape, so tau = 0 reproduces earlier results exactly.
    n_c = max(len(company.customers), 1)
    z_med = rng.standard_normal((n_paths, n_c))
    z_sig = rng.standard_normal((n_paths, n_c))
    z_pvol = rng.standard_normal(n_paths)
    # Drawn after everything else, so rho = 0 reproduces the per-customer model exactly.
    z_sys = rng.standard_normal((n_paths, 1))
    w = np.sqrt(max(1.0 - rho ** 2, 0.0))
    z_med = rho * z_sys + w * z_med
    z_sig = rho * z_sys + w * z_sig
    cidx = {c.id: i for i, c in enumerate(company.customers)}

    def scale(z: np.ndarray) -> np.ndarray:
        return np.exp(tau * z - 0.5 * tau ** 2) if tau > 0 else np.ones_like(z)

    def delay_params(c) -> tuple[np.ndarray, np.ndarray]:
        i = cidx[c.id]
        med = (1.0 + c.delay_median_days) * scale(z_med[:, i]) - 1.0
        return np.maximum(med, 0.0), c.delay_sigma * scale(z_sig[:, i])

    sigma_p = company.price_volatility * scale(z_pvol)
    price = np.ones(n_paths) if ov.freeze_price else np.exp(sigma_p * z_price - 0.5 * sigma_p ** 2)
    price = price * (1.0 + ov.cherry_price_pct / 100.0)

    flows = np.zeros((n_paths, T + 1))
    rows = np.arange(n_paths)

    def add_inflow(day: np.ndarray, amount: np.ndarray, currency: str) -> None:
        ok = day <= T
        d = day[ok].astype(np.int64)
        flows[rows[ok], d] += amount[ok] * fx.rate(currency)[rows[ok], d]

    def extra_delay(customer_id: str) -> float:
        return ov.global_delay_extra_days + ov.customer_delay_extra_days.get(customer_id, 0.0)

    pay_days = np.full((n_paths, len(company.receivables)), NEVER, dtype=np.int64)
    for j, r in enumerate(company.receivables):
        c = company.customer(r.customer_id)
        if c.id in ov.on_time_customers:
            delay = np.zeros(n_paths)
            announced = 0
        else:
            delay = _delays(z_delay[:, j], *delay_params(c)) + extra_delay(c.id)
            announced = 0 if ov.ignore_announced_delays else r.announced_delay_days
        day = np.maximum(company.day(r.due_date) + announced + delay, 1).astype(np.int64)
        day = np.where((u_default[:, j] < c.p_default) | (c.id in ov.defaulted_customers), NEVER, day)
        pay_days[:, j] = day
        add_inflow(day, np.full(n_paths, r.amount), r.currency)

    offset = len(company.receivables)
    for k, s in enumerate(company.shipments):
        j = offset + k
        c = company.customer(s.customer_id)
        ship = company.day(s.ship_date)
        if ship < 0:
            continue
        amount = s.expected_amount * price
        if s.advance_pct > 0:
            add_inflow(np.full(n_paths, ship), amount * s.advance_pct, s.currency)
        if c.id in ov.on_time_customers:
            delay = np.zeros(n_paths)
        else:
            delay = _delays(z_delay[:, j], *delay_params(c)) + extra_delay(c.id)
        day = (ship + s.terms_days + delay).astype(np.int64)
        day = np.where((u_default[:, j] < c.p_default) | (c.id in ov.defaulted_customers), NEVER, day)
        add_inflow(day, amount * (1.0 - s.advance_pct), s.currency)

    for p in company.payables:
        d = company.day(p.date)
        if 0 <= d <= T:
            flows[:, d] -= p.amount * fx.rate(p.currency)[:, d]
    if ov.extra_hires:
        for p in company.payables:
            d = company.day(p.date)
            if p.category == "payroll" and 0 <= d <= T:
                flows[:, d] -= ov.extra_hires * ov.hire_monthly_wage_clp

    cash = company.opening_cash_clp + np.cumsum(flows, axis=1)
    return ForecastResult(company, company.dates(), cash, flows, fx, pay_days, seed, ov)
