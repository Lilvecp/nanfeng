"""Scenario schema: the company, its customers and every dated cash flow.

A scenario is plain JSON (see data/scenarios/cherry_crisis.json) so the agent,
the backend and the front can all read the same file. All amounts are in the
currency of the item; the simulator converts to CLP with the simulated FX path.
"""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

CURRENCIES = ("CLP", "USD", "CNY")


def _date(value: str | dt.date) -> dt.date:
    return value if isinstance(value, dt.date) else dt.date.fromisoformat(value)


@dataclass
class Customer:
    id: str
    name: str
    country: str
    currency: str
    # Payment delay beyond the due date, in days: D = (1 + median) * exp(sigma * Z) - 1, floored at 0.
    delay_median_days: float = 5.0
    delay_sigma: float = 0.6
    # Probability the customer does not pay inside the forecast horizon at all.
    p_default: float = 0.0


@dataclass
class Receivable:
    id: str
    customer_id: str
    currency: str
    amount: float
    due_date: dt.date
    # Delay the customer has already announced (e.g. "we will pay 45 days late").
    announced_delay_days: int = 0
    factoring_eligible: bool = True
    lc_backed: bool = False


@dataclass
class Shipment:
    """Planned shipment not yet invoiced: amount depends on the cherry price."""
    id: str
    customer_id: str
    currency: str
    ship_date: dt.date
    expected_amount: float
    advance_pct: float = 0.0  # paid at shipment (consignment advance)
    terms_days: int = 75  # balance due ship_date + terms


@dataclass
class Payable:
    id: str
    name: str
    category: str  # payroll | supplier | freight | debt_service | tax | utilities | other
    currency: str
    amount: float
    date: dt.date
    confirming_eligible: bool = False


@dataclass
class Company:
    id: str
    name: str
    as_of: dt.date
    opening_cash_clp: float
    min_cash_buffer_clp: float
    annual_sales_usd: float
    customers: list[Customer]
    receivables: list[Receivable] = field(default_factory=list)
    shipments: list[Shipment] = field(default_factory=list)
    payables: list[Payable] = field(default_factory=list)
    horizon_days: int = 90
    collateral_available_clp: float = 0.0
    # Cherry price uncertainty applied to not-yet-invoiced shipments (lognormal sigma).
    price_volatility: float = 0.12
    # Optional FX spot override; defaults to the last observation in data/fx.
    fx_spot: dict[str, float] | None = None
    synthetic: bool = True
    notes: str = ""

    def customer(self, customer_id: str) -> Customer:
        for c in self.customers:
            if c.id == customer_id:
                return c
        raise KeyError(f"unknown customer {customer_id!r}")

    def day(self, date: dt.date) -> int:
        return (date - self.as_of).days

    def dates(self) -> list[dt.date]:
        return [self.as_of + dt.timedelta(days=d) for d in range(self.horizon_days + 1)]

    # ---- serialization -------------------------------------------------
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Company":
        d = dict(data)
        d["as_of"] = _date(d["as_of"])
        d["customers"] = [Customer(**c) for c in d["customers"]]
        d["receivables"] = [Receivable(**{**r, "due_date": _date(r["due_date"])}) for r in d.get("receivables", [])]
        d["shipments"] = [Shipment(**{**s, "ship_date": _date(s["ship_date"])}) for s in d.get("shipments", [])]
        d["payables"] = [Payable(**{**p, "date": _date(p["date"])}) for p in d.get("payables", [])]
        company = cls(**d)
        company.validate()
        return company

    @classmethod
    def load(cls, path: str | Path) -> "Company":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    def to_dict(self) -> dict[str, Any]:
        return json.loads(json.dumps(asdict(self), default=str))

    def validate(self) -> None:
        ids = {c.id for c in self.customers}
        for item in [*self.receivables, *self.shipments]:
            if item.customer_id not in ids:
                raise ValueError(f"{item.id}: unknown customer {item.customer_id}")
        for item in [*self.receivables, *self.shipments, *self.payables]:
            if item.currency not in CURRENCIES:
                raise ValueError(f"{item.id}: unsupported currency {item.currency}")
        for c in self.customers:
            if c.currency not in CURRENCIES:
                raise ValueError(f"{c.id}: unsupported currency {c.currency}")
        if self.horizon_days < 1:
            raise ValueError("horizon_days must be >= 1")
