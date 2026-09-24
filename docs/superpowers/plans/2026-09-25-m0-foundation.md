# M0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the empty-but-real MSA Pandora monorepo: two Next.js apps and five packages that install, typecheck, lint, test and build; boundary rules enforced in CI; agent rules and technology notes in place; `main` protected; both apps deploying to Vercel.

**Architecture:** A pnpm workspace with Turborepo running tasks. `apps/web` (public) and `apps/console` (admin + staff) are separate Next.js apps that consume source-only TypeScript packages under `packages/`. A small dependency-free Node script enforces the architecture's dependency rules by reading workspace manifests and scanning relative imports; it runs as part of `pnpm lint` locally and in CI.

**Tech Stack:** Node 22+, pnpm 10.15.0, Turborepo 2, TypeScript 5.9, Next.js 16 (App Router), React 19, Vitest 3, ESLint 9, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-25-pandora-orchestration-design.md` (sections 3, 4, 5.2, 6 and 8 drive this plan).

## Global Constraints

- Node `>=22`; `packageManager` is `pnpm@10.15.0` (same as msa-auth).
- TypeScript `~5.9.3`. Do **not** use TypeScript 6 or 7: `typescript-eslint` supports `<6.1.0`.
- ESLint `^9`. Do **not** use ESLint 10 yet: `eslint-config-next` plugins are tested on 9.
- Next.js `^16.3.0`, React and React DOM `^19.2.0`, Vitest `^3.2.0`, Turborepo `^2.11.0`.
- Every workspace package is named `@pandora/<folder>`: `@pandora/web`, `@pandora/console`, `@pandora/db`, `@pandora/core`, `@pandora/email`, `@pandora/ui`, `@pandora/config`.
- Packages are source-only: `"exports": { ".": "./src/index.ts" }`, no build step; apps list them in `transpilePackages`.
- Dependency rules (spec 3.2): apps never depend on apps; packages never depend on apps; only `@pandora/db` depends on `drizzle-orm`, `drizzle-kit`, `postgres` or `pg`; `@pandora/core` never depends on `react`, `react-dom` or `next`; `@pandora/ui` never depends on `@pandora/db`; no relative import may leave its own workspace.
- All work happens on branch `m0-foundation`; `main` only changes through the pull request opened in Task 8.
- Commit messages and PR descriptions carry **no** AI attribution trailers (no `Co-Authored-By`, no "Generated with").
- Do not assign issues, request reviewers, or edit project-board fields.

## File Structure

```
pandora/
├─ package.json                  root scripts (turbo) + shared dev tools
├─ pnpm-workspace.yaml           workspace globs
├─ turbo.json                    task graph
├─ .gitignore
├─ .nvmrc                        Node version hint
├─ AGENTS.md / CLAUDE.md         root agent rules (CLAUDE.md imports AGENTS.md)
├─ .github/
│  ├─ workflows/ci.yml           the single CI job, "checks"
│  ├─ CODEOWNERS                 every path → @HelloOjasMutreja until owners are named
│  └─ pull_request_template.md
├─ scripts/
│  ├─ check-boundaries.mjs       dependency-rule checker (pure functions + CLI)
│  └─ check-boundaries.test.mjs
├─ apps/
│  ├─ web/                       Next.js, port 3000, pandora.msasrm.in
│  └─ console/                   Next.js, port 3001, console.pandora.msasrm.in, noindex
├─ packages/
│  ├─ config/                    shared tsconfig + ESLint flat configs
│  ├─ core/                      siteConfig + pageTitle (first real business helper)
│  ├─ ui/                        Wordmark (first shared component)
│  ├─ db/                        empty shell; owns DB drivers
│  └─ email/                     empty shell
└─ docs/
   ├─ tech/                      one "what and why" note per core technology
   └─ decisions/README.md        how to record an architecture decision
```

Each app and package also gets its own `AGENTS.md` + `CLAUDE.md` (Task 9).

---

### Task 1: Root workspace and shared TypeScript config

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/tsconfig.nextjs.json`, `packages/config/tsconfig.react-library.json`

**Interfaces:**
- Produces: root scripts `dev`, `build`, `typecheck`, `lint`, `test`; tsconfig presets importable as `@pandora/config/tsconfig.base.json`, `@pandora/config/tsconfig.nextjs.json`, `@pandora/config/tsconfig.react-library.json`.

- [ ] **Step 1: Create the branch**

```bash
git checkout main && git pull && git checkout -b m0-foundation
```

- [ ] **Step 2: Write the root files**

`package.json`:
```json
{
  "name": "pandora",
  "private": true,
  "packageManager": "pnpm@10.15.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "node scripts/check-boundaries.mjs && turbo run lint",
    "test": "vitest run --dir scripts && turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.11.0",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - apps/*
  - packages/*
```

`turbo.json`:
```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": {},
    "lint": {},
    "test": {}
  }
}
```

`.gitignore`:
```gitignore
node_modules/
.next/
.turbo/
.vercel/
coverage/
dist/
*.tsbuildinfo
next-env.d.ts
.env
.env.*
!.env.example
```

`.nvmrc`:
```
22
```

- [ ] **Step 3: Write the shared TypeScript config package**

`packages/config/package.json`:
```json
{
  "name": "@pandora/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.nextjs.json": "./tsconfig.nextjs.json",
    "./tsconfig.react-library.json": "./tsconfig.react-library.json"
  }
}
```

`packages/config/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

`packages/config/tsconfig.nextjs.json`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

`packages/config/tsconfig.react-library.json`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx" }
}
```

- [ ] **Step 4: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes, creates `pnpm-lock.yaml`, reports the `@pandora/config` workspace. "Ignored build scripts" warnings are expected; do not approve them.

