"use client";

import { useEffect, useRef, useState } from "react";
import { Topbar } from "@/components/topbar";
import { SANDBOX_OTP, SANDBOX_RECEIPT, useDesk, type ApprovalStatus } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, RECEIVABLE, S, clpM, longDate, pesos, usd } from "@/lib/scenario";

// Alert call script (ElevenLabs). Numbers from the quant engine's Cherry Crisis run.
const TRANSCRIPT: Record<Lang, { at: number; text: string }[]> = {
  en: [
    { at: 0, text: `Good morning. Cash today: CLP ${Math.round(S.openingCashClp / 1e6)} million.` },
    { at: 6, text: `Shanghai Hongxin will pay ${N.delayDays} days late: ${N.pNeg} risk for the harvest payroll on December 30.` },
    { at: 19, text: `A plan ${clpM(N.savings).replace("CLP ", "")} pesos cheaper than a bank loan needs your approval.` },
  ],
  es: [
    { at: 0, text: `Buenos días. Caja de hoy: ${Math.round(S.openingCashClp / 1e6)} millones de pesos.` },
    { at: 6, text: `Shanghai Hongxin pagará con ${N.delayDays} días de atraso: ${N.pNeg} de riesgo para la nómina de cosecha del 30 de diciembre.` },
    { at: 19, text: `Un plan ${(N.savings / 1e6).toFixed(1).replace(".", ",")} millones más barato que un crédito bancario espera tu aprobación.` },
  ],
  zh: [
    { at: 0, text: `早上好。今日现金 ${(S.openingCashClp / 1e8).toFixed(2)} 亿智利比索。` },
    { at: 6, text: `上海鸿信将延迟${N.delayDays}天付款，12月30日采收工资发放有${N.pNeg}的风险。` },
    { at: 19, text: `有一项比银行贷款便宜${clpM(N.savings, "zh").replace("智利比索", "比索")}的方案等待您批准。` },
  ],
};
const DURATION = 48;
const fmt = (s: number) => `00:${String(Math.floor(s)).padStart(2, "0")}`;

type Bubble = { who: "in" | "out"; text: React.ReactNode; t: string; tone?: "crit" | "ok" };

const REJECTED: Record<Lang, string> = {
  en: "Plan rejected on the web. I am preparing the next-cheapest option (export factoring) and will ask you again.",
  es: "Plan rechazado en la web. Estoy preparando la siguiente opción más barata (factoring de exportación) y te vuelvo a preguntar.",
  zh: "方案已在网页上被拒绝。我正在准备次优方案（出口保理），稍后再请您确认。",
};

// The owner's WhatsApp thread, in the owner's language, as far as the approval has gone: before the
// decision it ends at the "why" answer; the code and the execution appear once the plan is approved.
function ownerThread(lang: Lang, approval: ApprovalStatus, ref: string): Bubble[] {
  const all = fullThread(lang, ref);
  if (approval === "approved") return all;
  if (approval === "rejected") return [...all.slice(0, 4), { who: "in", t: "10:16", text: REJECTED[lang] }];
  return all.slice(0, 4);
}

