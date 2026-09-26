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
