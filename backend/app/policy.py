"""Deterministic policy engine (r4-02, Andy). Runs outside the LLM: the agent proposes, this decides.

L0 read-only · L1 act + notify · L2 act within limits · L3 owner approval with OTP.
`blocked` means not even the owner can approve it from the app (kill switch, L3 hard caps).

The limits are data (POLICY), with the same keys the Settings screen edits (`tiers.L2.per_action`...).
Cumulative limits use rolling windows (24 h, 30 days) instead of calendar days, so the agent cannot
spend the whole daily budget at 23:59 and again at 00:01.
"""

import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .bank import to_clp
from .models import Approval

POLICY: dict = {
    "version": 1,
    "tiers": {
        "L1": {"per_action": 1_000_000},
        "L2": {"per_action": 25_000_000, "per_day": 40_000_000, "per_month": 80_000_000},
        "L3": {"per_action": 400_000_000, "per_month": 400_000_000},
    },
    # New money or a binding FX commitment always goes to the owner, whatever the amount.
    "always_l3": ["factoring", "loan", "forward"],
    "velocity": {"window_minutes": 10, "max_auto_actions": 5},
    "structuring": {"window_hours": 24},
}

# One evaluate-and-execute at a time, so two concurrent requests cannot both fit under a cumulative limit.
lock = threading.Lock()

# Statuses whose operations ran (or may have partly run): they count against the limits.
_SPENT = ("auto", "approved", "failed")


@dataclass
class Decision:
    tier: int
    reason: str
    blocked: bool = False
    rules: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class OpCheck:
    """One operation of a request, as the policy sees it."""

    op: str
    amount_clp: float
    payee_id: str = ""
    payee_allowlisted: bool = True


@dataclass(frozen=True)
class Executed:
    """A past request that moved money, for the cumulative limits."""

    at: datetime
    tier: int
    amount_clp: float
    payments: tuple[tuple[str, float], ...] = ()  # (payee_id, amount_clp) of each payment in it


def _clp(n: float) -> str:
    return f"CLP {n:,.0f}"


def decide(ops: list[OpCheck], history: list[Executed], now: datetime,
           kill_switch: bool = False, p: dict = POLICY) -> Decision:
    """Pure function: same inputs, same decision. Any rule that fires sends the request to L3."""
    if kill_switch:
        return Decision(3, "Kill switch is on: every action is blocked", blocked=True, rules=["kill_switch"])

    l1, l2, l3 = p["tiers"]["L1"], p["tiers"]["L2"], p["tiers"]["L3"]
    total = sum(o.amount_clp for o in ops)
    fired: dict[str, str] = {}  # rule -> reason, in firing order

    for o in ops:
        if o.op in p["always_l3"]:
            fired.setdefault("financing", f"{o.op} always needs the owner's approval")
        elif o.op == "payment" and not o.payee_allowlisted:
            fired.setdefault("payee_not_allowlisted", f"payee {o.payee_id or '?'} is not on the allowlist")
        elif o.amount_clp > l2["per_action"]:
            fired.setdefault("l2_per_action", f"{_clp(o.amount_clp)} is above the L2 limit per action")

    # Several operations in one request add up: two payments of CLP 20M are not two L2 actions.
    if not fired and total > l2["per_action"]:
        fired["request_total"] = f"request total {_clp(total)} is above the L2 limit per action"

    if not fired:
        auto = [e for e in history if e.tier < 3]
        spent_day = sum(e.amount_clp for e in auto if e.at >= now - timedelta(hours=24))
        spent_month = sum(e.amount_clp for e in auto if e.at >= now - timedelta(days=30))
        if spent_day + total > l2["per_day"]:
            fired["l2_per_day"] = (f"agent spend in 24 h would reach {_clp(spent_day + total)}, "
                                   f"above the L2 daily limit {_clp(l2['per_day'])}")
        if spent_month + total > l2["per_month"]:
            fired["l2_per_month"] = (f"agent spend in 30 days would reach {_clp(spent_month + total)}, "
                                     f"above the L2 monthly limit {_clp(l2['per_month'])}")

        v = p["velocity"]
        recent = sum(1 for e in auto if e.at >= now - timedelta(minutes=v["window_minutes"]))
        if recent >= v["max_auto_actions"]:
            fired["velocity"] = (f"{recent} automatic actions in the last {v['window_minutes']} min "
                                 f"(max {v['max_auto_actions']})")

        # Structuring: one big payment split into several small ones to the same payee.
        since = now - timedelta(hours=p["structuring"]["window_hours"])
        for payee in dict.fromkeys(o.payee_id for o in ops if o.op == "payment"):
            before = sum(a for e in auto if e.at >= since for pid, a in e.payments if pid == payee)
            this = sum(o.amount_clp for o in ops if o.op == "payment" and o.payee_id == payee)
            if before and before + this > l2["per_action"]:
                fired.setdefault("structuring", f"payments to {payee} in 24 h add up to "
                                                f"{_clp(before + this)}, above the L2 limit per action")

    if total > l3["per_action"]:
        return Decision(3, f"{_clp(total)} is above the L3 hard cap {_clp(l3['per_action'])}: "
                           "needs the bank, not the app", blocked=True, rules=[*fired, "l3_per_action"])
    if fired:
        approved = sum(e.amount_clp for e in history if e.tier == 3 and e.at >= now - timedelta(days=30))
        if approved + total > l3["per_month"]:
            return Decision(3, f"Owner-approved total in 30 days would reach {_clp(approved + total)}, "
                               f"above the L3 monthly cap {_clp(l3['per_month'])}",
                            blocked=True, rules=[*fired, "l3_per_month"])
        reason = "; ".join(fired.values())
        return Decision(3, reason[0].upper() + reason[1:], rules=list(fired))

    if total > l1["per_action"]:
        return Decision(2, "Within the L2 limits", rules=["within_l2"])
    return Decision(1, "Within the L1 limit", rules=["within_l1"])


def _utc(ts: datetime) -> datetime:
    # SQLite hands back naive datetimes; everything is stored in UTC.
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def payment_clp(params: dict) -> float:
    return to_clp(params["amount"], params.get("currency", "CLP"))


def load_history(db: Session, now: datetime) -> list[Executed]:
    """Requests from the last 30 days that moved money (or may have, if they failed halfway)."""
    since = now - timedelta(days=30)
    out = []
    for a in db.scalars(select(Approval).where(Approval.status.in_(_SPENT))):
        at = _utc(a.created_at)
        if at < since:
            continue
        pays = tuple((o["params"].get("payee_id", ""), payment_clp(o["params"]))
                     for o in a.operations if o["op"] == "payment")
        out.append(Executed(at=at, tier=a.tier, amount_clp=float(a.amount_clp), payments=pays))
    return out
