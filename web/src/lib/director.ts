"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "./prefs";
import { N, S, SHORT_CUSTOMER, SHORT_CUSTOMER_ZH, longDate, pesos, usd } from "./scenario";

// Demo tour across the real app (fe-10): the Cherry Crisis told on the product's own screens.
// Each scene opens a screen, lights up the part that matters and captions it, while the backend
// really does the work (Demo Mode replay). Numbers come from the quant engine's scenario.

export type Scene = {
  step: number; // 1..6, the Demo Mode step it belongs to (DELAY … CLOSED)
  route: string;
  target: string; // data-guide id lit on that screen
  ms: number;
  doc?: string; // Documents: which document to open
  action?: "approve"; // Approvals: type the code and approve on screen
  caption: Record<Lang, string>;
};

const lenders = new Set(S.arena.map((a) => a.lender)).size;
const crunch = (l: Lang) => longDate(N.crunchDate, l);

export const SCENES: Scene[] = [
  {
    step: 1, route: "/documents", target: "doc-extract", doc: "notice", ms: 7000,
    caption: {
      en: `10:12 · ${SHORT_CUSTOMER} will pay ${usd(N.overdueUsd)} ${N.delayDays} days late. NanFeng reads the notice by itself.`,
      es: `10:12 · ${SHORT_CUSTOMER} pagará ${usd(N.overdueUsd, "es")} con ${N.delayDays} días de atraso. NanFeng lee el aviso solo.`,
      zh: `10:12 · ${SHORT_CUSTOMER_ZH}将推迟${N.delayDays}天支付 ${usd(N.overdueUsd, "zh")}。NanFeng 自动读取了通知。`,
    },
  },
  {
    step: 2, route: "/cockpit", target: "home-chart", ms: 7000,
    caption: {
      en: `It re-runs 10,000 scenarios: ${N.pNeg} chance of running out of cash on ${crunch("en")}, harvest payroll day.`,
      es: `Recalcula 10.000 escenarios: ${N.pNeg} de quedarse sin caja el ${crunch("es")}, día de la nómina de cosecha.`,
      zh: `重新模拟 10,000 种情景：${crunch("zh")}（采收工资日）现金不足的概率为 ${N.pNeg}。`,
    },
  },
  {
    step: 3, route: "/financing", target: "fin-options", ms: 6500,
    caption: {
      en: `${N.products} financing products checked, ${N.eligible} eligible, from ${lenders} lenders, compared in seconds: cost, term and requirements.`,
      es: `${N.products} productos de financiamiento revisados, ${N.eligible} elegibles, de ${lenders} prestamistas, comparados en segundos: costo, plazo y requisitos.`,
      zh: `数秒内评估 ${N.products} 种融资产品（${N.eligible} 种符合条件，来自 ${lenders} 家贷款方）：成本、期限和要求。`,
    },
  },
  {
    step: 4, route: "/financing", target: "fin-why", ms: 7000,
    caption: {
      en: `The optimizer picks a ${N.termDays}-day USD pre-export loan: ${pesos(N.savings)} cheaper than the bank loan.`,
      es: `El optimizador elige un crédito de pre-exportación en dólares a ${N.termDays} días: ${pesos(N.savings, "es")} más barato que el del banco.`,
      zh: `优化器选择 ${N.termDays} 天期美元出口前融资，比银行贷款便宜 ${pesos(N.savings, "zh")}。`,
    },
  },
  {
    step: 5, route: "/channels", target: "msg-owner", ms: 6500,
    caption: {
      en: "NanFeng messages the owner on WhatsApp: what happened, what it costs and why.",
      es: "NanFeng le escribe al dueño por WhatsApp: qué pasó, cuánto cuesta y por qué.",
      zh: "NanFeng 通过 WhatsApp 告知企业主：发生了什么、成本多少、为什么。",
    },
  },
  {
    step: 5, route: "/approvals", target: "appr-authorize", ms: 9000, action: "approve",
    caption: {
      en: "The owner approves with a 6-digit one-time code (a fixed sandbox code in this demo). Without that OK, no money moves.",
      es: "El dueño aprueba con un código de un solo uso de 6 dígitos (en esta demo, un código sandbox fijo). Sin ese OK, no se mueve ni un peso.",
      zh: "企业主输入 6 位一次性验证码批准（本演示使用固定的沙盒验证码）。没有这一步，资金不会移动。",
    },
  },
  {
    step: 6, route: "/security", target: "sec-blocked", ms: 7000,
    caption: {
      en: "At 08:47 it had already stopped a fake invoice with a changed bank account and a hidden instruction.",
      es: "A las 08:47 ya había frenado una factura falsa con la cuenta bancaria cambiada y una instrucción escondida.",
      zh: "早在 08:47，它就拦截了一张更改了银行账户并藏有隐藏指令的假发票。",
    },
  },
  {
    step: 6, route: "/security", target: "sec-audit", ms: 7000,
    caption: {
      en: "Every step is hash-chained and anchored on a blockchain: the bank can verify what happened, and when.",
      es: "Cada paso queda encadenado y anclado en blockchain: el banco puede verificar qué pasó y cuándo.",
      zh: "每一步都经过哈希链接并锚定在区块链上：银行可以核实发生了什么、何时发生。",
    },
  },
  {
    step: 6, route: "/cockpit", target: "home-status", ms: 8000,
    caption: {
      en: `Payroll covered: cash stays above the buffer in ${N.coverage} of scenarios. NanFeng sees it coming, finds the cheapest fix and acts with your OK.`,
      es: `Nómina cubierta: la caja se mantiene sobre el colchón en el ${N.coverage} de los escenarios. NanFeng lo ve venir, encuentra lo más barato y actúa con tu OK.`,
      zh: `工资已有着落：${N.coverage} 的情景中现金高于安全垫。NanFeng 提前预见、找到最便宜的方案，并在您同意后执行。`,
    },
  },
];

// ---- tour state, shared by every screen while it runs ----

type State = { active: boolean; scene: number; playing: boolean };
let state: State = { active: false, scene: 0, playing: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const director = {
  start: () => set({ active: true, scene: 0, playing: true }),
  stop: () => set({ active: false, playing: false }),
  go: (scene: number) => set({ scene: Math.max(0, Math.min(SCENES.length - 1, scene)) }),
  next: () => (state.scene >= SCENES.length - 1 ? set({ playing: false }) : set({ scene: state.scene + 1 })),
  prev: () => set({ scene: Math.max(0, state.scene - 1) }),
  toggle: () => set({ playing: !state.playing }),
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const SERVER: State = { active: false, scene: 0, playing: false };

export function useDirector(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
