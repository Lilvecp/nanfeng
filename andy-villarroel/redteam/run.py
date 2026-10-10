"""Run the red team against a backend checkout, in process.

    python run.py --backend ../../backend --label after  [--otp-mode sms]

Writes results/<label>.json. `report.py` turns before/after into the markdown report.
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
AGENT_TOKEN = "redteam-agent-token"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--otp-mode", default="sms")
    ap.add_argument("--ref", default="", help="git ref of the backend, for the record")
    ap.add_argument("--min-stopped", type=int, default=0, help="exit 1 below this (CI regression gate)")
    args = ap.parse_args()

    backend = Path(args.backend).resolve()
    work = Path(tempfile.mkdtemp())
    os.chdir(work)  # no developer .env gets picked up
    os.environ.update({
        "NANFENG_DATABASE_URL": f"sqlite:///{work / 'redteam.db'}",
        "NANFENG_AGENT_TOKEN": AGENT_TOKEN,
        "NANFENG_ANCHOR_BACKEND": "local",
        "NANFENG_QUANT_URL": "http://127.0.0.1:9",
        "NANFENG_OTP_MODE": args.otp_mode,
        "NANFENG_OTP_RESEND_AFTER_S": "0",
        "NANFENG_OWNER_PHONE": "+56911112222",
        "NANFENG_ZAVU_API_KEY": "zv_redteam_dummy",
    })
    sys.path[:0] = [str(backend), str(HERE)]

    from fastapi.testclient import TestClient

    from app import seed
    from app.db import SessionLocal
    from app.main import app
    from app.routers import approvals

    outbox: list[str] = []
    try:  # the SMS gateway is replaced by an outbox the "owner" reads
        from app import otp
        otp.send_sms = lambda to, text: outbox.append(text) or "msg_redteam"
    except ImportError:
        pass

    import attacks

    results = []
    with TestClient(app) as client:
        for atk in attacks.ATTACKS:
            with SessionLocal() as db:
                seed.reset(db)
            approvals._kill_switch["on"] = False
            outbox.clear()
            try:
                stopped, evidence = atk.fn(attacks.Ctx(client, outbox, AGENT_TOKEN))
            except Exception as exc:  # an attack that crashes the harness is reported, never hidden
                stopped, evidence = False, f"harness error: {exc.__class__.__name__}: {exc}"
            results.append({"id": atk.id, "category": atk.category, "name": atk.name,
                            "stopped": bool(stopped), "evidence": evidence})

    out = HERE / "results" / f"{args.label}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"label": args.label, "ref": args.ref, "otp_mode": args.otp_mode,
                               "results": results}, indent=2, ensure_ascii=False) + "\n")
    n = sum(r["stopped"] for r in results)
    print(f"{args.label}: {n}/{len(results)} attacks stopped -> {out.relative_to(HERE)}")
    for r in results:
        if not r["stopped"]:
            print(f"  open: {r['id']} {r['name']} | {r['evidence']}")
    if n < args.min_stopped:
        sys.exit(f"red team regression: {n} stopped, expected at least {args.min_stopped}")


if __name__ == "__main__":
    main()
