"use client";

import Link from "next/link";
import { useDesk } from "@/lib/desk-state";
import { useLang } from "@/lib/i18n";
import { N, S, cny, longDate, usd } from "@/lib/scenario";

// The proof that the task closed: what the sandbox bank executed, how the risk moved and where the
// audit record is. Shown after the owner approves (Approvals and Home).

const grade = (p: { score: number; grade: string }) => `${Math.round(p.score)} ${p.grade}`;

const TX = {
  en: {
    title: "Execution receipt",
    ref: "Reference", amount: "Amount", arrives: "arrives", approved: "Approved", code: "with SMS code",
    risk: "Chance of running out of cash", passport: "Credit Passport", audit: "Audit record",
    anchored: "anchored on the Sepolia testnet", chained: "hash-chained in the audit log", see: "See audit trail", sandbox: "sandbox",
  },
  es: {
    title: "Comprobante de ejecución",
    ref: "Referencia", amount: "Monto", arrives: "llega el", approved: "Aprobado", code: "con código SMS",
    risk: "Riesgo de quedar sin caja", passport: "Credit Passport", audit: "Registro de auditoría",
    anchored: "anclado en la testnet Sepolia", chained: "encadenado en el registro de auditoría", see: "Ver auditoría", sandbox: "sandbox",
  },
  zh: {
    title: "执行回执",
    ref: "编号", amount: "金额", arrives: "到账", approved: "批准时间", code: "短信验证码",
    risk: "现金耗尽概率", passport: "信用护照", audit: "审计记录",
    anchored: "已锚定至 Sepolia 测试网", chained: "已写入审计哈希链", see: "查看审计", sandbox: "沙盒",
  },
};

export function Receipt({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const x = TX[lang];
  const { mode, receipt: r } = useDesk();
  const live = mode === "live";
  const rows: [string, React.ReactNode][] = [
    [x.ref, <>{r.ref} <span className="badge">{x.sandbox}</span></>],
    [x.amount, `${usd(N.loanUsd, lang)}${lang === "zh" ? `（${cny(N.loanClp)}）` : ""} · ${x.arrives} ${longDate(N.crunchDate, lang)}`],
    [x.approved, `${r.time} · ${x.code}`],
    [x.risk, <><s className="muted">{N.pNeg}</s> → <b className="up">{N.pNegAfterPlan}</b></>],
    [x.passport, <><s className="muted">{grade(S.passport.before)}</s> → <b className="up">{grade(S.passport.after_plan)}</b></>],
    ...(r.seq !== null ? [[x.audit, <span key="a" className="num">{`#${r.seq} · ${r.hash} · ${live ? x.chained : x.anchored}`}</span>] as [string, React.ReactNode]] : []),
  ];
  return (
    <div className={`receipt${compact ? " compact" : ""}`} role="group" aria-label={x.title}>
      <div className="receipt-h"><span>{x.title}</span><Link href="/security">{x.see} →</Link></div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}
