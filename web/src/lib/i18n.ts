"use client";

import { usePref, type Lang } from "./prefs";
import { N } from "./scenario";

// Shell and every desk screen are translated (fe-11). Amounts stay in their source currency; the
// 中文 view uses year-month-day dates and 万 for large CLP amounts (lib/scenario.ts formatters).
const DICT = {
  // shell
  "nav.cockpit": { en: "Cockpit", es: "Cockpit", zh: "现金驾驶舱" },
  "nav.mission": { en: "Mission Control", es: "Mission Control", zh: "任务控制" },
  "nav.approvals": { en: "Approvals", es: "Aprobaciones", zh: "审批" },
  "nav.financing": { en: "Financing Arena", es: "Financiamiento", zh: "融资比较" },
  "nav.scenario": { en: "Scenario Lab", es: "Escenarios", zh: "情景实验室" },
  "nav.security": { en: "Security", es: "Seguridad", zh: "安全" },
  "nav.channels": { en: "Channels", es: "Canales", zh: "渠道" },
  "nav.documents": { en: "Documents", es: "Documentos", zh: "文件" },
  "nav.settings": { en: "Settings", es: "Ajustes", zh: "设置" },
  "shell.demo": { en: "Demo mode", es: "Modo demo", zh: "演示模式" },
  "shell.sandbox": { en: "SANDBOX · NO REAL FUNDS", es: "SANDBOX · SIN DINERO REAL", zh: "沙盒 · 非真实资金" },
  "shell.menu": { en: "Menu", es: "Menú", zh: "菜单" },
  "shell.theme": { en: "Toggle dark mode", es: "Cambiar modo oscuro", zh: "切换深色模式" },
  "shell.reset": { en: "Reset sandbox", es: "Reiniciar sandbox", zh: "重置沙盒" },
  "tick.cash": { en: "Cash", es: "Caja", zh: "现金" },

  // cockpit
  "cockpit.hello.pending.a": { en: "Good morning.", es: "Buenos días.", zh: "早上好。" },
  "cockpit.hello.pending.b": { en: "One decision", es: "Una decisión", zh: "一项决定" },
  "cockpit.hello.pending.c": { en: "needs you today.", es: "te espera hoy.", zh: "需要您今天处理。" },
  "cockpit.hello.done.a": { en: "Good morning.", es: "Buenos días.", zh: "早上好。" },
  "cockpit.hello.done.b": { en: "Cash is secured", es: "La caja está asegurada", zh: "现金已有保障" },
  "cockpit.hello.done.c": { en: "through day 90.", es: "hasta el día 90.", zh: "可支撑90天。" },
  "cockpit.ask.placeholder": {
    en: "Ask NanFeng anything about your cash, e.g. “What if Shanghai pays on day 10?”",
    es: "Pregúntale a NanFeng sobre tu caja, p. ej. “¿Y si Shanghái paga el día 10?”",
    zh: "向南风提问现金问题，例如“如果上海客户第10天付款会怎样？”",
  },
  "cockpit.ask": { en: "Ask", es: "Preguntar", zh: "提问" },
  "cockpit.alert.title": { en: "Shanghai importer delayed payment by 45 days", es: "El importador de Shanghái atrasó el pago 45 días", zh: "上海进口商付款延迟45天" },
  "cockpit.alert.rec": { en: "REC → 60-day USD pre-export loan (PAE) · saves", es: "REC → Crédito de pre-exportación (PAE) en USD a 60 días · ahorra", zh: "建议 → 60天期美元出口前融资（PAE）· 节省" },
  "cockpit.alert.vs": { en: "vs default bank loan", es: "vs crédito bancario", zh: "（对比银行贷款）" },
  "cockpit.review": { en: "Review plan", es: "Revisar plan", zh: "查看方案" },
  "cockpit.why": { en: "Ask why", es: "¿Por qué?", zh: "为什么" },
  "cockpit.done.title": { en: "Plan approved · executing in sandbox", es: "Plan aprobado · ejecutándose en sandbox", zh: "方案已批准 · 沙盒执行中" },
  "cockpit.done.sub": {
    en: `PAE loan USD ${N.loanUsd.toLocaleString("en-US")} · ${N.termDays} days · audit hash anchored on-chain`,
    es: `Crédito PAE USD ${N.loanUsd.toLocaleString("es-CL")} · ${N.termDays} días · hash de auditoría anclado on-chain`,
    zh: `PAE 贷款 ${N.loanUsd.toLocaleString("en-US")} 美元 · ${N.termDays}天 · 审计哈希已上链锚定`,
  },
  "cockpit.rejected.title": { en: "Plan rejected · agent preparing export factoring", es: "Plan rechazado · el agente prepara factoring de exportación", zh: "方案被拒 · 代理正在准备出口保理" },
  "cockpit.audit": { en: "Open audit log", es: "Ver auditoría", zh: "查看审计日志" },

  // approvals
  "approvals.title": { en: "Approval Center", es: "Centro de aprobaciones", zh: "审批中心" },
  "approvals.authorize": { en: "Authorize", es: "Autorizar", zh: "授权" },
  "approvals.otp": { en: "One-time code", es: "Código de un solo uso", zh: "一次性验证码" },
  "approvals.approve": { en: `Approve USD ${N.loanUsd.toLocaleString("en-US")}`, es: `Aprobar USD ${N.loanUsd.toLocaleString("es-CL")}`, zh: `批准 ${N.loanUsd.toLocaleString("en-US")} 美元` },
  "approvals.reject": { en: "Reject", es: "Rechazar", zh: "拒绝" },
  "approvals.reason": { en: "Reject · reason (required)", es: "Rechazar · motivo (obligatorio)", zh: "拒绝 · 原因（必填）" },
  "approvals.history": { en: "History", es: "Historial", zh: "历史" },
  "approvals.sandboxCode": { en: "Sandbox code", es: "Código sandbox", zh: "沙盒验证码" },

  // landing
  "lp.nav.product": { en: "Product", es: "Producto", zh: "产品" },
  "lp.nav.how": { en: "How it works", es: "Cómo funciona", zh: "工作原理" },
  "lp.nav.channels": { en: "Channels", es: "Canales", zh: "渠道" },
  "lp.nav.security": { en: "Security", es: "Seguridad", zh: "安全" },
  "lp.nav.team": { en: "Team", es: "Equipo", zh: "团队" },
  "lp.signin": { en: "Sign in", es: "Ingresar", zh: "登录" },
  "lp.hero.a": { en: "You sell to the", es: "Le vendes al", zh: "您向" },
  "lp.hero.kw": { en: "world", es: "mundo", zh: "世界" },
  "lp.hero.b": { en: ".", es: ".", zh: "销售，" },
  "lp.hero.line2": { en: "You shouldn't have to wait for it.", es: "No deberías tener que esperarlo.", zh: "不该再为回款苦等。" },
  "lp.hero.sub": {
    en: "NanFeng is the AI CFO for exporters: it sees the cash gap coming, finds the cheapest financing and acts with your approval.",
    es: "NanFeng es el CFO con IA para exportadores: ve venir la brecha de caja, encuentra el financiamiento más barato y actúa con tu aprobación.",
    zh: "南风是出口企业的 AI 财务官：提前预见现金缺口，找到最低成本的融资，并在您批准后执行。",
  },
  "lp.cta.demo": { en: "Run the Cherry Crisis demo", es: "Ver la demo Cherry Crisis", zh: "运行“樱桃危机”演示" },
  "lp.cta.how": { en: "See how it works", es: "Cómo funciona", zh: "了解工作原理" },
} as const;

export type I18nKey = keyof typeof DICT;

export function useT() {
  const lang = usePref("lang");
  return (key: I18nKey) => DICT[key][lang];
}

export function useLang(): Lang {
  return usePref("lang");
}
