"use client";

import Link from "next/link";
import { useState } from "react";
import { band, fx, fy, line } from "@/components/forecast-chart";
import { useDesk } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";
import { setPref, usePref, type Lang } from "@/lib/prefs";
import { N, S, SHORT_CUSTOMER, SHORT_CUSTOMER_ZH, dayOf, longDate, outOf10, pesos, usd } from "@/lib/scenario";

// The owner's view of the desk: what is happening, what NanFeng recommends and one decision, in
// plain words. Every number still comes from the quant engine (lib/scenario.ts); the full desk with
// probabilities, the optimizer and the audit trail is one click away ("Detailed view").

const crunch = (lang: Lang) => longDate(N.crunchDate, lang);
const in10 = outOf10(S.after.probNegByCrunch); // 8
const covered = Math.round(S.plan.coverage * 100); // 96
const repay = longDate(S.plan.maturity ?? N.crunchDate, "en");

type Copy = {
  today: string;
  intro: { title: string; steps: [string, string][]; ok: string };
  pending: { title: string; sub: (lang: Lang) => string };
  done: { title: string; sub: string };
  rejected: { title: string; sub: string };
  what: string;
  whatSteps: string[];
  chart: { title: string; hint: string; you: string; range: string; broke: string; payroll: string; after: string; before: string };
  rec: { eyebrow: string; title: string; body: string; ours: string; bank: string; save: string; safe: string; approve: string; why: string; all: string; reasons: string[] };
  next: { eyebrow: string; title: string; items: string[] };
  rej: { eyebrow: string; title: string; body: string; cta: string };
  agent: { title: string; items: [string, string][] };
  more: string;
  howItWorks: string;
};

