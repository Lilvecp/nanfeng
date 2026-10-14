""""Ask it why" (Mission Control): the agent explains its own runs from the facts it recorded.

The answer is built from the run's tool results with templates, so every number and every reason is
one a tool returned. No LLM rewrites it: in a live test a model "explained" a choice with a reason
that was not true (a plausible sentence with no new number), which no check can catch reliably.
"""

from __future__ import annotations

import re
from typing import Any

from . import templates
from .orchestrator import Run

INTENTS: list[tuple[str, str]] = [
    ("blocked", r"block|bloque|attack|ataque|fraud|fraude|拦截|攻击|诈骗"),
    ("tier", r"\bl3\b|otp|code|c[oó]digo|approv|aprob|why .*wait|por qu[eé] .*esper|验证码|批准"),
    ("alternatives", r"factor|other option|otras? opci|alternativ|default|banc|bank loan|cr[eé]dito bancario|其他|保理|银行贷款"),
    ("plan", r"why|por qu[eé]|plan|pae|loan|cr[eé]dito|pr[eé]stamo|为什么|方案|贷款"),
    ("risk", r"risk|riesgo|cash|caja|negative|negativ|crunch|风险|现金"),
    ("did", r"what did|qu[eé] hiciste|steps|pasos|did you|做了什么|步骤"),
]

NO_RUN = {"es": "Todavía no he ejecutado nada hoy. Cuando llegue un documento o pidas el briefing, te explico cada paso.",
          "en": "I have not run anything yet today. When a document arrives or you ask for the briefing, I explain every step.",
          "zh": "今天我还没有执行任何操作。收到文件或您请求简报后，我会解释每一步。"}


def match(question: str) -> str | None:
    """The intent a question asks about, or None if it matches none (it is not a question for us)."""
    q = question.lower()
    return next((name for name, rx in INTENTS if re.search(rx, q)), None)


def intent(question: str) -> str:
    return match(question) or "did"


def _facts(run: Run) -> dict[str, Any]:
    m = run.memory
    f: dict[str, Any] = {"run_id": run.id, "status": run.status, "note": run.note,
                         "tools": [s["tool"] for s in run.steps if s.get("status") == "done"]}
    if "forecast_run" in m:
        s = m["forecast_run"]["summary"]
        f["forecast"] = {k: s.get(k) for k in ("headline", "prob_negative_by_crunch_day", "crunch_date", "crunch_day",
                                               "prob_below_buffer_horizon", "min_cash_p10")}
    if "optimize_plan" in m:
        p = m["optimize_plan"]
        f["plan"] = {"actions": [a["summary"] for a in p["optimal"].get("actions", [])],
                     "cost_clp": p["optimal"]["total_cost_clp"], "default_cost_clp": p["default"]["total_cost_clp"],
                     "savings_pct": p.get("savings_pct"), "coverage": p["optimal"].get("out_of_sample_coverage"),
                     "choice": p.get("choice", "optimal"), "no_proposal_reason": p.get("no_proposal_reason") or "",
                     "default_actions": [a["summary"] for a in p["default"].get("actions", [])],
                     "why": [{"product": e.get("name") or e.get("product"), "selected": e.get("selected"), "reason": e.get("reason")}
                             for e in (p.get("explanation") or [])][:9]}
    if run.approvals:
        f["approvals"] = [{k: a.get(k) for k in ("id", "tier", "status", "note", "amount_clp")} for a in run.approvals]
    if run.planner_input is not None:
        f["flags"] = run.planner_input.flags
        f["doc_id"] = run.planner_input.doc_id
        f["verify_by"] = (run.planner_input.payee_check.verify_by or {}).get("call")
    return f


