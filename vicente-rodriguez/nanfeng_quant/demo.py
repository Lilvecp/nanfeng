"""Recompute every Cherry Crisis artifact in results/ (what the Demo Mode replays).



Fixed seed (7) so every run gives the same numbers. The plan is solved offline with a long solver

budget, so the demo shows the proven optimum. `cherry_crisis_story.json` is the single sheet of

numbers for the front, the deck and the video.

"""

from __future__ import annotations



import json

from pathlib import Path

from typing import Any



from . import tools

from .catalog import spot
from .fx import load_history



ROOT = Path(__file__).resolve().parents[1]

RESULTS_DIR = ROOT / "results"

SCENARIO = "cherry_crisis"

OFFLINE_BUDGET_S = 120.0  # offline: give the MILP time to prove optimality



LAB = [  # Scenario Lab presets: (label, overrides)

    ("Base (after the Shanghai notice)", {}),

    ("Before the notice", {"ignore_announced_delays": True}),

    ("All customers +15 days late", {"global_delay_extra_days": 15}),

    ("CNY -5% vs CLP", {"cny_shift_pct": -5}),

    ("CNY +5% vs CLP", {"cny_shift_pct": 5}),

    ("USD -5% vs CLP", {"usd_shift_pct": -5}),

    ("Cherry price -10%", {"cherry_price_pct": -10}),

    ("Cherry price +10%", {"cherry_price_pct": 10}),

    ("30 extra harvest workers", {"extra_hires": 30}),

]





def _write(name: str, data: Any) -> None:

    (RESULTS_DIR / name).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")





def run() -> dict[str, Any]:

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    before = tools.forecast_run(SCENARIO, {"ignore_announced_delays": True})

    after = tools.forecast_run(SCENARIO)

    quotes = tools.financing_quote(SCENARIO)

    plan = tools.optimize_plan(SCENARIO, exact_time_limit_s=OFFLINE_BUDGET_S)

    passport = tools.credit_passport(SCENARIO, consent=True)

    lab = []

    for label, ov in LAB:

        s = tools.forecast_run(SCENARIO, ov, explain=False)["summary"]

        p = tools.optimize_plan(SCENARIO, overrides=ov, explain=False, exact_time_limit_s=10.0)

        lab.append({"preset": label, "overrides": ov, "headline": s["headline"],

                    "prob_negative_cash_horizon": s["prob_negative_cash_horizon"],

                    "prob_below_buffer_horizon": s["prob_below_buffer_horizon"],

                    "crunch_date": s["crunch_date"], "min_cash_p10": round(s["min_cash_p10"]),

                    "plan_cost_clp": p["optimal"]["total_cost_clp"], "default_cost_clp": p["default"]["total_cost_clp"],

                    "savings_pct": p.get("savings_pct"),

                    "plan_actions": [a["summary"] for a in p["optimal"]["actions"]]})

    story = build_story(before, after, quotes, plan, passport, lab)

    _write("cherry_crisis_before.json", before)

    _write("cherry_crisis_forecast.json", after)

    _write("cherry_crisis_quotes.json", quotes)

    _write("cherry_crisis_plan.json", plan)

    _write("cherry_crisis_passport.json", passport)

    _write("cherry_crisis_scenario_lab.json", lab)

    _write("cherry_crisis_story.json", story)

    (RESULTS_DIR / "cherry_crisis_summary.md").write_text(render(before, after, quotes, plan, passport, lab), encoding="utf-8")

    return {"before": before["summary"]["headline"], "after": after["summary"]["headline"],

            "plan_cost_clp": plan["optimal"]["total_cost_clp"], "default_cost_clp": plan["default"]["total_cost_clp"],

            "savings_pct": plan.get("savings_pct"), "passport": passport["summary"]}





def _m(clp: float) -> str:

    return f"CLP {clp / 1e6:,.1f}M"





def _es(text: str) -> str:
    """Spanish number format: 180,000.5 -> 180.000,5"""
    return text.translate(str.maketrans({",": ".", ".": ","}))


def _wan(clp: float) -> str:

    """Chinese amounts in 万 (10,000)."""

    return f"{clp / 1e4:,.0f}万智利比索"





