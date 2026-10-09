"""HTTP API for the quant engine (proposal for the OpenAPI contract with Camilo).

Thin FastAPI layer over `tools`: the same JSON the agent gets. Endpoints are sync `def`, so
FastAPI runs them in its threadpool and the CPU-bound work doesn't block the event loop.
The contract is exported to `api/openapi.json` with `python -m nanfeng_quant.api --export`.

Run locally:  uvicorn nanfeng_quant.api:app --port 8100
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from . import __version__, tools
from .model import Company

ROOT = Path(__file__).resolve().parents[1]
RESULTS_DIR = ROOT / "results"
DEMO_ARTIFACTS = {
    "before": "cherry_crisis_before.json", "forecast": "cherry_crisis_forecast.json",
    "quotes": "cherry_crisis_quotes.json", "plan": "cherry_crisis_plan.json",
    "passport": "cherry_crisis_passport.json", "scenario_lab": "cherry_crisis_scenario_lab.json",
}


# ---------------------------------------------------------------------------
# request models
# ---------------------------------------------------------------------------

class Overrides(BaseModel):
    """Scenario Lab knobs and counterfactual switches. All optional."""
    model_config = ConfigDict(extra="forbid")
    customer_delay_extra_days: dict[str, float] = Field(default_factory=dict, description="Extra delay per customer id, days")
    global_delay_extra_days: float = Field(0.0, description="Extra delay for every customer, days")
    cny_shift_pct: float = Field(0.0, description="Level shift of CLP per CNY from today, %")
    usd_shift_pct: float = Field(0.0, description="Level shift of CLP per USD from today, %")
    cherry_price_pct: float = Field(0.0, description="Change in cherry price for uninvoiced shipments, %")
    extra_hires: int = Field(0, ge=0, description="Extra workers added to every payroll")
    hire_monthly_wage_clp: float = 650_000.0
    on_time_customers: list[str] = Field(default_factory=list)
    defaulted_customers: list[str] = Field(default_factory=list)
    ignore_announced_delays: bool = False
    freeze_fx: bool = False
    freeze_price: bool = False


class ScenarioRef(BaseModel):
    scenario: str | dict[str, Any] = Field("cherry_crisis", description="Scenario id in data/scenarios, or a full scenario object (see ScenarioSchema)")


class ForecastRequest(ScenarioRef):
    overrides: Overrides | None = None
    n_paths: int = Field(10_000, ge=100, le=100_000)
    seed: int = 7
    explain: bool = True


class QuoteRequest(ScenarioRef):
    amount_clp: float | None = Field(None, description="Cash need; default = P10 shortfall vs buffer on the crunch day")
    need_date: str | None = Field(None, description="ISO date of the need; default = crunch day")
    need_days: int = Field(30, ge=1)
    overrides: Overrides | None = None
    seed: int = 7


class PlanRequest(ScenarioRef):
    confidence: float = Field(0.90, gt=0.5, lt=1.0, description="Share of scenarios that must stay above the buffer")
    overrides: Overrides | None = None
    n_paths: int = Field(10_000, ge=1000, le=50_000)
    seed: int = 7
    explain: bool = True
    n_scenarios: int = Field(200, ge=50, le=500, description="Scenarios inside the MILP")


class PassportRequest(ScenarioRef):
    consent: bool = Field(False, description="SME consents to share; adds a SHA-256 digest for on-chain anchoring")
    seed: int = 7


# ---------------------------------------------------------------------------
# response models (key fields typed, extra fields allowed)
# ---------------------------------------------------------------------------

class Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class Source(Loose):
    tool: str
    engine: str
    deterministic: bool
    seed: int | None = None


class Summary(Loose):
    company_id: str
    as_of: str
    horizon_days: int
    prob_negative_cash_horizon: float
    prob_below_buffer_horizon: float
    crunch_day: int | None
    crunch_date: str | None
    prob_negative_by_crunch_day: float | None
    headline: str


class FanChart(Loose):
    dates: list[str]
    p10: list[float]
    p50: list[float]
    p90: list[float]
    p_negative: list[float]
    buffer: float


class Driver(Loose):
    driver: Literal["customer", "announced_delay", "fx", "price"]
    id: str | None
    counterfactual: str
    prob_negative_by_day: float
    delta_vs_base: float


class Drivers(Loose):
    probe_date: str
    drivers: list[Driver]
    explanation: str


class ForecastResponse(Loose):
    summary: Summary
    fan_chart: FanChart
    drivers: Drivers | None = None
    latency_ms: int
    source: Source


class Quote(Loose):
    product_id: str
    name: str
    kind: str
    lender: str
    eligible: bool
    reason: str
    cost_clp: float | None = None
    eac: float | None = Field(None, description="Effective annual cost (compound)")
    term_days: int | None = None
    requirements: str


class QuoteResponse(Loose):
    amount_clp: float
    need_date: str
    quotes: list[Quote]
    source: Source


class PlanAction(Loose):
    product_id: str
    product: str
    kind: Literal["factoring", "lc_discount", "loan", "confirming", "forward"]
    lender: str
    date: str
    cost_clp: float
    summary: str


class Plan(Loose):
    status: Literal["optimal", "feasible", "infeasible", "error"]
    total_cost_clp: float | None
    actions: list[PlanAction]
    confidence_target: float
    out_of_sample_coverage: float | None


class Explanation(Loose):
    product_id: str
    name: str
    selected: bool
    reason: str


class PlanResponse(Loose):
    optimal: Plan
    default: Plan
    default_product: str
    savings_clp: float | None = None
    savings_pct: float | None = None
    forecast: Summary
    explanation: list[Explanation] | None = None
    latency_ms: int
    source: Source


class PassportFactor(Loose):
    factor: str
    description: str
    value: float
    sub_score: float
    weight: float
    points: float


class PassportResponse(Loose):
    company_id: str
    score: float
    grade: Literal["A", "B", "C", "D", "E"]
    factors: list[PassportFactor]
    summary: str
    consent: bool
    digest_sha256: str | None = None
    source: Source


# ---------------------------------------------------------------------------
# app
# ---------------------------------------------------------------------------

app = FastAPI(title="NanFeng Quant API", version=__version__,
              description="Cash forecast (Monte Carlo), financing plan (MILP), quotes and Credit Passport. "
                          "Every number is deterministic for a given seed; the LLM never computes.")


def _scenario(req: ScenarioRef) -> str | dict[str, Any]:
    try:
        tools.load_scenario(req.scenario)
    except FileNotFoundError:
        raise HTTPException(404, f"unknown scenario {req.scenario!r}")
    except (ValueError, TypeError, KeyError) as e:
        raise HTTPException(422, f"invalid scenario: {e}")
    return req.scenario


def _ov(o: Overrides | None) -> dict[str, Any] | None:
    return None if o is None else o.model_dump()


@app.get("/quant/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/quant/scenarios")
def list_scenarios() -> list[str]:
    return sorted(p.stem for p in tools.SCENARIO_DIR.glob("*.json"))


@app.get("/quant/scenarios/{scenario_id}")
def get_scenario(scenario_id: str) -> dict[str, Any]:
    try:
        return tools.load_scenario(scenario_id).to_dict()
    except FileNotFoundError:
        raise HTTPException(404, f"unknown scenario {scenario_id!r}")


@app.post("/quant/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> dict[str, Any]:
    return tools.forecast_run(_scenario(req), _ov(req.overrides), req.n_paths, req.seed, req.explain)


@app.post("/quant/quote", response_model=QuoteResponse)
def quote(req: QuoteRequest) -> dict[str, Any]:
    return tools.financing_quote(_scenario(req), req.amount_clp, req.need_date, req.need_days, _ov(req.overrides), req.seed)


@app.post("/quant/plan", response_model=PlanResponse)
def plan(req: PlanRequest) -> dict[str, Any]:
    return tools.optimize_plan(_scenario(req), req.confidence, _ov(req.overrides), req.n_paths, req.seed,
                               req.explain, req.n_scenarios)


@app.post("/quant/passport", response_model=PassportResponse)
def passport(req: PassportRequest) -> dict[str, Any]:
    return tools.credit_passport(_scenario(req), req.consent, req.seed)


@app.get("/quant/demo/{artifact}")
def demo(artifact: Literal["before", "forecast", "quotes", "plan", "passport", "scenario_lab"]) -> Any:
    """Precomputed Cherry Crisis results for Demo Mode: no computation, no network dependency."""
    return json.loads((RESULTS_DIR / DEMO_ARTIFACTS[artifact]).read_text(encoding="utf-8"))


@app.get("/quant/schema/scenario")
def scenario_schema() -> dict[str, Any]:
    """JSON Schema of a scenario object (company, customers, receivables, shipments, payables)."""
    return TypeAdapter(Company).json_schema()


def export(out_dir: Path = ROOT / "api") -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "openapi.json").write_text(json.dumps(app.openapi(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (out_dir / "scenario.schema.json").write_text(json.dumps(scenario_schema(), indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out_dir / 'openapi.json'} and {out_dir / 'scenario.schema.json'}")


if __name__ == "__main__":
    if "--export" in sys.argv:
        export()
    else:
        import uvicorn
        uvicorn.run(app, port=8100)
