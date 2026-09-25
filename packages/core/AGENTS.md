# packages/core

Business rules for Pandora as plain TypeScript functions: registration validation, OTP rules, edit requests,
shortlisting, points. Issues carry the `area:core` label.

- No React, no Next.js, no database driver. Functions take plain data and return plain data.
- Every exported function has unit tests next to it (`thing.ts` + `thing.test.ts`), written first.
- Export everything public through `src/index.ts`.
