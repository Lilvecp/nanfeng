"""PII minimization before any LLM call (r4-07, Andy).

`mask()` swaps personal data for stable placeholders (⟦RUT_1⟧, ⟦PHONE_1⟧...) and returns the mapping,
which stays in our backend: the LLM provider never receives it. `unmask()` puts the values back into
the LLM's answer when a human needs to read it. Amounts and dates are not masked: the agent needs them
and they do not identify a person on their own.
"""

import re

# Order matters: longer, more specific patterns first so they are not eaten by generic ones.
PATTERNS: list[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")),
    ("IBAN", re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b")),
    ("CN_ID", re.compile(r"\b\d{17}[\dXx]\b")),  # PRC resident identity card
    ("RUT", re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b")),  # Chilean tax / national id
    ("PHONE", re.compile(r"(?<![\w.])\+?(?:56|86)?[ ]?(?:9[ ]?\d{4}[ ]?\d{4}|1[3-9]\d{9}|2[ ]?\d{4}[ ]?\d{4})\b")),
    # bank accounts: 8+ digits, optionally grouped; never an ISO date
    ("ACCOUNT", re.compile(r"\b(?:[A-Z]{2}-[A-Z]+-)?(?!\d{4}-\d{2}-\d{2}\b)\d(?:[ -]?\d){7,22}\b")),
]


def mask(text: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}
    seen: dict[tuple[str, str], str] = {}
    counters: dict[str, int] = {}

    for kind, rx in PATTERNS:
        def repl(m: re.Match, kind: str = kind) -> str:
            value = m.group(0)
            key = (kind, value)
            if key not in seen:
                counters[kind] = counters.get(kind, 0) + 1
                token = f"⟦{kind}_{counters[kind]}⟧"
                seen[key], mapping[token] = token, value
            return seen[key]

        text = rx.sub(repl, text)
    return text, mapping


def unmask(text: str, mapping: dict[str, str]) -> str:
    for token, value in mapping.items():
        text = text.replace(token, value)
    return text
