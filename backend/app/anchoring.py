"""Where Merkle roots get anchored (r3-05).

- "local": the root is only stored in our DB, so the demo works with no chain.
- "evm": the root goes on an EVM testnet (Sepolia by default) as a 0-value transaction from the
  anchor wallet to itself. No contract to deploy: the calldata is the record, readable on any explorer.

  calldata = b"NANFENG1" | merkle_root (32 bytes) | from_seq (uint64) | to_seq (uint64)

FISCO BCOS can be added as another backend returning the same receipt shape.
"""

import logging
import threading

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .config import get_settings
from .events import broker
from .models import Anchor, AuditEntry

log = logging.getLogger(__name__)

MAGIC = b"NANFENG1"
_lock = threading.Lock()  # one anchor at a time: keeps seq ranges and wallet nonces in order
wallet_lock = _lock  # the invoice registry (registry.py) sends from the same wallet
_w3 = None


class AnchorError(Exception):
    pass


def encode(merkle_root: str, from_seq: int, to_seq: int) -> bytes:
    return MAGIC + bytes.fromhex(merkle_root) + from_seq.to_bytes(8, "big") + to_seq.to_bytes(8, "big")


def decode(data: bytes) -> dict | None:
    if len(data) != 56 or not data.startswith(MAGIC):
        return None
    return {"merkle_root": data[8:40].hex(), "from_seq": int.from_bytes(data[40:48], "big"),
            "to_seq": int.from_bytes(data[48:56], "big")}


def web3():
    global _w3
    if _w3 is None:
        from web3 import Web3

        url = get_settings().evm_rpc_url
        if not url:
            raise AnchorError("NANFENG_EVM_RPC_URL is not set")
        _w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 20}))
    return _w3


def set_web3(w3) -> None:
    """Tests inject an in-memory chain here."""
    global _w3
    _w3 = w3


def _anchor_evm(merkle_root: str, from_seq: int, to_seq: int) -> dict:
    s = get_settings()
    if not s.evm_private_key:
        raise AnchorError("NANFENG_EVM_PRIVATE_KEY is not set")
    w3 = web3()
    acct = w3.eth.account.from_key(s.evm_private_key)
    tx = {
        "from": acct.address,
        "to": acct.address,
        "value": 0,
        "data": encode(merkle_root, from_seq, to_seq),
        "nonce": w3.eth.get_transaction_count(acct.address, "pending"),
        "chainId": w3.eth.chain_id,
    }
    tx["gas"] = w3.eth.estimate_gas(tx)
    base = w3.eth.get_block("latest").get("baseFeePerGas", w3.eth.gas_price)
    tip = w3.to_wei(1, "gwei")
    tx["maxPriorityFeePerGas"], tx["maxFeePerGas"] = tip, 2 * base + tip
    tx_hash = w3.eth.send_raw_transaction(acct.sign_transaction(tx).raw_transaction).to_0x_hex()
    explorer = f"{s.evm_explorer_tx_url.rstrip('/')}/{tx_hash}" if s.evm_explorer_tx_url else None
    return {"backend": "evm", "tx_hash": tx_hash, "explorer_url": explorer}


def anchor(merkle_root: str, from_seq: int, to_seq: int) -> dict:
    backend = get_settings().anchor_backend
    if backend == "local":
        return {"backend": "local", "tx_hash": None, "explorer_url": None}
    if backend == "evm":
        try:
            return _anchor_evm(merkle_root, from_seq, to_seq)
        except AnchorError:
            raise
        except Exception as exc:  # RPC down, no funds, nonce clash...
            raise AnchorError(f"{exc.__class__.__name__}: {exc}") from exc
    raise AnchorError(f"Unknown anchor backend '{backend}'")


def anchor_pending(db: Session) -> Anchor | None:
    """Anchors the Merkle root of every entry since the last anchor. None when nothing is new.
    Raises AnchorError if the chain refuses; nothing is recorded then and the next anchor covers it."""
    with _lock:
        last = db.scalars(select(Anchor).order_by(Anchor.id.desc()).limit(1)).first()
        from_seq = (last.to_seq + 1) if last else 1
        rows = db.scalars(select(AuditEntry).where(AuditEntry.seq >= from_seq).order_by(AuditEntry.seq)).all()
        if not rows:
            return None
        root = audit.merkle_root([r.hash for r in rows])
        try:
            receipt = anchor(root, from_seq, rows[-1].seq)
        except AnchorError as exc:
            log.warning("anchor failed: %s", exc)
            broker.publish("audit.anchor_failed", {"from_seq": from_seq, "to_seq": rows[-1].seq, "error": str(exc)})
            raise
        a = Anchor(from_seq=from_seq, to_seq=rows[-1].seq, merkle_root=root, **receipt)
        db.add(a)
        db.flush()
        audit.append(db, "system", "audit.anchored", {
            "anchor_id": a.id, "from_seq": a.from_seq, "to_seq": a.to_seq, "merkle_root": root, **receipt,
        })
        broker.publish("audit.anchored", {"anchor_id": a.id, "from_seq": a.from_seq, "to_seq": a.to_seq,
                                          "merkle_root": root, **receipt})
        return a


def check_on_chain(a: Anchor) -> dict:
    """Reads the anchor's transaction back from the chain and compares it with our record."""
    if a.backend != "evm" or not a.tx_hash:
        return {"anchor_id": a.id, "backend": a.backend, "on_chain": False, "reason": "not an on-chain anchor"}
    w3 = web3()
    tx = w3.eth.get_transaction(a.tx_hash)
    try:
        receipt = w3.eth.get_transaction_receipt(a.tx_hash)
    except Exception:  # not mined yet
        receipt = None
    data = decode(bytes(tx["input"]))
    matches = bool(data) and data == {"merkle_root": a.merkle_root, "from_seq": a.from_seq, "to_seq": a.to_seq}
    confirmed = bool(receipt and receipt["status"] == 1)
    return {
        "anchor_id": a.id, "backend": "evm", "tx_hash": a.tx_hash, "explorer_url": a.explorer_url,
        "on_chain": True, "confirmed": confirmed, "block_number": receipt["blockNumber"] if receipt else None,
        "confirmations": (w3.eth.block_number - receipt["blockNumber"] + 1) if receipt else 0,
        "calldata_matches": matches, "valid": matches and confirmed, "decoded": data,
    }
