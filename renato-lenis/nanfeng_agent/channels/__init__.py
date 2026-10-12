"""Channel layer: build the hub from settings. Live adapters only where a key exists."""

from __future__ import annotations

from ..config import Settings
from .base import ChannelAdapter, ChannelHub, Delivery, OutboundMessage, SimulatedAdapter, UnknownChannel
from .voice import ElevenLabs, VoiceAdapter
from .wecom import WeComMock
from .zavu import ZavuAdapter

__all__ = ["ChannelAdapter", "ChannelHub", "Delivery", "OutboundMessage", "UnknownChannel", "build_hub"]


def build_hub(settings: Settings) -> ChannelHub:
    hub = ChannelHub()
    for ch in ("whatsapp", "sms", "email"):
        hub.register(ZavuAdapter(ch, settings.zavu_api_key, settings.zavu_url) if settings.zavu_api_key
                     else SimulatedAdapter(ch))
    carrier = (ZavuAdapter("voice", settings.zavu_api_key, settings.zavu_url) if settings.zavu_api_key
               else SimulatedAdapter("voice"))
    tts = ElevenLabs(settings.elevenlabs_api_key, settings.elevenlabs_voice_id) if settings.elevenlabs_api_key else None
    hub.register(VoiceAdapter(carrier, tts))
    hub.register(WeComMock())
    return hub
