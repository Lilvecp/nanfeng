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
    helloTitle: "Hi, I'm your NanFeng guide",
    helloBody: "The first time you open each screen, I'll show you around in a few steps. After that I'll wait here in the corner: tap me whenever you need a hand. You can turn me off in Settings.",
    helloGo: "Let's start", helloLater: "Not now",
    tipApproved: "Done: your payroll is covered. Every step was recorded and anchored, you can check it in Security.",
    tipRejected: "Plan rejected. NanFeng is preparing the next cheapest option; compare them in Financing.",
    tipBlocked: "I blocked a suspicious document before it reached the agent. Have a look in Security.",
    tipKill: "Emergency brake on: the agent cannot do anything until you turn it back on.",
    ctaSecurity: "Open Security", ctaFinancing: "Compare options", dismiss: "Close",
  },
  es: {
    name: "Guía", open: "Abrir la guía", close: "Cerrar la guía", next: "Siguiente", back: "Atrás", done: "Listo",
    skip: "Saltar recorrido", step: "Paso", of: "de", tour: "Muéstrame la pantalla", off: "Desactivar la guía",
    offToast: "Guía desactivada. Puedes volver a activarla en Ajustes.", pending: "Hay una decisión esperándote",
    openApprovals: "Ir a aprobaciones", settingsTitle: "Guía",
    settingsBody: "Un recorrido corto la primera vez que abres cada pantalla y ayuda cuando tocas el botón del velero.",
    on: "Activada", offLabel: "Desactivada", replay: "Volver a ver los recorridos", replayed: "Recorridos reiniciados: se mostrarán de nuevo en cada pantalla.",
    helloTitle: "¡Hola! Soy tu guía de NanFeng",
    helloBody: "La primera vez que abras cada pantalla te la voy a mostrar en unos pocos pasos. Después me quedo aquí en la esquina: tócame cuando necesites ayuda. Puedes apagarme en Ajustes.",
    helloGo: "Empecemos", helloLater: "Ahora no",
    tipApproved: "Listo: tu nómina está cubierta. Cada paso quedó registrado y anclado; puedes revisarlo en Seguridad.",
    tipRejected: "Plan rechazado. NanFeng está preparando la siguiente opción más barata; compáralas en Financiamiento.",
    tipBlocked: "Bloqueé un documento sospechoso antes de que llegara al agente. Revísalo en Seguridad.",
    tipKill: "Freno de emergencia activado: el agente no puede hacer nada hasta que lo vuelvas a activar.",
    ctaSecurity: "Ir a Seguridad", ctaFinancing: "Comparar opciones", dismiss: "Cerrar",
  },
  zh: {
    name: "向导", open: "打开向导", close: "关闭向导", next: "下一步", back: "上一步", done: "完成",
    skip: "跳过导览", step: "第", of: "/", tour: "带我看看", off: "关闭向导",
    offToast: "向导已关闭，可在设置中重新开启。", pending: "有一项决定等您处理",
    openApprovals: "前往审批", settingsTitle: "向导",
    settingsBody: "首次打开每个页面时进行简短导览，之后点击帆船按钮即可随时获得帮助。",
    on: "开启", offLabel: "关闭", replay: "重新播放全部导览", replayed: "导览已重置，将在每个页面重新播放。",
    helloTitle: "你好！我是NanFeng向导",
    helloBody: "第一次打开每个页面时，我会用几个步骤带您了解。之后我会待在角落里，需要帮助时点我即可。也可以在设置中把我关闭。",
    helloGo: "开始吧", helloLater: "以后再说",
    tipApproved: "完成：工资已有着落。每一步都已记录并锚定，可在安全页面查看。",
    tipRejected: "方案已拒绝。NanFeng正在准备下一个最便宜的方案，可在融资页面比较。",
    tipBlocked: "我在一份可疑文件到达代理之前将其拦截了，请到安全页面查看。",
    tipKill: "紧急制动已开启：重新启用前代理无法执行任何操作。",
    ctaSecurity: "前往安全", ctaFinancing: "比较方案", dismiss: "关闭",
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
    "/scenario": {
      summary: "Prueba qué pasaría si un cliente paga más tarde, si cambia el yuan o si contratas más gente. El pronóstico se recalcula al instante.",
      steps: [
        { target: "wif-presets", title: "Elige un \"¿y si…?\"", body: "Cada botón es una situación posible: un cliente que se atrasa más, el yuan que baja, más temporeros." },
        { target: "wif-kpis", title: "Lo que cambia", body: "Estos números se recalculan al instante: la probabilidad de quedarte sin caja y cuándo pasaría." },
        { target: "wif-chart", title: "Tu caja con ese cambio", body: "El gráfico muestra tu plata día a día bajo esa situación." },
        { target: "wif-table", title: "Todas las situaciones juntas", body: "Compáralas lado a lado para ver cuál te preocupa más." },
      ],
    },
    "/documents": {
      summary: "Las facturas y documentos que llegaron. NanFeng lee cada uno y deja bloqueados los sospechosos.",
      steps: [
        { target: "doc-inbox", title: "Lo que llegó", body: "Facturas, avisos de pago y cartolas que recibiste por correo o WhatsApp." },
        { target: "doc-preview", title: "El documento original", body: "Así se ve el documento tal como llegó." },
        { target: "doc-extract", title: "Lo que NanFeng entendió", body: "Los datos que leyó y, si algo es sospechoso, por qué lo bloqueó. Una instrucción escondida en un documento nunca se obedece." },
      ],
    },
    "/mission": {
      summary: "Cada paso que dio el agente, con la herramienta que usó y su costo. Aquí está también el botón para detenerlo todo.",
      steps: [
        { target: "agent-trace", title: "Paso a paso", body: "Todo lo que hizo el agente: qué herramienta usó, su nivel de permiso, cuánto demoró y cuánto costó." },
        { target: "agent-live", title: "En vivo", body: "Cada acción aparece aquí en el momento en que pasa." },
        { target: "agent-ask", title: "Pregúntale por qué", body: "Escribe una pregunta y el agente te explica su decisión." },
        { target: "agent-kill", title: "El freno de emergencia", body: "Si algo no te gusta, esto detiene al agente al instante. Nada se ejecuta hasta que lo vuelvas a activar." },
      ],
    },
    "/cockpit#detail": {
      summary: "La vista completa de tu caja: probabilidades, el pronóstico a 90 días y cada movimiento.",
      steps: [
        { target: "det-alert", title: "La alerta del día", body: "Qué está pasando con tu caja y qué hay que decidir." },
        { target: "det-kpis", title: "Los números clave", body: "La probabilidad de quedarte sin caja, el día del problema, lo que te deben y tu puntaje financiero." },
        { target: "det-chart", title: "Pronóstico a 90 días", body: "La línea es lo más probable; la franja, lo que podría pasar en 10.000 escenarios simulados." },
        { target: "det-tape", title: "Lo que vigila NanFeng", body: "Pagos que vienen, amenazas detectadas y avisos importantes." },
        { target: "det-blotter", title: "Cada movimiento", body: "El registro de entradas y salidas de plata." },
      ],
    },
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
    "/scenario": {
      summary: "试试客户延迟付款、人民币汇率变动或增加人手时会怎样，预测会立即重新计算。",
      steps: [
        { target: "wif-presets", title: "选择一个假设", body: "每个按钮代表一种可能的情况：客户更晚付款、人民币下跌、增加季节工。" },
        { target: "wif-kpis", title: "会有什么变化", body: "这些数字会立即重新计算：现金不足的概率以及发生的时间。" },
        { target: "wif-chart", title: "该情况下的现金", body: "图表显示这种情况下每天的资金。" },
        { target: "wif-table", title: "所有情况一览", body: "并排比较，看看哪种情况最让您担心。" },
      ],
    },
    "/documents": {
      summary: "收到的发票和文件。NanFeng会读取每一份，并拦截可疑文件。",
      steps: [
        { target: "doc-inbox", title: "收到的文件", body: "通过邮件或WhatsApp收到的发票、付款通知和银行对账单。" },
        { target: "doc-preview", title: "原始文件", body: "这是文件收到时的原样。" },
        { target: "doc-extract", title: "NanFeng读到的内容", body: "读取到的数据，以及可疑时被拦截的原因。文件中隐藏的指令永远不会被执行。" },
      ],
    },
    "/mission": {
      summary: "代理的每一步、使用的工具及其成本。这里也有一键停止全部操作的按钮。",
      steps: [
        { target: "agent-trace", title: "逐步记录", body: "代理做的每件事：使用的工具、权限级别、耗时和成本。" },
        { target: "agent-live", title: "实时", body: "每个操作发生时都会立即显示在这里。" },
        { target: "agent-ask", title: "问问原因", body: "输入问题，代理会解释它的决定。" },
        { target: "agent-kill", title: "紧急制动", body: "如有不妥，这里可以立即停止代理。重新启用前不会执行任何操作。" },
      ],
    },
    "/cockpit#detail": {
      summary: "现金的完整视图：概率、90天预测和每一笔资金往来。",
      steps: [
        { target: "det-alert", title: "今日提醒", body: "现金状况以及需要您决定的事项。" },
        { target: "det-kpis", title: "关键数字", body: "现金不足的概率、出问题的日期、应收款以及您的财务评分。" },
        { target: "det-chart", title: "90天预测", body: "线条是最可能的走势，色带是10,000个模拟情景中可能出现的情况。" },
        { target: "det-tape", title: "NanFeng在关注什么", body: "即将到来的付款、发现的威胁和重要通知。" },
        { target: "det-blotter", title: "每一笔往来", body: "资金收入与支出的记录。" },
      ],
    },
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
    "/scenario": {
      summary: "Try what happens if a customer pays later, the yuan moves or you hire more people. The forecast updates instantly.",
      steps: [
        { target: "wif-presets", title: "Pick a \"what if\"", body: "Each button is a possible situation: a customer paying even later, the yuan dropping, more seasonal workers." },
        { target: "wif-kpis", title: "What changes", body: "These numbers update instantly: the chance of running out of cash and when it would happen." },
        { target: "wif-chart", title: "Your cash with that change", body: "The chart shows your money day by day in that situation." },
        { target: "wif-table", title: "Every situation together", body: "Compare them side by side to see which one worries you most." },
      ],
    },
    "/documents": {
      summary: "The invoices and documents that arrived. NanFeng reads each one and keeps suspicious ones blocked.",
      steps: [
        { target: "doc-inbox", title: "What arrived", body: "Invoices, payment notices and bank statements you got by email or WhatsApp." },
        { target: "doc-preview", title: "The original document", body: "This is the document exactly as it arrived." },
        { target: "doc-extract", title: "What NanFeng understood", body: "The data it read and, if something is suspicious, why it was blocked. An instruction hidden in a document is never obeyed." },
      ],
    },
    "/mission": {
      summary: "Every step the agent took, with the tool it used and what it cost. The button to stop everything is here too.",
      steps: [
        { target: "agent-trace", title: "Step by step", body: "Everything the agent did: which tool, its permission level, how long it took and what it cost." },
        { target: "agent-live", title: "Live", body: "Each action shows up here the moment it happens." },
        { target: "agent-ask", title: "Ask it why", body: "Type a question and the agent explains its decision." },
        { target: "agent-kill", title: "The emergency brake", body: "If anything looks wrong, this stops the agent at once. Nothing runs until you turn it back on." },
      ],
    },
    "/cockpit#detail": {
      summary: "The full view of your cash: probabilities, the 90-day forecast and every movement.",
      steps: [
        { target: "det-alert", title: "Today's alert", body: "What is happening with your cash and what needs a decision." },
        { target: "det-kpis", title: "The key numbers", body: "The chance of running out of cash, the day of the problem, what you are owed and your financial score." },
        { target: "det-chart", title: "90-day forecast", body: "The line is the most likely path; the band is what could happen across 10,000 simulated scenarios." },
        { target: "det-tape", title: "What NanFeng watches", body: "Payments coming up, threats detected and important notices." },
        { target: "det-blotter", title: "Every movement", body: "The record of money in and money out." },
      ],
    },
    "/settings": { summary: "Your limits, allowed accounts, channels and languages. You can also turn this guide on or off." },
  };
}

