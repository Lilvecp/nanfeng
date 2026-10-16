"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AGENT_URL, ApiError, agent, type AgentAnswer, type AgentRun } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/prefs";

// The real agent on Home: ask it why, or hand it a document (PDF or photo of an invoice, a notice).
// Shown only when NEXT_PUBLIC_AGENT_URL is set and the agent answers; the sandbox desk keeps its replay.

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,text/plain";

const COPY: Record<Lang, {
  title: string; hint: string; label: string; ph: string; ask: string; upload: string; reading: string; thinking: string;
  tooBig: string; badType: string; failed: string; status: Record<string, string>; approve: string; security: string; run: string; steps: string;
}> = {
  en: {
    title: "Ask NanFeng", hint: "The live agent answers from what it actually did, or send it a document to read.",
    label: "Ask the agent", ph: "Why did you choose this plan?", ask: "Ask", upload: "Send a document",
    reading: "Reading the document, forecasting and comparing options…", thinking: "Thinking…",
    tooBig: "The file is over 4 MB.", badType: "Send a PDF, a photo (PNG, JPEG, WebP) or a text file.",
    failed: "The agent did not answer. Try again in a moment.",
    status: { awaiting_approval: "Plan ready: it needs your approval", blocked: "Blocked: this document looks like an attack", completed: "Done", failed: "Could not finish", halted: "Stopped by the kill switch" },
    approve: "Review in Approvals", security: "See why in Security", run: "Run", steps: "steps",
  },
  es: {
    title: "Pregúntale a NanFeng", hint: "El agente en vivo responde con lo que realmente hizo, o mándale un documento para que lo lea.",
    label: "Preguntar al agente", ph: "¿Por qué elegiste este plan?", ask: "Preguntar", upload: "Enviar un documento",
    reading: "Leyendo el documento, proyectando la caja y comparando opciones…", thinking: "Pensando…",
    tooBig: "El archivo pesa más de 4 MB.", badType: "Envía un PDF, una foto (PNG, JPEG, WebP) o un archivo de texto.",
    failed: "El agente no respondió. Intenta de nuevo en un momento.",
    status: { awaiting_approval: "Plan listo: necesita tu aprobación", blocked: "Bloqueado: este documento parece un ataque", completed: "Listo", failed: "No pudo terminar", halted: "Detenido por el interruptor de emergencia" },
    approve: "Revisar en Aprobaciones", security: "Ver por qué en Seguridad", run: "Ejecución", steps: "pasos",
  },
  zh: {
    title: "问问南风", hint: "实时代理根据它实际执行的操作回答，或发送文件让它读取。",
    label: "询问代理", ph: "为什么选择这个方案？", ask: "提问", upload: "发送文件",
    reading: "正在读取文件、预测现金并比较方案…", thinking: "思考中…",
    tooBig: "文件超过 4 MB。", badType: "请发送 PDF、图片（PNG、JPEG、WebP）或文本文件。",
    failed: "代理没有回应，请稍后再试。",
    status: { awaiting_approval: "方案已就绪：需要您批准", blocked: "已拦截：此文件疑似攻击", completed: "已完成", failed: "未能完成", halted: "已被紧急开关停止" },
    approve: "前往审批", security: "在安全页查看原因", run: "运行", steps: "步",
  },
};

/** True once the agent service answers its health check; false without NEXT_PUBLIC_AGENT_URL or when it is down. */
export function useAgentLive(): boolean {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!AGENT_URL) return;
    let alive = true;
    agent.health().then((h) => alive && setLive(h.status === "ok")).catch(() => alive && setLive(false));
    return () => {
      alive = false;
    };
  }, []);
  return live;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",", 2)[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** `uploadOnly`: the detailed view already has its ask box (wired to the agent), so it only adds the upload. */
export function AgentCard({ uploadOnly = false }: { uploadOnly?: boolean }) {
  const lang = useLang();
  const c = COPY[lang];
  const live = useAgentLive();
  const file = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"ask" | "upload" | null>(null);
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState("");

  if (!live) return null;

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || busy) return;
    setBusy("ask");
    setError("");
    setRun(null);
    try {
      setAnswer(await agent.ask(q.trim(), lang));
    } catch {
      setError(c.failed);
    } finally {
      setBusy(null);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || busy) return;
    if (f.size > MAX_BYTES) return setError(c.tooBig);
    if (!ACCEPT.split(",").includes(f.type)) return setError(c.badType);
    setBusy("upload");
    setError("");
    setAnswer(null);
    try {
      setRun(await agent.upload({ filename: f.name, mime: f.type, data_base64: await toBase64(f), language: lang }));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 413 ? c.tooBig : c.failed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card owner-card" data-guide="home-ask">
      <h2 className="owner-h">{uploadOnly ? c.upload : c.title}</h2>
      <span className="owner-hint">{c.hint}</span>
      {!uploadOnly && (
        <form className="field" onSubmit={ask}>
          <label htmlFor="agent-ask" className="visually-hidden">{c.label}</label>
          <input id="agent-ask" className="input" placeholder={c.ph} value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} disabled={busy !== null} />
        </form>
      )}
      <div className="owner-actions">
        {!uploadOnly && <button className="btn btn-primary btn-sm" type="button" onClick={ask} disabled={busy !== null || !q.trim()}>{c.ask}</button>}
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => file.current?.click()} disabled={busy !== null}>{c.upload}</button>
        <input ref={file} type="file" accept={ACCEPT} hidden onChange={upload} />
      </div>
      <div role="status" aria-live="polite">
        {busy && <p className="owner-hint">{busy === "upload" ? c.reading : c.thinking}</p>}
        {error && <p className="owner-hint" style={{ color: "var(--crit)" }}>{error}</p>}
        {answer && !busy && (
          <div className="answer">
            <span>{answer.answer}</span>
            {answer.run_id && <span className="mono small muted">{c.run} {answer.run_id}</span>}
          </div>
        )}
        {run && !busy && (
          <div className="answer">
            <b>{c.status[run.status] ?? run.status}</b>
            {run.note && <span>{run.note}</span>}
            <span className="mono small muted">{c.run} {run.run_id} · {run.steps} {c.steps}{run.approvals[0] ? ` · ${run.approvals[0].id} · L${run.approvals[0].tier}` : ""}</span>
            {run.status === "awaiting_approval" && <Link href="/approvals" className="mono small">{c.approve} →</Link>}
            {run.status === "blocked" && <Link href="/security" className="mono small">{c.security} →</Link>}
          </div>
        )}
      </div>
    </section>
  );
}
