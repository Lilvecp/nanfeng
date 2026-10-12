"""Audit log API for the Security Console: entries, chain verification, Merkle anchoring."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import anchoring, audit
from ..config import get_settings
from ..db import get_db
from ..events import broker
from ..models import Anchor, AuditEntry
from ..schemas import AnchorOut, AuditAppendIn, AuditEntryOut
from ..security import require_agent
from .approvals import require_agent_or_owner

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
    # Whoever calls this holds the agent token, so the entry is the agent's: the body only adds a label.
    # Otherwise the agent could log entries as "owner" (threat model F7).
    label = body.actor.strip().lower()
    entry = audit.append(db, "agent" if label in ("", "agent") else f"agent:{label[:40]}", body.kind, body.payload)
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
def anchor(db: Session = Depends(get_db), _: str = Depends(require_agent_or_owner)):
    """Agent or signed-in owner only: each anchor writes an `audit.anchored` entry, so an open route let
    anyone send unlimited transactions from the anchoring wallet."""
    try:
        a = anchoring.anchor_pending(db)
    except anchoring.AnchorError as exc:
        raise HTTPException(502, f"Anchoring failed: {exc}") from exc
    if not a:
        raise HTTPException(409, "Nothing new to anchor")
    return a


@router.get("/anchors/{anchor_id}/chain", summary="Read the anchor back from the chain and compare")
def anchor_on_chain(anchor_id: int, db: Session = Depends(get_db)):
    a = db.get(Anchor, anchor_id)
    if not a:
        raise HTTPException(404, "Anchor not found")
    try:
        return anchoring.check_on_chain(a)
    except Exception as exc:
        raise HTTPException(502, f"Chain unreachable: {exc.__class__.__name__}") from exc


@router.get("/anchor-wallet", summary="Anchor backend, wallet address and testnet balance")
def anchor_wallet():
    s = get_settings()
    out = {"backend": s.anchor_backend, "address": None, "balance_eth": None, "chain_id": None}
    if s.anchor_backend != "evm" or not s.evm_private_key:
        return out
    try:
        w3 = anchoring.web3()
        addr = w3.eth.account.from_key(s.evm_private_key).address
        out.update(address=addr, chain_id=w3.eth.chain_id,
                   balance_eth=float(w3.from_wei(w3.eth.get_balance(addr), "ether")))
    except Exception as exc:
        out["error"] = f"{exc.__class__.__name__}: {exc}"
    return out


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
