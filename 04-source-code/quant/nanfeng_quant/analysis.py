"""Business financial analysis: the owner's "how healthy is my business" view (Topic E).

Built only from data the engine already has: the scenario's receivables, planned shipments and
payables (the same records the sandbox bank is seeded with), today's FX and, when a forecast is
given, its Monte Carlo paths. Nothing is fitted and nothing new is assumed.

Two views, kept apart on purpose:
- the *contracted* view: every invoice paid at its due date + announced delay + the customer's
  median delay, at today's FX and the expected cherry price. Deterministic and easy to audit: a
  lender can redo every number with a spreadsheet.
- the *risk* view, from the Monte Carlo (optional): the probability that cash is negative right
  after each payroll.

`insights` turns the numbers into a few plain findings in EN / ES / 中文, each tied to the metric
and the threshold that triggered it, so the web panel and the agent's WhatsApp report say the same.
"""
from __future__ import annotations

import datetime as dt
from typing import Any

import numpy as np

from .catalog import expected_collection_day, spot
from .model import Company
from .montecarlo import ForecastResult

# Thresholds behind each insight (documented in 01-technical-documentation/core-algorithm.md, section 6).
TOP_CUSTOMER_HIGH = 0.40      # one customer above 40% of expected inflows
TOP_CUSTOMER_MEDIUM = 0.25
FOREIGN_SHARE_MEDIUM = 0.70   # 70%+ of inflows in USD / CNY
DSO_MEDIUM_DAYS = 60          # more than two months of sales waiting to be collected
DEBT_SERVICE_MEDIUM = 0.20    # debt service above 20% of inflows
PAYROLL_RISK_HIGH = 0.50      # >= 50% chance cash is negative after a payroll
PAYROLL_RISK_MEDIUM = 0.10
FX_SHOCK_PCT = 10.0           # sensitivity: the peso 10% stronger against USD and CNY

CATEGORY_ORDER = ["payroll", "supplier", "freight", "debt_service", "tax", "utilities", "other"]
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2, "ok": 3}


def _m(clp: float) -> str:
    return f"CLP {clp / 1e6:,.1f}M"


def _es(text: str) -> str:
    """Spanish number format: 180,000.5 -> 180.000,5"""
    return text.translate(str.maketrans({",": ".", ".": ","}))


def _wan(clp: float) -> str:
    return f"{clp / 1e4:,.0f}万智利比索"


def _short(name: str) -> str:
    return name.split(" (")[0]


def _bucket(days: int) -> str:
    if days <= 30:
        return "0-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "90+"


def contracted_flows(company: Company) -> list[dict[str, Any]]:
    """Every expected cash movement in the horizon, at today's FX (contracted view)."""
    fx = spot(company)
    T = company.horizon_days
    out: list[dict[str, Any]] = []
    for r in company.receivables:
        d = expected_collection_day(company, r)
        out.append({"day": d, "kind": "receivable", "id": r.id, "customer_id": r.customer_id,
                    "currency": r.currency, "amount": r.amount, "clp": r.amount * fx[r.currency], "in_horizon": d <= T})
    for s in company.shipments:
        ship = company.day(s.ship_date)
        if ship < 0:
            continue
        c = company.customer(s.customer_id)
        if s.advance_pct > 0:
            a = s.expected_amount * s.advance_pct
            out.append({"day": ship, "kind": "shipment_advance", "id": s.id, "customer_id": s.customer_id,
                        "currency": s.currency, "amount": a, "clp": a * fx[s.currency], "in_horizon": ship <= T})
        d = ship + s.terms_days + int(round(c.delay_median_days))
        b = s.expected_amount * (1.0 - s.advance_pct)
        out.append({"day": d, "kind": "shipment_balance", "id": s.id, "customer_id": s.customer_id,
                    "currency": s.currency, "amount": b, "clp": b * fx[s.currency], "in_horizon": d <= T})
    for p in company.payables:
        d = company.day(p.date)
        if 0 <= d:
            out.append({"day": d, "kind": "payable", "id": p.id, "category": p.category, "name": p.name,
                        "currency": p.currency, "amount": p.amount, "clp": -p.amount * fx[p.currency], "in_horizon": d <= T})
    return sorted(out, key=lambda f: (f["day"], f["clp"] < 0))


