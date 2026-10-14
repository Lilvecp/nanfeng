"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/topbar";
import { api } from "@/lib/api";
import { SANDBOX_OTP, useDesk } from "@/lib/desk-state";
import { GUIDE_UI, resetTours, setGuideOn, useGuideOn } from "@/lib/guide";
import { useLang, useT } from "@/lib/i18n";

const CREDIT_LINE = 400_000_000;
type LimitKey = "l2Action" | "l2Month" | "l3Action" | "l3Month";
const SAVED: Record<LimitKey, number> = { l2Action: 25_000_000, l2Month: 80_000_000, l3Action: 400_000_000, l3Month: 400_000_000 };
const POLICY_KEY: Record<LimitKey, string> = { l2Action: "tiers.L2.per_action", l2Month: "tiers.L2.per_month", l3Action: "tiers.L3.per_action", l3Month: "tiers.L3.per_month" };

const clp = (n: number) => "CLP " + n.toLocaleString("es-CL");
const parse = (s: string) => Number(s.replace(/\D/g, "")) || 0;
const snake = (n: number) => n.toLocaleString("en-US").replace(/,/g, "_");

const TX = {
  en: {
    policy: "Policy", unsaved: (n: number) => `${n} UNSAVED CHANGE${n > 1 ? "S" : ""} · CODE REQUIRED`, discard: "Discard", save: "Save with code",
    otpBody: "Policy changes are L3. Enter the code sent to +56 9 •••• 4127", sandbox: "sandbox", confirm: "Confirm", cancel: "Cancel",
    errLine: `ERR > CREDIT LINE ${clp(CREDIT_LINE)}`, errL2: "ERR L2 MUST BE ≤ L3", errMonth: "ERR MONTH < PER ACTION", errOtp: "WRONG CODE", saved: (v: number) => `Policy v${v} saved · change logged in the audit chain`,
    limits: "Spending limits by tier", above: "ABOVE LIMIT → NEXT TIER", cols: ["Tier", "Per action", "Per month", "Scope"],
    l1Limit: "CLP 0 · no payments", l1Scope: "Reminders, quotes", l2Scope: "Allowlisted payees · FX ≤ ¥500k", l3Scope: "Any, with owner code", perAction: "per action", perMonth: "per month",
    allow: "Beneficiary allowlist", add: "+ Add (L3)", addToast: "Adding a payee is L3: owner code + call-back. Available once the bank API is connected.", payCols: ["Name", "Bank", "Account", "Currency", "Added"], remove: "Remove",
    removed: (n: string) => `${n} removed · the agent can no longer pay it`, noPayees: "NO PAYEES → THE AGENT CAN DRAFT BUT NEVER PAY",
    approvalCh: "Approval channels", waOtp: "WhatsApp + one-time code (sandbox code in the demo)", webAuth: "Web + authenticator", voice: "Voice (blocked by policy)",
    languages: "Languages", owner: "Owner", importers: "Importers",
    connected: "Connected channels", up: "Up", sim: "Simulated", connect: "Connect", roadmap: "LINE and KakaoTalk adapters are on the roadmap", bankApi: "Banco Pacífico API", bankSandbox: "Sandbox",
    diff: (dirty: boolean) => `policy.diff · ${dirty ? "unsaved" : "clean"}`,
  },
  es: {
    policy: "Política", unsaved: (n: number) => `${n} CAMBIO${n > 1 ? "S" : ""} SIN GUARDAR · REQUIERE CÓDIGO`, discard: "Descartar", save: "Guardar con código",
    otpBody: "Cambiar la política es L3. Escribe el código enviado al +56 9 •••• 4127", sandbox: "sandbox", confirm: "Confirmar", cancel: "Cancelar",
    errLine: `ERROR > LÍNEA DE CRÉDITO ${clp(CREDIT_LINE)}`, errL2: "ERROR: L2 DEBE SER ≤ L3", errMonth: "ERROR: EL MES ES MENOR QUE POR ACCIÓN", errOtp: "CÓDIGO INCORRECTO", saved: (v: number) => `Política v${v} guardada · el cambio quedó en la cadena de auditoría`,
    limits: "Límites de gasto por nivel", above: "SOBRE EL LÍMITE → SIGUIENTE NIVEL", cols: ["Nivel", "Por acción", "Por mes", "Alcance"],
    l1Limit: "CLP 0 · sin pagos", l1Scope: "Recordatorios, cotizaciones", l2Scope: "Cuentas autorizadas · FX ≤ ¥500k", l3Scope: "Cualquiera, con código del dueño", perAction: "por acción", perMonth: "por mes",
    allow: "Cuentas autorizadas", add: "+ Agregar (L3)", addToast: "Agregar una cuenta es L3: código del dueño + llamada de verificación. Disponible al conectar la API del banco.", payCols: ["Nombre", "Banco", "Cuenta", "Moneda", "Agregada"], remove: "Quitar",
    removed: (n: string) => `${n} quitada · el agente ya no puede pagarle`, noPayees: "SIN CUENTAS → EL AGENTE PUEDE PREPARAR PERO NUNCA PAGAR",
    approvalCh: "Canales de aprobación", waOtp: "WhatsApp + código de un solo uso (código sandbox en la demo)", webAuth: "Web + autenticador", voice: "Voz (bloqueada por política)",
    languages: "Idiomas", owner: "Dueño", importers: "Importadores",
    connected: "Canales conectados", up: "Activo", sim: "Simulado", connect: "Conectar", roadmap: "Los adaptadores de LINE y KakaoTalk están en el roadmap", bankApi: "API Banco Pacífico", bankSandbox: "Sandbox",
    diff: (dirty: boolean) => `policy.diff · ${dirty ? "sin guardar" : "sin cambios"}`,
  },
  zh: {
    policy: "策略", unsaved: (n: number) => `${n} 项未保存更改 · 需要验证码`, discard: "放弃", save: "输入验证码保存",
    otpBody: "修改策略属于 L3。请输入发送至 +56 9 •••• 4127 的验证码", sandbox: "沙盒", confirm: "确认", cancel: "取消",
    errLine: `错误：超过授信额度 ${clp(CREDIT_LINE)}`, errL2: "错误：L2 必须 ≤ L3", errMonth: "错误：月度限额小于单笔限额", errOtp: "验证码错误", saved: (v: number) => `策略 v${v} 已保存 · 更改已写入审计链`,
    limits: "各级支出限额", above: "超过限额 → 升至下一级", cols: ["级别", "单笔", "每月", "范围"],
    l1Limit: "CLP 0 · 不可付款", l1Scope: "提醒、报价", l2Scope: "白名单收款方 · 外汇 ≤ ¥500k", l3Scope: "任何操作，需企业主验证码", perAction: "单笔", perMonth: "每月",
    allow: "收款方白名单", add: "+ 添加（L3）", addToast: "添加收款方属于 L3：需企业主验证码并回电核实。接入银行 API 后开放。", payCols: ["名称", "银行", "账户", "币种", "添加日期"], remove: "移除",
    removed: (n: string) => `已移除 ${n} · 代理无法再向其付款`, noPayees: "无收款方 → 代理只能起草，永远无法付款",
    approvalCh: "审批渠道", waOtp: "WhatsApp + 一次性验证码（演示中为沙盒验证码）", webAuth: "网页 + 身份验证器", voice: "语音（策略禁止）",
    languages: "语言", owner: "企业主", importers: "进口商",
    connected: "已连接渠道", up: "正常", sim: "模拟", connect: "连接", roadmap: "LINE 和 KakaoTalk 适配器已列入路线图", bankApi: "Banco Pacífico API", bankSandbox: "沙盒",
    diff: (dirty: boolean) => `policy.diff · ${dirty ? "未保存" : "无更改"}`,
  },
};

