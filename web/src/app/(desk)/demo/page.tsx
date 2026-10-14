"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OwnerChart } from "@/components/owner-view";
import { Receipt } from "@/components/receipt";
import { TourButton } from "@/components/director";
import { Topbar } from "@/components/topbar";
import { useDemoReplay } from "@/lib/demo-replay";
import { SANDBOX_OTP, useDesk } from "@/lib/desk-state";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, RECEIVABLE, S, SHORT_CUSTOMER, SHORT_CUSTOMER_ZH, cashTick, cny, longDate, pesos, productShort, usd } from "@/lib/scenario";

// Deterministic replay of the Cherry Crisis (fixed seed, no network), for the jury and the video.
// Each step shows its own panel next to the cash chart; the last one leaves the desk approved.
const LABELS: Record<Lang, string[]> = {
  en: ["DELAY", "FORECAST", "QUOTES", "PLAN", "APPROVE", "CLOSED"],
  es: ["ATRASO", "PRONÓSTICO", "COTIZACIONES", "PLAN", "APROBAR", "CERRADA"],
  zh: ["延迟", "预测", "报价", "方案", "批准", "补足"],
};
const UI = {
  en: {
    cash: "Cash", exit: "Exit demo", step: "STEP", delayed: `Delayed +${N.delayDays}D`, plan: "Plan", run: "RUN CHERRY CRISIS", searching: "SEARCHING…", pae: "PAE LOAN", executed: "EXECUTED", pNeg: `Chance cash runs out · by day ${N.crunchDay}`,
    synced: "LIVE · SYNCED WITH BACKEND", offline: "OFFLINE REPLAY", reset: "Restart demo", play: "Play demo", pause: "Pause demo", next: "Next step",
    start: "Play the Cherry Crisis", startSub: "6 steps · about 25 seconds · space to pause",
    endTitle: "Your turn", endBody: "The run left the desk approved. Reset it and approve the loan yourself with the sandbox code, or let the tour walk you through the real screens.", tryIt: "Approve it yourself",
    mail: "Email from the importer · 10:12", read: "What NanFeng read", inv: "Invoice", amount: "Amount", delay: "Delay", newDate: "New date",
    risk: "Chance of running out of cash", on: "on payroll day", before: "before the notice", payroll: "Harvest payroll", need: "To cover",
    quotes: "Cost of closing the gap with each option", quotesHint: "same goal: cash above the buffer in 90% of scenarios",
    rec: "Optimizer's pick", recTitle: `${N.termDays}-day USD pre-export loan`, ours: "This loan", bank: "Bank loan", save: "Saved",
    wa: "Owner · WhatsApp", waPlan: `PLAN ${usd(N.loanUsd)} for ${N.termDays} days. Costs ${pesos(N.planCost)} vs ${pesos(N.defaultCost)}. Reply APPROVE or WHY`, waYes: "APPROVE", waCode: "Sandbox code (no SMS is sent)", l3: "owner + one-time code",
  },
  es: {
    cash: "Caja", exit: "Salir de la demo", step: "PASO", delayed: `Atrasado +${N.delayDays}D`, plan: "Plan", run: "CORRER CHERRY CRISIS", searching: "BUSCANDO…", pae: "CRÉDITO PAE", executed: "EJECUTADO", pNeg: `Riesgo de quedar sin caja · al día ${N.crunchDay}`,
    synced: "EN VIVO · SINCRONIZADO", offline: "REPLAY SIN RED", reset: "Reiniciar demo", play: "Reproducir demo", pause: "Pausar demo", next: "Paso siguiente",
    start: "Reproducir la Cherry Crisis", startSub: "6 pasos · unos 25 segundos · espacio para pausar",
    endTitle: "Ahora tú", endBody: "La corrida dejó el escritorio aprobado. Reinícialo y aprueba tú el crédito con el código del sandbox, o deja que el recorrido te muestre las pantallas reales.", tryIt: "Apruébalo tú",
    mail: "Correo del importador · 10:12", read: "Lo que leyó NanFeng", inv: "Factura", amount: "Monto", delay: "Atraso", newDate: "Nueva fecha",
    risk: "Riesgo de quedar sin caja", on: "el día de los sueldos", before: "antes del aviso", payroll: "Sueldos de la cosecha", need: "Hay que cubrir",
    quotes: "Cuánto costaría cerrar la brecha con cada opción", quotesHint: "misma meta: caja sobre el colchón en el 90% de los escenarios",
    rec: "Lo que eligió el optimizador", recTitle: `Crédito de pre-exportación en USD a ${N.termDays} días`, ours: "Este crédito", bank: "Crédito bancario", save: "Ahorro",
    wa: "Dueño · WhatsApp", waPlan: `PLAN ${usd(N.loanUsd, "es")} a ${N.termDays} días. Cuesta ${pesos(N.planCost, "es")} vs ${pesos(N.defaultCost, "es")}. Responde APROBAR o POR QUÉ`, waYes: "APROBAR", waCode: "Código sandbox (no se envía SMS)", l3: "dueño + código de un solo uso",
  },
  zh: {
    cash: "现金", exit: "退出演示", step: "步骤", delayed: `延迟 +${N.delayDays}天`, plan: "方案", run: "运行樱桃危机", searching: "搜索中…", pae: "PAE 贷款", executed: "已执行", pNeg: `现金耗尽概率 · 第${N.crunchDay}天前`,
    synced: "实时 · 已与后端同步", offline: "离线回放", reset: "重新开始", play: "播放演示", pause: "暂停演示", next: "下一步",
    start: "播放“樱桃危机”", startSub: "6个步骤 · 约25秒 · 空格键暂停",
    endTitle: "轮到您了", endBody: "演示已将方案批准。重置后，用沙盒验证码亲自批准这笔贷款，或跟随导览浏览真实界面。", tryIt: "亲自批准",
    mail: "进口商邮件 · 10:12", read: "南风读取的内容", inv: "发票", amount: "金额", delay: "延迟", newDate: "新日期",
    risk: "现金耗尽概率", on: "发薪日", before: "通知之前", payroll: "采收工资", need: "需补足",
    quotes: "用各方案补足缺口的成本", quotesHint: "同一目标：90%情景中现金高于安全垫",
    rec: "优化器的选择", recTitle: `${N.termDays}天期美元出口前融资`, ours: "此贷款", bank: "银行贷款", save: "节省",
    wa: "企业主 · WhatsApp", waPlan: `方案：${usd(N.loanUsd, "zh")}，${N.termDays}天。成本${pesos(N.planCost, "zh")}，银行贷款${pesos(N.defaultCost, "zh")}。请回复“批准”或“原因”`, waYes: "批准", waCode: "沙盒验证码（不发送短信）", l3: "企业主 + 一次性验证码",
  },
};
const LENDERS = new Set(S.arena.map((a) => a.lender)).size;
const CAPTIONS: Record<Lang, string[]> = {
  en: [
    `${SHORT_CUSTOMER} will pay ${usd(N.overdueUsd)} ${N.delayDays} days late`,
    `10,000 scenarios: ${N.pNeg} chance cash < 0 on day ${N.crunchDay}, harvest payroll`,
    `${N.products} financing products checked, ${N.eligible} eligible from ${LENDERS} lenders, compared in seconds`,
    `Optimizer: ${N.termDays}-day USD pre-export loan, ${N.savingsPct} cheaper than the bank loan`,
    "Owner approves with a 6-digit one-time code (sandbox code in this demo)",
    `Cash stays above the safety buffer in ${N.coverage} of scenarios · hash-chained · anchored on-chain`,
  ],
  es: [
    `${SHORT_CUSTOMER} pagará ${usd(N.overdueUsd, "es")} con ${N.delayDays} días de atraso`,
    `10.000 escenarios: ${N.pNeg} de probabilidad de caja < 0 el día ${N.crunchDay}, la nómina de cosecha`,
    `${N.products} productos de financiamiento revisados, ${N.eligible} elegibles de ${LENDERS} prestamistas, comparados en segundos`,
    `Optimizador: crédito de pre-exportación en USD a ${N.termDays} días, ${N.savingsPct} más barato que el crédito bancario`,
    "El dueño aprueba con un código de un solo uso de 6 dígitos (código sandbox en esta demo)",
    `La caja queda sobre el colchón en el ${N.coverage} de los escenarios · hash encadenado · anclado on-chain`,
  ],
  zh: [
    `${SHORT_CUSTOMER_ZH}将推迟${N.delayDays}天支付 ${usd(N.overdueUsd, "zh")}`,
    `10,000 次模拟：第${N.crunchDay}天（采收工资日）现金为负的概率为${N.pNeg}`,
    `数秒内评估${N.products}种融资产品，其中${N.eligible}种符合条件（来自${LENDERS}家贷款方）`,
    `优化器：${N.termDays}天期美元出口前融资，比银行贷款便宜${N.savingsPct}`,
    "企业主输入6位一次性验证码批准（本演示为沙盒验证码）",
    `${N.coverage}的情景中现金高于安全垫 · 哈希链 · 已上链锚定`,
  ],
};