def business_analysis(company: Company, res: ForecastResult | None = None) -> dict[str, Any]:
    fx = spot(company)
    T = company.horizon_days
    flows = contracted_flows(company)
    window = [f for f in flows if f["in_horizon"]]
    inflows = [f for f in window if f["clp"] > 0]
    outflows = [f for f in window if f["clp"] < 0]
    total_in = sum(f["clp"] for f in inflows)
    total_out = -sum(f["clp"] for f in outflows)
    date = lambda d: (company.as_of + dt.timedelta(days=int(d))).isoformat()  # noqa: E731

    # Daily contracted cash and its lowest point.
    daily = np.zeros(T + 1)
    for f in window:
        daily[f["day"]] += f["clp"]
    cash = company.opening_cash_clp + np.cumsum(daily)
    low = int(np.argmin(cash))

    # Months (calendar), for the cash budget table.
    months: dict[str, dict[str, float]] = {}
    for d in range(T + 1):
        key = date(d)[:7]
        m = months.setdefault(key, {"month": key, "inflows_clp": 0.0, "outflows_clp": 0.0})
        m["closing_cash_clp"] = float(cash[d])
    for f in window:
        m = months[date(f["day"])[:7]]
        if f["clp"] > 0:
            m["inflows_clp"] += f["clp"]
        else:
            m["outflows_clp"] -= f["clp"]
    for m in months.values():
        m["net_clp"] = m["inflows_clp"] - m["outflows_clp"]

    # Where the money goes.
    by_cat: dict[str, float] = {}
    for f in outflows:
        by_cat[f["category"]] = by_cat.get(f["category"], 0.0) - f["clp"]
    outflows_by_category = [{"category": k, "amount_clp": v, "share": v / max(total_out, 1.0)}
                            for k, v in sorted(by_cat.items(), key=lambda kv: CATEGORY_ORDER.index(kv[0]) if kv[0] in CATEGORY_ORDER else 99)]

    # Where it comes from: customers (expected inflows in the horizon + open invoices).
    customers = []
    for c in company.customers:
        open_inv = [r for r in company.receivables if r.customer_id == c.id]
        exp = sum(f["clp"] for f in inflows if f.get("customer_id") == c.id)
        customers.append({
            "id": c.id, "name": _short(c.name), "country": c.country, "currency": c.currency,
            "open_invoices": len(open_inv),
            "open_receivables_clp": sum(r.amount * fx[r.currency] for r in open_inv),
            "expected_inflows_clp": exp,
            "share_of_inflows": exp / max(total_in, 1.0),
            "median_delay_days": c.delay_median_days,
            "announced_delay_days": max((r.announced_delay_days for r in open_inv), default=0),
        })
    customers.sort(key=lambda c: -c["expected_inflows_clp"])
    shares = np.array([c["share_of_inflows"] for c in customers])
    hhi = float((shares ** 2).sum())

    # Receivables: how much, how long, how old.
    open_ar = sum(r.amount * fx[r.currency] for r in company.receivables)
    daily_sales = company.annual_sales_usd * fx["USD"] / 365.0
    dso = open_ar / max(daily_sales, 1.0)
    aging: dict[str, float] = {}
    days_w = 0.0
    for r in company.receivables:
        d = expected_collection_day(company, r)
        v = r.amount * fx[r.currency]
        aging[_bucket(d)] = aging.get(_bucket(d), 0.0) + v
        days_w += d * v
    aging_rows = [{"bucket": b, "amount_clp": aging.get(b, 0.0), "share": aging.get(b, 0.0) / max(open_ar, 1.0)}
                  for b in ("0-30", "31-60", "61-90", "90+")]

    # Currencies: what moves with the peso.
    by_ccy: dict[str, dict[str, float]] = {}
    for f in window:
        row = by_ccy.setdefault(f["currency"], {"currency": f["currency"], "inflows_clp": 0.0, "outflows_clp": 0.0})
        if f["clp"] > 0:
            row["inflows_clp"] += f["clp"]
        else:
            row["outflows_clp"] -= f["clp"]
    currency_rows = []
    for k in ("CLP", "USD", "CNY"):
        if k in by_ccy:
            row = by_ccy[k]
            row["net_clp"] = row["inflows_clp"] - row["outflows_clp"]
            row["share_of_inflows"] = row["inflows_clp"] / max(total_in, 1.0)
            currency_rows.append(row)
    foreign_in = sum(r["inflows_clp"] for r in currency_rows if r["currency"] != "CLP")
    foreign_out = sum(r["outflows_clp"] for r in currency_rows if r["currency"] != "CLP")
    fx_impact = -(foreign_in - foreign_out) * FX_SHOCK_PCT / 100.0

    # Payrolls: can the business pay its people? Contracted cash before each one, and the Monte Carlo risk.
    p_neg = res.p_negative_by_day if res is not None else None
    payrolls = []
    for p in company.payables:
        d = company.day(p.date)
        if p.category != "payroll" or not 0 <= d <= T:
            continue
        amount = p.amount * fx[p.currency]
        before = float(cash[d] + amount)  # cash on the day, before paying it
        payrolls.append({
            "id": p.id, "name": p.name, "date": p.date.isoformat(), "amount_clp": amount,
            "cash_before_clp": before, "coverage": before / amount,
            "prob_negative_after": None if p_neg is None else float(p_neg[d]),
        })
    payroll_out = by_cat.get("payroll", 0.0)
    monthly_payroll = payroll_out / max(len(payrolls), 1)
    debt = by_cat.get("debt_service", 0.0)
    operating_out = total_out - debt

    kpis = {
        "expected_inflows_clp": total_in,
        "expected_outflows_clp": total_out,
        "net_cash_flow_clp": total_in - total_out,
        "operating_cash_margin": (total_in - operating_out) / max(total_in, 1.0),
        "opening_cash_clp": company.opening_cash_clp,
        "ending_cash_clp": float(cash[-1]),
        "lowest_cash_clp": float(cash[low]),
        "lowest_cash_date": date(low),
        "open_receivables_clp": open_ar,
        "dso_days": dso,
        "days_to_collect": days_w / max(open_ar, 1.0),
        "top_customer_id": customers[0]["id"] if customers else None,
        "top_customer_share": customers[0]["share_of_inflows"] if customers else 0.0,
        "concentration_hhi": hhi,
        "foreign_share_of_inflows": foreign_in / max(total_in, 1.0),
        "natural_hedge_ratio": foreign_out / max(foreign_in, 1.0),
        "fx_shock_pct": FX_SHOCK_PCT,
        "fx_shock_impact_clp": fx_impact,
        "payroll_share_of_outflows": payroll_out / max(total_out, 1.0),
        "debt_service_share_of_inflows": debt / max(total_in, 1.0),
        "cash_in_months_of_payroll": company.opening_cash_clp / max(monthly_payroll, 1.0),
    }
    out = {
        "company_id": company.id, "company": company.name, "as_of": company.as_of.isoformat(),
        "horizon_days": T, "fx_spot": {"USD": fx["USD"], "CNY": fx["CNY"]},
        "basis": ("Contracted view: each invoice is paid at its due date plus any announced delay plus the customer's "
                  "median delay, at today's FX and the expected cherry price. The Monte Carlo adds the uncertainty "
                  "(prob_negative_after on each payroll)."),
        "kpis": kpis,
        "months": list(months.values()),
        "outflows_by_category": outflows_by_category,
        "customers": customers,
        "aging": aging_rows,
        "currencies": currency_rows,
        "payrolls": payrolls,
        "synthetic": company.synthetic,
    }
    out["insights"] = insights(out)
    return out