def rebuild_story() -> dict[str, Any]:

    """Rebuild cherry_crisis_story.json and the summary from the saved artifacts, without re-solving."""

    load = lambda n: json.loads((RESULTS_DIR / n).read_text(encoding="utf-8"))

    parts = [load(f) for f in ("cherry_crisis_before.json", "cherry_crisis_forecast.json", "cherry_crisis_quotes.json",

                               "cherry_crisis_plan.json", "cherry_crisis_passport.json", "cherry_crisis_scenario_lab.json")]

    story = build_story(*parts)

    _write("cherry_crisis_story.json", story)

    (RESULTS_DIR / "cherry_crisis_summary.md").write_text(render(*parts), encoding="utf-8")

    return story["strings"]





def build_story(before, after, quotes, plan, passport, lab) -> dict[str, Any]:

    """Every number the front, deck and video show, in one place (with EN / ES / 中文 strings)."""

    company = tools.load_scenario(SCENARIO)

    fx = spot(company)

    s, o, d = after["summary"], plan["optimal"], plan["default"]

    late = next(r for r in company.receivables if r.announced_delay_days)

    shanghai = company.customer(late.customer_id)

    crunch_out = after["drivers"]["outflows_on_probe_day"]

    payroll = max(crunch_out, key=lambda x: x["amount"]) if crunch_out else None

    cov = o["out_of_sample_coverage"]

    p_before = before["summary"]["prob_negative_cash_horizon"]

    p_after = s["prob_negative_by_crunch_day"]

    p_plan = plan["after_plan"]["prob_negative_cash_horizon"]

    acts = o["actions"]

    pp = plan["credit_passport"]

    arena = [q for q in quotes["quotes"] if q.get("cost_clp") is not None and q.get("eligible")]



    def act_text(lang: str) -> str:

        out = []

        for a in acts:

            if a["kind"] == "loan":

                amt = f"{a['currency']} {a['amount']:,.0f}"

                pae = a["product_id"] == "PAE-USD"

                out.append({"en": f"{a['term_days']}-day pre-export loan of {amt}" if pae else f"{a['term_days']}-day loan of {amt}",

                            "es": f"crédito de pre-exportación (PAE) por {_es(amt)} a {a['term_days']} días" if pae else f"crédito por {_es(amt)} a {a['term_days']} días",

                            "zh": f"{a['term_days']}天期出口前融资（PAE）{a['amount']:,.0f}美元" if pae else f"{a['term_days']}天期贷款 {amt}"}[lang])

            elif a["kind"] in ("factoring", "lc_discount"):

                out.append({"en": f"factoring {a['fraction']:.0%} of invoice {a['receivable_id']}",

                            "es": f"factoring del {a['fraction']:.0%} de la factura {a['receivable_id']}",

                            "zh": f"发票 {a['receivable_id']} 的 {a['fraction']:.0%} 保理"}[lang])

            else:

                out.append(a["summary"])

        return {"en": " + ".join(out), "es": " + ".join(out), "zh": " + ".join(out)}[lang]



    return {

        "scenario": SCENARIO, "company": company.name, "fictional": True, "as_of": company.as_of.isoformat(),

        "opening_cash_clp": company.opening_cash_clp, "buffer_clp": company.min_cash_buffer_clp,

        "fx_spot": {"clp_per_usd": round(fx["USD"], 2), "clp_per_cny": round(fx["CNY"], 2),

                    "cny_per_usd": round(fx["USD"] / fx["CNY"], 4),
                    "date": str(load_history().dates[-1]),
                    "source": "BCCh dólar observado and FRED DEXCHUS, last day with both quotes"},

        "event": {"time": "10:12", "invoice": late.id, "customer": shanghai.name, "amount": late.amount,

                  "currency": late.currency, "delay_days": late.announced_delay_days,

                  "due_date": late.due_date.isoformat()},

        "forecast_before": {"prob_negative_90d": p_before, "headline": before["summary"]["headline"]},

        "forecast_after": {"prob_negative_by_crunch": p_after, "crunch_day": s["crunch_day"], "crunch_date": s["crunch_date"],

                           "prob_below_buffer_90d": s["prob_below_buffer_horizon"], "headline": s["headline"],

                           "crunch_outflow": payroll, "driver": after["drivers"]["explanation"],

                           "n_paths": after["source"]["n_paths"]},

        "plan": {"actions": [{k: a.get(k) for k in ("summary", "date", "product_id", "lender", "cost_clp", "amount",

                                                     "currency", "amount_clp", "term_days", "receivable_id", "fraction",

                                                     "proceeds_clp")} for a in acts],

                 "cost_clp": o["total_cost_clp"], "default_cost_clp": d["total_cost_clp"],

                 "default_product": plan["default_product"], "default_actions": [a["summary"] for a in d["actions"]],

                 "savings_clp": plan["savings_clp"], "savings_pct": plan["savings_pct"],

                 "coverage": cov, "default_coverage": d["out_of_sample_coverage"],

                 "prob_negative_after_plan": p_plan, "method": o.get("method"), "optimality_gap": o.get("optimality_gap"),

                 "forward_chosen": any(a["kind"] == "forward" for a in acts)},

        "approval_request": plan["approval_request"],

        "credit_passport": {"before": pp["before"], "after_plan": pp["after_plan"]},

        "financing_arena": [{"product": q["name"], "lender": q["lender"], "cost_clp": round(q["cost_clp"]),

                             "eac": None if q.get("eac") is None else round(q["eac"], 4), "term_days": q.get("term_days"),

                             "covers_need": q.get("covers_need"), "requirements": q["requirements"]} for q in arena],

        "financing_need": {"amount_clp": quotes["amount_clp"], "need_date": quotes["need_date"], "need_days": quotes["need_days"]},

        "scenario_lab": lab,

        "strings": {

            "alert": {

                "en": f"{shanghai.name.split(' (')[0]} will pay USD {late.amount:,.0f} {late.announced_delay_days} days late. "

                      f"{p_after:.0%} chance cash goes negative on {s['crunch_date']} (harvest payroll {_m(payroll['amount']) if payroll else ''}).",

                "es": f"{shanghai.name.split(' (')[0]} pagará USD {_es(f'{late.amount:,.0f}')} con {late.announced_delay_days} días de atraso. "

                      f"{p_after:.0%} de probabilidad de caja negativa el {s['crunch_date']} (nómina de cosecha {_es(_m(payroll['amount'])) if payroll else ''}).",

                "zh": f"上海客户的 {late.amount:,.0f} 美元货款将延迟 {late.announced_delay_days} 天支付。"

                      f"{s['crunch_date']}（采收工资 {_wan(payroll['amount']) if payroll else ''} 发放日）现金为负的概率为 {p_after:.0%}。",

            },

            "plan": {

                "en": f"Best plan: {act_text('en')}. Cost {_m(o['total_cost_clp'])} vs {_m(d['total_cost_clp'])} for the bank loan "

                      f"({plan['savings_pct']:.0%} cheaper). Cash stays above the buffer in {cov:.0%} of 10,000 scenarios.",

                "es": f"Mejor plan: {act_text('es')}. Costo {_es(_m(o['total_cost_clp']))} vs {_es(_m(d['total_cost_clp']))} del crédito bancario "

                      f"({plan['savings_pct']:.0%} más barato). La caja se mantiene sobre el colchón en el {cov:.0%} de 10.000 escenarios.",

                "zh": f"最优方案：{act_text('zh')}。成本 {_wan(o['total_cost_clp'])}，银行贷款需 {_wan(d['total_cost_clp'])}"

                      f"（节省 {plan['savings_pct']:.0%}）。在 10,000 个模拟情景中，{cov:.0%} 的情景现金保持在安全垫之上。",

            },

            "approval": {

                "en": f"Approve this plan? Reply with the 6-digit code we just sent by SMS. Cost {_m(o['total_cost_clp'])}.",

                "es": f"¿Apruebas este plan? Responde con el código de 6 dígitos que te enviamos por SMS. Costo {_es(_m(o['total_cost_clp']))}.",

                "zh": f"是否批准此方案？请回复我们刚通过短信发送的6位验证码。成本 {_wan(o['total_cost_clp'])}。",

            },

            "note": "ES and 中文 strings are machine-assisted: have a native reader check them before the video (plan/risks.md).",

        },

    }





