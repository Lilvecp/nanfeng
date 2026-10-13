"""Idle reset of the shared demo sandbox.

Every visitor of the public demo shares one sandbox. Once someone runs the Cherry Crisis to the end,
the next visitor would land on "payroll covered" instead of the 81% crisis, and the story is lost
before it starts. In demo builds, after NANFENG_SANDBOX_IDLE_RESET_S seconds with nothing new in the
audit log, a sandbox that has moved past the opening state is reset and the agent's pending plan is
requested again, so every new visitor starts at 10:13 of the crisis. A take in progress is never
interrupted: any audit entry restarts the idle clock.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import seed, state
from .config import get_settings
from .db import SessionLocal
from .events import broker
from .models import Approval, AuditEntry
from .schemas import ApprovalCreate

log = logging.getLogger(__name__)

# What the opening state writes by itself: seeding, the 08:47 blocked attack and the agent's request.
OPENING_KINDS = {"sandbox.seeded", "security.attack_blocked", "security.flagged", "approval.created",
                 "approval.otp_sent", "approval.otp_not_sent"}


def _plan_to_restore(db: Session) -> ApprovalCreate | None:
    """The latest owner-approval request (L3), to ask for it again after the reset."""
    appr = db.scalars(select(Approval).where(Approval.tier == 3).order_by(Approval.created_at.desc())).first()
    if appr is None:
        return None
    return ApprovalCreate(action=appr.action, operations=appr.operations, explanation=appr.explanation or "")


def needs_reset(db: Session, now: datetime, idle_s: int) -> bool:
    entries = list(db.scalars(select(AuditEntry).order_by(AuditEntry.seq)))
    if not entries:
        return False
    last = datetime.fromisoformat(entries[-1].ts)
    if now - last < timedelta(seconds=idle_s):
        return False  # someone is using it right now
    moved_on = any(e.kind not in OPENING_KINDS for e in entries)
    return moved_on or state.kill_switch_on(db)


def reset_if_idle(now: datetime | None = None) -> bool:
    """Resets the sandbox when it is idle and past the opening state. Returns True if it reset."""
    from .routers import approvals  # the router owns approval creation (policy, audit, events)

    s = get_settings()
    if not s.demo or s.sandbox_idle_reset_s <= 0:
        return False
    now = now or datetime.now(timezone.utc)
    with SessionLocal() as db:
        if not needs_reset(db, now, s.sandbox_idle_reset_s):
            return False
        plan = _plan_to_restore(db)
        seed.reset(db)
        if plan is not None:
            # no SMS for a request nobody is looking at: the owner asks for a code when they open it
            approvals.create_approval(plan, db, actor="agent", send_code=False)
    broker.publish("sandbox.reset", {"by": "idle"})
    log.info("Sandbox reset after %ss idle", s.sandbox_idle_reset_s)
    return True


async def run_forever(every_s: float = 60) -> None:
    while True:
        await asyncio.sleep(every_s)
        try:
            await asyncio.to_thread(reset_if_idle)
        except Exception:  # never let the loop die; the next tick tries again
            log.exception("Idle sandbox reset failed")
