# Rules for every agent working in MSA Pandora

You are helping an MSA associate build part of MSA Pandora. Read this whole file before doing anything, then the
`AGENTS.md` in every folder you're about to touch. These rules apply in every tool (Claude Code, Cursor, Copilot,
Gemini, Codex, a browser chat). If a tool-specific file disagrees with this one, this one wins.

## What this repo is

MSA Pandora is the platform for MSA SRM's one-day event: registration, the team dashboard, the admin and staff
console, the event-day system and the post-event Wrapped pages. Start with `docs/guide/start-here.md` if you're
new. Designs are in `docs/superpowers/specs/`, the work is broken into plans in `docs/superpowers/plans/`, and
every task is a GitHub issue that links to its plan section.

## Map

| Path | What it is | Runs at |
|---|---|---|
| `apps/web` | Public site: landing, registration, team dashboard, Wrapped | pandora.msasrm.in, port 3000 locally |
| `apps/console` | Admin portal and staff portal | console.pandora.msasrm.in, port 3001 locally |
| `packages/core` | Business rules, framework-free TypeScript (browser-safe main entry; Node-only code in `src/server`) | used by both apps |
| `packages/db` | Database schema, migrations, queries and file storage | used by both apps |
| `packages/email` | Email templates and sending | used by both apps |
| `packages/ui` | Pandora design system components and theme | used by both apps |
| `packages/config` | Shared TypeScript and ESLint settings | used by every workspace |
| `scripts/` | Repo tooling: boundary check, task briefs, PR checks, git hooks | runs in lint, CI and hooks |
| `docs/agents/` | How to work with AI agents here: privacy, effort levels, starter prompts | read when needed |

## The session protocol

Follow these five steps in every session, in order. The person you're working with is learning this stack, so
**explain more rather than less**: they asked for over-explanation, and understanding matters as much as the code.

### 1. Orient (no edits yet)
- Ask which issue this session is for, if you weren't told. Confirm it's assigned to this person and has no other
  open PR. Only work on assigned issues.
- Read: the issue, its **handoff comments** (earlier sessions may have left notes), its plan section (linked from
  the issue), and the `AGENTS.md` of each folder involved. `pnpm agent:brief <task-id>` (for example
  `pnpm agent:brief A2`) prints all of that as one pack.
- Restate the goal in plain words. List the files you expect to create or change and check each is inside the
  issue's `area:` label and the plan's list of files for this task.
- Name the issue's effort label and what it means for this session (see `docs/agents/effort-and-models.md`).
- Then **wait for the person to say go.**

### 2. Explain as you go
Before every change, tell the person:
- **What** you're about to do, in one or two plain sentences.
- **Why**: what problem it solves here, in this repo.
- **What else** could have been done, and why this way instead. For the core stack, point to the note in
  `docs/tech/`; for anything new, say it has no note yet and propose one in the PR.
- **How to check it** worked.

Define every new term the first time you use it. If the person seems unsure, slow down and explain again with an
example.

### 3. Build
- Where the plan gives tests, write them first, run them, show they fail, then write the code that makes them pass.
- Make the smallest change that satisfies the plan. Match the conventions of the code around you: find a similar
  piece of code in this repo and follow its shape, and say which one you followed.
- Stop and ask (see below) instead of improvising.

### 4. Verify
- Run exactly what CI runs: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- If a check fails, first ask **"is this caused by my change?"** (`git diff origin/main...HEAD --name-only`). If it
  isn't, don't work around it; tell the person and suggest they tell Ojas.
- Be honest about anything you couldn't verify (no database, no phone to test a camera, and so on).

### 5. Hand off
- Walk the person through the diff, file by file.
- Ask them 2-3 short questions about what was built and why (for example, "why does registration run in a single
  transaction?"). Correct any misunderstanding kindly. Their own words go in the PR's **What I learned** section.
- Write a **handoff comment** for the issue using `docs/agents/prompts/handoff.md` (done, next, decisions, open
  questions, how to verify), so the next session, in any tool, can continue. If you can't post it yourself, give
  it to the person to paste.

## Stop and ask a human first

Do not do any of these without the person's explicit OK, and for the starred ones, without Ojas's OK on the issue:
- Add or upgrade a dependency.*
- Change the database schema or add a migration.*
- Change anything another flow imports (a shared type, a package export, a schema): propose it in an issue comment
  first.*
- Edit CI, workflows, git hooks, `package.json` scripts or any config.*
- Touch a file outside the issue's area or the plan's file list.
- Delete files, branches or data.
- Run anything against a database that isn't your local test database.
- Force-push. (When you must after a rebase: `git push --force-with-lease`, never bare `--force`.)

## Never

- Never put secrets (`.env*` contents, tokens, database URLs, API keys) or **real participant data** into any AI
  tool, chat, issue, commit or log. See `docs/agents/privacy-and-safety.md`.
- Never commit `.env*` files or print environment variables.
- Never weaken, skip or edit a test just to make it pass.
- Never bypass hooks (`--no-verify`) or push to `main`.
- Never merge PRs, assign issues, request reviewers, or change labels, milestones or project fields.
- Never add AI attribution: no `Co-Authored-By` or "Generated with" lines in commits, PRs or comments.

## How we work with git and GitHub

- **Branch from a freshly fetched main**, every time: `git fetch origin && git switch -c <issue>-<short-name> origin/main`
  (for example `7-save-registration`). A branch made from another branch silently carries its unmerged commits.
- Commit in small steps with plain messages that say what changed and why.
- Open the pull request as a **draft**. Its body starts with `Closes #<issue>` and fills in the template. Before
  marking it ready, re-read the actual diff on GitHub: nothing outside the task, no debug code, no stale comments.
- Anything visual: add a screenshot or the preview link (the deploy bot comments it on the PR).
- Review comments: make the fix, verify it, push it, then reply pointing at the commit. Never reply "will fix"
  without the fix.
- If the same command fails the same way twice, stop retrying it; try a smaller version or explain the limitation.
- After merge, delete your local branch.

## Choosing effort

Every issue carries `effort:light`, `effort:standard` or `effort:deep`. Use the matching model tier and thinking
level from `docs/agents/effort-and-models.md`. One issue per session; start fresh (with the handoff note) when a
session gets long or an approach has failed twice.

## Commands

| Command | Does |
|---|---|
| `pnpm install` | Installs everything and the git hooks |
| `pnpm dev` | Runs both apps (web on 3000, console on 3001) |
| `pnpm --filter @pandora/web dev` | Runs one app |
| `pnpm agent:brief A2` | Prints the context pack for task A2 to paste into any AI tool |
| `pnpm lint` | Boundary check, then ESLint everywhere |
| `pnpm typecheck` | TypeScript everywhere |
| `pnpm test` | Every test suite |
| `pnpm build` | Production build of both apps |