Run: `pnpm typecheck`
Expected: turbo reports `No tasks were executed` (nothing defines `typecheck` yet) and exits 0.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json .gitignore .nvmrc packages/config
git commit -m "Set up pnpm workspace, Turborepo and shared TypeScript config"
```

---

### Task 2: Boundary checker

**Files:**
- Create: `scripts/check-boundaries.mjs`
- Test: `scripts/check-boundaries.test.mjs`

**Interfaces:**
- Consumes: root `vitest` from Task 1.
- Produces (all exported from `scripts/check-boundaries.mjs`):
  - `readWorkspaces(root: string): Workspace[]` where `Workspace = { name: string, kind: "app" | "package", dir: string, deps: string[] }`
  - `findManifestViolations(workspaces: Workspace[]): string[]`
  - `listSourceFiles(dir: string): { path: string, source: string }[]`
  - `findImportEscapes(workspace: Workspace, files: { path: string, source: string }[]): string[]`
  - CLI: `node scripts/check-boundaries.mjs` exits 1 and prints violations, or exits 0 with `Boundaries OK`.

- [ ] **Step 1: Write the failing tests**

`scripts/check-boundaries.test.mjs`:
```js
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findImportEscapes,
  findManifestViolations,
  listSourceFiles,
  readWorkspaces,
} from "./check-boundaries.mjs";

const ROOT = join(tmpdir(), "pandora-fixture");
const ws = (name, kind, deps = []) => ({
  name,
  kind,
  dir: join(ROOT, kind === "app" ? "apps" : "packages", name.split("/")[1]),
  deps,
});

const clean = [
  ws("@pandora/web", "app", ["@pandora/core", "@pandora/ui", "next", "react"]),
  ws("@pandora/console", "app", ["@pandora/core", "@pandora/db", "next", "react"]),
  ws("@pandora/core", "package", ["vitest"]),
  ws("@pandora/ui", "package", ["react", "react-dom"]),
  ws("@pandora/db", "package", ["drizzle-orm", "postgres", "drizzle-kit"]),
];

describe("findManifestViolations", () => {
  it("accepts a layout that follows every rule", () => {
    expect(findManifestViolations(clean)).toEqual([]);
  });

  it("rejects an app depending on another app", () => {
    const v = findManifestViolations([...clean, ws("@pandora/x", "app", ["@pandora/web"])]);
    expect(v).toEqual(["@pandora/x depends on app @pandora/web: apps never import from other apps"]);
  });

  it("rejects a package depending on an app", () => {
    const v = findManifestViolations([...clean, ws("@pandora/y", "package", ["@pandora/console"])]);
    expect(v).toEqual(["@pandora/y depends on app @pandora/console: packages never import from apps"]);
  });

  it("rejects database drivers outside @pandora/db", () => {
    const v = findManifestViolations([...clean, ws("@pandora/z", "app", ["drizzle-orm", "pg"])]);
    expect(v).toEqual([
      "@pandora/z depends on drizzle-orm: only @pandora/db talks to the database",
      "@pandora/z depends on pg: only @pandora/db talks to the database",
    ]);
  });

  it("rejects React or Next.js in @pandora/core", () => {
    const layout = clean.map((w) => (w.name === "@pandora/core" ? { ...w, deps: ["react", "next"] } : w));
    expect(findManifestViolations(layout)).toEqual([
      "@pandora/core depends on react: core stays free of React and Next.js",
      "@pandora/core depends on next: core stays free of React and Next.js",
    ]);
  });

  it("rejects @pandora/ui depending on @pandora/db", () => {
    const layout = clean.map((w) => (w.name === "@pandora/ui" ? { ...w, deps: ["@pandora/db"] } : w));
    expect(findManifestViolations(layout)).toEqual([
      "@pandora/ui depends on @pandora/db: ui components have no data access",
    ]);
  });
});

describe("findImportEscapes", () => {
  const web = ws("@pandora/web", "app");
  const consoleApp = ws("@pandora/console", "app");

  it("allows relative imports inside the workspace and bare package imports", () => {
    const files = [
      {
        path: join(web.dir, "src", "app", "page.tsx"),
        source: 'import { Wordmark } from "@pandora/ui";\nimport { x } from "../lib/x";\nimport "./globals.css";',
      },
    ];
    expect(findImportEscapes(web, files)).toEqual([]);
  });

  it("rejects a relative import into another app", () => {
    const files = [{ path: join(consoleApp.dir, "src", "bad.ts"), source: 'import page from "../../web/src/app/page";' }];
    expect(findImportEscapes(consoleApp, files)).toEqual([
      '@pandora/console: src/bad.ts imports "../../web/src/app/page", which reaches outside the workspace. Import other workspaces by package name.',
    ]);
  });

  it("catches export-from, dynamic import and require forms", () => {
    const files = [
      {
        path: join(web.dir, "src", "a.ts"),
        source: [
          'export { siteConfig } from "../../../packages/core/src/site";',
          'const m = await import("../../console/src/x");',
          'const r = require("../../../packages/db/src/index");',
        ].join("\n"),
      },
    ];
    expect(findImportEscapes(web, files)).toHaveLength(3);
  });
});

