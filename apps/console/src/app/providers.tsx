"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppProviders } from "@pandora/ui";

// next/link's Link is itself a Client Component. Passing it as a prop from the
// Server Component root layout to AppProviders fails at build time ("Functions
// cannot be passed directly to Client Components") because a function value
// crossing the server/client boundary during static prerendering isn't treated
// as a client reference. Importing and passing it here, entirely inside a
// Client Component, avoids that boundary crossing.
export function Providers({ children }: { children: ReactNode }) {
  return <AppProviders linkComponent={Link}>{children}</AppProviders>;
}
