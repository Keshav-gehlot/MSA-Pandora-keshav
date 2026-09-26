// Enforces the dependency rules from the orchestration spec (section 3.2).
// Two checks: package.json dependencies, and relative imports that leave a workspace.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DB_DRIVERS = ["drizzle-orm", "drizzle-kit", "postgres", "pg", "@electric-sql/pglite"];
const DATA_ACCESS_CLIENTS = ["@supabase/supabase-js", "@prisma/client", "kysely", "mysql2", "@vercel/postgres"];
const isFrameworkDep = (dep) =>
  dep === "react" ||
  dep === "react-dom" ||
  dep === "next" ||
  dep.startsWith("@next/") ||
  dep === "@types/react" ||
  dep === "@types/react-dom";
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
      if (w.name === "@pandora/core" && isFrameworkDep(dep)) {
        violations.push(`@pandora/core depends on ${dep}: core stays free of React and Next.js`);
      }
      if (w.name === "@pandora/ui" && dep === "@pandora/db") {
        violations.push("@pandora/ui depends on @pandora/db: ui components have no data access");
      }
      if (w.name === "@pandora/core" && DATA_ACCESS_CLIENTS.includes(dep)) {
        violations.push(`@pandora/core depends on ${dep}: core stays free of data access`);
      }
      if (w.name === "@pandora/ui" && DATA_ACCESS_CLIENTS.includes(dep)) {
        violations.push(`@pandora/ui depends on ${dep}: ui components have no data access`);
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
