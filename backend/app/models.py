from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


Money = Numeric(18, 2)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    currency: Mapped[str] = mapped_column(String(3))
    balance: Mapped[float] = mapped_column(Money)


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    kind: Mapped[str] = mapped_column(String(32))  # payment | fx | factoring | loan | forward | deposit
    amount: Mapped[float] = mapped_column(Money)  # signed: negative = debit
    balance_after: Mapped[float] = mapped_column(Money)
    counterparty: Mapped[str] = mapped_column(String(160), default="")
    reference: Mapped[str] = mapped_column(String(64), default="")


class Receivable(Base):
    __tablename__ = "receivables"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    customer: Mapped[str] = mapped_column(String(160))
    currency: Mapped[str] = mapped_column(String(3))
    amount: Mapped[float] = mapped_column(Money)
    due_date: Mapped[date] = mapped_column(Date)
    factoring_eligible: Mapped[bool] = mapped_column(default=True)
    # Off-chain guard against double financing; r3-06 mirrors this on-chain.
    financed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Payee(Base):
    __tablename__ = "payees"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    bank_account: Mapped[str] = mapped_column(String(64))
    allowlisted: Mapped[bool] = mapped_column(default=True)


class Lender(Base):
    __tablename__ = "lenders"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    product: Mapped[str] = mapped_column(String(32))  # factoring | wc_loan | fogape | forward
    annual_rate: Mapped[float] = mapped_column(Numeric(8, 4))
    advance_pct: Mapped[float] = mapped_column(Numeric(5, 4), default=1)
    fee_pct: Mapped[float] = mapped_column(Numeric(6, 4), default=0)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    action: Mapped[str] = mapped_column(String(160))
    operations: Mapped[list] = mapped_column(JSON)  # [{"op": "...", "params": {...}}], executed in order
    amount_clp: Mapped[float] = mapped_column(Money, default=0)
    tier: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16))  # pending | approved | rejected | auto | locked | failed
    otp_attempts_left: Mapped[int] = mapped_column(Integer)
    channel: Mapped[str] = mapped_column(String(32), default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    results: Mapped[list | None] = mapped_column(JSON, nullable=True)


class AuditEntry(Base):
    __tablename__ = "audit_log"
    seq: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[str] = mapped_column(String(40))  # ISO string so the hash input never depends on DB tz handling
    actor: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64), unique=True)


class Anchor(Base):
    __tablename__ = "anchors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    from_seq: Mapped[int] = mapped_column(Integer)
    to_seq: Mapped[int] = mapped_column(Integer)
    merkle_root: Mapped[str] = mapped_column(String(64))
    backend: Mapped[str] = mapped_column(String(16))
    tx_hash: Mapped[str | None] = mapped_column(String(80), nullable=True)
    explorer_url: Mapped[str | None] = mapped_column(String(300), nullable=True)


class OtpChallenge(Base):
    """One live OTP per L3 approval (r4-05). Only an HMAC of the code is stored, never the code."""

    __tablename__ = "otp_challenges"
    approval_id: Mapped[str] = mapped_column(ForeignKey("approvals.id"), primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sends: Mapped[int] = mapped_column(Integer, default=1)
    sent_to: Mapped[str] = mapped_column(String(32), default="")  # masked phone
    delivery_id: Mapped[str] = mapped_column(String(80), default="")


class PayeeProfile(Base):
    """What we know about a payee besides its account: used to spot look-alike senders (r4-04)."""

    __tablename__ = "payee_profiles"
    payee_id: Mapped[str] = mapped_column(ForeignKey("payees.id"), primary_key=True)
    tax_id: Mapped[str] = mapped_column(String(32), default="")
    email_domain: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")  # call-back number on file


class PayeeAccount(Base):
    """Every bank account a payee has had, so an account change is visible (BEC, r4-04)."""

    __tablename__ = "payee_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    payee_id: Mapped[str] = mapped_column(ForeignKey("payees.id"))
    bank_account: Mapped[str] = mapped_column(String(64))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    source: Mapped[str] = mapped_column(String(64), default="")  # seed | owner-approved:<approval id>
