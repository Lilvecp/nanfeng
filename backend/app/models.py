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
    operation: Mapped[dict] = mapped_column(JSON)  # {"op": "...", "params": {...}} executed on approval
    amount_clp: Mapped[float] = mapped_column(Money, default=0)
    tier: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16))  # pending | approved | rejected | auto | locked | failed
    otp_attempts_left: Mapped[int] = mapped_column(Integer)
    channel: Mapped[str] = mapped_column(String(32), default="")
    explanation: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)


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
