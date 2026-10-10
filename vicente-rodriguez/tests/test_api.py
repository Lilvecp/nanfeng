import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402

from nanfeng_quant.api import app  # noqa: E402

client = TestClient(app)


def test_health_and_scenarios():
    assert client.get("/quant/health").json()["status"] == "ok"
    assert "cherry_crisis" in client.get("/quant/scenarios").json()


def test_forecast_endpoint():
    r = client.post("/quant/forecast", json={"scenario": "cherry_crisis", "n_paths": 2000, "explain": False,
                                             "overrides": {"cny_shift_pct": -5}})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["crunch_date"] == "2026-12-30"
    assert len(body["fan_chart"]["p10"]) == 91


def test_quote_and_passport_endpoints():
    q = client.post("/quant/quote", json={"scenario": "cherry_crisis"}).json()
    assert any(row["product_id"] == "FACT-BANK" for row in q["quotes"])
    p = client.post("/quant/passport", json={"scenario": "cherry_crisis", "consent": True}).json()
    assert p["grade"] in "ABCDE" and len(p["digest_sha256"]) == 64


def test_errors_and_demo():
    assert client.post("/quant/forecast", json={"scenario": "nope"}).status_code == 404
    assert client.post("/quant/forecast", json={"overrides": {"bad_knob": 1}}).status_code == 422
    assert "optimal" in client.get("/quant/demo/plan").json()
    assert "properties" in client.get("/quant/schema/scenario").json()


def test_integration_endpoints():
    seed = client.get("/quant/sandbox/seed").json()
    assert seed["accounts"][0]["balance"] > 0 and any(l["id"] == "LEN-FACTOR" for l in seed["lenders"])
    specs = client.get("/quant/tools").json()
    assert {s["function"]["name"] for s in specs} >= {"forecast_run", "optimize_plan"}
    story = client.get("/quant/demo/story").json()
    assert story["forecast_after"]["crunch_date"] == "2026-12-30"
