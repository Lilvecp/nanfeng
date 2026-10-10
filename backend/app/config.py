from functools import lru_cache

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
