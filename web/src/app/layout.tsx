import type { Metadata } from "next";
import { DeskStateProvider } from "@/lib/desk-state";
import { prefsBootScript } from "@/lib/prefs-boot";
import "./globals.css";

// Fonts are self-hosted in src/fonts (see src/styles/fonts.css): the build and the browser never
// call Google Fonts, which is blocked in mainland China (fe-14).

export const metadata: Metadata = {
  title: "NanFeng 南风 · The autonomous CFO for exporters",
  description: "NanFeng sees the cash crunch before it happens, finds the cheapest financing and executes it with the owner's permission.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app" data-theme="light" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
        <DeskStateProvider>{children}</DeskStateProvider>
      </body>
    </html>
  );
}
