"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ForecastChart } from "@/components/forecast-chart";
import { Topbar } from "@/components/topbar";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, S, SHORT_CUSTOMER, SHORT_CUSTOMER_ZH, clpFull, usd } from "@/lib/scenario";

// Deterministic replay of the Cherry Crisis (fixed seed, no network), for the jury and the video.
const LABELS: Record<Lang, string[]> = {
  en: ["DELAY", "FORECAST", "QUOTES", "PLAN", "APPROVE", "CLOSED"],
  es: ["ATRASO", "PRONÓSTICO", "COTIZACIONES", "PLAN", "APROBAR", "CERRADA"],
  zh: ["延迟", "预测", "报价", "方案", "批准", "补足"],
};
const UI = {
  en: { cash: "Cash", exit: "Exit demo", step: "STEP", delayed: `Delayed +${N.delayDays}D`, plan: "Plan", run: "RUN CHERRY CRISIS", searching: "SEARCHING…", pae: "PAE LOAN", executed: "EXECUTED", pNeg: `P(cash<0) · ${N.crunchDay}D` },
  es: { cash: "Caja", exit: "Salir de la demo", step: "PASO", delayed: `Atrasado +${N.delayDays}D`, plan: "Plan", run: "CORRER CHERRY CRISIS", searching: "BUSCANDO…", pae: "CRÉDITO PAE", executed: "EJECUTADO", pNeg: `P(caja<0) · ${N.crunchDay}D` },
  zh: { cash: "现金", exit: "退出演示", step: "步骤", delayed: `延迟 +${N.delayDays}天`, plan: "方案", run: "运行樱桃危机", searching: "搜索中…", pae: "PAE 贷款", executed: "已执行", pNeg: `现金<0概率 · ${N.crunchDay}天` },
};
const LENDERS = new Set(S.arena.map((a) => a.lender)).size;
const CAPTIONS: Record<Lang, string[]> = {
  en: [
    `${SHORT_CUSTOMER} will pay ${usd(N.overdueUsd)} ${N.delayDays} days late`,
    `10,000 scenarios: ${N.pNeg} chance cash < 0 on day ${N.crunchDay}, harvest payroll`,
    `${S.arena.length} financing quotes from ${LENDERS} lenders, compared in seconds`,
    `Optimizer: ${N.termDays}-day USD pre-export loan, ${N.savingsPct} cheaper than the bank loan`,
    "Owner approves on WhatsApp with a 6-digit SMS code",
    `Gap closed in ${N.coverage} of scenarios · hash-chained · anchored on-chain`,
  ],
  es: [
    `${SHORT_CUSTOMER} pagará ${usd(N.overdueUsd, "es")} con ${N.delayDays} días de atraso`,
    `10.000 escenarios: ${N.pNeg} de probabilidad de caja < 0 el día ${N.crunchDay}, la nómina de cosecha`,
    `${S.arena.length} cotizaciones de ${LENDERS} prestamistas, comparadas en segundos`,
    `Optimizador: crédito de pre-exportación en USD a ${N.termDays} días, ${N.savingsPct} más barato que el crédito bancario`,
    "El dueño aprueba por WhatsApp con un código SMS de 6 dígitos",
    `Brecha cerrada en el ${N.coverage} de los escenarios · hash encadenado · anclado on-chain`,
  ],
  zh: [
    `${SHORT_CUSTOMER_ZH}将推迟${N.delayDays}天支付 ${usd(N.overdueUsd, "zh")}`,
    `10,000 次模拟：第${N.crunchDay}天（采收工资日）现金为负的概率为${N.pNeg}`,
    `数秒内比较${LENDERS}家贷款方的${S.arena.length}份融资报价`,
    `优化器：${N.termDays}天期美元出口前融资，比银行贷款便宜${N.savingsPct}`,
    "企业主通过 WhatsApp 输入6位短信验证码批准",
    `${N.coverage}的情景中缺口已补足 · 哈希链 · 已上链锚定`,
  ],
};

