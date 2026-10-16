"""Business email compromise checks (r4-04, Andy).

Compares what a document claims (issuer, sender domain, bank account) with master data. A changed
account is the classic BEC fraud, so it blocks and asks for a call-back to the number ON FILE, never
to one in the document.
"""

import re
import unicodedata
from datetime import datetime, timezone
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Payee, PayeeAccount, PayeeProfile

# Customers (the importers that owe us). We never pay them, so there is no account on file to compare;
# what a late-payment notice can fake is the sender. Their notice can move the agent to borrow (a 45-day
# delay is a CLP 140M loan), so it must come from the domain on file. Same master data as the agent's
# contacts (agent/nanfeng_agent/contacts.py); every company and domain is fictional.
CUSTOMERS = [
    {"id": "C-SHA", "name": "Shanghai Hongxin Fresh Fruit Import Co.", "aliases": ("shanghai hongxin", "hongxin"),
     "email_domain": "hongxin-fruit.example"},
    {"id": "C-HK", "name": "Kowloon Premium Fruits Ltd.", "aliases": ("kowloon premium",),
     "email_domain": "kowloon-premium.example"},
    {"id": "C-GZ", "name": "Guangzhou Lingnan Produce Trading Co.", "aliases": ("guangzhou lingnan",),
     "email_domain": "lingnan-produce.example"},
    {"id": "C-MIA", "name": "Miami Orchard Distributors LLC", "aliases": ("miami orchard",),
     "email_domain": "miami-orchard.example"},
]

LEGAL_SUFFIX = re.compile(r"\b(spa|s\.?a\.?|ltda\.?|limitada|llc|ltd\.?|co\.?|inc\.?|eirl)\b|\(fictional\)")


def norm_account(acc: str) -> str:
    return re.sub(r"[\s\-./]", "", acc).upper()


def _words(name: str) -> str:
    n = unicodedata.normalize("NFKD", name.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", LEGAL_SUFFIX.sub(" ", n)).split())


def norm_tax_id(t: str) -> str:
    return re.sub(r"[^0-9Kk]", "", t).upper()


def _domain(d: str) -> str:
    d = d.strip().lower().rsplit("@", 1)[-1]
    return d.removeprefix("www.")


def lookalike(a: str, b: str) -> bool:
    """shanghaifresh.cn vs shanghaifresh-imports.co, frioaustral.cl vs fr1oaustral.cl."""
    la, lb = a.split(".")[0], b.split(".")[0]
    return la in lb or lb in la or SequenceMatcher(None, la, lb).ratio() >= 0.75


def match_payee(db: Session, issuer_name: str = "", tax_id: str = "") -> Payee | None:
    if tax_id:
        for prof in db.scalars(select(PayeeProfile)):
            if prof.tax_id and norm_tax_id(prof.tax_id) == norm_tax_id(tax_id):
                return db.get(Payee, prof.payee_id)
    if issuer_name:
        target = _words(issuer_name)
        best, score = None, 0.0
        for p in db.scalars(select(Payee)):
            s = SequenceMatcher(None, target, _words(p.name)).ratio()
            if s > score:
                best, score = p, s
        if score >= 0.8:
            return best
    return None


def match_customer(issuer_name: str) -> dict | None:
    target = _words(issuer_name)
    if not target:
        return None
    for c in CUSTOMERS:
        if any(a in target for a in c["aliases"]) or SequenceMatcher(None, target, _words(c["name"])).ratio() >= 0.8:
            return c
    return None


def _check_customer(customer: dict, sender_domain: str, bank_account: str) -> dict:
    """A customer's notice: the sender domain must be the one on file (look-alike = spoofed notice)."""
    rules: list[str] = []
    details: dict[str, str] = {"customer_id": customer["id"]}
    if bank_account:
        rules.append("unknown-payee")  # we never pay a customer: an account in their notice is not on file
    if sender_domain and _domain(sender_domain) != customer["email_domain"]:
        rules.append("domain-mismatch")
        details["domain_on_file"] = customer["email_domain"]
        details["domain_in_message"] = _domain(sender_domain)
        if lookalike(_domain(sender_domain), customer["email_domain"]):
            details["lookalike"] = "yes"
    verdict = "malicious" if details.get("lookalike") else ("suspicious" if rules else "clean")
    return {"verdict": verdict, "rules": rules, "payee_id": None, "details": details, "verify_by": None}


def _utc(ts: datetime) -> datetime:
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def account_changed_at(db: Session, payee_id: str) -> datetime | None:
    """When the payee's current account was set by a change (None if it is the original one)."""
    payee = db.get(Payee, payee_id)
    if not payee:
        return None
    latest = db.scalars(select(PayeeAccount).where(PayeeAccount.payee_id == payee_id)
                        .order_by(PayeeAccount.id.desc()).limit(1)).first()
    if not latest or latest.source == "seed" or norm_account(latest.bank_account) != norm_account(payee.bank_account):
        return None
    return _utc(latest.added_at)


def check_payee(db: Session, issuer_name: str = "", sender_domain: str = "", bank_account: str = "",
                tax_id: str = "") -> dict:
    rules: list[str] = []
    details: dict[str, str] = {}
    payee = match_payee(db, issuer_name, tax_id)
    if payee is None:
        if customer := match_customer(issuer_name):
            return _check_customer(customer, sender_domain, bank_account)
        rules.append("unknown-payee")
        return {"verdict": "suspicious", "rules": rules, "payee_id": None, "details": details, "verify_by": None}

    prof = db.get(PayeeProfile, payee.id)
    if bank_account and norm_account(bank_account) != norm_account(payee.bank_account):
        rules.append("bank-change")
        details["account_on_file"] = "•••• " + payee.bank_account[-4:]
        details["account_in_document"] = "•••• " + norm_account(bank_account)[-4:]
    if sender_domain and prof and prof.email_domain and _domain(sender_domain) != prof.email_domain:
        rules.append("domain-mismatch")
        details["domain_on_file"] = prof.email_domain
        details["domain_in_message"] = _domain(sender_domain)
        if lookalike(_domain(sender_domain), prof.email_domain):
            details["lookalike"] = "yes"

    verdict = "malicious" if "bank-change" in rules or details.get("lookalike") else (
        "suspicious" if rules else "clean")
    verify_by = {"call": prof.phone} if prof and prof.phone and verdict != "clean" else None
    return {"verdict": verdict, "rules": rules, "payee_id": payee.id, "details": details, "verify_by": verify_by}
