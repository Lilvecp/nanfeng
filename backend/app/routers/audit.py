"""Audit log API for the Security Console: entries, chain verification, Merkle anchoring."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import anchoring, audit
from ..db import get_db
from ..events import broker
from ..models import Anchor, AuditEntry
from ..schemas import AnchorOut, AuditAppendIn, AuditEntryOut
from ..security import require_agent

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/entries", response_model=list[AuditEntryOut])
def entries(after_seq: int = 0, kind: str | None = None, limit: int = 200, db: Session = Depends(get_db)):
    q = select(AuditEntry).where(AuditEntry.seq > after_seq).order_by(AuditEntry.seq).limit(min(limit, 1000))
    if kind:
        q = q.where(AuditEntry.kind.like(f"{kind}%"))
    return db.scalars(q).all()


@router.post("/entries", response_model=AuditEntryOut, status_code=201,
             summary="Append an entry (policy engine, security guard, agent)")
def append(body: AuditAppendIn, db: Session = Depends(get_db), _: str = Depends(require_agent)):
    entry = audit.append(db, body.actor, body.kind, body.payload)
    broker.publish("audit.appended", {"seq": entry.seq, "kind": entry.kind, "hash": entry.hash})
    return entry


@router.get("/verify", summary="Recompute the whole hash chain")
def verify(db: Session = Depends(get_db)):
    return audit.verify(db)


@router.get("/anchors", response_model=list[AnchorOut])
def anchors(db: Session = Depends(get_db)):
    return db.scalars(select(Anchor).order_by(Anchor.id.desc())).all()


@router.post("/anchor", response_model=AnchorOut, status_code=201,
             summary="Anchor the Merkle root of every entry since the last anchor")
def anchor(db: Session = Depends(get_db)):
    last = db.scalars(select(Anchor).order_by(Anchor.id.desc()).limit(1)).first()
    from_seq = (last.to_seq + 1) if last else 1
    rows = db.scalars(select(AuditEntry).where(AuditEntry.seq >= from_seq).order_by(AuditEntry.seq)).all()
    if not rows:
        raise HTTPException(409, "Nothing new to anchor")
    root = audit.merkle_root([r.hash for r in rows])
    receipt = anchoring.anchor(root, from_seq, rows[-1].seq)
    a = Anchor(from_seq=from_seq, to_seq=rows[-1].seq, merkle_root=root, **receipt)
    db.add(a)
    db.flush()
    audit.append(db, "system", "audit.anchored", {
        "anchor_id": a.id, "from_seq": a.from_seq, "to_seq": a.to_seq, "merkle_root": root, **receipt,
    })
    broker.publish("audit.anchored", AnchorOut.model_validate(a).model_dump(mode="json"))
    return a


@router.get("/proof/{seq}", summary="Merkle inclusion proof of one entry against its anchor")
def proof(seq: int, db: Session = Depends(get_db)):
    a = db.scalars(select(Anchor).where(Anchor.from_seq <= seq, Anchor.to_seq >= seq)).first()
    if not a:
        raise HTTPException(404, f"Entry {seq} is not anchored yet")
    leaves = list(db.scalars(select(AuditEntry.hash).where(
        AuditEntry.seq >= a.from_seq, AuditEntry.seq <= a.to_seq).order_by(AuditEntry.seq)))
    idx = seq - a.from_seq
    return {"seq": seq, "leaf": leaves[idx], "anchor_id": a.id, "merkle_root": a.merkle_root,
            "tx_hash": a.tx_hash, "proof": audit.merkle_proof(leaves, idx)}
