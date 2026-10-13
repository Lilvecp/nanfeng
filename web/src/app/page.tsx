"use client";

import Link from "next/link";
import { ChannelsNetwork } from "@/components/channels-network";
import { FinalCta } from "@/components/final-cta";
import { HeroGlobe } from "@/components/hero-globe";
import { SecurityControl } from "@/components/security-control";
import { LandingCards } from "@/components/landing-cards";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteNav } from "@/components/site-nav";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N } from "@/lib/scenario";

const L = {
  deskH: { en: "One agent. The whole treasury desk.", es: "Un agente. Toda la tesorería.", zh: "一个代理，掌管整个资金台。" },
  deskSub: {
    en: "Built for small and medium exporters who sell in USD and CNY, pay in CLP, and get paid 60–90 days late.",
    es: "Para pymes exportadoras que venden en USD y CNY, pagan en CLP y cobran a 60–90 días.",
    zh: "专为以美元和人民币销售、以智利比索付款、回款周期60–90天的中小出口企业打造。",
  },
  howH: { en: "Predict → Decide → Act", es: "Predecir → Decidir → Actuar", zh: "预测 → 决策 → 执行" },
  chanH: { en: "One agent, every market's channel.", es: "Un agente, el canal de cada mercado.", zh: "一个代理，覆盖每个市场的渠道。" },
  chanSub: {
    en: "The owner approves on WhatsApp in Rancagua; the importer gets a courteous reminder on WeCom in Shanghai.",
    es: "El dueño aprueba por WhatsApp en Rancagua; el importador recibe un recordatorio cortés por WeCom en Shanghái.",
    zh: "企业主在兰卡瓜通过 WhatsApp 审批；上海的进口商通过企业微信收到礼貌的提醒。",
  },
  secH: { en: "An agent that can't be talked into moving your money.", es: "Un agente al que nadie puede convencer de mover tu dinero.", zh: "任何人都无法诱使它动用您的资金。" },
  benchH: { en: "Measured, not promised.", es: "Medido, no prometido.", zh: "实测结果，而非承诺。" },
  benchNote: { en: `NanFeng-Bench · ${N.benchCases} synthetic exporters · red-team suite of ${N.rtAttacks} attacks`, es: `NanFeng-Bench · ${N.benchCases} exportadoras sintéticas · red team de ${N.rtAttacks} ataques`, zh: `NanFeng-Bench · ${N.benchCases}家模拟出口企业 · ${N.rtAttacks}项红队攻击` },
  bench1: { en: "Benchmark cases solved", es: "Casos del benchmark resueltos", zh: "基准测试案例全部通过" },
  bench2: {
    en: `Average financing cost vs the default bank loan, across the benchmark cases that needed a loan (Cherry Crisis alone: −${N.savingsPct})`,
    es: `Costo financiero promedio vs el crédito bancario, en los casos del benchmark que necesitaban financiamiento (solo Cherry Crisis: −${N.savingsPct})`,
    zh: `需要融资的基准案例中，平均融资成本对比银行贷款（仅樱桃危机：−${N.savingsPct}）`,
  },
  bench3: {
    en: `Red-team attacks stopped (${N.rtStoppedBefore}/${N.rtAttacks} before the guard)`,
    es: `Ataques del red team frenados (${N.rtStoppedBefore}/${N.rtAttacks} antes de la protección)`,
    zh: `红队攻击拦截数（防护前为${N.rtStoppedBefore}/${N.rtAttacks}）`,
  },
  teamH: { en: "Built at Universidad del Desarrollo, Chile.", es: "Hecho en la Universidad del Desarrollo, Chile.", zh: "由智利发展大学团队打造。" },
  sandbox: { en: "NANFENG 南风 · SOUTH WIND · SANDBOX DEMO — NO REAL FUNDS MOVE", es: "NANFENG 南风 · VIENTO DEL SUR · DEMO SANDBOX — NO SE MUEVE DINERO REAL", zh: "南风 NANFENG · 沙盒演示 — 不涉及真实资金" },
} satisfies Record<string, Record<Lang, string>>;

