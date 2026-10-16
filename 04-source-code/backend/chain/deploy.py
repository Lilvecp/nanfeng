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
from app.registry import deploy  # noqa: E402

if __name__ == "__main__":
    s = get_settings()
    if not s.evm_rpc_url or not s.evm_private_key:
        sys.exit("Set NANFENG_EVM_RPC_URL and NANFENG_EVM_PRIVATE_KEY first")
    address = deploy(anchoring.web3(), s.evm_private_key)
    print(f"InvoiceRegistry deployed at {address}")
    print("NANFENG_REGISTRY_BACKEND=evm")
    print(f"NANFENG_INVOICE_REGISTRY_ADDRESS={address}")
