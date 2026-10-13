"""The agent runs against the real API gateway (Camilo's backend, in process): real guard, payee
check, policy engine, approvals, OTP and audit chain. Only the quant engine is replayed from Vicente's
committed Cherry Crisis results, so the tests stay fast (the MILP takes ~20 s) and need no numpy/ortools.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

_db = os.path.join(tempfile.mkdtemp(), "agent-test.db")
os.environ.update({
    "NANFENG_DATABASE_URL": f"sqlite:///{_db}",
    "NANFENG_AGENT_TOKEN": "agent-test-token",
    "NANFENG_ANCHOR_BACKEND": "local",
    "NANFENG_QUANT_URL": "http://127.0.0.1:9",
    "NANFENG_OWNER_PASSWORD": "test-owner-password",
    "NANFENG_DEMO": "true",
    "NANFENG_OTP_MODE": "sandbox",
    "ZAVU_API_KEY": "",
    "NANFENG_ZAVU_API_KEY": "",
    "NANFENG_OWNER_PHONE": "",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import auth, seed  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402

from nanfeng_agent.backend import Backend  # noqa: E402
from nanfeng_agent.channels import ChannelHub  # noqa: E402
from nanfeng_agent.channels.base import SimulatedAdapter  # noqa: E402
from nanfeng_agent.channels.voice import VoiceAdapter  # noqa: E402
from nanfeng_agent.channels.wecom import WeComMock  # noqa: E402
from nanfeng_agent.config import Settings  # noqa: E402
from nanfeng_agent.orchestrator import Agent  # noqa: E402
from nanfeng_agent.router import ModelRouter  # noqa: E402

RESULTS = ROOT / "vicente-rodriguez" / "results"
AGENT_TOKEN = os.environ["NANFENG_AGENT_TOKEN"]
OWNER_PASSWORD = os.environ["NANFENG_OWNER_PASSWORD"]
SANDBOX_OTP = "482913"


def _result(name: str) -> dict:
    return json.loads((RESULTS / f"cherry_crisis_{name}.json").read_text(encoding="utf-8"))


class ReplayQuantBackend(Backend):
    """Real backend for everything except /quant, which answers with Vicente's committed results."""

    def __init__(self, *a, forecast: dict | None = None, **kw):
        super().__init__(*a, **kw)
        self.forecast = forecast or _result("forecast")
        self.quant_calls: list[tuple[str, dict]] = []

    def _send(self, method, path, json=None, params=None):
        if path.startswith("/quant/"):
            self.quant_calls.append((path, json or {}))
            if path == "/quant/forecast":
                return self.forecast
            if path == "/quant/quote":
                return _result("quotes")
            if path == "/quant/analysis":
                return _result("analysis")
            if path == "/quant/plan/jobs":
                return {"id": "plan-1", "status": "done", "result": _result("plan"), "error": None}
            raise AssertionError(f"unexpected quant call {path}")
        return super()._send(method, path, json, params)


@pytest.fixture()
def client():
    with TestClient(app) as c:
        with SessionLocal() as db:
            seed.reset(db)
        auth._failures.clear()
        yield c


@pytest.fixture()
def owner(client):
    """The owner's cockpit session: the only one that can approve (the agent never can)."""
    token = client.post("/auth/login", json={"password": OWNER_PASSWORD}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def hub():
    h = ChannelHub()
    for ch in ("whatsapp", "sms", "email"):
        h.register(SimulatedAdapter(ch))
    h.register(VoiceAdapter(SimulatedAdapter("voice")))
    h.register(WeComMock())
    return h


@pytest.fixture()
def settings():
    return Settings(backend_url="http://testserver", agent_token=AGENT_TOKEN, plan_timeout_s=5)


@pytest.fixture()
def backend(client):
    return ReplayQuantBackend(token=AGENT_TOKEN, client=client)


@pytest.fixture()
def agent(settings, backend, hub):
    return Agent(settings, backend=backend, router=ModelRouter(""), hub=hub)
