import type { Metadata } from "next";
import { DeskStateProvider } from "@/lib/desk-state";
import { prefsBootScript } from "@/lib/prefs-boot";
import "./globals.css";

// Fonts are self-hosted in src/fonts (see src/styles/fonts.css): the build and the browser never
// call Google Fonts, which is blocked in mainland China (fe-14).

const TITLE = "NanFeng 南风 · The autonomous CFO for exporters";
const DESCRIPTION = "NanFeng sees the cash crunch before it happens, finds the cheapest financing and executes it with the owner's permission.";

export const metadata: Metadata = {
  // absolute URLs for the link preview image (WhatsApp and email clients need them)
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nanfengcfo.com"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "NanFeng 南风", title: TITLE, description: DESCRIPTION, url: "/", locale: "en_US", alternateLocale: ["es_CL", "zh_CN"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
