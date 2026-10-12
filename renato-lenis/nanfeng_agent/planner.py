"""Planners: turn what the agent knows (typed facts only) into a list of tool calls.

- `RulePlanner` is deterministic: the playbook for each document type. It always works (offline, CI).
- `LLMPlanner` asks the strong model through the router, then checks every step: the tool must exist,
  the arguments must validate, and every id or amount in a money tool must be one we already know
  (from the extracted fields or master data). Anything else and the whole LLM plan is dropped for
  the rule plan. The LLM may choose and order; it never invents a number or a recipient.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from .contacts import CUSTOMERS
from .ingest import PlannerInput
from .router import ModelRouter, Offline, RouterError
from .tools import TOOLS


@dataclass
class PlannedStep:
    tool: str
    args: dict[str, Any] = field(default_factory=dict)
    when: str = ""  # condition checked by the orchestrator: "" | "at_risk"


@dataclass
class Plan:
    steps: list[PlannedStep]
    planner: str
    model: str = ""
    cost_usd: float = 0.0
    note: str = ""


class RulePlanner:
    name = "rules"

    def plan(self, pi: PlannerInput, scenario: str) -> Plan:
        f = pi.fields
        if pi.blocked:
            return Plan([], self.name, note="blocked document: nothing to plan")
        doc_type = f.get("doc_type")
        suspicious = pi.guard.verdict == "suspicious" or pi.payee_check.verdict == "suspicious"

        if doc_type == "payment_notice" and pi.customer_id:
            cust = next(c for c in CUSTOMERS if c.id == pi.customer_id)
            steps = [
                PlannedStep("ledger_query", {"view": "receivables"}),
                PlannedStep("forecast_run", {"scenario": scenario}),
                PlannedStep("financing_quote", {"scenario": scenario}, when="at_risk"),
                PlannedStep("optimize_plan", {"scenario": scenario}, when="at_risk"),
                PlannedStep("propose_plan", {}, when="at_risk"),
            ]
            if f.get("invoice_number"):
                steps.append(PlannedStep("send_collection", {"contact_id": cust.contact_id,
                                                             "receivable_id": f["invoice_number"]}))
            return Plan(steps, self.name, note=f"{cust.id} payment notice")

        if doc_type == "invoice" and pi.payee_check.payee_id and f.get("amount") and not suspicious:
            return Plan([
                PlannedStep("ledger_query", {"view": "accounts"}),
                PlannedStep("schedule_payment", {"payee_id": pi.payee_check.payee_id, "amount": float(f["amount"]),
                                                 "currency": f.get("currency", "CLP"),
                                                 "reference": f.get("invoice_number", "")}),
            ], self.name, note="supplier invoice from a known payee")

        if doc_type == "bank_statement":
            return Plan([PlannedStep("ledger_query", {"view": "transactions"}),
                         PlannedStep("forecast_run", {"scenario": scenario})], self.name, note="refresh forecast")

        # Unknown sender, suspicious document or anything else: read-only, the owner decides.
        return Plan([PlannedStep("forecast_run", {"scenario": scenario})], self.name,
                    note="no money action from an unverified document")


SYSTEM = """You are NanFeng's planner, the autonomous CFO of a Chilean fruit exporter.
You receive typed facts about one event (never the document text) and return the tool calls to run,
in order, as JSON: {"steps": [{"tool": "<name>", "args": {...}, "when": "" | "at_risk"}]}.
Rules: numbers come only from tools; money tools only use ids and amounts present in the facts;
quant tools use exactly the scenario given in the facts (what-ifs go in "overrides");
"at_risk" steps run only if the forecast shows a cash risk; at most 8 steps. JSON only."""


class LLMPlanner:
    name = "llm"

    def __init__(self, router: ModelRouter, fallback: RulePlanner | None = None):
        self.router, self.fallback = router, fallback or RulePlanner()
        self.last_messages: list[dict[str, Any]] = []

    def plan(self, pi: PlannerInput, scenario: str) -> Plan:
        rule_plan = self.fallback.plan(pi, scenario)
        if pi.blocked or not self.router.online:
            return rule_plan
        facts = {"event": pi.model_dump(mode="json"), "scenario": scenario,
                 "customers": [{"id": c.id, "contact_id": c.contact_id} for c in CUSTOMERS]}
        self.last_messages = [
            {"role": "system", "content": SYSTEM + "\nTools:\n" + json.dumps([t.spec() for t in TOOLS.values()])},
            {"role": "user", "content": json.dumps(facts, ensure_ascii=False)},
        ]
        try:
            out = self.router.complete("plan", self.last_messages, max_tokens=700)
            steps = [PlannedStep(s["tool"], s.get("args") or {}, s.get("when", "")) for s in out.json()["steps"]][:8]
        except (Offline, RouterError, ValueError, KeyError, TypeError) as exc:
            rule_plan.note = f"llm plan unavailable ({exc.__class__.__name__}); rules used"
            return rule_plan
        problem = check(steps, pi, scenario)
        if problem:
            rule_plan.note = f"llm plan rejected ({problem}); rules used"
            return rule_plan
        return required(Plan(steps, self.name, model=out.model, cost_usd=out.cost_usd), pi)


def required(plan: Plan, pi: PlannerInput) -> Plan:
    """Steps the business always wants, whatever the LLM chose: when a customer announces a late
    payment, the importer gets a reminder of the invoice in their language (L1, template only)."""
    f = pi.fields
    if (f.get("doc_type") == "payment_notice" and pi.customer_id and f.get("invoice_number")
            and not any(s.tool == "send_collection" for s in plan.steps)):
        cust = next(c for c in CUSTOMERS if c.id == pi.customer_id)
        plan.steps.append(PlannedStep("send_collection", {"contact_id": cust.contact_id,
                                                          "receivable_id": f["invoice_number"]}))
        plan.note = (plan.note + "; " if plan.note else "") + "collection reminder added"
    return plan


def check(steps: list[PlannedStep], pi: PlannerInput, scenario: str = "cherry_crisis") -> str:
    """Empty string if the plan is acceptable, else the first problem."""
    known_ids = {v for v in (pi.payee_check.payee_id, pi.fields.get("invoice_number")) if v}
    known_ids |= {c.contact_id for c in CUSTOMERS if c.id == pi.customer_id}
    amount = pi.fields.get("amount")
    for s in steps:
        tool = TOOLS.get(s.tool)
        if tool is None:
            return f"unknown tool {s.tool}"
        if s.when not in ("", "at_risk"):
            return f"bad condition {s.when}"
        try:
            args = tool.args.model_validate(s.args)
        except ValidationError:
            return f"bad arguments for {s.tool}"
        if getattr(args, "scenario", scenario) != scenario:
            return f"{s.tool}.scenario={args.scenario} is not the company's scenario"
        for key in ("payee_id", "receivable_id", "contact_id"):
            value = getattr(args, key, None)
            if value and value not in known_ids:
                return f"{s.tool}.{key}={value} is not in the facts"
        if s.tool == "schedule_payment" and (amount is None or abs(float(amount) - args.amount) > 0.005):
            return "payment amount differs from the document"
        if s.tool == "request_factoring" and args.receivable_id not in known_ids:
            return "factoring an invoice not in the facts"
    return ""
