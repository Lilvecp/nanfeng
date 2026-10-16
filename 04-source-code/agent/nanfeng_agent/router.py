"""Model router (r2-05) over OpenRouter: a cheap model to classify and extract, a strong one to plan,
fallbacks in order, and cost and latency logged for every call (Mission Control shows them).

Without OPENROUTER_API_KEY every call raises `Offline` and the caller uses its deterministic path.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class Offline(Exception):
    """No provider key: use the deterministic path."""


class RouterError(Exception):
    """Every model of the route failed, or the run's spend cap was reached."""


@dataclass
class Completion:
    text: str
    model: str
    cost_usd: float
    latency_s: float
    tool_calls: list[dict[str, Any]]

    def json(self) -> Any:
        text = self.text.strip()
        if text.startswith("```"):
            text = text.strip("`").split("\n", 1)[-1].rsplit("```", 1)[0]
        return json.loads(text)


class ModelRouter:
    def __init__(self, api_key: str = "", routes: dict[str, list[str]] | None = None, budget_usd: float = 0.5,
                 client: httpx.Client | None = None, timeout: float = 60.0):
        self.api_key = api_key
        self.routes = routes or {}
        self.budget_usd = budget_usd
        self.client = client or httpx.Client(timeout=timeout)
        self.calls: list[dict[str, Any]] = []

    @property
    def online(self) -> bool:
        return bool(self.api_key)

    @property
    def spent_usd(self) -> float:
        return round(sum(c["cost_usd"] for c in self.calls), 6)

    def complete(self, role: str, messages: list[dict[str, Any]], *, json_schema: dict | None = None,
                 tools: list[dict] | None = None, max_tokens: int = 800, temperature: float = 0.0) -> Completion:
        if not self.online:
            raise Offline(role)
        if self.spent_usd >= self.budget_usd:
            raise RouterError(f"spend cap reached (USD {self.budget_usd})")
        models = self.routes.get(role) or []
        if not models:
            raise RouterError(f"no models configured for role {role!r}")

        body: dict[str, Any] = {"messages": messages, "max_tokens": max_tokens, "temperature": temperature,
                                "usage": {"include": True}}
        if json_schema:
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": "output", "strict": True, "schema": json_schema}}
        if tools:
            body["tools"] = tools

        errors = []
        for model in models:
            t0 = time.monotonic()
            try:
                r = self.client.post(OPENROUTER_URL, json={**body, "model": model},
                                     headers={"Authorization": f"Bearer {self.api_key}",
                                              "X-Title": "NanFeng agent"})
                r.raise_for_status()
                data = r.json()
                choice = data["choices"][0]["message"]
            except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
                latency = time.monotonic() - t0
                self.calls.append({"role": role, "model": model, "ok": False, "cost_usd": 0.0,
                                   "latency_s": round(latency, 3), "error": exc.__class__.__name__})
                errors.append(f"{model}: {exc.__class__.__name__}")
                continue
            latency = time.monotonic() - t0
            usage = data.get("usage") or {}
            cost = float(usage.get("cost") or 0.0)
            self.calls.append({"role": role, "model": model, "ok": True, "cost_usd": cost,
                               "latency_s": round(latency, 3), "tokens": usage.get("total_tokens")})
            return Completion(text=choice.get("content") or "", model=model, cost_usd=cost,
                              latency_s=round(latency, 3), tool_calls=choice.get("tool_calls") or [])
        raise RouterError("all models failed: " + "; ".join(errors))
