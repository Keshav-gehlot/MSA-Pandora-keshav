# Rules for every agent working in MSA Pandora

Read this file, then the `AGENTS.md` in the app or package you're about to change, before you do anything else.

## What this repo is

MSA Pandora is the platform for MSA SRM's one-day event: registration, the team dashboard, the admin and staff
console, the event-day system and the post-event Wrapped pages. The design is in
`docs/superpowers/specs/2026-09-25-pandora-orchestration-design.md`. Read it once.

## Map

| Path | What it is | Runs at |
|---|---|---|
| `apps/web` | Public site: landing, registration, team dashboard, Wrapped | pandora.msasrm.in, port 3000 locally |
| `apps/console` | Admin portal and staff portal | console.pandora.msasrm.in, port 3001 locally |
| `packages/core` | Business rules, framework-free TypeScript | used by both apps |
| `packages/db` | Database schema, migrations and queries | used by both apps |
| `packages/email` | Email templates and sending | used by both apps |
| `packages/ui` | Pandora design system components | used by both apps |
| `packages/config` | Shared TypeScript and ESLint settings | used by every workspace |
| `scripts/check-boundaries.mjs` | Enforces the dependency rules below | runs in `pnpm lint` |

## Hard rules

1. **Stay in scope.** Work only on the issue you were given. Its `area:` label says where you may change files.
   If the work needs a change anywhere else, stop and tell the person you're working with, so they can open a new issue.
2. **Respect the boundaries.** Apps never import from other apps. Packages never import from apps. Only `packages/db`
   talks to the database. `packages/core` has no React or Next.js. `packages/ui` has no data access. Import other
   workspaces by package name (`@pandora/core`), never by relative path. `pnpm lint` checks these automatically; it
   catches the common mistakes, not every possible one, so follow the rules even where the check can't see.
3. **No secrets in git.** New environment variables go in the app's `.env.example` with a comment saying what they are.
4. **Never push to `main`.** Branch as `<issue-number>-<short-name>` (for example `42-registration-otp`) and open a
   pull request whose description starts with `Closes #<issue-number>`.
5. **Don't manage the board.** Never assign issues, request reviewers, or change labels, milestones or project fields.
6. **No AI attribution.** No `Co-Authored-By` or "Generated with" lines in commits or pull request descriptions.

## Teaching mode (always on)

The person you're working with is learning this stack. The first time in a session that you use a technology,
library or pattern, explain it **before** you write code that depends on it:

- **What it is**, in one or two plain sentences.
- **What problem it solves here**, in this repo, not in general.
- **Why we use it instead of the obvious alternative.** For the core stack, the reasoning is in `docs/tech/`; point to the note.
- **What to read next**, one link.

Keep it short and answer follow-up questions fully. If you bring in something new that has no `docs/tech/` note,
say so and propose one in the pull request.

## Definition of done

- Tests for new behaviour, written before the code, passing.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally.
- `.env.example` updated if you added variables.
- The pull request says what changed, why, and how you tested it, in plain language.

## Commands

| Command | Does |
|---|---|
| `pnpm install` | Installs everything for every workspace |
| `pnpm dev` | Runs both apps (web on 3000, console on 3001) |
| `pnpm --filter @pandora/web dev` | Runs one app |
| `pnpm lint` | Boundary check, then ESLint everywhere |
| `pnpm typecheck` | TypeScript everywhere |
| `pnpm test` | Every test suite |
| `pnpm build` | Production build of both apps |
