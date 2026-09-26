// Prints one Markdown "context pack" for a plan task, to paste into any AI tool: the session rules from AGENTS.md,
// the plan's global constraints, the task itself and the AGENTS.md of every workspace the task touches.
// Usage: pnpm agent:brief A2
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLANS = {
  A: "docs/superpowers/plans/2026-09-26-flow-registration.md",
  B: "docs/superpowers/plans/2026-09-26-flow-participant.md",
  C: "docs/superpowers/plans/2026-09-26-flow-admin.md",
  D: "docs/superpowers/plans/2026-09-26-flow-checkin.md",
};

const AGENTS_SECTIONS = [
  "## The session protocol",
  "## Stop and ask a human first",
  "## Never",
  "## How we work with git and GitHub",
];

/** Workspaces in the order their guides appear in a brief. */
export const WORKSPACES = [
  "apps/web",
  "apps/console",
  "packages/core",
  "packages/db",
  "packages/email",
  "packages/ui",
  "packages/config",
];

const HEADING = /^(#{1,6}) /;
const FENCE = /^\s*(```|~~~)/;

/** @param {string} taskId */
function normalizeId(taskId) {
  const id = String(taskId ?? "").trim().toUpperCase();
  if (!/^[A-Z]\d+$/.test(id)) {
    throw new Error(`Task ids look like A2 or C4 (a flow letter and a number); got "${taskId ?? ""}".`);
  }
  return id;
}

/** @param {string} taskId @returns {string} repo-relative path of the plan that holds this task */
export function planPathFor(taskId) {
  const id = normalizeId(taskId);
  const path = PLANS[/** @type {keyof typeof PLANS} */ (id[0])];
  if (!path) throw new Error(`Unknown flow letter "${id[0]}" in ${id}: use A, B, C or D.`);
  return path;
}

/**
 * The lines of a Markdown document, each tagged with its heading level (0 for non-headings and for anything inside
 * a fenced code block).
 * @param {string} markdown
 */
function scanLines(markdown) {
  let inFence = false;
  return markdown.split(/\r?\n/).map((text) => {
    if (FENCE.test(text)) {
      inFence = !inFence;
      return { text, level: 0 };
    }
    const match = inFence ? null : HEADING.exec(text);
    return { text, level: match ? match[1].length : 0 };
  });
}

/**
 * Returns the section that starts at `headingLine` (an exact heading, or else the first heading that starts with it)
 * and runs up to the next heading of the same or a higher level (or, with `stopAtLevel`, of that level or higher).
 * Trailing blank lines and horizontal rules are dropped. Returns null when there is no such heading.
 * @param {string} markdown
 * @param {string} headingLine
 * @param {{ stopAtLevel?: number }} [options]
 * @returns {string | null}
 */
export function extractSection(markdown, headingLine, options = {}) {
  const lines = scanLines(markdown);
  let start = lines.findIndex((l) => l.level > 0 && l.text.trimEnd() === headingLine);
  if (start === -1) start = lines.findIndex((l) => l.level > 0 && l.text.startsWith(headingLine));
  if (start === -1) return null;
  const stopAt = options.stopAtLevel ?? lines[start].level;
  let end = start + 1;
  while (end < lines.length && !(lines[end].level > 0 && lines[end].level <= stopAt)) end++;
  const body = lines.slice(start, end).map((l) => l.text);
  while (body.length > 1 && /^\s*(-{3,}|\*{3,}|_{3,})?\s*$/.test(body[body.length - 1])) body.pop();
  return body.join("\n");
}

/** @param {string} planMarkdown @param {string} taskId @returns {string | null} */
export function extractTask(planMarkdown, taskId) {
  const id = normalizeId(taskId);
  return extractSection(planMarkdown, `### Task ${id}:`, { stopAtLevel: 3 });
}

/** @param {string} planMarkdown @returns {string[]} task ids in plan order */
export function taskIdsIn(planMarkdown) {
  return scanLines(planMarkdown)
    .filter((l) => l.level === 3)
    .map((l) => /^### Task ([A-Z]\d+):/.exec(l.text)?.[1])
    .filter((id) => id !== undefined);
}

/** @param {string} text @returns {string[]} workspace folders mentioned in the text, in WORKSPACES order */
export function workspacesMentioned(text) {
  return WORKSPACES.filter((ws) => text.includes(`${ws}/`) || text.includes(`\`${ws}\``));
}

/**
 * @param {{ taskId: string, agents: string, plan: string, areaGuides: Record<string, string> }} input
 * @returns {string}
 */
export function buildBrief({ taskId, agents, plan, areaGuides }) {
  const id = normalizeId(taskId);
  const task = extractTask(plan, id);
  if (!task) {
    const ids = taskIdsIn(plan);
    throw new Error(`There is no task ${id} in its plan. Valid ids for this plan: ${ids.join(", ")}.`);
  }
  const title = scanLines(plan).find((l) => l.level === 1)?.text.slice(2).trim() ?? `flow ${id[0]}`;
  const parts = [
    `# Brief for task ${id} (${title})`,
    `You are working on task ${id}. Follow the session protocol below: orient first, and wait for the person to say "go" before changing anything.`,
  ];
  for (const heading of AGENTS_SECTIONS) {
    const section = extractSection(agents, heading);
    if (section) parts.push(section);
  }
  const constraints = extractSection(plan, "## Global Constraints", { stopAtLevel: 3 });
  if (constraints) parts.push(constraints);
  parts.push(task);
  for (const ws of workspacesMentioned(task)) {
    const guide = areaGuides[ws];
    if (guide) parts.push(`## ${ws}/AGENTS.md\n\n${guide.trim()}`);
  }
  return `${parts.join("\n\n")}\n`;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const taskId = process.argv[2];
  try {
    const planPath = planPathFor(taskId);
    const read = (/** @type {string} */ path) => readFileSync(join(root, path), "utf8");
    /** @type {Record<string, string>} */
    const areaGuides = {};
    for (const ws of WORKSPACES) {
      const path = join(root, ws, "AGENTS.md");
      if (existsSync(path)) areaGuides[ws] = readFileSync(path, "utf8");
    }
    process.stdout.write(buildBrief({ taskId, agents: read("AGENTS.md"), plan: read(planPath), areaGuides }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Usage: pnpm agent:brief <task-id>   (for example: pnpm agent:brief A2)");
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
