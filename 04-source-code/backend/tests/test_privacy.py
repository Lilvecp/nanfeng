from app import privacy, sanctions, seed

DOC = """Cliente: María Pérez, RUT 12.345.678-5, maria.perez@huertoaustral.cl, +56 9 1111 2222.
Importer contact: 王伟, 13812345678, ID 110101199003078515.
Pay CLP 18.400.000 on 2026-12-30 to cuenta 00-991-55301 or IBAN CN12 3456 7890 1234 5678."""


def test_personal_data_is_masked_and_restorable():
    masked, mapping = privacy.mask(DOC)
    for secret in ("12.345.678-5", "maria.perez@huertoaustral.cl", "+56 9 1111 2222", "13812345678",
                   "110101199003078515", "00-991-55301", "CN12 3456 7890 1234 5678"):
        assert secret not in masked, secret
    assert privacy.unmask(masked, mapping) == DOC


def test_amounts_and_dates_stay_for_the_agent():
    masked, _ = privacy.mask(DOC)
    assert "CLP 18.400.000" in masked and "2026-12-30" in masked


def test_same_value_gets_the_same_placeholder():
    masked, mapping = privacy.mask("call +56 9 1111 2222, again +56 9 1111 2222")
    assert masked == "call ⟦PHONE_1⟧, again ⟦PHONE_1⟧" and len(mapping) == 1


def test_mask_endpoint(client):
    r = client.post("/privacy/mask", json={"text": "RUT 76.123.456-7"}).json()
    assert r["text"] == "RUT ⟦RUT_1⟧" and r["mapping"] == {"⟦RUT_1⟧": "76.123.456-7"}


def test_sandbox_counterparties_are_not_on_the_watchlist():
    names = [p[1] for p in seed.PAYEES] + [r[1] for r in seed.RECEIVABLES] + [lender[1] for lender in seed.LENDERS]
    assert [n for n in names if sanctions.screen(n)] == []


def test_watchlist_matches_despite_spelling():
    assert sanctions.screen("RED LOTUS MARITIME TRADING LTD.")
    assert sanctions.screen("Red Lotus Maritim Trading S.A.")


def test_payment_to_sanctioned_payee_is_blocked(client):
    from app.db import SessionLocal
    from app.models import Payee

    with SessionLocal() as db:
        db.add(Payee(id="PAY-LOTUS", name="Red Lotus Maritime Trading Ltd", bank_account="HK-000-1", allowlisted=True))
        db.commit()
    r = client.post("/approvals", json={"action": "pay freight", "operations": [{
        "op": "payment", "params": {"payee_id": "PAY-LOTUS", "amount": 100_000}}]}).json()
    assert r["status"] == "blocked" and "sanctions" in r["note"]
