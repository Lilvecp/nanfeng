from datetime import datetime, timedelta, timezone

from app.policy import POLICY, Executed, OpCheck, decide

NOW = datetime(2026, 10, 10, 15, 0, tzinfo=timezone.utc)
M = 1_000_000


def pay(amount: float, payee: str = "PAY-CARTONERA", allowlisted: bool = True) -> OpCheck:
    return OpCheck("payment", amount, payee, allowlisted)


def spent(amount: float, minutes_ago: float, tier: int = 2, payee: str | None = None) -> Executed:
    pays = ((payee, amount),) if payee else ()
    return Executed(NOW - timedelta(minutes=minutes_ago), tier, amount, pays)


# --- one request on its own -------------------------------------------------------------------

def test_tiers_by_amount():
    assert decide([pay(500_000)], [], NOW).tier == 1
    assert decide([pay(5 * M)], [], NOW).tier == 2
    d = decide([pay(30 * M)], [], NOW)
    assert d.tier == 3 and d.rules == ["l2_per_action"] and not d.blocked


def test_limits_match_the_settings_screen():
    t = POLICY["tiers"]
    assert (t["L2"]["per_action"], t["L2"]["per_month"]) == (25 * M, 80 * M)
    assert (t["L3"]["per_action"], t["L3"]["per_month"]) == (400 * M, 400 * M)


def test_financing_always_needs_the_owner():
    for op in ("factoring", "loan", "forward"):
        d = decide([OpCheck(op, 1000)], [], NOW)
        assert d.tier == 3 and d.rules == ["financing"]


def test_payee_off_the_allowlist_needs_the_owner():
    d = decide([pay(100_000, "PAY-NEW", allowlisted=False)], [], NOW)
    assert d.tier == 3 and d.rules == ["payee_not_allowlisted"] and "PAY-NEW" in d.reason


def test_operations_in_one_request_add_up():
    d = decide([pay(20 * M, "PAY-CARTONERA"), pay(20 * M, "PAY-FRIO")], [], NOW)
    assert d.tier == 3 and d.rules == ["request_total"]


def test_kill_switch_blocks_everything():
    d = decide([pay(1)], [], NOW, kill_switch=True)
    assert d.blocked and d.rules == ["kill_switch"]


def test_above_l3_hard_cap_is_blocked_not_pending():
    d = decide([OpCheck("loan", 401 * M)], [], NOW)
    assert d.blocked and "l3_per_action" in d.rules and "CLP 401,000,000" in d.reason


# --- cumulative limits --------------------------------------------------------------------------

def test_split_payments_to_one_payee_are_caught():
    """Red team case: CLP 45M to one supplier sent as three CLP 15M payments."""
    history = [spent(15 * M, 30, payee="PAY-CARTONERA")]
    d = decide([pay(15 * M)], history, NOW)
    assert d.tier == 3 and d.rules == ["structuring"]
    # a different payee is not structuring
    assert decide([pay(15 * M, "PAY-FRIO")], history, NOW).tier == 2


def test_third_small_payment_to_one_supplier_goes_to_owner():
    history: list[Executed] = []
    tiers = []
    for i in range(3):
        d = decide([pay(9 * M)], history, NOW)
        tiers.append(d.tier)
        history.append(spent(9 * M, 60 - i, payee="PAY-CARTONERA"))
    assert tiers == [2, 2, 3]


def test_structuring_window_is_24_hours():
    history = [spent(15 * M, 25 * 60, payee="PAY-CARTONERA")]
    assert decide([pay(15 * M)], history, NOW).tier == 2


def test_daily_limit_counts_only_what_the_agent_did_alone():
    history = [spent(20 * M, 60, payee="PAY-FRIO"), spent(15 * M, 120, payee="PAY-PAYROLL")]
    d = decide([pay(10 * M)], history, NOW)
    assert d.tier == 3 and d.rules == ["l2_per_day"]
    # owner-approved (L3) spend does not use the agent's budget
    owner = [spent(20 * M, 60, tier=3), spent(15 * M, 120, tier=3)]
    assert decide([pay(10 * M)], owner, NOW).tier == 2


def test_monthly_limit_uses_a_rolling_30_days():
    history = [spent(24 * M, d * 24 * 60, payee=f"PAY-{d}") for d in (2, 9, 16)]  # 72M in 30 days
    d = decide([pay(10 * M)], history, NOW)
    assert d.tier == 3 and d.rules == ["l2_per_month"]
    old = [spent(24 * M, d * 24 * 60, payee=f"PAY-{d}") for d in (31, 40, 50)]
    assert decide([pay(10 * M)], old, NOW).tier == 2


def test_velocity_limit():
    history = [spent(100_000, m) for m in (1, 2, 3, 4, 5)]
    d = decide([pay(100_000)], history, NOW)
    assert d.tier == 3 and d.rules == ["velocity"]
    assert decide([pay(100_000)], [spent(100_000, m) for m in (11, 12, 13, 14, 15)], NOW).tier == 1


def test_l3_monthly_cap_blocks():
    history = [spent(300 * M, 3 * 24 * 60, tier=3)]
    d = decide([OpCheck("factoring", 150 * M)], history, NOW)
    assert d.blocked and d.rules == ["financing", "l3_per_month"]


def test_reason_keeps_currency_case():
    assert decide([pay(30 * M)], [], NOW).reason.startswith("CLP 30,000,000 is above")


# --- through the API ----------------------------------------------------------------------------

def _pay(client, payee: str, amount: float) -> dict:
    return client.post("/approvals", json={"action": f"pay {payee}", "operations": [{
        "op": "payment", "params": {"payee_id": payee, "amount": amount}}]}).json()


def test_api_escalates_split_payment_and_logs_the_rule(client):
    first = _pay(client, "PAY-CARTONERA", 15 * M)
    assert first["status"] == "auto" and first["tier"] == 2
    second = _pay(client, "PAY-CARTONERA", 15 * M)
    assert second["status"] == "pending" and second["tier"] == 3
    assert "PAY-CARTONERA" in second["note"]

    logged = client.get("/audit/entries", params={"kind": "approval.created"}).json()
    assert logged[-1]["payload"]["policy_rules"] == ["structuring"]
    assert logged[-1]["payload"]["policy_version"] == POLICY["version"]


def test_api_payment_without_payee_is_not_allowlisted(client):
    r = client.post("/approvals", json={"action": "pay ?", "operations": [{
        "op": "payment", "params": {"amount": 100_000}}]}).json()
    assert r["tier"] == 3 and r["status"] == "pending"


def test_api_counts_concurrent_requests_against_the_daily_limit(client):
    from concurrent.futures import ThreadPoolExecutor

    payees = ["PAY-CARTONERA", "PAY-FRIO", "PAY-PAYROLL"]
    with ThreadPoolExecutor(3) as pool:
        out = list(pool.map(lambda p: _pay(client, p, 20 * M), payees))
    # CLP 40M per 24 h: two run alone, the third must wait for the owner
    assert sorted(r["status"] for r in out) == ["auto", "auto", "pending"]


def test_api_blocks_above_l3_hard_cap(client):
    r = _pay(client, "PAY-PAYROLL", 999 * M)
    assert r["status"] == "blocked" and r["tier"] == 3


def test_api_exposes_the_active_policy(client):
    p = client.get("/policy").json()
    assert p["tiers"]["L2"]["per_action"] == 25 * M and p["kill_switch"] is False
