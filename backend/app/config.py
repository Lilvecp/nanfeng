from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    # Token the agent (Renato) uses to publish events and create approvals. Empty = open (local dev).
    agent_token: str = ""
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3100"]
    # "local" records the Merkle root in the DB only; "evm" sends it to an EVM testnet (r3-05).
    anchor_backend: str = "local"
    evm_rpc_url: str = ""
    evm_private_key: str = ""  # testnet-only wallet; never a key that holds real funds
    evm_explorer_tx_url: str = "https://sepolia.etherscan.io/tx"
    seed_on_startup: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
