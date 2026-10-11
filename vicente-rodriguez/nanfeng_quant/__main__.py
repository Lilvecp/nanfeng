"""Command line: python -m nanfeng_quant <command> [options]

  forecast  [scenario] [--overrides JSON]   Monte Carlo summary + drivers
  quote     [scenario] [--amount CLP]       Financing Arena quotes
  optimize  [scenario] [--confidence 0.9]   MILP plan vs. default loan + explanation
  passport  [scenario] [--consent]          Credit Passport
  generate                                  Regenerate the 50 synthetic SMEs
  bench     [--limit N]                     Run NanFeng-Bench (writes results/)
  backtest                                  Run forecast backtests (writes results/)
  sensitivity                               Plan sensitivity to confidence, rates, forward spread
  demo                                      Recompute every results/cherry_crisis_* file
  story                                     Rebuild cherry_crisis_story.json from saved results (no solve)
"""
from __future__ import annotations

import argparse
import json
import sys

from . import tools


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="nanfeng_quant", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["forecast", "quote", "optimize", "passport", "generate", "bench", "backtest", "sensitivity", "demo", "story"])
    ap.add_argument("scenario", nargs="?", default="cherry_crisis")
    ap.add_argument("--overrides", type=json.loads, default=None)
    ap.add_argument("--amount", type=float, default=None)
    ap.add_argument("--confidence", type=float, default=0.90)
    ap.add_argument("--consent", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):  # JSON is UTF-8 everywhere (Windows consoles default to cp1252)
        sys.stdout.reconfigure(encoding="utf-8")

    if args.command == "forecast":
        out = tools.forecast_run(args.scenario, args.overrides, seed=args.seed)
        out.pop("fan_chart")
    elif args.command == "quote":
        out = tools.financing_quote(args.scenario, args.amount, overrides=args.overrides, seed=args.seed)
    elif args.command == "optimize":
        out = tools.optimize_plan(args.scenario, args.confidence, args.overrides, seed=args.seed)
    elif args.command == "passport":
        out = tools.credit_passport(args.scenario, consent=args.consent, seed=args.seed)
    elif args.command == "generate":
        from .synthetic import main as gen
        gen()
        return
    elif args.command == "bench":
        from .bench import run
        out = run(limit=args.limit)
    elif args.command == "backtest":
        from .backtest import run
        out = run()
    elif args.command == "sensitivity":
        from .sensitivity import run
        out = run(args.scenario)
    elif args.command == "story":
        from .demo import rebuild_story
        out = rebuild_story()
    else:
        from .demo import run
        out = run()
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
