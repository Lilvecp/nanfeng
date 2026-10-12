"""Deploys the InvoiceRegistry contract with the anchoring wallet and prints its address.

    cd backend
    NANFENG_EVM_RPC_URL=https://... NANFENG_EVM_PRIVATE_KEY=0x... python chain/deploy.py

Then set NANFENG_REGISTRY_BACKEND=evm and NANFENG_INVOICE_REGISTRY_ADDRESS=<address>.
Testnet wallets only: the key never holds real funds.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import anchoring  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.registry import ARTIFACT  # noqa: E402


def deploy(w3, private_key: str) -> str:
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


if __name__ == "__main__":
    s = get_settings()
    if not s.evm_rpc_url or not s.evm_private_key:
        sys.exit("Set NANFENG_EVM_RPC_URL and NANFENG_EVM_PRIVATE_KEY first")
    address = deploy(anchoring.web3(), s.evm_private_key)
    print(f"InvoiceRegistry deployed at {address}")
    print(f"NANFENG_REGISTRY_BACKEND=evm\nNANFENG_INVOICE_REGISTRY_ADDRESS={address}")
