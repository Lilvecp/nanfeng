"""Decoupled channel layer (r2-12): every channel sits behind `ChannelAdapter`.

The agent only says "send this template to contact X"; the hub picks the adapter. Adding a channel
(WeCom, Telegram, a call center) means writing one adapter and registering it, never touching the
agent. Every message is also kept in the outbox, so the cockpit and the tests can see exactly what
went out and whether it was live or simulated.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field, replace
from typing import Any, Protocol

from ..contacts import Contact


@dataclass
class OutboundMessage:
    to: str
    text: str
    language: str = "en"
    contact_id: str = ""
    kind: str = "notice"  # alert | approval | collection | briefing | blocked | ...
    audio: bytes | None = None


@dataclass
class Delivery:
    channel: str
    to: str
    status: str  # sent | simulated | failed
    message_id: str = ""
    mock: bool = False
    error: str = ""
    message: OutboundMessage | None = field(default=None, repr=False)

    def public(self) -> dict[str, Any]:
        """Safe for the event stream: the address is masked, the text is ours (a template)."""
        return {"channel": self.channel, "to": mask_address(self.to), "status": self.status,
                "message_id": self.message_id, "mock": self.mock, "kind": self.message.kind if self.message else "",
                "language": self.message.language if self.message else ""}


class ChannelAdapter(Protocol):
    name: str

    def send(self, msg: OutboundMessage) -> Delivery: ...


def mask_address(addr: str) -> str:
    if "@" in addr:
        user, dom = addr.split("@", 1)
        return f"{user[:1]}•••@{dom}"
    return addr[:4] + "•••" + addr[-2:] if len(addr) > 6 else "•••"


class SimulatedAdapter:
    """Offline stand-in: records the message, sends nothing."""

    _ids = itertools.count(1)

    def __init__(self, name: str):
        self.name = name

    def send(self, msg: OutboundMessage) -> Delivery:
        return Delivery(self.name, msg.to, "simulated", f"sim-{self.name}-{next(self._ids)}", message=msg)


class UnknownChannel(Exception):
    pass


class ChannelHub:
    def __init__(self) -> None:
        self.adapters: dict[str, ChannelAdapter] = {}
        self.outbox: list[Delivery] = []

    def register(self, adapter: ChannelAdapter) -> "ChannelHub":
        self.adapters[adapter.name] = adapter
        return self

    def send(self, channel: str, msg: OutboundMessage) -> Delivery:
        adapter = self.adapters.get(channel)
        if adapter is None:
            raise UnknownChannel(channel)
        try:
            d = adapter.send(msg)
        except Exception as exc:  # a channel failing must never crash the run
            d = Delivery(channel, msg.to, "failed", error=exc.__class__.__name__)
        d.message = d.message or msg
        self.outbox.append(d)
        return d

    def send_to(self, contact: Contact, msg: OutboundMessage, channels: tuple[str, ...] | None = None,
                avoid: str = "") -> Delivery:
        """First preferred channel the contact has and we support; `avoid` skips the channel an attack
        came in on (out-of-band alerts). Falls through to the next channel if one fails."""
        last: Delivery | None = None
        for ch in channels or contact.preferred + tuple(contact.channels):
            if ch == avoid or ch not in contact.channels or ch not in self.adapters:
                continue
            last = self.send(ch, replace(msg, to=contact.channels[ch], contact_id=contact.id))
            if last.status != "failed":
                return last
        if last is None:
            raise UnknownChannel(f"no usable channel for {contact.id}")
        return last
