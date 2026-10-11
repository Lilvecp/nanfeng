"""Agent event stream (SSE) for Agent Mission Control.

The agent publishes each step with POST /agent/events; the front listens on GET /agent/events.
Reconnecting browsers send Last-Event-ID and get what they missed from the in-memory history.
"""

import asyncio
import json

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse

from ..events import broker
from ..schemas import EventIn
from ..security import require_agent

router = APIRouter(prefix="/agent", tags=["agent"])

KEEPALIVE_S = 15


def _sse(event: dict) -> str:
    # No "event:" line on purpose: EventSource.onmessage then receives every type; it is in data.type.
    return f"id: {event['id']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/events", summary="SSE stream of agent, approval, bank and audit events",
            response_class=StreamingResponse)
async def stream(request: Request, last_event_id: int = Header(default=0)):
    q = broker.subscribe()

    async def gen():
        try:
            for e in broker.recent(after_id=last_event_id):
                yield _sse(e)
            while not await request.is_disconnected():
                try:
                    yield _sse(await asyncio.wait_for(q.get(), timeout=KEEPALIVE_S))
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            broker.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/events/recent", summary="Same events as the stream, as plain JSON (polling fallback)")
def recent(after_id: int = 0, limit: int = 100):
    return broker.recent(after_id, min(limit, 500))


@router.post("/events", status_code=201, summary="Publish an agent step (Renato's orchestrator)")
def publish(body: EventIn, _: str = Depends(require_agent)):
    return broker.publish(body.type, body.data, source=body.source)
