"""Ingestion pipeline (r2-02 + r2-03), Andy's anti-injection design end to end:

    raw text → guard (/security/scan) → PII mask (/privacy/mask) → quarantined extraction
             → schema validation → payee check (/security/check-payee) → PlannerInput

The raw text stays inside this module. The planner gets `PlannerInput`: typed fields, verdicts and
provenance, never a sentence of the document.
"""

from __future__ import annotations

import itertools
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from . import quarantine
from .backend import Backend, BackendError
from .contacts import match_customer
from .router import ModelRouter

_ids = itertools.count(1)


@dataclass
class Document:
    """Transport metadata (sender, channel) is trusted: it comes from the Zavu webhook or mail headers,
    never from the body. The body is untrusted."""
    ocr_text: str
    source: str = "upload"  # whatsapp | email | sms | upload
    text_layer: str | None = None
    sender_domain: str = ""
    sender_phone: str = ""
    doc_id: str = field(default_factory=lambda: f"DOC-{datetime.now(timezone.utc):%H%M%S}-{next(_ids):03d}")


class Verdict(BaseModel):
    model_config = ConfigDict(extra="forbid")
    verdict: Literal["clean", "suspicious", "malicious", "skipped"]
    rules: list[str] = []
    payee_id: str | None = None
    verify_by: dict[str, str] | None = None


class PlannerInput(BaseModel):
    """Everything the planner may know about a document. Built only from typed values."""
    model_config = ConfigDict(extra="forbid")
    doc_id: str
    provenance: str
    fields: dict[str, Any]
    customer_id: str | None = None
    guard: Verdict
    payee_check: Verdict
    extraction: Literal["ok", "rejected", "skipped"]
    blocked: bool = False

    @property
    def flags(self) -> list[str]:
        return self.guard.rules + self.payee_check.rules


@dataclass
class IngestResult:
    planner_input: PlannerInput
    steps: list[dict[str, Any]]


def _check_payee(doc: Document, fields: dict[str, Any], backend: Backend, step) -> Verdict:
    t0 = time.monotonic()
    try:
        res = backend.post("/security/check-payee", {
            "doc_id": doc.doc_id, "source": doc.source, "issuer_name": fields.get("issuer_name", ""),
            "tax_id": fields.get("issuer_tax_id", ""), "sender_domain": doc.sender_domain,
            "bank_account": fields.get("bank_account", "")})
        payee = Verdict(verdict=res["verdict"], rules=res["rules"], payee_id=res.get("payee_id"),
                        verify_by=res.get("verify_by"))
    except BackendError as exc:
        payee = Verdict(verdict="suspicious", rules=[f"payee-check-unavailable-{exc.status}"])
    step("Payee check", "security.check_payee", t0, model="master data",
         detail=f"{payee.verdict} {payee.rules}".strip())
    return payee


def ingest(doc: Document, backend: Backend, router: ModelRouter | None = None) -> IngestResult:
    steps: list[dict[str, Any]] = []
    provenance = f"untrusted:{doc.source}"

    def step(name: str, tool: str, t0: float, **extra: Any) -> None:
        steps.append({"step": name, "tool": tool, "tier": 0, "latency_s": round(time.monotonic() - t0, 3),
                      "doc_id": doc.doc_id, **extra})

    # 1. Guard on the raw text, before any LLM reads it.
    t0 = time.monotonic()
    scan = backend.post("/security/scan", {"doc_id": doc.doc_id, "source": doc.source,
                                           "ocr_text": doc.ocr_text, "text_layer": doc.text_layer})
    guard = Verdict(verdict=scan["verdict"], rules=scan["rules"])
    step("Document guard", "security.scan", t0, model="guard", detail=f"{guard.verdict} {guard.rules}".strip())
    if guard.verdict == "malicious":
        # No LLM ever reads it. The deterministic extractor still pulls issuer and account so the payee
        # check can add its evidence (bank-change, domain-mismatch) and the call-back number on file.
        fields_doc, _ = quarantine.extract(doc.ocr_text, None)
        payee = _check_payee(doc, fields_doc.model_dump(mode="json", exclude_none=True) if fields_doc else {},
                             backend, step)
        pi = PlannerInput(doc_id=doc.doc_id, provenance=provenance, fields={}, guard=guard,
                          payee_check=payee, extraction="skipped", blocked=True)
        return IngestResult(pi, steps)

    # 2. Quarantined extraction on masked text (the provider never sees RUTs, phones, accounts).
    t0 = time.monotonic()
    text, mapping = doc.ocr_text, {}
    if router is not None and router.online:
        masked = backend.post("/privacy/mask", {"text": doc.ocr_text})
        text, mapping = masked["text"], masked["mapping"]
    fields_doc, meta = quarantine.extract(text, router, mapping)
    if fields_doc is None:
        guard = Verdict(verdict="suspicious", rules=guard.rules + ["extraction-rejected"])
        step("Quarantined extraction", "quarantine.extract", t0, model=meta.get("model", ""),
             cost_usd=meta.get("cost_usd", 0.0), detail="output failed the schema: nothing extracted")
        pi = PlannerInput(doc_id=doc.doc_id, provenance=provenance, fields={}, guard=guard,
                          payee_check=Verdict(verdict="skipped"), extraction="rejected")
        return IngestResult(pi, steps)
    fields = fields_doc.model_dump(mode="json", exclude_none=True)
    step("Quarantined extraction", "quarantine.extract", t0, model=meta.get("model", ""),
         cost_usd=meta.get("cost_usd", 0.0),
         detail=f"{fields.get('doc_type')} · {fields.get('currency', '')} {fields.get('amount', '')}".strip())

    # 3. Who is it from? Customers announce incoming money; anything else may ask us to pay.
    customer = match_customer(fields.get("issuer_name"))
    payee = Verdict(verdict="skipped")
    if customer is None or fields.get("bank_account"):
        payee = _check_payee(doc, fields, backend, step)

    pi = PlannerInput(doc_id=doc.doc_id, provenance=provenance, fields=fields,
                      customer_id=customer.id if customer else None, guard=guard, payee_check=payee,
                      extraction="ok", blocked=payee.verdict == "malicious")
    return IngestResult(pi, steps)
