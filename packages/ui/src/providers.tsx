"use client";

import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import type { ElementType, ReactNode } from "react";
import { msaTheme } from "./theme/msa";

export function AppProviders({ children, linkComponent }: { children: ReactNode; linkComponent?: ElementType }) {
  const content = <LayerProvider>{children}</LayerProvider>;
  return (
    <Theme theme={msaTheme} mode="system">
      {linkComponent ? <LinkProvider component={linkComponent}>{content}</LinkProvider> : content}
    </Theme>
  );
}

/**
 * Forces Astryx's light colours for everything inside it. The public landing page is a light design (white
 * panels over painted backgrounds), so its buttons and fields must not switch to dark-mode colours just because
 * the visitor's system is dark.
 */
export function LightScope({ children }: { children: ReactNode }) {
  return (
    <Theme theme={msaTheme} mode="light">
      {children}
    </Theme>
  );
}
