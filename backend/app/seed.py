"""Cherry Crisis sandbox state. Synthetic data, declared as such.

Company and invoices mirror vicente-rodriguez/data/scenarios/cherry_crisis.json (opening cash
CLP 175.5M, same invoice ids) so the bank, the forecast and the front tell the same story.
Lender terms are placeholders until they are aligned with Vicente's data/catalog.json.
"""

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .db import Base, engine
from .models import Account, Lender, Payee, PayeeAccount, PayeeProfile, Receivable

COMPANY = "Huerto Austral Export SpA (fictional)"

ACCOUNTS = [
    ("ACC-CLP", "Operating account CLP", "CLP", 175_500_000),
    ("ACC-USD", "Export proceeds USD", "USD", 0),
    ("ACC-CNY", "Export proceeds CNY", "CNY", 0),
]

RECEIVABLES = [
    ("INV-2026-118", "Shanghai Hongxin Fresh Fruit Import Co. (fictional)", "USD", 180_000, date(2026, 12, 18)),
    ("INV-2026-115", "Kowloon Premium Fruits Ltd. (fictional)", "USD", 95_000, date(2026, 12, 17)),
    ("INV-2026-121", "Guangzhou Lingnan Produce Trading Co. (fictional)", "CNY", 820_000, date(2027, 1, 14)),
    ("INV-2026-124", "Miami Orchard Distributors LLC (fictional)", "USD", 60_000, date(2027, 1, 8)),
    ("INV-2026-109", "Shanghai Hongxin Fresh Fruit Import Co. (fictional)", "USD", 150_000, date(2027, 1, 12)),
    ("INV-2026-112", "Guangzhou Lingnan Produce Trading Co. (fictional)", "CNY", 700_000, date(2027, 1, 15)),
]

PAYEES = [
    ("PAY-CARTONERA", "Cartonera Sur Ltda. (fictional)", "CL-BANCOANDINO-0042117", True),
    ("PAY-PAYROLL", "Harvest payroll (seasonal crew)", "CL-PAYROLL-BATCH", True),
    ("PAY-FRIO", "Frío Austral Logística (fictional)", "CL-BANCOSUR-7781203", True),
]

# Who each payee is, for the BEC checks (r4-04): tax id, email domain and the call-back number on file.
PAYEE_PROFILES = [
    ("PAY-CARTONERA", "76.123.456-7", "cartonerasur.cl", "+56223456789"),
    ("PAY-FRIO", "77.234.567-8", "frioaustral.cl", "+56229876543"),
    ("PAY-PAYROLL", "", "", ""),
]
PAYEE_ACCOUNTS_SINCE = datetime(2025, 11, 18, tzinfo=timezone.utc)

LENDERS = [
    # id, name, product, annual_rate, advance_pct, fee_pct
    ("LEN-FACTOR", "Factor Pacífico (fictional)", "factoring", 0.168, 0.90, 0.010),
    ("LEN-ANDINO", "Banco Andino (fictional)", "wc_loan", 0.145, 1.0, 0.005),
    ("LEN-FOGAPE", "Banco Andino + FOGAPE guarantee (fictional)", "fogape", 0.118, 1.0, 0.012),
    ("LEN-FXDESK", "Banco Andino FX desk (fictional)", "forward", 0.0, 1.0, 0.0015),
]

# Synthetic reference rates (CLP per unit). Vicente's engine uses real history for the forecast.
FX_RATES = {"USD": 940.0, "CNY": 132.0, "CLP": 1.0}


def create_schema() -> None:
    Base.metadata.create_all(engine)


def seed(db: Session) -> bool:
    """Idempotent: does nothing if accounts already exist. Returns True when it seeded."""
    if db.scalars(select(Account).limit(1)).first():
        return False
    db.add_all(Account(id=i, name=n, currency=c, balance=b) for i, n, c, b in ACCOUNTS)
    db.add_all(Receivable(id=i, customer=cu, currency=c, amount=a, due_date=d) for i, cu, c, a, d in RECEIVABLES)
    db.add_all(Payee(id=i, name=n, bank_account=b, allowlisted=al) for i, n, b, al in PAYEES)
    db.add_all(
        Lender(id=i, name=n, product=p, annual_rate=r, advance_pct=a, fee_pct=f)
        for i, n, p, r, a, f in LENDERS
    )
    db.flush()
    seed_security(db)
    audit.append(db, "system", "sandbox.seeded", {
        "company": COMPANY, "synthetic": True,
        "opening_balances": {i: b for i, _, _, b in ACCOUNTS},
    })
    return True


def seed_security(db: Session) -> None:
    """Payee profiles and account history. Idempotent, so it also backfills a database seeded
    before these tables existed."""
    if db.scalars(select(PayeeAccount).limit(1)).first():
        return
    payees = {p.id: p for p in db.scalars(select(Payee))}
    db.add_all(PayeeProfile(payee_id=i, tax_id=t, email_domain=d, phone=ph)
               for i, t, d, ph in PAYEE_PROFILES if i in payees)
    db.add_all(PayeeAccount(payee_id=p.id, bank_account=p.bank_account, added_at=PAYEE_ACCOUNTS_SINCE, source="seed")
               for p in payees.values())
    db.commit()


def reset(db: Session) -> None:
    """Drops every table and reseeds: the Demo Mode reset button."""
    db.close()
    Base.metadata.drop_all(engine)
    create_schema()
    seed(db)
