"""Owner sign-in (threat model F1, red team API-02 / API-03).

The owner signs in with a password and gets a short-lived session token signed with HMAC:

    v1.<expires_unix>.<nonce>.<sig>    sig = HMAC-SHA256(session_secret, "v1.<expires>.<nonce>")

Stateless, so it works without a session table; sign-out puts the nonce on a deny list. Failed
sign-ins are rate limited per client. Owner-only routes depend on `require_owner`; the agent
token is never accepted there (the agent proposes, the owner decides).
"""

import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException, Request

from .config import DEMO_OWNER_PASSWORD, get_settings
from .security import is_agent

_process_secret = secrets.token_bytes(32)
_revoked: set[str] = set()
_failures: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()

MAX_FAILURES = 5
FAILURE_WINDOW_S = 300


def _secret() -> bytes:
    s = get_settings().session_secret
    return s.encode() if s else _process_secret


def _sign(payload: str) -> str:
    return hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()


def issue_session() -> tuple[str, int]:
    expires = int(time.time()) + get_settings().session_ttl_s
    payload = f"v1.{expires}.{secrets.token_urlsafe(12)}"
    return f"{payload}.{_sign(payload)}", expires


def check_session(token: str) -> int | None:
    """Expiry (unix seconds) of a valid, unrevoked session; None otherwise."""
    parts = token.split(".")
    if len(parts) != 4 or parts[0] != "v1":
        return None
    payload, sig = ".".join(parts[:3]), parts[3]
    if not hmac.compare_digest(sig, _sign(payload)):
        return None
    try:
        expires = int(parts[1])
    except ValueError:
        return None
    if expires < time.time() or parts[2] in _revoked:
        return None
    return expires


def revoke(token: str) -> None:
    parts = token.split(".")
    if len(parts) == 4 and check_session(token):
        _revoked.add(parts[2])


def password_ok(password: str) -> bool:
    return hmac.compare_digest(password.encode(), get_settings().owner_password.encode())


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def too_many_failures(key: str) -> bool:
    now = time.time()
    with _lock:
        q = _failures[key]
        while q and now - q[0] > FAILURE_WINDOW_S:
            q.popleft()
        return len(q) >= MAX_FAILURES


def record_failure(key: str) -> None:
    with _lock:
        _failures[key].append(time.time())


def clear_failures(key: str) -> None:
    with _lock:
        _failures.pop(key, None)


def bearer(authorization: str) -> str:
    return authorization.removeprefix("Bearer ").strip()


def is_owner(authorization: str) -> bool:
    return check_session(bearer(authorization)) is not None


def require_owner(authorization: str = Header(default="")) -> str:
    """Owner-only routes. The agent gets 403 (it may never act as the owner), anyone else 401."""
    if is_agent(authorization):
        raise HTTPException(status_code=403, detail="The agent cannot act as the owner")
    if not is_owner(authorization):
        raise HTTPException(status_code=401, detail={"error": "owner_login_required",
                                                     "detail": "Sign in as the owner (POST /auth/login)"},
                            headers={"WWW-Authenticate": "Bearer"})
    return "owner"


def demo_hint() -> str | None:
    """The demo password, shown on the sign-in screen only in demo builds that still use it."""
    s = get_settings()
    return DEMO_OWNER_PASSWORD if s.demo and s.owner_password == DEMO_OWNER_PASSWORD else None
