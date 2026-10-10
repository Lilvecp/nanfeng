"""EVM anchoring against an in-memory chain (eth-tester): same code path as Sepolia, no network."""

import pytest
from eth_account import Account
from web3 import Web3
from web3.providers.eth_tester import EthereumTesterProvider

from app import anchoring
from app.config import get_settings

PLAN = {"action": "factoring + CNY forward", "operations": [
    {"op": "factoring", "params": {"receivable_id": "INV-2026-118", "share": 0.6667}},
    {"op": "forward", "params": {"currency": "CNY", "notional": 1_200_000, "tenor_days": 60}},
]}


@pytest.fixture()
def chain(monkeypatch):
    w3 = Web3(EthereumTesterProvider())
    wallet = Account.create()
    w3.eth.send_transaction({"from": w3.eth.accounts[0], "to": wallet.address, "value": w3.to_wei(1, "ether")})
    settings = get_settings()
    monkeypatch.setattr(settings, "anchor_backend", "evm")
    monkeypatch.setattr(settings, "evm_private_key", wallet.key.hex())
    anchoring.set_web3(w3)
    yield w3
    anchoring.set_web3(None)


def approve_plan(client):
    a = client.post("/approvals", json=PLAN).json()
    return client.post(f"/approvals/{a['id']}/approve", json={"otp": "482913"}).json()


def test_calldata_round_trip():
    root = "ab" * 32
    assert anchoring.decode(anchoring.encode(root, 3, 41)) == {"merkle_root": root, "from_seq": 3, "to_seq": 41}
    assert anchoring.decode(b"something else") is None


def test_approval_is_anchored_on_chain(client, chain):
    assert approve_plan(client)["status"] == "approved"
    [anchor] = client.get("/audit/anchors").json()
    assert anchor["backend"] == "evm" and anchor["tx_hash"].startswith("0x")
    assert anchor["explorer_url"].endswith(anchor["tx_hash"])

    check = client.get(f"/audit/anchors/{anchor['id']}/chain").json()
    assert check["valid"] is True and check["calldata_matches"] is True
    assert check["decoded"]["merkle_root"] == anchor["merkle_root"]

    wallet = client.get("/audit/anchor-wallet").json()
    assert wallet["backend"] == "evm" and 0 < wallet["balance_eth"] < 1  # gas was paid


def test_tampered_record_no_longer_matches_chain(client, chain):
    from app.db import SessionLocal
    from app.models import Anchor

    approve_plan(client)
    with SessionLocal() as db:
        a = db.get(Anchor, 1)
        a.merkle_root = "00" * 32
        db.commit()
    check = client.get("/audit/anchors/1/chain").json()
    assert check["confirmed"] is True and check["calldata_matches"] is False and check["valid"] is False


def test_chain_failure_does_not_undo_the_approval(client, chain, monkeypatch):
    monkeypatch.setattr(get_settings(), "evm_private_key", Account.create().key.hex())  # no funds
    done = approve_plan(client)
    assert done["status"] == "approved" and len(done["results"]) == 2
    assert client.get("/audit/anchors").json() == []
    assert client.post("/audit/anchor").status_code == 502
    types = [e["type"] for e in client.get("/agent/events/recent").json()]
    assert "audit.anchor_failed" in types