function fullThread(lang: Lang, ref: string): Bubble[] {
  const date = longDate(N.crunchDate, lang);
  if (lang === "es") return [
    { who: "in", tone: "crit", t: "10:13", text: <><b className="down">ALERTA</b> Shanghai Hongxin pagará {usd(N.overdueUsd, "es")} con {N.delayDays} días de atraso. Hay {N.pNeg} de probabilidad de quedar sin caja el {date} (sueldos {pesos(N.payroll, "es")}).</> },
    { who: "in", t: "10:15", text: <>PLAN Crédito de pre-exportación por {usd(N.loanUsd, "es")} a {N.termDays} días ({N.lender}). Cuesta {pesos(N.planCost, "es")} vs {pesos(N.defaultCost, "es")} del crédito bancario. Responde APROBAR o POR QUÉ</> },
    { who: "out", t: "10:15", text: "POR QUÉ" },
    { who: "in", t: "10:15", text: <>Es {N.savingsPct} más barato y se paga en dólares con lo que te paguen por tus envíos. La caja queda sobre el colchón en el {N.coverage} de 10.000 escenarios.</> },
    { who: "out", t: "10:16", text: "APROBAR" },
    { who: "in", t: "10:16", text: "Te enviamos un código por SMS al •••• 4127. Respóndelo aquí. Nunca te lo pediremos por teléfono." },
    { who: "out", t: "10:16", text: <span className="num">{SANDBOX_OTP}</span> },
    { who: "in", tone: "ok", t: "10:16", text: <><b className="up">EJECUTADO</b> ref. {ref} (sandbox). La plata llega el {date}.</> },
  ];
  if (lang === "zh") return [
    { who: "in", tone: "crit", t: "10:13", text: <><b className="down">警报</b> 上海鸿信将延迟{N.delayDays}天支付 {usd(N.overdueUsd, "zh")}。{date}现金不足的概率为{N.pNeg}（工资{pesos(N.payroll, "zh")}）。</> },
    { who: "in", t: "10:15", text: <>方案：{N.termDays}天期出口前融资 {usd(N.loanUsd, "zh")}（{N.lender}）。成本{pesos(N.planCost, "zh")}，银行贷款需{pesos(N.defaultCost, "zh")}。请回复“批准”或“原因”</> },
    { who: "out", t: "10:15", text: "原因" },
    { who: "in", t: "10:15", text: <>便宜{N.savingsPct}，并以出口美元收入偿还。10,000个情景中{N.coverage}现金高于安全垫。</> },
    { who: "out", t: "10:16", text: "批准" },
    { who: "in", t: "10:16", text: "验证码已通过短信发送至 •••• 4127，请在此回复。我们绝不会通过电话索取。" },
    { who: "out", t: "10:16", text: <span className="num">{SANDBOX_OTP}</span> },
    { who: "in", tone: "ok", t: "10:16", text: <><b className="up">已执行</b> 编号 {ref}（沙盒）。资金于{date}到账。</> },
  ];
  return [
    { who: "in", tone: "crit", t: "10:13", text: <><b className="down">ALERT</b> Shanghai Hongxin will pay {usd(N.overdueUsd)} {N.delayDays} days late. {N.pNeg} chance of running out of cash on {date} (payroll {pesos(N.payroll)}).</> },
    { who: "in", t: "10:15", text: <>PLAN {N.termDays}-day pre-export loan of {usd(N.loanUsd)} ({N.lender}). Costs {pesos(N.planCost)} vs {pesos(N.defaultCost)} for the bank loan. Reply APPROVE or WHY</> },
    { who: "out", t: "10:15", text: "WHY" },
    { who: "in", t: "10:15", text: <>{N.savingsPct} cheaper and repaid in dollars with your export income. Cash stays above the buffer in {N.coverage} of 10,000 scenarios.</> },
    { who: "out", t: "10:16", text: "APPROVE" },
    { who: "in", t: "10:16", text: "We sent a code by SMS to •••• 4127. Reply with it here. We will never ask for it by phone." },
    { who: "out", t: "10:16", text: <span className="num">{SANDBOX_OTP}</span> },
    { who: "in", tone: "ok", t: "10:16", text: <><b className="up">EXECUTED</b> ref {ref} (sandbox). Funds arrive on {date}.</> },
  ];
}

