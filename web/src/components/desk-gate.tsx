"use client";

import { useDesk } from "@/lib/desk-state";
import { useLang } from "@/lib/i18n";

const TEXT = { en: "Connecting to NanFeng…", es: "Conectando con NanFeng…", zh: "正在连接南风…" };

/** While the desk asks the API for the live state, show that instead of a flash of the local sandbox
 * ("Approvals 1", "Send to approval") that the real data then replaces. */
export function DeskGate({ children }: { children: React.ReactNode }) {
  const { mode } = useDesk();
  const lang = useLang();
  if (mode !== "checking") return <>{children}</>;
  return (
    <div className="desk-loading" role="status" aria-live="polite">
      <span className="desk-loading-dot" aria-hidden="true" />
      {TEXT[lang]}
    </div>
  );
}
