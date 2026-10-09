"""Financial product catalog and quotes (Financing Arena)."""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .fx import load_history
from .model import Company, Receivable

CATALOG_FILE = Path(__file__).resolve().parents[1] / "data" / "catalog.json"


@dataclass
class Product:
    raw: dict[str, Any]

    def __getattr__(self, key: str) -> Any:
        if key == "raw" or key.startswith("__"):  # keeps copy/deepcopy/pickle from recursing
            raise AttributeError(key)
        try:
            return self.raw[key]
        except KeyError:
            raise AttributeError(key) from None

    def get(self, key: str, default: Any = None) -> Any:
        return self.raw.get(key, default)


@dataclass
class Catalog:
    market: dict[str, float]
    lenders: dict[str, dict[str, Any]]
    products: list[Product]
    status: str = ""
    raw: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def load(cls, path: str | Path = CATALOG_FILE) -> "Catalog":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(data["market"], {l["id"]: l for l in data["lenders"]},
                   [Product(p) for p in data["products"]], data.get("status", ""), data)

    def product(self, product_id: str) -> Product:
        for p in self.products:
            if p.id == product_id:
                return p
        raise KeyError(product_id)

    def default_product(self) -> Product:
        return next(p for p in self.products if p.get("default"))

    def subset(self, product_ids: list[str]) -> "Catalog":
        return Catalog(self.market, self.lenders, [p for p in self.products if p.id in product_ids], self.status, self.raw)

    # ---- pricing helpers -------------------------------------------------
    def stamp_tax(self, term_days: int) -> float:
        """Chilean stamp tax (Impuesto de Timbres y Estampillas): per month or fraction, capped."""
        months = max(1, math.ceil(term_days / 30))
        return min(self.market["stamp_tax_monthly"] * months, self.market["stamp_tax_cap"])

    def product_stamp(self, p: Product) -> float:
        """Stamp tax for a product: flat rate for sight credits (credit lines), monthly otherwise."""
        if not p.get("stamp_tax"):
            return 0.0
        if p.get("stamp_tax_flat") is not None:
            return p.stamp_tax_flat
        return self.stamp_tax(p.term_days)

    def loan_unit_cost(self, p: Product) -> float:
        """Total cost per CLP borrowed over the contract term (interest + fees + stamp + guarantee)."""
        term = p.term_days
        rate = p.get("rate_annual")
        interest = rate * term / 365 if rate is not None else p.rate_monthly * term / 30
        interest += p.get("guarantee_fee_annual", 0.0) * term / 365
        return interest + p.get("fee_pct", 0.0) + self.product_stamp(p)

    def loan_upfront(self, p: Product) -> float:
        return p.get("fee_pct", 0.0) + self.product_stamp(p)

    def loan_interest(self, p: Product) -> float:
        return self.loan_unit_cost(p) - self.loan_upfront(p)

    def factoring_unit_cost(self, p: Product, days: float) -> float:
        """Cost per CLP of invoice face value financed for `days`."""
        return p.rate_monthly * max(days, p.get("min_days_charged", 0)) / 30 + p.get("fee_pct", 0.0)

    def confirming_unit_cost(self, p: Product) -> float:
        return p.rate_monthly * p.term_days / 30 + p.get("fee_pct", 0.0) + self.product_stamp(p)

    def forward_rate(self, spot_clp_per_cny: float, tenor_days: int, p: Product) -> float:
        """Covered interest parity forward, minus the bank's spread (we sell CNY)."""
        m = self.market
        fair = spot_clp_per_cny * (1 + m["clp_rate_annual"] * tenor_days / 365) / (1 + m["cny_rate_annual"] * tenor_days / 365)
        return fair * (1 - p.spread_pct)


def effective_annual_cost(cost: float, proceeds: float, days: float) -> float:
    """Compound annualized cost of receiving `proceeds` and paying `cost` over `days`."""
    if proceeds <= 0 or days <= 0:
        return float("nan")
    return (1 + cost / proceeds) ** (365 / days) - 1


def spot(company: Company) -> dict[str, float]:
    s = company.fx_spot or load_history().spot()
    return {"USD": s["clp_per_usd"], "CNY": s["clp_per_usd"] / s["cny_per_usd"], "CLP": 1.0}


def expected_collection_day(company: Company, r: Receivable) -> int:
    c = company.customer(r.customer_id)
    return max(company.day(r.due_date) + r.announced_delay_days + int(round(c.delay_median_days)), 1)


