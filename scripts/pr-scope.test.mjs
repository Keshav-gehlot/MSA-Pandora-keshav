import { describe, expect, it } from "vitest";
import { addedDependencies, allowedPrefixes, evaluatePr, issueNumberFrom, outOfScope } from "./pr-scope.mjs";

describe("issueNumberFrom", () => {
  it("reads Closes/Fixes/Resolves #n in any case", () => {
    expect(issueNumberFrom("Closes #7\n\n## What")).toBe(7);
    expect(issueNumberFrom("fixes #12")).toBe(12);
    expect(issueNumberFrom("Some text. RESOLVES #300 and more")).toBe(300);
  });

  it("returns null without a closing keyword", () => {
    expect(issueNumberFrom("Related to #7")).toBeNull();
    expect(issueNumberFrom("#7")).toBeNull();
    expect(issueNumberFrom("")).toBeNull();
    expect(issueNumberFrom(undefined)).toBeNull();
  });
});

describe("allowedPrefixes", () => {
  it("maps area labels to folders and always allows the lockfile and docs/tech/", () => {
    expect(allowedPrefixes(["area:web", "effort:light"])).toEqual(["apps/web/", "pnpm-lock.yaml", "docs/tech/"]);
    expect(allowedPrefixes(["area:db", "area:core"])).toEqual([
      "packages/db/",
      "packages/core/",
      "pnpm-lock.yaml",
      "docs/tech/",
    ]);
  });

  it("covers docs and infra, including root files", () => {
    expect(allowedPrefixes(["area:docs"])).toContain("docs/");
    expect(allowedPrefixes(["area:docs"])).toContain("*.md (repo root)");
    expect(allowedPrefixes(["area:infra"])).toEqual(
      expect.arrayContaining([".github/", "scripts/", "packages/config/", "root config files"]),
    );
  });

  it("returns null (no restriction) for area:multi", () => {
    expect(allowedPrefixes(["area:multi", "area:web"])).toBeNull();
  });
});

describe("outOfScope", () => {
  it("returns files outside the issue's areas", () => {
    const files = ["apps/web/src/page.tsx", "packages/db/src/x.ts", "pnpm-lock.yaml", "docs/tech/zod.md"];
    expect(outOfScope(files, ["area:web"])).toEqual(["packages/db/src/x.ts"]);
  });

  it("does not treat apps/webx/ as apps/web/", () => {
    expect(outOfScope(["apps/webx/a.ts"], ["area:web"])).toEqual(["apps/webx/a.ts"]);
  });

  it("allows root markdown only for docs, and root config files only for infra", () => {
    expect(outOfScope(["README.md", "docs/guide/x.md", "package.json"], ["area:docs"])).toEqual(["package.json"]);
    expect(outOfScope(["package.json", "lefthook.yml", ".gitleaks.toml", "README.md"], ["area:infra"])).toEqual([
      "README.md",
    ]);
    expect(outOfScope(["apps/web/README.md"], ["area:docs"])).toEqual(["apps/web/README.md"]);
  });

  it("flags everything but the always-allowed files when the issue has no area label", () => {
    expect(outOfScope(["apps/web/a.ts", "docs/tech/x.md"], ["effort:light"])).toEqual(["apps/web/a.ts"]);
  });

  it("allows everything for area:multi", () => {
    expect(outOfScope(["anything/at/all.ts"], ["area:multi"])).toEqual([]);
  });
});

describe("addedDependencies", () => {
  const before = [
    { name: "pandora", devDependencies: { turbo: "^2", vitest: "^3" } },
    { name: "@pandora/core", dependencies: { zod: "^4" }, peerDependencies: { react: "^19" } },
  ];

  it("returns package names that no manifest had before, sorted", () => {
    const after = [
      { name: "pandora", devDependencies: { turbo: "^2", vitest: "^3", lefthook: "^1" } },
      { name: "@pandora/core", dependencies: { zod: "^4", "date-fns": "^4" }, peerDependencies: { react: "^19" } },
    ];
    expect(addedDependencies(before, after)).toEqual(["date-fns", "lefthook"]);
  });

  it("ignores moves between workspaces, version bumps, removals and workspace packages", () => {
    const after = [
      { name: "pandora", devDependencies: { turbo: "^3" } },
      { name: "@pandora/core", dependencies: { zod: "^4", vitest: "^3" } },
      { name: "@pandora/web", dependencies: { "@pandora/core": "workspace:*", react: "^19" } },
    ];
    expect(addedDependencies(before, after)).toEqual([]);
  });

  it("handles manifests without dependency fields", () => {
    expect(addedDependencies([{}], [{ name: "x" }])).toEqual([]);
  });
});

describe("evaluatePr", () => {
  const base = {
    body: "Closes #7",
    prLabels: [],
    issueLabels: ["area:web"],
    files: ["apps/web/src/a.tsx"],
    newDependencies: [],
  };

  it("passes a PR that references its issue and stays in scope", () => {
    expect(evaluatePr(base).errors).toEqual([]);
  });

  it("fails without Closes #n, with the fix", () => {
    const { errors } = evaluatePr({ ...base, body: "Adds a form" });
    expect(errors.join("\n")).toMatch(/Closes #<issue>/);
  });

  it("fails on out-of-scope files, listing each file and the issue's areas", () => {
    const { errors } = evaluatePr({ ...base, files: ["apps/web/a.ts", "packages/db/b.ts", "packages/ui/c.ts"] });
    const text = errors.join("\n");
    expect(text).toContain("packages/db/b.ts");
    expect(text).toContain("packages/ui/c.ts");
    expect(text).toContain("area:web");
    expect(text).not.toContain("apps/web/a.ts");
  });

  it("notes area:multi without failing", () => {
    const result = evaluatePr({ ...base, issueLabels: ["area:multi"], files: ["x/y.ts"] });
    expect(result.errors).toEqual([]);
    expect(result.notices.join("\n")).toMatch(/area:multi/);
  });

  it("skips the issue and scope checks for maintenance PRs but still checks dependencies", () => {
    const skipped = evaluatePr({ ...base, body: "", prLabels: ["maintenance"], files: ["x/y.ts"] });
    expect(skipped.errors).toEqual([]);
    expect(skipped.notices.join("\n")).toMatch(/maintenance/);
    const withDep = evaluatePr({ ...base, body: "", prLabels: ["maintenance"], newDependencies: ["left-pad"] });
    expect(withDep.errors.join("\n")).toContain("left-pad");
  });

  it("requires a docs/tech/ note when a PR adds a dependency", () => {
    const failing = evaluatePr({ ...base, newDependencies: ["date-fns", "zod-extra"] });
    expect(failing.errors.join("\n")).toMatch(/date-fns, zod-extra.*docs\/tech\//s);
    const passing = evaluatePr({ ...base, newDependencies: ["date-fns"], files: [...base.files, "docs/tech/date-fns.md"] });
    expect(passing.errors).toEqual([]);
  });
});
