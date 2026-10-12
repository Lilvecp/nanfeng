"""Simulated WeCom adapter (r2-13). Marked as mock everywhere it shows up.

The Chinese importer gets the collection in Chinese in a chat-style transcript. It exists to show the
Chinese channel already fits the architecture: a real WeCom integration replaces this one class.
"""

from __future__ import annotations

import itertools
from datetime import datetime, timezone

from .base import Delivery, OutboundMessage


class WeComMock:
    name = "wecom"
    _ids = itertools.count(1)

    def __init__(self) -> None:
        self.transcript: list[dict] = []

    def send(self, msg: OutboundMessage) -> Delivery:
        self.transcript.append({"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "to": msg.to,
                                "from": "Huerto Austral Export SpA", "text": msg.text, "mock": True})
        return Delivery(self.name, msg.to, "simulated", f"wecom-mock-{next(self._ids)}", mock=True, message=msg)
