"""FX history and joint bootstrap of daily log-returns (USD/CLP and USD/CNY).

Returns are taken on common business days so the CLP/CNY correlation is kept.
A stationary block bootstrap (Politis & Romano, 1994) keeps volatility clusters.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

FX_DIR = Path(__file__).resolve().parents[1] / "data" / "fx"
USDCLP_FILE = FX_DIR / "usdclp_observado.csv"
USDCNY_FILE = FX_DIR / "usdcny_fred.csv"


@dataclass(frozen=True)
class FxHistory:
    dates: np.ndarray  # business days with both quotes
    clp_per_usd: np.ndarray
    cny_per_usd: np.ndarray

    @property
    def log_returns(self) -> np.ndarray:
        """(n-1, 2) daily log-returns of [CLP per USD, CLP per CNY]."""
        clp_per_cny = self.clp_per_usd / self.cny_per_usd
        levels = np.log(np.column_stack([self.clp_per_usd, clp_per_cny]))
        return np.diff(levels, axis=0)

    def spot(self) -> dict[str, float]:
        return {"clp_per_usd": float(self.clp_per_usd[-1]), "cny_per_usd": float(self.cny_per_usd[-1])}

    def window(self, start: dt.date | None = None, end: dt.date | None = None) -> "FxHistory":
        mask = np.ones(len(self.dates), dtype=bool)
        if start is not None:
            mask &= self.dates >= np.datetime64(start)
        if end is not None:
            mask &= self.dates <= np.datetime64(end)
        return FxHistory(self.dates[mask], self.clp_per_usd[mask], self.cny_per_usd[mask])


@lru_cache(maxsize=1)
def load_history() -> FxHistory:
    clp = pd.read_csv(USDCLP_FILE, parse_dates=["date"]).set_index("date")["clp_per_usd"]
    cny = pd.read_csv(USDCNY_FILE, parse_dates=["date"]).set_index("date")["cny_per_usd"]
    # Inner join on dates: keeps only days with both quotes (no forward fill bias).
    df = pd.concat([clp, cny], axis=1, join="inner").dropna().sort_index()
    return FxHistory(df.index.values.astype("datetime64[D]"), df["clp_per_usd"].to_numpy(), df["cny_per_usd"].to_numpy())


def stationary_bootstrap_indices(n_obs: int, n_paths: int, n_steps: int, mean_block: float,
                                 rng: np.random.Generator) -> np.ndarray:
    """(n_paths, n_steps) indices into a return series of length n_obs."""
    p_new = 1.0 / mean_block
    idx = np.empty((n_paths, n_steps), dtype=np.int64)
    idx[:, 0] = rng.integers(0, n_obs, n_paths)
    new_block = rng.random((n_paths, n_steps)) < p_new
    fresh = rng.integers(0, n_obs, (n_paths, n_steps))
    for t in range(1, n_steps):
        idx[:, t] = np.where(new_block[:, t], fresh[:, t], (idx[:, t - 1] + 1) % n_obs)
    return idx


@dataclass
class FxPaths:
    clp_per_usd: np.ndarray  # (n_paths, horizon + 1), index 0 = spot
    clp_per_cny: np.ndarray

    def rate(self, currency: str) -> np.ndarray:
        if currency == "USD":
            return self.clp_per_usd
        if currency == "CNY":
            return self.clp_per_cny
        if currency == "CLP":
            return np.ones_like(self.clp_per_usd)
        raise ValueError(currency)


def simulate_fx(as_of: dt.date, horizon_days: int, n_paths: int, rng: np.random.Generator,
                spot: dict[str, float] | None = None, history: FxHistory | None = None,
                lookback_years: int = 5, mean_block: float = 10.0,
                cny_shift_pct: float = 0.0, usd_shift_pct: float = 0.0, freeze: bool = False) -> FxPaths:
    """Calendar-day FX paths. Weekends carry no return; weekdays draw a bootstrapped day.

    The random draws do not depend on `freeze` or `cny_shift_pct`, so counterfactual runs
    with the same seed stay on common random numbers.
    """
    hist = history or load_history()
    end = min(as_of, hist.dates[-1].astype(dt.date))
    hist = hist.window(start=end - dt.timedelta(days=365 * lookback_years), end=end)
    rets = hist.log_returns
    spot = spot or hist.spot()
    s_usd = spot["clp_per_usd"]
    s_cny = spot["clp_per_usd"] / spot["cny_per_usd"]

    calendar = [as_of + dt.timedelta(days=d) for d in range(1, horizon_days + 1)]
    weekday = np.array([d.weekday() < 5 for d in calendar])
    n_steps = int(weekday.sum())
    idx = stationary_bootstrap_indices(len(rets), n_paths, max(n_steps, 1), mean_block, rng)

    daily = np.zeros((n_paths, horizon_days, 2))
    if not freeze:
        daily[:, weekday, :] = rets[idx[:, :n_steps]]
    cum = np.concatenate([np.zeros((n_paths, 1, 2)), np.cumsum(daily, axis=1)], axis=1)
    # Level shocks (Scenario Lab): the CLP value of one USD / one CNY moves by x% from today on.
    usd = s_usd * np.exp(cum[:, :, 0]) * (1.0 + usd_shift_pct / 100.0)
    cny = s_cny * np.exp(cum[:, :, 1]) * (1.0 + cny_shift_pct / 100.0)
    return FxPaths(usd, cny)
