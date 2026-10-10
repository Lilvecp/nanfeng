"""Where Merkle roots get anchored. "local" keeps the root in our DB only, so the demo works with
no chain. r3-05 adds "fisco" (FISCO BCOS in Docker) and the "evm" testnet fallback here; each must
return the same receipt shape."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .config import get_settings
from .events import broker
from .models import Anchor, AuditEntry


def anchor(merkle_root: str, from_seq: int, to_seq: int) -> dict:
    backend = get_settings().anchor_backend
    if backend == "local":
        return {"backend": "local", "tx_hash": None, "explorer_url": None}
    raise NotImplementedError(f"Anchor backend '{backend}' is not wired yet (r3-05)")


def anchor_pending(db: Session) -> Anchor | None:
    """Anchors the Merkle root of every entry since the last anchor. None when nothing is new."""
    last = db.scalars(select(Anchor).order_by(Anchor.id.desc()).limit(1)).first()
    from_seq = (last.to_seq + 1) if last else 1
    rows = db.scalars(select(AuditEntry).where(AuditEntry.seq >= from_seq).order_by(AuditEntry.seq)).all()
    if not rows:
        return None
    root = audit.merkle_root([r.hash for r in rows])
    receipt = anchor(root, from_seq, rows[-1].seq)
    a = Anchor(from_seq=from_seq, to_seq=rows[-1].seq, merkle_root=root, **receipt)
    db.add(a)
    db.flush()
    audit.append(db, "system", "audit.anchored", {
        "anchor_id": a.id, "from_seq": a.from_seq, "to_seq": a.to_seq, "merkle_root": root, **receipt,
    })
    broker.publish("audit.anchored", {"anchor_id": a.id, "from_seq": a.from_seq, "to_seq": a.to_seq,
                                      "merkle_root": root, **receipt})
    return a
