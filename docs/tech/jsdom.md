# jsdom

**What it is.** A pure-JavaScript implementation of standard web and DOM APIs for Node.js.

**Why here.** Vitest runs in a headless Node.js process by default. Component tests for interactive console interfaces—such as `<CheckinScanner>` in `apps/console/src/features/checkin/scanner.test.tsx`—require a simulated browser environment to mount React component trees, manipulate DOM nodes, dispatch browser events, and stub browser APIs like `navigator.mediaDevices` and HTML5 `<canvas>`. `jsdom` provides this environment via Vitest's `@vitest-environment jsdom` directive.

**Scope and constraints.** `jsdom` is approved strictly as a development and test dependency (`devDependencies` in `apps/console/package.json`). It is excluded from production builds and does not ship with the Cloudflare Workers runtime bundle.

**In this repo.** Declared in `apps/console/package.json` under `devDependencies` and loaded per-file in `apps/console/src/features/checkin/scanner.test.tsx` using `// @vitest-environment jsdom`.

**Read next.** https://github.com/jsdom/jsdom