def insights(a: dict[str, Any]) -> list[dict[str, Any]]:
    """Plain findings, EN / ES / 中文, most severe first. Each names the metric and threshold behind it."""
    k = a["kpis"]
    found: list[dict[str, Any]] = []

    def add(id_: str, severity: str, metric: str, value: float, threshold: float | None, en: str, es: str, zh: str) -> None:
        found.append({"id": id_, "severity": severity, "metric": metric, "value": value, "threshold": threshold,
                      "text": {"en": en, "es": es, "zh": zh}})

    # 1. Payroll at risk (Monte Carlo when available, contracted coverage otherwise).
    for p in a["payrolls"]:
        risk = p["prob_negative_after"]
        sev = ("high" if risk >= PAYROLL_RISK_HIGH else "medium" if risk >= PAYROLL_RISK_MEDIUM else None) if risk is not None \
            else ("high" if p["coverage"] < 1 else None)
        if sev is None:
            continue
        name_es = p["name"].replace("Harvest payroll", "Nómina de cosecha").replace("December", "diciembre") \
            .replace("January", "enero").replace("February", "febrero").replace("March", "marzo")
        if risk is not None:
            add(f"payroll-{p['id']}", sev, "prob_negative_after", risk, PAYROLL_RISK_HIGH if sev == "high" else PAYROLL_RISK_MEDIUM,
                f"{p['name']}, {_m(p['amount_clp'])} on {p['date']}: {risk:.0%} chance cash is negative after paying it.",
                f"{name_es}, {_es(_m(p['amount_clp']))} el {p['date']}: {risk:.0%} de probabilidad de caja negativa después de pagarla.",
                f"{p['date']} 的工资（{_wan(p['amount_clp'])}）：支付后现金为负的概率为 {risk:.0%}。")
        else:
            add(f"payroll-{p['id']}", sev, "coverage", p["coverage"], 1.0,
                f"{p['name']}, {_m(p['amount_clp'])} on {p['date']}: contracted cash covers only {p['coverage']:.0%} of it.",
                f"{name_es}, {_es(_m(p['amount_clp']))} el {p['date']}: la caja comprometida cubre solo el {p['coverage']:.0%}.",
                f"{p['date']} 的工资（{_wan(p['amount_clp'])}）：已知现金只能覆盖 {p['coverage']:.0%}。")

    # 2. Announced delays.
    for c in a["customers"]:
        if c["announced_delay_days"] > 0:
            add(f"late-{c['id']}", "high", "announced_delay_days", c["announced_delay_days"], 0,
                f"{c['name']} announced it will pay {c['announced_delay_days']} days late; it is {c['share_of_inflows']:.0%} of the next 90 days' inflows.",
                f"{c['name']} avisó que pagará con {c['announced_delay_days']} días de atraso; es el {c['share_of_inflows']:.0%} de los ingresos de los próximos 90 días.",
                f"{c['name']} 通知将延迟 {c['announced_delay_days']} 天付款；占未来 90 天收入的 {c['share_of_inflows']:.0%}。")

    # 3. Customer concentration.
    top = a["customers"][0] if a["customers"] else None
    if top and k["top_customer_share"] >= TOP_CUSTOMER_MEDIUM:
        hhi_es = _es(f"{k['concentration_hhi']:.2f}")
        sev = "high" if k["top_customer_share"] >= TOP_CUSTOMER_HIGH else "medium"
        add("concentration", sev, "top_customer_share", k["top_customer_share"], TOP_CUSTOMER_HIGH if sev == "high" else TOP_CUSTOMER_MEDIUM,
            f"{top['name']} is {k['top_customer_share']:.0%} of expected inflows (concentration index {k['concentration_hhi']:.2f}): one customer's delay moves the whole season.",
            f"{top['name']} es el {k['top_customer_share']:.0%} de los ingresos esperados (índice de concentración {hhi_es}): el atraso de un solo cliente mueve toda la temporada.",
            f"{top['name']} 占预期收入的 {k['top_customer_share']:.0%}（集中度指数 {k['concentration_hhi']:.2f}）：一个客户延迟就会影响整个季节。")

    # 4. FX exposure.
    if k["foreign_share_of_inflows"] >= FOREIGN_SHARE_MEDIUM:
        loss = -k["fx_shock_impact_clp"]
        add("fx", "medium", "foreign_share_of_inflows", k["foreign_share_of_inflows"], FOREIGN_SHARE_MEDIUM,
            f"{k['foreign_share_of_inflows']:.0%} of inflows are in USD or CNY and only {k['natural_hedge_ratio']:.0%} is offset by foreign-currency costs: a {k['fx_shock_pct']:.0f}% stronger peso costs {_m(loss)}.",
            f"El {k['foreign_share_of_inflows']:.0%} de los ingresos está en USD o CNY y solo el {k['natural_hedge_ratio']:.0%} se compensa con costos en esas monedas: un peso {k['fx_shock_pct']:.0f}% más fuerte cuesta {_es(_m(loss))}.",
            f"{k['foreign_share_of_inflows']:.0%} 的收入为美元或人民币，外币成本仅抵消 {k['natural_hedge_ratio']:.0%}：比索升值 {k['fx_shock_pct']:.0f}% 将损失 {_wan(loss)}。")

    # 5. Days sales outstanding.
    if k["dso_days"] > DSO_MEDIUM_DAYS:
        add("dso", "medium", "dso_days", k["dso_days"], DSO_MEDIUM_DAYS,
            f"{_m(k['open_receivables_clp'])} is waiting to be collected: {k['dso_days']:.0f} days of sales (DSO), paid on average in {k['days_to_collect']:.0f} days.",
            f"Hay {_es(_m(k['open_receivables_clp']))} por cobrar: {k['dso_days']:.0f} días de ventas (DSO), que se cobran en {k['days_to_collect']:.0f} días en promedio.",
            f"待收账款 {_wan(k['open_receivables_clp'])}：相当于 {k['dso_days']:.0f} 天销售额（DSO），平均 {k['days_to_collect']:.0f} 天收回。")

    # 6. Debt load (good news is news too).
    sev = "medium" if k["debt_service_share_of_inflows"] >= DEBT_SERVICE_MEDIUM else "ok"
    add("debt", sev, "debt_service_share_of_inflows", k["debt_service_share_of_inflows"], DEBT_SERVICE_MEDIUM,
        f"Debt service is {k['debt_service_share_of_inflows']:.0%} of inflows{': there is room to borrow' if sev == 'ok' else ''}.",
        f"El servicio de deuda es el {k['debt_service_share_of_inflows']:.0%} de los ingresos{': hay espacio para endeudarse' if sev == 'ok' else ''}.",
        f"偿债支出占收入的 {k['debt_service_share_of_inflows']:.0%}{'：仍有借款空间' if sev == 'ok' else ''}。")

    found.sort(key=lambda f: SEVERITY_ORDER[f["severity"]])
    return found

