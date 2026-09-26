// commit-msg hook: rejects AI attribution in commit messages (AGENTS.md, "Never"). The person who commits is the
// author; the tools they used are not credited in commits, PRs or comments.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCISSORS = /^# -+ >8 -+$/;
const RULES = [
  { test: /^\s*co-authored-by:/i, what: "a Co-Authored-By trailer" },
  {
    test: /generated (with|by) .*\b(claude|ai|copilot|chatgpt|gpt|gemini|cursor|codex)\b/i,
    what: 'a "Generated with/by <AI tool>" line',
  },
  { test: /\u{1F916}/u, what: "the robot emoji" },
];

/** @param {string} message @returns {string[]} one problem per offending line */
export function attributionProblems(message) {
  const problems = [];
  const lines = message.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (SCISSORS.test(line)) break;
    if (line.startsWith("#")) continue;
    const rule = RULES.find((r) => r.test.test(line));
    if (rule) problems.push(`line ${index + 1}: ${rule.what}: ${line.trim()}`);
  }
  return problems;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/hooks/check-commit-message.mjs <commit-message-file>");
    process.exit(2);
  }
  const problems = attributionProblems(readFileSync(file, "utf8"));
  if (problems.length > 0) {
    console.error("Commit refused: this repo does not allow AI attribution in commits (AGENTS.md, \"Never\").");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Remove those lines and commit again. You are the author of your commits.");
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
