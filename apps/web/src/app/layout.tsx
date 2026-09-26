import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageTitle, siteConfig } from "@pandora/core";
import "@pandora/ui/styles.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.web),
  title: pageTitle(),
  description: `${siteConfig.name}, by ${siteConfig.organizer}`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
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
