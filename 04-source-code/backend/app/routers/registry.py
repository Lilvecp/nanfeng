"""Invoice registry against double financing (r3-06): what is registered, and the on-chain proof."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import anchoring, registry
from ..config import get_settings
from ..db import get_db
from ..models import InvoiceRegistration, Receivable

router = APIRouter(prefix="/registry", tags=["invoice-registry"])


@router.get("", summary="Registry backend, contract and chain")
def info():
    s = get_settings()
    out = {"backend": s.registry_backend, "contract_address": s.invoice_registry_address or None,
           "issuer_tax_id": s.issuer_tax_id, "document_type": registry.DOC_TYPE, "chain_id": None}
    if s.registry_backend == "evm" and s.invoice_registry_address:
        try:
            out["chain_id"] = anchoring.web3().eth.chain_id
        except Exception as exc:
            out["error"] = f"Chain unreachable: {exc.__class__.__name__}"
    return out


@router.get("/invoices", summary="Every registered invoice")
def invoices(db: Session = Depends(get_db)):
    rows = db.scalars(select(InvoiceRegistration).order_by(InvoiceRegistration.created_at)).all()
    return [{**registry.receipt(r), "receivable_id": r.receivable_id, "financing": r.financing,
             "created_at": r.created_at} for r in rows]


@router.get("/invoices/{receivable_id}", summary="Fingerprint of an invoice and whether it is registered (here and on-chain)")
def invoice(receivable_id: str, db: Session = Depends(get_db)):
    if not db.get(Receivable, receivable_id):
        raise HTTPException(404, "Receivable not found")
    fp = registry.fingerprint(db, receivable_id)
    reg = db.get(InvoiceRegistration, fp)
    if reg:
        try:
            return {**registry.check_on_chain(reg), "registered": True}
        except Exception as exc:
            raise HTTPException(502, f"Chain unreachable: {exc.__class__.__name__}") from exc
    out = {"receivable_id": receivable_id, "fingerprint": fp, "registered": False}
    if get_settings().registry_backend == "evm":
        try:
            out["chain"] = registry.lookup_on_chain(fp)
            out["registered"] = out["chain"]["registered"]  # registered by another financier
        except Exception as exc:
            raise HTTPException(502, f"Chain unreachable: {exc.__class__.__name__}") from exc
    return out
