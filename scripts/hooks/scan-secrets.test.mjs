import { describe, expect, it } from "vitest";
import { addedLineNumbers, findSecrets, isBinary, shouldSkipFile } from "./scan-secrets.mjs";

// Every token-shaped value below is fake and assembled at runtime, so this file never contains one literally.
const fake = {
  github: "ghp_" + "x".repeat(36),
  githubOauth: "gho_" + "A1b2".repeat(9),
  githubServer: "ghs_" + "Z9".repeat(18),
  githubPat: "github_pat_" + "11AAAA_".repeat(6),
  vercel: "vcp_" + "abc123".repeat(4),
  resend: "re_" + "Ab3_".repeat(6),
  supabase: "sb_secret_" + "q".repeat(20),
  neon: "npg_" + "a1B2c3D4",
  openai: "sk-" + "proj-" + "y".repeat(24),
  anthropic: "sk-" + "ant-" + "api03-" + "z".repeat(30),
  aws: "AKIA" + "ABCDEFGH23456789",
  privateKey: "-----BEGIN " + "RSA PRIVATE KEY-----",
  opensshKey: "-----BEGIN " + "OPENSSH PRIVATE KEY-----",
};
const dbUrl = (password, host = "db.example.com") => "postgres" + "://admin:" + password + "@" + host + "/app";

describe("findSecrets", () => {
  it.each([
    ["github token", fake.github],
    ["github token", fake.githubOauth],
    ["github token", fake.githubServer],
    ["github token", fake.githubPat],
    ["vercel token", fake.vercel],
    ["resend key", fake.resend],
    ["supabase secret key", fake.supabase],
    ["neon password", fake.neon],
    ["openai/anthropic-style key", fake.openai],
    ["openai/anthropic-style key", fake.anthropic],
    ["aws access key", fake.aws],
    ["private key block", fake.privateKey],
    ["private key block", fake.opensshKey],
  ])("flags a %s", (kind, value) => {
    expect(findSecrets(`const token = "${value}";`)).toEqual([{ line: 1, kind }]);
  });

  it("reports the line number and kind but never the value", () => {
    const hits = findSecrets(`first\nsecond\nTOKEN=${fake.github}\n`);
    expect(hits).toEqual([{ line: 3, kind: "github token" }]);
    expect(JSON.stringify(hits)).not.toContain(fake.github.slice(4));
  });

  it("flags database URLs with an inline password, for postgres, postgresql and mysql", () => {
    expect(findSecrets(dbUrl("S3cr3t-Pa55"))).toEqual([{ line: 1, kind: "database URL with a password" }]);
    expect(findSecrets("postgresql" + "://u:hunter2@h/db")).toHaveLength(1);
    expect(findSecrets("mysql" + "://root:hunter2@h:3306/db")).toHaveLength(1);
  });

  it("does not flag database URLs without a password or with a placeholder", () => {
    expect(findSecrets("postgres" + "://localhost:5432/app")).toEqual([]);
    expect(findSecrets("postgres" + "://user@host/app")).toEqual([]);
    expect(findSecrets(dbUrl("${DB_PASSWORD}"))).toEqual([]);
    expect(findSecrets(dbUrl("<password>"))).toEqual([]);
    expect(findSecrets(dbUrl("[YOUR-PASSWORD]"))).toEqual([]);
    expect(findSecrets(dbUrl("****"))).toEqual([]);
  });

  it("allows obviously fake passwords only in test files and .env.example files", () => {
    for (const password of ["p", "pass", "password", "secret", "x"]) {
      expect(findSecrets(dbUrl(password), { path: "packages/db/scripts/seed-lib.test.ts" })).toEqual([]);
      expect(findSecrets(dbUrl(password), { path: "apps/web/.env.example" })).toEqual([]);
      expect(findSecrets(dbUrl(password), { path: "packages/db/src/client.ts" })).toHaveLength(1);
      expect(findSecrets(dbUrl(password))).toHaveLength(1);
    }
  });

  it("still flags a real-looking password inside a test file", () => {
    expect(findSecrets(dbUrl("npg" + "Real0ne"), { path: "x.test.ts" })).toHaveLength(1);
  });

  it("still flags tokens inside test files", () => {
    expect(findSecrets(fake.github, { path: "a.test.ts" })).toHaveLength(1);
  });

  it("does not flag ordinary code that merely resembles a prefix", () => {
    const code = [
      "const task-name = 1;",
      "risk-assessment-for-the-whole-event-day",
      "function re_register_team_with_payment_step() {}",
      "const ghp = 'ghp_short';",
      "import { npg } from 'x';",
      "sk-short",
      "AKIAshort",
    ].join("\n");
    expect(findSecrets(code)).toEqual([]);
  });

  it("returns every hit on separate lines", () => {
    expect(findSecrets(`${fake.aws}\nok\n${fake.vercel}`)).toEqual([
      { line: 1, kind: "aws access key" },
      { line: 3, kind: "vercel token" },
    ]);
  });
});

describe("addedLineNumbers", () => {
  it("reads the new-file line numbers of added lines from a zero-context diff", () => {
    const diff = [
      "diff --git a/x.ts b/x.ts",
      "index 1..2 100644",
      "--- a/x.ts",
      "+++ b/x.ts",
      "@@ -1,0 +2,2 @@",
      "+one",
      "+two",
      "@@ -10 +12 @@",
      "-old",
      "+new",
      "@@ -20,3 +21,0 @@",
      "-gone",
      "-gone",
      "-gone",
    ].join("\n");
    expect([...addedLineNumbers(diff)]).toEqual([2, 3, 12]);
  });
});

describe("shouldSkipFile / isBinary", () => {
  it("skips the lockfile", () => {
    expect(shouldSkipFile("pnpm-lock.yaml")).toBe(true);
    expect(shouldSkipFile("apps/web/src/page.tsx")).toBe(false);
  });

  it("treats content with a NUL byte as binary", () => {
    expect(isBinary(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))).toBe(true);
    expect(isBinary(Buffer.from("plain text\n"))).toBe(false);
  });
});
