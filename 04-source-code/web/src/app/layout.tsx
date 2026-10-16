import type { Metadata } from "next";
import { DeskStateProvider } from "@/lib/desk-state";
import { prefsBootScript } from "@/lib/prefs-boot";
import "./globals.css";

// Fonts are self-hosted in src/fonts (see src/styles/fonts.css): the build and the browser never
// call Google Fonts, which is blocked in mainland China (fe-14).

const description = "NanFeng sees the cash crunch before it happens, finds the cheapest financing and executes it with the owner's permission.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nanfengcfo.com"),
  title: "NanFeng 南风 · The AI CFO for exporters, acting with your approval",
  description,
  openGraph: { type: "website", siteName: "NanFeng 南风", title: "NanFeng · The AI CFO for exporters", description, url: "/" },
  twitter: { card: "summary_large_image", title: "NanFeng · The AI CFO for exporters", description },
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
