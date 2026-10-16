"""Durable app flags kept in the database (Postgres in deploy, SQLite locally).

The kill switch lives here, not in process memory: a restart, a deploy or a sleeping free-tier
host must never turn it off by itself, since turning it off needs the owner's session and a code.
"""

from sqlalchemy.orm import Session

from .models import AppState

KILL_SWITCH = "kill_switch"


def kill_switch_on(db: Session) -> bool:
    row = db.get(AppState, KILL_SWITCH)
    return bool(row and row.value.get("on"))


def set_kill_switch(db: Session, on: bool) -> None:
    """Stages the change; the caller's audit.append commits it together with the audit entry."""
    row = db.get(AppState, KILL_SWITCH)
    if row is None:
        db.add(AppState(key=KILL_SWITCH, value={"on": on}))
    else:
        row.value = {"on": on}
