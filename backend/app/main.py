import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import audit, seed
from .bank import BankError
from .config import DEMO_OWNER_PASSWORD, PLACEHOLDER_AGENT_TOKEN, get_settings
from .db import SessionLocal
from .events import broker
from .routers import agent, approvals, audit as audit_router, auth as auth_router, bank as bank_router, demo, privacy, quant, security, registry as registry_router

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if not s.demo and s.owner_password == DEMO_OWNER_PASSWORD:
        raise RuntimeError("NANFENG_DEMO=false needs its own NANFENG_OWNER_PASSWORD (the demo one is public)")
    if s.agent_token == PLACEHOLDER_AGENT_TOKEN:
        raise RuntimeError("NANFENG_AGENT_TOKEN is the public placeholder from .env.example: set a long random one")
    broker.bind_loop(asyncio.get_running_loop())
    seed.create_schema()
    if get_settings().seed_on_startup:
        with SessionLocal() as db:
            seed.seed(db)
            seed.seed_security(db)
    yield


app = FastAPI(
    title="NanFeng API",
    version=VERSION,
    description="API gateway for the NanFeng cockpit and agent: sandbox bank, approvals with OTP, "
                "hash-chained audit log with Merkle anchoring, agent event stream (SSE) and the quant "
                "engine under /quant. All data is synthetic.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BankError)
async def bank_error(_: Request, exc: BankError):
    return JSONResponse(status_code=exc.status, content={"error": exc.code, "detail": exc.message})


@app.get("/health", tags=["meta"])
def health():
    with SessionLocal() as db:
        return {"status": "ok", "version": VERSION, "audit_head_seq": audit.head_seq(db),
                "anchor_backend": get_settings().anchor_backend}


for r in (auth_router.router, demo.router, bank_router.router, approvals.router, audit_router.router, agent.router, quant.router, security.router,
          privacy.router, registry_router.router):
    app.include_router(r)


def export_openapi(path: str) -> None:
    import json

    with open(path, "w") as f:
        json.dump(app.openapi(), f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    import sys

    export_openapi(sys.argv[1] if len(sys.argv) > 1 else "../contracts/openapi.json")
