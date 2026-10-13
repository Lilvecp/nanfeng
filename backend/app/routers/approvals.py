"""Approval Center API: every money movement enters here, gets a policy tier, and runs in the
sandbox bank either right away (L1/L2) or after the owner approves with OTP (L3)."""

import threading

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .. import anchoring, audit, auth, bank, bec, otp, policy, sanctions, state
from ..config import get_settings
from ..db import get_db
from ..events import broker
from ..models import Approval, utcnow
from ..schemas import ApprovalCreate, ApprovalOut, ApproveIn, KillSwitchIn, RejectIn
from ..security import is_agent, require_agent

router = APIRouter(tags=["approvals"])
# One execution at a time: two different approvals running together must not read the same balance.
_exec_lock = threading.Lock()



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
            with _exec_lock:
                results.append(bank.execute(db, op["op"], op["params"], actor=actor, approval_id=appr.id, tier=appr.tier))
        except bank.BankError as exc:
            status = "failed"
            done = f" (operations 1-{i} executed)" if i else ""
            appr.note = f"{exc.code}: {exc.message}{done}"
            break
    appr.results, appr.status, appr.decided_at = results, status, utcnow()


def require_agent_or_owner(authorization: str = Header(default="")) -> str:
    """The agent proposes actions; the signed-in owner may propose one too."""
    return "owner" if auth.is_owner(authorization) else require_agent(authorization)


@router.post("/approvals", response_model=ApprovalOut, status_code=201)
def create(body: ApprovalCreate, db: Session = Depends(get_db), actor: str = Depends(require_agent_or_owner)):
    return create_approval(body, db, actor)


def create_approval(body: ApprovalCreate, db: Session, actor: str, send_code: bool = True) -> Approval:
    """Policy decision, persistence, audit and event for a new request. `send_code=False` skips the OTP
    text (the idle sandbox reset asks again without paging the owner)."""
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
        hit = sanctions.screen(bank.counterparty(db, o.op, o.params) or "") or ""
        checks.append(policy.OpCheck(o.op, amount, payee, allowlisted, changed, hit))
    amount_clp = sum(c.amount_clp for c in checks)

    # The decision and the execution it allows must see the same history (cumulative limits).
    with policy.lock:
        now = utcnow()
        decision = policy.decide(checks, policy.load_history(db, now), now, state.kill_switch_on(db))
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
    if appr.status == "pending" and send_code:
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


@router.post("/approvals/{approval_id}/otp", summary="Send the owner a new code (SMS mode)",
             dependencies=[Depends(auth.require_owner)])
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
             dependencies=[Depends(auth.require_owner)])
