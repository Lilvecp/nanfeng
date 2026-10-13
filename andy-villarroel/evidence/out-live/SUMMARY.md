# Execution evidence (deliverable 06)

Synthetic data in the NanFeng sandbox bank. Every line below is reproducible with `build.py`.

- Audit entries: **5**, hash chain valid: **True**
- Anchors: **1** (evm)
  - seq 1–4 root `2ed8fb22eeec8afe…` tx https://sepolia.etherscan.io/tx/0x67b483e523eb4543b4642bd6a973d4ff86992a63571b4c1fa17002c275547f6a
- Merkle inclusion proofs for 1 key entries (approvals executed, attacks blocked): `proofs.json`

## Checked here, without the backend's code

- Hash chain recomputed from the published formula: **5/5** entries match
- Merkle proofs recomputed from leaf to anchored root: **1/1** valid
- Anchors read back from the chain: **1/1** match
  - anchor 1: valid=True https://sepolia.etherscan.io/tx/0x67b483e523eb4543b4642bd6a973d4ff86992a63571b4c1fa17002c275547f6a
- Tamper test: add CLP 1 to the loan in entry 3 and the recomputed chain breaks at seq **3**
- Invoice registry (evm): **0** invoices registered against double financing: `registry.json`

## Audit entries by kind

| Kind | Count |
|------|-------|
| `approval.approved` | 1 |
| `approval.created` | 1 |
| `audit.anchored` | 1 |
| `bank.loan` | 1 |
| `sandbox.seeded` | 1 |

## The plan the owner approved is the plan the bank executed

- MILP plan (Vicente's engine): **CLP 2,106,329**
- Sandbox bank, `bank.loan` entry seq 3: **CLP 2,106,329** (interest 1,566,033 + fees 540,296)
