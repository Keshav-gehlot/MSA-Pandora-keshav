# MSA Pandora: Agent Protocol Design

**Status:** Approved in conversation 2026-09-26 (package 1-4 plus ideas adapted from the OSS contribution drill)
**Parent:** `2026-09-25-pandora-orchestration-design.md` section 6

## 1. Problem

Associates build Pandora with AI agents. They use many different tools (Claude Code, Cursor, Copilot, Gemini,
Codex, ChatGPT or Claude in a browser) and switch between them mid-task. Three things must hold regardless of tool:

1. **Safety and privacy:** no secrets or real participant data leak into commits, logs or AI chats; nobody breaks
   another flow or `main`.
2. **Understanding:** the associate understands what their agent built and why, and understands the project as a
   whole, not just their slice.
3. **Efficiency:** agents spend tokens on the task, not on rediscovering the repo, and each task gets the right
   model and effort level.

## 2. Principles

- **Context lives in the repo, not in the tool.** Rules in `AGENTS.md`; requirements in plans; progress in issue
  handoff comments. Any tool, any session, any person can resume from those.
- **Enforce what can be enforced; teach the rest.** Hooks and CI make the dangerous mistakes impossible or loud;
  the protocol and guides handle judgment.
- **One source of truth.** Every tool-specific file only points at `AGENTS.md`.

## 3. Components

| # | Component | Location | Solves |
|---|---|---|---|
| 1 | Session protocol (Orient → Explain → Build → Verify → Hand off), stop-and-ask list, never list, contribution habits | `AGENTS.md` | Safety, understanding |
| 2 | Tool pointer files | `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/pandora.mdc` | Same rules in every tool |
| 3 | Privacy and safety guide | `docs/agents/privacy-and-safety.md` | What may and may not go into an AI tool; tool data settings |
| 4 | Effort and model guide | `docs/agents/effort-and-models.md` | Right tier per task, escalation, context hygiene |
| 5 | Starter prompts | `docs/agents/prompts/*.md` | Consistent, token-efficient sessions in any tool |
| 6 | Task brief generator | `pnpm agent:brief <task-id>` → `scripts/agent-brief.mjs` | A single paste-able context pack (rules + plan task + area guides), no repo crawling |
| 7 | Handoff notes | protocol step + `docs/agents/prompts/handoff.md` | Switching tools, sessions or people without losing context |
| 8 | Start-here guide | `docs/guide/start-here.md` | Day-one setup, the first issue, who does what next, the daily routine |
| 9 | Git hooks (lefthook, installed by `pnpm install`) | `lefthook.yml`, `scripts/hooks/*` | Pre-commit: secrets scan, boundary check, lint of staged files; commit-msg: reject AI attribution; pre-push: block pushes to `main` |
| 10 | PR hygiene CI | `.github/workflows/pr-hygiene.yml`, `scripts/pr-scope.mjs` | PR body has `Closes #n`; changed files stay inside the issue's `area:` label; new dependencies come with a `docs/tech/` note |
| 11 | Secret scanning CI | same workflow, gitleaks CLI | Secrets never reach GitHub unnoticed |
| 12 | Claude Code shared settings and commands | `.claude/settings.json`, `.claude/commands/*.md` | Deny reading `.env*` and destructive commands; `/start-issue`, `/handoff`, `/ready-for-pr` |

## 4. The session protocol (summary; full text lives in `AGENTS.md`)

1. **Orient (no edits):** confirm the issue number and that it's assigned to the person; read the plan task, the
   issue's handoff comments and the area `AGENTS.md`; restate the goal in plain words; list the files to touch and
   check they're inside the issue's area; name the effort level; wait for "go".
2. **Explain, generously:** before each change, what / why / what else was possible / how to check it; define new
   terms the first time; prefer over-explaining to under-explaining.
3. **Build:** tests first where the plan gives them; smallest change that satisfies the plan; stop-and-ask list
   applies.
4. **Verify:** the same commands CI runs; honest about anything that couldn't be verified.
5. **Hand off:** walk through the diff file by file; ask the person 2-3 questions about what was built and correct
   misunderstandings; post a handoff comment on the issue (done / next / decisions / open questions / how to
   verify); the person's own "What I learned" goes in the PR.

Stop and ask a human before: adding a dependency, changing the schema or a migration, changing anything another
flow imports (shared contracts: propose on the issue first), editing CI/workflows/hooks/config, touching files
outside the issue's area, deleting anything, running anything against a non-local database, force-pushing.

Never: put secrets or real participant data into any AI tool, commit `.env*`, weaken or edit a test to make it
pass, bypass hooks (`--no-verify`), push to `main`, merge PRs, assign issues or request reviewers, add AI
attribution.

Contribution habits (from the OSS contribution drill): branch from a freshly fetched `origin/main`; before
pushing run what CI runs; triage a failing check by asking "is it my diff?" and never work around a failure you
didn't cause; reply to review only after the fix is pushed, pointing at the commit; open PRs as drafts and
self-review the real GitHub diff before marking ready; retry a failing command at most twice; `--force-with-lease`
only; screenshots or the preview link for anything visual; delete merged branches.

## 5. Effort tiers (tool-agnostic)

| Label | Use for | Model tier | Thinking |
|---|---|---|---|
| `effort:light` | copy, styling, transcribing plan-given tests, small docs | the tool's fast/cheap model | low / off |
| `effort:standard` | implementing a planned task, a screen from a checklist | the tool's default capable model | normal |
| `effort:deep` | auth, sessions, transactions, concurrency, migrations, security, debugging | the tool's strongest model | high |

Escalation: the same approach failed twice → start a fresh session one tier up with the handoff note. Context
hygiene: one issue per session; start from `pnpm agent:brief`; start fresh when the session gets long.

## 6. Out of scope

Automatic reviewer requests (CODEOWNERS per flow) and a cross-flow reviewer rotation: they assign reviewers, which
Ojas decides. Revisit when he names reviewers.
