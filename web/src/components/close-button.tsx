"use client";

import { useLang } from "@/lib/i18n";

const LABEL = { en: "Close notice", es: "Cerrar aviso", zh: "关闭提示" };

/** Small round ✕ used to close notices. */
export function CloseButton({ onClick }: { onClick: () => void }) {
  const lang = useLang();
  return (
    <button type="button" className="close-x" aria-label={LABEL[lang]} title={LABEL[lang]} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}
