"""Inbound messages (Zavu webhook → Document).

Transport metadata (channel, sender) is taken from the webhook envelope, never from the message body.
Media (a PDF or a photo of an invoice) goes through OCR; plain text is the document itself.
"""

from __future__ import annotations

import base64
from typing import Any

from .ingest import Document
from .ocr import read_file

_CHANNELS = {"whatsapp", "sms", "email"}


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
