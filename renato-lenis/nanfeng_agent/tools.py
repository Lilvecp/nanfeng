"""Agent tools (r2-06). Least privilege, per the anti-injection design:

| Tool | Tier | Rule |
|------|------|------|
| ledger_query, forecast_run, financing_quote, optimize_plan | L0 | read-only; every number comes from here |
| send_collection | L1 | `contact_id` + `receivable_id` from master data, message from a template |
| schedule_payment, request_factoring, propose_plan | via /approvals | the policy engine decides the tier |
| anchor_audit | L0 | system action |

No tool takes a bank account, a phone number, an email address or free text that reaches a person.
Money tools never execute: they post to `POST /approvals` and the backend's policy engine decides.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field

from . import templates
from .backend import Backend, BackendError
from .channels import ChannelHub, OutboundMessage
from .contacts import CONTACTS, Contact


@dataclass
class RunContext:
    backend: Backend
    hub: ChannelHub
    owner: Contact
    scenario: str = "cherry_crisis"
    cockpit_url: str = "http://localhost:3000"
    plan_timeout_s: float = 90.0
    channel: str = "WA"
    memory: dict[str, Any] = field(default_factory=dict)  # tool results of this run, by tool name


class Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NoArgs(Args):
    pass


class LedgerArgs(Args):
    view: Literal["accounts", "receivables", "payees", "lenders", "transactions", "fx"] = "accounts"


class Overrides(Args):
    global_delay_extra_days: float | None = None
    customer_delay_extra_days: dict[str, float] | None = None
    cny_shift_pct: float | None = None
    usd_shift_pct: float | None = None
    cherry_price_pct: float | None = None
    extra_hires: int | None = Field(None, ge=0)


class ForecastArgs(Args):
    scenario: str = Field("cherry_crisis", pattern=r"^[a-z0-9_]{1,40}$")
    overrides: Overrides | None = None


class QuoteArgs(Args):
    scenario: str = Field("cherry_crisis", pattern=r"^[a-z0-9_]{1,40}$")
    amount_clp: float | None = Field(None, gt=0)
    need_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    need_days: int | None = Field(None, gt=0, le=365)


class PlanArgs(Args):
    scenario: str = Field("cherry_crisis", pattern=r"^[a-z0-9_]{1,40}$")
    confidence: float = Field(0.9, ge=0.5, le=0.99)


class CollectionArgs(Args):
    contact_id: str = Field(pattern=r"^CON-[A-Z0-9\-]{2,30}$")
    receivable_id: str = Field(pattern=r"^INV-[0-9A-Za-z\-]{1,30}$")
    language: Literal["es", "en", "zh"] | None = None


class PaymentArgs(Args):
    payee_id: str = Field(pattern=r"^PAY-[A-Z0-9\-]{2,30}$")
    amount: float = Field(gt=0, le=1e11)
    currency: Literal["CLP", "USD", "CNY"] = "CLP"
    reference: str = Field("", pattern=r"^[0-9A-Za-z \-/#.]{0,60}$")


class FactoringArgs(Args):
    receivable_id: str = Field(pattern=r"^INV-[0-9A-Za-z\-]{1,30}$")
    lender_id: str | None = Field(None, pattern=r"^LEN-[A-Z0-9\-]{2,30}$")
    share: float = Field(1.0, gt=0, le=1)


@dataclass(frozen=True)
class Tool:
    name: str
    tier: int  # 0 read-only · 1 notify · 3 = goes to /approvals (policy decides the real tier)
    description: str
    args: type[Args]
    fn: Callable[[RunContext, Any], dict[str, Any]]
    model: str = ""

    def spec(self) -> dict[str, Any]:
        """OpenAI / OpenRouter function-calling schema."""
        schema = self.args.model_json_schema()
        schema.pop("title", None)
        return {"type": "function", "function": {"name": self.name, "description": self.description,
                                                 "parameters": schema}}


# --- read-only (L0) ----------------------------------------------------------------------------

def ledger_query(ctx: RunContext, a: LedgerArgs) -> dict[str, Any]:
    path = {"fx": "/bank/fx/rates"}.get(a.view, f"/bank/{a.view}")
    rows = ctx.backend.get(path)
    return {"view": a.view, "rows": rows, "count": len(rows) if isinstance(rows, list) else None}


def forecast_run(ctx: RunContext, a: ForecastArgs) -> dict[str, Any]:
    body: dict[str, Any] = {"scenario": a.scenario}
    if a.overrides:
        body["overrides"] = a.overrides.model_dump(exclude_none=True)
    res = ctx.backend.post("/quant/forecast", body)
    s = res["summary"]
    return {"summary": s, "drivers": res.get("drivers"), "source": res.get("source"),
            "detail": s.get("headline", "")}


def financing_quote(ctx: RunContext, a: QuoteArgs) -> dict[str, Any]:
    res = ctx.backend.post("/quant/quote", a.model_dump(exclude_none=True))
    eligible = [q for q in res.get("quotes", []) if q.get("eligible")]
    return {**res, "detail": f"{len(res.get('quotes', []))} options, {len(eligible)} eligible · "
                             f"need {templates.money(res.get('amount_clp', 0), 'CLP')} on {res.get('need_date')}"}


def optimize_plan(ctx: RunContext, a: PlanArgs) -> dict[str, Any]:
    res = ctx.backend.plan({"scenario": a.scenario, "confidence": a.confidence, "channel": ctx.channel},
                           timeout_s=ctx.plan_timeout_s)
    opt = res["optimal"]
    detail = " + ".join(x["summary"] for x in opt.get("actions", [])) or "no action needed"
    return {**res, "detail": f"{detail} · {templates.money(opt['total_cost_clp'], 'CLP')} vs "
                             f"{templates.money(res['default']['total_cost_clp'], 'CLP')}"}


def anchor_audit(ctx: RunContext, a: NoArgs) -> dict[str, Any]:
    try:
        anchor = ctx.backend.post("/audit/anchor")
    except BackendError as exc:
        if exc.status == 409:
            return {"anchored": False, "detail": "nothing new to anchor"}
        raise
    return {"anchored": True, "anchor": anchor,
            "detail": f"Merkle root {anchor['merkle_root'][:12]}… seq {anchor['from_seq']}-{anchor['to_seq']}"}


# --- notify (L1) -------------------------------------------------------------------------------

def send_collection(ctx: RunContext, a: CollectionArgs) -> dict[str, Any]:
    contact = CONTACTS.get(a.contact_id)
    if contact is None:
        raise ToolError(f"unknown contact {a.contact_id}: recipients come from master data only")
    inv = next((r for r in ctx.backend.get("/bank/receivables") if r["id"] == a.receivable_id), None)
    if inv is None:
        raise ToolError(f"unknown receivable {a.receivable_id}")
    lang = a.language or contact.language
    text = templates.render("collection", lang, customer=inv["customer"].replace(" (fictional)", ""),
                            invoice=inv["id"], amount=templates.money(inv["amount"], inv["currency"], lang),
                            due_date=inv["due_date"], company=templates.COMPANY)
    d = ctx.hub.send_to(contact, OutboundMessage(to="", text=text, language=lang, kind="collection"))
    return {"delivery": d.public(), "detail": f"{d.channel} ({'mock' if d.mock else d.status}) · {lang} · {inv['id']}"}


# --- money: always through /approvals ----------------------------------------------------------

def _propose(ctx: RunContext, action: str, operations: list[dict], explanation: str) -> dict[str, Any]:
    appr = ctx.backend.post("/approvals", {"action": action, "operations": operations,
                                           "explanation": explanation, "channel": ctx.channel})
    ctx.memory.setdefault("approvals", []).append(appr)
    return {"approval": appr, "tier": appr["tier"],
            "detail": f"{appr['id']} · L{appr['tier']} · {appr['status']} · {templates.money(appr['amount_clp'], 'CLP')}"}


def schedule_payment(ctx: RunContext, a: PaymentArgs) -> dict[str, Any]:
    op = {"op": "payment", "params": {"payee_id": a.payee_id, "amount": a.amount, "currency": a.currency,
                                      "reference": a.reference}}
    return _propose(ctx, f"Pay {a.payee_id} {a.reference}".strip(), [op], f"Invoice {a.reference} from {a.payee_id}")


def request_factoring(ctx: RunContext, a: FactoringArgs) -> dict[str, Any]:
    params: dict[str, Any] = {"receivable_id": a.receivable_id, "share": a.share}
    if a.lender_id:
        params["lender_id"] = a.lender_id
    return _propose(ctx, f"Factor {a.receivable_id}", [{"op": "factoring", "params": params}],
                    f"Advance on {a.receivable_id} ({a.share:.0%})")


def propose_plan(ctx: RunContext, a: NoArgs) -> dict[str, Any]:
    """Proposes exactly what the MILP chose: the plan's approval_request, untouched by any LLM."""
    plan = ctx.memory.get("optimize_plan")
    if not plan or not plan.get("approval_request"):
        raise ToolError("run optimize_plan first: there is no plan to propose")
    req = plan["approval_request"]
    return _propose(ctx, req["action"], req["operations"], req.get("explanation", ""))


