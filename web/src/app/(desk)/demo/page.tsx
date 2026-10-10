"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ForecastChart } from "@/components/forecast-chart";
import { Topbar } from "@/components/topbar";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";

// Deterministic replay of the Cherry Crisis (fixed seed, no network), for the jury and the video.
const LABELS = ["DELAY", "FORECAST", "QUOTES", "PLAN", "APPROVE", "CLOSED"];
const CAPTIONS: Record<Lang, string[]> = {
  en: [
    "Shanghai Fresh Imports moves USD 180,000 by 45 days",
    "10,000 scenarios: 81% chance cash < 0 on day 19",
    "4 financing quotes from 3 banks in 6 seconds",
    "Optimizer: partial factoring + CNY forward, −CLP 4.1M",
    "Owner approves on WhatsApp with a 6-digit OTP",
    "Gap closed · hash-chained · anchored on FISCO BCOS",
  ],
  es: [
    "Shanghai Fresh Imports atrasa USD 180.000 en 45 días",
    "10.000 escenarios: 81% de probabilidad de caja < 0 el día 19",
    "4 cotizaciones de 3 bancos en 6 segundos",
    "Optimizador: factoring parcial + forward CNY, −CLP 4,1M",
    "El dueño aprueba por WhatsApp con un OTP de 6 dígitos",
    "Brecha cerrada · hash encadenado · anclado en FISCO BCOS",
  ],
  zh: [
    "上海 Fresh Imports 将 180,000 美元付款推迟45天",
    "10,000 次模拟：第19天现金为负的概率为81%",
    "6秒内获得3家银行的4份融资报价",
    "优化器：部分保理 + 人民币远期，节省410万比索",
    "企业主通过 WhatsApp 输入6位验证码批准",
    "缺口已补足 · 哈希链 · 锚定至 FISCO BCOS",
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
  const prob = step === 1 ? "22%" : fixed ? "4%" : "81%";
  const probColor = fixed ? "var(--ok)" : step === 1 ? "var(--text)" : "var(--crit)";
  const plan = step < 4 ? "SEARCHING…" : step < 6 ? "FACT+FWD" : "EXECUTED";

  return (
    <>
      <Topbar controls={false}>
        <div className="tick"><span className="l">Cash</span><span className="v">CLP $142.300.000</span></div>
        <span className="status"><span className="dot crit blink" />DEMO · CHERRY CRISIS · STEP {step}/6</span>
        <Link href="/cockpit" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}>Exit demo</Link>
      </Topbar>
      <div className="content" style={{ flex: 1 }}>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">P(cash&lt;0) · 19D</span><span className="kpi-v" style={{ fontSize: "clamp(32px, 5vw, 52px)", color: probColor }}>{prob}</span></div>
          <div className="kpi"><span className="kpi-l">Overdue</span><span className="kpi-v" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>USD 180,000</span></div>
          <div className="kpi"><span className="kpi-l">Plan</span><span className="kpi-v" style={{ fontSize: "clamp(20px, 3vw, 30px)" }}>{plan}</span></div>
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
          <span style={{ fontWeight: 700, letterSpacing: ".08em", fontSize: 13 }}>RUN CHERRY CRISIS</span>
          <div className="demo-steps">
            {LABELS.map((label, i) => (
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
