"""Document guard (r4-03 / r4-04, Andy): deterministic checks on the raw text of a document before
any LLM reads it. Rule ids are the ones the Security Console shows.

The guard is one layer. It can miss things; the policy engine and the OTP do not depend on it.
"""

import base64
import binascii
import re
import unicodedata

INVISIBLE = re.compile("[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\U000e0000-\U000e007f]")

# Text addressed to an AI or an operator rather than to the business reader. ES / EN / 中文.
INSTRUCTION = [re.compile(p, re.IGNORECASE) for p in (
    r"\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instructions?|rules?|prompts?|messages?)",
    r"\b(ignora|olvida|omite)\w*\b.{0,40}\b(instrucci[oó]n\w*|reglas?|indicaciones)",
    r"\byou are (now|no longer)\b|\bact as\b|\bfrom now on\b",
    r"\bahora eres\b|\bact[uú]a como\b|\ba partir de ahora\b",
    r"\b(system|developer)\s*(prompt|message|instructions?)\b|<\s*/?\s*(system|assistant|instructions?)\s*>",
    r"\bprompt del sistema\b|\bmensaje del sistema\b",
    r"\b(approve|authori[sz]e|execute|release|transfer|pay)\b.{0,30}\bwithout (the )?(owner'?s? )?(approval|confirmation|otp|asking|verification)",
    r"\b(aprueba|autoriza|ejecuta|transfiere|paga)\w*\b.{0,30}\bsin (la )?(aprobaci[oó]n|confirmaci[oó]n|otp|preguntar|verificaci[oó]n)",
    r"\b(do not|don't|never)\b.{0,20}\b(tell|notify|inform|alert|ask)\b.{0,20}\b(owner|user|anyone|human)",
    r"\bno (le )?(avises|informes|notifiques|digas)\b",
    r"(?i:\bassistant\b|\bagent\b|\bai\b|\bllm\b|\bnanfeng\b)\s*[:,]\s*(please\s+)?(ignore|approve|pay|send|transfer|update)",
    r"\b(send|forward|e-?mail|share|upload)\b.{0,40}\b(ledger|statements?|balances?|transactions|passwords?|otp|codes?|api keys?)\b.{0,40}\bto\b",
    r"\b(env[ií][ae]|reenv[ií][ae]|compart[ae]|mand[ae])\w*\b.{0,40}\b(cartolas?|saldos?|movimientos|contrase[nñ]as?|c[oó]digos?|otp)\b.{0,40}\ba\b",
    r"忽略.{0,10}(之前|以上|先前|所有).{0,10}(指令|指示|规则|提示)",
    r"(系统|系統)(提示|指令)|你现在是|无需(批准|确认)|不要(告诉|通知)",
)]

URGENCY = [re.compile(p, re.IGNORECASE) for p in (
    r"\burgent(ly)?\b|\bimmediately\b|\bconfidential\b|\bdo not call\b|\bnew (bank|account) details\b",
    r"\burgente\b|\bconfidencial\b|\bno (llame|llamar)\b|\bnueva cuenta\b|\bcambio de cuenta\b",
    r"紧急|保密|立即(付款|转账)|新(的)?(银行)?账户|更改.{0,4}账户",
)]

PAYMENT_DETAIL = re.compile(
    r"\b(iban|swift|bic|account|cuenta|cta\.?|beneficiar\w*|routing)\b|账户|账号|收款人|\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b",
    re.IGNORECASE,
)
BASE64 = re.compile(r"[A-Za-z0-9+/]{80,}={0,2}")
B64_CHUNK = re.compile(r"[A-Za-z0-9+/]{16,}={0,2}")
SENTENCE = re.compile(r"[A-Za-z]{3,}[ ,.:;]+[A-Za-z]{2,}[ ,.:;]+[A-Za-z]{2,}|[\u4e00-\u9fff]{4,}")
HEX = re.compile(r"\b[0-9a-fA-F]{64,}\b")
WORD = re.compile(r"[^\W\d_]{4,}", re.UNICODE)


def normalize(text: str) -> str:
    """NFKC + drop invisible characters, so "ign\u200bore" or full-width letters still match."""
    return INVISIBLE.sub("", unicodedata.normalize("NFKC", text))


def _snippet(text: str, m: re.Match, pad: int = 30) -> str:
    return text[max(0, m.start() - pad): m.end() + pad].replace("\n", " ")[:160]


def hidden_words(ocr_text: str, text_layer: str) -> list[str]:
    """Longest run of consecutive words in the PDF text layer that the OCR of the rendered page never
    saw (white-on-white, 1 pt fonts, text off the page). OCR noise is scattered; hidden text is a run."""
    seen = {w.lower() for w in WORD.findall(normalize(ocr_text))}
    best: list[str] = []
    run: list[str] = []
    for w in WORD.findall(normalize(text_layer)):
        run = run + [w] if w.lower() not in seen else []
        if len(run) > len(best):
            best = run
    return best


def decoded_payloads(text: str) -> list[str]:
    """Readable text hidden in base64 chunks, so an encoded instruction is scanned like a plain one."""
    out = []
    for chunk in B64_CHUNK.findall(text):
        try:
            raw = base64.b64decode(chunk + "=" * (-len(chunk) % 4), validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
        # a sentence, not random bytes that happen to be printable
        if all(ch.isprintable() or ch in "\n\t" for ch in raw) and SENTENCE.search(raw):
            out.append(raw)
    return out


def scan(ocr_text: str, text_layer: str | None = None) -> dict:
    rules: list[str] = []
    details: dict[str, str | int | list[str]] = {}
    raw = ocr_text + "\n" + (text_layer or "")
    text = normalize(raw)

    if INVISIBLE.search(raw):
        rules.append("invisible-chars")
        details["invisible_chars"] = len(INVISIBLE.findall(raw))

    decoded = decoded_payloads(text)
    for rx in INSTRUCTION:
        if m := rx.search(text):
            rules.append("doc-instruction")
            details["instruction"] = _snippet(text, m)
            break
        if hit := next((d for d in decoded if rx.search(normalize(d))), None):
            rules.append("doc-instruction")
            details["instruction"] = "base64: " + hit[:120]
            break

    if text_layer:
        hidden = hidden_words(ocr_text, text_layer)
        if len(hidden) >= 4:
            rules.append("hidden-text")
            details["hidden_text"] = " ".join(hidden[:20])

    if BASE64.search(text) or HEX.search(text) or decoded:
        rules.append("encoded-payload")

    if any(rx.search(text) for rx in URGENCY):
        rules.append("urgency-secrecy")

    has_payment = bool(PAYMENT_DETAIL.search(text))
    attack = {"doc-instruction", "hidden-text", "invisible-chars"} & set(rules)
    if (attack and has_payment) or ("doc-instruction" in rules and len(attack) > 1):
        verdict = "malicious"
    elif rules:
        verdict = "suspicious"
    else:
        verdict = "clean"
    return {"verdict": verdict, "rules": rules, "details": details, "payment_details": has_payment}
