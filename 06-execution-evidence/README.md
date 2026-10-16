# 06 · Execution evidence

Sandbox operation logs and the demo video (submission checklist item 06, for a topic that is not the on-chain one). The audit log is also anchored on the Sepolia testnet, so the evidence includes real transaction hashes.

| Folder or file | What |
|---|---|
| [out-live/](out-live/SUMMARY.md) | **Export from the deployed backend** (https://api.nanfengcfo.com): sandbox bank logs, audit entries with the hash-chain check, Merkle proofs and the Sepolia anchors. Start with `SUMMARY.md` |
| [out/](out/SUMMARY.md) | The Cherry Crisis run end to end against the backend in process (SMS OTP mode): the same files, plus `run.json` with every step |
| [build.py](build.py) | The exporter that writes both folders and re-checks the chain without the backend's code |
| [Demo video](../03-demo-video/nanfeng-demo.mp4) | The live run on video (deliverable 03) |

Export again, from the repository root:

```sh
cd 06-execution-evidence
../04-source-code/backend/.venv/bin/python build.py --backend ../04-source-code/backend          # in-process run -> out/
../04-source-code/backend/.venv/bin/python build.py --url https://api.nanfengcfo.com --out out-live   # live deploy -> out-live/
```

All data is synthetic; no real money moves.
