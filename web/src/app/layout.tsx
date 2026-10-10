import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, JetBrains_Mono } from "next/font/google";
import { DeskStateProvider } from "@/lib/desk-state";
import { prefsBootScript } from "@/lib/prefs-boot";
import "./globals.css";

// next/font downloads these at build time and serves them from our own origin:
// no request ever goes to Google from the browser (China-ready, fe-14).
const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});
const plexCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "NanFeng 南风 · The autonomous CFO for exporters",
  description: "NanFeng sees the cash crunch before it happens, finds the cheapest financing and executes it with the owner's permission.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${plexCondensed.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="app" data-theme="light" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
        <DeskStateProvider>{children}</DeskStateProvider>
      </body>
    </html>
  );
}
