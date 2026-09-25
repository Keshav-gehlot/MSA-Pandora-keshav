import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageTitle, siteConfig } from "@pandora/core";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.web),
  title: pageTitle(),
  description: `${siteConfig.name}, by ${siteConfig.organizer}`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
