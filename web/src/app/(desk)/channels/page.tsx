"use client";

import { useEffect, useRef, useState } from "react";
import { Topbar } from "@/components/topbar";
import { SANDBOX_OTP } from "@/lib/desk-state";
import { useT } from "@/lib/i18n";

type TLang = "es" | "en" | "zh";

const TRANSCRIPT: Record<TLang, { at: number; text: string }[]> = {
  en: [
    { at: 0, text: "Good morning. Cash: CLP 142.3 million." },
    { at: 6, text: "Shanghai Fresh Imports is 45 days late — 81% risk for payroll on Oct 28." },
    { at: 19, text: "A plan 4.1 million cheaper than a loan needs your approval." },
  ],
  es: [
    { at: 0, text: "Buenos días. Caja: 142,3 millones de pesos." },
    { at: 6, text: "Shanghai Fresh Imports lleva 45 días de atraso: 81% de riesgo para la nómina del 28 de octubre." },
    { at: 19, text: "Un plan 4,1 millones más barato que un crédito espera tu aprobación." },
  ],
  zh: [
    { at: 0, text: "早上好。当前现金 1.423 亿智利比索。" },
    { at: 6, text: "上海 Fresh Imports 已逾期45天，10月28日发薪有81%的风险。" },
    { at: 19, text: "有一项比贷款便宜410万比索的方案等待您批准。" },
  ],
};
const DURATION = 48;
const fmt = (s: number) => `00:${String(Math.floor(s)).padStart(2, "0")}`;

