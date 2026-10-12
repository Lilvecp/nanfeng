"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useDesk } from "@/lib/desk-state";
import { useLang } from "@/lib/i18n";
import { finishLogin, requestLogin, setToken, useLoginOpen, useSignedIn } from "@/lib/owner-session";
import type { Lang } from "@/lib/prefs";

// Owner sign-in for the live API (threat model F1). Opens by itself when an owner-only action
// needs a session (approve, reject, kill switch, reset) and retries that action after sign-in.
// Demo builds show the demo password so the jury can try it.

const TX: Record<Lang, Record<string, string>> = {
  en: {
    title: "Owner access", body: "Approving, rejecting, the kill switch and resetting the sandbox are for the owner only. Sign in to continue.",
    password: "Owner password", demo: "Demo password", signIn: "Sign in", cancel: "Cancel", wrong: "Wrong password.",
    tooMany: "Too many attempts. Wait a few minutes.", down: "Cannot reach the backend.", account: "Owner sign-in",
    signOut: "Sign out", signedOut: "Signed out", signedIn: "Signed in as the owner",
  },
  es: {
    title: "Acceso del dueño", body: "Aprobar, rechazar, el kill switch y reiniciar el sandbox son solo para el dueño. Inicia sesión para continuar.",
    password: "Contraseña del dueño", demo: "Contraseña de demo", signIn: "Ingresar", cancel: "Cancelar", wrong: "Contraseña incorrecta.",
    tooMany: "Demasiados intentos. Espera unos minutos.", down: "No se puede conectar con el backend.", account: "Acceso dueño",
    signOut: "Cerrar sesión", signedOut: "Sesión cerrada", signedIn: "Sesión iniciada como dueño",
  },
  zh: {
    title: "企业主登录", body: "批准、拒绝、紧急停止和重置沙盒仅限企业主操作。请登录以继续。",
    password: "企业主密码", demo: "演示密码", signIn: "登录", cancel: "取消", wrong: "密码错误。",
    tooMany: "尝试次数过多，请稍后再试。", down: "无法连接后端。", account: "企业主登录",
    signOut: "退出登录", signedOut: "已退出登录", signedIn: "已以企业主身份登录",
  },
};

export function OwnerLogin() {
  const x = TX[useLang()];
  const open = useLoginOpen();
  const { notify } = useDesk();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    let live = true;
    api.auth.config().then((c) => live && setHint(c.demo_password)).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setPassword("");
        setError(null);
        finishLogin(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.login(password);
      setToken(r.token);
      setPassword("");
      notify(x.signedIn);
      finishLogin(true);
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 429 ? x.tooMany : x.wrong) : x.down);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setPassword("");
    setError(null);
    finishLogin(false);
  };

  return (
    <div className="owner-login-layer">
      <form className="owner-login" role="dialog" aria-modal="true" aria-labelledby="owner-login-t" onSubmit={submit}>
        <h2 id="owner-login-t" className="owner-login-t">{x.title}</h2>
        <p className="small">{x.body}</p>
        <div className="field">
          <label htmlFor="owner-pass">{x.password}</label>
          <input ref={input} id="owner-pass" className={`input${error ? " err" : ""}`} type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          {hint && <span className="hint">{x.demo}: <b className="mono">{hint}</b></span>}
          {error && <span className="hint err" role="alert">{error}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" type="button" onClick={cancel}>{x.cancel}</button>
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !password}>{x.signIn}</button>
        </div>
      </form>
    </div>
  );
}

/** Top-bar control: sign in (live API only) or sign out. */
export function OwnerAccount() {
  const x = TX[useLang()];
  const { mode, notify } = useDesk();
  const signedIn = useSignedIn();
  if (mode !== "live") return null;
  if (!signedIn) {
    return <button className="btn btn-ghost btn-sm" type="button" onClick={() => requestLogin().catch(() => {})}>{x.account}</button>;
  }
  return (
    <button className="btn btn-ghost btn-sm" type="button" onClick={() => {
      api.auth.logout().catch(() => {});
      setToken("");
      notify(x.signedOut);
    }}>{x.signOut}</button>
  );
}
