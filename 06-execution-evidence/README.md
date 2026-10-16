# 06 · Execution evidence

Sandbox operation logs and the demo video (submission checklist item 06, for a topic that is not the on-chain one). The audit log is also anchored on the Sepolia testnet, so the evidence includes real transaction hashes.

| Folder or file | What |
|---|---|
| [out-live/](out-live/SUMMARY.md) | **Export from the deployed backend** (https://api.nanfengcfo.com, Oct 12): sandbox bank logs, audit entries with the hash-chain check, Merkle proofs and the Sepolia anchors. Start with `SUMMARY.md` |
| [out/](out/SUMMARY.md) | The Cherry Crisis run end to end against the backend in process (SMS OTP mode): the same files, plus `run.json` with every step |
| [build.py](build.py) | The exporter that writes both folders and re-checks the chain without the backend's code |
| [Demo video](../03-demo-video/nanfeng-demo.mp4) | The live run on video, 3:04 (deliverable 03) |

Export again, from the repository root:

```sh
cd 06-execution-evidence
../04-source-code/backend/.venv/bin/python build.py --backend ../04-source-code/backend          # in-process run -> out/
../04-source-code/backend/.venv/bin/python build.py --url https://api.nanfengcfo.com --run-otp 482913 --out out-live   # live deploy -> out-live/
```

`--run-otp` first plays the owner's side on the deploy: the agent's plan approved with the sandbox code, half of INV-2026-109 factored after its fingerprint is registered on Sepolia, the same invoice refused as already financed, and a final anchor; without it, `--url` only exports. It sends Sepolia transactions from the anchoring wallet and needs the sandbox in its opening state. Run it after a deploy that has threat-model fixes F15 and F16.

**Why the live API may show fewer entries than `out-live/`.** Every visitor of the public demo shares one sandbox, so the backend resets it 30 minutes after the last activity (`04-source-code/backend/app/autoreset.py`, `NANFENG_SANDBOX_IDLE_RESET_S=1800`): the next visitor starts at 10:13 of the crisis, with the opening entries only (seeding, the blocked 08:47 attack, the agent's pending plan and their anchor). `out-live/` is the record of one run; what cannot change is on chain: every anchor and registration in it is a Sepolia transaction, and `anchors_on_chain.json` reads each one back. Check them on Etherscan, or follow the [anchoring wallet](https://sepolia.etherscan.io/address/0x91c0BDBe160E39D6c561B1b9E7EB12c2d391Eb77).

All data is synthetic; no real money moves.
