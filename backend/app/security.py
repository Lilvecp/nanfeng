import hmac

from fastapi import Header, HTTPException

from .config import get_settings


def require_agent(authorization: str = Header(default="")) -> str:
    """Bearer token for machine callers (agent, Zavu webhooks). Open when no token is configured."""
    token = get_settings().agent_token
    if not token:
        return "agent"
    supplied = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, token):
        raise HTTPException(status_code=401, detail="Invalid agent token")
    return "agent"
