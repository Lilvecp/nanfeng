"""Cherry Crisis sandbox state. Synthetic data, declared as such.

Accounts, receivables, lenders and FX come from Vicente's engine (`sandbox_seed` in
vicente-rodriguez/nanfeng_quant/tools.py), saved in app/data/sandbox_seed.json, so the bank, the
forecast, the MILP plan and the front tell the same story. Regenerate after the scenario or the
catalog changes (see backend/README.md). Payees are ours: the engine does not model them.
"""

import json
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .db import Base, engine
from .models import Account, Lender, Payee, Receivable

SEED = json.loads((Path(__file__).parent / "data" / "sandbox_seed.json").read_text())

COMPANY = SEED["company"]
ACCOUNTS = [(a["id"], a["name"], a["currency"], a["balance"]) for a in SEED["accounts"]]
RECEIVABLES = [(r["id"], r["customer"], r["currency"], r["amount"], date.fromisoformat(r["due_date"]),
                r["factoring_eligible"]) for r in SEED["receivables"]]
LENDERS = [(x["id"], x["name"], x["product"], x["annual_rate"], x["advance_pct"], x["fee_pct"]) for x in SEED["lenders"]]
FX_RATES = SEED["fx_rates_clp"]  # CLP per unit, the engine's spot for this scenario

PAYEES = [
    ("PAY-CARTONERA", "Cartonera Sur Ltda. (fictional)", "CL-BANCOANDINO-0042117", True),
    ("PAY-PAYROLL", "Harvest payroll (seasonal crew)", "CL-PAYROLL-BATCH", True),
    ("PAY-FRIO", "Frío Austral Logística (fictional)", "CL-BANCOSUR-7781203", True),
]


def create_schema() -> None:
    Base.metadata.create_all(engine)


def seed(db: Session) -> bool:
    """Idempotent: does nothing if accounts already exist. Returns True when it seeded."""
    if db.scalars(select(Account).limit(1)).first():
        return False
    db.add_all(Account(id=i, name=n, currency=c, balance=b) for i, n, c, b in ACCOUNTS)
    db.add_all(Receivable(id=i, customer=cu, currency=c, amount=a, due_date=d, factoring_eligible=fe)
               for i, cu, c, a, d, fe in RECEIVABLES)
    db.add_all(Payee(id=i, name=n, bank_account=b, allowlisted=al) for i, n, b, al in PAYEES)
    db.add_all(
        Lender(id=i, name=n, product=p, annual_rate=r, advance_pct=a, fee_pct=f)
        for i, n, p, r, a, f in LENDERS
    )
    audit.append(db, "system", "sandbox.seeded", {
        "company": COMPANY, "synthetic": True, "seed_source": SEED.get("source", {}),
        "opening_balances": {i: b for i, _, _, b in ACCOUNTS},
    })
    return True


def reset(db: Session) -> None:
    """Drops every table and reseeds: the Demo Mode reset button."""
    db.close()
    Base.metadata.drop_all(engine)
    create_schema()
    seed(db)
