import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { pageTitle, siteConfig } from "@pandora/core";
import "@pandora/ui/styles.css";
import { Providers } from "./providers";

// The landing page's two typefaces from the Figma design, shipped from ./fonts. BT Beau Sans is applied on the
// landing page only (see landing.module.css); every other screen keeps Figtree.
const beauSans = localFont({
  src: [
    { path: "./fonts/BeauSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/BeauSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/BeauSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--pandora-font-sans",
  display: "swap",
});
const cherolina = localFont({
  src: "./fonts/Cherolina.otf",
  weight: "400",
  variable: "--pandora-font-script",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.web),
  title: pageTitle(),
  description: `${siteConfig.name}, by ${siteConfig.organizer}`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${beauSans.variable} ${cherolina.variable}`} suppressHydrationWarning>
      <head>
        {/* Marks the page as "motion allowed" before first paint so the landing hero can start hidden. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("motion")',
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..800&display=swap" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
