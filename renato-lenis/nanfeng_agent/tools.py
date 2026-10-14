"""Agent tools (r2-06). Least privilege, per the anti-injection design:

| Tool | Tier | Rule |
|------|------|------|
| ledger_query, forecast_run, financing_quote, optimize_plan, business_analysis | L0 | read-only; every number comes from here |
| send_collection | L1 | `contact_id` + `receivable_id` from master data, message from a template |
| schedule_payment, request_factoring, propose_plan | via /approvals | the policy engine decides the tier |
| anchor_audit | L0 | system action |

No tool takes a bank account, a phone number, an email address or free text that reaches a person.
Money tools never execute: they post to `POST /approvals` and the backend's policy engine decides.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field

from . import templates
from .backend import Backend, BackendError
from .channels import ChannelHub, OutboundMessage
from .contacts import CONTACTS, Contact, match_customer


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
    # The company's scenario with the delay the notice announced (scenario_from_notice). The LLM only ever
    # sees and names the id; the quant tools send this object when they are asked for that id.
    scenario_obj: dict[str, Any] | None = None

    def scenario_for(self, scenario_id: str) -> str | dict[str, Any]:
        return self.scenario_obj if self.scenario_obj is not None and scenario_id == self.scenario else scenario_id


MAX_NOTICE_DELAY_DAYS = 180


def notice_delay(due_date: str, new_due_date: str) -> int:
    """Days between the invoice's due date and the date the notice announces, clamped to 0-180."""
    days = (date.fromisoformat(new_due_date) - date.fromisoformat(due_date)).days
    return max(0, min(days, MAX_NOTICE_DELAY_DAYS))


