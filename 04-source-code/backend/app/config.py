import json
from functools import lru_cache
from typing import Annotated

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Shown on the sign-in screen of demo builds so the jury can try the app. A real deploy sets its
# own NANFENG_OWNER_PASSWORD and NANFENG_DEMO=false (startup refuses the demo password then).
DEMO_OWNER_PASSWORD = "huerto-demo-2026"
PLACEHOLDER_AGENT_TOKEN = "change-me"  # what .env.example ships; refused at startup (threat model F6)


class Settings(BaseSettings):
    """All configuration comes from the environment (.env locally, secrets manager in deploy)."""

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), env_prefix="NANFENG_", extra="ignore")

    # SQLite keeps local dev and tests dependency-free; docker compose sets Postgres.
    database_url: str = "sqlite:///./nanfeng.db"
    # Vicente's quant engine (uvicorn nanfeng_quant.api:app --port 8100).
    quant_url: str = "http://localhost:8100"
    quant_timeout_s: float = 60.0
    # Shared with web/src/lib/desk-state.tsx. Sandbox only: real OTP goes over Zavu SMS (Andy / Renato).
    sandbox_otp: str = "482913"
    otp_max_attempts: int = 3
    # "sandbox" = the shared demo code above; "sms" = a random code per approval, sent by Zavu SMS (r4-05).
    otp_mode: str = "sandbox"
    otp_ttl_s: int = 300
    otp_resend_after_s: int = 30
    # HMAC key for stored OTP hashes. Empty = random per process (codes die with a restart).
    otp_secret: str = ""
    owner_phone: str = ""  # E.164, e.g. +56911112222
    zavu_api_key: str = Field(default="", validation_alias=AliasChoices("NANFENG_ZAVU_API_KEY", "ZAVU_API_KEY"))
    zavu_url: str = "https://api.zavu.dev/v1/messages"
    # Token the agent (Renato) uses to publish events and create approvals. Empty = agent routes refuse everyone.
    agent_token: str = ""
    # Development only: with no agent token, accept any caller as the agent (threat model F6).
    allow_open_agent: bool = False
    # A JSON list or comma-separated origins, whichever the host's secret manager makes easier.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:3100"]
    # "local" records the Merkle root in the DB only; "evm" sends it to an EVM testnet (r3-05).
    anchor_backend: str = "local"
    evm_rpc_url: str = ""
    evm_private_key: str = ""  # testnet-only wallet; never a key that holds real funds
    evm_explorer_tx_url: str = "https://sepolia.etherscan.io/tx"
    # Invoice registry against double financing (r3-06). "local" = fingerprints in our DB only;
    # "evm" = InvoiceRegistry contract at invoice_registry_address (deploy: python chain/deploy.py),
    # same RPC and wallet as anchoring. In "evm" mode factoring fails closed if the chain is unreachable.
    registry_backend: str = "local"
    invoice_registry_address: str = ""
    registry_wait_receipt_s: float = 0  # >0: wait for the registration to be mined before paying out
    # Fictional tax id (RUT) of the demo exporter: part of each invoice's fingerprint.
    issuer_tax_id: str = "76.543.210-3"
    seed_on_startup: bool = True
    # Owner sign-in (threat model F1). Sessions are HMAC-signed; empty secret = random per process.
    owner_password: str = DEMO_OWNER_PASSWORD
    session_secret: str = ""
    session_ttl_s: int = 8 * 3600
    # Demo build: enables POST /bank/reset and shows the demo password on the sign-in screen.
    demo: bool = True
    # Demo builds: reset the shared sandbox after this many seconds with no new audit entry, once a
    # visitor has moved past the opening state (see app/autoreset.py). 0 = never.
    sandbox_idle_reset_s: int = 1800


    @field_validator("cors_origins", mode="before")
    @classmethod
    def _origins(cls, v):
        if isinstance(v, str):
            v = v.strip().strip("'")
            v = json.loads(v) if v.startswith("[") else v.split(",")
        return [o.strip().strip('"').rstrip("/") for o in v if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
