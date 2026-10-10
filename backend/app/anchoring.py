"""Where Merkle roots get anchored. "local" keeps the root in our DB only, so the demo works with
no chain. r3-05 adds "fisco" (FISCO BCOS in Docker) and the "evm" testnet fallback here; each must
return the same receipt shape."""

from .config import get_settings


def anchor(merkle_root: str, from_seq: int, to_seq: int) -> dict:
    backend = get_settings().anchor_backend
    if backend == "local":
        return {"backend": "local", "tx_hash": None, "explorer_url": None}
    raise NotImplementedError(f"Anchor backend '{backend}' is not wired yet (r3-05)")
