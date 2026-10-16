"""Append-only audit log with a hash chain, plus Merkle roots for on-chain anchoring (r3-05).

hash_n = sha256(prev_hash | seq | ts | actor | kind | canonical_json(payload))
Changing, deleting or reordering any entry breaks every hash after it, and /audit/verify says where.
"""

import hashlib
import json
import threading
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AuditEntry

GENESIS = "0" * 64
_lock = threading.Lock()  # one writer at a time so seq and prev_hash never fork


def canonical(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def entry_hash(prev_hash: str, seq: int, ts: str, actor: str, kind: str, payload: dict) -> str:
    material = "|".join([prev_hash, str(seq), ts, actor, kind, canonical(payload)])
    return hashlib.sha256(material.encode()).hexdigest()


def append(db: Session, actor: str, kind: str, payload: dict) -> AuditEntry:
    """Adds an entry and commits the session (including the caller's pending changes)."""
    payload = json.loads(canonical(payload))  # store exactly what was hashed
    with _lock:
        last = db.scalars(select(AuditEntry).order_by(AuditEntry.seq.desc()).limit(1)).first()
        seq = (last.seq + 1) if last else 1
        prev = last.hash if last else GENESIS
        ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        entry = AuditEntry(
            seq=seq, ts=ts, actor=actor, kind=kind, payload=payload, prev_hash=prev,
            hash=entry_hash(prev, seq, ts, actor, kind, payload),
        )
        db.add(entry)
        db.commit()
    return entry


def verify(db: Session) -> dict:
    prev = GENESIS
    count = 0
    for e in db.scalars(select(AuditEntry).order_by(AuditEntry.seq)):
        expected = entry_hash(prev, e.seq, e.ts, e.actor, e.kind, e.payload)
        if e.prev_hash != prev or e.hash != expected:
            return {"valid": False, "entries": count, "broken_at_seq": e.seq,
                    "expected_hash": expected, "stored_hash": e.hash}
        prev = e.hash
        count += 1
    return {"valid": True, "entries": count, "head": prev, "broken_at_seq": None}


def merkle_root(leaves_hex: list[str]) -> str:
    if not leaves_hex:
        return GENESIS
    level = [bytes.fromhex(h) for h in leaves_hex]
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        level = [hashlib.sha256(level[i] + level[i + 1]).digest() for i in range(0, len(level), 2)]
    return level[0].hex()


def merkle_proof(leaves_hex: list[str], index: int) -> list[dict]:
    """Sibling path from leaf to root, so anyone can check one entry against an anchored root."""
    level = [bytes.fromhex(h) for h in leaves_hex]
    proof = []
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        sib = index ^ 1
        proof.append({"position": "left" if sib < index else "right", "hash": level[sib].hex()})
        level = [hashlib.sha256(level[i] + level[i + 1]).digest() for i in range(0, len(level), 2)]
        index //= 2
    return proof


def head_seq(db: Session) -> int:
    return db.scalar(select(func.max(AuditEntry.seq))) or 0
