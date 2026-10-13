"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";
import { N, S } from "@/lib/scenario";

const passport = (p: { score: number; grade: string }) => `${Math.round(p.score)} ${p.grade}`;

// "One agent. The whole treasury desk." — feature cards that expand in place, one at a time.
type Card = { n: Record<Lang, string>; title: Record<Lang, [string, string]>; body: Record<Lang, string>; glyph: React.ReactNode };

const CARDS: Card[] = [
  {
    n: { en: "01 · PREDICT", es: "01 · PREDECIR", zh: "01 · 预测" },
    title: { en: ["See the gap", "19 days early"], es: ["Ve la brecha", "19 días antes"], zh: ["提前19天", "发现缺口"] },
    body: { en: "10,000 simulated futures over receivables, FX and harvest prices. You see the probability of a shortfall, not a single guess.", es: "10.000 futuros simulados de cobros, tipo de cambio y precios de cosecha. Ves la probabilidad de que falte plata, no una sola apuesta.", zh: "对应收账款、汇率和采收价格模拟10,000种未来。您看到的是资金短缺的概率，而不是单一猜测。" },
    glyph: (
      <svg width="120" height="80" viewBox="0 0 120 80"><path d="M4 20 L34 34 L58 62 L84 52 L116 18" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M4 20 L34 26 L58 44 L84 36 L116 8 L116 34 L84 66 L58 76 L34 40 Z" fill="currentColor" opacity=".18" /><circle cx="58" cy="62" r="6" fill="currentColor" /></svg>
    ),
  },
  {
    n: { en: "02 · DECIDE", es: "02 · DECIDIR", zh: "02 · 决策" },
    title: { en: ["Cheapest", "money"], es: ["La plata", "más barata"], zh: ["最便宜的", "资金"] },
    body: { en: "Pre-export loans, factoring, FOGAPE-backed loans, credit lines and CNY forwards, ranked by real annual cost, speed and how much of the gap they cover. The optimizer picks the mix.", es: "Créditos de pre-exportación, factoring, créditos con garantía FOGAPE, líneas de crédito y forwards en CNY, ordenados por costo anual real, rapidez y cuánto cubren de la brecha. El optimizador elige la mezcla.", zh: "出口前融资、保理、FOGAPE 担保贷款、信用额度和人民币远期，按真实年化成本、到账速度和缺口覆盖排序。优化器选出最佳组合。" },
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><path d="M8 44h40M14 44V24M28 44V14M42 44V30" stroke="currentColor" strokeWidth="3" fill="none" /></svg>,
  },
  {
    n: { en: "03 · ACT", es: "03 · ACTUAR", zh: "03 · 执行" },
    title: { en: ["Acts only", "with your OK"], es: ["Actúa solo", "con tu OK"], zh: ["经您批准", "才会执行"] },
    body: { en: "NanFeng drafts and executes, but anything that moves money waits for you: a six-digit code on WhatsApp or the web. You set every limit.", es: "NanFeng prepara y ejecuta, pero todo lo que mueve plata te espera a ti: un código de seis dígitos por WhatsApp o en la web. Tú pones cada límite.", zh: "南风负责起草和执行，但任何资金操作都要等您确认：在 WhatsApp 或网页输入六位验证码。所有限额由您设定。" },
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><rect x="10" y="24" width="36" height="24" rx="5" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M18 24v-6a10 10 0 0 1 20 0v6" stroke="currentColor" strokeWidth="3" fill="none" /></svg>,
  },
  {
    n: { en: "04 · TALK", es: "04 · HABLAR", zh: "04 · 沟通" },
    title: { en: ["Every", "channel"], es: ["Todos los", "canales"], zh: ["覆盖", "所有渠道"] },
    body: { en: "WhatsApp and voice for you in Chile, WeChat/WeCom for your buyer in Shanghai, the web cockpit for the details. In English, Spanish and 中文.", es: "WhatsApp y voz para ti en Chile, WeChat/WeCom para tu cliente en Shanghái, la web para el detalle. En inglés, español y 中文.", zh: "在智利用 WhatsApp 和语音联系您，用微信/企业微信联系上海买家，网页查看详情。支持英语、西班牙语和中文。" },
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><path d="M8 12h28v20H20l-8 8v-8H8zM40 22h8v18h-4v6l-6-6H26v-4" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" /></svg>,
  },
  {
    n: { en: "05 · PROTECT", es: "05 · PROTEGER", zh: "05 · 防护" },
    title: { en: [`${N.rtStopped}/${N.rtAttacks} attacks`, "stopped"], es: [`${N.rtStopped}/${N.rtAttacks} ataques`, "frenados"], zh: [`${N.rtStopped}/${N.rtAttacks} 次攻击`, "全部拦截"] },
    body: { en: `Invoices and emails are read as data, never as orders. A changed bank account or a hidden instruction is quarantined and you're told by SMS. Our red team threw ${N.rtAttacks} attacks at it.`, es: `Las facturas y los correos se leen como datos, nunca como órdenes. Una cuenta bancaria cambiada o una instrucción oculta queda en cuarentena y te avisamos por SMS. Nuestro red team lo probó con ${N.rtAttacks} ataques.`, zh: `发票和邮件只作为数据读取，绝不当作指令。银行账户被更改或夹带隐藏指令的文件会被隔离，并通过短信通知您。我们的红队对其发起了${N.rtAttacks}次攻击。` },
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><path d="M28 6l18 7v13c0 12-8 20-18 24C18 46 10 38 10 26V13z" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M20 28l6 6 11-12" stroke="currentColor" strokeWidth="3" fill="none" /></svg>,
  },
  {
    n: { en: "06 · PROVE", es: "06 · DEMOSTRAR", zh: "06 · 证明" },
    title: { en: ["On-chain", "audit"], es: ["Auditoría", "on-chain"], zh: ["链上", "审计"] },
    body: { en: "Every decision is hash-chained and anchored on a public blockchain (Sepolia testnet today, FISCO BCOS next), so you and your bank can verify what happened, and when.", es: "Cada decisión queda encadenada por hash y anclada en una blockchain pública (hoy la testnet Sepolia, después FISCO BCOS), para que tú y tu banco puedan verificar qué pasó y cuándo.", zh: "每项决策都经哈希链接并锚定在公共区块链上（目前为 Sepolia 测试网，下一步为 FISCO BCOS），您和银行都能核实发生了什么、何时发生。" },
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><rect x="6" y="20" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="3" fill="none" /><rect x="36" y="20" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M20 27h16" stroke="currentColor" strokeWidth="3" /></svg>,
  },
  {
    n: { en: "07 · LEND", es: "07 · CRÉDITO", zh: "07 · 授信" },
    title: { en: ["Credit", "Passport"], es: ["Credit", "Passport"], zh: ["信用", "护照"] },
    body: {
      en: `An explainable credit score built from the audited cash history, which a bank can verify instead of asking for paperwork. After this plan Huerto Austral goes from ${passport(S.passport.before)} to ${passport(S.passport.after_plan)}.`,
      es: `Un puntaje de crédito explicable, armado con el historial de caja auditado, que el banco puede verificar en vez de pedir papeles. Con este plan Huerto Austral pasa de ${passport(S.passport.before)} a ${passport(S.passport.after_plan)}.`,
      zh: `基于经审计的现金流历史生成的可解释信用评分，银行可直接核验，无需再要纸质材料。采用此方案后，Huerto Austral 从 ${passport(S.passport.before)} 升至 ${passport(S.passport.after_plan)}。`,
    },
    glyph: <svg width="56" height="56" viewBox="0 0 56 56"><rect x="10" y="6" width="36" height="44" rx="4" stroke="currentColor" strokeWidth="3" fill="none" /><path d="M18 40l6-8 6 4 8-12" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" /><path d="M18 16h20" stroke="currentColor" strokeWidth="3" /></svg>,
  },
];

