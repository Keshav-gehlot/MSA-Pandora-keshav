// pre-push hook: refuses any push that updates or deletes the remote main branch. Changes reach main only through
// a reviewed pull request. Git gives the hook one line per ref on stdin:
//   <local ref> <local sha> <remote ref> <remote sha>
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} stdin @returns {boolean} */
export function pushesToMain(stdin) {
  return stdin
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .some((fields) => fields.length === 4 && fields[2] === "refs/heads/main");
}

function main() {
  let stdin = "";
  try {
    stdin = readFileSync(0, "utf8");
  } catch {
    // No stdin (for example when run by hand): nothing is being pushed.
  }
  if (pushesToMain(stdin)) {
    console.error("Push refused: never push to main. Push your branch and open a pull request instead:");
    console.error("  git push -u origin HEAD");
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