const COPY: Record<Lang, Copy> = {
  en: {
    today: `Today · ${longDate(S.asOf, "en")}`,
    intro: {
      title: "Welcome to NanFeng, your autonomous CFO",
      steps: [
        ["We watch your cash every day", "Your bank balance, the invoices your customers owe you and every bill you have to pay."],
        ["We warn you before money runs short", "And we look for the cheapest way to cover the gap, comparing every option on the market."],
        ["Nothing happens without your OK", "You approve with a one-time code on WhatsApp or here. NanFeng never moves money on its own."],
      ],
      ok: "Got it",
    },
    pending: { title: "Your cash needs attention.", sub: (lang) => `There is an ${in10}-in-10 chance you won't have enough to pay the harvest payroll on ${crunch(lang)}.` },
    done: { title: "Done. Your payroll is covered.", sub: `The loan was requested with your approval. You saved ${pesos(N.savings)} compared with a regular bank loan.` },
    rejected: { title: "You turned down the plan.", sub: "NanFeng is preparing the next cheapest option. Your cash is still at risk until you choose one." },
    what: "What happened",
    whatSteps: [
      `${SHORT_CUSTOMER}, your buyer in Shanghai, says it will pay ${usd(N.overdueUsd)} ${N.delayDays} days late.`,
      `On ${crunch("en")} you pay ${pesos(N.payroll)} in harvest wages.`,
      `Without that payment you would be about ${pesos(S.need.amount_clp)} short that day.`,
    ],
    chart: { title: "Money in your bank, day by day", hint: "Most likely path and its probable range, from 10,000 simulations", you: "Your cash", range: "Probable range", broke: "No money", payroll: "Payroll", after: "With the plan", before: "Without the plan" },
    rec: {
      eyebrow: "What we recommend",
      title: "Take a pre-export loan in dollars",
      body: `The bank lends you ${usd(N.loanUsd)} on ${crunch("en")}. You pay it back in ${N.termDays} days with the money from your shipments.`,
      ours: "This loan", bank: "Regular bank loan",
      save: `You save ${pesos(N.savings)}`,
      safe: `With this, your cash stays safe in ${covered} out of 100 scenarios.`,
      approve: "Approve with code", why: "Why this option?", all: "See all 9 options",
      reasons: [
        `It is the cheapest of the ${S.arena.length} options that cover the gap in time.`,
        "The money arrives on payroll day, not weeks later.",
        `You repay in dollars when your buyers pay you, by ${repay}.`,
        "Factoring this invoice is not possible: the bank won't buy an invoice whose buyer already announced a delay.",
      ],
    },
    next: { eyebrow: "What happens next", title: "Nothing else for you to do", items: [`${crunch("en")}: the loan arrives and payroll goes out.`, `${repay}: the loan is repaid in dollars with your export income.`, "NanFeng keeps watching and will warn you if anything changes."] },
    rej: { eyebrow: "Next option", title: "Export factoring", body: "You sell part of your invoices to the bank and get the cash now. It costs a bit more than the loan.", cta: "Compare options" },
    agent: {
      title: "What NanFeng did for you today",
      items: [
        ["08:00", "Sent you the morning cash summary by voice."],
        ["08:47", "Blocked an invoice that tried to change a supplier's bank account."],
        ["10:12", "Read the delay notice from Shanghai."],
        ["10:14", `Compared ${S.explanation.length} ways to finance the gap.`],
        ["10:20", "Asked your buyer, in Chinese, to confirm the new payment date."],
      ],
    },
    more: "Want the full numbers? Open the detailed view",
    howItWorks: "How does NanFeng work?",
  },
  es: {
    today: `Hoy · ${longDate(S.asOf, "es")}`,
    intro: {
      title: "Bienvenido a NanFeng, tu gerente de finanzas",
      steps: [
        ["Vigilamos tu caja todos los días", "Tu saldo en el banco, las facturas que te deben tus clientes y cada cuenta que tienes que pagar."],
        ["Te avisamos antes de que falte plata", "Y buscamos la forma más barata de cubrir el hoyo, comparando todas las opciones del mercado."],
        ["Nada se hace sin tu OK", "Apruebas con un código por WhatsApp o aquí. NanFeng nunca mueve plata por su cuenta."],
      ],
      ok: "Entendido",
    },
    pending: { title: "Tu caja necesita atención.", sub: (lang) => `Hay ${in10} de cada 10 posibilidades de que el ${crunch(lang)} no te alcance para pagar los sueldos de la cosecha.` },
    done: { title: "Listo. Los sueldos están cubiertos.", sub: `El crédito se pidió con tu aprobación. Te ahorraste ${pesos(N.savings, "es")} frente a un crédito normal del banco.` },
    rejected: { title: "Rechazaste el plan.", sub: "NanFeng está preparando la siguiente opción más barata. Tu caja sigue en riesgo hasta que elijas una." },
    what: "Qué pasó",
    whatSteps: [
      `${SHORT_CUSTOMER}, tu cliente en Shanghái, avisó que pagará ${usd(N.overdueUsd, "es")} con ${N.delayDays} días de atraso.`,
      `El ${crunch("es")} pagas ${pesos(N.payroll, "es")} en sueldos de la cosecha.`,
      `Sin ese pago te faltarían unos ${pesos(S.need.amount_clp, "es")} ese día.`,
    ],
    chart: { title: "Tu plata en el banco, día a día", hint: "Lo más probable y su rango, según 10.000 simulaciones", you: "Tu caja", range: "Rango probable", broke: "Sin plata", payroll: "Sueldos", after: "Con el plan", before: "Sin el plan" },
    rec: {
      eyebrow: "Lo que te recomendamos",
      title: "Pedir un crédito de pre-exportación en dólares",
      body: `El banco te presta ${usd(N.loanUsd, "es")} el ${crunch("es")}. Lo devuelves en ${N.termDays} días con lo que te paguen por tus envíos.`,
      ours: "Este crédito", bank: "Crédito normal del banco",
      save: `Te ahorras ${pesos(N.savings, "es")}`,
      safe: `Con esto, tu caja queda segura en ${covered} de cada 100 escenarios.`,
      approve: "Aprobar con código", why: "¿Por qué esta opción?", all: "Ver las 9 opciones",
      reasons: [
        `Es la más barata de las ${S.arena.length} opciones que cubren el hoyo a tiempo.`,
        "La plata llega el mismo día de los sueldos, no semanas después.",
        `La devuelves en dólares cuando te paguen tus clientes, a más tardar el ${longDate(S.plan.maturity ?? N.crunchDate, "es")}.`,
        "No se puede hacer factoring de esta factura: el banco no compra una factura cuyo cliente ya avisó que pagará tarde.",
      ],
    },
    next: { eyebrow: "Lo que viene", title: "No tienes que hacer nada más", items: [`${crunch("es")}: llega el crédito y se pagan los sueldos.`, `${longDate(S.plan.maturity ?? N.crunchDate, "es")}: se devuelve el crédito en dólares con lo que te paguen.`, "NanFeng sigue vigilando y te avisa si algo cambia."] },
    rej: { eyebrow: "Siguiente opción", title: "Factoring de exportación", body: "Vendes parte de tus facturas al banco y recibes la plata ahora. Cuesta un poco más que el crédito.", cta: "Comparar opciones" },
    agent: {
      title: "Lo que NanFeng hizo por ti hoy",
      items: [
        ["08:00", "Te mandó el resumen de caja de la mañana por voz."],
        ["08:47", "Bloqueó una factura que intentaba cambiar la cuenta bancaria de un proveedor."],
        ["10:12", "Leyó el aviso de atraso de Shanghái."],
        ["10:14", `Comparó ${S.explanation.length} formas de financiar el hoyo.`],
        ["10:20", "Le pidió a tu cliente, en chino, que confirme la nueva fecha de pago."],
      ],
    },
    more: "¿Quieres ver todos los números? Abre la vista detallada",
    howItWorks: "¿Cómo funciona NanFeng?",
  },
  zh: {
    today: `今天 · ${longDate(S.asOf, "zh")}`,
    intro: {
      title: "欢迎使用南风，您的 AI 财务官",
      steps: [
        ["每天关注您的现金", "银行余额、客户欠您的发票，以及您需要支付的每一笔款项。"],
        ["在资金短缺之前提醒您", "并比较市场上所有方案，找到成本最低的补缺方式。"],
        ["未经您同意，绝不执行", "您通过 WhatsApp 或在此输入一次性验证码批准。南风从不自行动用资金。"],
      ],
      ok: "知道了",
    },
    pending: { title: "您的现金需要关注。", sub: (lang) => `${crunch(lang)}有十分之${in10}的可能无法足额发放采收工资。` },
    done: { title: "已完成，工资已有保障。", sub: `贷款已在您批准后申请。与普通银行贷款相比，您节省了${pesos(N.savings, "zh")}。` },
    rejected: { title: "您拒绝了该方案。", sub: "南风正在准备次优方案。在您做出选择之前，现金仍有风险。" },
    what: "发生了什么",
    whatSteps: [
      `您的上海买家${SHORT_CUSTOMER_ZH}通知将延迟${N.delayDays}天支付 ${usd(N.overdueUsd, "zh")}。`,
      `${crunch("zh")}您需要支付${pesos(N.payroll, "zh")}的采收工资。`,
      `没有这笔货款，当天将短缺约${pesos(S.need.amount_clp, "zh")}。`,
    ],
    chart: { title: "您的银行存款，逐日变化", hint: "基于10,000次模拟的最可能走势及其范围", you: "您的现金", range: "可能范围", broke: "资金耗尽", payroll: "发薪日", after: "采用方案后", before: "未采用方案" },
    rec: {
      eyebrow: "我们的建议",
      title: "申请美元出口前融资",
      body: `银行于${crunch("zh")}向您贷款 ${usd(N.loanUsd, "zh")}，您在${N.termDays}天内用出口货款偿还。`,
      ours: "此贷款", bank: "普通银行贷款",
      save: `节省${pesos(N.savings, "zh")}`,
      safe: `采用后，100个情景中有${covered}个现金安全。`,
      approve: "输入验证码批准", why: "为什么选这个？", all: "查看全部9个方案",
      reasons: [
        `在能及时补足缺口的${S.arena.length}个方案中成本最低。`,
        "资金在发薪当天到账，而不是几周后。",
        `买家付款后以美元偿还，最晚${longDate(S.plan.maturity ?? N.crunchDate, "zh")}。`,
        "这张发票无法保理：买家已通知延迟付款，银行不会买断。",
      ],
    },
    next: { eyebrow: "接下来", title: "您无需再做任何事", items: [`${crunch("zh")}：贷款到账，工资发放。`, `${longDate(S.plan.maturity ?? N.crunchDate, "zh")}：用出口美元收入偿还贷款。`, "南风会持续关注，如有变化会提醒您。"] },
    rej: { eyebrow: "次优方案", title: "出口保理", body: "将部分发票出售给银行，立即获得现金。成本略高于贷款。", cta: "比较方案" },
    agent: {
      title: "南风今天为您做了什么",
      items: [
        ["08:00", "用语音发送了早间现金简报。"],
        ["08:47", "拦截了一张试图更改供应商银行账户的发票。"],
        ["10:12", "读取了上海客户的延迟付款通知。"],
        ["10:14", `比较了${S.explanation.length}种补缺融资方式。`],
        ["10:20", "用中文请买家确认新的付款日期。"],
      ],
    },
    more: "想看完整数据？打开详细视图",
    howItWorks: "南风如何运作？",
  },
};

