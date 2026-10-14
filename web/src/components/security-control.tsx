"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, api, type Anchor } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";

// "Security Control Center": one integrated panel. The workflow across the top shows a payment
// request moving through NanFeng's checks; the three modules below are the parts of that system.
const FLOW_L: Record<Lang, { n: string; label: string; sub: string }[]> = {
  en: [
    { n: "01", label: "Request enters", sub: "Payment or instruction" },
    { n: "02", label: "NanFeng evaluates", sub: "Against cash & policy" },
    { n: "03", label: "Tier check", sub: "L0 → L3 limits" },
    { n: "04", label: "Quarantine", sub: "Hidden instructions out" },
    { n: "05", label: "Authorize", sub: "Owner code (OTP)" },
    { n: "06", label: "Logged", sub: "Anchored on-chain" },
  ],
  es: [
    { n: "01", label: "Entra la solicitud", sub: "Pago o instrucción" },
    { n: "02", label: "NanFeng evalúa", sub: "Contra la caja y la política" },
    { n: "03", label: "Revisa el nivel", sub: "Límites L0 → L3" },
    { n: "04", label: "Cuarentena", sub: "Fuera instrucciones ocultas" },
    { n: "05", label: "Autoriza", sub: "Código del dueño" },
    { n: "06", label: "Registra", sub: "Anclado on-chain" },
  ],
  zh: [
    { n: "01", label: "请求进入", sub: "付款或指令" },
    { n: "02", label: "南风评估", sub: "对照现金与策略" },
    { n: "03", label: "级别检查", sub: "L0 → L3 限额" },
    { n: "04", label: "隔离", sub: "剔除隐藏指令" },
    { n: "05", label: "授权", sub: "企业主验证码" },
    { n: "06", label: "记录", sub: "链上锚定" },
  ],
};
const FLOW = FLOW_L.en;

type ModuleId = "tiers" | "injection" | "audit";
/** Which workflow steps each module is responsible for. */
const COVERS: Record<ModuleId, number[]> = { tiers: [1, 2, 4], injection: [3], audit: [5] };

const TIERS_L: Record<Lang, { t: number; k: string; d: string }[]> = {
  en: [{ t: 0, k: "READ", d: "Read & analyse" }, { t: 1, k: "DRAFT", d: "Reminders, quotes" }, { t: 2, k: "ACT", d: "Within your limits" }, { t: 3, k: "OTP", d: "Owner + one-time code" }],
  es: [{ t: 0, k: "LEER", d: "Lee y analiza" }, { t: 1, k: "PREPARAR", d: "Recordatorios, cotizaciones" }, { t: 2, k: "ACTUAR", d: "Dentro de tus límites" }, { t: 3, k: "CÓDIGO", d: "Dueño + código de un solo uso" }],
  zh: [{ t: 0, k: "读取", d: "读取与分析" }, { t: 1, k: "起草", d: "提醒、报价" }, { t: 2, k: "执行", d: "在您的限额内" }, { t: 3, k: "验证码", d: "企业主 + 一次性验证码" }],
};

const TX = {
  en: { aria: "How a payment request is checked", s1: "Steps 02 · 03 · 05", tiers: "Permission tiers", least: "Least privilege by default. You set every limit.", s2: "Step 04", inj: "Prompt-injection defense", prot: "Protected", r1: "Instructions hidden in invoices and emails are treated as data, not commands.", r2: "Changed bank details are quarantined; you're told by SMS.", blocked: "Demo: 1 invoice blocked", kinds: "bank-detail swap + hidden instruction", s3: "Step 06 · final record", audit: "On-chain audit trail", auditBody: "Every decision is hash-chained and anchored on-chain (Sepolia testnet today, FISCO BCOS next), verifiable by you and your bank.", last: "Last anchor", none: "none yet", offline: "live API not reachable", local: "local" },
  es: { aria: "Cómo se revisa una solicitud de pago", s1: "Pasos 02 · 03 · 05", tiers: "Niveles de permiso", least: "Mínimo privilegio por defecto. Tú pones cada límite.", s2: "Paso 04", inj: "Defensa contra inyecciones", prot: "Protegido", r1: "Las instrucciones escondidas en facturas y correos se tratan como datos, no como órdenes.", r2: "Los cambios de cuenta bancaria quedan en cuarentena y te avisamos por SMS.", blocked: "Demo: 1 factura bloqueada", kinds: "cambio de cuenta + instrucción oculta", s3: "Paso 06 · registro final", audit: "Auditoría on-chain", auditBody: "Cada decisión queda encadenada por hash y anclada on-chain (hoy la testnet Sepolia, después FISCO BCOS), verificable por ti y tu banco.", last: "Último anclaje", none: "ninguno aún", offline: "sin conexión con la API en vivo", local: "local" },
  zh: { aria: "付款请求如何被检查", s1: "第 02 · 03 · 05 步", tiers: "权限级别", least: "默认最小权限，所有限额由您设定。", s2: "第 04 步", inj: "提示注入防护", prot: "已防护", r1: "发票和邮件中隐藏的指令只作为数据处理，绝不当作命令。", r2: "银行账户变更会被隔离，并通过短信通知您。", blocked: "演示：拦截1张发票", kinds: "银行账户替换 + 隐藏指令", s3: "第 06 步 · 最终记录", audit: "链上审计记录", auditBody: "每项决策都经哈希链接并锚定上链（目前为 Sepolia 测试网，下一步为 FISCO BCOS），您和银行都可核实。", last: "最近锚定", none: "暂无", offline: "无法连接在线 API", local: "本地" },
};