const HOW: { n: Record<Lang, string>; h: Record<Lang, string>; p: Record<Lang, string>; href: string; link: Record<Lang, string> }[] = [
  {
    n: { en: "Predict", es: "Predecir", zh: "预测" },
    h: { en: "Monte Carlo cash forecast", es: "Pronóstico de caja Monte Carlo", zh: "蒙特卡洛现金预测" },
    p: { en: "P10 / P50 / P90 over 90 days, refreshed whenever an email, invoice or bank statement changes the picture.", es: "P10 / P50 / P90 a 90 días, recalculado cada vez que un correo, una factura o una cartola cambia el panorama.", zh: "90天 P10 / P50 / P90 预测，每当邮件、发票或银行流水改变情况时自动更新。" },
    href: "/cockpit", link: { en: "Home", es: "Inicio", zh: "首页" },
  },
  {
    n: { en: "Decide", es: "Decidir", zh: "决策" },
    h: { en: "Optimizer picks the cheapest financing", es: "El optimizador elige el financiamiento más barato", zh: "优化器选出成本最低的融资" },
    p: { en: "Pre-export loans, factoring, FOGAPE guarantees, credit lines and CNY forwards, ranked by cost, timing and gap coverage.", es: "Créditos de pre-exportación, factoring, garantías FOGAPE, líneas de crédito y forwards en CNY, ordenados por costo, plazo y cobertura de la brecha.", zh: "出口前融资、保理、FOGAPE 担保、信用额度和人民币远期，按成本、时效和缺口覆盖排序。" },
    href: "/financing", link: { en: "Financing", es: "Financiamiento", zh: "融资" },
  },
  {
    n: { en: "Act", es: "Actuar", zh: "执行" },
    h: { en: "Executes with owner approval", es: "Ejecuta con la aprobación del dueño", zh: "经企业主批准后执行" },
    p: { en: "Tiered permissions; a six-digit code for anything that moves money; every step written to an audit chain.", es: "Permisos por niveles; un código de seis dígitos para todo lo que mueve plata; cada paso queda en una cadena de auditoría.", zh: "分级权限；任何资金操作都需六位验证码；每一步都写入审计链。" },
    href: "/approvals", link: { en: "Approvals", es: "Aprobaciones", zh: "审批" },
  },
];

const TEAM: [string, Record<Lang, string>][] = [
  ["Valentín", { en: "Lead · product", es: "Líder · producto", zh: "负责人 · 产品" }],
  ["Renato", { en: "AI agent", es: "Agente de IA", zh: "AI 代理" }],
  ["Camilo", { en: "Full-stack · blockchain", es: "Full-stack · blockchain", zh: "全栈 · 区块链" }],
  ["Andy", { en: "Security · compliance", es: "Seguridad · cumplimiento", zh: "安全 · 合规" }],
  ["Vicente", { en: "Quant · forecasting", es: "Cuantitativo · pronóstico", zh: "量化 · 预测" }],
];

