"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "./prefs";
import { N, longDate, pesos, usd } from "./scenario";

// The NanFeng guide: a short walk-through the first time the owner opens each screen, then a quiet
// helper behind the sail button. Fixed, reviewed text only (never generated live), in plain words,
// with every number taken from the quant engine's scenario. Targets are elements marked with
// data-guide="…" in the screens; a step whose target is missing is shown centred instead.

export type GuideStep = { target: string; title: string; body: string };
export type GuidePage = { summary: string; steps?: GuideStep[] };

const crunch = (l: Lang) => longDate(N.crunchDate, l);

export const GUIDE_UI: Record<Lang, Record<string, string>> = {
  en: {
    name: "Guide", open: "Open the guide", close: "Close the guide", next: "Next", back: "Back", done: "Done",
    skip: "Skip tour", step: "Step", of: "of", tour: "Show me around", off: "Turn off the guide",
    offToast: "Guide turned off. You can turn it back on in Settings.", pending: "A decision is waiting for you",
    openApprovals: "Open approvals", settingsTitle: "Guide",
    settingsBody: "A short tour the first time you open each screen, then help whenever you tap the sail button.",
    on: "On", offLabel: "Off", replay: "Show all tours again", replayed: "Tours reset: they will play again on each screen.",
  },
  es: {
    name: "Guía", open: "Abrir la guía", close: "Cerrar la guía", next: "Siguiente", back: "Atrás", done: "Listo",
    skip: "Saltar recorrido", step: "Paso", of: "de", tour: "Muéstrame la pantalla", off: "Desactivar la guía",
    offToast: "Guía desactivada. Puedes volver a activarla en Ajustes.", pending: "Hay una decisión esperándote",
    openApprovals: "Ir a aprobaciones", settingsTitle: "Guía",
    settingsBody: "Un recorrido corto la primera vez que abres cada pantalla y ayuda cuando tocas el botón del velero.",
    on: "Activada", offLabel: "Desactivada", replay: "Volver a ver los recorridos", replayed: "Recorridos reiniciados: se mostrarán de nuevo en cada pantalla.",
  },
  zh: {
    name: "向导", open: "打开向导", close: "关闭向导", next: "下一步", back: "上一步", done: "完成",
    skip: "跳过导览", step: "第", of: "/", tour: "带我看看", off: "关闭向导",
    offToast: "向导已关闭，可在设置中重新开启。", pending: "有一项决定等您处理",
    openApprovals: "前往审批", settingsTitle: "向导",
    settingsBody: "首次打开每个页面时进行简短导览，之后点击帆船按钮即可随时获得帮助。",
    on: "开启", offLabel: "关闭", replay: "重新播放全部导览", replayed: "导览已重置，将在每个页面重新播放。",
  },
};