class ToolError(Exception):
    pass


TOOLS: dict[str, Tool] = {t.name: t for t in [
    Tool("ledger_query", 0, "Read the sandbox bank: accounts, receivables, payees, lenders, transactions or FX.",
         LedgerArgs, ledger_query, "sandbox bank"),
    Tool("forecast_run", 0, "90-day cash forecast, 10,000 Monte Carlo scenarios. Quote its numbers verbatim.",
         ForecastArgs, forecast_run, "Monte Carlo"),
    Tool("financing_quote", 0, "Financing Arena: cost, EAC and eligibility of every product for the cash need.",
         QuoteArgs, financing_quote, "catalog"),
    Tool("optimize_plan", 0, "MILP: cheapest financing mix that keeps cash above the buffer. Returns the "
                             "approval request.", PlanArgs, optimize_plan, "MILP · CBC"),
    Tool("propose_plan", 3, "Send the plan from optimize_plan to the owner's Approval Center (policy decides).",
         NoArgs, propose_plan, "policy engine"),
    Tool("send_collection", 1, "Send a payment reminder for one receivable to a customer contact from master data.",
         CollectionArgs, send_collection, "template"),
    Tool("schedule_payment", 3, "Propose paying a known payee (master data id). Goes to the Approval Center.",
         PaymentArgs, schedule_payment, "policy engine"),
    Tool("request_factoring", 3, "Propose factoring one receivable. Always L3: the owner approves with a code.",
         FactoringArgs, request_factoring, "policy engine"),
    Tool("anchor_audit", 0, "Anchor the audit log's new entries on-chain (Merkle root).", NoArgs, anchor_audit,
         "audit chain"),
]}
