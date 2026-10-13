"""Agent service (r2-09): what makes the agent part of the product instead of a CLI.

    POST /inbound/zavu     Zavu webhook (signed): a WhatsApp, SMS or email reaches the owner → the agent runs
    POST /documents        the cockpit uploads a PDF or photo (owner session)
    POST /ask              "Ask it why" in Mission Control (owner)
    POST /briefing         daily cash briefing (owner)
    GET  /runs, /runs/{id} what the agent did (owner)
    GET  /health           providers live/offline, never the keys

A background listener follows the backend's SSE stream and resumes a paused run the moment the owner
approves or rejects in the cockpit. The agent never approves: it only reads the decision.

    uvicorn nanfeng_agent.service:app --port 8200
"""

from __future__ import annotations

import base64
import binascii
import hmac
import json
import logging
import os
import threading
import time
from collections import OrderedDict
from typing import Any, Literal

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import __version__, explain
from .backend import BackendError
from .config import Settings
from .inbound import from_zavu, unwrap, verify_signature
from .ingest import Document
from .ocr import OcrError, read_file
from .orchestrator import Agent

log = logging.getLogger("nanfeng_agent")

MAX_UPLOAD_BYTES = 4 * 1024 * 1024
SEEN_EVENTS = 1000  # Zavu retries a delivery up to 5 times: remember recent event ids
RESUME_EVENTS = {"approval.approved", "approval.rejected", "approval.locked", "approval.failed"}