const TX = {
  en: {
    msgs: "Messages today", delivery: "Delivered", owner: "Owner · WhatsApp", replay: "Sandbox replay", ownerNote: "In the owner's language",
    importer: "Importer · WeCom", simulated: "Simulated", importerNote: "In the importer's language", verified: "VERIFIED BUSINESS",
    call: "Alert call · 10:13", transcriptLang: "Transcript language", play: "Play call", pause: "Pause call", seek: "Position",
    preview: "Transcript preview · audio from ElevenLabs once connected",
    log: "Sent today", cols: ["Time", "Channel", "To", "Language", "Status"],
    to: { owner: "Owner", otp: "Owner · code", importer: "Importer" }, st: { read: "Read", delivered: "Delivered", simulated: "Simulated", played: "Played", off: "Not connected" },
  },
  es: {
    msgs: "Mensajes hoy", delivery: "Entregados", owner: "Dueño · WhatsApp", replay: "Reproducción sandbox", ownerNote: "En el idioma del dueño",
    importer: "Importador · WeCom", simulated: "Simulado", importerNote: "En el idioma del importador", verified: "EMPRESA VERIFICADA",
    call: "Llamada de alerta · 10:13", transcriptLang: "Idioma de la transcripción", play: "Reproducir llamada", pause: "Pausar llamada", seek: "Posición",
    preview: "Vista previa de la transcripción · audio de ElevenLabs al conectarlo",
    log: "Enviados hoy", cols: ["Hora", "Canal", "Para", "Idioma", "Estado"],
    to: { owner: "Dueño", otp: "Dueño · código", importer: "Importador" }, st: { read: "Leído", delivered: "Entregado", simulated: "Simulado", played: "Escuchada", off: "Sin conectar" },
  },
  zh: {
    msgs: "今日消息", delivery: "送达率", owner: "企业主 · WhatsApp", replay: "沙盒回放", ownerNote: "使用企业主的语言",
    importer: "进口商 · 企业微信", simulated: "模拟", importerNote: "使用进口商的语言", verified: "已认证企业",
    call: "警报电话 · 10:13", transcriptLang: "转写语言", play: "播放通话", pause: "暂停通话", seek: "进度",
    preview: "转写预览 · 接入后由 ElevenLabs 提供音频",
    log: "今日发送", cols: ["时间", "渠道", "接收方", "语言", "状态"],
    to: { owner: "企业主", otp: "企业主 · 验证码", importer: "进口商" }, st: { read: "已读", delivered: "已送达", simulated: "模拟", played: "已收听", off: "未连接" },
  },
};

const LANG_TAG: Record<Lang, string> = { en: "EN", es: "ES", zh: "中文" };

