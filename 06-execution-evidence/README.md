# 06 · Execution evidence

Sandbox operation logs and the demo video (submission checklist item 06, for a topic that is not the on-chain one). The audit log is also anchored on the Sepolia testnet, so the evidence includes real transaction hashes.

| Folder or file | What |
|---|---|
| **[NanFeng-Execution-Evidence.pdf](NanFeng-Execution-Evidence.pdf)** | This README and both run summaries in one PDF (built with `07-team-workspace/pdf-build`) |
| [out-live/](out-live/SUMMARY.md) | **Run A (live deploy)**: a real run on the deploy (https://api.nanfengcfo.com, Oct 16): the importer's PDF handed to the deployed agent and its step-by-step trace (`agent_run.json`), the owner approving the plan it proposed, one invoice registered on Sepolia and refused the second time, then the export: sandbox bank logs, audit entries with the hash-chain check, Merkle proofs and the Sepolia anchors read back. Start with `SUMMARY.md` |
| [out/](out/SUMMARY.md) | **Run B (in-process)**: the Cherry Crisis run end to end against the backend in process (SMS OTP mode): the same files, plus `run.json` with every step |
| [build.py](build.py) | The exporter that writes both folders and re-checks the chain without the backend's code |
| [Demo video](../03-demo-video/nanfeng-demo.mp4) | The live run on video, 3:45 (deliverable 03) |

Export again, from the repository root:

```sh
cd 06-execution-evidence
../04-source-code/backend/.venv/bin/python build.py --backend ../04-source-code/backend          # in-process run -> out/
../04-source-code/backend/.venv/bin/python build.py --url https://api.nanfengcfo.com --run-otp 482913 \
    --agent-url https://agent-production-cde7.up.railway.app --out out-live   # live deploy -> out-live/
```

`--agent-url` first sends the importer's late-payment notice (`04-source-code/web/public/samples/hongxin-payment-notice.pdf`) to the deployed agent service as the owner, and keeps the run's trace. `--run-otp` then plays the owner's side on the deploy: the agent's plan approved with the sandbox code, half of INV-2026-109 factored after its fingerprint is registered on Sepolia, the same invoice refused as already financed, and a final anchor; without it, `--url` only exports. It sends Sepolia transactions from the anchoring wallet and needs the sandbox in its opening state. Run it after a deploy that has threat-model fixes F15 and F16.

**The live chain keeps growing after this run.** Every visitor of the public demo shares one sandbox, so the backend resets it 30 minutes after the last activity (`04-source-code/backend/app/autoreset.py`, `NANFENG_SANDBOX_IDLE_RESET_S=1800`) and the next visitor starts at 10:13 of the crisis. The reset reseeds the bank but keeps the audit chain and its anchors (threat model F18): each reset opens a new epoch with a `sandbox.seeded` entry, so every entry in `out-live/` stays in the live chain, with the same hash, and `GET /audit/verify` keeps checking it. Every anchor and registration is also a Sepolia transaction; `anchors_on_chain.json` reads each one back. Check them on Etherscan, or follow the [anchoring wallet](https://sepolia.etherscan.io/address/0x91c0BDBe160E39D6c561B1b9E7EB12c2d391Eb77).

**The owner's notices in `out-live/` show `email · failed`.** That is real: the public demo's owner is fictional (a placeholder phone and `owner@huerto-austral.example`, a reserved domain no mail server accepts) and the team's Zavu key is a test key that only reaches team phones on WhatsApp. The agent tried WhatsApp, SMS and email through the real Zavu API, every channel refused it, and the last attempt is what the trace shows. Nothing depended on it: the plan waited in Approvals, where the owner approved it. The Status column says the step ran; the Result column shows what happened to the delivery. See the [technical documentation, known limitations](../01-technical-documentation/technical-documentation.md#7-known-limitations).

All data is synthetic; no real money moves.