export function guideContent(lang: Lang): Record<string, GuidePage> {
  const loan = usd(N.loanUsd, lang);
  const cost = pesos(N.planCost, lang);
  const save = pesos(N.savings, lang);
  const day = crunch(lang);

  if (lang === "es") return {
    "/cockpit": {
      summary: `Tu caja de un vistazo: si alcanza para los próximos 90 días y qué recomienda NanFeng. Hoy hay riesgo de quedarte corto el ${day}.`,
      steps: [
        { target: "home-status", title: "Cómo está tu caja hoy", body: "Este aviso resume la situación en una frase. Rojo significa que hay algo que decidir; verde, que todo está cubierto." },
        { target: "home-chart", title: "Tu plata en los próximos 90 días", body: "La línea es lo que esperas tener. La franja muestra lo que podría pasar si un cliente paga tarde o cambia el dólar." },
        { target: "home-next", title: "Lo que te recomendamos", body: `NanFeng comparó todas las opciones. La más barata cuesta ${cost}, ${save} menos que un crédito normal. Nada se hace sin tu OK.` },
        { target: "home-agent", title: "Lo que hizo NanFeng por ti", body: "Aquí queda cada cosa que el agente revisó o preparó hoy, con la hora." },
      ],
    },
    "/approvals": {
      summary: "Aquí apruebas o rechazas lo que NanFeng propone. Nada mueve plata sin el código que te llega por SMS.",
      steps: [
        { target: "appr-plain", title: "En palabras simples", body: "Qué estás aprobando, cuánto cuesta y por qué, sin letra chica." },
        { target: "appr-request", title: "El detalle de la solicitud", body: `Un préstamo de ${loan} que llega el ${day}, justo para la nómina de cosecha.` },
        { target: "appr-authorize", title: "Tu código para aprobar", body: "Escribe el código de 6 dígitos que te llegó por SMS. Si no te convence, recházalo y cuéntanos por qué." },
        { target: "appr-history", title: "Todo queda registrado", body: "Cada decisión, tuya o automática, queda en este historial." },
      ],
    },
    "/financing": {
      summary: "Todas las formas de cubrir la falta de caja, ordenadas de la más barata a la más cara.",
      steps: [
        { target: "fin-options", title: "Las opciones del mercado", body: "Cada fila es una forma de conseguir la plata. La marcada es la que eligió NanFeng." },
        { target: "fin-chart", title: "Cuánto cuesta cada una", body: "Barras más cortas significan más barato. Todas cumplen la misma meta: no quedarte sin caja." },
        { target: "fin-why", title: "Por qué esta y no otra", body: "Las razones de la elección. Cuando estés listo, envíala a aprobación." },
      ],
    },
    "/channels": {
      summary: "Las conversaciones de NanFeng: contigo por WhatsApp y con tu cliente en China en su idioma.",
      steps: [
        { target: "msg-owner", title: "Tu WhatsApp", body: "Así te avisa NanFeng y te pide aprobación, en tu teléfono." },
        { target: "msg-importer", title: "Tu cliente en China", body: "NanFeng le escribe al importador en chino, por el canal que él usa." },
        { target: "msg-voice", title: "El resumen por voz", body: "Cada mañana puedes escuchar cómo está tu caja, en español, inglés o chino." },
      ],
    },
    "/security": {
      summary: "Cómo NanFeng protege tu plata: ataques bloqueados, límites de cada nivel y un registro que nadie puede alterar.",
      steps: [
        { target: "sec-blocked", title: "Un fraude bloqueado", body: "Llegó una factura con la cuenta bancaria cambiada y una instrucción escondida. NanFeng la detuvo y te avisó." },
        { target: "sec-permissions", title: "Qué puede hacer NanFeng solo", body: "Lo pequeño lo hace solo; pedir préstamos o agregar cuentas siempre necesita tu código." },
        { target: "sec-audit", title: "Un registro a prueba de cambios", body: "Cada paso queda encadenado y anclado en blockchain. Si alguien lo altera, la verificación lo detecta." },
      ],
    },
    "/scenario": { summary: "Prueba qué pasaría si un cliente paga más tarde, si cambia el yuan o si contratas más gente. El pronóstico se recalcula al instante." },
    "/documents": { summary: "Las facturas y documentos que llegaron. NanFeng lee cada uno y deja bloqueados los sospechosos." },
    "/mission": { summary: "Cada paso que dio el agente, con la herramienta que usó y su costo. Aquí está también el botón para detenerlo todo." },
    "/settings": { summary: "Tus límites, cuentas permitidas, canales e idiomas. También puedes activar o desactivar esta guía." },
  };

  if (lang === "zh") return {
    "/cockpit": {
      summary: `一眼看清现金：未来90天是否够用，以及NanFeng的建议。目前${day}有资金不足的风险。`,
      steps: [
        { target: "home-status", title: "今天的现金状况", body: "这条提示用一句话概括情况。红色表示有事需要您决定，绿色表示一切都已覆盖。" },
        { target: "home-chart", title: "未来90天的资金", body: "线条是预计余额，色带显示客户延迟付款或汇率变动时可能出现的情况。" },
        { target: "home-next", title: "我们的建议", body: `NanFeng比较了所有方案，最便宜的成本为${cost}，比普通贷款节省${save}。未经您同意不会执行任何操作。` },
        { target: "home-agent", title: "NanFeng为您做了什么", body: "今天代理检查或准备的每件事都记录在这里，并附有时间。" },
      ],
    },
    "/approvals": {
      summary: "在这里批准或拒绝NanFeng的提议。没有短信验证码，任何资金都不会移动。",
      steps: [
        { target: "appr-plain", title: "简单说明", body: "您要批准什么、费用多少、原因是什么，一目了然。" },
        { target: "appr-request", title: "申请详情", body: `一笔${loan}的贷款，于${day}到账，正好用于采收季工资。` },
        { target: "appr-authorize", title: "输入验证码批准", body: "输入短信收到的6位验证码。如果不认同，可以拒绝并说明原因。" },
        { target: "appr-history", title: "全部留有记录", body: "每项决定，无论是您做的还是自动执行的，都记录在这里。" },
      ],
    },
    "/financing": {
      summary: "弥补资金缺口的所有方式，从最便宜到最贵排列。",
      steps: [
        { target: "fin-options", title: "市场上的方案", body: "每一行是一种筹资方式，标记的是NanFeng选中的方案。" },
        { target: "fin-chart", title: "每种方案的成本", body: "条形越短越便宜。所有方案都实现同一目标：不让现金断流。" },
        { target: "fin-why", title: "为什么选这个", body: "这里是选择的理由。准备好后即可提交审批。" },
      ],
    },
    "/channels": {
      summary: "NanFeng的对话：通过WhatsApp与您沟通，并用中文联系您在中国的客户。",
      steps: [
        { target: "msg-owner", title: "您的WhatsApp", body: "NanFeng就是这样在您的手机上提醒您并请求批准。" },
        { target: "msg-importer", title: "您在中国的客户", body: "NanFeng通过进口商常用的渠道用中文与其沟通。" },
        { target: "msg-voice", title: "语音简报", body: "每天早上都可以收听现金状况，支持西班牙语、英语和中文。" },
      ],
    },
    "/security": {
      summary: "NanFeng如何保护您的资金：拦截的攻击、各级权限，以及无法篡改的记录。",
      steps: [
        { target: "sec-blocked", title: "一次被拦截的欺诈", body: "一张发票更改了银行账户并藏有隐藏指令。NanFeng拦截了它并通知了您。" },
        { target: "sec-permissions", title: "NanFeng可以自行做什么", body: "小事自动处理；申请贷款或添加账户始终需要您的验证码。" },
        { target: "sec-audit", title: "防篡改记录", body: "每一步都经过哈希链接并锚定在区块链上。一旦被篡改，验证即可发现。" },
      ],
    },
    "/scenario": { summary: "试试客户延迟付款、人民币汇率变动或增加人手时会怎样，预测会立即重新计算。" },
    "/documents": { summary: "收到的发票和文件。NanFeng会读取每一份，并拦截可疑文件。" },
    "/mission": { summary: "代理的每一步、使用的工具及其成本。这里也有一键停止全部操作的按钮。" },
    "/settings": { summary: "您的限额、允许的账户、渠道和语言。也可以在这里开启或关闭本向导。" },
  };

  return {
    "/cockpit": {
      summary: `Your cash at a glance: whether it lasts the next 90 days and what NanFeng recommends. Right now there is a risk of running short on ${day}.`,
      steps: [
        { target: "home-status", title: "How your cash looks today", body: "This notice sums it up in one line. Red means there is something to decide; green means everything is covered." },
        { target: "home-chart", title: "Your money over the next 90 days", body: "The line is what you expect to have. The band shows what could happen if a customer pays late or the dollar moves." },
        { target: "home-next", title: "What we recommend", body: `NanFeng compared every option. The cheapest costs ${cost}, ${save} less than a regular loan. Nothing happens without your OK.` },
        { target: "home-agent", title: "What NanFeng did for you", body: "Everything the agent checked or prepared today stays here, with the time." },
      ],
    },
    "/approvals": {
      summary: "This is where you approve or reject what NanFeng proposes. No money moves without the code you get by SMS.",
      steps: [
        { target: "appr-plain", title: "In plain words", body: "What you are approving, what it costs and why, with no fine print." },
        { target: "appr-request", title: "The request in detail", body: `A ${loan} loan that arrives on ${day}, right in time for the harvest payroll.` },
        { target: "appr-authorize", title: "Your code to approve", body: "Type the 6-digit code you got by SMS. If you are not convinced, reject it and tell us why." },
        { target: "appr-history", title: "Everything is recorded", body: "Every decision, yours or automatic, stays in this history." },
      ],
    },
    "/financing": {
      summary: "Every way to cover the cash gap, ranked from cheapest to most expensive.",
      steps: [
        { target: "fin-options", title: "The options on the market", body: "Each row is one way to get the money. The marked one is NanFeng's choice." },
        { target: "fin-chart", title: "What each one costs", body: "Shorter bars are cheaper. They all reach the same goal: never running out of cash." },
        { target: "fin-why", title: "Why this one", body: "The reasons behind the choice. When you are ready, send it to approval." },
      ],
    },
    "/channels": {
      summary: "NanFeng's conversations: with you on WhatsApp, and with your customer in China in their own language.",
      steps: [
        { target: "msg-owner", title: "Your WhatsApp", body: "This is how NanFeng warns you and asks for approval, on your phone." },
        { target: "msg-importer", title: "Your customer in China", body: "NanFeng writes to the importer in Chinese, on the channel they use." },
        { target: "msg-voice", title: "The voice briefing", body: "Every morning you can listen to how your cash is doing, in Spanish, English or Chinese." },
      ],
    },
    "/security": {
      summary: "How NanFeng protects your money: blocked attacks, what each level may do and a record nobody can alter.",
      steps: [
        { target: "sec-blocked", title: "A blocked fraud", body: "An invoice arrived with a changed bank account and a hidden instruction. NanFeng stopped it and warned you." },
        { target: "sec-permissions", title: "What NanFeng may do on its own", body: "Small things it does alone; borrowing money or adding accounts always needs your code." },
        { target: "sec-audit", title: "A tamper-proof record", body: "Every step is hash-chained and anchored on a blockchain. If anyone alters it, verification catches it." },
      ],
    },
    "/scenario": { summary: "Try what happens if a customer pays later, the yuan moves or you hire more people. The forecast updates instantly." },
    "/documents": { summary: "The invoices and documents that arrived. NanFeng reads each one and keeps suspicious ones blocked." },
    "/mission": { summary: "Every step the agent took, with the tool it used and what it cost. The button to stop everything is here too." },
    "/settings": { summary: "Your limits, allowed accounts, channels and languages. You can also turn this guide on or off." },
  };
}

