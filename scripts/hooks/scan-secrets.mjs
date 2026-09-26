// Secret scanner for the pre-commit hook (and a one-off audit of the whole repo).
//   node scripts/hooks/scan-secrets.mjs --staged   scans the lines added by the staged changes
//   node scripts/hooks/scan-secrets.mjs --all      scans every tracked file
// It reports where a secret is and what kind it is, never the secret itself.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {{ kind: string, pattern: RegExp }[]} */
const TOKEN_PATTERNS = [
  { kind: "github token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{22,})/ },
  { kind: "vercel token", pattern: /\bvcp_[A-Za-z0-9_-]{20,}/ },
  // Resend keys contain digits; requiring one keeps snake_case names like re_register_team_... from matching.
  { kind: "resend key", pattern: /\bre_(?=[A-Za-z0-9_]*\d)[A-Za-z0-9_]{20,}/ },
  { kind: "supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { kind: "neon password", pattern: /\bnpg_[A-Za-z0-9]{8,}/ },
  { kind: "openai/anthropic-style key", pattern: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { kind: "aws access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "private key block", pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/ },
];

const DB_URL = /\b(?:postgres(?:ql)?|mysql|mariadb)(?:\+[a-z0-9]+)?:\/\/[^\s:/@'"`]+:([^\s@'"`/]+)@/gi;
const DB_URL_KIND = "database URL with a password";
/** Passwords that are clearly placeholders anywhere: ${VAR}, <password>, [YOUR-PASSWORD], ****. */
const PLACEHOLDER_PASSWORD = /^(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|<[^>]*>|\[[^\]]*\]|\*+)$/;
/** Passwords that are obviously fake, allowed only in test files and .env.example files. */
const FAKE_PASSWORDS = new Set(["p", "pass", "password", "secret", "x"]);
const FAKE_OK_PATH = /(?:^|\/)[^/]+\.test\.[^/]+$|\.env\.example$/;

/**
 * @param {string} text
 * @param {{ path?: string }} [options] the file's repo-relative path, used for the fake-password allowlist
 * @returns {{ line: number, kind: string }[]}
 */
export function findSecrets(text, options = {}) {
  const fakeOk = options.path !== undefined && FAKE_OK_PATH.test(options.path.replaceAll("\\", "/"));
  /** @type {{ line: number, kind: string }[]} */
  const hits = [];
  for (const [index, content] of text.split(/\r?\n/).entries()) {
    const kinds = new Set();
    for (const { kind, pattern } of TOKEN_PATTERNS) if (pattern.test(content)) kinds.add(kind);
    for (const match of content.matchAll(DB_URL)) {
      const password = match[1];
      if (PLACEHOLDER_PASSWORD.test(password)) continue;
      if (fakeOk && FAKE_PASSWORDS.has(password.toLowerCase())) continue;
      kinds.add(DB_URL_KIND);
    }
    for (const kind of kinds) hits.push({ line: index + 1, kind });
  }
  return hits;
}

/** @param {string} diff output of `git diff -U0` for one file @returns {Set<number>} new-file line numbers */
export function addedLineNumbers(diff) {
  const lines = new Set();
  for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let n = start; n < start + count; n++) lines.add(n);
  }
  return lines;
}

/** @param {string} path */
export function shouldSkipFile(path) {
  return /(?:^|\/)pnpm-lock\.yaml$/.test(path);
}

/** @param {Buffer} bytes */
export function isBinary(bytes) {
  return bytes.subarray(0, 8000).includes(0);
}

/** @param {string[]} args @param {string} cwd */
function git(args, cwd) {
  return execFileSync("git", args, { cwd, maxBuffer: 256 * 1024 * 1024 });
}

/** @param {string} root @returns {{ path: string, line: number, kind: string }[]} */
function scanStaged(root) {
  const paths = git(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"], root)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const results = [];
  for (const path of paths) {
    if (shouldSkipFile(path)) continue;
    const bytes = git(["show", `:${path}`], root);
    if (isBinary(bytes)) continue;
    const added = addedLineNumbers(git(["diff", "--cached", "-U0", "--no-color", "--", path], root).toString("utf8"));
    for (const hit of findSecrets(bytes.toString("utf8"), { path })) {
      if (added.has(hit.line)) results.push({ path, ...hit });
    }
  }
  return results;
}

/** @param {string} root @returns {{ path: string, line: number, kind: string }[]} */
function scanAll(root) {
  const paths = git(["ls-files", "-z"], root).toString("utf8").split("\0").filter(Boolean);
  const results = [];
  for (const path of paths) {
    const file = join(root, path);
    if (shouldSkipFile(path) || !existsSync(file)) continue;
    const bytes = readFileSync(file);
    if (isBinary(bytes)) continue;
    for (const hit of findSecrets(bytes.toString("utf8"), { path })) results.push({ path, ...hit });
  }
  return results;
}

function main() {
  const mode = process.argv[2];
  if (mode !== "--staged" && mode !== "--all") {
    console.error("Usage: node scripts/hooks/scan-secrets.mjs --staged | --all");
    process.exit(2);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const results = mode === "--staged" ? scanStaged(root) : scanAll(root);
  if (results.length === 0) {
    if (mode === "--all") console.log("No secrets found.");
    return;
  }
  console.error("Possible secrets found (see docs/agents/privacy-and-safety.md):");
  for (const r of results) console.error(`  ${r.path}:${r.line} ${r.kind}`);
  console.error("Remove it, and if it was a real key tell Ojas so it can be rotated.");
  console.error("Keep secrets in your .env.local file, which git ignores.");
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
