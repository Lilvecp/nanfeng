"""Demo Mode replay (fe-10): each of the six Cherry Crisis steps really happens on the backend, so
every open screen (Mission Control, Approvals, Security, a phone) follows the video in real time.

Owner-only and demo builds only. Numbers and texts come from the quant engine's results, sent by
the cockpit with each step; the backend does the real work: reset, the approval request through
the policy engine, execution in the sandbox bank and the on-chain anchor.

    1 delay · 2 forecast · 3 quotes · 4 plan (creates the approval) · 5 approve (executes, anchors) · 6 closed
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import auth, otp, seed
from ..config import get_settings
from ..db import get_db
from ..events import broker
from ..models import Approval
from ..schemas import ApproveIn, DemoStepIn
from . import approvals

router = APIRouter(prefix="/demo", tags=["demo"])

SOURCE = "agent-replay"  # events say they come from the replay, never pretend to be the live agent


def _demo_only():
    if not get_settings().demo:
        raise HTTPException(404, "Not available outside demo builds")


def _plan_approval(db: Session, action: str) -> Approval | None:
    return db.scalars(select(Approval).where(Approval.action == action).order_by(Approval.created_at.desc())).first()


@router.post("/step/{n}", dependencies=[Depends(auth.require_owner), Depends(_demo_only)],
             summary="Play one Cherry Crisis step for real (owner, demo builds only)")
def play_step(n: int, body: DemoStepIn, db: Session = Depends(get_db)):
    if not 1 <= n <= 6:
        raise HTTPException(422, "Steps go from 1 to 6")
    result: dict = {"step": n}

    if n == 1:  # a clean sandbox: same opening state in every take
        seed.reset(db)
        broker.publish("sandbox.reset", {"by": "demo"})

    for s in body.agent_steps:
        broker.publish("agent.step", {**s.model_dump(), "status": "done", "demo_step": n}, source=SOURCE)

    if n == 4:
        if body.plan is None:
            raise HTTPException(422, "Step 4 needs the plan")
        existing = _plan_approval(db, body.plan.action)
        appr = existing if existing and existing.status == "pending" else approvals.create_approval(body.plan, db, actor="agent")
        result["approval"] = {"id": appr.id, "status": appr.status, "tier": appr.tier}

    if n == 5:
        if body.plan is None:
            raise HTTPException(422, "Step 5 needs the plan")
        appr = _plan_approval(db, body.plan.action)
        if appr is None:
            raise HTTPException(409, "Play step 4 first: there is no approval to approve")
        if appr.status == "pending":
            if otp.sms_mode():  # a real code went to the owner's phone: the owner approves it themselves
                raise HTTPException(409, {"error": "owner_must_approve", "detail": "SMS mode: approve with the texted code"})
            try:
                appr = approvals.approve(appr.id, ApproveIn(otp=get_settings().sandbox_otp, channel="WA+OTP"), db)
            except HTTPException as exc:
                if exc.status_code != 409:
                    raise
                db.refresh(appr)  # the owner approved it on screen a moment earlier: it ran once, keep going
        result["approval"] = {"id": appr.id, "status": appr.status,
                              "audit_hashes": [r.get("audit_hash") for r in appr.results or []]}

    broker.publish("demo.step", {"step": n, **({"approval": result["approval"]} if "approval" in result else {})})
    return result