// The chosen plan has no "alone" cost in the engine output: it is the plan itself.
const PRICED = S.explanation
  .map((r) => ({ ...r, cost: r.selected ? N.planCost : r.aloneCostClp }))
  .filter((r): r is typeof r & { cost: number } => r.cost !== null)
  .sort((a, b) => a.cost - b.cost);
const MAX = Math.max(...PRICED.map((r) => r.cost));
const newDate = new Date(Date.parse(`${RECEIVABLE.due_date}T12:00:00`) + N.delayDays * 864e5).toISOString().slice(0, 10);
const zhAmt = (v: number, lang: Lang) => (lang === "zh" ? `${pesos(v, "zh")}（${cny(v)}）` : pesos(v, lang));

function Stage({ step, lang }: { step: number; lang: Lang }) {
  const u = UI[lang];
  if (step === 1) {
    return (
      <div className="demo-stage">
        <span className="kpi-l">{u.mail}</span>
        <blockquote className="demo-mail" lang="zh-CN">尊敬的客户：发票 {RECEIVABLE.id}（USD {N.overdueUsd.toLocaleString("en-US")}）原定 {S.event.due_date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}付款，因资金安排将延迟{N.delayDays}天支付。敬请谅解。</blockquote>
        <span className="kpi-l">{u.read}</span>
        <dl className="demo-kv">
          <div><dt>{u.inv}</dt><dd className="num">{RECEIVABLE.id}</dd></div>
          <div><dt>{u.amount}</dt><dd className="num">{usd(N.overdueUsd, lang)}</dd></div>
          <div><dt>{u.delay}</dt><dd className="num down">+{N.delayDays}D</dd></div>
          <div><dt>{u.newDate}</dt><dd className="num">{longDate(newDate, lang)}</dd></div>
        </dl>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="demo-stage">
        <span className="kpi-l">{u.risk}</span>
        <span className="demo-big down">{N.pNeg}</span>
        <span className="small">{u.on} · {longDate(N.crunchDate, lang)} · <span className="muted">{N.pNegBefore} {u.before}</span></span>
        <dl className="demo-kv">
          <div><dt>{u.payroll}</dt><dd className="num">{zhAmt(N.payroll, lang)}</dd></div>
          <div><dt>{u.need}</dt><dd className="num">{zhAmt(S.need.amount_clp, lang)}</dd></div>
        </dl>
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="demo-stage">
        <span className="kpi-l">{u.quotes}</span>
        <span className="small muted">{u.quotesHint}</span>
        <ul className="demo-bars">
          {PRICED.map((r) => (
            <li key={r.productId} className={r.selected ? "on" : undefined}>
              <span>{productShort(r.product, lang)}</span>
              <i style={{ width: `${(r.cost / MAX) * 100}%` }} />
              <b className="num">{pesos(r.cost, lang)}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (step === 4) {
    const ratio = N.planCost / N.defaultCost;
    return (
      <div className="demo-stage">
        <span className="kpi-l">{u.rec}</span>
        <span className="h3">{u.recTitle}</span>
        <span className="demo-big">{usd(N.loanUsd, lang)}</span>
        <div className="owner-compare">
          <div><span>{u.ours}</span><i style={{ width: `${ratio * 100}%`, background: "var(--ok)" }} /><b>{zhAmt(N.planCost, lang)}</b></div>
          <div><span>{u.bank}</span><i style={{ width: "100%", background: "var(--line-2)" }} /><b>{zhAmt(N.defaultCost, lang)}</b></div>
        </div>
        <span className="small up"><b>{u.save} {pesos(N.savings, lang)} ({N.savingsPct})</b></span>
      </div>
    );
  }
  if (step === 5) {
    return (
      <div className="demo-stage">
        <span className="kpi-l">{u.wa}</span>
        <div className="demo-chat">
          <div className="bubble in">{u.waPlan}</div>
          <div className="bubble out">{u.waYes}</div>
          <div className="bubble in">{u.waCode}</div>
          <div className="bubble out"><span className="num">{SANDBOX_OTP}</span></div>
        </div>
        <span className="tier t3" style={{ alignSelf: "flex-start" }}><b>L3</b><span>{u.l3}</span></span>
      </div>
    );
  }
  return (
    <div className="demo-stage">
      <Receipt />
      <DemoEnd lang={lang} />
    </div>
  );
}

/** After the run: approve it yourself on a clean sandbox, or take the guided tour of the real screens. */
function DemoEnd({ lang }: { lang: Lang }) {
  const u = UI[lang];
  const router = useRouter();
  const { resetDemo } = useDesk();
  return (
    <div className="demo-end">
      <b>{u.endTitle}</b>
      <span className="small muted">{u.endBody}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={async () => { await resetDemo(); router.push("/approvals"); }}>{u.tryIt}</button>
        <TourButton className="btn btn-secondary" />
      </div>
    </div>
  );
}

export default function DemoPage() {
  const lang = useLang();
  const { finishDemo, resetDemo } = useDesk();
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const play = (on: boolean) => {
    setStarted(true);
    setPlaying(on);
  };
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("play") !== "1") return;
    const id = setTimeout(() => {
      setStarted(true);
      setPlaying(true);
    }, 600);
    return () => clearTimeout(id);
  }, []);
  // Live API: each step really happens on the backend and every other screen follows (lib/demo-replay).
  const replay = useDemoReplay(step, playing);

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
    }, 4000);
    return () => clearInterval(id);
  }, [playing]);

  // The run ends with the plan executed: the rest of the desk shows it approved too.
  useEffect(() => {
    if (step === 6) finishDemo();
  }, [step, finishDemo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " ") { e.preventDefault(); setStarted(true); setPlaying((p) => !p); }
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
  const restart = () => {
    setPlaying(false);
    setStep(1);
    if (!replay.live) void resetDemo(); // live: the replay's step 1 resets the backend sandbox
  };

  return (
    <>
      <Topbar controls={false}>
        <div className="tick"><span className="l">{u.cash}</span><span className="v">{cashTick(S.openingCashClp, lang)}</span></div>
        <span className="status"><span className="dot crit blink" />DEMO · CHERRY CRISIS · {u.step} {step}/6</span>
        <span className={`badge${replay.state === "error" ? " crit" : replay.live ? " ok" : ""}`} title={replay.message} role="status">
          {replay.state === "error" ? replay.message : replay.live ? u.synced : u.offline}{replay.state === "running" ? " …" : ""}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/cockpit" className="btn btn-secondary btn-sm">{u.exit}</Link>
        </span>
      </Topbar>
      <div className="content" style={{ flex: 1 }}>
        <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="kpi"><span className="kpi-l">{u.pNeg}</span><span className="kpi-v" style={{ fontSize: "clamp(32px, 5vw, 52px)", color: probColor }}>{prob}</span></div>
          <div className="kpi"><span className="kpi-l">{u.delayed}</span><span className="kpi-v" style={{ fontSize: "clamp(24px, 4vw, 40px)" }}>{usd(N.overdueUsd, lang)}</span></div>
          <div className="kpi"><span className="kpi-l">{u.plan}</span><span className="kpi-v" style={{ fontSize: "clamp(20px, 3vw, 30px)", color: fixed ? "var(--ok)" : undefined }}>{plan}</span></div>
        </div>
        <div className="demo-grid">
          <div className="card owner-card"><OwnerChart stage={step === 1 ? "before" : fixed ? "resolved" : "after"} /></div>
          <div className="card" key={step}><Stage step={step} lang={lang} /></div>
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, display: "flex", flexDirection: "column", zIndex: 5 }}>
        {!started && step === 1 ? (
          <button type="button" className="demo-start" onClick={() => play(true)}>
            <span className="demo-start-ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
            <span><b>{u.start}</b><span>{u.startSub}</span></span>
          </button>
        ) : (
        <div style={{ margin: "0 16px 12px", alignSelf: "flex-start", display: "flex", maxWidth: 1000, border: "1px solid #1F3358" }} aria-live="polite">
          <span className="mono" style={{ background: "#1F3358", color: "#FFFFFF", padding: "14px 16px", fontWeight: 700, fontSize: 18 }}>0{step}/06</span>
          <span style={{ background: "#14171C", color: "#F3F3EF", padding: "14px 20px", fontSize: "clamp(16px, 2.2vw, 24px)", fontFamily: "var(--f-display)", fontWeight: 600, lineHeight: 1.25 }}>{CAPTIONS[lang][step - 1]}</span>
        </div>
        )}
        <div style={{ height: 3, background: "#232930" }}><div style={{ height: 3, background: "var(--accent)", width: `${Math.round((step / 6) * 100)}%`, transition: "width .4s" }} /></div>
        <div className="demo-bar" style={{ borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <span style={{ fontWeight: 700, letterSpacing: ".08em", fontSize: 13 }}>{u.run}</span>
          <div className="demo-steps">
            {LABELS[lang].map((label, i) => (
              <button key={label} className={`demo-step${i + 1 < step ? " done" : i + 1 === step ? " now" : ""}`} type="button" aria-current={i + 1 === step ? "step" : undefined} onClick={() => { setStarted(true); setStep(i + 1); }} style={{ background: i + 1 === step ? undefined : "transparent", border: 0, borderRight: "1px solid #2A313C", fontFamily: "var(--f-mono)", cursor: "pointer" }}>
                <i>{i + 1}</i>{label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="ctl" type="button" aria-label={u.reset} title={u.reset} onClick={restart}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5" /></svg>
            </button>
            <button className="ctl ctl-main" type="button" aria-label={playing ? u.pause : u.play} title={playing ? u.pause : u.play} onClick={() => { if (step >= 6) setStep(1); play(!playing); }}>
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button className="ctl" type="button" aria-label={u.next} title={u.next} onClick={() => setStep((s) => Math.min(6, s + 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
