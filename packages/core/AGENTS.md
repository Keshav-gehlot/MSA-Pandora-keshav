# packages/core

Business rules for Pandora as plain TypeScript functions: registration validation, OTP rules, edit requests,
shortlisting, points. Issues carry the `area:core` label.

- No React, no Next.js, no database driver. Functions take plain data and return plain data.
- Every exported function has unit tests next to it (`thing.ts` + `thing.test.ts`), written first.
- The main entry (`src/index.ts`, imported as `@pandora/core`) must stay browser-safe: the registration form imports
  it in the browser. Nothing reachable from it may import `node:` modules or other Node-only code.
- Node-only helpers live in `src/server/` and are exported through `src/server/index.ts` as `@pandora/core/server`
  (OTP codes and hashes, session tokens). `generateToken` and `hashToken` are also the helpers for check-in passes:
  put the token in the QR code and store only its hash.
- Export everything else public through `src/index.ts`. Limits such as `OTP` and `TEAM_SIZE` live in `src/config.ts`.
