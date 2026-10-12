"""Security API for the agent pipeline (r4-03 / r4-04, Andy).

Renato's ingestion calls /security/scan on the raw text of every document before any LLM reads it,
and /security/check-payee on the extracted fields before the planner sees them. Anything that is not
clean is hash-chained in the audit log; a malicious document also alerts the owner on a channel
different from the one it came in on.
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import audit, bec, guard, otp
from ..config import get_settings
from ..db import get_db
from ..events import broker
from ..schemas import PayeeCheckIn, ScanIn, SecurityVerdict
from ..security import require_agent

router = APIRouter(prefix="/security", tags=["security"])
log = logging.getLogger(__name__)


def _alert_owner(doc_id: str, source: str, rules: list[str]) -> str:
    """Out-of-band alert: SMS unless the attack itself came by SMS (then the cockpit only)."""
    s = get_settings()
    if source.lower() == "sms" or not (s.owner_phone and s.zavu_api_key):
        return "cockpit"
    try:
        otp.send_sms(s.owner_phone, f"NanFeng blocked document {doc_id} ({', '.join(rules)}). "
                                    "Nothing was paid. Do not act on it; call your supplier on the number you know.")
        return "sms"
    except Exception as exc:  # the block stands even if the alert cannot go out
        log.warning("Security alert SMS failed: %s", exc.__class__.__name__)
        return "cockpit"


def _record(db: Session, doc_id: str, source: str, check: str, result: dict) -> dict:
    if result["verdict"] == "clean":
        return result
    kind = "security.attack_blocked" if result["verdict"] == "malicious" else "security.flagged"
    if result["verdict"] == "malicious":
        result["alerted_via"] = _alert_owner(doc_id, source, result["rules"])
    payload = {"doc_id": doc_id, "source": source, "check": check, **result}
    entry = audit.append(db, "security", kind, payload)
    broker.publish(kind, {**payload, "audit_seq": entry.seq}, source="security")
    return {**result, "audit_seq": entry.seq}


@router.post("/scan", response_model=SecurityVerdict, summary="Guard: scan a document's raw text before any LLM")
def scan(body: ScanIn, db: Session = Depends(get_db), _: str = Depends(require_agent)):
    result = guard.scan(body.ocr_text, body.text_layer)
    result.pop("payment_details")
    return {"doc_id": body.doc_id, **_record(db, body.doc_id, body.source, "scan", result)}


@router.post("/check-payee", response_model=SecurityVerdict,
             summary="BEC: compare a document's issuer, domain and bank account with master data")
def check_payee(body: PayeeCheckIn, db: Session = Depends(get_db), _: str = Depends(require_agent)):
    result = bec.check_payee(db, body.issuer_name, body.sender_domain, body.bank_account, body.tax_id)
    return {"doc_id": body.doc_id, **_record(db, body.doc_id, body.source, "payee", result)}
