"""CLI.

    python -m nanfeng_agent status                  # which providers are live (never prints keys)
    python -m nanfeng_agent cherry                  # Cherry Crisis end to end against the backend
    python -m nanfeng_agent ingest invoice.pdf --source email --sender billing@example.com
    python -m nanfeng_agent resume APR-0001         # after the owner approves in the cockpit
    python -m nanfeng_agent briefing --lang zh
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from pathlib import Path

from . import fixtures
from .config import Settings
from .ingest import Document
from .ocr import read_file
from .orchestrator import Agent


def _print(obj) -> None:
    print(json.dumps(obj, indent=1, ensure_ascii=False, default=str))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="nanfeng_agent")
    p.add_argument("--backend", help="API gateway URL (default NANFENG_BACKEND_URL or http://localhost:8000)")
    p.add_argument("--lang", choices=["es", "en", "zh"], help="owner language")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    sub.add_parser("cherry")
    ing = sub.add_parser("ingest")
    ing.add_argument("file")
    ing.add_argument("--source", default="upload", choices=["whatsapp", "email", "sms", "upload"])
    ing.add_argument("--sender", default="", help="sender email or phone from the transport, not the document")
    res = sub.add_parser("resume")
    res.add_argument("approval_id")
    sub.add_parser("briefing")
    a = p.parse_args(argv)

    settings = Settings.from_env()
    if a.backend:
        settings = Settings(**{**settings.__dict__, "backend_url": a.backend})
    agent = Agent(settings)

    if a.cmd == "status":
        _print({"backend": settings.backend_url, "providers": settings.mode(), "planner": agent.planner.name})
    elif a.cmd == "cherry":
        for doc in (fixtures.shanghai_notice(), fixtures.bec_invoice()):
            run = agent.handle_document(doc, a.lang)
            _print({**run.summary(), "trace": [f"{s['tool']}: {s['detail']}" for s in run.steps]})
        print("\nApprove the plan in the cockpit with the OTP, then: python -m nanfeng_agent resume <APR-id>",
              file=sys.stderr)
    elif a.cmd == "ingest":
        path = Path(a.file)
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        ocr, layer = read_file(path.read_bytes(), mime, settings.mistral_api_key)
        sender = a.sender
        doc = Document(ocr, source=a.source, text_layer=layer, sender_domain=sender if "@" in sender else "",
                       sender_phone=sender if "@" not in sender else "")
        _print(agent.handle_document(doc, a.lang).summary())
    elif a.cmd == "resume":
        appr = agent.backend.get(f"/approvals/{a.approval_id}")
        run = agent._new_run("resume", a.lang)
        run.approvals.append({**appr, "status": "pending"})
        run.status = "awaiting_approval"
        _print(agent.resume(run.id).summary())
    elif a.cmd == "briefing":
        out = agent.briefing(a.lang)
        _print({"text": out["text"], "delivery": out.get("delivery"), "status": out["run"]["status"]})
    return 0


if __name__ == "__main__":
    sys.exit(main())