export default function ChannelsPage() {
  const t = useT();
  const [tl, setTl] = useState<TLang>("en");
  const [pos, setPos] = useState(12);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setPos((p) => {
        if (p >= DURATION) {
          setPlaying(false);
          return DURATION;
        }
        return p + 0.5;
      });
    }, 500);
    return () => clearInterval(timer.current);
  }, [playing]);

  const lines = TRANSCRIPT[tl];
  const current = [...lines].reverse().find((l) => pos >= l.at);

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">Msgs today</span><span className="v">14</span></div>
        <div className="tick"><span className="l">Delivery</span><span className="v up">100%</span></div>
      </Topbar>

      <div className="content">
        <h1 className="h1">Channels &amp; Conversations</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <figcaption className="mono small" style={{ display: "flex", gap: 8, alignItems: "center" }}><b>OWNER · WHATSAPP</b><span className="badge acc">Sandbox replay</span></figcaption>
            <div className="phone"><div className="phone-screen" style={{ background: "var(--bg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}><span className="brand-mark">南</span><div style={{ display: "flex", flexDirection: "column" }}><b className="small">NanFeng CFO</b><span className="mono small muted" style={{ fontSize: 10 }}>VERIFIED BUSINESS</span></div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px" }}>
                <div className="bubble in" style={{ borderColor: "var(--crit)" }}><b className="down">ALERT</b> Shanghai Fresh Imports moved USD 180,000 by 45d. P=0.81 cash &lt; 0 on Oct 28 (payroll).<span className="t">09:09</span></div>
                <div className="bubble in">PLAN factoring USD 120k (Banco Pacífico) + CNY fwd ¥1.2M. −CLP 4.1M vs loan. Reply APPROVE / WHY<span className="t">09:09</span></div>
                <div className="bubble out">WHY<span className="t">09:12</span></div>
                <div className="bubble in">Loan lands D21 (after payroll), costs 12.6M vs 8.5M.<span className="t">09:12</span></div>
                <div className="bubble out">APPROVE<span className="t">09:13</span></div>
                <div className="bubble in">OTP sent by SMS to •••• 4127. Reply with it. We never ask by phone.<span className="t">09:13</span></div>
                <div className="bubble out"><span className="num">{SANDBOX_OTP}</span><span className="t">09:14</span></div>
                <div className="bubble in" style={{ borderColor: "var(--ok)" }}><b className="up">EXECUTED</b> ref BP-77120 (sandbox). Funds ETA Oct 11.<span className="t">09:14</span></div>
              </div>
            </div></div>
          </figure>

          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <figcaption className="mono small" style={{ display: "flex", gap: 8, alignItems: "center" }}><b>IMPORTER · WECOM</b><span className="badge warn">Simulated</span></figcaption>
            <div className="phone"><div className="phone-screen" style={{ background: "var(--bg)" }} lang="zh-CN">
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}><span className="brand-mark">南</span><div style={{ display: "flex", flexDirection: "column" }}><b className="small">Huerto Austral · 应收账款</b><span className="small muted" style={{ fontSize: 11 }}>由南风代发 · 模拟</span></div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px" }}>
                <span className="mono small muted" style={{ alignSelf: "center", fontSize: 11 }}>2026年10月09日 08:30</span>
                <div className="bubble in">尊敬的上海鲜果进口有限公司财务部：您好！关于发票 INV-2026-0871（USD 180,000，原到期日 2026年08月25日），我们尚未收到款项。如已安排付款，请忽略本提醒；如需调整付款计划，欢迎随时沟通。谢谢！<span className="t">08:30</span></div>
                <div className="bubble out">收到，我们会在本周内确认付款时间。<span className="t">10:02</span></div>
                <div className="bubble in">非常感谢！确认后我们将同步更新对账单。<span className="t">10:03</span></div>
              </div>
            </div></div>
          </figure>

          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <div className="card">
              <div className="card-h">
                <span className="h3">Voice briefing · 07:30</span>
                <div className="seg" role="group" aria-label="Transcript language">
                  {(["es", "en", "zh"] as TLang[]).map((l) => (
                    <button key={l} type="button" className={tl === l ? "on" : undefined} aria-pressed={tl === l} onClick={() => setTl(l)}>{l === "zh" ? "中文" : l.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div className="card-b">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button className="btn btn-primary" type="button" aria-label={playing ? "Pause briefing" : "Play briefing"} style={{ width: 44, padding: 0 }} onClick={() => { if (pos >= DURATION) setPos(0); setPlaying((p) => !p); }}>
                    {playing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                  <input aria-label="Seek" type="range" className="range" min={0} max={DURATION} step={0.5} value={pos} onChange={(e) => setPos(+e.target.value)} style={{ flex: 1 }} />
                  <span className="num small muted">{fmt(pos)}/{fmt(DURATION)}</span>
                </div>
                <div className="mono small" style={{ display: "flex", flexDirection: "column", gap: 4, lineHeight: 1.6 }} lang={tl === "zh" ? "zh-CN" : tl}>
                  {lines.map((l) => (
                    <span key={l.at} style={current === l ? { background: "var(--accent-soft)" } : undefined}><span className="muted">[{fmt(l.at)}]</span> {l.text}</span>
                  ))}
                </div>
                <span className="hint">TRANSCRIPT PREVIEW · AUDIO FROM ELEVENLABS ONCE CONNECTED</span>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><span className="h3">Dispatch log · run #0412</span></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Time</th><th>{t("nav.channels")}</th><th>To</th><th>Lang</th><th>State</th></tr></thead>
                <tbody>
                  <tr><td className="num">09:14</td><td>WhatsApp</td><td>Owner</td><td className="num">EN</td><td><span className="badge ok">Read</span></td></tr>
                  <tr><td className="num">09:13</td><td>SMS</td><td>Owner · OTP</td><td className="num">—</td><td><span className="badge ok">Delivered</span></td></tr>
                  <tr><td className="num">08:30</td><td>WeCom</td><td>Importer</td><td className="num">ZH</td><td><span className="badge warn">Simulated</span></td></tr>
                  <tr><td className="num">07:30</td><td>Voice</td><td>Owner</td><td className="num">EN</td><td><span className="badge ok">Played</span></td></tr>
                  <tr><td className="num">—</td><td>LINE</td><td>—</td><td className="num">—</td><td><span className="badge">Not connected</span></td></tr>
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
