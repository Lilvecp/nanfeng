"""Approval Center API: every money movement enters here, gets a policy tier, and runs in the
sandbox bank either right away (L1/L2) or after the owner approves with OTP (L3)."""

import hmac

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import anchoring, audit, bank, policy
from ..config import get_settings
from ..db import get_db
from ..events import broker
from ..models import Approval, utcnow
from ..schemas import ApprovalCreate, ApprovalOut, ApproveIn, KillSwitchIn, RejectIn
from ..security import require_agent

router = APIRouter(tags=["approvals"])

_kill_switch = {"on": False}


def _get(db: Session, approval_id: str) -> Approval:
    appr = db.get(Approval, approval_id)
    if not appr:
        raise HTTPException(404, f"Approval {approval_id} not found")
    return appr


def _out(appr: Approval) -> dict:
    return ApprovalOut.model_validate(appr).model_dump(mode="json")


def _run(db: Session, appr: Approval, actor: str) -> None:
    """Executes the operations in order. Stops at the first failure; earlier ones stay executed
    (the note says which), like a real bank would."""
    results: list[dict] = []
    status = "approved" if appr.tier == 3 else "auto"
    for i, op in enumerate(appr.operations):
        try:
            results.append(bank.execute(db, op["op"], op["params"], actor=actor))
        except bank.BankError as exc:
            status = "failed"
            done = f" (operations 1-{i} executed)" if i else ""
            appr.note = f"{exc.code}: {exc.message}{done}"
            break
    appr.results, appr.status, appr.decided_at = results, status, utcnow()


@router.post("/approvals", response_model=ApprovalOut, status_code=201)
def create(body: ApprovalCreate, db: Session = Depends(get_db), actor: str = Depends(require_agent)):
    amounts, decisions = [], []
    for o in body.operations:
        try:
            amounts.append(bank.operation_amount_clp(db, o.op, o.params))
        except bank.BankError as exc:
            raise HTTPException(exc.status, exc.message) from exc
        except KeyError as exc:
            raise HTTPException(422, f"Missing parameter {exc} in {o.op}") from exc
        allowlisted = bank.is_allowlisted(db, o.params.get("payee_id", "")) if o.op == "payment" else True
        decisions.append(policy.evaluate(o.op, amounts[-1], allowlisted, _kill_switch["on"]))
    # the whole request gets the strictest decision among its operations
    decision = max(decisions, key=lambda d: (d.blocked, d.tier))
    amount_clp = sum(amounts)

    n = (db.scalar(select(func.count()).select_from(Approval)) or 0) + 1
    appr = Approval(
        id=f"{'APR' if decision.tier == 3 else 'AUT'}-{n:04d}", action=body.action,
        operations=[o.model_dump() for o in body.operations], amount_clp=amount_clp, tier=decision.tier,
        status="pending", otp_attempts_left=get_settings().otp_max_attempts,
        channel=body.channel, explanation=body.explanation, note=decision.reason,
    )
    db.add(appr)
    db.commit()  # persist before executing: a failed bank op rolls back its own changes only

    if decision.blocked:
        appr.status, appr.decided_at = "blocked", utcnow()
    elif decision.tier < 3:
        _run(db, appr, actor)

    audit.append(db, actor, "approval.created", {
        "approval_id": appr.id, "action": appr.action, "tier": appr.tier, "amount_clp": amount_clp,
        "status": appr.status, "policy_reason": decision.reason,
    })
    broker.publish("approval.requested" if appr.status == "pending" else f"approval.{appr.status}", _out(appr))
    return appr


@router.get("/approvals", response_model=list[ApprovalOut])
def list_approvals(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Approval).order_by(Approval.created_at.desc())
    if status:
        q = q.where(Approval.status == status)
    return db.scalars(q).all()


@router.get("/approvals/{approval_id}", response_model=ApprovalOut)
def get_approval(approval_id: str, db: Session = Depends(get_db)):
    return _get(db, approval_id)


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalOut)
def approve(approval_id: str, body: ApproveIn, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    if _kill_switch["on"]:
        raise HTTPException(423, "Kill switch is on")

    if not hmac.compare_digest(body.otp, get_settings().sandbox_otp):
        appr.otp_attempts_left -= 1
        if appr.otp_attempts_left <= 0:
            appr.status, appr.decided_at = "locked", utcnow()
        audit.append(db, "owner", "approval.otp_failed", {
            "approval_id": appr.id, "attempts_left": appr.otp_attempts_left, "channel": body.channel,
        })
        broker.publish("approval.otp_failed", _out(appr))
        raise HTTPException(403 if appr.status == "pending" else 423,
                            {"error": "otp_mismatch", "attempts_left": appr.otp_attempts_left})

    appr.channel = body.channel
    db.commit()
    _run(db, appr, actor="owner")
    audit.append(db, "owner", "approval.approved", {
        "approval_id": appr.id, "status": appr.status, "channel": body.channel,
        "result_hashes": [r.get("audit_hash") for r in appr.results or []],
    })
    if appr.status == "approved":
        try:
            anchoring.anchor_pending(db)  # covers the execution and the approval entry itself
        except anchoring.AnchorError:
            pass  # already executed; the failure is on the SSE stream and the next anchor covers it
    broker.publish(f"approval.{appr.status}", _out(appr))
    return appr


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalOut)
def reject(approval_id: str, body: RejectIn, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    appr.status, appr.note, appr.channel, appr.decided_at = "rejected", body.reason, body.channel, utcnow()
    audit.append(db, "owner", "approval.rejected", {"approval_id": appr.id, "reason": body.reason})
    broker.publish("approval.rejected", _out(appr))
    return appr


@router.get("/policy/kill-switch", tags=["policy"])
def kill_switch_state():
    return _kill_switch


@router.post("/policy/kill-switch", tags=["policy"])
def set_kill_switch(body: KillSwitchIn, db: Session = Depends(get_db)):
    _kill_switch["on"] = body.on
    audit.append(db, "owner", "policy.kill_switch", {"on": body.on})
    broker.publish("policy.kill_switch", {"on": body.on})
    return _kill_switch
