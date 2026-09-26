import type { ReactElement } from "react";

export type Template<P> = { subject: (p: P) => string; text: (p: P) => string; html: (p: P) => ReactElement };
