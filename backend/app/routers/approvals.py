"""Approval Center API: every money movement enters here, gets a policy tier, and runs in the
sandbox bank either right away (L1/L2) or after the owner approves with OTP (L3)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import anchoring, audit, bank, bec, otp, policy
from ..config import get_settings
from ..db import get_db
from ..events import broker
from ..models import Approval, utcnow
from ..schemas import ApprovalCreate, ApprovalOut, ApproveIn, KillSwitchIn, RejectIn
from ..security import reject_agent, require_agent

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
    checks = []
    for o in body.operations:
        try:
            amount = bank.operation_amount_clp(db, o.op, o.params)
        except bank.BankError as exc:
            raise HTTPException(exc.status, exc.message) from exc
        except KeyError as exc:
            raise HTTPException(422, f"Missing parameter {exc} in {o.op}") from exc
        payee = str(o.params.get("payee_id", "")) if o.op == "payment" else ""
        allowlisted = bank.is_allowlisted(db, payee) if o.op == "payment" else True
        changed = bec.account_changed_at(db, payee) if payee else None
        checks.append(policy.OpCheck(o.op, amount, payee, allowlisted, changed))
    amount_clp = sum(c.amount_clp for c in checks)

    # The decision and the execution it allows must see the same history (cumulative limits).
    with policy.lock:
        now = utcnow()
        decision = policy.decide(checks, policy.load_history(db, now), now, _kill_switch["on"])
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
        db.commit()  # the final status must be visible to the next request's history

    audit.append(db, actor, "approval.created", {
        "approval_id": appr.id, "action": appr.action, "tier": appr.tier, "amount_clp": amount_clp,
        "status": appr.status, "policy_reason": decision.reason, "policy_rules": decision.rules,
        "policy_version": policy.POLICY["version"],
    })
    if appr.status == "pending":
        try:
            _send_code(db, appr)
        except otp.OtpError:
            pass  # still pending: logged and on SSE, the owner asks for a new code with POST .../otp
    broker.publish("approval.requested" if appr.status == "pending" else f"approval.{appr.status}", _out(appr))
    return appr


def _send_code(db: Session, appr: Approval) -> dict:
    """Texts the owner a fresh code (SMS mode). Logs where it went, never the code itself."""
    try:
        info = otp.issue(db, appr)
    except otp.OtpError as exc:
        audit.append(db, "security", "approval.otp_not_sent", {"approval_id": appr.id, "error": exc.code})
        broker.publish("approval.otp_not_sent", {"approval_id": appr.id, "error": exc.code})
        raise
    if info["mode"] == "sms":
        audit.append(db, "security", "approval.otp_sent", {"approval_id": appr.id, **info})
        broker.publish("approval.otp_sent", {"approval_id": appr.id, "sent_to": info["sent_to"],
                                             "expires_at": info["expires_at"]})
    return info


@router.get("/approvals", response_model=list[ApprovalOut])
def list_approvals(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Approval).order_by(Approval.created_at.desc())
    if status:
        q = q.where(Approval.status == status)
    return db.scalars(q).all()


@router.get("/approvals/{approval_id}", response_model=ApprovalOut)
def get_approval(approval_id: str, db: Session = Depends(get_db)):
    return _get(db, approval_id)


@router.post("/approvals/{approval_id}/otp", summary="Send the owner a new code (SMS mode)")
def resend_code(approval_id: str, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    try:
        info = _send_code(db, appr)
    except otp.OtpError as exc:
        raise HTTPException(exc.status, {"error": exc.code, "detail": exc.message}) from exc
    return {k: v for k, v in info.items() if k != "delivery_id"}


@router.post("/approvals/{approval_id}/approve", response_model=ApprovalOut,
             dependencies=[Depends(reject_agent)])
def approve(approval_id: str, body: ApproveIn, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    if _kill_switch["on"]:
        raise HTTPException(423, "Kill switch is on")
    if "VOICE" in body.channel.upper():
        audit.append(db, "security", "approval.voice_refused", {"approval_id": appr.id, "channel": body.channel})
        raise HTTPException(403, {"error": "voice_cannot_approve",
                                  "detail": "L3 actions need the OTP; voice never approves (deepfake risk)"})

    check = otp.verify(db, appr, body.otp)
    if check == "expired":
        audit.append(db, "owner", "approval.otp_expired", {"approval_id": appr.id, "channel": body.channel})
        raise HTTPException(410, {"error": "otp_expired", "attempts_left": appr.otp_attempts_left})
    if check != "ok":
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


@router.post("/approvals/{approval_id}/reject", response_model=ApprovalOut,
             dependencies=[Depends(reject_agent)])
def reject(approval_id: str, body: RejectIn, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    appr.status, appr.note, appr.channel, appr.decided_at = "rejected", body.reason, body.channel, utcnow()
    audit.append(db, "owner", "approval.rejected", {"approval_id": appr.id, "reason": body.reason})
    broker.publish("approval.rejected", _out(appr))
    return appr


@router.get("/policy", tags=["policy"], summary="Active policy: tier limits and rules the engine applies")
def get_policy():
    return {**policy.POLICY, "kill_switch": _kill_switch["on"]}


@router.get("/policy/kill-switch", tags=["policy"])
def kill_switch_state():
    return _kill_switch


@router.post("/policy/kill-switch", tags=["policy"])
def set_kill_switch(body: KillSwitchIn, db: Session = Depends(get_db)):
    _kill_switch["on"] = body.on
    audit.append(db, "owner", "policy.kill_switch", {"on": body.on})
    broker.publish("policy.kill_switch", {"on": body.on})
    return _kill_switch
