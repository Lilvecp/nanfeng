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


Op = Literal["payment", "fx_convert", "factoring", "loan", "forward", "payee_bank_change"]


class Operation(BaseModel):
    op: Op
    params: dict[str, Any] = Field(
        description="Arguments of the sandbox operation, e.g. payment: {payee_id, amount, currency, reference}; "
                    "factoring: {receivable_id, lender_id?, share?}; loan: {lender_id, amount_clp, term_days}; "
                    "forward: {currency, notional, tenor_days}; fx_convert: {from_currency, to_currency, amount}; "
                    "payee_bank_change: {payee_id, bank_account, verified_by} (always L3)",
    )


class ApprovalCreate(BaseModel):
    action: str = Field(examples=["factoring + CNY forward"])
    operations: list[Operation] = Field(min_length=1, max_length=5)
    explanation: str = ""
    channel: str = "WEB"


class ApprovalOut(ORM):
    id: str
    created_at: datetime
    decided_at: datetime | None
    action: str
    operations: list[dict]
    amount_clp: float
    tier: int
    status: Literal["pending", "approved", "rejected", "auto", "locked", "failed", "blocked"]
    otp_attempts_left: int
    channel: str
    explanation: str
    note: str
    results: list[dict] | None


class ApproveIn(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")
    channel: str = "WEB+OTP"


class RejectIn(BaseModel):
    reason: str = Field(min_length=3)
    channel: str = "WEB"


class KillSwitchIn(BaseModel):
    on: bool
    # Turning it off is L3: the owner's session plus a one-time code (threat model F1).
    otp: str | None = Field(default=None, pattern=r"^\d{6}$")


class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


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
    actor: str = Field(default="security", description="Label only: the entry is recorded as agent:<label>")
    payload: dict[str, Any]


class EventIn(BaseModel):
    type: str = Field(examples=["agent.step"])
    data: dict[str, Any] = Field(
        examples=[{"step": "forecast_run", "tool": "forecast_run", "tier": 0, "model": "mistral-small",
                   "cost_usd": 0.0004, "status": "done"}],
    )
    source: str = "agent"


class ScanIn(BaseModel):
    doc_id: str = Field(max_length=64, examples=["DOC-0042"])
    source: str = Field(default="upload", max_length=32, examples=["email", "whatsapp", "sms", "upload"])
    ocr_text: str = Field(max_length=200_000, description="Mistral OCR of the rendered pages")
    text_layer: str | None = Field(default=None, max_length=200_000, description="PDF text layer, if any")


class PayeeCheckIn(BaseModel):
    doc_id: str = Field(max_length=64)
    source: str = Field(default="upload", max_length=32)
    issuer_name: str = Field(default="", max_length=160)
    tax_id: str = Field(default="", max_length=32)
    sender_domain: str = Field(default="", max_length=160, description="From the mail headers, never the body")
    bank_account: str = Field(default="", max_length=64)


class SecurityVerdict(BaseModel):
    doc_id: str
    verdict: Literal["clean", "suspicious", "malicious"]
    rules: list[str]
    details: dict[str, Any] = {}
    payee_id: str | None = None
    verify_by: dict[str, str] | None = None
    alerted_via: str | None = None
    audit_seq: int | None = None