/** Summary / Full detail tabs on Home, styled like every section's tabs. */
export function ViewSwitch() {
  const view = usePref("view");
  const t = useT();
  return (
    <div className="ptabs" role="group" aria-label={t("nav.cockpit")}>
      <button type="button" className={view === "simple" ? "on" : undefined} aria-pressed={view === "simple"} onClick={() => setPref("view", "simple")}>{t("tab.summary")}</button>
      <button type="button" className={view === "detail" ? "on" : undefined} aria-pressed={view === "detail"} onClick={() => setPref("view", "detail")}>{t("tab.detail")}</button>
    </div>
  );
}

function SimpleChart({ resolved, c, lang }: { resolved: boolean; c: Copy["chart"]; lang: Lang }) {
  const f = resolved ? S.fan.afterPlan : S.fan.after;
  const px = fx(N.crunchDay);
  const tag = `${c.payroll} · ${longDate(N.crunchDate, lang)}`;
  const ticks = [S.asOf, "2027-01-01", "2027-02-01", "2027-03-01"].filter((d) => dayOf(d) <= 90);
  return (
    <svg viewBox="0 0 900 310" width="100%" role="img" aria-label={`${c.title}. ${resolved ? c.after : c.before}.`}>
      <rect x="50" y={fy(0)} width="810" height={280 - fy(0)} fill="var(--crit)" opacity=".08" />
      <line x1="50" x2="860" y1={fy(0)} y2={fy(0)} stroke="var(--crit)" strokeWidth="1.5" />
      <text x="56" y={fy(0) + 16} className="owner-ch-lbl" style={{ fill: "var(--crit)" }}>{c.broke}</text>
      <path d={band(f.p10, f.p90)} fill="var(--accent)" opacity=".1" />
      {resolved && <path d={line(S.fan.after.p50)} fill="none" stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="4 4" />}
      <path d={line(f.p50)} fill="none" stroke={resolved ? "var(--ok)" : "var(--accent)"} strokeWidth="3" strokeLinejoin="round" />
      <line x1={px} x2={px} y1="20" y2="280" stroke={resolved ? "var(--ok)" : "var(--crit)"} strokeDasharray="3 3" />
      <rect x={px + 6} y="22" width={tag.length * (lang === "zh" ? 13 : 7.4) + 22} height="22" rx="11" fill={resolved ? "var(--ok)" : "var(--crit)"} />
      <text x={px + 17} y="37" className="owner-ch-lbl" style={{ fill: "#FFFFFF", fontWeight: 700 }}>{tag}</text>
      {!resolved && <circle cx={px} cy={fy(S.fan.after.p50[N.crunchDay])} r="6" fill="var(--crit)" />}
      {[0, 200, 400, 600].map((v) => (
        <text key={v} x="42" y={fy(v) + 4} textAnchor="end" className="owner-ch-axis">{v === 0 ? "0" : `${v}M`}</text>
      ))}
      {ticks.map((d) => (
        <text key={d} x={fx(dayOf(d))} y="302" textAnchor={dayOf(d) === 0 ? "start" : "middle"} className="owner-ch-axis">{longDate(d, lang)}</text>
      ))}
    </svg>
  );
}

