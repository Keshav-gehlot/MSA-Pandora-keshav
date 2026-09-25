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

  it("rejects data-access clients in @pandora/core and @pandora/ui, but allows apps to use @supabase/supabase-js", () => {
    const layout = [
      ...clean.map((w) =>
        w.name === "@pandora/core"
          ? { ...w, deps: [...w.deps, "@supabase/supabase-js"] }
          : w.name === "@pandora/ui"
            ? { ...w, deps: [...w.deps, "@supabase/supabase-js"] }
            : w.name === "@pandora/web"
              ? { ...w, deps: [...w.deps, "@supabase/supabase-js"] }
              : w,
      ),
    ];
    expect(findManifestViolations(layout)).toEqual([
      "@pandora/core depends on @supabase/supabase-js: core stays free of data access",
      "@pandora/ui depends on @supabase/supabase-js: ui components have no data access",
    ]);
  });

  it("rejects React or Next.js in @pandora/core by pattern, including @types packages and @next/* subpackages", () => {
    const layout = clean.map((w) =>
      w.name === "@pandora/core" ? { ...w, deps: ["@types/react", "@next/font"] } : w,
    );
    expect(findManifestViolations(layout)).toEqual([
      "@pandora/core depends on @types/react: core stays free of React and Next.js",
      "@pandora/core depends on @next/font: core stays free of React and Next.js",
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
