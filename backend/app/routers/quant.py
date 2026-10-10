"""Gateway to Vicente's quant engine (vicente-rodriguez/docs/api.md). Paths stay the same, so the
contract he published is the contract the front and the agent see, just on our origin.

/quant/plan takes 5-30 s: /quant/plan/jobs runs it in the background and reports progress on the
SSE stream, as his integration notes ask.
"""

import asyncio
import itertools
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from ..config import get_settings
from ..events import broker

router = APIRouter(prefix="/quant", tags=["quant"])

_jobs: dict[str, dict[str, Any]] = {}
_job_ids = itertools.count(1)
_tasks: set[asyncio.Task] = set()


async def _call(method: str, path: str, body: bytes | None = None, params=None) -> httpx.Response:
    s = get_settings()
    try:
        async with httpx.AsyncClient(base_url=s.quant_url, timeout=s.quant_timeout_s) as client:
            return await client.request(method, f"/quant/{path}", content=body, params=params,
                                        headers={"content-type": "application/json"} if body else None)
    except httpx.HTTPError as exc:
        raise HTTPException(503, f"Quant engine unreachable at {s.quant_url}: {exc.__class__.__name__}") from exc


@router.post("/plan/jobs", status_code=202, summary="Run /quant/plan in the background")
async def start_plan(request: Request):
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

    task = asyncio.create_task(run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return _jobs[job_id]


@router.get("/plan/jobs/{job_id}")
async def get_plan(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Unknown job")
    return _jobs[job_id]


async def _forward(path: str, request: Request) -> Response:
    body = await request.body() if request.method == "POST" else None
    r = await _call(request.method, path, body, params=dict(request.query_params))
    return Response(content=r.content, status_code=r.status_code,
                    media_type=r.headers.get("content-type", "application/json"))


# Request and response bodies: see vicente-rodriguez/api/openapi.json.
@router.get("/{path:path}", summary="Pass-through GET (health, scenarios, demo/{artifact}, schema/scenario)")
async def proxy_get(path: str, request: Request):
    return await _forward(path, request)


@router.post("/{path:path}", summary="Pass-through POST (forecast, quote, plan, passport)")
async def proxy_post(path: str, request: Request):
    return await _forward(path, request)
