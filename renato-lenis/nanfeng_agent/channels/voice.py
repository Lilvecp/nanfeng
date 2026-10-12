"""ElevenLabs (r2-08): the daily cash briefing and the alert call, in ES / EN / 中文.

Voice only informs. It never approves an L3 action: a cloned voice is cheap (the backend refuses any
VOICE channel on approve, and the agent never asks for a code by voice).
"""

from __future__ import annotations

import httpx

from .base import ChannelAdapter, Delivery, OutboundMessage

ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


class ElevenLabs:
    def __init__(self, api_key: str, voice_id: str, client: httpx.Client | None = None,
                 model_id: str = "eleven_multilingual_v2"):
        self.api_key, self.voice_id, self.model_id = api_key, voice_id, model_id
        self.client = client or httpx.Client(timeout=60)

    def synthesize(self, text: str) -> bytes:
        r = self.client.post(ELEVENLABS_URL.format(voice_id=self.voice_id),
                             json={"text": text, "model_id": self.model_id},
                             headers={"xi-api-key": self.api_key, "accept": "audio/mpeg"})
        r.raise_for_status()
        return r.content


class VoiceAdapter:
    """Synthesizes with ElevenLabs (when configured) and places the call through the carrier adapter."""

    name = "voice"

    def __init__(self, carrier: ChannelAdapter, tts: ElevenLabs | None = None):
        self.carrier, self.tts = carrier, tts

    def send(self, msg: OutboundMessage) -> Delivery:
        if self.tts and msg.audio is None:
            msg.audio = self.tts.synthesize(msg.text)
        d = self.carrier.send(msg)
        d.channel = "voice"
        return d