def scenario_from_notice(base: dict[str, Any], fields: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """The company's scenario as the notice tells it: no announced delays except the one in the notice.

    Returns (scenario, note); scenario is None when the notice cannot be applied (the base scenario is
    used then). Only the receivable's `announced_delay_days` changes: the engine reads it per invoice,
    so a 45-day notice reproduces the committed Cherry Crisis numbers exactly."""
    invoice, new_due = fields.get("invoice_number"), fields.get("new_due_date")
    if not invoice or not new_due:
        return None, "notice has no invoice or new due date"
    inv = next((r for r in base.get("receivables", []) if r.get("id") == invoice), None)
    if inv is None:
        return None, f"{invoice} is not in the books"
    try:
        delay = notice_delay(inv["due_date"], str(new_due))
    except (KeyError, TypeError, ValueError):
        return None, f"bad new due date {str(new_due)[:20]}"
    scen = deepcopy(base)
    for r in scen["receivables"]:
        r["announced_delay_days"] = delay if r.get("id") == invoice else 0
    return scen, f"{invoice} +{delay} days"


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


class AnalysisArgs(Args):
    scenario: str = Field("cherry_crisis", pattern=r"^[a-z0-9_]{1,40}$")


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
    body: dict[str, Any] = {"scenario": ctx.scenario_for(a.scenario)}
    if a.overrides:
        body["overrides"] = a.overrides.model_dump(exclude_none=True)
    res = ctx.backend.post("/quant/forecast", body)
    s = res["summary"]
    return {"summary": s, "drivers": res.get("drivers"), "source": res.get("source"),
            "detail": s.get("headline", "")}


def business_analysis(ctx: RunContext, a: AnalysisArgs) -> dict[str, Any]:
    res = ctx.backend.post("/quant/analysis", {"scenario": a.scenario})
    k = res["kpis"]
    high = sum(1 for i in res.get("insights", []) if i["severity"] == "high")
    return {**res, "detail": f"{len(res.get('insights', []))} findings ({high} high) · net 90 days "
                             f"{templates.money(k['net_cash_flow_clp'], 'CLP')} · DSO {k['dso_days']:.0f} days"}


def financing_quote(ctx: RunContext, a: QuoteArgs) -> dict[str, Any]:
    res = ctx.backend.post("/quant/quote", {**a.model_dump(exclude_none=True), "scenario": ctx.scenario_for(a.scenario)})
    # A forward hedges the CNY and brings no cash: it is checked, but never counted as a way to fund the need.
    eligible = [q for q in res.get("quotes", []) if q.get("eligible") and q.get("kind") != "forward"]
    return {**res, "detail": f"{len(res.get('quotes', []))} options, {len(eligible)} eligible · "
                             f"need {templates.money(res.get('amount_clp', 0), 'CLP')} on {res.get('need_date')}"}


def optimize_plan(ctx: RunContext, a: PlanArgs) -> dict[str, Any]:
    res = ctx.backend.plan({"scenario": ctx.scenario_for(a.scenario), "confidence": a.confidence,
                            "channel": ctx.channel}, timeout_s=ctx.plan_timeout_s)
    opt, default = res["optimal"], res["default"]
    choice, proposal, reason = _choose(ctx, res)
    if choice == "default":
        detail = " + ".join(x["summary"] for x in default.get("actions", []))
        detail += f" · {_cost(default)} (the optimizer found nothing cheaper: {_cost(opt)})"
    else:
        detail = " + ".join(x["summary"] for x in opt.get("actions", [])) or "no action needed"
        detail += f" · {_cost(opt)} vs {_cost(default)}"
    if proposal is None:
        detail += f" · nothing to propose: {reason}"
    return {**res, "choice": choice, "proposal": proposal, "no_proposal_reason": reason, "detail": detail}


def _cost(p: dict[str, Any]) -> str:
    return templates.money(p["total_cost_clp"], "CLP") if p.get("total_cost_clp") is not None else "no feasible plan"


def _choose(ctx: RunContext, res: dict[str, Any]) -> tuple[str, dict[str, Any] | None, str]:
    """(choice, approval body or None, reason). Guards on what the MILP returned:
    - the optimal mix costs more than the default bank loan (a short time-limited solve can): propose the
      default loan and never call it cheaper;
    - the plan has no operation, or one the sandbox cannot execute (the engine lists those in
      `unsupported` and leaves them out): propose nothing rather than half a plan, and say so."""
    opt, default = res["optimal"], res["default"]
    opt_cost, def_cost = opt.get("total_cost_clp"), default.get("total_cost_clp")
    if def_cost is not None and (opt_cost is None or opt_cost > def_cost):
        req = _default_request(ctx, res)
        if req is None:
            return "default", None, "the default bank loan's lender is not in the sandbox bank"
        return "default", req, ""
    req = res.get("approval_request")
    if opt_cost is None or not req:
        return "none", None, "the optimizer found no feasible plan"
    if req.get("unsupported"):
        ops = ", ".join(sorted({str(u.get("op")) for u in req["unsupported"]}))
        return "none", None, f"the plan needs operations the bank cannot execute here ({ops})"
    if not req.get("operations"):
        return "none", None, "no financing needed"
    return "optimal", req, ""


def _default_request(ctx: RunContext, res: dict[str, Any]) -> dict[str, Any] | None:
    """The default bank loan as a POST /approvals body. Sandbox lenders are named "<lender> · <product>"."""
    default = res["default"]
    try:
        lenders = {r["name"]: r["id"] for r in ctx.backend.get("/bank/lenders")}
    except (BackendError, KeyError, TypeError):
        return None
    ops = []
    for x in default.get("actions", []):
        lender_id = lenders.get(f"{x.get('lender')} · {x.get('product')}")
        if x.get("kind") != "loan" or not lender_id:
            return None
        ops.append({"op": "loan", "params": {"lender_id": lender_id, "amount_clp": x["amount_clp"],
                                             "term_days": x["term_days"]}})
    if not ops:
        return None
    head = (res.get("forecast") or {}).get("headline", "")
    plan = " + ".join(x["summary"] for x in default["actions"])
    return {"action": default["actions"][0].get("product", "Working capital loan"), "operations": ops,
            "explanation": f"{head}. Plan: {plan}. Cost {templates.money(default['total_cost_clp'], 'CLP')}: the "
                           f"default bank loan, the optimizer found nothing cheaper.".lstrip(". "),
            "unsupported": []}


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
    # The invoice number comes from an untrusted document: never tell one customer about another's invoice.
    owner_of_invoice = match_customer(inv["customer"])
    if owner_of_invoice is None or owner_of_invoice.contact_id != contact.id:
        raise ToolError(f"{a.receivable_id} does not belong to {contact.id}'s company")
    lang = a.language or contact.language
    text = templates.render("collection", lang, customer=inv["customer"].replace(" (fictional)", ""),
                            invoice=inv["id"], amount=templates.money(inv["amount"], inv["currency"], lang),
                            due_date=inv["due_date"], company=templates.COMPANY) + " " + templates.ai_label(lang)
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
    """Proposes exactly what the MILP chose (or the default bank loan when that is cheaper), untouched by any LLM."""
    plan = ctx.memory.get("optimize_plan")
    if not plan:
        raise ToolError("run optimize_plan first: there is no plan to propose")
    req = plan.get("proposal")
    if req is None:
        return {"proposed": False, "detail": f"nothing proposed: {plan.get('no_proposal_reason') or 'no plan'}"}
    return _propose(ctx, req["action"], req["operations"], req.get("explanation", ""))


class ToolError(Exception):
    pass


TOOLS: dict[str, Tool] = {t.name: t for t in [
    Tool("ledger_query", 0, "Read the sandbox bank: accounts, receivables, payees, lenders, transactions or FX.",
         LedgerArgs, ledger_query, "sandbox bank"),
    Tool("forecast_run", 0, "90-day cash forecast, 10,000 Monte Carlo scenarios. Quote its numbers verbatim.",
         ForecastArgs, forecast_run, "Monte Carlo"),
    Tool("business_analysis", 0, "Business financial analysis: cash budget, customers, receivables, currencies, "
                                 "payroll safety and findings in EN / ES / 中文. Quote its texts verbatim.",
         AnalysisArgs, business_analysis, "quant engine"),
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