def _template_answer(kind: str, f: dict[str, Any], lang: str) -> str:
    L = lambda es, en, zh: {"es": es, "en": en, "zh": zh}[lang]  # noqa: E731
    fc, plan, appr = f.get("forecast"), f.get("plan"), (f.get("approvals") or [None])[0]

    if kind == "blocked" and f.get("flags") and f["status"] == "blocked":
        rules = ", ".join(dict.fromkeys(f["flags"]))
        call = f" {L('Verifica llamando al', 'Verify by calling', '请拨打')} {f['verify_by']}." if f.get("verify_by") else ""
        return L(f"Bloqueé {f['doc_id']} porque disparó: {rules}. Ningún modelo de IA leyó su texto y no se creó ninguna solicitud de pago.",
                 f"I blocked {f['doc_id']} because it triggered: {rules}. No AI model read its text and no payment request was created.",
                 f"我拦截了 {f['doc_id']}，触发规则：{rules}。没有任何 AI 模型读取其内容，也没有创建付款请求。") + call
    if kind == "tier" and appr:
        return L(f"La solicitud {appr['id']} es L{appr['tier']} porque es dinero nuevo (crédito o factoring) por "
                 f"{templates.money(appr['amount_clp'], 'CLP', 'es')}: el motor de políticas, no yo, exige tu código. "
                 f"Yo puedo proponer, nunca aprobar. Estado: {appr['status']}.",
                 f"Request {appr['id']} is L{appr['tier']} because it is new money (a loan or factoring) for "
                 f"{templates.money(appr['amount_clp'], 'CLP')}: the policy engine, not me, requires your code. "
                 f"I can propose, never approve. Status: {appr['status']}.",
                 f"请求 {appr['id']} 为 L{appr['tier']} 级，因为这是新增融资（{templates.money(appr['amount_clp'], 'CLP', 'zh')}）："
                 f"需要您的验证码的是策略引擎，而不是我。我只能提议，不能批准。状态：{appr['status']}。")
    if kind == "alternatives" and plan:
        out = [e for e in plan["why"] if not e["selected"]][:3]
        lines = "; ".join(f"{e['product']}: {e['reason']}" for e in out)
        return L(f"Descarté las otras opciones así (motivos del optimizador): {lines}.",
                 f"Here is why the other options lost (the optimizer's reasons): {lines}.",
                 f"其他方案落选的原因（优化器给出）：{lines}。")
    if kind in ("plan", "alternatives") and plan and plan["choice"] == "none":
        return L(f"No propuse ninguna operación: {plan['no_proposal_reason']}. Nada se mueve sin un plan que el banco pueda ejecutar entero.",
                 f"I proposed no operation: {plan['no_proposal_reason']}. Nothing moves without a plan the bank can execute in full.",
                 f"我没有提议任何操作：{plan['no_proposal_reason']}。银行无法完整执行的方案，不会动用任何资金。")
    if kind in ("plan", "alternatives") and plan and plan["choice"] == "default":
        cost = templates.money(plan["default_cost_clp"], "CLP", lang)
        return L(f"Propuse {' + '.join(plan['default_actions'])}, el crédito bancario de siempre ({cost}): el optimizador "
                 f"no encontró una mezcla más barata, así que no te vendo ningún ahorro.",
                 f"I proposed {' + '.join(plan['default_actions'])}, the usual bank loan ({cost}): the optimizer found no "
                 f"cheaper mix, so I claim no savings.",
                 f"我提议了 {' + '.join(plan['default_actions'])}（常规银行贷款，{cost}）：优化器没有找到更便宜的组合，因此不声称任何节省。")
    if kind in ("plan", "alternatives") and plan:
        return L(f"Elegí {' + '.join(plan['actions'])} porque es la mezcla más barata que mantiene la caja sobre el colchón: "
                 f"{templates.money(plan['cost_clp'], 'CLP', 'es')} vs {templates.money(plan['default_cost_clp'], 'CLP', 'es')} "
                 f"del crédito bancario ({templates.pct(plan['savings_pct'] or 0)} más barato), y cubre el "
                 f"{templates.pct(plan['coverage'] or 0)} de 10.000 escenarios. Los números son del optimizador MILP, no míos.",
                 f"I chose {' + '.join(plan['actions'])} because it is the cheapest mix that keeps cash above the buffer: "
                 f"{templates.money(plan['cost_clp'], 'CLP')} vs {templates.money(plan['default_cost_clp'], 'CLP')} for the "
                 f"bank loan ({templates.pct(plan['savings_pct'] or 0)} cheaper), covering {templates.pct(plan['coverage'] or 0)} "
                 f"of 10,000 scenarios. The numbers come from the MILP optimizer, not from me.",
                 f"我选择了 {' + '.join(plan['actions'])}，因为这是保持现金高于安全垫的最低成本组合："
                 f"{templates.money(plan['cost_clp'], 'CLP', 'zh')}，银行贷款需 {templates.money(plan['default_cost_clp'], 'CLP', 'zh')}"
                 f"（节省 {templates.pct(plan['savings_pct'] or 0)}），覆盖 10,000 个情景中的 {templates.pct(plan['coverage'] or 0)}。数字来自 MILP 优化器。")
    if kind in ("risk", "plan") and fc:
        return L(f"El pronóstico (10.000 escenarios Monte Carlo) dice: {fc['headline']}. Mínimo de caja P10: "
                 f"{templates.money(fc['min_cash_p10'] or 0, 'CLP', 'es')}.",
                 f"The forecast (10,000 Monte Carlo scenarios) says: {fc['headline']}. P10 minimum cash: "
                 f"{templates.money(fc['min_cash_p10'] or 0, 'CLP')}.",
                 f"预测（10,000 个蒙特卡洛情景）：{fc['headline']}。P10 最低现金：{templates.money(fc['min_cash_p10'] or 0, 'CLP', 'zh')}。")
    tools = " → ".join(dict.fromkeys(f["tools"])) or "—"
    return L(f"En la corrida {f['run_id']} usé: {tools}. Estado: {f['status']}{'. ' + f['note'] if f['note'] else ''}.",
             f"In run {f['run_id']} I used: {tools}. Status: {f['status']}{'. ' + f['note'] if f['note'] else ''}.",
             f"在运行 {f['run_id']} 中我使用了：{tools}。状态：{f['status']}{'。' + f['note'] if f['note'] else ''}。")


def answer(question: str, run: Run | None, lang: str = "en") -> dict[str, Any]:
    lang = lang if lang in templates.LANGS else "en"
    if run is None:
        return {"answer": NO_RUN[lang], "intent": "none", "run_id": None, "model": "template"}
    kind = intent(question)
    facts = _facts(run)
    text = _template_answer(kind, facts, lang)
    return {"answer": text, "intent": kind, "run_id": run.id, "model": "template"}