export function SecurityControl() {
  const lang = useLang();
  const x = TX[lang];
  const flow = FLOW_L[lang];
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState<ModuleId | null>(null);
  // The last anchor as the live API reports it (GET /audit/anchors, newest first); never a canned hash.
  const [anchor, setAnchor] = useState<Anchor | null | "offline" | undefined>(undefined);
  useEffect(() => {
    if (!API_URL) return;
    let cancelled = false;
    api.audit.anchors()
      .then((list) => !cancelled && setAnchor(list[0] ?? null))
      .catch(() => !cancelled && setAnchor("offline"));
    return () => {
      cancelled = true;
    };
  }, []);
  const lastAnchor = !API_URL || anchor === "offline" ? x.offline
    : anchor === undefined ? "…"
    : anchor === null ? x.none
    : null;

  // The request walks through the six steps while the panel is on screen.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = root.current;
    if (!el) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(([e]) => {
      clearInterval(id);
      if (e.isIntersecting) id = setInterval(() => setStep((s) => (s + 1) % (FLOW.length + 2)), 1100);
    }, { threshold: 0.3 });
    io.observe(el);
    return () => {
      io.disconnect();
      clearInterval(id);
    };
  }, []);

  const lit = (i: number) => (focus ? COVERS[focus].includes(i) : i <= step);
  const progress = focus ? null : Math.min(step, FLOW.length - 1) / (FLOW.length - 1);

  return (
    <div ref={root} className={`scc${focus ? " has-focus" : ""}`} data-reveal>
      <div className="scc-flow" role="list" aria-label={x.aria}>
        <div className="scc-rail" aria-hidden="true">
          <span className="scc-rail-fill" style={{ transform: `scaleX(${progress ?? 0})`, opacity: progress === null ? 0 : 1 }} />
        </div>
        {flow.map((f, i) => (
          <div key={f.n} role="listitem" className={`scc-step${lit(i) ? " on" : ""}${!focus && i === step ? " now" : ""}${i === FLOW.length - 1 ? " last" : ""}`}>
            <span className="scc-node" aria-hidden="true" />
            <span className="scc-step-n">{f.n}</span>
            <b>{f.label}</b>
            <span className="scc-step-sub">{f.sub}</span>
          </div>
        ))}
      </div>

      <div className="scc-modules" onMouseLeave={() => setFocus(null)}>
        <section className={`scc-mod${focus === "tiers" ? " is-focus" : ""}`} onMouseEnter={() => setFocus("tiers")} onFocus={() => setFocus("tiers")} tabIndex={0} aria-labelledby="scc-tiers">
          <span className="scc-mod-steps">{x.s1}</span>
          <h3 className="h2" id="scc-tiers">{x.tiers}</h3>
          <ol className="scc-tiers">
            {TIERS_L[lang].map((r) => (
              <li key={r.t}>
                <span className={`tier t${r.t}`}><b>L{r.t}</b><span>{r.k}</span></span>
                <span className="scc-tier-d">{r.d}</span>
              </li>
            ))}
          </ol>
          <p className="muted small">{x.least}</p>
        </section>

        <section className={`scc-mod${focus === "injection" ? " is-focus" : ""}`} onMouseEnter={() => setFocus("injection")} onFocus={() => setFocus("injection")} tabIndex={0} aria-labelledby="scc-inj">
          <span className="scc-mod-steps">{x.s2}</span>
          <div className="scc-mod-head">
            <h3 className="h2" id="scc-inj">{x.inj}</h3>
            <span className="badge ok"><span className="dot" aria-hidden="true" />{x.prot}</span>
          </div>
          <ul className="scc-rules">
            <li>{x.r1}</li>
            <li>{x.r2}</li>
          </ul>
          <span className="scc-filter mono small"><span className="down">{x.blocked}</span> · {x.kinds}</span>
        </section>

        <section className={`scc-mod final${focus === "audit" ? " is-focus" : ""}`} onMouseEnter={() => setFocus("audit")} onFocus={() => setFocus("audit")} tabIndex={0} aria-labelledby="scc-audit">
          <span className="scc-mod-steps">{x.s3}</span>
          <h3 className="h2" id="scc-audit">{x.audit}</h3>
          <p className="muted small">{x.auditBody}</p>
          <div className="scc-chain" aria-hidden="true">
            <span /><i /><span /><i /><span className="sealed" />
          </div>
          <span className="mono small muted">
            {x.last}{" "}
            {lastAnchor ?? (anchor && typeof anchor === "object" && (
              <>
                {anchor.backend === "evm" ? "Sepolia" : x.local}{" "}
                {anchor.tx_hash
                  ? anchor.explorer_url
                    ? <a href={anchor.explorer_url} target="_blank" rel="noopener noreferrer">{`${anchor.tx_hash.slice(0, 6)}…${anchor.tx_hash.slice(-4)}`}</a>
                    : `${anchor.tx_hash.slice(0, 6)}…${anchor.tx_hash.slice(-4)}`
                  : `#${anchor.id}`}
                {" · "}seq {anchor.from_seq}–{anchor.to_seq}
              </>
            ))}
          </span>
        </section>
      </div>
    </div>
  );
}