export default function ChannelsPage() {
  const t = useT();
  const lang = useLang();
  const x = TX[lang];
  const { approval, mode, approvalId } = useDesk();
  const ref = mode === "live" ? approvalId : SANDBOX_RECEIPT.ref;
  const [picked, setPicked] = useState<Lang | null>(null);
  const tl = picked ?? lang;
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
  const ownerLang = LANG_TAG[lang];

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{x.msgs}</span><span className="v">14</span></div>
        <div className="tick"><span className="l">{x.delivery}</span><span className="v up">100%</span></div>
      </Topbar>

      <div className="content">
        <h1 className="h1">{t("tab.conversations")}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <figcaption className="small" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{x.owner}</b><span className="badge acc">{x.replay}</span><span className="muted">{x.ownerNote}</span></figcaption>
            <div className="phone" data-guide="msg-owner"><div className="phone-screen" style={{ background: "var(--bg)" }} lang={lang === "zh" ? "zh-CN" : lang}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}><span className="brand-mark">南</span><div style={{ display: "flex", flexDirection: "column" }}><b className="small">NanFeng CFO</b><span className="mono small muted" style={{ fontSize: 10 }}>{x.verified}</span></div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px" }}>
                {ownerThread(lang, approval, ref).map((b, i) => (
                  <div key={i} className={`bubble ${b.who}`} style={b.tone ? { borderColor: b.tone === "crit" ? "var(--crit)" : "var(--ok)" } : undefined}>{b.text}<span className="t">{b.t}</span></div>
                ))}
              </div>
            </div></div>
          </figure>

          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <figcaption className="small" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>{x.importer}</b><span className="badge warn">{x.simulated}</span><span className="muted">{x.importerNote}</span></figcaption>
            <div className="phone" data-guide="msg-importer"><div className="phone-screen" style={{ background: "var(--bg)" }} lang="zh-CN">
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)", background: "var(--surface)" }}><span className="brand-mark">南</span><div style={{ display: "flex", flexDirection: "column" }}><b className="small">Huerto Austral · 应收账款</b><span className="small muted" style={{ fontSize: 11 }}>由南风代发 · 模拟</span></div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 10px" }}>
                <span className="mono small muted" style={{ alignSelf: "center", fontSize: 11 }}>2026年12月11日 10:20</span>
                <div className="bubble in">尊敬的上海鸿信鲜果进口有限公司财务部：您好！感谢告知发票 {RECEIVABLE.id}（USD 180,000，原到期日 2026年12月18日）将延迟{N.delayDays}天付款。请确认新的付款日期；如可提前支付部分款项，欢迎随时沟通。谢谢！<span className="small muted" style={{ display: "block", fontSize: 11, marginTop: 4 }}>【本消息由AI生成】</span><span className="t">10:20</span></div>
                <div className="bubble out">收到，我们会在本周内确认付款时间。<span className="t">11:02</span></div>
                <div className="bubble in">非常感谢！确认后我们将同步更新对账单。<span className="small muted" style={{ display: "block", fontSize: 11, marginTop: 4 }}>【本消息由AI生成】</span><span className="t">11:03</span></div>
              </div>
            </div></div>
          </figure>

          <div style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <div className="card" data-guide="msg-voice">
              <div className="card-h">
                <span className="h3">{x.call}</span>
                <div className="seg" role="group" aria-label={x.transcriptLang}>
                  {(["es", "en", "zh"] as Lang[]).map((l) => (
                    <button key={l} type="button" className={tl === l ? "on" : undefined} aria-pressed={tl === l} onClick={() => setPicked(l)}>{LANG_TAG[l]}</button>
                  ))}
                </div>
              </div>
              <div className="card-b">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button className="btn btn-primary" type="button" aria-label={playing ? x.pause : x.play} style={{ width: 44, padding: 0 }} onClick={() => { if (pos >= DURATION) setPos(0); setPlaying((p) => !p); }}>
                    {playing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                  <input aria-label={x.seek} type="range" className="range" min={0} max={DURATION} step={0.5} value={pos} onChange={(e) => setPos(+e.target.value)} style={{ flex: 1 }} />
                  <span className="num small muted">{fmt(pos)}/{fmt(DURATION)}</span>
                </div>
                <div className="small" style={{ display: "flex", flexDirection: "column", gap: 4, lineHeight: 1.6 }} lang={tl === "zh" ? "zh-CN" : tl}>
                  {lines.map((l) => (
                    <span key={l.at} style={current === l ? { background: "var(--accent-soft)", borderRadius: 6, padding: "0 4px" } : { padding: "0 4px" }}><span className="muted mono">[{fmt(l.at)}]</span> {l.text}</span>
                  ))}
                </div>
                <span className="hint">{x.preview}</span>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><span className="h3">{x.log}</span></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr>{x.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  <tr><td className="num">10:20</td><td>WeCom</td><td>{x.to.importer}</td><td className="num">中文</td><td><span className="badge warn">{x.st.simulated}</span></td></tr>
                  {approval === "approved" && <tr><td className="num">10:16</td><td>SMS</td><td>{x.to.otp}</td><td className="num">—</td><td><span className="badge ok">{x.st.delivered}</span></td></tr>}
                  <tr><td className="num">10:15</td><td>WhatsApp</td><td>{x.to.owner}</td><td className="num">{ownerLang}</td><td><span className="badge ok">{x.st.read}</span></td></tr>
                  <tr><td className="num">10:13</td><td>{lang === "es" ? "Voz" : lang === "zh" ? "语音" : "Voice"}</td><td>{x.to.owner}</td><td className="num">{ownerLang}</td><td><span className="badge ok">{x.st.played}</span></td></tr>
                  <tr><td className="num">—</td><td>LINE</td><td>—</td><td className="num">—</td><td><span className="badge">{x.st.off}</span></td></tr>
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