export default function DemoPage() {
  const lang = useLang();
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= 6) {
          setPlaying(false);
          return 6;
        }
        return s + 1;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowRight") setStep((s) => Math.min(6, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(1, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fixed = step === 6;
  const prob = step === 1 ? N.pNegBefore : fixed ? N.pNegAfterPlan : N.pNeg;
  const probColor = fixed ? "var(--ok)" : step === 1 ? "var(--text)" : "var(--crit)";
  const u = UI[lang];
  const plan = step < 4 ? u.searching : step < 6 ? u.pae : u.executed;

  return (
    <>
      <Topbar controls={false}>
        <div className="tick"><span className="l">{u.cash}</span><span className="v">{clpFull(S.openingCashClp)}</span></div>
        <span className="status"><span className="dot crit blink" />DEMO · CHERRY CRISIS · {u.step} {step}/6</span>
        <Link href="/cockpit" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}>{u.exit}</Link>
      </Topbar>
      <div className="content" style={{ flex: 1 }}>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">{u.pNeg}</span><span className="kpi-v" style={{ fontSize: "clamp(32px, 5vw, 52px)", color: probColor }}>{prob}</span></div>
          <div className="kpi"><span className="kpi-l">{u.delayed}</span><span className="kpi-v" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>{usd(N.overdueUsd, lang)}</span></div>
          <div className="kpi"><span className="kpi-l">{u.plan}</span><span className="kpi-v" style={{ fontSize: "clamp(20px, 3vw, 30px)" }}>{plan}</span></div>
        </div>
        <div className="card">
          <div className="card-h"><span className="h3">Cash forecast · 90D · CLP M</span></div>
          <div className="card-b"><ForecastChart resolved={fixed} labels={false} /></div>
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, display: "flex", flexDirection: "column", zIndex: 5 }}>
        <div style={{ margin: "0 16px 12px", alignSelf: "flex-start", display: "flex", maxWidth: 1000, border: "1px solid #1F3358" }} aria-live="polite">
          <span className="mono" style={{ background: "#1F3358", color: "#FFFFFF", padding: "14px 16px", fontWeight: 700, fontSize: 18 }}>0{step}/06</span>
          <span style={{ background: "#14171C", color: "#F3F3EF", padding: "14px 20px", fontSize: "clamp(16px, 2.2vw, 24px)", fontFamily: "var(--f-display)", fontWeight: 600, lineHeight: 1.25 }}>{CAPTIONS[lang][step - 1]}</span>
        </div>
        <div style={{ height: 3, background: "#232930" }}><div style={{ height: 3, background: "var(--accent)", width: `${Math.round((step / 6) * 100)}%`, transition: "width .4s" }} /></div>
        <div className="demo-bar" style={{ borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <span style={{ fontWeight: 700, letterSpacing: ".08em", fontSize: 13 }}>{u.run}</span>
          <div className="demo-steps">
            {LABELS[lang].map((label, i) => (
              <button key={label} className={`demo-step${i + 1 < step ? " done" : i + 1 === step ? " now" : ""}`} type="button" aria-current={i + 1 === step ? "step" : undefined} onClick={() => setStep(i + 1)} style={{ background: i + 1 === step ? undefined : "transparent", border: 0, borderRight: "1px solid #2A313C", fontFamily: "var(--f-mono)", cursor: "pointer" }}>
                <i>{i + 1}</i>{label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="ctl" type="button" aria-label="Reset demo" onClick={() => { setPlaying(false); setStep(1); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5" /></svg>
            </button>
            <button className="ctl main" type="button" aria-label={playing ? "Pause demo" : "Play demo"} onClick={() => { if (step >= 6) setStep(1); setPlaying((p) => !p); }}>
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button className="ctl" type="button" aria-label="Next step" onClick={() => setStep((s) => Math.min(6, s + 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
