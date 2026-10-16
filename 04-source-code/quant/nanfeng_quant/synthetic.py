"""Synthetic data generator: Chilean cherry exporters with a Nov-Feb season.

Each SME gets customers (mostly Mainland China, paid in USD or CNY), a season of weekly
shipments, receivables for shipments already made, and the seasonal cost structure of a
cherry exporter (harvest payroll, packing, packaging, ocean freight, debt service, taxes).
All parameters below are documented assumptions, not observed data, and every company is
flagged synthetic. Output follows the same schema as the Cherry Crisis scenario.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

import numpy as np

from .fx import load_history

OUT_FILE = Path(__file__).resolve().parents[1] / "data" / "synthetic" / "smes.json"

SEASON_START = dt.date(2026, 11, 10)
SEASON_END = dt.date(2027, 2, 10)
SEASON_SHARE = 0.85  # share of annual revenue shipped in the Nov-Feb window

# reliability class -> (median delay days, sigma, default probability)
RELIABILITY = {"good": (3, 0.4, 0.002), "average": (8, 0.6, 0.01), "slow": (18, 0.7, 0.03)}
MARKETS = [  # (country, weight, P(CNY invoicing))
    ("Mainland China", 0.70, 0.35),
    ("Hong Kong SAR", 0.08, 0.0),
    ("United States", 0.08, 0.0),
    ("Netherlands", 0.05, 0.0),
    ("Republic of Korea", 0.05, 0.0),
    ("Chinese Taipei", 0.04, 0.0),
]
PREFIX = ["Valle", "Cordillera", "Río", "Cerro", "Huerto", "Fundo", "Agrícola", "Frutícola", "Campo", "Altos"]
SUFFIX = ["del Maule", "de Rengo", "Curicó", "Los Andes", "Colchagua", "Cachapoal", "San Fernando", "Linares",
          "Molina", "Teno", "Chimbarongo", "Requínoa"]


def _month_ends(start: dt.date, end: dt.date) -> list[dt.date]:
    out = []
    d = dt.date(start.year, start.month, 1)
    while d <= end:
        nxt = dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1)
        last = nxt - dt.timedelta(days=1)
        while last.weekday() >= 5:  # last business day
            last -= dt.timedelta(days=1)
        out.append(last)
        d = nxt
    return out


def _monthly(day: int, start: dt.date, end: dt.date) -> list[dt.date]:
    out = []
    d = dt.date(start.year, start.month, 1)
    while d <= end:
        out.append(dt.date(d.year, d.month, min(day, 28)))
        d = dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    return out


def generate_company(idx: int, rng: np.random.Generator, spot: dict[str, float]) -> dict[str, Any]:
    clp_usd = spot["clp_per_usd"]
    clp_cny = clp_usd / spot["cny_per_usd"]
    sales_usd = float(np.clip(rng.lognormal(np.log(3.0e6), 0.6), 0.8e6, 15e6))
    as_of = SEASON_START + dt.timedelta(days=int(rng.integers(20, 85)))
    horizon = 90
    end = as_of + dt.timedelta(days=horizon)

    # customers
    n_c = int(rng.integers(3, 7))
    weights = np.array([m[1] for m in MARKETS])
    customers = []
    for k in range(n_c):
        country, _, p_cny = MARKETS[rng.choice(len(MARKETS), p=weights / weights.sum())]
        cls = rng.choice(list(RELIABILITY), p=[0.45, 0.40, 0.15])
        med, sig, pd = RELIABILITY[cls]
        customers.append({
            "id": f"C{k + 1}", "name": f"Importer {k + 1} ({country}, fictional)", "country": country,
            "currency": "CNY" if rng.random() < p_cny else "USD",
            "delay_median_days": float(med), "delay_sigma": sig, "p_default": pd,
            "_advance": float(rng.choice([0.0, 0.10, 0.15, 0.20, 0.30])) if country == "Mainland China" else 0.0,
            "_terms": int(rng.choice([30, 45, 60, 75, 90])),
            "_lc": bool(country != "Mainland China" and rng.random() < 0.25),
        })
    share = rng.dirichlet(np.ones(n_c) * 1.5)

    # season of weekly shipments
    season_rev_usd = sales_usd * SEASON_SHARE
    n_weeks = (SEASON_END - SEASON_START).days // 7 + 1
    week_w = np.exp(-0.5 * ((np.arange(n_weeks) - n_weeks * 0.45) / (n_weeks * 0.28)) ** 2)  # peak mid-December
    week_w /= week_w.sum()
    receivables, shipments, payables = [], [], []
    for w in range(n_weeks):
        ship_date = SEASON_START + dt.timedelta(days=7 * w)
        for k, c in enumerate(customers):
            value_usd = season_rev_usd * week_w[w] * share[k] * float(rng.lognormal(0, 0.15))
            if value_usd < 15_000:
                continue
            amount = value_usd if c["currency"] == "USD" else value_usd * clp_usd / clp_cny
            sid = f"S{w + 1:02d}-{c['id']}"
            if ship_date < as_of:
                due = ship_date + dt.timedelta(days=c["_terms"])
                receivables.append({"id": f"INV-{idx:02d}-{sid}", "customer_id": c["id"], "currency": c["currency"],
                                    "amount": round(amount * (1 - c["_advance"]), 2), "due_date": due.isoformat(),
                                    "factoring_eligible": True, "lc_backed": c["_lc"]})
            elif ship_date <= end:
                shipments.append({"id": sid, "customer_id": c["id"], "currency": c["currency"],
                                  "ship_date": ship_date.isoformat(), "expected_amount": round(amount, 2),
                                  "advance_pct": c["_advance"], "terms_days": c["_terms"]})
            # packing and packaging (CLP, 15 days after shipment) and ocean freight (USD, 5 days after)
            pay_pack = ship_date + dt.timedelta(days=15)
            if as_of <= pay_pack <= end:
                payables.append({"id": f"PK-{sid}", "name": "Packing and packaging", "category": "supplier",
                                 "currency": "CLP", "amount": round(value_usd * 0.12 * clp_usd, -3),
                                 "date": pay_pack.isoformat(), "confirming_eligible": bool(rng.random() < 0.5)})
            pay_fr = ship_date + dt.timedelta(days=5)
            if as_of <= pay_fr <= end:
                payables.append({"id": f"FR-{sid}", "name": "Ocean freight and reefer", "category": "freight",
                                 "currency": "USD", "amount": round(value_usd * 0.06, 2), "date": pay_fr.isoformat()})

    # fixed and seasonal costs
    base_payroll = sales_usd * 0.04 / 12 * clp_usd
    harvest_payroll = sales_usd * 0.20 / 3 * clp_usd  # Dec-Feb harvest crews
    for d in _month_ends(as_of, end):
        if d < as_of:
            continue
        seasonal = harvest_payroll * {12: 1.0, 1: 0.85, 2: 0.45, 11: 0.35}.get(d.month, 0.0)
        payables.append({"id": f"PR-{d.isoformat()}", "name": "Payroll", "category": "payroll", "currency": "CLP",
                         "amount": round(base_payroll + seasonal, -3), "date": d.isoformat()})
    debt = sales_usd * float(rng.uniform(0.004, 0.015)) * clp_usd
    for d in _monthly(15, as_of, end):
        if as_of <= d <= end:
            payables.append({"id": f"DS-{d.isoformat()}", "name": "Bank loan installment", "category": "debt_service",
                             "currency": "CLP", "amount": round(debt, -3), "date": d.isoformat()})
    for day, name, cat, pct in ((12, "Monthly PPM tax installment", "tax", 0.002),
                                (28, "Energy, fuel and irrigation", "utilities", 0.003)):
        for d in _monthly(day, as_of, end):
            if as_of <= d <= end:
                payables.append({"id": f"{cat[:2].upper()}-{d.isoformat()}", "name": name, "category": cat,
                                 "currency": "CLP", "amount": round(sales_usd * pct * clp_usd, -3), "date": d.isoformat()})

    peak_payroll = base_payroll + harvest_payroll
    for c in customers:
        for key in ("_advance", "_terms", "_lc"):
            c.pop(key)
    name = f"{PREFIX[idx % len(PREFIX)]} {SUFFIX[(idx * 7) % len(SUFFIX)]} Export SpA (synthetic #{idx:02d})"
    return {
        "id": f"sme-{idx:02d}", "name": name, "synthetic": True,
        "notes": "Generated by nanfeng_quant.synthetic; all values synthetic.",
        "as_of": as_of.isoformat(), "horizon_days": horizon,
        "opening_cash_clp": round(peak_payroll * float(rng.uniform(0.3, 1.8)), -3),
        "min_cash_buffer_clp": round(peak_payroll * 0.10, -5),
        "annual_sales_usd": round(sales_usd, -3),
        "collateral_available_clp": round(sales_usd * clp_usd * float(rng.uniform(0.02, 0.10)), -5),
        "price_volatility": round(float(rng.uniform(0.08, 0.18)), 3),
        "fx_spot": None,
        "customers": customers, "receivables": receivables, "shipments": shipments,
        "payables": sorted(payables, key=lambda p: p["date"]),
    }


def calibrate_opening_cash(company: dict[str, Any], rng: np.random.Generator) -> None:
    """Set opening cash relative to the SME's own projected need, so the 50 SMEs span from
    comfortable to distressed instead of being driven only by where in the season they are."""
    from .model import Company
    from .montecarlo import simulate

    probe = dict(company, opening_cash_clp=0.0)
    res = simulate(Company.from_dict(probe), 500, seed=int(rng.integers(1 << 31)))
    need = max(-float(np.median(res.cash.min(axis=1))), 0.0) + company["min_cash_buffer_clp"]
    company["opening_cash_clp"] = round(need * float(rng.uniform(0.75, 1.45)), -3)


def generate(n: int = 50, seed: int = 2026) -> list[dict[str, Any]]:
    rng = np.random.default_rng(seed)
    spot = load_history().spot()
    companies = [generate_company(i + 1, rng, spot) for i in range(n)]
    for c in companies:
        calibrate_opening_cash(c, rng)
    return companies


def main() -> None:
    companies = generate()
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(companies, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(companies)} synthetic SMEs to {OUT_FILE}")


if __name__ == "__main__":
    main()
