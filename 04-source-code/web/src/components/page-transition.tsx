"use client";

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";

/** Soft cross-fade with a slight rise when moving between desk screens; the sidebar stays put. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page" exit="page" default="none">
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>{children}</div>
    </ViewTransition>
  );
}
