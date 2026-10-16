"""Document text (r2-02): Mistral OCR of the rendered pages plus the PDF text layer.

Two extractions on purpose: text that is in the layer but not in the OCR is invisible to a human
(white-on-white, 1 pt fonts). The guard compares both (`hidden-text`).
"""

from __future__ import annotations

import base64
import io

import httpx

MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr"


class OcrError(Exception):
    pass


def text_layer(pdf: bytes) -> str | None:
    try:
        from pypdf import PdfReader
    except ImportError:  # optional dependency: the guard still has the OCR
        return None
    try:
        return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf)).pages)
    except Exception:
        return None


def mistral_ocr(data: bytes, mime: str, api_key: str, client: httpx.Client | None = None) -> str:
    url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
    document = ({"type": "image_url", "image_url": url} if mime.startswith("image/")
                else {"type": "document_url", "document_url": url})
    c = client or httpx.Client(timeout=120)
    try:
        r = c.post(MISTRAL_OCR_URL, json={"model": "mistral-ocr-latest", "document": document},
                   headers={"Authorization": f"Bearer {api_key}"})
        r.raise_for_status()
        return "\n\n".join(p.get("markdown", "") for p in r.json().get("pages", []))
    except (httpx.HTTPError, ValueError) as exc:
        raise OcrError(exc.__class__.__name__) from exc


def read_file(data: bytes, mime: str, api_key: str = "") -> tuple[str, str | None]:
    """Returns (ocr_text, text_layer). Offline, plain text files are read as-is and PDFs fall back to
    their text layer (no hidden-text check possible then, the guard still runs every other rule)."""
    layer = text_layer(data) if mime == "application/pdf" else None
    if api_key and (mime == "application/pdf" or mime.startswith("image/")):
        return mistral_ocr(data, mime, api_key), layer
    if mime.startswith("text/"):
        return data.decode("utf-8", errors="replace"), None
    if layer is not None:
        return layer, None
    raise OcrError(f"cannot read {mime} without MISTRAL_API_KEY")