describe("readWorkspaces and listSourceFiles", () => {
  it("reads app and package manifests and skips build folders", () => {
    const root = mkdtempSync(join(tmpdir(), "pandora-ws-"));
    mkdirSync(join(root, "apps", "web", "src"), { recursive: true });
    mkdirSync(join(root, "apps", "web", "node_modules", "dep"), { recursive: true });
    mkdirSync(join(root, "packages", "core", "src"), { recursive: true });
    writeFileSync(
      join(root, "apps", "web", "package.json"),
      JSON.stringify({ name: "@pandora/web", dependencies: { "@pandora/core": "workspace:*" }, devDependencies: { typescript: "5" } }),
    );
    writeFileSync(join(root, "packages", "core", "package.json"), JSON.stringify({ name: "@pandora/core" }));
    writeFileSync(join(root, "apps", "web", "src", "page.tsx"), "export default 1;");
    writeFileSync(join(root, "apps", "web", "node_modules", "dep", "index.js"), "module.exports = 1;");

    const workspaces = readWorkspaces(root);
    expect(workspaces.map(({ name, kind, deps }) => ({ name, kind, deps }))).toEqual([
      { name: "@pandora/web", kind: "app", deps: ["@pandora/core", "typescript"] },
      { name: "@pandora/core", kind: "package", deps: [] },
    ]);

    const files = listSourceFiles(join(root, "apps", "web"));
    expect(files.map((f) => f.path)).toEqual([join(root, "apps", "web", "src", "page.tsx")]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --dir scripts`
Expected: FAIL: `Failed to load url ./check-boundaries.mjs` (the module does not exist yet).

- [ ] **Step 3: Implement the checker**

`scripts/check-boundaries.mjs`:
```js
// Enforces the dependency rules from the orchestration spec (section 3.2).
// Two checks: package.json dependencies, and relative imports that leave a workspace.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DB_DRIVERS = ["drizzle-orm", "drizzle-kit", "postgres", "pg"];
const UI_FRAMEWORKS = ["react", "react-dom", "next"];
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", ".vercel", "dist", "coverage"]);
const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;

/** @typedef {{ name: string, kind: "app" | "package", dir: string, deps: string[] }} Workspace */

/** @param {string} root @returns {Workspace[]} */
export function readWorkspaces(root) {
  /** @type {Workspace[]} */
  const workspaces = [];
  for (const [folder, kind] of /** @type {const} */ ([["apps", "app"], ["packages", "package"]])) {
    const base = join(root, folder);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      const dir = join(base, entry.name);
      const manifest = join(dir, "package.json");
      if (!entry.isDirectory() || !existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, "utf8"));
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies });
      workspaces.push({ name: pkg.name, kind, dir, deps });
    }
  }
  return workspaces;
}

/** @param {Workspace[]} workspaces @returns {string[]} */
export function findManifestViolations(workspaces) {
  const apps = new Set(workspaces.filter((w) => w.kind === "app").map((w) => w.name));
  const violations = [];
  for (const w of workspaces) {
    for (const dep of w.deps) {
      if (apps.has(dep)) {
        const rule = w.kind === "app" ? "apps never import from other apps" : "packages never import from apps";
        violations.push(`${w.name} depends on app ${dep}: ${rule}`);
      }
      if (DB_DRIVERS.includes(dep) && w.name !== "@pandora/db") {
        violations.push(`${w.name} depends on ${dep}: only @pandora/db talks to the database`);
      }
      if (w.name === "@pandora/core" && UI_FRAMEWORKS.includes(dep)) {
        violations.push(`@pandora/core depends on ${dep}: core stays free of React and Next.js`);
      }
      if (w.name === "@pandora/ui" && dep === "@pandora/db") {
        violations.push("@pandora/ui depends on @pandora/db: ui components have no data access");
      }
    }
  }
  return violations;
}

/** @param {string} dir @returns {{ path: string, source: string }[]} */
export function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(path));
    else if (SOURCE_FILE.test(entry.name)) files.push({ path, source: readFileSync(path, "utf8") });
  }
  return files;
}

/**
 * @param {Workspace} workspace
 * @param {{ path: string, source: string }[]} files
 * @returns {string[]}
 */
