"""In-process event broker behind the SSE stream that Mission Control listens to.

Single backend instance for the demo, so memory is enough. publish() is safe to call from the
sync route threadpool as well as from the event loop.
"""

import asyncio
import itertools
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Any


class Broker:
    def __init__(self, history: int = 500):
        self._ids = itertools.count(1)
        self._history: deque[dict] = deque(maxlen=history)
        self._subs: set[asyncio.Queue] = set()
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def publish(self, type_: str, data: dict[str, Any], source: str = "backend") -> dict:
        with self._lock:
            event = {
                "id": next(self._ids),
                "type": type_,
                "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                "source": source,
                "data": data,
            }
            self._history.append(event)
            subs = list(self._subs)
        if self._loop and not self._loop.is_closed():
            for q in subs:
                self._loop.call_soon_threadsafe(q.put_nowait, event)
        return event

    def recent(self, after_id: int = 0, limit: int = 100) -> list[dict]:
        with self._lock:
            return [e for e in self._history if e["id"] > after_id][-limit:]

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        with self._lock:
            self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            self._subs.discard(q)


broker = Broker()