// ---- state: guide on/off and which tours were seen (localStorage, per viewer) ----

const KEY_ON = "nanfeng.guide";
const KEY_SEEN = "nanfeng.guide.seen";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readOn() {
  try {
    return window.localStorage.getItem(KEY_ON) !== "off";
  } catch {
    return true;
  }
}

function readSeen(): string {
  try {
    return window.localStorage.getItem(KEY_SEEN) ?? "";
  } catch {
    return "";
  }
}

export function setGuideOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY_ON, on ? "on" : "off");
  } catch {
    // storage blocked: the setting lasts until reload
  }
  emit();
}

export function markTourSeen(route: string) {
  const seen = new Set(readSeen().split("|").filter(Boolean));
  seen.add(route);
  try {
    window.localStorage.setItem(KEY_SEEN, [...seen].join("|"));
  } catch {
    // ignore
  }
  emit();
}

export function resetTours() {
  try {
    window.localStorage.removeItem(KEY_SEEN);
  } catch {
    // ignore
  }
  emit();
}

/** null during server render and hydration, so nothing guide-related renders until the client knows. */
export function useGuideOn(): boolean | null {
  return useSyncExternalStore(subscribe, readOn, () => null);
}

export function useTourSeen(route: string): boolean {
  const seen = useSyncExternalStore(subscribe, readSeen, () => "");
  return seen.split("|").includes(route);
}
