"""Download historical FX series used by the Monte Carlo bootstrap.

- USD/CLP "dólar observado" (Banco Central de Chile), via the public mirror
  https://mindicador.cl (the official BDE API needs registered credentials).
- USD/CNY spot (FRED series DEXCHUS, Board of Governors of the Federal Reserve).

Usage: python scripts/fetch_fx.py [--start-year 2010]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "fx"
MINDICADOR_URL = "https://mindicador.cl/api/dolar/{year}"
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXCHUS"
UA = {"User-Agent": "nanfeng-quant/0.1 (FinTechathon research)"}


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def fetch_usdclp(start_year: int) -> list[tuple[str, float]]:
    rows: dict[str, float] = {}
    for year in range(start_year, dt.date.today().year + 1):
        payload = json.loads(_get(MINDICADOR_URL.format(year=year)))
        for item in payload.get("serie", []):
            # Timestamps are midnight Chile time expressed in UTC (03:00/04:00Z).
            day = item["fecha"][:10]
            rows[day] = float(item["valor"])
    return sorted(rows.items())


def fetch_usdcny(start_year: int) -> list[tuple[str, float]]:
    text = _get(FRED_URL).decode("utf-8")
    reader = csv.reader(io.StringIO(text))
    next(reader)  # header: observation_date,DEXCHUS
    rows = []
    for day, value in reader:
        if int(day[:4]) < start_year or value in ("", "."):
            continue
        rows.append((day, float(value)))
    return rows


def write_csv(path: Path, header: tuple[str, str], rows: list[tuple[str, float]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2010)
    args = parser.parse_args()

    clp = fetch_usdclp(args.start_year)
    write_csv(DATA_DIR / "usdclp_observado.csv", ("date", "clp_per_usd"), clp)
    print(f"USD/CLP: {len(clp)} rows, {clp[0][0]} -> {clp[-1][0]}, last={clp[-1][1]}")

    cny = fetch_usdcny(args.start_year)
    write_csv(DATA_DIR / "usdcny_fred.csv", ("date", "cny_per_usd"), cny)
    print(f"USD/CNY: {len(cny)} rows, {cny[0][0]} -> {cny[-1][0]}, last={cny[-1][1]}")


if __name__ == "__main__":
    main()