def render(before, after, quotes, plan, passport, lab) -> str:

    o, d = plan["optimal"], plan["default"]

    s = after["summary"]

    lines = [

        "# Cherry Crisis — quant results", "",

        "Huerto Austral Export SpA (fictional). Generated by `python -m nanfeng_quant demo` (seed 7, 10,000 paths). "

        "Every number for the front, deck and video is also in `cherry_crisis_story.json`.", "",

        "## Forecast", "",

        f"- Before the Shanghai notice: **{before['summary']['headline']}**",

        f"- After the notice (USD 180,000 paid 45 days late): **{s['headline']}**",

        f"- Probability of going below the CLP {after['fan_chart']['buffer']:,.0f} buffer within 90 days: {s['prob_below_buffer_horizon']:.0%}",

        f"- {after['drivers']['explanation']}", "",

        "## Plan (MILP)", "",

        f"Target: cash above the buffer in {o['confidence_target']:.0%} of scenarios. "

        f"Solver {o.get('solver')}, {o.get('method')}, gap {o.get('optimality_gap')}, {o['solve_seconds']} s.", "",

        "| Action | Date | Cost (CLP) |", "|---|---|---|",

    ]

    for a in o["actions"]:

        lines.append(f"| {a['summary']} | {a['date']} | {a['cost_clp']:,.0f} |")

    lines += [

        "", f"- **Total cost: CLP {o['total_cost_clp']:,.0f}** vs. default bank loan alone CLP {d['total_cost_clp']:,.0f} "

            f"({'; '.join(a['summary'] for a in d['actions'])}) → **savings CLP {plan['savings_clp']:,.0f} ({plan['savings_pct']:.0%})**",

        f"- Out-of-sample check on all 10,000 paths: cash stays above the buffer in {o['out_of_sample_coverage']:.1%} "

        f"(default loan: {d['out_of_sample_coverage']:.1%}); probability of negative cash after the plan "

        f"{plan['after_plan']['prob_negative_cash_horizon']:.1%}",

        f"- Credit Passport: {plan['credit_passport']['before']['score']:.0f} ({plan['credit_passport']['before']['grade']}) today → "

        f"{plan['credit_passport']['after_plan']['score']:.0f} ({plan['credit_passport']['after_plan']['grade']}) with the plan", "",

        "### Why each option is in or out", "", "| Product | Selected | Reason |", "|---|---|---|",

    ]

    for e in plan.get("explanation", []):

        reason = e["reason"] + (f" — without it: {e['without_it']}" if e.get("without_it") else "")

        lines.append(f"| {e['name']} | {'✅' if e['selected'] else '—'} | {reason} |")

    lines += ["", "### Approval request (body for the backend's POST /approvals)", "", "```json",

              json.dumps({k: plan["approval_request"][k] for k in ("action", "operations", "channel")}, indent=1, ensure_ascii=False),

              "```", "",

              "## Financing Arena quotes (need: CLP "

              f"{quotes['amount_clp']:,.0f} on {quotes['need_date']}, 30 days)", "",

              "| Product | Eligible | Cost (CLP) | EAC | Term | Note |", "|---|---|---|---|---|---|"]

    for q in quotes["quotes"]:

        cost = f"{q['cost_clp']:,.0f}" if q.get("cost_clp") is not None else "–"

        eac = f"{q['eac']:.1%}" if q.get("eac") is not None else "–"

        term = f"{q['term_days']} d" if q.get("term_days") else "–"

        lines.append(f"| {q['name']} | {'yes' if q['eligible'] else 'no'} | {cost} | {eac} | {term} | {q['reason']} |")

    lines += ["", "## Scenario Lab presets", "",

              "| Preset | Headline | P(below buffer) | Plan cost (CLP) | Bank loan (CLP) | Savings |", "|---|---|---|---|---|---|"]

    money = lambda v: "–" if v is None else f"{v:,.0f}"

    for row in lab:

        sv = "–" if row.get("savings_pct") is None else f"{row['savings_pct']:.0%}"

        lines.append(f"| {row['preset']} | {row['headline']} | {row['prob_below_buffer_horizon']:.0%} | "

                     f"{money(row.get('plan_cost_clp'))} | {money(row.get('default_cost_clp'))} | {sv} |")

    lines += ["", "## Credit Passport", "", f"{passport['summary']}", "",

              "| Factor | Value | Sub-score | Weight | Points |", "|---|---|---|---|---|"]

    for f in passport["factors"]:

        lines.append(f"| {f['description']} | {f['value']} | {f['sub_score']} | {f['weight']} | {f['points']} |")

    return "\n".join(lines) + "\n"

