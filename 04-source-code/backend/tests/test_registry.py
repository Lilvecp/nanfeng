"""Invoice registry against double financing (r3-06), locally and on an in-memory EVM chain (eth-tester)."""

import pytest

from app import anchoring, registry
from app.config import get_settings
from app.db import SessionLocal

FACTOR = {"action": "factoring INV-2026-118", "operations": [
    {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.5}}]}
FACTOR_AGAIN = {"action": "factor it again elsewhere", "operations": [
    {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "lender_id": "LEN-FINTECH", "share": 0.5}}]}


def run(client, plan):
    a = client.post("/approvals", json=plan).json()
    return client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()


def test_fingerprint_hides_the_invoice_and_changes_with_the_issuer(client, monkeypatch):
    with SessionLocal() as db:
        fp = registry.fingerprint(db, "INV-2026-118")
        assert fp.startswith("0x") and len(fp) == 66 and "INV" not in fp
        assert registry.fingerprint(db, "INV-2026-118") == fp != registry.fingerprint(db, "INV-2026-119")
        monkeypatch.setattr(get_settings(), "issuer_tax_id", "77.777.777-7")
        assert registry.fingerprint(db, "INV-2026-118") != fp


def test_local_registry_records_the_factoring_and_refuses_a_second_one(client):
    done = run(client, FACTOR)
    assert done["status"] == "approved"
    receipt = done["results"][0]["registry"]
    assert receipt["backend"] == "local" and receipt["tx_hash"] is None

    [row] = client.get("/registry/invoices").json()
    assert row["receivable_id"] == "INV-2026-118" and row["financing"] == "LEN-FACTOR:factoring"
    status = client.get("/registry/invoices/INV-2026-118").json()
    assert status["registered"] is True and status["fingerprint"] == receipt["fingerprint"]
    assert client.get("/registry/invoices/INV-2026-121").json()["registered"] is False

    again = run(client, FACTOR_AGAIN)
    assert again["status"] == "failed" and "already_financed" in again["note"]


def test_demo_reset_starts_a_fresh_registry(client):
    with SessionLocal() as db:
        before = registry.fingerprint(db, "INV-2026-118")
    assert client.post("/bank/reset").status_code == 200
    with SessionLocal() as db:
        assert registry.fingerprint(db, "INV-2026-118") != before


@pytest.fixture()
def chain(monkeypatch):
    from eth_account import Account
    from web3 import Web3
    from web3.providers.eth_tester import EthereumTesterProvider

    w3 = Web3(EthereumTesterProvider())
    wallet = Account.create()
    w3.eth.send_transaction({"from": w3.eth.accounts[0], "to": wallet.address, "value": w3.to_wei(1, "ether")})
    anchoring.set_web3(w3)
    address = registry.deploy(w3, wallet.key.hex())
    s = get_settings()
    monkeypatch.setattr(s, "registry_backend", "evm")
    monkeypatch.setattr(s, "invoice_registry_address", address)
    monkeypatch.setattr(s, "evm_private_key", wallet.key.hex())
    yield w3
    anchoring.set_web3(None)


def test_factoring_registers_the_invoice_on_chain(client, chain):
    done = run(client, FACTOR)
    assert done["status"] == "approved"
    receipt = done["results"][0]["registry"]
    assert receipt["backend"] == "evm" and receipt["tx_hash"].startswith("0x")
    assert chain.eth.get_transaction_receipt(receipt["tx_hash"])["status"] == 1

    status = client.get("/registry/invoices/INV-2026-118").json()
    assert status["on_chain"] is True and status["valid"] is True
    assert status["chain"]["financing"] == "LEN-FACTOR:factoring"
    assert client.get("/registry").json()["chain_id"] == chain.eth.chain_id


def test_invoice_financed_elsewhere_is_refused_before_any_money_moves(client, chain):
    """Another financier registered the invoice on-chain: our DB knows nothing, the chain does."""
    from eth_account import Account

    other = Account.create()
    chain.eth.send_transaction({"from": chain.eth.accounts[0], "to": other.address, "value": chain.to_wei(1, "ether")})
    with SessionLocal() as db:
        fp = registry.fingerprint(db, "INV-2026-118")
    contract = chain.eth.contract(address=get_settings().invoice_registry_address, abi=registry.ARTIFACT["abi"])
    tx = contract.functions.register(bytes.fromhex(fp[2:]), registry._label("OTHER-BANK:factoring")).build_transaction({
        "from": other.address, "nonce": 0, "chainId": chain.eth.chain_id})
    chain.eth.send_raw_transaction(other.sign_transaction(tx).raw_transaction)

    status = client.get("/registry/invoices/INV-2026-118").json()
    assert status["registered"] is True and status["chain"]["registrar"] == other.address

    balance = next(a["balance"] for a in client.get("/bank/accounts").json() if a["id"] == "ACC-CLP")
    done = run(client, FACTOR)
    assert done["status"] == "failed" and "already_financed" in done["note"] and "OTHER-BANK" in done["note"]
    assert next(a["balance"] for a in client.get("/bank/accounts").json() if a["id"] == "ACC-CLP") == balance
    assert client.get("/registry/invoices").json() == []


def test_unreachable_registry_fails_closed(client, chain, monkeypatch):
    monkeypatch.setattr(get_settings(), "invoice_registry_address", "0x" + "00" * 19 + "01")  # no contract there
    done = run(client, FACTOR)
    assert done["status"] == "failed" and "registry_unavailable" in done["note"]
    assert all(r["financed_by"] is None for r in client.get("/bank/receivables").json())