export function findImportEscapes(workspace, files) {
  const violations = [];
  for (const file of files) {
    for (const match of file.source.matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) continue;
      const target = relative(workspace.dir, resolve(dirname(file.path), specifier));
      if (target === ".." || target.startsWith(`..${sep}`) || isAbsolute(target)) {
        const from = relative(workspace.dir, file.path).split(sep).join("/");
        violations.push(
          `${workspace.name}: ${from} imports "${specifier}", which reaches outside the workspace. Import other workspaces by package name.`,
        );
      }
    }
  }
  return violations;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const workspaces = readWorkspaces(root);
  const violations = [
    ...findManifestViolations(workspaces),
    ...workspaces.flatMap((w) => findImportEscapes(w, listSourceFiles(w.dir))),
  ];
  if (violations.length > 0) {
    console.error(`Boundary violations (see docs/superpowers/specs/2026-09-25-pandora-orchestration-design.md, section 3.2):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`Boundaries OK (${workspaces.length} workspaces checked)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --dir scripts`
Expected: PASS, 10 tests.

Run: `node scripts/check-boundaries.mjs`
Expected: `Boundaries OK (1 workspaces checked)` (only `@pandora/config` exists so far).

- [ ] **Step 5: Commit**

```bash
git add scripts
git commit -m "Add boundary checker for the monorepo dependency rules"
```

---

### Task 3: `@pandora/core`, `@pandora/db` and `@pandora/email`

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/site.ts`
- Test: `packages/core/src/site.test.ts`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`
- Create: `packages/email/package.json`, `packages/email/tsconfig.json`, `packages/email/src/index.ts`

**Interfaces:**
- Consumes: `@pandora/config/tsconfig.base.json` (Task 1).
- Produces: `import { siteConfig, pageTitle } from "@pandora/core"` where
  `siteConfig: { name: "MSA Pandora"; organizer: string; urls: { web: string; console: string } }` and
  `pageTitle(section?: string): string` (`pageTitle()` → `"MSA Pandora"`, `pageTitle("Register")` → `"Register · MSA Pandora"`).
  `@pandora/db` and `@pandora/email` export nothing yet.

- [ ] **Step 1: Write the core package files and the failing test**

`packages/core/package.json`:
```json
{
  "name": "@pandora/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "@pandora/config/tsconfig.base.json", "include": ["src"] }
```

`packages/core/src/site.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { pageTitle, siteConfig } from "./site";

describe("pageTitle", () => {
  it("is just the event name with no section", () => {
    expect(pageTitle()).toBe("MSA Pandora");
  });

  it("puts the section before the event name", () => {
    expect(pageTitle("Register")).toBe("Register · MSA Pandora");
  });

  it("ignores a blank section", () => {
    expect(pageTitle("   ")).toBe("MSA Pandora");
  });
});

describe("siteConfig", () => {
  it("points each app at its own domain", () => {
    expect(siteConfig.urls).toEqual({
      web: "https://pandora.msasrm.in",
      console: "https://console.pandora.msasrm.in",
    });
  });
});
```

- [ ] **Step 2: Install and run the test to verify it fails**

Run: `pnpm install && pnpm --filter @pandora/core test`
Expected: FAIL: `Failed to resolve import "./site"`.

- [ ] **Step 3: Implement**

`packages/core/src/site.ts`:
```ts
export const siteConfig = {
  name: "MSA Pandora",
  organizer: "Microsoft Student Ambassadors, SRM",
  urls: {
    web: "https://pandora.msasrm.in",
    console: "https://console.pandora.msasrm.in",
  },
} as const;

export function pageTitle(section?: string): string {
  const trimmed = section?.trim();
  return trimmed ? `${trimmed} · ${siteConfig.name}` : siteConfig.name;
}
```

`packages/core/src/index.ts`:
```ts
export { pageTitle, siteConfig } from "./site";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @pandora/core test && pnpm --filter @pandora/core typecheck`
Expected: PASS, 4 tests; typecheck exits 0.

- [ ] **Step 5: Add the db and email shells**

`packages/db/package.json`:
```json
{
  "name": "@pandora/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "drizzle-orm": "^0.45.0",
    "postgres": "^3.4.9"
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "drizzle-kit": "^0.31.0",
    "typescript": "~5.9.3"
  }
}
```

`packages/db/tsconfig.json`:
```json
{ "extends": "@pandora/config/tsconfig.base.json", "include": ["src"] }
```

`packages/db/src/index.ts`:
```ts
// Schema, migrations and queries arrive with the Registration and Operations spec.
export {};
```

`packages/email/package.json`:
```json
{
  "name": "@pandora/email",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "typescript": "~5.9.3"
  }
}
```

`packages/email/tsconfig.json`:
```json
{ "extends": "@pandora/config/tsconfig.base.json", "include": ["src"] }
```

`packages/email/src/index.ts`:
```ts
// Email templates and sending arrive with the Registration and Operations spec.
export {};
```

- [ ] **Step 6: Verify the whole workspace**

Run: `pnpm install && pnpm typecheck && pnpm test && pnpm lint`
Expected: typecheck passes for core, db and email; tests pass (scripts 10, core 4); lint prints `Boundaries OK (4 workspaces checked)`.

- [ ] **Step 7: Commit**

```bash
git add packages/core packages/db packages/email pnpm-lock.yaml
git commit -m "Add core package with siteConfig and pageTitle, plus db and email shells"
```

---

### Task 4: `@pandora/ui` with the Wordmark component

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts`, `packages/ui/src/index.ts`, `packages/ui/src/wordmark.tsx`
- Test: `packages/ui/src/wordmark.test.tsx`

**Interfaces:**
- Consumes: `@pandora/config/tsconfig.react-library.json` (Task 1).
- Produces: `import { Wordmark, type WordmarkProps } from "@pandora/ui"` where `WordmarkProps = { size?: "sm" | "lg" }` (default `"lg"`). Renders a `role="img"` element labelled `"MSA Pandora"` with "MSA" stacked above "Pandora".

- [ ] **Step 1: Write the package files and the failing test**

`packages/ui/package.json`:
```json
{
  "name": "@pandora/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": "^19.2.0"
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```

`packages/ui/tsconfig.json`:
```json
{ "extends": "@pandora/config/tsconfig.react-library.json", "include": ["src", "vitest.config.ts"] }
```

`packages/ui/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: { environment: "node" },
});
```

`packages/ui/src/wordmark.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders the event name as one accessible image", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="MSA Pandora"');
  });

  it("stacks MSA above Pandora", () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html.indexOf(">MSA<")).toBeGreaterThan(-1);
    expect(html.indexOf(">MSA<")).toBeLessThan(html.indexOf(">Pandora<"));
  });

  it("renders the large size by default and halves it for sm", () => {
    expect(renderToStaticMarkup(<Wordmark />)).toContain("font-size:4.5rem");
    expect(renderToStaticMarkup(<Wordmark size="sm" />)).toContain("font-size:2.25rem");
  });
});
```

- [ ] **Step 2: Install and run the test to verify it fails**

Run: `pnpm install && pnpm --filter @pandora/ui test`
Expected: FAIL: `Failed to resolve import "./wordmark"`.

- [ ] **Step 3: Implement**

`packages/ui/src/wordmark.tsx`:
```tsx
export type WordmarkProps = { size?: "sm" | "lg" };

export function Wordmark({ size = "lg" }: WordmarkProps) {
  const scale = size === "lg" ? 1 : 0.5;
  return (
    <div
      role="img"
      aria-label="MSA Pandora"
      style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1, fontWeight: 600 }}
    >
      <span style={{ fontSize: `${1.5 * scale}rem` }}>MSA</span>
      <span style={{ fontSize: `${4.5 * scale}rem`, letterSpacing: "-0.02em" }}>Pandora</span>
    </div>
  );
}
```

`packages/ui/src/index.ts`:
```ts
export { Wordmark, type WordmarkProps } from "./wordmark";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @pandora/ui test && pnpm --filter @pandora/ui typecheck`
Expected: PASS, 3 tests; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "Add ui package with the Pandora wordmark"
```

---

### Task 5: `apps/web` shell

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/.env.example`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `siteConfig`, `pageTitle` from `@pandora/core` (Task 3); `Wordmark` from `@pandora/ui` (Task 4); `@pandora/config/tsconfig.nextjs.json` (Task 1).
- Produces: app `@pandora/web` on port 3000 with scripts `dev`, `build`, `start`, `typecheck`.

- [ ] **Step 1: Write the app files**

`apps/web/package.json`:
```json
{
  "name": "@pandora/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@pandora/core": "workspace:*",
    "@pandora/ui": "workspace:*",
    "next": "^16.3.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "typescript": "~5.9.3"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "@pandora/config/tsconfig.nextjs.json",
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui"],
};

export default nextConfig;
```

`apps/web/.env.example`:
```bash
# Environment variables for apps/web. Copy to .env.local and fill in.
# None are needed yet; the Registration and Operations plan adds the first ones.
```

`apps/web/src/app/layout.tsx`:
```tsx
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
```

`apps/web/src/app/page.tsx`:
```tsx
import { Wordmark } from "@pandora/ui";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#1f1f1f", color: "#fff" }}>
      <Wordmark />
    </main>
  );
}
```

- [ ] **Step 2: Install, typecheck and build**

Run: `pnpm install && pnpm --filter @pandora/web typecheck && pnpm --filter @pandora/web build`
Expected: typecheck exits 0; build prints `✓ Compiled successfully` and lists route `/` as static.
If `next build` edits `apps/web/tsconfig.json` (Next adds settings it requires), keep its edits.

- [ ] **Step 3: Check the page renders**

Run in one terminal: `pnpm --filter @pandora/web start`
Run in another: `curl -s http://localhost:3000 | grep -o 'aria-label="MSA Pandora"'`
Expected: prints `aria-label="MSA Pandora"`. Stop the server.

- [ ] **Step 4: Verify the boundaries still hold**

Run: `pnpm lint`
Expected: `Boundaries OK (6 workspaces checked)`.

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "Add web app shell rendering the Pandora wordmark"
```

---

### Task 6: `apps/console` shell

**Files:**
- Create: `apps/console/package.json`, `apps/console/tsconfig.json`, `apps/console/next.config.ts`, `apps/console/.env.example`, `apps/console/src/app/layout.tsx`, `apps/console/src/app/page.tsx`

**Interfaces:**
- Consumes: `siteConfig`, `pageTitle` from `@pandora/core`; `Wordmark` from `@pandora/ui`.
- Produces: app `@pandora/console` on port 3001, never indexed by search engines.

- [ ] **Step 1: Write the app files**

`apps/console/package.json`:
```json
{
  "name": "@pandora/console",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@pandora/core": "workspace:*",
    "@pandora/ui": "workspace:*",
    "next": "^16.3.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "typescript": "~5.9.3"
  }
}
```

`apps/console/tsconfig.json`:
```json
{
  "extends": "@pandora/config/tsconfig.nextjs.json",
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/console/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui"],
};