def approve(approval_id: str, body: ApproveIn, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    if state.kill_switch_on(db):
        raise HTTPException(423, "Kill switch is on")
    if "VOICE" in body.channel.upper():
        audit.append(db, "security", "approval.voice_refused", {"approval_id": appr.id, "channel": body.channel})
        raise HTTPException(403, {"error": "voice_cannot_approve",
                                  "detail": "L3 actions need the OTP; voice never approves (deepfake risk)"})

    # Reserve one attempt atomically before comparing the code (threat model F14): guesses sent in
    # parallel must not all read "3 attempts left", and once they are spent no guess is compared at all.
    reserved = db.execute(
        update(Approval)
        .where(Approval.id == appr.id, Approval.status == "pending", Approval.otp_attempts_left > 0)
        .values(otp_attempts_left=Approval.otp_attempts_left - 1)
    ).rowcount
    db.commit()
    db.refresh(appr)
    if not reserved:
        raise HTTPException(409 if appr.status != "pending" else 423,
                            {"error": "otp_locked", "attempts_left": appr.otp_attempts_left})

    check = otp.verify(db, appr, body.otp)
    if check == "ok":
        db.execute(update(Approval).where(Approval.id == appr.id)
                   .values(otp_attempts_left=Approval.otp_attempts_left + 1))  # a right code costs nothing
        db.commit()
        db.refresh(appr)
    if check == "expired":
        db.execute(update(Approval).where(Approval.id == appr.id)
                   .values(otp_attempts_left=Approval.otp_attempts_left + 1))  # not a guess: give it back
        db.commit()
        db.refresh(appr)
        audit.append(db, "owner", "approval.otp_expired", {"approval_id": appr.id, "channel": body.channel})
        raise HTTPException(410, {"error": "otp_expired", "attempts_left": appr.otp_attempts_left})
    if check != "ok":
        if appr.otp_attempts_left <= 0:
            db.execute(update(Approval).where(Approval.id == appr.id, Approval.status == "pending")
                       .values(status="locked", decided_at=utcnow()))
            db.commit()
            db.refresh(appr)
        audit.append(db, "owner", "approval.otp_failed", {
            "approval_id": appr.id, "attempts_left": appr.otp_attempts_left, "channel": body.channel,
        })
        broker.publish("approval.otp_failed", _out(appr))
        raise HTTPException(403 if appr.status == "pending" else 423,
                            {"error": "otp_mismatch", "attempts_left": appr.otp_attempts_left})

    # Claim the approval atomically before any money moves: two approvals racing for the same request
    # (the owner typing the code while Demo Mode approves on WhatsApp) must execute it once, not twice.
    claimed = db.execute(
        update(Approval)
        .where(Approval.id == appr.id, Approval.status == "pending", Approval.decided_at.is_(None))
        .values(decided_at=utcnow(), channel=body.channel)
    ).rowcount
    db.commit()
    if not claimed:
        db.refresh(appr)
        raise HTTPException(409, f"Approval is already being decided ({appr.status})")
    db.refresh(appr)
    _run(db, appr, actor="owner")
    audit.append(db, "owner", "approval.approved", {
        "approval_id": appr.id, "tier": appr.tier, "status": appr.status, "channel": body.channel,
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
             dependencies=[Depends(auth.require_owner)])
def reject(approval_id: str, body: RejectIn, db: Session = Depends(get_db)):
    appr = _get(db, approval_id)
    if appr.status != "pending":
        raise HTTPException(409, f"Approval is {appr.status}")
    # Same claim as approve(): an approve and a reject racing for one request decide it once.
    claimed = db.execute(
        update(Approval)
        .where(Approval.id == appr.id, Approval.status == "pending", Approval.decided_at.is_(None))
        .values(decided_at=utcnow())
    ).rowcount
    db.commit()
    db.refresh(appr)
    if not claimed:
        raise HTTPException(409, f"Approval is already being decided ({appr.status})")
    appr.status, appr.note, appr.channel = "rejected", body.reason, body.channel
    audit.append(db, "owner", "approval.rejected", {"approval_id": appr.id, "tier": appr.tier, "reason": body.reason})
    broker.publish("approval.rejected", _out(appr))
    return appr


@router.get("/policy", tags=["policy"], summary="Active policy: tier limits and rules the engine applies")
def get_policy(db: Session = Depends(get_db)):
    return {**policy.POLICY, "kill_switch": state.kill_switch_on(db)}


@router.get("/policy/kill-switch", tags=["policy"])
def kill_switch_state(db: Session = Depends(get_db)):
    return {"on": state.kill_switch_on(db)}


@router.post("/policy/kill-switch/otp", tags=["policy"], dependencies=[Depends(auth.require_owner)],
             summary="Send the owner a code to turn the kill switch off (SMS mode)")
def kill_switch_code():
    try:
        return otp.issue_action("kill_switch_off", "turn the kill switch off")
    except otp.OtpError as exc:
        raise HTTPException(exc.status, {"error": exc.code, "detail": exc.message}) from exc


@router.post("/policy/kill-switch", tags=["policy"])
def set_kill_switch(body: KillSwitchIn, db: Session = Depends(get_db), authorization: str = Header(default="")):
    agent, owner = is_agent(authorization), auth.is_owner(authorization)
    if body.on:
        # Stopping is cheap: the owner or the agent itself. Strangers cannot (no denial of service).
        if not (agent or owner):
            raise HTTPException(401, {"error": "owner_login_required", "detail": "Sign in as the owner"})
    else:
        # Re-arming is L3: the agent never re-arms itself; the owner needs a session and a code.
        if agent:
            raise HTTPException(403, "Only the owner can turn the kill switch off")
        if not owner:
            raise HTTPException(401, {"error": "owner_login_required", "detail": "Sign in as the owner"})
        if not body.otp:
            raise HTTPException(400, {"error": "otp_required", "detail": "Turning the kill switch off needs a one-time code"})
        check = otp.verify_action("kill_switch_off", body.otp)
        if check != "ok":
            audit.append(db, "owner", "policy.kill_switch_otp_failed", {"reason": check})
            raise HTTPException(410 if check == "expired" else 403, {"error": f"otp_{check}"})
    actor = "owner" if owner else "agent"
    state.set_kill_switch(db, body.on)
    audit.append(db, actor, "policy.kill_switch", {"on": body.on})  # commits the flag with its audit entry
    broker.publish("policy.kill_switch", {"on": body.on, "by": actor})
    return {"on": state.kill_switch_on(db)}
