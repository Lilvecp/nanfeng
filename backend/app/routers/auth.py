"""Owner sign-in endpoints (threat model F1)."""

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .. import audit, auth
from ..db import get_db
from ..schemas import LoginIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", summary="Owner signs in with the password; returns a bearer session token")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = auth.client_key(request)
    if auth.too_many_failures(key):
        raise HTTPException(429, {"error": "too_many_attempts", "detail": "Too many failed sign-ins, wait a few minutes"})
    if not auth.password_ok(body.password):
        auth.record_failure(key)
        audit.append(db, "security", "auth.login_failed", {})  # never the password, never the IP
        raise HTTPException(401, {"error": "wrong_password", "detail": "Wrong owner password"})
    auth.clear_failures(key)
    token, expires = auth.issue_session()
    audit.append(db, "owner", "auth.login", {"expires_at": expires})
    return {"token": token, "expires_at": expires}


@router.get("/me", summary="Is this bearer token a valid owner session?")
def me(authorization: str = Header(default="")):
    expires = auth.check_session(auth.bearer(authorization))
    return {"owner": expires is not None, "expires_at": expires}


@router.post("/logout", status_code=204, summary="Ends the owner session")
def logout(authorization: str = Header(default="")):
    auth.revoke(auth.bearer(authorization))


@router.get("/config", summary="What the sign-in screen needs: demo build and, if so, the demo password")
def config():
    return {"demo_password": auth.demo_hint()}
