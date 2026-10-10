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
  benchH: { en: "Measured on the Cherry Crisis suite.", es: "Medido en la suite Cherry Crisis.", zh: "基于“樱桃危机”测试集的评估。" },
  teamH: { en: "Built at Universidad del Desarrollo, Chile.", es: "Hecho en la Universidad del Desarrollo, Chile.", zh: "由智利发展大学团队打造。" },
  sandbox: { en: "NANFENG 南风 · SOUTH WIND · SANDBOX DEMO — NO REAL FUNDS MOVE", es: "NANFENG 南风 · VIENTO DEL SUR · DEMO SANDBOX — NO SE MUEVE DINERO REAL", zh: "南风 NANFENG · 沙盒演示 — 不涉及真实资金" },
} satisfies Record<string, Record<Lang, string>>;

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
              <Link className="pill-cherry" href="/demo">{t("lp.cta.demo")}</Link>
              <a className="pill-out" href="#how">{t("lp.cta.how")}</a>
            </div>
            <a className="scroll-hint" href="#story" aria-label="Scroll to the story">
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
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12 }}><span className="eyebrow" style={{ textAlign: "center", color: "var(--brass)" }}>{t("lp.nav.how")}</span><h2 className="lp-h">{l("howH")}</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
          <div className="card" data-reveal><div className="card-b" style={{ padding: 28, gap: 12 }}><span className="step-n">01 · PREDICT</span><h3 className="h2" style={{ fontSize: 24 }}>Monte Carlo cash forecast</h3><p className="muted" style={{ margin: 0 }}>P10 / P50 / P90 over 90 days, refreshed whenever an email, invoice or bank statement changes the picture.</p><Link className="mono small" href="/cockpit">Cash Cockpit →</Link></div></div>
          <div className="card" data-reveal><div className="card-b" style={{ padding: 28, gap: 12 }}><span className="step-n">02 · DECIDE</span><h3 className="h2" style={{ fontSize: 24 }}>Optimizer picks the cheapest financing</h3><p className="muted" style={{ margin: 0 }}>Factoring, working-capital loans, FOGAPE guarantees and CNY forwards — ranked by cost, speed and gap coverage.</p><Link className="mono small" href="/financing">Financing Arena →</Link></div></div>
          <div className="card" data-reveal><div className="card-b" style={{ padding: 28, gap: 12 }}><span className="step-n">03 · ACT</span><h3 className="h2" style={{ fontSize: 24 }}>Executes with owner approval</h3><p className="muted" style={{ margin: 0 }}>Tiered permissions; a six-digit code for anything that moves money; every step written to an audit chain.</p><Link className="mono small" href="/approvals">Approval Center →</Link></div></div>
        </div>
      </div></section>

      <section id="channels" className="lp-section"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12 }}><span className="eyebrow" style={{ textAlign: "center", color: "var(--brass)" }}>{t("lp.nav.channels")}</span><h2 className="lp-h">{l("chanH")}</h2><p className="lp-sub">{l("chanSub")}</p></div>
        <ChannelsNetwork />
      </div></section>

      <section id="security" className="lp-section alt security-section"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12 }}><span className="eyebrow" style={{ textAlign: "center", color: "var(--brass)" }}>{t("lp.nav.security")}</span><h2 className="lp-h">{l("secH")}</h2></div>
        <SecurityControl />
      </div></section>

      <section className="lp-section alt metrics-section"><div className="wrap" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28 }}>
        <div data-reveal style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}><h2 className="lp-h" style={{ color: "var(--text)" }}>{l("benchH")}</h2><span className="badge warn" style={{ background: "transparent" }}>Placeholder figures · final benchmark pending</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: 0, borderTop: "1px solid var(--line)" }}>
          <div data-reveal style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}><span className="big-num" style={{ color: "var(--text)", fontSize: 64 }}>94%</span><span className="muted">Task success rate</span></div>
          <div data-reveal style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", borderLeft: "1px solid var(--line)" }}><span className="big-num" style={{ color: "var(--accent)", fontSize: 64 }}>−27%</span><span className="muted">Financing cost vs default loan</span></div>
          <div data-reveal style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", borderLeft: "1px solid var(--line)" }}><span className="big-num" style={{ color: "var(--text)", fontSize: 64 }}>40/40</span><span className="muted">Red-team attacks blocked</span></div>
        </div>
      </div></section>

      <section id="team" className="lp-section"><div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
        <span className="eyebrow" style={{ color: "var(--brass)" }}>{t("lp.nav.team")}</span>
        <h2 className="lp-h" data-reveal style={{ fontSize: 34 }}>{l("teamH")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          {["Valentín", "Renato", "Camilo", "Andy", "Vicente"].map((n) => <span key={n} data-reveal className="chip" style={{ borderRadius: 999, padding: "10px 22px", fontSize: 14 }}>{n}</span>)}
        </div>
      </div></section>

      <FinalCta cta={t("lp.cta.demo")} footer={l("sandbox")} />
    </div>
  );
}