// ---- state: guide on/off and which tours were seen (localStorage, per viewer) ----

const KEY_ON = "nanfeng.guide";
const KEY_SEEN = "nanfeng.guide.seen";
const KEY_HELLO = "nanfeng.guide.hello";
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

function readHello() {
  try {
    return window.localStorage.getItem(KEY_HELLO) === "seen";
  } catch {
    return false;
  }
}

/** The guide introduces itself once, before the first tour it plays. */
export function markHelloSeen() {
  try {
    window.localStorage.setItem(KEY_HELLO, "seen");
  } catch {
    // ignore
  }
  emit();
}

export function useHelloSeen(): boolean {
  return useSyncExternalStore(subscribe, readHello, () => true);
}

// "Not now" only postpones: the tour comes back in the next visit (new browser session).
const SNOOZE = "nanfeng.guide.later.";

function readSnoozed(): string {
  try {
    return Object.keys(window.sessionStorage).filter((k) => k.startsWith(SNOOZE)).join("|");
  } catch {
    return "";
  }
}

export function snoozeTour(key: string) {
  try {
    window.sessionStorage.setItem(SNOOZE + key, "1");
  } catch {
    // ignore
  }
  emit();
}

export function useTourSnoozed(key: string): boolean {
  const all = useSyncExternalStore(subscribe, readSnoozed, () => "");
  return all.split("|").includes(SNOOZE + key);
}

export function resetTours() {
  try {
    window.localStorage.removeItem(KEY_SEEN);
    window.localStorage.removeItem(KEY_HELLO);
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
