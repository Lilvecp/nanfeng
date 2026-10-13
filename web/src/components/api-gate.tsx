"use client";

import { SailMark } from "@/components/logo";
import { useDesk } from "@/lib/desk-state";
import { useLang } from "@/lib/i18n";

const MSG = { en: "Connecting to NanFeng…", es: "Conectando con NanFeng…", zh: "正在连接南风…" };

/** While the desk asks the backend whether it is up, hide the screen instead of flashing the local
 * sandbox (pending plan, badges) and then jumping to the live state. Gives up after a few seconds. */
export function ApiGate({ children }: { children: React.ReactNode }) {
  const { mode } = useDesk();
  const lang = useLang();
  const checking = mode === "checking";
  return (
    <div className="api-gate" aria-busy={checking}>
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