type Payee = { name: string; bank: string; acct: string; ccy: string; added: string };
const PAYEES: Payee[] = [
  { name: "Cartonera Sur Ltda.", bank: "Banco Andino", acct: "•••• 2117", ccy: "CLP", added: "2026-03-02" },
  { name: "Frío Austral Logística SpA", bank: "Banco Sur", acct: "•••• 1203", ccy: "CLP", added: "2025-11-18" },
  { name: "Pacific Reefer Lines", bank: "HSBC HK", acct: "•••• 0934", ccy: "USD", added: "2025-12-05" },
];

export default function SettingsPage() {
  const t = useT();
  const x = TX[useLang()];
  const { notify, mode } = useDesk();
  const [saved, setSaved] = useState(SAVED);
  const [draft, setDraft] = useState<Record<LimitKey, string>>(() => Object.fromEntries(Object.entries(SAVED).map(([k, v]) => [k, clp(v)])) as Record<LimitKey, string>);
  const [version, setVersion] = useState(14);
  const [payees, setPayees] = useState(PAYEES);
  // Live mode: show the limits the policy engine actually applies (GET /policy), not the defaults above.
  const live = mode === "live";
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api.policy.get().then((p) => {
      if (cancelled) return;
      const pick = (path: string) => path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], p);
      const next = Object.fromEntries((Object.keys(POLICY_KEY) as LimitKey[]).map((k) => [k, Number(pick(POLICY_KEY[k])) || SAVED[k]])) as Record<LimitKey, number>;
      setSaved(next);
      setDraft(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, clp(v)])) as Record<LimitKey, string>);
      setVersion(p.version);
    }).catch(() => undefined);  // backend down: keep the local defaults
    return () => { cancelled = true; };
  }, [live]);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState<string | null>(null);

  const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, parse(v)])) as Record<LimitKey, number>;
  const changed = (Object.keys(values) as LimitKey[]).filter((k) => values[k] !== saved[k]);
  const errors: Partial<Record<LimitKey, string>> = {};
  if (values.l3Action > CREDIT_LINE) errors.l3Action = x.errLine;
  if (values.l2Action > values.l3Action) errors.l2Action = x.errL2;
  if (values.l2Action > values.l2Month) errors.l2Month = x.errMonth;
  const hasErrors = Object.keys(errors).length > 0;

  const input = (k: LimitKey, label: string) => (
    <>
      <input className={`input${errors[k] ? " err" : ""}`} aria-label={label} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} onBlur={() => setDraft((d) => ({ ...d, [k]: clp(parse(d[k])) }))} />
      {errors[k] && <span className="hint err">{errors[k]}</span>}
    </>
  );

  const discard = () => {
    setDraft(Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, clp(v)])) as Record<LimitKey, string>);
    setOtpOpen(false);
  };

  const confirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.replace(/\D/g, "") !== SANDBOX_OTP) {
      setOtpErr(x.errOtp);
      return;
    }
    setSaved(values);
    setVersion((v) => v + 1);
    setOtpOpen(false);
    setOtp("");
    setOtpErr(null);
    notify(x.saved(version + 1));
  };

  return (
    <>
      <Topbar>
        <div className="tick"><span className="l">{x.policy}</span><span className="v">v{version} · 2026-10-{version > 14 ? "09" : "07"}</span></div>
        {changed.length > 0 && <span className="status"><span className="dot warn" />{x.unsaved(changed.length)}</span>}
      </Topbar>

      <div className="content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="h1">{t("nav.settings")}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" type="button" disabled={changed.length === 0} onClick={discard}>{x.discard}</button>
            <button className="btn btn-primary" type="button" disabled={changed.length === 0 || hasErrors} onClick={() => setOtpOpen(true)}>{x.save} <span className="key" style={{ borderColor: "currentColor", color: "inherit" }}>⌘S</span></button>
          </div>
        </div>

        {otpOpen && (
          <form className="alert warn" style={{ alignItems: "center", flexWrap: "wrap" }} onSubmit={confirmSave}>
            <span className="ic">OTP</span>
            <label htmlFor="set-otp" className="small" style={{ flex: "1 1 260px" }}>{x.otpBody} ({x.sandbox}: <b className="mono">{SANDBOX_OTP}</b>).</label>
            <input id="set-otp" className={`input${otpErr ? " err" : ""}`} inputMode="numeric" autoComplete="one-time-code" style={{ width: 140 }} value={otp} onChange={(e) => { setOtp(e.target.value); setOtpErr(null); }} />
            <button className="btn btn-primary btn-sm" type="submit">{x.confirm}</button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setOtpOpen(false)}>{x.cancel}</button>
            {otpErr && <span className="hint err" role="alert">{otpErr}</span>}
          </form>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div className="card-h"><span className="h3">{x.limits}</span><span className="hint">{x.above}</span></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr>{x.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  <tr><td><span className="tier t1"><b>L1</b><span>DRAFT</span></span></td><td className="mono small muted">{x.l1Limit}</td><td className="mono small muted">—</td><td className="small">{x.l1Scope}</td></tr>
                  <tr><td><span className="tier t2"><b>L2</b><span>ACT</span></span></td><td>{input("l2Action", `L2 ${x.perAction}`)}</td><td>{input("l2Month", `L2 ${x.perMonth}`)}</td><td className="small">{x.l2Scope}</td></tr>
                  <tr><td><span className="tier t3"><b>L3</b><span>OTP</span></span></td><td>{input("l3Action", `L3 ${x.perAction}`)}</td><td>{input("l3Month", `L3 ${x.perMonth}`)}</td><td className="small">{x.l3Scope}</td></tr>
                </tbody>
              </table></div>
            </div>

            <div className="card">
              <div className="card-h"><span className="h3">{x.allow} · {payees.length}</span><button className="btn btn-secondary btn-sm" type="button" onClick={() => notify(x.addToast)}>{x.add}</button></div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr>{x.payCols.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
                <tbody>
                  {payees.map((p) => (
                    <tr key={p.name}><td>{p.name}</td><td>{p.bank}</td><td className="num">{p.acct}</td><td className="num">{p.ccy}</td><td className="num">{p.added}</td><td className="r"><button className="btn btn-ghost btn-sm" type="button" onClick={() => { setPayees((ps) => ps.filter((q) => q !== p)); notify(x.removed(p.name)); }}>{x.remove}</button></td></tr>
                  ))}
                  {payees.length === 0 && <tr><td colSpan={6} className="mono small muted">{x.noPayees}</td></tr>}
                </tbody>
              </table></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div className="card">
                <div className="card-h"><span className="h3">{x.approvalCh}</span></div>
                <div className="card-b">
                  <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }} className="small"><input type="checkbox" defaultChecked style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />{x.waOtp}</label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }} className="small"><input type="checkbox" defaultChecked style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />{x.webAuth}</label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40 }} className="small muted"><input type="checkbox" disabled style={{ width: 18, height: 18 }} />{x.voice}</label>
                </div>
              </div>
              <div className="card">
                <div className="card-h"><span className="h3">{x.languages}</span></div>
                <div className="card-b">
                  <div className="field"><label htmlFor="tts-lo">{x.owner}</label><select id="tts-lo" className="input" defaultValue="ES-CL"><option>ES-CL</option><option>EN</option><option>ZH-CN</option></select></div>
                  <div className="field"><label htmlFor="tts-li">{x.importers}</label><select id="tts-li" className="input" defaultValue="zh"><option value="zh">ZH-CN · formal · 2026年10月09日</option><option value="en">EN</option></select></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <GuideSettings />
            <div className="card">
              <div className="card-h"><span className="h3">{x.connected}</span></div>
              <div className="tbl-wrap"><table className="tbl"><tbody>
                <tr><td>WhatsApp Business</td><td className="r"><span className="badge ok">{x.up}</span></td></tr>
                <tr><td>SMS gateway</td><td className="r"><span className="badge warn">{x.sim}</span></td></tr>
                <tr><td>WeCom</td><td className="r"><span className="badge warn">{x.sim}</span></td></tr>
                <tr><td>LINE · KakaoTalk</td><td className="r"><button className="btn btn-secondary btn-sm" type="button" onClick={() => notify(x.roadmap)}>{x.connect}</button></td></tr>
                <tr><td>{x.bankApi}</td><td className="r"><span className="badge acc">{x.bankSandbox}</span></td></tr>
              </tbody></table></div>
            </div>
            <div className="card">
              <div className="card-h"><span className="h3">{x.diff(changed.length > 0)}</span></div>
              <div className="card-b mono small" style={{ gap: 2, lineHeight: 1.6 }}>
                {(Object.keys(POLICY_KEY) as LimitKey[]).map((k) =>
                  changed.includes(k) ? (
                    <span key={k} style={{ display: "contents" }}>
                      <span className="down">- {POLICY_KEY[k]}: {snake(saved[k])} CLP</span>
                      <span className="up">+ {POLICY_KEY[k]}: {snake(values[k])} CLP</span>
                    </span>
                  ) : (
                    <span key={k} className="muted">  {POLICY_KEY[k]}: {snake(saved[k])} CLP</span>
                  ),
                )}
                <span className="muted">  approval.voice: false  # locked</span>
                <span className="muted">  allowlist.size: {payees.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Guide on/off and "show the tours again" (lib/guide.ts). */
function GuideSettings() {
  const ui = GUIDE_UI[useLang()];
  const on = useGuideOn();
  const { notify } = useDesk();
  return (
    <div className="card">
      <div className="card-h"><span className="h3">{ui.settingsTitle}</span></div>
      <div className="card-b" style={{ gap: 12 }}>
        <span className="small">{ui.settingsBody}</span>
        <div className="seg" role="group" aria-label={ui.settingsTitle} style={{ alignSelf: "flex-start" }}>
          <button type="button" className={on !== false ? "on" : undefined} aria-pressed={on !== false} onClick={() => setGuideOn(true)}>{ui.on}</button>
          <button type="button" className={on === false ? "on" : undefined} aria-pressed={on === false} onClick={() => setGuideOn(false)}>{ui.offLabel}</button>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => { resetTours(); setGuideOn(true); notify(ui.replayed); }}>{ui.replay}</button>
      </div>
    </div>
  );
}
