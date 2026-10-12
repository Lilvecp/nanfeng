"""Tiny PDF writer for the Cherry Crisis evidence: the 10:31 fake invoice as a real PDF.

The visible lines are black. The injected instruction is white on white (and 1 pt), so a person and
the OCR of the rendered page do not see it, while the PDF text layer still carries it. That gap is
the guard's `hidden-text` signal. No dependency: Helvetica is one of the 14 standard PDF fonts.
"""

from __future__ import annotations


def _esc(s: str) -> bytes:
    return s.encode("cp1252").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def make_pdf(visible: list[str], hidden: list[str] | None = None) -> bytes:
    ops = [b"BT /F1 12 Tf 14 TL 50 780 Td 0 0 0 rg"]
    for line in visible:
        ops.append(b"(" + _esc(line) + b") '")
    ops.append(b"ET")
    for i, line in enumerate(hidden or []):
        # White, 1 pt, low on the page: invisible when rendered, present in the text layer.
        ops.append(b"BT 1 1 1 rg /F1 1 Tf 50 %d Td (" % (60 - 2 * i) + _esc(line) + b") Tj ET")
    stream = b"\n".join(ops)
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for n, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return bytes(out)


def bec_invoice_pdf() -> bytes:
    from .fixtures import BEC_INVOICE_LAYER, BEC_INVOICE_OCR
    visible = BEC_INVOICE_OCR.strip().splitlines()
    hidden = BEC_INVOICE_LAYER[len(BEC_INVOICE_OCR):].strip().splitlines()
    return make_pdf(visible, hidden)
