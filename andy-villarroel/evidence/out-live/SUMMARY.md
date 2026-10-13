# Execution evidence (deliverable 06)

Synthetic data in the NanFeng sandbox bank. Every line below is reproducible with `build.py`.

- Audit entries: **7**, hash chain valid: **True**
- Anchors: **1** (evm)
  - seq 1–6 root `09b1106994c6ded8…` tx https://sepolia.etherscan.io/tx/0x8b7839ee8c4fa86391f156d58378fb349489876d64f134eb35bebf7b4e11897b
- Merkle inclusion proofs for 3 key entries (approvals executed, attacks blocked): `proofs.json`

## Checked here, without the backend's code

- Hash chain recomputed from the published formula: **7/7** entries match
- Merkle proofs recomputed from leaf to anchored root: **3/3** valid
- Anchors read back from the chain: **1/1** match
  - anchor 1: valid=True https://sepolia.etherscan.io/tx/0x8b7839ee8c4fa86391f156d58378fb349489876d64f134eb35bebf7b4e11897b
- Tamper test: add CLP 1 to the loan in entry 5 and the recomputed chain breaks at seq **5**
- Invoice registry (evm): **0** invoices registered against double financing: `registry.json`

## Audit entries by kind

| Kind | Count |
|------|-------|
| `approval.approved` | 1 |
| `approval.created` | 1 |
| `audit.anchored` | 1 |
| `bank.loan` | 1 |
| `sandbox.seeded` | 1 |
| `security.attack_blocked` | 2 |

## The plan the owner approved is the plan the bank executed

- MILP plan (Vicente's engine): **CLP 2,106,329**
- Sandbox bank, `bank.loan` entry seq 5: **CLP 2,106,329** (interest 1,566,033 + fees 540,296)
- Runs under approval APR-0001, tier **L3** (the owner's code), executed **1** time(s): one decision per approval, even when two channels approve at once
