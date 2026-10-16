"""Message templates with typed slots, ES / EN / 中文.

No LLM writes an outbound message: the slots are filled with numbers from the tools and ids from
master data. Links only point at our own cockpit. ES and 中文 are machine-assisted; a native reader
checks them before the video (07-team-workspace/plan/risks.md).
"""

from __future__ import annotations

from decimal import Decimal

LANGS = ("es", "en", "zh")


def money(amount: float | Decimal, currency: str, lang: str = "en") -> str:
    a = float(amount)
    if currency == "CLP" and abs(a) >= 1_000_000:
        m = a / 1_000_000
        if lang == "zh":
            return f"{a / 10_000:,.0f}万智利比索"
        return f"CLP {m:,.1f}M".replace(".", ",") if lang == "es" else f"CLP {m:,.1f}M"
    text = f"{a:,.0f}"
    if lang == "es":
        text = text.replace(",", ".")
    return f"{currency} {text}" if lang != "zh" else f"{text} {'美元' if currency == 'USD' else currency}"


def pct(p: float) -> str:
    return f"{round(p * 100):.0f}%"


T: dict[str, dict[str, str]] = {
    "alert": {
        "es": "NanFeng · Alerta de caja: {customer} pagará {amount} con {delay} días de atraso. "
              "{prob} de probabilidad de caja negativa el {crunch_date}{driver}.",
        "en": "NanFeng · Cash alert: {customer} will pay {amount} {delay} days late. "
              "{prob} chance cash goes negative on {crunch_date}{driver}.",
        "zh": "NanFeng · 现金预警：{customer} 的 {amount} 货款将延迟 {delay} 天支付。"
              "{crunch_date} 现金为负的概率为 {prob}{driver}。",
    },
    "plan": {
        "es": "Mejor plan: {plan}. Costo {cost} vs {default_cost} del crédito bancario ({savings} más barato). "
              "La caja se mantiene sobre el colchón en el {coverage} de los escenarios.",
        "en": "Best plan: {plan}. Cost {cost} vs {default_cost} for the bank loan ({savings} cheaper). "
              "Cash stays above the buffer in {coverage} of scenarios.",
        "zh": "最优方案：{plan}。成本 {cost}，银行贷款需 {default_cost}（节省 {savings}）。"
              "{coverage} 的模拟情景中现金保持在安全垫之上。",
    },
    "plan_default": {
        "es": "Plan: {plan}, el crédito bancario de siempre. Costo {cost}; el optimizador no encontró nada más barato "
              "({optimal_cost}). La caja se mantiene sobre el colchón en el {coverage} de los escenarios.",
        "en": "Plan: {plan}, the usual bank loan. Cost {cost}; the optimizer found nothing cheaper ({optimal_cost}). "
              "Cash stays above the buffer in {coverage} of scenarios.",
        "zh": "方案：{plan}（常规银行贷款）。成本 {cost}；优化器未找到更便宜的方案（{optimal_cost}）。"
              "{coverage} 的模拟情景中现金保持在安全垫之上。",
    },
    "plan_none": {
        "es": "No te propongo ninguna operación: {reason}. Revisa el análisis en {link}.",
        "en": "I am not proposing any operation: {reason}. See the analysis at {link}.",
        "zh": "我不提议任何操作：{reason}。请在 {link} 查看分析。",
    },
    "approval": {
        "es": "Solicitud {approval_id} (nivel L{tier}) espera tu aprobación. Apruébala en {link} con el código "
              "que te llega por SMS. NanFeng nunca te pedirá ese código.",
        "en": "Request {approval_id} (tier L{tier}) is waiting for your approval. Approve it at {link} with the "
              "code we text you. NanFeng never asks you for that code.",
        "zh": "请求 {approval_id}（L{tier} 级）等待您的批准。请在 {link} 使用短信验证码批准。NanFeng 绝不会向您索要该验证码。",
    },
    "auto_done": {
        "es": "Listo: {action} ejecutado automáticamente dentro de tus límites (L{tier}, {amount}). Detalle en {link}.",
        "en": "Done: {action} ran automatically within your limits (L{tier}, {amount}). Details at {link}.",
        "zh": "已完成：{action} 已在您的权限范围内自动执行（L{tier}，{amount}）。详情见 {link}。",
    },
    "approved": {
        "es": "Aprobado y ejecutado: {action}. Registro sellado en el log de auditoría (anclaje {anchor}).",
        "en": "Approved and executed: {action}. Recorded in the audit log (anchor {anchor}).",
        "zh": "已批准并执行：{action}。已记录在审计日志中（锚定 {anchor}）。",
    },
    "rejected": {
        "es": "Rechazaste {action}. No se movió dinero. Motivo: {reason}.",
        "en": "You rejected {action}. No money moved. Reason: {reason}.",
        "zh": "您已拒绝 {action}。未发生任何资金变动。原因：{reason}。",
    },
    "blocked": {
        "es": "NanFeng bloqueó el documento {doc_id} ({rules}). No se pagó nada. No actúes sobre él; "
              "llama a tu proveedor al número que ya conoces{verify}.",
        "en": "NanFeng blocked document {doc_id} ({rules}). Nothing was paid. Do not act on it; "
              "call your supplier on the number you know{verify}.",
        "zh": "NanFeng 已拦截文件 {doc_id}（{rules}）。未支付任何款项。请勿据此操作；请拨打您已知的供应商电话核实{verify}。",
    },
    "halted": {
        "es": "NanFeng se detuvo: el freno de emergencia está activo. Nada se ejecuta hasta que lo desactives.",
        "en": "NanFeng stopped: the kill switch is on. Nothing runs until you turn it off.",
        "zh": "NanFeng 已停止：紧急制动已开启。关闭前不会执行任何操作。",
    },
    "collection": {
        "es": "Estimados {customer}: les recordamos la factura {invoice} por {amount}, con vencimiento el "
              "{due_date}. Agradeceremos confirmar la fecha de pago. Saludos, {company}.",
        "en": "Dear {customer}: a friendly reminder of invoice {invoice} for {amount}, due on {due_date}. "
              "Please confirm the payment date. Kind regards, {company}.",
        "zh": "尊敬的{customer}：温馨提醒，发票 {invoice} 金额 {amount}，到期日为 {due_date}。"
              "请确认付款日期。此致，{company}。",
    },
    "briefing": {
        "es": "Buenos días. Resumen de caja de {company}: saldo operativo {cash}. {headline_es}. "
              "Por cobrar en los próximos 30 días: {receivables}. {action}",
        "en": "Good morning. Cash briefing for {company}: operating balance {cash}. {headline_en}. "
              "Receivables due in the next 30 days: {receivables}. {action}",
        "zh": "早上好。{company} 现金简报：运营账户余额 {cash}。{headline_zh}。未来 30 天应收账款：{receivables}。{action}",
    },
    "health_report": {
        "es": "{company} · Salud del negocio (próximos 90 días):\n{findings}\nAnálisis completo: {link}",
        "en": "{company} · Business health (next 90 days):\n{findings}\nFull analysis: {link}",
        "zh": "{company} · 经营健康（未来 90 天）：\n{findings}\n完整分析：{link}",
    },
    "briefing_action": {
        "es": "Tengo un plan de financiamiento listo para tu aprobación.",
        "en": "I have a financing plan ready for your approval.",
        "zh": "我已准备好融资方案，等待您的批准。",
    },
    "briefing_ok": {
        "es": "No se requiere acción hoy.",
        "en": "No action needed today.",
        "zh": "今天无需采取行动。",
    },
}

