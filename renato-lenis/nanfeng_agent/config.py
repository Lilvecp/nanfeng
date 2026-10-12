"""All configuration comes from the environment (.env locally, the secret manager in deploy).

Keys are never logged and never reach a prompt. An empty key means that provider runs offline.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def load_dotenv(*paths: Path) -> None:
    """Minimal .env loader: KEY=value lines, comments ignored, real environment wins."""
    for path in paths:
        if not path.is_file():
            continue
        for line in path.read_text().splitlines():
            line = line.split(" #", 1)[0].strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    backend_url: str = "http://localhost:8000"
    agent_token: str = ""
    openrouter_api_key: str = ""
    mistral_api_key: str = ""
    zavu_api_key: str = ""
    elevenlabs_api_key: str = ""
    zavu_url: str = "https://api.zavu.dev/v1/messages"
    owner_phone: str = ""
    owner_language: str = "es"
    cockpit_url: str = "http://localhost:3000"
    scenario: str = "cherry_crisis"
    # Model routing (OpenRouter slugs). Cheap to classify and extract, strong to plan, then fallbacks.
    models: dict[str, list[str]] = field(default_factory=lambda: {
        "classify": ["mistralai/mistral-small-3.2-24b-instruct", "google/gemini-2.5-flash"],
        "extract": ["mistralai/mistral-small-3.2-24b-instruct", "google/gemini-2.5-flash"],
        "plan": ["anthropic/claude-sonnet-4.5", "openai/gpt-4.1", "google/gemini-2.5-pro"],
    })
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8IkWam"
    # Hard caps per run (OWASP LLM10).
    max_steps: int = 12
    max_cost_usd: float = 0.50
    plan_timeout_s: float = 90.0
    # The planner asks for financing when the forecast crosses either line.
    risk_prob_threshold: float = 0.20
    outbox_dir: str = "out"

    @classmethod
    def from_env(cls) -> "Settings":
        here = Path.cwd()
        load_dotenv(here / ".env", here.parent / ".env")

        def models(role: str, default: list[str]) -> list[str]:
            raw = _env(f"NANFENG_MODEL_{role.upper()}")
            return [m.strip() for m in raw.split(",") if m.strip()] or default

        base = cls()
        return cls(
            backend_url=_env("NANFENG_BACKEND_URL", base.backend_url),
            agent_token=_env("NANFENG_AGENT_TOKEN"),
            openrouter_api_key=_env("OPENROUTER_API_KEY"),
            mistral_api_key=_env("MISTRAL_API_KEY"),
            zavu_api_key=_env("ZAVU_API_KEY") or _env("NANFENG_ZAVU_API_KEY"),
            elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
            zavu_url=_env("NANFENG_ZAVU_URL", base.zavu_url),
            owner_phone=_env("NANFENG_OWNER_PHONE"),
            owner_language=_env("NANFENG_OWNER_LANGUAGE", base.owner_language),
            cockpit_url=_env("NANFENG_COCKPIT_URL", base.cockpit_url),
            scenario=_env("NANFENG_SCENARIO", base.scenario),
            models={role: models(role, ms) for role, ms in base.models.items()},
            elevenlabs_voice_id=_env("ELEVENLABS_VOICE_ID", base.elevenlabs_voice_id),
            outbox_dir=_env("NANFENG_AGENT_OUTBOX", base.outbox_dir),
        )

    def mode(self) -> dict[str, str]:
        """Which providers are live; safe to print (no key values)."""
        return {
            "openrouter": "live" if self.openrouter_api_key else "offline",
            "mistral_ocr": "live" if self.mistral_api_key else "offline",
            "zavu": "live" if self.zavu_api_key else "offline",
            "elevenlabs": "live" if self.elevenlabs_api_key else "offline",
        }
