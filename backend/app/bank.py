"""Sandbox Bank (r3-04): simulated accounts, payments, FX, factoring, loans and forwards.

Every operation moves balances, writes a transaction row, appends to the audit log and publishes
an event, so the logs exported from /bank/logs are the execution evidence (deliverable 06).
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .events import broker
from .models import Account, Lender, Payee, PayeeAccount, Receivable, Transaction
from .seed import FX_RATES

ACCOUNT_BY_CCY = {"CLP": "ACC-CLP", "USD": "ACC-USD", "CNY": "ACC-CNY"}


class BankError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def to_clp(amount: float, currency: str) -> float:
    if currency not in FX_RATES:
        raise BankError("unknown_currency", f"Unsupported currency {currency}")
    return round(float(amount) * FX_RATES[currency], 2)


def _account(db: Session, currency: str) -> Account:
    acc = db.get(Account, ACCOUNT_BY_CCY.get(currency, ""))
    if not acc:
        raise BankError("unknown_currency", f"No sandbox account in {currency}")
    return acc


def _move(db: Session, acc: Account, amount: float, kind: str, counterparty: str, reference: str) -> Transaction:
    new_balance = Decimal(acc.balance) + Decimal(str(amount))
    if new_balance < 0:
        raise BankError("insufficient_funds", f"{acc.id} has {acc.balance} {acc.currency}, needs {-amount}", 409)
    acc.balance = new_balance
    tx = Transaction(account_id=acc.id, kind=kind, amount=amount, balance_after=new_balance,
                     counterparty=counterparty, reference=reference)
    db.add(tx)
    db.flush()
    return tx


def _finish(db: Session, actor: str, kind: str, result: dict) -> dict:
    entry = audit.append(db, actor, f"bank.{kind}", result)  # commits
    result = {**result, "audit_seq": entry.seq, "audit_hash": entry.hash}
    broker.publish(f"bank.{kind}", result)
    return result


def payment(db: Session, payee_id: str, amount: float, currency: str = "CLP",
            reference: str = "", actor: str = "agent") -> dict:
    payee = db.get(Payee, payee_id)
    if not payee:
        raise BankError("unknown_payee", f"Payee {payee_id} not found", 404)
    if amount <= 0:
        raise BankError("invalid_amount", "Amount must be positive")
    tx = _move(db, _account(db, currency), -amount, "payment", payee.name, reference)
    return _finish(db, actor, "payment", {
        "transaction_id": tx.id, "payee_id": payee.id, "payee": payee.name, "bank_account": payee.bank_account,
        "amount": amount, "currency": currency, "amount_clp": to_clp(amount, currency), "reference": reference,
    })


def fx_convert(db: Session, from_currency: str, to_currency: str, amount: float, actor: str = "agent") -> dict:
    if from_currency == to_currency or amount <= 0:
        raise BankError("invalid_fx", "Need two different currencies and a positive amount")
    rate = FX_RATES[from_currency] / FX_RATES[to_currency]
    out = round(amount * rate, 2)
    debit = _move(db, _account(db, from_currency), -amount, "fx", f"FX {from_currency}->{to_currency}", "")
    credit = _move(db, _account(db, to_currency), out, "fx", f"FX {from_currency}->{to_currency}", "")
    return _finish(db, actor, "fx", {
        "transaction_ids": [debit.id, credit.id], "from_currency": from_currency, "to_currency": to_currency,
        "amount": amount, "rate": rate, "proceeds": out, "amount_clp": to_clp(amount, from_currency),
    })


def factoring(db: Session, receivable_id: str, lender_id: str = "LEN-FACTOR",
              share: float = 1.0, actor: str = "agent") -> dict:
    inv = db.get(Receivable, receivable_id)
    lender = db.get(Lender, lender_id)
    if not inv or not lender or lender.product != "factoring":
        raise BankError("not_found", "Receivable or factoring lender not found", 404)
    if inv.financed_by:
        raise BankError("already_financed", f"{inv.id} was already financed by {inv.financed_by}", 409)
    if not inv.factoring_eligible or not 0 < share <= 1:
        raise BankError("not_eligible", f"{inv.id} cannot be factored with share {share}")
    face_clp = to_clp(float(inv.amount) * share, inv.currency)
    fee = round(face_clp * float(lender.fee_pct), 2)
    proceeds = round(face_clp * float(lender.advance_pct) - fee, 2)
    inv.financed_by = f"{lender.id}:factoring"
    tx = _move(db, _account(db, "CLP"), proceeds, "factoring", lender.name, inv.id)
    return _finish(db, actor, "factoring", {
        "transaction_id": tx.id, "receivable_id": inv.id, "lender_id": lender.id, "share": share,
        "face_value_clp": face_clp, "advance_pct": float(lender.advance_pct), "fee_clp": fee,
        "proceeds_clp": proceeds, "amount_clp": face_clp, "annual_rate": float(lender.annual_rate),
    })


def loan(db: Session, lender_id: str, amount_clp: float, term_days: int, actor: str = "agent") -> dict:
    lender = db.get(Lender, lender_id)
    if not lender or lender.product not in ("wc_loan", "fogape"):
        raise BankError("not_found", "Loan lender not found", 404)
    if amount_clp <= 0 or term_days <= 0:
        raise BankError("invalid_amount", "Amount and term must be positive")
    fee = round(amount_clp * float(lender.fee_pct), 2)
    interest = round(amount_clp * float(lender.annual_rate) * term_days / 365, 2)
    tx = _move(db, _account(db, "CLP"), amount_clp - fee, "loan", lender.name, f"{lender.product}-{term_days}d")
    return _finish(db, actor, "loan", {
        "transaction_id": tx.id, "lender_id": lender.id, "product": lender.product, "amount_clp": amount_clp,
        "term_days": term_days, "fee_clp": fee, "interest_clp": interest, "cost_clp": fee + interest,
        "proceeds_clp": amount_clp - fee, "annual_rate": float(lender.annual_rate),
    })


def forward(db: Session, currency: str, notional: float, tenor_days: int,
            lender_id: str = "LEN-FXDESK", actor: str = "agent") -> dict:
    """Books an FX forward selling `currency` for CLP. No cash moves until maturity."""
    lender = db.get(Lender, lender_id)
    if not lender or lender.product != "forward":
        raise BankError("not_found", "Forward desk not found", 404)
    if currency not in ("USD", "CNY") or notional <= 0 or tenor_days <= 0:
        raise BankError("invalid_forward", "Forward needs USD/CNY, positive notional and tenor")
    spot = FX_RATES[currency]
    fwd_rate = round(spot * (1 - float(lender.fee_pct)), 4)
    return _finish(db, actor, "forward", {
        "lender_id": lender.id, "currency": currency, "notional": notional, "tenor_days": tenor_days,
        "spot": spot, "forward_rate": fwd_rate, "amount_clp": to_clp(notional, currency),
        "cost_clp": round(notional * (spot - fwd_rate), 2),
    })


def payee_bank_change(db: Session, payee_id: str, bank_account: str, verified_by: str,
                      actor: str = "agent") -> dict:
    """Changes a payee's bank account (r4-04). Always L3, and only after a call-back to the number on
    file: `verified_by` records who confirmed it. The old account stays in the history."""
    payee = db.get(Payee, payee_id)
    if not payee:
        raise BankError("unknown_payee", f"Payee {payee_id} not found", 404)
    if len(verified_by.strip()) < 5:
        raise BankError("not_verified", "An account change needs a call-back to the number on file (verified_by)")
    old = payee.bank_account
    payee.bank_account = bank_account
    db.add(PayeeAccount(payee_id=payee.id, bank_account=bank_account, source=f"changed by {actor}"))
    return _finish(db, actor, "payee_bank_change", {
        "payee_id": payee.id, "old_account_last4": old[-4:], "new_account_last4": bank_account[-4:],
        "verified_by": verified_by, "amount_clp": 0,
    })


OPERATIONS = {
    "payment": payment,
    "fx_convert": fx_convert,
    "factoring": factoring,
    "loan": loan,
    "forward": forward,
    "payee_bank_change": payee_bank_change,
}


def operation_amount_clp(db: Session, op: str, params: dict) -> float:
    """CLP exposure of an operation, used by the policy check before anything runs."""
    if op == "payment":
        return to_clp(params["amount"], params.get("currency", "CLP"))
    if op == "fx_convert":
        return to_clp(params["amount"], params["from_currency"])
    if op == "factoring":
        inv = db.get(Receivable, params["receivable_id"])
        if not inv:
            raise BankError("not_found", f"Receivable {params['receivable_id']} not found", 404)
        return to_clp(float(inv.amount) * params.get("share", 1.0), inv.currency)
    if op == "loan":
        return float(params["amount_clp"])
    if op == "forward":
        return to_clp(params["notional"], params["currency"])
    if op == "payee_bank_change":
        return 0.0
    raise BankError("unknown_operation", f"Unknown operation {op}")


def execute(db: Session, op: str, params: dict, actor: str) -> dict:
    fn = OPERATIONS.get(op)
    if not fn:
        raise BankError("unknown_operation", f"Unknown operation {op}")
    try:
        return fn(db, **params, actor=actor)
    except TypeError as exc:
        raise BankError("invalid_params", str(exc)) from exc
    except BankError:
        db.rollback()
        raise


def counterparty(db: Session, op: str, params: dict) -> str | None:
    """Who is on the other side of an operation, for sanctions screening."""
    if op in ("payment", "payee_bank_change"):
        payee = db.get(Payee, params.get("payee_id", ""))
        return payee.name if payee else None
    if op == "factoring":
        inv = db.get(Receivable, params.get("receivable_id", ""))
        return inv.customer if inv else None
    if op in ("loan", "forward"):
        lender = db.get(Lender, params.get("lender_id", "LEN-FXDESK" if op == "forward" else ""))
        return lender.name if lender else None
    return None


def is_allowlisted(db: Session, payee_id: str) -> bool:
    payee = db.get(Payee, payee_id)
    return bool(payee and payee.allowlisted)


def balances(db: Session) -> list[Account]:
    return list(db.scalars(select(Account).order_by(Account.id)))