class AgentService:
    """One agent, one lock: runs are short and the demo is single-tenant."""

    def __init__(self, agent: Agent):
        self.agent = agent
        self.lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_event_id = 0
        self.seen_events: OrderedDict[str, None] = OrderedDict()

    def first_delivery(self, event_id: str | None) -> bool:
        if event_id is None:
            return True
        with self.lock:
            if event_id in self.seen_events:
                return False
            self.seen_events[event_id] = None
            while len(self.seen_events) > SEEN_EVENTS:
                self.seen_events.popitem(last=False)
            return True

    def run_inbound(self, message: dict[str, Any]) -> dict[str, Any]:
        try:
            doc = from_zavu(message, self.agent.settings.mistral_api_key)
        except (OcrError, KeyError, ValueError, binascii.Error) as exc:
            raise HTTPException(422, f"cannot read the message: {exc.__class__.__name__}") from exc
        if not doc.ocr_text.strip():
            return {"status": "ignored", "reason": "empty message"}
        with self.lock:
            return self.agent.handle_document(doc).summary()

    def forget(self, event_id: str | None) -> None:
        """A delivery that failed before running can be retried."""
        if event_id is not None:
            with self.lock:
                self.seen_events.pop(event_id, None)

    def run_inbound_quietly(self, message: dict[str, Any]) -> None:
        # Runs after the 202: nobody is waiting for the answer, so every failure ends up in the log.
        try:
            self.run_inbound(message)
        except HTTPException as exc:
            log.warning("inbound message skipped: %s", exc.detail)
        except Exception:
            log.exception("inbound message failed")

    def handle_event(self, event: dict[str, Any]) -> None:
        """One SSE event from the backend. Resumes the run that proposed the approval, if any."""
        self.last_event_id = max(self.last_event_id, int(event.get("id") or 0))
        if event.get("type") not in RESUME_EVENTS:
            return
        approval_id = (event.get("data") or {}).get("id")
        if approval_id:
            with self.lock:
                self.agent.resume_approval(approval_id)

    def _listen_once(self) -> None:
        url = f"{self.agent.settings.backend_url}/agent/events"
        headers = {"Last-Event-ID": str(self.last_event_id)} if self.last_event_id else {}
        with httpx.stream("GET", url, headers=headers, timeout=httpx.Timeout(10, read=60)) as r:
            for line in r.iter_lines():
                if self._stop.is_set():
                    return
                if line.startswith("data: "):
                    try:
                        self.handle_event(json.loads(line[6:]))
                    except (ValueError, BackendError) as exc:
                        log.warning("event skipped: %s", exc.__class__.__name__)

    def start_listener(self) -> None:
        def loop() -> None:
            backoff = 1.0
            while not self._stop.is_set():
                try:
                    self._listen_once()
                    backoff = 1.0
                except httpx.HTTPError:
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 30)

        self._thread = threading.Thread(target=loop, name="sse-listener", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()


# --- HTTP ------------------------------------------------------------------------------------

class UploadIn(BaseModel):
    filename: str = Field(max_length=200)
    mime: str = Field(pattern=r"^(application/pdf|image/(png|jpeg|webp)|text/plain)$")
    data_base64: str = Field(max_length=6_000_000)
    source: Literal["upload", "whatsapp", "email", "sms"] = "upload"
    language: Literal["es", "en", "zh"] | None = None


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    run_id: str | None = Field(None, pattern=r"^RUN-\d{4,}$")
    language: Literal["es", "en", "zh"] = "es"


class BriefingIn(BaseModel):
    language: Literal["es", "en", "zh"] | None = None
    call: bool = True


def create_app(service: AgentService | None = None, listen: bool | None = None) -> FastAPI:
    svc = service or AgentService(Agent(Settings.from_env()))
    settings = svc.agent.settings
    app = FastAPI(title="NanFeng agent", version=__version__,
                  description="Agent service: inbound documents, runs, 'ask it why', briefing (R2 · Renato)")
    app.state.service = svc
    app.add_middleware(CORSMiddleware, allow_origins=json.loads(os.environ.get(
        "NANFENG_CORS_ORIGINS", '["http://localhost:3000","http://localhost:3100"]')),
        allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

    if listen if listen is not None else os.environ.get("NANFENG_AGENT_LISTEN", "true") == "true":
        app.router.on_startup.append(svc.start_listener)
        app.router.on_shutdown.append(svc.stop)

    def require_owner(authorization: str = Header(default="")) -> str:
        """The cockpit's owner session, checked by the backend (the agent keeps no passwords)."""
        try:
            r = svc.agent.backend.client.get("/auth/me", headers={"Authorization": authorization})
            ok = r.status_code == 200 and r.json().get("owner") is True
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "backend unreachable") from None
        if not ok:
            raise HTTPException(401, {"error": "owner_login_required", "detail": "Sign in as the owner"})
        return "owner"

    def require_reader(authorization: str = Header(default="")) -> str:
        """Run traces hold amounts, document ids and call-back numbers, and /ask can spend LLM budget:
        the owner's session, or the agent token for internal callers."""
        token = settings.agent_token
        if token and hmac.compare_digest(authorization.removeprefix("Bearer ").strip(), token):
            return "agent"
        return require_owner(authorization)

    async def require_webhook(request: Request, authorization: str = Header(default=""),
                              x_zavu_signature: str = Header(default="")) -> str:
        """Zavu signs every delivery with the sender's webhook secret (X-Zavu-Signature, HMAC over the raw body);
        the agent token is also accepted (tests, relays). Fails closed: with neither configured, nobody can feed
        documents to the agent."""
        secret, token = settings.zavu_webhook_secret, settings.agent_token
        if not secret and not token:
            raise HTTPException(503, "webhook not configured: set NANFENG_ZAVU_WEBHOOK_SECRET or NANFENG_AGENT_TOKEN")
        if secret and x_zavu_signature and verify_signature(secret, x_zavu_signature, await request.body()):
            return "zavu"
        if token and hmac.compare_digest(authorization.removeprefix("Bearer ").strip(), token):
            return "agent"
        raise HTTPException(401, "invalid webhook signature")

    @app.get("/health")
    def health():
        return {"status": "ok", "version": __version__, "providers": settings.mode(),
                "planner": svc.agent.planner.name, "listener": bool(svc._thread and svc._thread.is_alive())}

    @app.post("/inbound/zavu")
    def inbound(payload: dict[str, Any], tasks: BackgroundTasks, response: Response,
                caller: str = Depends(require_webhook)):
        event_id, kind, message = unwrap(payload)
        if kind != "message.inbound":
            return {"status": "ignored", "reason": kind}  # delivery receipts, templates, ...
        if not svc.first_delivery(event_id):
            return {"status": "duplicate", "event_id": event_id}
        if caller == "zavu":
            # Zavu wants a 2xx within 30 s and retries otherwise; a run with the LLM and the MILP can take longer.
            tasks.add_task(svc.run_inbound_quietly, message)
            response.status_code = 202
            return {"status": "accepted", "event_id": event_id}
        try:
            return svc.run_inbound(message)
        except Exception:
            svc.forget(event_id)  # the relay gets the error and may retry the same event
            raise

    @app.post("/documents", dependencies=[Depends(require_owner)])
    def upload(body: UploadIn):
        try:
            data = base64.b64decode(body.data_base64, validate=True)
        except binascii.Error as exc:
            raise HTTPException(422, "data_base64 is not valid base64") from exc
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "file over 4 MB")
        try:
            ocr, layer = read_file(data, body.mime, settings.mistral_api_key)
        except OcrError as exc:
            raise HTTPException(422, str(exc)) from exc
        with svc.lock:
            return svc.agent.handle_document(Document(ocr, source=body.source, text_layer=layer), body.language).summary()

    @app.get("/runs", dependencies=[Depends(require_reader)])
    def runs(limit: int = 20):
        return [r.summary() for r in list(svc.agent.runs.values())[-min(limit, 100):]][::-1]

    @app.get("/runs/{run_id}", dependencies=[Depends(require_reader)])
    def run(run_id: str):
        r = svc.agent.runs.get(run_id)
        if r is None:
            raise HTTPException(404, "unknown run")
        return {**r.summary(), "trace": r.steps}

    @app.post("/ask", dependencies=[Depends(require_reader)])
    def ask(body: AskIn):
        runs = svc.agent.runs
        target = runs.get(body.run_id) if body.run_id else next(
            (r for r in reversed(list(runs.values())) if r.kind == "document"), None)
        return explain.answer(body.question, target, body.language)

    @app.post("/briefing", dependencies=[Depends(require_owner)])
    def briefing(body: BriefingIn):
        with svc.lock:
            return svc.agent.briefing(body.language, call=body.call)

    return app


def __getattr__(name: str):
    # `uvicorn nanfeng_agent.service:app` builds the app on first access, not on import (tests import freely).
    if name == "app":
        globals()["app"] = create_app()
        return globals()["app"]
    raise AttributeError(name)