export function LandingCards() {
  const lang = useLang();
  const [open, setOpen] = useState(0);
  const intent = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(intent.current), []);
  // Hover intent: a short pause so sweeping the mouse across the row doesn't flicker every card.
  const hover = (i: number) => {
    clearTimeout(intent.current);
    intent.current = setTimeout(() => setOpen(i), 110);
  };

  return (
    <div className="vcards" style={{ width: "100%", marginTop: 36 }} onMouseLeave={() => clearTimeout(intent.current)}>
      {CARDS.map((c, i) => {
        const isOpen = i === open;
        return (
          <button
            key={c.n.en}
            type="button"
            data-reveal
            className={`vcard${isOpen ? " open" : ""}`}
            aria-expanded={isOpen}
            aria-controls={`vcard-body-${i}`}
            onMouseEnter={() => hover(i)}
            onFocus={() => setOpen(i)}
            onClick={() => setOpen(i)}
          >
            <span className="mono vcard-n">{isOpen ? c.n[lang] : c.n[lang].slice(0, 2)}</span>
            <h3>{c.title[lang][0]}<br />{c.title[lang][1]}</h3>
            <div id={`vcard-body-${i}`} className="vcard-body" aria-hidden={!isOpen}>
              <hr />
              <p>{c.body[lang]}</p>
            </div>
            <span className="glyph" aria-hidden="true">{c.glyph}</span>
          </button>
        );
      })}
    </div>
  );
}
