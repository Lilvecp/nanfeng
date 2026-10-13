"""Orchestrator (r2-04): planner → tool → policy check → execution, with a pause for the owner.

    event ─► ingest (guard · quarantine · payee check) ─► planner ─► tools ─► POST /approvals
                                                                              │ L1/L2: runs now
                                                                              └ L3: run pauses ─► owner approves
                                                                                 with OTP (never through us)
                                                                                 ─► resume ─► anchor + confirm

Every step goes to Mission Control (`agent.step` on the SSE stream). Before every step the kill
switch is checked. Hard caps per run: steps and LLM spend (OWASP LLM10).
"""

from __future__ import annotations

import itertools
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from . import templates
from .backend import Backend, BackendError
from .channels import ChannelHub, Delivery, OutboundMessage, UnknownChannel, build_hub
from .config import Settings
from .contacts import CUSTOMERS, Contact, owner_contact
from .ingest import Document, PlannerInput, ingest
from .planner import LLMPlanner, Plan, RulePlanner
from .router import ModelRouter
from .tools import TOOLS, RunContext, ToolError

_run_ids = itertools.count(1)

# Out-of-band: the owner is never alerted on the channel an attack arrived on.
_SOURCE_CHANNEL = {"whatsapp": "whatsapp", "sms": "sms", "email": "email"}


class Halt(Exception):
    """Stop the run now (kill switch, step cap, spend cap)."""


@dataclass
class Run:
    id: str
    kind: str
    status: str = "running"  # running | awaiting_approval | completed | blocked | halted | failed
    steps: list[dict[str, Any]] = field(default_factory=list)
    deliveries: list[dict[str, Any]] = field(default_factory=list)
    approvals: list[dict[str, Any]] = field(default_factory=list)
    planner_input: PlannerInput | None = None
    plan: Plan | None = None
    note: str = ""
    language: str = "en"
    memory: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        return {"run_id": self.id, "kind": self.kind, "status": self.status, "note": self.note,
                "steps": len(self.steps), "approvals": [{k: a[k] for k in ("id", "tier", "status")} for a in self.approvals],
                "deliveries": self.deliveries,
                "planner": self.plan.planner if self.plan else None}


