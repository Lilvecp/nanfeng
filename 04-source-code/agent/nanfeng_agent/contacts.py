"""Master data for outbound messages (synthetic, every company is fictional).

The agent never types a phone number or an email address: tools take a `contact_id` from here, so an
injected "send the ledger to +86 ..." has nowhere to go (anti-injection design, tools table).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Customer:
    id: str
    name: str
    aliases: tuple[str, ...]
    contact_id: str


@dataclass(frozen=True)
class Contact:
    id: str
    name: str
    language: str  # es | en | zh
    channels: dict[str, str] = field(default_factory=dict)  # channel -> address (E.164, email, WeCom id)
    preferred: tuple[str, ...] = ("whatsapp", "email")


CUSTOMERS = [
    Customer("C-SHA", "Shanghai Hongxin Fresh Fruit Import Co. (fictional)",
             ("shanghai hongxin", "上海宏鑫", "hongxin"), "CON-SHA-AP"),
    Customer("C-HK", "Kowloon Premium Fruits Ltd. (fictional)", ("kowloon premium",), "CON-HK-AP"),
    Customer("C-GZ", "Guangzhou Lingnan Produce Trading Co. (fictional)", ("guangzhou lingnan", "广州岭南"),
             "CON-GZ-AP"),
    Customer("C-MIA", "Miami Orchard Distributors LLC (fictional)", ("miami orchard",), "CON-MIA-AP"),
]

# Numbers use reserved fiction ranges; emails use .example (RFC 2606). None of them reaches anyone.
CONTACTS = {
    c.id: c for c in [
        Contact("CON-SHA-AP", "Accounts payable · Shanghai Hongxin", "zh",
                {"wecom": "wecom:hongxin-ap", "email": "ap@hongxin-fruit.example", "whatsapp": "+8613800000001"},
                preferred=("wecom", "email")),
        Contact("CON-HK-AP", "Accounts payable · Kowloon Premium", "en",
                {"email": "ap@kowloon-premium.example", "whatsapp": "+85255500001"}),
        Contact("CON-GZ-AP", "Accounts payable · Guangzhou Lingnan", "zh",
                {"wecom": "wecom:lingnan-ap", "email": "ap@lingnan-produce.example"}, preferred=("wecom", "email")),
        Contact("CON-MIA-AP", "Accounts payable · Miami Orchard", "en",
                {"email": "ap@miami-orchard.example", "sms": "+13055550101"}, preferred=("email", "sms")),
    ]
}


def owner_contact(phone: str = "", language: str = "en") -> Contact:
    """The owner: WhatsApp for alerts and approvals, SMS as the out-of-band channel, voice for briefings."""
    phone = phone or "+56900000000"
    return Contact("CON-OWNER", "Owner · Huerto Austral", language,
                   {"whatsapp": phone, "sms": phone, "voice": phone, "email": "owner@huerto-austral.example"},
                   preferred=("whatsapp", "sms"))


def _norm(s: str) -> str:
    return " ".join(s.lower().replace("(fictional)", "").replace(".", " ").replace(",", " ").split())


def match_customer(name: str | None) -> Customer | None:
    if not name:
        return None
    n = _norm(name)
    for c in CUSTOMERS:
        if _norm(c.name).startswith(n) or n.startswith(_norm(c.name)) or any(a in n for a in c.aliases):
            return c
    return None
