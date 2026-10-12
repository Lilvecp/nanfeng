"""Simulated sanctions screening (r4-07, Andy).

The list below is synthetic and declared as such: it stands in for OFAC SDN / UN consolidated lists,
which a production deployment would load from the official sources. The matching (normalized, fuzzy)
is the part that would carry over.
"""

import re
import unicodedata
from difflib import SequenceMatcher

# Fictional entities only. Never put a real person or company here.
WATCHLIST = [
    "Red Lotus Maritime Trading (fictional sanctions test entry)",
    "Northwind Dual-Use Components (fictional sanctions test entry)",
    "Kestrel Shell Holdings (fictional sanctions test entry)",
]

_NOISE = re.compile(r"\(.*?\)|\b(spa|s\.?a\.?|ltda\.?|llc|ltd\.?|co\.?|inc\.?|limited|holdings?)\b")


def _norm(name: str) -> str:
    n = unicodedata.normalize("NFKD", name.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", _NOISE.sub(" ", n)).split())


def screen(name: str, threshold: float = 0.85) -> str | None:
    """Returns the watchlist entry `name` matches, or None."""
    target = _norm(name)
    if not target:
        return None
    for entry in WATCHLIST:
        if SequenceMatcher(None, target, _norm(entry)).ratio() >= threshold:
            return entry
    return None
