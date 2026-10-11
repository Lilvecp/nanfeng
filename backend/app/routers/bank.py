"""Read side of the Sandbox Bank. Money only moves through /approvals, behind the policy check."""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import bank, seed
from ..audit import canonical
from ..db import get_db
from ..events import broker
from ..models import AuditEntry, Lender, Payee, Receivable, Transaction
from ..schemas import AccountOut, LenderOut, PayeeOut, ReceivableOut, TransactionOut

router = APIRouter(prefix="/bank", tags=["sandbox-bank"])


@router.get("/accounts", response_model=list[AccountOut])
def accounts(db: Session = Depends(get_db)):
    return bank.balances(db)


@router.get("/transactions", response_model=list[TransactionOut])
def transactions(account_id: str | None = None, limit: int = 100, db: Session = Depends(get_db)):
    q = select(Transaction).order_by(Transaction.id.desc()).limit(min(limit, 1000))
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    return db.scalars(q).all()


@router.get("/receivables", response_model=list[ReceivableOut])
def receivables(db: Session = Depends(get_db)):
    return db.scalars(select(Receivable).order_by(Receivable.due_date)).all()


@router.get("/payees", response_model=list[PayeeOut])
def payees(db: Session = Depends(get_db)):
    return db.scalars(select(Payee).order_by(Payee.id)).all()


@router.get("/lenders", response_model=list[LenderOut])
def lenders(db: Session = Depends(get_db)):
    return db.scalars(select(Lender).order_by(Lender.id)).all()


@router.get("/fx/rates")
def fx_rates():
    return {"base": "CLP", "rates": seed.FX_RATES, "synthetic": True}


@router.get("/logs", summary="Export sandbox execution logs as JSON Lines (evidence 06)")
def export_logs(db: Session = Depends(get_db)):
    entries = db.scalars(select(AuditEntry).where(AuditEntry.kind.like("bank.%")).order_by(AuditEntry.seq)).all()

    def lines():
        for e in entries:
            yield canonical({"seq": e.seq, "ts": e.ts, "actor": e.actor, "kind": e.kind,
                             "payload": e.payload, "prev_hash": e.prev_hash, "hash": e.hash}) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson",
                             headers={"Content-Disposition": "attachment; filename=sandbox-bank-log.jsonl"})


@router.post("/reset", summary="Demo Mode: wipe and reseed the sandbox")
def reset(db: Session = Depends(get_db)):
    seed.reset(db)
    broker.publish("sandbox.reset", {})
    return {"reset": True}
