"""Invoice registry against double financing (r3-06).

Before the sandbox bank pays out on an invoice (factoring, letter-of-credit discounting), the
invoice's fingerprint is registered:

- "local": in our DB (unique key), next to the `financed_by` guard. No chain needed.
- "evm": also in the InvoiceRegistry contract (backend/chain/InvoiceRegistry.sol). The bank first
  reads the registry (eth_call), so an invoice that anyone already registered there is refused,
  then sends `register`. A second registration of the same invoice reverts on-chain, whoever sends it.
  If the chain cannot be read the operation is refused (fails closed): no check, no payout.

    fingerprint = keccak256("NANFENG-INVOICE-V1|<issuer tax id>|<SII document type>|<folio>")

Only the hash goes on-chain. Any financier holding the invoice can compute it; nobody can read the
amount or the customer from it. Demo builds add the sandbox's genesis hash to the identity, so the
Demo Mode reset starts a fresh sandbox instead of finding last run's invoices already registered.
"""

import json
import time
from pathlib import Path

from eth_utils import keccak
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import anchoring, audit
from .config import get_settings
from .models import AuditEntry, InvoiceRegistration

ARTIFACT = json.loads((Path(__file__).parent / "data" / "invoice_registry.json").read_text(encoding="utf-8"))
DOC_TYPE = "110"  # SII document type of an electronic export invoice (factura de exportación electrónica)


class RegistryError(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def identity(db: Session, receivable_id: str) -> str:
    s = get_settings()
    ident = f"NANFENG-INVOICE-V1|{s.issuer_tax_id}|{DOC_TYPE}|{receivable_id}"
    if s.demo:
        # Salted with the current sandbox epoch's first entry, so a demo reset can finance the same
        # invoices again even though the on-chain registry (and the audit chain) outlive the reset.
        start = audit.epoch_start(db)
        genesis = db.scalars(select(AuditEntry.hash).where(AuditEntry.seq == start)).first() or ""
        ident += f"|sandbox:{genesis[:16]}"
    return ident


def fingerprint(db: Session, receivable_id: str) -> str:
    return "0x" + keccak(text=identity(db, receivable_id)).hex()


def _label(financing: str) -> bytes:
    return financing.encode()[:32].ljust(32, b"\0")


def _contract():
    s = get_settings()
    if not s.invoice_registry_address:
        raise RegistryError("registry_unavailable", "NANFENG_INVOICE_REGISTRY_ADDRESS is not set", 503)
    w3 = anchoring.web3()
    return w3, w3.eth.contract(address=w3.to_checksum_address(s.invoice_registry_address), abi=ARTIFACT["abi"])


def lookup_on_chain(fp: str) -> dict:
    _, contract = _contract()
    registered, registrar, registered_at, financing = contract.functions.lookup(bytes.fromhex(fp[2:])).call()
    return {"registered": registered, "registrar": registrar if registered else None,
            "registered_at": registered_at or None, "financing": financing.rstrip(b"\0").decode(errors="replace") or None}


# Registrations this process sent: fingerprint -> (tx hash, when). A registration mined after the receipt wait
# gave up is ours, not another financier's, when the same financing is approved again; one still in flight
# is not sent a second time (the copy would revert as "already registered").
_sent: dict[str, tuple[str, float]] = {}
IN_FLIGHT_S = 600


def _in_flight(w3, tx_hash: str) -> bool:
    from web3.exceptions import TransactionNotFound

    try:
        w3.eth.get_transaction_receipt(tx_hash)
    except TransactionNotFound:
        return True
    return False


def _register_evm(fp: str, receivable_id: str, financing: str) -> tuple[str, str | None, str | None]:
    s = get_settings()
    if not s.evm_private_key:
        raise RegistryError("registry_unavailable", "NANFENG_EVM_PRIVATE_KEY is not set", 503)
    tx_hash = None
    try:
        w3, contract = _contract()
        acct = w3.eth.account.from_key(s.evm_private_key)
        prior = lookup_on_chain(fp)
        sent = _sent.get(fp)
        if prior["registered"]:
            ours = prior["registrar"] == acct.address and prior["financing"] == _label(financing).rstrip(b"\0").decode()
            if not ours:
                raise RegistryError("already_financed", f"{receivable_id} is already in the on-chain invoice registry "
                                    f"({prior['financing']}, registered by {prior['registrar']})", 409)
            tx_hash = sent[0] if sent else None  # our earlier attempt landed late: this approval is its payout
        elif sent and time.monotonic() - sent[1] < IN_FLIGHT_S and _in_flight(w3, sent[0]):
            tx_hash = sent[0]
            raise RegistryError("registry_pending", f"{receivable_id}: registration {tx_hash} is not mined yet; "
                                "nothing was paid out, approve again in a minute", 503)
        else:
            data = contract.encode_abi("register", args=[bytes.fromhex(fp[2:]), _label(financing)])
            with anchoring.wallet_lock:  # same wallet as anchoring: one nonce at a time
                tx_hash = anchoring.send_from_wallet(w3, acct, {"to": contract.address, "data": data})
            _sent[fp] = (tx_hash, time.monotonic())
            if s.registry_wait_receipt_s > 0:
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=s.registry_wait_receipt_s)
                if receipt["status"] != 1:
                    raise RegistryError("already_financed", f"{receivable_id}: the registry refused the registration", 409)
    except RegistryError:
        raise
    except Exception as exc:  # RPC down, no funds, contract not deployed, not mined in time...
        from web3.exceptions import TimeExhausted

        if tx_hash and isinstance(exc, TimeExhausted):
            raise RegistryError("registry_pending", f"{receivable_id}: registration {tx_hash} sent but not mined after "
                                f"{s.registry_wait_receipt_s:g} s; nothing was paid out, approve again in a minute", 503) from exc
        raise RegistryError("registry_unavailable", f"Invoice registry unreachable: {exc.__class__.__name__}", 503) from exc
    explorer = f"{s.evm_explorer_tx_url.rstrip('/')}/{tx_hash}" if s.evm_explorer_tx_url and tx_hash else None
    return contract.address, tx_hash, explorer