COMPANY = "Huerto Austral Export SpA"

# Every message NanFeng writes to a third party (an importer) says it was written by AI: required for people
# in China by the CAC Measures for Labelling AI-Generated Synthetic Content (Sept 2025), and honest everywhere
# else. Messages to the owner, who uses NanFeng knowingly, are not labelled.
AI_LABEL = {
    "es": "[Mensaje generado por IA · NanFeng]",
    "en": "[AI-generated message · NanFeng]",
    "zh": "【本消息由AI生成 · NanFeng】",
}


def ai_label(lang: str) -> str:
    return AI_LABEL[lang if lang in LANGS else "en"]


def render(name: str, lang: str, **slots: object) -> str:
    lang = lang if lang in LANGS else "en"
    return T[name][lang].format(**slots)


def headline(prob: float, crunch_date: str | None, days: int | None, lang: str) -> str:
    if not crunch_date:
        return {"es": f"{pct(prob)} de probabilidad de caja negativa en 90 días",
                "en": f"{pct(prob)} probability of negative cash within 90 days",
                "zh": f"90 天内现金为负的概率为 {pct(prob)}"}[lang]
    return {"es": f"{pct(prob)} de probabilidad de caja negativa en {days} días ({crunch_date})",
            "en": f"{pct(prob)} probability of negative cash in {days} days ({crunch_date})",
            "zh": f"{days} 天内（{crunch_date}）现金为负的概率为 {pct(prob)}"}[lang]
