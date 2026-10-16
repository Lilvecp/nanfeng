"""Compiles InvoiceRegistry.sol into app/data/invoice_registry.json (ABI + bytecode).

The compiled artifact is committed, so the backend never needs a compiler. Re-run only after
changing the contract:

    pip install py-solc-x
    python chain/compile.py

EVM version "london" (no PUSH0) keeps the bytecode deployable on Sepolia and on older EVM chains
such as FISCO BCOS.
"""

import json
from pathlib import Path

import solcx

SOLC = "0.8.26"
HERE = Path(__file__).parent
OUT = HERE.parent / "app" / "data" / "invoice_registry.json"


def main() -> None:
    solcx.install_solc(SOLC)
    out = solcx.compile_source((HERE / "InvoiceRegistry.sol").read_text(encoding="utf-8"),
                               output_values=["abi", "bin"], solc_version=SOLC,
                               evm_version="london", optimize=True, optimize_runs=200)
    contract = out["<stdin>:InvoiceRegistry"]
    OUT.write_text(json.dumps({"contract": "InvoiceRegistry", "solc": SOLC, "evm_version": "london",
                               "abi": contract["abi"], "bytecode": "0x" + contract["bin"]}, indent=1) + "\n",
                   encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
