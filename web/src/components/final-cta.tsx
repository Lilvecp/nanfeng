"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";

// Final call to action: headline + demo button on the left, a compact preview of the
// Cherry Crisis run on the right (gap detected → options evaluated → owner approves).
const STAGES: Record<Lang, { label: string; meta: string }[]> = {
  en: [
    { label: "Cash gap detected", meta: "Day 19 · 81% risk · −CLP 77M" },
    { label: "Financing options evaluated", meta: "4 quotes · best at 11.8% EAC" },
    { label: "Owner approves action", meta: "One-time code · cash in 48 h" },
  ],
  es: [
    { label: "Brecha de caja detectada", meta: "Día 19 · 81% de riesgo · −CLP 77M" },
    { label: "Opciones de financiamiento evaluadas", meta: "4 cotizaciones · la mejor a 11,8% CAE" },
    { label: "El dueño aprueba la acción", meta: "Código de un uso · caja en 48 h" },
  ],
  zh: [
    { label: "发现现金缺口", meta: "第19天 · 风险81% · −7,700万比索" },
    { label: "评估融资方案", meta: "4份报价 · 最低年化11.8%" },
    { label: "企业主批准执行", meta: "一次性验证码 · 48小时到账" },
  ],
};

const HEAD: Record<Lang, { a: string; kw: string; b: string; note: string; preview: string; time: string }> = {
  en: { a: "Watch a USD 180,000 gap close in", kw: "four minutes", b: ".", note: "Fixed seed · runs offline · no sign-up", preview: "Cherry Crisis · live preview", time: "≈ 4 min" },
  es: { a: "Mira cómo se cierra una brecha de USD 180.000 en", kw: "cuatro minutos", b: ".", note: "Semilla fija · funciona sin red · sin registro", preview: "Cherry Crisis · vista previa", time: "≈ 4 min" },
  zh: { a: "观看 180,000 美元缺口在", kw: "四分钟内补足", b: "。", note: "固定种子 · 离线运行 · 无需注册", preview: "樱桃危机 · 实时预览", time: "约4分钟" },
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
              <Link className="pill-cherry final-btn" href="/demo">
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
