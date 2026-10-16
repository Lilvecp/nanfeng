"use client";

import { SailMark } from "@/components/logo";
import { API_URL } from "@/lib/api";
import { useDesk } from "@/lib/desk-state";
import { useLang, useT } from "@/lib/i18n";

const MSG = { en: "Connecting to NanFeng…", es: "Conectando con NanFeng…", zh: "正在连接南风…" };

/** While the desk asks the backend whether it is up, hide the screen instead of flashing the local
 * sandbox (pending plan, badges) and then jumping to the live state. Gives up after a few seconds,
 * and then says so: a desk running on the local sandbox is never presented as the live API. */
export function ApiGate({ children }: { children: React.ReactNode }) {
  const { mode } = useDesk();
  const lang = useLang();
  const t = useT();
  const checking = mode === "checking";
  return (
    <div className="api-gate" aria-busy={checking}>
      {mode === "sandbox" && (
        <div className="alert warn" role="status" style={{ margin: "12px 16px 0", alignItems: "center", flexWrap: "wrap" }}>
          <span className="ic">SANDBOX</span>
          <span className="small" style={{ flex: 1, minWidth: 200 }}>
            <b>{t("shell.offline.title")}</b> · {t(API_URL ? "shell.offline.slow" : "shell.offline.none")}
          </span>
          {API_URL && <button className="btn btn-secondary btn-sm" type="button" onClick={() => window.location.reload()}>{t("shell.offline.retry")}</button>}
        </div>
      )}
      <div className="api-gate-in" style={checking ? { visibility: "hidden" } : undefined}>{children}</div>
      {checking && (
        <div className="api-gate-msg" role="status">
          <SailMark size={28} />
          <span>{MSG[lang]}</span>
        </div>
      )}
    </div>
  );
}
