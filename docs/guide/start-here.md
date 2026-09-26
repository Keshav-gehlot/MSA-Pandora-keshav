# Start here

Welcome to MSA Pandora. This page gets you from zero to your first pull request, and tells you what to do after
that. Read it top to bottom once.

## 1. What we're building (5 minutes)

Pandora runs MSA SRM's one-day event. It has four flows, each owned end to end by someone on the team:

| Flow | What it does | Owner | Tracking issue |
|---|---|---|---|
| A. Registration | A team of 3-4 registers on the landing page; the leader verifies their SRM email with a code | Harsh | #30 |
| B. Participant | Members sign in, see their team dashboard, get notices, request edits, submit Episode 0 | Sasmita | #31 |
| C. Admin | Admins review payments and edit requests, send notices, score Episode 0 and shortlist | Ujaan and Ritwik | #32 |
| D. Check-in | Shortlisted members get a QR pass; staff scan it at the venue | Alrik | #33 |

Underneath them sits a shared platform everyone uses and nobody rewrites: validation rules (`packages/core`), the
database (`packages/db`), email (`packages/email`) and the design system (`packages/ui`). The frontend team designs
the look and later styles the flows' screens.

Read, in this order: `AGENTS.md` (the rules), `docs/superpowers/specs/2026-09-26-registration-and-operations-design.md`
(what we're building), then your flow's plan in `docs/superpowers/plans/`.

## 2. One-time setup (about 20 minutes)

1. Accept the GitHub invitation to `MSA-SRM` if you haven't.
2. Install **Node 22** and **Git**. Then turn on pnpm: `corepack enable` (it picks the right pnpm version by itself).
3. Clone and install:
   ```
   git clone https://github.com/MSA-SRM/pandora.git
   cd pandora
   pnpm install
   ```
   `pnpm install` also installs the git hooks that protect you from committing secrets or pushing to `main`.
4. **Backend flow owners only:** Ojas will DM you the dev database URL. Copy `apps/web/.env.example` to
   `apps/web/.env.local` and `apps/console/.env.example` to `apps/console/.env.local`, and put the URL in
   `DATABASE_URL` in both. Never commit these files and never paste the URL into chat or an AI tool.
5. Check everything works: `pnpm lint && pnpm typecheck && pnpm test`, then `pnpm dev` and open
   http://localhost:3000 and http://localhost:3001.
6. Set up your AI tool: read `docs/agents/privacy-and-safety.md` and turn off training on your data.

## 3. Your first issue, step by step

1. Open the **board** (the MSA Pandora project on GitHub) → **My Tasks**. Pick an issue in **Ready** that's assigned
   to you. Issues in **Backlog** are waiting on another issue first: the issue says which.
2. Move the card to **In progress**.
3. Create a branch from a freshly fetched main:
   ```
   git fetch origin
   git switch -c <issue-number>-<short-name> origin/main
   ```
4. Build the context pack for your AI tool: `pnpm agent:brief <task-id>` (the task id is in the issue title, e.g. `A2`).
5. Open a **fresh session** in your AI tool with the model tier matching the issue's effort label
   (`docs/agents/effort-and-models.md`). Paste `docs/agents/prompts/start-issue.md` followed by the brief.
6. Work through the session protocol with your agent: it orients, explains, and waits for your go before changing
   anything. Ask questions whenever something isn't clear; that's the point.
7. When you stop for the day, or switch tools, ask for a handoff note (`docs/agents/prompts/handoff.md`) and post it
   as a comment on the issue.
8. When it's done: `docs/agents/prompts/ready-for-pr.md`, then push and open a **draft** pull request. Write
   **What I learned** yourself. Mark it ready when CI is green and you've re-read the diff on GitHub. Move the card
   to **In review**.
9. Ojas reviews. Fix, verify, push, then reply to each comment pointing at the commit
   (`docs/agents/prompts/respond-to-review.md`).
10. After it's merged the card moves to Done by itself. Delete your local branch: `git switch main && git pull && git branch -d <branch>`.

## 4. Who does what next

Pick the first open item in your row. Anything marked "after #n" waits for that issue to merge.

| Person | Order |
|---|---|
| Harsh | #6 rules → #8 email (can run alongside) → #7 saving a registration → #9 Server Actions → #10 the form → #11 preview check |
| Sasmita | #12 schemas and #14 sign-in (independent, either first) → #13 dashboard queries → #15 the dashboard → #16 preview check |
| Ujaan and Ritwik | #17 console sign-in and #18 admin schemas first (split them between you) → #19 overview and teams, #20 payments, #22 notices, #23 Episode 0 → #21 edit review (after #12, #13) → #24 passes on shortlisting (after #23, #26, #27) |
| Alrik | #25 pass format → #26 pass and check-in queries → #27 pass on the dashboard → #28 staff portal (after #17) → #29 preview check |
| Frontend team | Design first (inspiration, the landing page, the Pandora look). Styling issues for the flows' screens come once each flow's screens work. |
| Docs team | Keep this guide and `docs/tech/` accurate; collect each flow's "how it works" once it lands. |

Ujaan and Ritwik share the admin flow: agree who drives each issue and say so in a comment on it before starting,
so you never both build the same thing.

## 5. The daily routine (10 minutes)

Borrowed from how good open-source contributors keep their work mergeable:

1. **Your pull requests:** any conflicts, failing checks or new review comments? Review comments come first.
2. **Sync:** `git fetch origin`, and if your branch is behind, update it (the **Update branch** button on the PR, or
   `git rebase origin/main` then `git push --force-with-lease`).
3. **Your issues:** new handoff notes or questions? Anything you were waiting on now merged (check the board)?
4. **Blocked?** Move the card to **Blocked** and comment why, tagging Ojas. Don't sit on it.

## 6. Getting help

- Stuck on the code: ask your agent with `docs/agents/prompts/explain.md`, then ask your flow partner.
- Stuck on a decision or a rule: comment on the issue and tag Ojas.
- Pasted something you shouldn't have (a key, a URL, real data): tell Ojas immediately. Nobody gets in trouble for
  reporting quickly.
