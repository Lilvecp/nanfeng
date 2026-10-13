import hmac

from fastapi import Header, HTTPException

from .config import get_settings


def require_agent(authorization: str = Header(default="")) -> str:
    """Bearer token for machine callers (agent, Zavu webhooks). Fails closed when no token is configured
    (threat model F6): an empty token used to let anyone act as the agent, which runs L1/L2 payments on
    its own. Local development can opt in with NANFENG_ALLOW_OPEN_AGENT=true."""
    s = get_settings()
    token = s.agent_token
    if not token:
        if s.allow_open_agent:
            return "agent"
        raise HTTPException(status_code=401, detail="agent_token_not_configured")
    supplied = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, token):
        raise HTTPException(status_code=401, detail="Invalid agent token")
    return "agent"


def is_agent(authorization: str) -> bool:
    token = get_settings().agent_token
    supplied = authorization.removeprefix("Bearer ").strip()
    return bool(token and supplied and hmac.compare_digest(supplied, token))


def reject_agent(authorization: str = Header(default="")) -> None:
    """Owner-only routes: the agent may propose an action but never approve it (r4-05)."""
    if is_agent(authorization):
        raise HTTPException(status_code=403, detail="The agent cannot approve its own requests")
