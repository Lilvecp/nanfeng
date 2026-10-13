"""Inbound messages (Zavu webhook → Document).

Transport metadata (channel, sender) is taken from the webhook envelope, never from the message body.
Media (a PDF or a photo of an invoice) goes through OCR; plain text is the document itself.

Zavu posts an envelope `{id, type, data: {from, channel, text, ...}}` and signs it with
`X-Zavu-Signature: t=<unix s>,v2=<hex>`, where v2 = HMAC-SHA256(secret, "{t}.{raw body}") and the secret is
the one Zavu issues for the sender's webhook (docs.zavu.dev/guides/receiving-messages/security).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from typing import Any

from .ingest import Document
from .ocr import read_file

_CHANNELS = {"whatsapp", "sms", "email"}
SIGNATURE_TOLERANCE_S = 300


def verify_signature(secret: str, header: str, body: bytes, now: float | None = None) -> bool:
    """v2 only: it binds a timestamp, so a captured request cannot be replayed after five minutes."""
    parts = {k.strip(): v.strip() for k, v in (p.split("=", 1) for p in header.split(",") if "=" in p)}
    try:
        t = int(parts["t"])
    except (KeyError, ValueError):
        return False
    if abs((time.time() if now is None else now) - t) > SIGNATURE_TOLERANCE_S or "v2" not in parts:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts["v2"].strip())


def unwrap(payload: dict[str, Any]) -> tuple[str | None, str, dict[str, Any]]:
    """(event id, event type, message). A bare message (relays, tests) counts as an inbound message."""
    if isinstance(payload.get("data"), dict) and "type" in payload:
        return str(payload.get("id") or "") or None, str(payload["type"]), payload["data"]
    return None, "message.inbound", payload


def from_zavu(payload: dict[str, Any], mistral_api_key: str = "") -> Document:
    channel = str(payload.get("channel", "whatsapp")).lower()
    source = channel if channel in _CHANNELS else "upload"
    sender = str(payload.get("from", ""))
    domain = sender.rsplit("@", 1)[-1] if "@" in sender else ""
    phone = sender if not domain else ""
    media = payload.get("media") or []
    if media:
        m = media[0]
        ocr, layer = read_file(base64.b64decode(m["data_base64"]), m.get("mime", "application/pdf"), mistral_api_key)
    else:
        ocr, layer = str(payload.get("text", "")), None
    return Document(ocr, source=source, text_layer=layer, sender_domain=domain, sender_phone=phone)
