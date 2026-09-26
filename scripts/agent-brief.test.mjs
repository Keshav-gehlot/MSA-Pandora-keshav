import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildBrief,
  extractSection,
  extractTask,
  planPathFor,
  taskIdsIn,
  workspacesMentioned,
} from "./agent-brief.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const agents = [
  "# Rules",
  "",
  "Intro.",
  "",
  "## The session protocol",
  "",
  "Five steps.",
  "",
  "### 1. Orient (no edits yet)",
  "- Read things.",
  "",
  "## Stop and ask a human first",
  "- Add a dependency.",
  "",
  "## Never",
  "- Never push to main.",
  "",
  "## How we work with git and GitHub",
  "- Branch from main.",
  "",
  "## Commands",
  "| pnpm lint | lint |",
  "",
].join("\n");

const plan = [
  "# Flow Z: Test Plan",
  "",
  "## Global Constraints",
  "",
  "- Only edit `packages/core/src/flows/z.ts`.",
  "",
  "---",
  "",
  "### Task Z1: First thing",
  "",
  "**Files:** `packages/core/src/flows/z.ts`, `packages/db`",
  "",
  "```md",
  "## Not a heading, inside a code block",
  "### Also not a heading",
  "```",
  "",
  "Done with Z1.",
  "",
  "### Task Z10: Tenth thing",
  "",
  "Touches `apps/web/src/page.tsx`.",
  "",
  "## Done when",
  "- all good",
  "",
].join("\n");

describe("planPathFor", () => {
  it("maps each flow letter to its plan, case-insensitively", () => {
    expect(planPathFor("A2")).toBe("docs/superpowers/plans/2026-09-26-flow-registration.md");
    expect(planPathFor("b1")).toBe("docs/superpowers/plans/2026-09-26-flow-participant.md");
    expect(planPathFor("C4")).toBe("docs/superpowers/plans/2026-09-26-flow-admin.md");
    expect(planPathFor("d3")).toBe("docs/superpowers/plans/2026-09-26-flow-checkin.md");
  });

  it("rejects unknown letters and malformed ids", () => {
    expect(() => planPathFor("E1")).toThrow(/A, B, C or D/);
    expect(() => planPathFor("A")).toThrow(/like A2/);
    expect(() => planPathFor("")).toThrow(/like A2/);
    expect(() => planPathFor("2A")).toThrow(/like A2/);
  });
});

describe("extractSection", () => {
  it("returns a ## section including its ### subsections, up to the next ## heading", () => {
    const section = extractSection(agents, "## The session protocol");
    expect(section.startsWith("## The session protocol")).toBe(true);
    expect(section).toContain("### 1. Orient (no edits yet)");
    expect(section).not.toContain("Stop and ask");
  });

  it("matches a heading by prefix when there is no exact match", () => {
    expect(extractSection(agents, "## Stop and ask")).toBe("## Stop and ask a human first\n- Add a dependency.");
  });

  it("prefers an exact heading over a longer one that shares the prefix", () => {
    const md = "## Never mind\nwrong\n\n## Never\nright\n";
    expect(extractSection(md, "## Never")).toBe("## Never\nright");
  });

  it("ignores heading-like lines inside fenced code blocks", () => {
    const section = extractSection(plan, "### Task Z1:");
    expect(section).toContain("## Not a heading, inside a code block");
    expect(section).toContain("Done with Z1.");
  });

  it("can stop at deeper headings too, and trims a trailing rule", () => {
    expect(extractSection(plan, "## Global Constraints", { stopAtLevel: 3 })).toBe(
      "## Global Constraints\n\n- Only edit `packages/core/src/flows/z.ts`.",
    );
  });

  it("returns null when the heading is missing", () => {
    expect(extractSection(agents, "## Nope")).toBeNull();
  });
});

describe("extractTask", () => {
  it("returns the whole task section and does not confuse Z1 with Z10", () => {
    const task = extractTask(plan, "z1");
    expect(task.startsWith("### Task Z1: First thing")).toBe(true);
    expect(task).not.toContain("Tenth");
  });

  it("stops a last task at the next ## heading", () => {
    const task = extractTask(plan, "Z10");
    expect(task).toContain("apps/web/src/page.tsx");
    expect(task).not.toContain("Done when");
  });

  it("returns null for a task that is not in the plan", () => {
    expect(extractTask(plan, "Z2")).toBeNull();
  });

  it("finds A2 in the real registration plan", () => {
    const real = readFileSync(join(ROOT, planPathFor("A2")), "utf8");
    const task = extractTask(real, "A2");
    expect(task.startsWith("### Task A2:")).toBe(true);
    expect(task).toContain("registerTeam");
    expect(task).not.toContain("### Task A3:");
  });
});

describe("taskIdsIn", () => {
  it("lists the task ids in plan order", () => {
    expect(taskIdsIn(plan)).toEqual(["Z1", "Z10"]);
  });
});

describe("workspacesMentioned", () => {
  it("finds workspace folders by path substring or bare name in backticks, in a stable order", () => {
    const text = "Edit `packages/ui` and apps/console/src/x.tsx, then packages/db/src/y.ts and `apps/web`.";
    expect(workspacesMentioned(text)).toEqual(["apps/web", "apps/console", "packages/db", "packages/ui"]);
  });

  it("ignores lookalikes such as packages/dbx or an unknown workspace", () => {
    expect(workspacesMentioned("packages/dbx/ and packages/other/ and `packages/core-old`")).toEqual([]);
  });

  it("returns nothing for text without workspace paths", () => {
    expect(workspacesMentioned("no paths here")).toEqual([]);
  });
});

describe("buildBrief", () => {
  const areaGuides = {
    "packages/core": "# core rules\nKeep it pure.",
    "packages/db": "# db rules\nOne transaction.",
    "apps/web": "# web rules",
  };

  it("assembles header, AGENTS.md sections, plan constraints, the task and area guides in order", () => {
    const brief = buildBrief({ taskId: "z1", agents, plan, areaGuides });
    const order = [
      "# Brief for task Z1 (Flow Z: Test Plan)",
      "say \"go\"",
      "## The session protocol",
      "## Stop and ask a human first",
      "## Never",
      "## How we work with git and GitHub",
      "## Global Constraints",
      "### Task Z1: First thing",
      "## packages/core/AGENTS.md",
      "Keep it pure.",
      "## packages/db/AGENTS.md",
      "One transaction.",
    ];
    let at = -1;
    for (const piece of order) {
      const next = brief.indexOf(piece, at + 1);
      expect(next, `expected "${piece}" after position ${at}`).toBeGreaterThan(at);
      at = next;
    }
    expect(brief).not.toContain("## Commands");
    expect(brief).not.toContain("apps/web/AGENTS.md");
    expect(brief).not.toContain("Tenth thing");
  });

  it("throws a helpful error listing valid ids when the task is missing", () => {
    expect(() => buildBrief({ taskId: "Z7", agents, plan, areaGuides })).toThrow(/Z1, Z10/);
  });
});