export default nextConfig;
```

`apps/console/.env.example`:
```bash
# Environment variables for apps/console. Copy to .env.local and fill in.
# None are needed yet; the Registration and Operations plan adds the first ones.
```

`apps/console/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageTitle, siteConfig } from "@pandora/core";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.console),
  title: pageTitle("Console"),
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
```

`apps/console/src/app/page.tsx`:
```tsx
import { Wordmark } from "@pandora/ui";

export default function ConsoleHomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", alignContent: "center", gap: "1rem" }}>
      <Wordmark size="sm" />
      <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>Console</h1>
    </main>
  );
}
```

- [ ] **Step 2: Install, typecheck and build**

Run: `pnpm install && pnpm --filter @pandora/console typecheck && pnpm --filter @pandora/console build`
Expected: typecheck exits 0; build prints `✓ Compiled successfully`. Keep any `tsconfig.json` edits Next makes.

- [ ] **Step 3: Check the page renders and is not indexable**

Run in one terminal: `pnpm --filter @pandora/console start`
Run in another: `curl -s http://localhost:3001 | grep -oE 'aria-label="MSA Pandora"|name="robots" content="noindex, nofollow"'`
Expected: both strings print. Stop the server.

- [ ] **Step 4: Prove the boundary checker catches a cross-app import**

Create `apps/console/src/bad.ts` containing `import page from "../../web/src/app/page";`.
Run: `pnpm lint`
Expected: exit 1 with `@pandora/console: src/bad.ts imports "../../web/src/app/page", which reaches outside the workspace. Import other workspaces by package name.`
Delete `apps/console/src/bad.ts`, run `pnpm lint` again. Expected: `Boundaries OK (7 workspaces checked)`.

- [ ] **Step 5: Commit**

```bash
git add apps/console pnpm-lock.yaml
git commit -m "Add console app shell, kept out of search engines"
```

---

### Task 7: ESLint across every workspace

**Files:**
- Modify: `packages/config/package.json` (add ESLint dependencies and exports)
- Create: `packages/config/eslint/package.js`, `packages/config/eslint/next.js`
- Create: `eslint.config.js` in `packages/core`, `packages/ui`, `packages/db`, `packages/email`
- Create: `eslint.config.mjs` in `apps/web`, `apps/console`
- Modify: `package.json` of `packages/core`, `packages/ui`, `packages/db`, `packages/email`, `apps/web`, `apps/console` (add `"lint": "eslint ."` and the `eslint` devDependency)

**Interfaces:**
- Consumes: every workspace from Tasks 3 to 6.
- Produces: `@pandora/config/eslint/package` and `@pandora/config/eslint/next` flat configs; `lint` script in every app and package, run by `pnpm lint` after the boundary check.

- [ ] **Step 1: Add the shared ESLint configs**

Replace `packages/config/package.json` with:
```json
{
  "name": "@pandora/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./tsconfig.base.json": "./tsconfig.base.json",
    "./tsconfig.nextjs.json": "./tsconfig.nextjs.json",
    "./tsconfig.react-library.json": "./tsconfig.react-library.json",
    "./eslint/package": "./eslint/package.js",
    "./eslint/next": "./eslint/next.js"
  },
  "dependencies": {
    "@eslint/js": "^9.0.0",
    "eslint-config-next": "^16.3.0",
    "typescript-eslint": "^8.70.0"
  },
  "peerDependencies": {
    "eslint": "^9.0.0"
  },
  "devDependencies": {
    "eslint": "^9.0.0"
  }
}
```

`packages/config/eslint/package.js`:
```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**"]),
  js.configs.recommended,
  tseslint.configs.recommended,
]);
```