def register(db: Session, receivable_id: str, financing: str) -> InvoiceRegistration:
    """Registers the invoice before the payout. Raises RegistryError("already_financed", 409) if it
    is already registered, here or on-chain."""
    s = get_settings()
    fp = fingerprint(db, receivable_id)
    prior = db.get(InvoiceRegistration, fp)
    if prior:
        raise RegistryError("already_financed", f"{receivable_id} is already in the invoice registry ({prior.financing})", 409)
    reg = InvoiceRegistration(fingerprint=fp, receivable_id=receivable_id, financing=financing, backend=s.registry_backend)
    if s.registry_backend == "evm":
        reg.contract_address, reg.tx_hash, reg.explorer_url = _register_evm(fp, receivable_id, financing)
    elif s.registry_backend != "local":
        raise RegistryError("registry_unavailable", f"Unknown registry backend '{s.registry_backend}'", 503)
    db.add(reg)
    db.flush()
    return reg


def deploy(w3, private_key: str) -> str:
    """Deploys the InvoiceRegistry contract from `private_key`'s wallet and returns its address."""
    acct = w3.eth.account.from_key(private_key)
    factory = w3.eth.contract(abi=ARTIFACT["abi"], bytecode=ARTIFACT["bytecode"])
    tx = factory.constructor().build_transaction({
        "from": acct.address, "chainId": w3.eth.chain_id,
        "nonce": w3.eth.get_transaction_count(acct.address, "pending"),
    })
    tx_hash = w3.eth.send_raw_transaction(acct.sign_transaction(tx).raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)
    if receipt["status"] != 1:
        raise RuntimeError(f"Deployment failed: {tx_hash.to_0x_hex()}")
    return receipt["contractAddress"]


def receipt(reg: InvoiceRegistration) -> dict:
    return {"fingerprint": reg.fingerprint, "backend": reg.backend, "contract_address": reg.contract_address,
            "tx_hash": reg.tx_hash, "explorer_url": reg.explorer_url}


def check_on_chain(reg: InvoiceRegistration) -> dict:
    """Reads the registration back from the contract and compares it with our record."""
    out = {**receipt(reg), "receivable_id": reg.receivable_id, "financing": reg.financing, "on_chain": False}
    if reg.backend != "evm":
        return {**out, "reason": "registered in the local registry only"}
    w3, _ = _contract()
    chain = lookup_on_chain(reg.fingerprint)
    wallet = w3.eth.account.from_key(get_settings().evm_private_key).address if get_settings().evm_private_key else None
    matches = chain["registered"] and chain["financing"] == reg.financing[:32] and (wallet is None or chain["registrar"] == wallet)
    return {**out, "on_chain": chain["registered"], "chain": chain, "valid": bool(matches)}
