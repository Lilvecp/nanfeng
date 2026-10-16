"""Gateway to Vicente's quant engine (quant/docs/api.md). Paths stay the same, so the
contract he published is the contract the front and the agent see, just on our origin.

/quant/plan takes 5-30 s: /quant/plan/jobs runs it in the background and reports progress on the
SSE stream, as his integration notes ask.

Running the engine costs CPU (the MILP takes 5-30 s), so every POST and the plan jobs need the agent's
token or the owner's session; the read-only GETs (health, scenarios, demo artifacts) stay public for
health checks. At most MAX_RUNNING plan jobs run at once and the last MAX_KEPT are kept.
"""

import asyncio
import itertools
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

from ..auth import require_owner
from ..config import get_settings
from ..events import broker
from ..security import require_agent

router = APIRouter(prefix="/quant", tags=["quant"])

_jobs: dict[str, dict[str, Any]] = {}
_job_ids = itertools.count(1)
_tasks: set[asyncio.Task] = set()
MAX_RUNNING = 4
MAX_KEPT = 100


def require_caller(authorization: str = Header(default="")) -> str:
    """The agent (its token) or the signed-in owner; anyone else gets 401."""
    try:
        return require_agent(authorization)
    except HTTPException:
        return require_owner(authorization)


def _forget_old_jobs() -> None:
    """Keeps the newest MAX_KEPT jobs (dicts keep insertion order); running jobs are never dropped."""
    for job_id in [j for j, v in _jobs.items() if v["status"] != "running"][: max(0, len(_jobs) - MAX_KEPT)]:
        del _jobs[job_id]


async def _call(method: str, path: str, body: bytes | None = None, params=None) -> httpx.Response:
    s = get_settings()
    try:
        async with httpx.AsyncClient(base_url=s.quant_url, timeout=s.quant_timeout_s) as client:
            return await client.request(method, f"/quant/{path}", content=body, params=params,
                                        headers={"content-type": "application/json"} if body else None)
    except httpx.HTTPError as exc:
        raise HTTPException(503, f"Quant engine unreachable at {s.quant_url}: {exc.__class__.__name__}") from exc


@router.post("/plan/jobs", status_code=202, summary="Run /quant/plan in the background",
             dependencies=[Depends(require_caller)])
async def start_plan(request: Request):
    if sum(v["status"] == "running" for v in _jobs.values()) >= MAX_RUNNING:
        raise HTTPException(429, "Too many plan jobs running; try again in a few seconds")
    body = await request.body()
    job_id = f"plan-{next(_job_ids)}"
    _jobs[job_id] = {"id": job_id, "status": "running", "result": None, "error": None}
    broker.publish("quant.plan.started", {"job_id": job_id, "message": "Optimizing financing mix…"})

    async def run():
        try:
            r = await _call("POST", "plan", body)
            if r.status_code >= 400:
                raise HTTPException(r.status_code, r.text)
            _jobs[job_id].update(status="done", result=r.json())
            broker.publish("quant.plan.completed", {"job_id": job_id})
        except HTTPException as exc:
            _jobs[job_id].update(status="failed", error=str(exc.detail))
            broker.publish("quant.plan.failed", {"job_id": job_id, "error": str(exc.detail)})

    _forget_old_jobs()
    task = asyncio.create_task(run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return _jobs[job_id]


@router.get("/plan/jobs/{job_id}", dependencies=[Depends(require_caller)])
async def get_plan(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Unknown job")
    return _jobs[job_id]


async def _forward(path: str, request: Request) -> Response:
    body = await request.body() if request.method == "POST" else None
    r = await _call(request.method, path, body, params=dict(request.query_params))
    return Response(content=r.content, status_code=r.status_code,
                    media_type=r.headers.get("content-type", "application/json"))


# Request and response bodies: see quant/api/openapi.json.
@router.get("/{path:path}", summary="Pass-through GET (health, scenarios, demo/{artifact}, schema/scenario)")
async def proxy_get(path: str, request: Request):
    return await _forward(path, request)


@router.post("/{path:path}", summary="Pass-through POST (forecast, quote, plan, passport)",
             dependencies=[Depends(require_caller)])
async def proxy_post(path: str, request: Request):
    return await _forward(path, request)
