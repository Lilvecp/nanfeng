from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AccountOut(ORM):
    id: str
    name: str
    currency: str
    balance: float


class TransactionOut(ORM):
    id: int
    account_id: str
    ts: datetime
    kind: str
    amount: float
    balance_after: float
    counterparty: str
    reference: str


class ReceivableOut(ORM):
    id: str
    customer: str
    currency: str
    amount: float
    due_date: date
    factoring_eligible: bool
    financed_by: str | None


class PayeeOut(ORM):
    id: str
    name: str
    bank_account: str
    allowlisted: bool


class LenderOut(ORM):
    id: str
    name: str
    product: str
    annual_rate: float
    advance_pct: float
    fee_pct: float


Op = Literal["payment", "fx_convert", "factoring", "loan", "forward"]


class Operation(BaseModel):
    op: Op
    params: dict[str, Any] = Field(
        description="Arguments of the sandbox operation, e.g. payment: {payee_id, amount, currency, reference}; "
                    "factoring: {receivable_id, lender_id?, share?}; loan: {lender_id, amount_clp, term_days}; "
                    "forward: {currency, notional, tenor_days}; fx_convert: {from_currency, to_currency, amount}",
    )


class ApprovalCreate(BaseModel):
    action: str = Field(examples=["factoring + CNY forward"])
    operation: Operation
    explanation: str = ""
    channel: str = "WEB"


class ApprovalOut(ORM):
    id: str
    created_at: datetime
    decided_at: datetime | None
    action: str
    operation: dict
    amount_clp: float
    tier: int
    status: Literal["pending", "approved", "rejected", "auto", "locked", "failed", "blocked"]
    otp_attempts_left: int
    channel: str
    explanation: str
    note: str
    result: dict | None


class ApproveIn(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")
    channel: str = "WEB+OTP"


class RejectIn(BaseModel):
    reason: str = Field(min_length=3)
    channel: str = "WEB"


class KillSwitchIn(BaseModel):
    on: bool


class AuditEntryOut(ORM):
    seq: int
    ts: str
    actor: str
    kind: str
    payload: dict
    prev_hash: str
    hash: str


class AnchorOut(ORM):
    id: int
    created_at: datetime
    from_seq: int
    to_seq: int
    merkle_root: str
    backend: str
    tx_hash: str | None
    explorer_url: str | None


class AuditAppendIn(BaseModel):
    kind: str = Field(examples=["security.attack_blocked"])
    actor: str = "security"
    payload: dict[str, Any]


class EventIn(BaseModel):
    type: str = Field(examples=["agent.step"])
    data: dict[str, Any] = Field(
        examples=[{"step": "forecast_run", "tool": "forecast_run", "tier": 0, "model": "mistral-small",
                   "cost_usd": 0.0004, "status": "done"}],
    )
    source: str = "agent"
