// PR hygiene check, run by .github/workflows/pr-hygiene.yml on every pull request:
//   1. the body closes an issue (Closes #n),
//   2. every changed file sits inside that issue's area: labels,
//   3. a newly added dependency comes with a note under docs/tech/.
// A PR labelled `maintenance` skips 1 and 2 (dependency updates, repo chores) but not 3.
// Inputs (env): PR_BODY, PR_LABELS (JSON array of names), BASE_SHA, HEAD_SHA, REPO (owner/name), GH_TOKEN for gh.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_MARKDOWN = "*.md (repo root)";
const ROOT_CONFIG = "root config files";
const ALWAYS_ALLOWED = ["pnpm-lock.yaml", "docs/tech/"];
/** @type {Record<string, string[]>} */
const AREAS = {
  web: ["apps/web/"],
  console: ["apps/console/"],
  db: ["packages/db/"],
  core: ["packages/core/"],
  email: ["packages/email/"],
  ui: ["packages/ui/"],
  docs: ["docs/", ROOT_MARKDOWN],
  infra: [".github/", "scripts/", "packages/config/", ROOT_CONFIG],
};
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies"];

/** @param {string | undefined} body @returns {number | null} */
export function issueNumberFrom(body) {
  const match = /\b(?:closes|fixes|resolves) #(\d+)/i.exec(body ?? "");
  return match ? Number(match[1]) : null;
}

/** @param {string[]} labels */
const areasOf = (labels) => labels.filter((l) => l.startsWith("area:")).map((l) => l.slice("area:".length));

/**
 * @param {string[]} labels the issue's labels
 * @returns {string[] | null} allowed path prefixes (plus the two root-file groups), or null for no restriction
 */
export function allowedPrefixes(labels) {
  const areas = areasOf(labels);
  if (areas.includes("multi")) return null;
  return [...new Set([...areas.flatMap((a) => AREAS[a] ?? []), ...ALWAYS_ALLOWED])];
}

/** @param {string} file @param {string} allowed */
function matches(file, allowed) {
  const atRoot = !file.includes("/");
  if (allowed === ROOT_MARKDOWN) return atRoot && file.toLowerCase().endsWith(".md");
  if (allowed === ROOT_CONFIG) return atRoot && !file.toLowerCase().endsWith(".md");
  return allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed;
}

/** @param {string[]} files @param {string[]} labels the issue's labels @returns {string[]} */
export function outOfScope(files, labels) {
  const allowed = allowedPrefixes(labels);
  if (allowed === null) return [];
  return files.filter((f) => !allowed.some((a) => matches(f, a)));
}

/** @param {Record<string, any>[]} manifests @returns {Set<string>} */
function externalDeps(manifests) {
  const names = new Set();
  for (const manifest of manifests) {
    for (const field of DEP_FIELDS) {
      for (const [name, spec] of Object.entries(manifest?.[field] ?? {})) {
        if (!String(spec).startsWith("workspace:")) names.add(name);
      }
    }
  }
  return names;
}

/**
 * @param {Record<string, any>[]} before every package.json at the base commit
 * @param {Record<string, any>[]} after every package.json at the head commit
 * @returns {string[]} package names that no manifest depended on before, sorted
 */
export function addedDependencies(before, after) {
  const old = externalDeps(before);
  return [...externalDeps(after)].filter((n) => !old.has(n)).sort();
}

/**
 * @param {{ body?: string, prLabels: string[], issueLabels: string[] | null, files: string[], newDependencies: string[] }} pr
 *   issueLabels is null when the issue could not be read.
 * @returns {{ errors: string[], notices: string[] }}
 */
export function evaluatePr({ body, prLabels, issueLabels, files, newDependencies }) {
  const errors = [];
  const notices = [];
  if (prLabels.includes("maintenance")) {
    notices.push("maintenance PR: skipping the issue and scope checks (the dependency check still runs).");
  } else if (issueNumberFrom(body) === null) {
    errors.push('The PR body does not reference its issue. Start the PR body with "Closes #<issue>".');
  } else if (issueLabels !== null) {
    const areas = areasOf(issueLabels);
    if (areas.includes("multi")) {
      notices.push("The issue is labelled area:multi, so changed files are not limited to one area.");
    } else {
      const outside = outOfScope(files, issueLabels);
      if (outside.length > 0) {
        const shown = areas.length > 0 ? areas.map((a) => `area:${a}`).join(", ") : "none (the issue has no area: label)";
        errors.push(
          [
            `These files are outside the issue's areas (${shown}):`,
            ...outside.map((f) => `  - ${f}`),
            "Move that work to an issue for its area, or ask Ojas to change the issue's labels.",
          ].join("\n"),
        );
      }
    }
  }
  if (newDependencies.length > 0 && !files.some((f) => f.startsWith("docs/tech/"))) {
    errors.push(
      `This PR adds new dependencies (${newDependencies.join(", ")}) but no note under docs/tech/. ` +
        "Add docs/tech/<name>.md saying what it is, why here and what else was considered.",
    );
  }
  return { errors, notices };
}

/** @param {string} cmd @param {string[]} args */
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** @param {string} sha @returns {Record<string, any>[]} */
function manifestsAt(sha) {
  return run("git", ["ls-tree", "-r", "--name-only", sha])
    .split("\n")
    .filter((p) => (p === "package.json" || p.endsWith("/package.json")) && !p.includes("node_modules/"))
    .map((p) => JSON.parse(run("git", ["show", `${sha}:${p}`])));
}

function main() {
  const { PR_BODY = "", PR_LABELS = "[]", BASE_SHA, HEAD_SHA, REPO } = process.env;
  if (!BASE_SHA || !HEAD_SHA || !REPO) {
    console.error("pr-scope needs BASE_SHA, HEAD_SHA and REPO in the environment (see pr-hygiene.yml).");
    process.exit(2);
  }
  const prLabels = JSON.parse(PR_LABELS);
  const files = run("git", ["diff", "--name-only", `${BASE_SHA}...${HEAD_SHA}`]).split("\n").filter(Boolean);
  const errors = [];
  /** @type {string[] | null} */
  let issueLabels = null;
  const issue = issueNumberFrom(PR_BODY);
  if (!prLabels.includes("maintenance") && issue !== null) {
    try {
      issueLabels = JSON.parse(run("gh", ["api", `repos/${REPO}/issues/${issue}`, "--jq", "[.labels[].name]"]));
    } catch {
      errors.push(`Could not read issue #${issue} from ${REPO}. Check the number after "Closes #".`);
    }
  }
  const newDependencies = addedDependencies(manifestsAt(BASE_SHA), manifestsAt(HEAD_SHA));
  const result = evaluatePr({ body: PR_BODY, prLabels, issueLabels, files, newDependencies });
  errors.push(...result.errors);
  for (const n of result.notices) console.log(`::notice::${n}`);
  console.log(`Changed files: ${files.length}. Issue: ${issue === null ? "none" : `#${issue}`}.`);
  if (errors.length > 0) {
    for (const e of errors) console.log(`::error::${e.replaceAll("\n", "%0A")}`);
    process.exit(1);
  }
  console.log("PR hygiene OK.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
