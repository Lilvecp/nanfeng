"""Client for Camilo's API gateway (backend/README.md · "For the rest of the team").

The agent token can publish events, create approvals and call the security endpoints. It can never
approve: the OTP goes to the owner's phone and never passes through the agent.
"""

from __future__ import annotations

import time
from typing import Any

import httpx


class BackendError(Exception):
    def __init__(self, status: int, detail: Any):
        super().__init__(f"HTTP {status}: {detail}")
        self.status, self.detail = status, detail


class Backend:
    def __init__(self, url: str = "http://localhost:8000", token: str = "", client: httpx.Client | None = None,
                 timeout: float = 30.0):
        self.client = client or httpx.Client(base_url=url, timeout=timeout)
        self.token = token

    def _headers(self) -> dict[str, str]:
        # Always send the header: a shared client must never fall back to someone else's credentials.
        return {"Authorization": f"Bearer {self.token}" if self.token else ""}

    def _send(self, method: str, path: str, json: Any = None, params: dict | None = None) -> Any:
        try:
            r = self.client.request(method, path, json=json, params=params, headers=self._headers())
        except httpx.HTTPError as exc:
            raise BackendError(503, f"backend unreachable: {exc.__class__.__name__}") from exc
        if r.status_code >= 400:
            try:
                detail = r.json().get("detail", r.text)
            except ValueError:
                detail = r.text
            raise BackendError(r.status_code, detail)
        return r.json() if r.content else None

    def get(self, path: str, **params: Any) -> Any:
        return self._send("GET", path, params=params or None)

    def post(self, path: str, body: Any = None) -> Any:
        return self._send("POST", path, json=body if body is not None else {})

    # --- conveniences -------------------------------------------------------------------------

    def kill_switch_on(self) -> bool:
        return bool(self.get("/policy/kill-switch").get("on"))

    def publish(self, type_: str, data: dict[str, Any]) -> None:
        """Mission Control trace. Never fatal: a missing event must not stop a payment flow halfway."""
        try:
            self.post("/agent/events", {"type": type_, "data": data, "source": "agent"})
        except BackendError:
            pass

    def plan(self, body: dict[str, Any], timeout_s: float = 90.0, poll_s: float = 0.5) -> dict[str, Any]:
        """/quant/plan through the backend's job endpoint (the MILP takes 5-30 s the first time)."""
        job = self.post("/quant/plan/jobs", body)
        deadline = time.monotonic() + timeout_s
        while job.get("status") == "running":
            if time.monotonic() > deadline:
                raise BackendError(504, f"plan job {job.get('id')} still running after {timeout_s:.0f}s")
            time.sleep(poll_s)
            job = self.get(f"/quant/plan/jobs/{job['id']}")
        if job.get("status") != "done":
            raise BackendError(502, job.get("error") or "plan job failed")
        return job["result"]