`packages/config/eslint/next.js`:
```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

- [ ] **Step 2: Wire every workspace to a config**

`packages/core/eslint.config.js`, `packages/ui/eslint.config.js`, `packages/db/eslint.config.js`, `packages/email/eslint.config.js` (identical):
```js
export { default } from "@pandora/config/eslint/package";
```

`apps/web/eslint.config.mjs` and `apps/console/eslint.config.mjs` (identical):
```js
export { default } from "@pandora/config/eslint/next";
```

In each of `packages/core`, `packages/ui`, `packages/db`, `packages/email`, `apps/web`, `apps/console` `package.json`:
- add `"lint": "eslint ."` to `scripts`
- add `"eslint": "^9.0.0"` to `devDependencies`

For example `packages/core/package.json` becomes:
```json
{
  "name": "@pandora/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "eslint": "^9.0.0",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 3: Install and run lint**

Run: `pnpm install && pnpm lint`
Expected: `Boundaries OK (7 workspaces checked)`, then turbo runs `lint` in six workspaces, all exit 0.
If ESLint reports problems in the code from Tasks 3 to 6, fix the code (not the config) and rerun.

- [ ] **Step 4: Prove lint catches a real problem**

Add `const unused = 1;` as the first line of `packages/core/src/site.ts`.
Run: `pnpm lint`
Expected: fails in `@pandora/core` with `'unused' is assigned a value but never used` (`@typescript-eslint/no-unused-vars`). Remove the line; `pnpm lint` passes again.

- [ ] **Step 5: Commit**

```bash
git add packages apps pnpm-lock.yaml
git commit -m "Add shared ESLint configs and lint every workspace"
```

---

### Task 8: CI, CODEOWNERS and the pull request

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/CODEOWNERS`, `.github/pull_request_template.md`

**Interfaces:**
- Consumes: root scripts `lint`, `typecheck`, `test`, `build`.
- Produces: a GitHub Actions job named **`checks`** (Task 10 requires this exact name); PR `m0-foundation → main`.

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    name: checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4 # version comes from package.json "packageManager"
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Write CODEOWNERS and the PR template**

`.github/CODEOWNERS`:
```
# Every path is owned by Ojas until area owners are named.
# To hand an area over, add a line like:  /apps/web/  @github-username
*  @HelloOjasMutreja
```

`.github/pull_request_template.md`:
```markdown
Closes #

## What changed

## Why

## How I tested it

## Checklist
- [ ] I only changed files in the area of the issue above
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally
- [ ] New environment variables are in the app's `.env.example`
- [ ] If I introduced a new technology, there's a note in `docs/tech/` (or I proposed one)
```

- [ ] **Step 3: Run the full CI sequence locally**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: every command exits 0.

- [ ] **Step 4: Commit, push and open the PR**

```bash
git add .github
git commit -m "Add CI checks, CODEOWNERS and a pull request template"
git push -u origin m0-foundation
gh pr create --base main --head m0-foundation --title "M0 Foundation: monorepo skeleton, boundaries, CI and agent rules" --body "Implements docs/superpowers/plans/2026-09-25-m0-foundation.md. Two Next.js app shells, five packages, a boundary checker for the spec's dependency rules, shared ESLint and TypeScript config, and CI. Agent rules and tech notes follow in this same PR."
```

- [ ] **Step 5: Confirm CI passes**

Run: `gh pr checks --watch`
Expected: `checks` passes. If it fails, read the log with `gh run view --log-failed`, fix locally, commit, push.

---

### Task 9: Agent rules and technology notes

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`
- Create: `AGENTS.md` and `CLAUDE.md` in each of `apps/web`, `apps/console`, `packages/core`, `packages/db`, `packages/email`, `packages/ui`, `packages/config`
- Create: `docs/tech/nextjs.md`, `docs/tech/pnpm-workspaces.md`, `docs/tech/turborepo.md`, `docs/tech/drizzle.md`, `docs/tech/supabase.md`, `docs/tech/resend.md`, `docs/tech/vercel.md`
- Create: `docs/decisions/README.md`

**Interfaces:**
- Consumes: the folder layout from Tasks 1 to 8.
- Produces: the rules every agent reads before working (spec section 6).

- [ ] **Step 1: Write the root agent rules**

`AGENTS.md`:
```markdown
# Rules for every agent working in MSA Pandora

Read this file, then the `AGENTS.md` in the app or package you're about to change, before you do anything else.

## What this repo is

MSA Pandora is the platform for MSA SRM's one-day event: registration, the team dashboard, the admin and staff
console, the event-day system and the post-event Wrapped pages. The design is in
`docs/superpowers/specs/2026-09-25-pandora-orchestration-design.md`. Read it once.

## Map

| Path | What it is | Runs at |
|---|---|---|
| `apps/web` | Public site: landing, registration, team dashboard, Wrapped | pandora.msasrm.in, port 3000 locally |
| `apps/console` | Admin portal and staff portal | console.pandora.msasrm.in, port 3001 locally |
| `packages/core` | Business rules, framework-free TypeScript | used by both apps |
| `packages/db` | Database schema, migrations and queries | used by both apps |
| `packages/email` | Email templates and sending | used by both apps |
| `packages/ui` | Pandora design system components | used by both apps |
| `packages/config` | Shared TypeScript and ESLint settings | used by every workspace |
| `scripts/check-boundaries.mjs` | Enforces the dependency rules below | runs in `pnpm lint` |

## Hard rules

1. **Stay in scope.** Work only on the issue you were given. Its `area:` label says where you may change files.
   If the work needs a change anywhere else, stop and tell the person you're working with, so they can open a new issue.
2. **Respect the boundaries.** Apps never import from other apps. Packages never import from apps. Only `packages/db`
   talks to the database. `packages/core` has no React or Next.js. `packages/ui` has no data access. Import other
   workspaces by package name (`@pandora/core`), never by relative path. `pnpm lint` fails if you break any of these.
3. **No secrets in git.** New environment variables go in the app's `.env.example` with a comment saying what they are.
4. **Never push to `main`.** Branch as `<issue-number>-<short-name>` (for example `42-registration-otp`) and open a
   pull request whose description starts with `Closes #<issue-number>`.
5. **Don't manage the board.** Never assign issues, request reviewers, or change labels, milestones or project fields.
6. **No AI attribution.** No `Co-Authored-By` or "Generated with" lines in commits or pull request descriptions.

## Teaching mode (always on)

The person you're working with is learning this stack. The first time in a session that you use a technology,
library or pattern, explain it **before** you write code that depends on it:

- **What it is**, in one or two plain sentences.
- **What problem it solves here**, in this repo, not in general.
- **Why we use it instead of the obvious alternative.** For the core stack, the reasoning is in `docs/tech/`; point to the note.
- **What to read next**, one link.

Keep it short and answer follow-up questions fully. If you bring in something new that has no `docs/tech/` note,
say so and propose one in the pull request.

## Definition of done

- Tests for new behaviour, written before the code, passing.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally.
- `.env.example` updated if you added variables.
- The pull request says what changed, why, and how you tested it, in plain language.

## Commands

| Command | Does |
|---|---|
| `pnpm install` | Installs everything for every workspace |
| `pnpm dev` | Runs both apps (web on 3000, console on 3001) |
| `pnpm --filter @pandora/web dev` | Runs one app |
| `pnpm lint` | Boundary check, then ESLint everywhere |
| `pnpm typecheck` | TypeScript everywhere |
| `pnpm test` | Every test suite |
| `pnpm build` | Production build of both apps |
```

`CLAUDE.md`:
```markdown
@AGENTS.md
```

- [ ] **Step 2: Write the per-area rules**

Each area gets an `AGENTS.md` and a `CLAUDE.md` containing exactly `@AGENTS.md`.

`apps/web/AGENTS.md`:
```markdown
# apps/web

The public site at pandora.msasrm.in: landing page, registration, participant sign-in, team dashboard,
event-day participant screens and the Wrapped pages. Issues for this app carry the `area:web` label.

- Put business rules (validation, eligibility, scoring) in `@pandora/core`, not in components or route handlers.
- Read and write data only through functions exported by `@pandora/db`.
- Reuse components from `@pandora/ui`; if a component would be useful in the console too, it belongs there.
- Everything must work on phones first. Check every screen at 375px wide.
- Never import from `apps/console`.
```

`apps/console/AGENTS.md`:
```markdown
# apps/console

The internal console at console.pandora.msasrm.in: the admin portal (payments, edit requests, notices,
shortlisting) and the staff portal (QR check-in). Issues for this app carry the `area:console` label.

- Every page except sign-in requires an authenticated admin or staff session. Never add a public page here.
- The console is excluded from search engines (`robots: noindex` in the root layout). Keep it that way.
- Business rules go in `@pandora/core`; data access goes through `@pandora/db`.
- Staff screens are used on phones at the venue, so check them at 375px wide.
- Never import from `apps/web`.
```

`packages/core/AGENTS.md`:
```markdown
# packages/core

Business rules for Pandora as plain TypeScript functions: registration validation, OTP rules, edit requests,
shortlisting, points. Issues carry the `area:core` label.

- No React, no Next.js, no database driver. Functions take plain data and return plain data.
- Every exported function has unit tests next to it (`thing.ts` + `thing.test.ts`), written first.
- Export everything public through `src/index.ts`.
```

`packages/db/AGENTS.md`:
```markdown
# packages/db

The only code that talks to the database: Drizzle schema, migrations and query functions. Issues carry the
`area:db` label.

- Apps never import `drizzle-orm` or `postgres` themselves; they call functions exported from here.
- Schema changes always come with a generated migration (`drizzle-kit generate`) committed in the same pull request.
- Known issue from msa-auth, which uses the same stack: Supabase's transaction pooler (port 6543) doesn't support
  prepared statements, so `postgres.js` needs `prepare: false`, and pipelined queries hung until msa-auth disabled
  pipelining. The connection setup for Pandora is decided in the Registration and Operations spec. Don't improvise it.
```

`packages/email/AGENTS.md`:
```markdown
# packages/email

Every email Pandora sends (OTP codes, registration confirmations, payment decisions, notices) and the code that
sends them through Resend. Issues carry the `area:email` label.

- Templates are code in this package, never strings built inside an app.
- Sending goes through one function so tests and local development can capture mail instead of sending it.
- Never log OTP codes or full email addresses.
```

`packages/ui/AGENTS.md`:
```markdown
# packages/ui

The Pandora design system: tokens, components and motion primitives shared by both apps. Issues carry the
`area:ui` label.

- Components are presentational: they take props and render. No data fetching, no `@pandora/db`.
- Every component works at 375px wide and is keyboard accessible.
- Export everything public through `src/index.ts`.
```

`packages/config/AGENTS.md`:
```markdown
# packages/config

Shared TypeScript presets (`tsconfig.*.json`) and ESLint flat configs (`eslint/`). Issues carry the `area:infra` label.

- A change here affects every workspace. Run `pnpm lint && pnpm typecheck` at the repo root before opening the pull request.
- Don't turn rules off to make a failure go away; fix the code, or raise it in the issue.
```

- [ ] **Step 3: Write the technology notes**

`docs/tech/nextjs.md`:
```markdown
# Next.js

**What it is.** A React framework that renders pages on the server and in the browser, with file-based routing
(`src/app/<route>/page.tsx`) and server-side code (Server Components, Server Actions, Route Handlers) in the same project.

**Why here.** Pandora's pages need server work (registration, OTP, dashboards) and fast public pages, and we deploy to
Vercel, which is built around Next.js. MSA's other apps (msa-auth, recruitment-portal) use it too, so what you learn transfers.

**Instead of.** A separate React single-page app plus an Express API: twice the projects, twice the deploys, and a
network boundary to secure between them.

**In this repo.** `apps/web` and `apps/console` are two Next.js apps (App Router). Shared code comes from `packages/*`
through `transpilePackages` in `next.config.ts`.

**Read next.** https://nextjs.org/docs/app/getting-started
```

`docs/tech/pnpm-workspaces.md`:
```markdown
# pnpm workspaces

**What it is.** pnpm is a package manager like npm. Workspaces let one repository hold several packages that depend
on each other (`"@pandora/core": "workspace:*"`), installed together with a single lockfile.

**Why here.** Two apps and five packages share code. pnpm is also strict: a package can only import what its own
`package.json` lists, which is what makes our boundary rules enforceable.

**Instead of.** npm or yarn workspaces. They work, but they hoist dependencies so code can accidentally import
packages it never declared.

**In this repo.** `pnpm-workspace.yaml` lists `apps/*` and `packages/*`. Run one workspace's script with
`pnpm --filter @pandora/web <script>`.

**Read next.** https://pnpm.io/workspaces
```

`docs/tech/turborepo.md`:
```markdown
# Turborepo

**What it is.** A task runner for monorepos. `turbo run build` runs `build` in every workspace in dependency order,
in parallel where it can, and skips work whose inputs haven't changed.

**Why here.** With seven workspaces, running lint, typecheck, test and build by hand is slow and easy to get wrong.
Turborepo makes the root scripts (`pnpm lint`, `pnpm build`) one command each.

**Instead of.** Plain `pnpm -r run build`: it works, but has no caching and no task graph.

**In this repo.** `turbo.json` defines the tasks; the root `package.json` scripts call `turbo run <task>`.

**Read next.** https://turborepo.com/docs
```

`docs/tech/drizzle.md`:
```markdown
# Drizzle ORM

**What it is.** A TypeScript library for talking to SQL databases. You describe tables in TypeScript, write queries
that TypeScript type-checks, and `drizzle-kit` generates SQL migration files from schema changes.

**Why here.** Queries stay close to real SQL (easy to learn, easy to debug) while TypeScript catches wrong column
names at build time. msa-auth uses it, so MSA already knows its quirks.

**Instead of.** Prisma: heavier, with its own schema language and a generated client. The Supabase JS client alone:
fine for simple reads, but no typed schema or migrations of our own.

**In this repo.** Only `packages/db` depends on Drizzle. Apps call the functions it exports.

**Read next.** https://orm.drizzle.team/docs/overview
```

`docs/tech/supabase.md`:
```markdown
# Supabase

**What it is.** A hosted Postgres database plus extras: file storage, auth and a dashboard for browsing data.

**Why here.** We need a real Postgres database and private file storage (payment proofs, photos) without running
servers. MSA already has Supabase projects for msa-auth.

**Instead of.** Running Postgres ourselves (someone has to operate it), or Firebase (not SQL, and harder to query for
admin views like "every team pending payment review").

**In this repo.** The database is reached through `packages/db` (Drizzle), not the Supabase JS client. Development and
pull request previews use a dev project; production has its own project, and production data is never used for development.

**Read next.** https://supabase.com/docs/guides/database/overview
```

`docs/tech/resend.md`:
```markdown
# Resend

**What it is.** An email-sending service with a simple API. You send an email with one function call and see
deliveries and bounces in its dashboard.

**Why here.** Pandora sends OTP codes, registration confirmations and payment decisions, and those must actually
arrive. msa-auth already sends through Resend.

**Instead of.** Sending through a Gmail account over SMTP: rate-limited, often lands in spam, and one shared password.

**In this repo.** Only `packages/email` talks to Resend. Apps call its functions.

**Read next.** https://resend.com/docs/introduction
```

`docs/tech/vercel.md`:
```markdown
# Vercel

**What it is.** A hosting platform for web apps. Connect a GitHub repository and every push deploys, and every
pull request gets its own preview URL.

**Why here.** Zero servers to manage, first-class Next.js support, and preview links let reviewers click through a
change before it merges.

**Instead of.** A VPS we maintain ourselves, or a container platform: more control, much more work.

**In this repo.** Two Vercel projects deploy from this one repository: root directory `apps/web` → pandora.msasrm.in
and `apps/console` → console.pandora.msasrm.in. Environment variables live in Vercel's project settings, never in git.

**Read next.** https://vercel.com/docs/monorepos
```

`docs/decisions/README.md`:
```markdown
# Architecture decisions

When a pull request makes a choice later contributors will wonder about ("why X and not Y?"), record it here as
`NNNN-short-title.md` (for example `0001-two-apps.md`) with four headings:

- **Context:** the situation and the constraint.
- **Decision:** what we chose.
- **Alternatives:** what we didn't choose, and why.
- **Consequences:** what this makes easier and what it makes harder.

Keep each one under a page. The orchestration spec already records the foundational decisions.
```

- [ ] **Step 4: Verify nothing broke**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass (Markdown is not linted).

- [ ] **Step 5: Commit and push to the open PR**

```bash
git add AGENTS.md CLAUDE.md apps packages docs
git commit -m "Add agent rules, per-area guides and technology notes"
git push
```

Run: `gh pr checks --watch`
Expected: `checks` passes.

---

### Task 10: Merge and protect `main`

**Files:** none (GitHub settings).

**Interfaces:**
- Consumes: the green `checks` job from Task 8.
- Produces: `main` accepts changes only through pull requests with a passing `checks` job and one approving code-owner review.

- [ ] **Step 1: Get the PR reviewed and merge it**

Ojas reviews the PR. Then:
```bash
gh pr merge m0-foundation --squash --delete-branch
```
Expected: PR merged; `git checkout main && git pull` shows the squash commit.

- [ ] **Step 2: Protect `main`**

```bash
gh api -X PUT repos/MSA-SRM/pandora/branches/main/protection --input - <<'EOF'
{
  "required_status_checks": { "strict": true, "contexts": ["checks"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```
`enforce_admins` is `false` so an org admin can still merge a pull request they authored themselves (GitHub never
lets you approve your own pull request). Everyone else goes through review.

- [ ] **Step 3: Verify**

Run: `gh api repos/MSA-SRM/pandora/branches/main/protection --jq '{checks: .required_status_checks.contexts, reviews: .required_pull_request_reviews.required_approving_review_count, codeowners: .required_pull_request_reviews.require_code_owner_reviews}'`
Expected: `{"checks":["checks"],"reviews":1,"codeowners":true}`.

Run: `git commit --allow-empty -m "protection test" && git push origin main`
Expected: rejected with `protected branch`. Then `git reset --hard origin/main` to drop the test commit.

---

### Task 11: Vercel projects (Ojas, in the Vercel dashboard)

**Files:** none (Vercel and DNS settings).

**Interfaces:**
- Consumes: merged `main` from Task 10.
- Produces: two Vercel projects deploying production from `main` and a preview for every pull request.

- [ ] **Step 1: Create the `pandora-web` project**

Vercel → Add New → Project → import `MSA-SRM/pandora`.
- Project name: `pandora-web`
- Root Directory: `apps/web` (Vercel detects Next.js and pnpm)
- Leave build and install commands at their defaults.
- Deploy.

Then Settings → Git → **Ignored Build Step**: `npx turbo-ignore --fallback=HEAD^1` (skips deploying when a commit
touches nothing this app depends on).

- [ ] **Step 2: Create the `pandora-console` project**

Same as Step 1, with project name `pandora-console` and Root Directory `apps/console`.

- [ ] **Step 3: Verify both deployments**

Open each project's production URL (`*.vercel.app`).
Expected: web shows the large "MSA Pandora" wordmark on a dark background; console shows the small wordmark and "Console".

- [ ] **Step 4: Verify previews**

Open any pull request.
Expected: the Vercel bot comments with preview links for both projects (a project whose files didn't change shows "Ignored").

- [ ] **Step 5: Custom domains (when DNS access is available)**

Vercel → each project → Settings → Domains: add `pandora.msasrm.in` to `pandora-web` and
`console.pandora.msasrm.in` to `pandora-console`. At the `msasrm.in` DNS provider, add the `CNAME` records Vercel shows
(normally `cname.vercel-dns.com`).
Expected: both domains serve over HTTPS within a few minutes of DNS propagating.