def eligibility(company: Company, catalog: Catalog, p: Product) -> tuple[bool, str]:
    limit = p.get("max_annual_sales_uf")
    if limit is not None:
        sales_uf = company.annual_sales_usd * spot(company)["USD"] / catalog.market["uf_clp"]
        if sales_uf > limit:
            return False, f"annual sales {sales_uf:,.0f} UF exceed the {limit:,.0f} UF threshold"
    if p.kind in ("factoring", "lc_discount"):
        ok = [r for r in company.receivables if eligible_receivable(p, r)]
        if not ok:
            return False, "no eligible receivables"
    if p.kind == "confirming" and not any(x.confirming_eligible for x in company.payables):
        return False, "no supplier enrolled in confirming"
    if p.kind == "forward" and not any(r.currency == "CNY" for r in company.receivables):
        return False, "no CNY receivables to hedge"
    return True, "eligible"


def eligible_receivable(p: Product, r: Receivable) -> bool:
    if r.currency not in p.currencies or not r.factoring_eligible:
        return False
    if p.kind == "lc_discount":
        return r.lc_backed
    return True


def financing_quote(company: Company, catalog: Catalog, amount_clp: float, need_day: int,
                    need_days: int) -> list[dict[str, Any]]:
    """Quote every product for a cash need of `amount_clp` from `need_day` for `need_days`.

    Returns one row per product with cost, effective annual cost, term, requirements and
    whether it can be funded on time. Sorted by total cost (feasible first).
    """
    fx = spot(company)
    rows = []
    for p in catalog.products:
        ok, why = eligibility(company, catalog, p)
        row = {"product_id": p.id, "name": p.name, "kind": p.kind,
               "lender": catalog.lenders[p.lender_id]["name"], "requirements": p.requirements,
               "eligible": ok, "reason": why, "rate_reference": p.get("rate_reference")}
        if ok and p.get("lead_days", 0) > need_day:
            row.update(eligible=False, reason=f"funds arrive on day {p.lead_days}, after the need on day {need_day}")
        if not row["eligible"] or p.kind == "forward":
            if p.kind == "forward":
                row.update(eligible=ok, reason="hedge: no cash, reduces CNY downside", cost_clp=None)
            rows.append(row)
            continue
        if p.kind == "loan":
            amount = max(amount_clp, p.min_amount_clp)
            amount = min(amount, p.get("max_amount_clp", amount))
            cost = amount * catalog.loan_unit_cost(p) + p.fee_fixed_clp
            row.update(amount_clp=amount, cost_clp=cost, term_days=p.term_days,
                       eac=effective_annual_cost(cost, amount, p.term_days),
                       covers_need=amount >= amount_clp,
                       note="cost of the full contract term" if p.term_days > need_days else "")
        elif p.kind in ("factoring", "lc_discount"):
            pool = sorted((r for r in company.receivables if eligible_receivable(p, r)),
                          key=lambda r: -r.amount * fx[r.currency])
            proceeds = cost = 0.0
            used = []
            for r in pool:
                if proceeds >= amount_clp:
                    break
                days = expected_collection_day(company, r) - max(need_day, p.lead_days)
                if days <= 0:
                    continue
                face = r.amount * fx[r.currency]
                frac = min(1.0, (amount_clp - proceeds) / (face * p.advance_rate))
                proceeds += frac * face * p.advance_rate
                cost += frac * face * catalog.factoring_unit_cost(p, days)
                used.append({"receivable_id": r.id, "fraction": round(frac, 4), "days": days})
            if not used:
                row.update(eligible=False, reason="every eligible invoice is collected before the need date")
                rows.append(row)
                continue
            cost += p.fee_fixed_clp * len(used)
            avg_days = sum(u["days"] * u["fraction"] for u in used) / max(sum(u["fraction"] for u in used), 1e-9)
            row.update(amount_clp=proceeds, cost_clp=cost, term_days=round(avg_days),
                       eac=effective_annual_cost(cost, proceeds, avg_days),
                       covers_need=proceeds >= amount_clp * 0.999, invoices=used)
        elif p.kind == "confirming":
            pool = [x for x in company.payables if x.confirming_eligible and company.day(x.date) >= need_day]
            extended = sum(x.amount for x in pool)
            cost = extended * catalog.confirming_unit_cost(p)
            row.update(amount_clp=extended, cost_clp=cost, term_days=p.term_days,
                       eac=effective_annual_cost(cost, extended, p.term_days) if extended else None,
                       covers_need=extended >= amount_clp, payables=[x.id for x in pool])
        rows.append(row)
    rows.sort(key=lambda r: (not r.get("eligible"), not r.get("covers_need", False),
                             r.get("cost_clp") if r.get("cost_clp") is not None else math.inf))
    return rows