export default function LandingPage() {
  const t = useT();
  const lang = useLang();
  const l = (k: keyof typeof L) => L[k][lang];

  return (
    <div className="lp">
      <ScrollReveal />
      <SiteNav />
      <section className="cine">
        <div className="cine-grid" aria-hidden="true" />
        <div className="wrap" style={{ position: "relative" }}>
          <div id="top" className="hero-screen">
            <h1 className="hero-t rise" style={{ fontSize: "clamp(36px, 5.6vw, 76px)", fontWeight: 700, lineHeight: 1.08, maxWidth: 1080 }}>
              {t("lp.hero.a")}{lang === "zh" ? "" : " "}<span className="kw">{t("lp.hero.kw")}</span>{t("lp.hero.b")}
              <br />
              <span style={{ color: "var(--muted)" }}>{t("lp.hero.line2")}</span>
            </h1>
            <p className="lead rise rise-2" style={{ textAlign: "center", maxWidth: 640, margin: "-8px auto 0" }}>{t("lp.hero.sub")}</p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
              <Link className="pill-cherry" href="/demo?play=1">{t("lp.cta.demo")}</Link>
              <a className="pill-out" href="#how">{t("lp.cta.how")}</a>
            </div>
            <a className="scroll-hint" href="#story" aria-label={lang === "es" ? "Bajar a la historia" : lang === "zh" ? "查看故事" : "Scroll to the story"}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </a>
          </div>
        </div>
      </section>

      <section id="story" className="cine story-section">
        <div className="wrap" style={{ position: "relative" }}>
          <div data-reveal="globe" style={{ display: "flex", justifyContent: "center" }}>
            <HeroGlobe max={780} />
          </div>
        </div>
      </section>

      <section className="cine" style={{ padding: "88px 0 96px", borderTop: "1px solid var(--line)" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <h2 className="lp-h" data-reveal style={{ color: "var(--text)" }}>{l("deskH")}</h2>
          <p className="lp-sub" data-reveal style={{ color: "var(--muted)" }}>{l("deskSub")}</p>
          <LandingCards />
        </div>
      </section>

      <section id="how" className="lp-section alt"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 48 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12 }}><h2 className="lp-h">{l("howH")}</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
          {HOW.map((h) => (
            <div key={h.href} className="card" data-reveal><div className="card-b" style={{ padding: 28, gap: 12 }}><span className="step-n">{h.n[lang]}</span><h3 className="h2" style={{ fontSize: 24 }}>{h.h[lang]}</h3><p className="muted" style={{ margin: 0 }}>{h.p[lang]}</p><Link className="mono small" href={h.href}>{h.link[lang]} →</Link></div></div>
          ))}
        </div>
      </div></section>

      <section id="channels" className="lp-section"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12 }}><h2 className="lp-h">{l("chanH")}</h2><p className="lp-sub">{l("chanSub")}</p></div>
        <ChannelsNetwork />
      </div></section>

      <section id="security" className="lp-section alt security-section"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12 }}><h2 className="lp-h">{l("secH")}</h2></div>
        <SecurityControl />
      </div></section>

      <section className="lp-section alt metrics-section"><div className="wrap" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}><h2 className="lp-h" style={{ color: "var(--text)" }}>{l("benchH")}</h2><span className="badge" style={{ background: "transparent" }}>{l("benchNote")}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 0, borderTop: "1px solid var(--line)" }}>
          <div data-reveal style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}><span className="big-num" style={{ color: "var(--text)", fontSize: 64 }}>{N.benchSolved}/{N.benchCases}</span><span className="muted">{l("bench1")}</span></div>
          <div data-reveal style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", borderLeft: "1px solid var(--line)" }}><span className="big-num" style={{ color: "var(--accent)", fontSize: 64 }}>−{N.benchSavingsPct}</span><span className="muted" style={{ textAlign: "center", maxWidth: 320 }}>{l("bench2")}</span></div>
          <div data-reveal style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", borderLeft: "1px solid var(--line)" }}><span className="big-num" style={{ color: "var(--text)", fontSize: 64 }}>{N.rtStopped}/{N.rtAttacks}</span><span className="muted">{l("bench3")}</span></div>
        </div>
      </div></section>

      <section id="team" className="lp-section"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
        <h2 className="lp-h" data-reveal style={{ fontSize: 34 }}>{l("teamH")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          {TEAM.map(([n, role]) => <span key={n} data-reveal className="chip" style={{ borderRadius: 999, padding: "10px 22px", fontSize: 14, display: "inline-flex", gap: 8, alignItems: "baseline" }}><b>{n}</b><span className="muted small">{role[lang]}</span></span>)}
        </div>
      </div></section>

      <FinalCta cta={t("lp.cta.demo")} footer={l("sandbox")} />
    </div>
  );
}
