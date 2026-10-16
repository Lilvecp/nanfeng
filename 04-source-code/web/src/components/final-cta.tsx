"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, S, clpM } from "@/lib/scenario";

// Final call to action: headline + demo button on the left, a compact preview of the
// Cherry Crisis run on the right (gap detected → options evaluated → owner approves).
const STAGES: Record<Lang, { label: string; meta: string }[]> = {
  en: [
    { label: "Cash gap detected", meta: `Day ${N.crunchDay} · ${N.pNeg} risk · −${clpM(S.need.amount_clp)}` },
    { label: "Financing options evaluated", meta: `${S.arena.length} quotes · plan ${N.savingsPct} cheaper than a bank loan` },
    { label: "Owner approves action", meta: "One-time code · cash on payroll day" },
  ],
  es: [
    { label: "Brecha de caja detectada", meta: `Día ${N.crunchDay} · ${N.pNeg} de riesgo · −${clpM(S.need.amount_clp, "es")}` },
    { label: "Opciones de financiamiento evaluadas", meta: `${S.arena.length} cotizaciones · plan ${N.savingsPct} más barato que un crédito` },
    { label: "El dueño aprueba la acción", meta: "Código de un uso · caja el día de la nómina" },
  ],
  zh: [
    { label: "发现现金缺口", meta: `第${N.crunchDay}天 · 风险${N.pNeg} · −${clpM(S.need.amount_clp, "zh").replace("智利比索", "比索")}` },
    { label: "评估融资方案", meta: `${S.arena.length}份报价 · 比银行贷款便宜${N.savingsPct}` },
    { label: "企业主批准执行", meta: "一次性验证码 · 发薪日到账" },
  ],
};

const HEAD: Record<Lang, { a: string; kw: string; b: string; note: string; preview: string; time: string }> = {
  en: { a: `Watch a ${clpM(S.need.amount_clp)} payroll gap close in`, kw: "four minutes", b: ".", note: "Fixed seed · runs offline · no sign-up", preview: "Cherry Crisis · live preview", time: "≈ 4 min" },
  es: { a: `Mira cómo se cierra una brecha de ${clpM(S.need.amount_clp, "es")} en los sueldos en`, kw: "cuatro minutos", b: ".", note: "Semilla fija · funciona sin red · sin registro", preview: "Cherry Crisis · vista previa", time: "≈ 4 min" },
  zh: { a: `观看${clpM(S.need.amount_clp, "zh")}的工资缺口在`, kw: "四分钟内补足", b: "。", note: "固定种子 · 离线运行 · 无需注册", preview: "樱桃危机 · 实时预览", time: "约4分钟" },
};

export function FinalCta({ cta, footer }: { cta: string; footer: string }) {
  const lang = useLang();
  const h = HEAD[lang];
  const stages = STAGES[lang];

  return (
    <section className="band-navy final-cta">
      <div className="wrap">
        <div className="final-grid">
          <div className="final-copy" data-reveal>
            <h2 className="lp-h">
              {h.a} <span className="kw">{h.kw}</span>{h.b}
            </h2>
            <div className="final-actions">
              <Link className="pill-cherry final-btn" href="/demo?play=1">
                {cta}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <span className="final-note">{h.note}</span>
            </div>
          </div>

          <div className="final-flow" data-reveal aria-label={h.preview}>
            <div className="final-flow-head">
              <span>{h.preview}</span>
              <span>{h.time}</span>
            </div>
            <ol className="final-stages">
              {stages.map((s, i) => (
                <li key={i} className="final-stage" style={{ "--i": i } as React.CSSProperties}>
                  <span className="final-node" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <span className="final-stage-text">
                    <b>{s.label}</b>
                    <span>{s.meta}</span>
                  </span>
                  {i < stages.length - 1 && (
                    <span className="final-link" aria-hidden="true">
                      <i className="final-signal" />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="final-foot mono small">{footer}</p>
      </div>
    </section>
  );
}