class Agent:
    def __init__(self, settings: Settings, backend: Backend | None = None, router: ModelRouter | None = None,
                 hub: ChannelHub | None = None, planner: RulePlanner | LLMPlanner | None = None):
        self.settings = settings
        self.backend = backend or Backend(settings.backend_url, settings.agent_token)
        self.router = router or ModelRouter(settings.openrouter_api_key, settings.models, settings.max_cost_usd)
        self.hub = hub or build_hub(settings)
        self.planner = planner or (LLMPlanner(self.router) if self.router.online else RulePlanner())
        self.owner: Contact = owner_contact(settings.owner_phone, settings.owner_language)
        self.runs: dict[str, Run] = {}

    # --- plumbing ------------------------------------------------------------------------------

    def _new_run(self, kind: str, language: str | None = None) -> Run:
        run = Run(id=f"RUN-{next(_run_ids):04d}", kind=kind, language=language or self.settings.owner_language)
        self.runs[run.id] = run
        self.backend.publish("agent.run", {"run_id": run.id, "kind": kind, "status": "running"})
        return run

    def _finish(self, run: Run, status: str, note: str = "") -> Run:
        run.status, run.note = status, note or run.note
        self.backend.publish("agent.run", {"run_id": run.id, "kind": run.kind, "status": status, "note": run.note})
        return run

    def _trace(self, run: Run, data: dict[str, Any]) -> None:
        data = {"tier": 0, "model": "", "cost_usd": 0.0, "latency_s": 0.0, "status": "done", "detail": "", **data,
                "run_id": run.id}
        run.steps.append(data)
        self.backend.publish("agent.step", data)

    def _guard(self, run: Run) -> None:
        if self.backend.kill_switch_on():
            raise Halt("kill switch is on")
        if len(run.steps) >= self.settings.max_steps * 2:  # ingest + tool steps
            raise Halt(f"step cap ({self.settings.max_steps}) reached")
        if self.router.spent_usd >= self.settings.max_cost_usd:
            raise Halt(f"LLM spend cap (USD {self.settings.max_cost_usd}) reached")

    def _ctx(self, run: Run) -> RunContext:
        return RunContext(self.backend, self.hub, self.owner, self.settings.scenario, self.settings.cockpit_url,
                          self.settings.plan_timeout_s, memory=run.memory)

    def _tool(self, run: Run, name: str, args: dict[str, Any]) -> dict[str, Any]:
        self._guard(run)
        tool = TOOLS[name]
        t0 = time.monotonic()
        try:
            result = tool.fn(self._ctx(run), tool.args.model_validate(args))
        except (ToolError, BackendError, ValueError) as exc:
            self._trace(run, {"step": name, "tool": name, "tier": tool.tier, "model": tool.model, "status": "failed",
                              "latency_s": round(time.monotonic() - t0, 3), "detail": str(exc)[:200]})
            raise
        run.memory[name] = result
        tier = result.get("tier", tool.tier)
        self._trace(run, {"step": name, "tool": name, "tier": tier, "model": tool.model,
                          "latency_s": round(time.monotonic() - t0, 3), "detail": result.get("detail", "")})
        if "approval" in result:
            run.approvals.append(result["approval"])
        if "delivery" in result:
            run.deliveries.append(result["delivery"])
        return result

    def _notify_owner(self, run: Run, template: str, avoid: str = "", channels: tuple[str, ...] | None = None,
                      **slots: Any) -> Delivery | None:
        text = templates.render(template, run.language, **slots)
        try:
            d = self.hub.send_to(self.owner, OutboundMessage(to="", text=text, language=run.language, kind=template),
                                 channels=channels, avoid=avoid)
        except UnknownChannel:
            return None
        run.deliveries.append(d.public())
        self._trace(run, {"step": f"Owner notified ({template})", "tool": f"channel.{d.channel}", "tier": 1,
                          "model": "template", "detail": f"{d.channel} · {d.status} · {run.language}"})
        return d

    # --- facts ---------------------------------------------------------------------------------

    def _at_risk(self, run: Run) -> bool:
        s = (run.memory.get("forecast_run") or {}).get("summary") or {}
        prob = max(s.get("prob_negative_by_crunch_day") or 0, s.get("prob_negative_cash_horizon") or 0)
        return prob >= self.settings.risk_prob_threshold

    def _alert_slots(self, run: Run) -> dict[str, Any]:
        pi, lang = run.planner_input, run.language
        f = pi.fields if pi else {}
        s = run.memory["forecast_run"]["summary"]
        cust = next((c for c in CUSTOMERS if pi and c.id == pi.customer_id), None)
        delay = "?"
        rows = (run.memory.get("ledger_query") or {}).get("rows") or []
        inv = next((r for r in rows if isinstance(r, dict) and r.get("id") == f.get("invoice_number")), None)
        if inv and f.get("new_due_date"):
            delay = (date.fromisoformat(f["new_due_date"]) - date.fromisoformat(inv["due_date"])).days
        prob = max(s.get("prob_negative_by_crunch_day") or 0, 0)
        return {"customer": (cust.name if cust else f.get("issuer_name", "")).replace(" (fictional)", ""),
                "amount": templates.money(float(f.get("amount", 0)), f.get("currency", "USD"), lang),
                "delay": delay, "prob": templates.pct(prob), "crunch_date": s.get("crunch_date", "—"), "driver": ""}

    def _plan_slots(self, run: Run) -> dict[str, Any]:
        p, lang = run.memory["optimize_plan"], run.language
        opt = p["optimal"]
        return {"plan": " + ".join(a["summary"] for a in opt.get("actions", [])),
                "cost": templates.money(opt["total_cost_clp"], "CLP", lang),
                "default_cost": templates.money(p["default"]["total_cost_clp"], "CLP", lang),
                "savings": templates.pct(p.get("savings_pct") or 0),
                "coverage": templates.pct(opt.get("out_of_sample_coverage") or 0)}

    # --- entry points --------------------------------------------------------------------------

    def handle_document(self, doc: Document, language: str | None = None) -> Run:
        run = self._new_run("document", language)
        try:
            self._guard(run)
            res = ingest(doc, self.backend, self.router)
        except Halt as exc:
            self._notify_owner(run, "halted")
            return self._finish(run, "halted", str(exc))
        except BackendError as exc:
            return self._finish(run, "failed", f"ingestion failed: {exc}")
        for s in res.steps:
            self._trace(run, s)
        pi = run.planner_input = res.planner_input

        if pi.blocked:
            verify = (pi.payee_check.verify_by or {}).get("call")
            rules = ", ".join(dict.fromkeys(pi.flags))
            self._notify_owner(run, "blocked", avoid=_SOURCE_CHANNEL.get(doc.source, ""), doc_id=pi.doc_id,
                               rules=rules, verify=f" ({verify})" if verify else "")
            return self._finish(run, "blocked", f"{pi.doc_id}: {rules}")

        run.plan = self.planner.plan(pi, self.settings.scenario)
        self._trace(run, {"step": "Plan", "tool": f"planner.{run.plan.planner}", "model": run.plan.model or "rules",
                          "cost_usd": run.plan.cost_usd,
                          "detail": " → ".join(s.tool for s in run.plan.steps) + (f" · {run.plan.note}" if run.plan.note else "")})
        return self._execute(run)

    def _execute(self, run: Run) -> Run:
        try:
            for step in run.plan.steps:
                if step.when == "at_risk" and not self._at_risk(run):
                    self._trace(run, {"step": step.tool, "tool": step.tool, "status": "skipped",
                                      "detail": "forecast shows no cash risk"})
                    continue
                try:
                    self._tool(run, step.tool, step.args)
                except ToolError:
                    if TOOLS[step.tool].tier != 1:
                        raise
                    continue  # a refused notification (already in the trace) never stops the money flow
                if step.tool == "forecast_run" and self._at_risk(run) and run.planner_input.customer_id:
                    self._notify_owner(run, "alert", **self._alert_slots(run))
                if step.tool == "optimize_plan":
                    self._notify_owner(run, "plan", **self._plan_slots(run))
        except Halt as exc:
            self._notify_owner(run, "halted")
            return self._finish(run, "halted", str(exc))
        except (ToolError, BackendError, ValueError) as exc:
            return self._finish(run, "failed", str(exc)[:200])
        return self._settle(run)

    def _settle(self, run: Run) -> Run:
        """Tell the owner what happened to each proposal; pause while any is pending."""
        link = f"{self.settings.cockpit_url}/approvals"
        pending = False
        for a in run.approvals:
            if a["status"] == "pending":
                pending = True
                self._notify_owner(run, "approval", approval_id=a["id"], tier=a["tier"], link=link)
            elif a["status"] == "auto":
                self._notify_owner(run, "auto_done", action=a["action"], tier=a["tier"], link=link,
                                   amount=templates.money(a["amount_clp"], "CLP", run.language))
        if pending:
            return self._finish(run, "awaiting_approval", "waiting for the owner's OTP approval")
        return self._finish(run, "completed")

    def resume(self, run_id: str) -> Run:
        """Called when an approval changes (SSE `approval.*` or polling). The agent never approves."""
        run = self.runs[run_id]
        if run.status != "awaiting_approval":
            return run
        still_pending = False
        for i, a in enumerate(run.approvals):
            if a["status"] != "pending":
                continue
            cur = self.backend.get(f"/approvals/{a['id']}")
            run.approvals[i] = cur
            if cur["status"] == "pending":
                still_pending = True
            elif cur["status"] == "approved":
                anchor = self._safe_anchor(run)
                self._notify_owner(run, "approved", action=cur["action"], anchor=anchor)
            elif cur["status"] == "rejected":
                self._notify_owner(run, "rejected", action=cur["action"], reason=cur.get("note") or "—")
            else:
                self._trace(run, {"step": "Approval ended", "tool": "approvals.get", "tier": cur["tier"],
                                  "status": "failed", "detail": f"{cur['id']} {cur['status']}: {cur.get('note', '')}"})
        if still_pending:
            return run
        failed = any(a["status"] in ("locked", "failed", "blocked") for a in run.approvals)
        return self._finish(run, "failed" if failed else "completed")

    def _safe_anchor(self, run: Run) -> str:
        try:
            res = self._tool(run, "anchor_audit", {})
        except (Halt, ToolError, BackendError):
            return "pending"
        a = res.get("anchor")
        return f"#{a['id']}" if a else "already anchored"

    def resume_approval(self, approval_id: str) -> Run | None:
        for run in self.runs.values():
            if any(a["id"] == approval_id for a in run.approvals):
                return self.resume(run.id)
        return None

    def briefing(self, language: str | None = None, call: bool = True) -> dict[str, Any]:
        """Daily cash briefing (r2-08): numbers from the tools, words from the template, voice by ElevenLabs."""
        run = self._new_run("briefing", language)
        lang = run.language
        try:
            self._tool(run, "ledger_query", {"view": "accounts"})
            accounts = run.memory["ledger_query"]["rows"]
            receivables = self._tool(run, "ledger_query", {"view": "receivables"})["rows"]
            s = self._tool(run, "forecast_run", {"scenario": self.settings.scenario})["summary"]
        except Halt as exc:
            self._finish(run, "halted", str(exc))
            return {"run": run.summary(), "text": templates.render("halted", lang)}
        except (ToolError, BackendError) as exc:
            self._finish(run, "failed", str(exc))
            return {"run": run.summary(), "text": ""}
        as_of = date.fromisoformat(s.get("as_of") or date.today().isoformat())
        due = [r for r in receivables if 0 <= (date.fromisoformat(r["due_date"]) - as_of).days <= 30]
        by_ccy: dict[str, float] = {}
        for r in due:
            by_ccy[r["currency"]] = by_ccy.get(r["currency"], 0) + r["amount"]
        cash = next((a["balance"] for a in accounts if a["currency"] == "CLP"), 0)
        prob = s.get("prob_negative_by_crunch_day") if s.get("crunch_date") else s.get("prob_negative_cash_horizon")
        heads = {k: templates.headline(prob or 0, s.get("crunch_date"), s.get("crunch_day"), k) for k in templates.LANGS}
        text = templates.render(
            "briefing", lang, company=templates.COMPANY, cash=templates.money(cash, "CLP", lang),
            headline_es=heads["es"], headline_en=heads["en"], headline_zh=heads["zh"],
            receivables=", ".join(templates.money(v, k, lang) for k, v in by_ccy.items()) or "—",
            action=templates.T["briefing_action" if self._at_risk(run) else "briefing_ok"][lang])
        delivery = None
        if call:
            try:
                d = self.hub.send_to(self.owner, OutboundMessage(to="", text=text, language=lang, kind="briefing"),
                                     channels=("voice", "whatsapp"))
                delivery = d.public()
                run.deliveries.append(delivery)
                self._trace(run, {"step": "Cash briefing", "tool": f"channel.{d.channel}", "tier": 1,
                                  "model": "ElevenLabs" if self.settings.elevenlabs_api_key else "template",
                                  "detail": f"{d.channel} · {d.status} · {lang}"})
            except UnknownChannel:
                pass
        self._finish(run, "completed")
        return {"run": run.summary(), "text": text, "delivery": delivery}


def build_agent(settings: Settings | None = None) -> Agent:
    return Agent(settings or Settings.from_env())
