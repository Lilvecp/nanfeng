"""Step-up authentication for L3 approvals (r4-05, Andy).

- "sandbox" mode: every approval accepts the shared demo code (Demo Mode, offline rehearsals).
- "sms" mode: each L3 approval gets its own random 6-digit code, sent by Zavu SMS to the owner's phone.
  Only HMAC(secret, approval_id | amount | code) is stored, so the code is bound to that approval and
  that amount, dies after `otp_ttl_s`, and works once. It never goes to the audit log, the SSE stream
  or the agent: the agent can propose an action but has no way to see the code that approves it.

Voice never approves L3: a cloned voice is cheap. That rule lives in the approve route.
"""

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Approval, OtpChallenge, utcnow

log = logging.getLogger(__name__)

_process_secret = secrets.token_bytes(32)


class OtpError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def _secret() -> bytes:
    s = get_settings().otp_secret
    return s.encode() if s else _process_secret


def _hash(approval_id: str, amount_clp: float, code: str) -> str:
    msg = f"{approval_id}|{float(amount_clp):.2f}|{code}".encode()
    return hmac.new(_secret(), msg, hashlib.sha256).hexdigest()


def _utc(ts: datetime) -> datetime:
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def mask_phone(phone: str) -> str:
    return f"{phone[:4]} •••• {phone[-4:]}" if len(phone) >= 8 else "••••"


def send_sms(to: str, text: str) -> str:
    """Zavu: POST /v1/messages {to, text, channel: "sms"}. Returns the message id."""
    s = get_settings()
    r = httpx.post(s.zavu_url, json={"to": to, "text": text, "channel": "sms"},
                   headers={"Authorization": f"Bearer {s.zavu_api_key}"}, timeout=10)
    r.raise_for_status()
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    return str(body.get("id") or body.get("message", {}).get("id") or "")


def sms_mode() -> bool:
    return get_settings().otp_mode == "sms"


def issue(db: Session, appr: Approval) -> dict:
    """Creates (or replaces) the approval's code and texts it to the owner. Returns delivery info
    safe to log: never the code."""
    s = get_settings()
    if not sms_mode():
        return {"mode": "sandbox"}
    if not s.owner_phone or not s.zavu_api_key:
        raise OtpError("otp_unconfigured", "SMS OTP needs NANFENG_OWNER_PHONE and ZAVU_API_KEY", 503)

    now = utcnow()
    ch = db.get(OtpChallenge, appr.id)
    if ch and now - _utc(ch.created_at) < timedelta(seconds=s.otp_resend_after_s):
        raise OtpError("otp_too_soon", f"Wait {s.otp_resend_after_s}s before asking for a new code", 429)

    code = f"{secrets.randbelow(10**6):06d}"
    text = (f"NanFeng: {code} approves \"{appr.action[:40]}\" for CLP {float(appr.amount_clp):,.0f}. "
            f"Valid {s.otp_ttl_s // 60} min. NanFeng never asks for this code.")
    try:
        delivery_id = send_sms(s.owner_phone, text)
    except httpx.HTTPError as exc:
        log.warning("OTP SMS failed for %s: %s", appr.id, exc.__class__.__name__)
        raise OtpError("otp_send_failed", "Could not send the code by SMS", 502) from exc

    if ch is None:
        ch = OtpChallenge(approval_id=appr.id, sends=0)
        db.add(ch)
    ch.code_hash, ch.created_at = _hash(appr.id, appr.amount_clp, code), now
    ch.expires_at = now + timedelta(seconds=s.otp_ttl_s)
    ch.sends, ch.sent_to, ch.delivery_id = ch.sends + 1, mask_phone(s.owner_phone), delivery_id
    db.commit()
    return {"mode": "sms", "sent_to": ch.sent_to, "delivery_id": delivery_id, "expires_at": ch.expires_at.isoformat()}


def verify(db: Session, appr: Approval, code: str) -> str:
    """"ok" | "mismatch" | "expired". A correct code is consumed."""
    if not sms_mode():
        return "ok" if hmac.compare_digest(code, get_settings().sandbox_otp) else "mismatch"
    ch = db.get(OtpChallenge, appr.id)
    if ch is None:
        return "mismatch"
    if utcnow() > _utc(ch.expires_at):
        return "expired"
    if not hmac.compare_digest(ch.code_hash, _hash(appr.id, appr.amount_clp, code)):
        return "mismatch"
    db.delete(ch)
    db.commit()
    return "ok"
