"""Zavu (r2-07): WhatsApp, SMS, email and voice through one API.

Same call the backend's OTP uses (backend/app/otp.py): POST {to, text, channel} with a bearer key.
"""

from __future__ import annotations

import base64

import httpx

from .base import Delivery, OutboundMessage

ZAVU_CHANNELS = ("whatsapp", "sms", "email", "voice")


class ZavuAdapter:
    def __init__(self, channel: str, api_key: str, url: str = "https://api.zavu.dev/v1/messages",
                 client: httpx.Client | None = None):
        if channel not in ZAVU_CHANNELS:
            raise ValueError(f"Zavu does not carry {channel!r}")
        self.name, self.api_key, self.url = channel, api_key, url
        self.client = client or httpx.Client(timeout=15)

    def send(self, msg: OutboundMessage) -> Delivery:
        body: dict = {"to": msg.to, "text": msg.text, "channel": self.name}
        if self.name == "email":
            body["subject"] = "NanFeng"
        if self.name == "voice" and msg.audio:
            body["audio_base64"] = base64.b64encode(msg.audio).decode()  # ElevenLabs audio; Zavu TTS otherwise
        r = self.client.post(self.url, json=body, headers={"Authorization": f"Bearer {self.api_key}"})
        r.raise_for_status()
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        mid = str(data.get("id") or data.get("message", {}).get("id") or "")
        return Delivery(self.name, msg.to, "sent", mid, message=msg)