export function OwnerView() {
  const lang = useLang();
  const c = COPY[lang];
  const intro = usePref("intro");
  const { approval } = useDesk();
  const [why, setWhy] = useState(false);
  const resolved = approval === "approved";
  const rejected = approval === "rejected";
  const head = resolved ? c.done : rejected ? c.rejected : { title: c.pending.title, sub: c.pending.sub(lang) };
  const ratio = N.planCost / N.defaultCost;

  return (
    <div className="owner">
      {intro === "new" && (
        <section className="owner-intro" aria-labelledby="owner-intro-t">
          <h2 id="owner-intro-t">{c.intro.title}</h2>
          <ol>
            {c.intro.steps.map(([t, d], i) => (
              <li key={t}><span className="owner-n">{i + 1}</span><b>{t}</b><span>{d}</span></li>
            ))}
          </ol>
          <button className="btn btn-primary" type="button" onClick={() => setPref("intro", "seen")}>{c.intro.ok}</button>
        </section>
      )}

      <header className={`owner-hero ${resolved ? "ok" : "risk"}`}>
        <span className="owner-eyebrow">{c.today}</span>
        <h1>{head.title}</h1>
        <p>{head.sub}</p>
      </header>

      <div className="owner-grid">
        <div className="owner-col">
          {!resolved && (
            <section className="card owner-card">
              <h2 className="owner-h">{c.what}</h2>
              <ol className="owner-steps">
                {c.whatSteps.map((s, i) => <li key={s}><span className="owner-n">{i + 1}</span><span>{s}</span></li>)}
              </ol>
            </section>
          )}
          <section className="card owner-card">
            <h2 className="owner-h">{c.chart.title}</h2>
            <span className="owner-hint">{c.chart.hint}</span>
            <SimpleChart resolved={resolved} c={c.chart} lang={lang} />
            <div className="owner-legend">
              <span><i style={{ background: resolved ? "var(--ok)" : "var(--accent)" }} />{resolved ? c.chart.after : c.chart.you}</span>
              {resolved && <span><i style={{ background: "var(--faint)" }} />{c.chart.before}</span>}
              <span><i style={{ background: "var(--accent)", opacity: 0.2, height: 10 }} />{c.chart.range}</span>
            </div>
          </section>
        </div>

        <div className="owner-col">
          {resolved ? (
            <section className="card owner-card owner-rec ok">
              <span className="owner-eyebrow">{c.next.eyebrow}</span>
              <h2 className="owner-h big">{c.next.title}</h2>
              <ol className="owner-steps">{c.next.items.map((s, i) => <li key={s}><span className="owner-n">{i + 1}</span><span>{s}</span></li>)}</ol>
            </section>
          ) : rejected ? (
            <section className="card owner-card owner-rec">
              <span className="owner-eyebrow">{c.rej.eyebrow}</span>
              <h2 className="owner-h big">{c.rej.title}</h2>
              <p>{c.rej.body}</p>
              <Link className="btn btn-primary owner-cta" href="/financing">{c.rej.cta}</Link>
            </section>
          ) : (
            <section className="card owner-card owner-rec">
              <span className="owner-eyebrow">{c.rec.eyebrow}</span>
              <h2 className="owner-h big">{c.rec.title}</h2>
              <p>{c.rec.body}</p>
              <div className="owner-compare" role="img" aria-label={`${c.rec.ours} ${pesos(N.planCost, lang)} · ${c.rec.bank} ${pesos(N.defaultCost, lang)}`}>
                <div><span>{c.rec.ours}</span><i style={{ width: `${ratio * 100}%`, background: "var(--ok)" }} /><b>{pesos(N.planCost, lang)}</b></div>
                <div><span>{c.rec.bank}</span><i style={{ width: "100%", background: "var(--line-2)" }} /><b>{pesos(N.defaultCost, lang)}</b></div>
              </div>
              <p className="owner-save">{c.rec.save} <span>({N.savingsPct})</span></p>
              <p className="owner-hint">{c.rec.safe}</p>
              <Link className="btn btn-cherry owner-cta" href="/approvals">{c.rec.approve}</Link>
              <div className="owner-actions">
                <button className="btn btn-ghost btn-sm" type="button" aria-expanded={why} onClick={() => setWhy((w) => !w)}>{c.rec.why}</button>
                <Link className="btn btn-ghost btn-sm" href="/financing">{c.rec.all}</Link>
              </div>
              {why && <ul className="owner-why">{c.rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            </section>
          )}

          <section className="card owner-card">
            <h2 className="owner-h">{c.agent.title}</h2>
            <ul className="owner-log">
              {[...c.agent.items, ...(resolved ? [["10:16", c.done.title] as [string, string]] : [])]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([t, s]) => <li key={t}><span className="num muted">{t}</span><span>{s}</span></li>)}
            </ul>
          </section>
        </div>
      </div>

      <div className="owner-foot">
        <button className="btn btn-secondary" type="button" onClick={() => setPref("view", "detail")}>{c.more} →</button>
        {intro === "seen" && <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPref("intro", "new")}>{c.howItWorks}</button>}
      </div>
    </div>
  );
}
