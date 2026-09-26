# Privacy and safety with AI tools

Pandora stores real students' names, registration numbers, phone numbers and emails. AI tools send whatever you
paste or let them read to someone else's servers. These rules keep that data, and our credentials, where they
belong. They apply to every tool, including browser chats.

## What may go into an AI tool

| OK | Not OK, ever |
|---|---|
| Code from this repo | Anything from a `.env` or `.env.local` file |
| Plans, specs, issues, error messages from your own machine | Database URLs, API keys, tokens, passwords (even "just the dev one") |
| Fake data: the seed data, test fixtures, made-up names | Real participants' data: exports, screenshots of the admin console, rows copied from the database |
| Screenshots of screens showing fake data | Screenshots showing real people's details |

If an error message contains a connection string or a key, **delete that part before pasting it anywhere**. If you
pasted a secret by mistake, tell Ojas straight away: rotating it takes a minute; finding out later takes far longer.

## Settings to check in your tool

- Turn off "use my data to train models" (or equivalent) in any tool that offers it.
- In tools that read files automatically (Cursor, Copilot, Claude Code, Codex), keep `.env*` files out of their
  context. Claude Code users get this from the repo's `.claude/settings.json`; in Cursor add `.env*` to
  `.cursorignore` on your machine.
- Don't connect third-party AI "apps" or extensions to the MSA GitHub organization.

## Credentials you'll have

| What | Who has it | Where it lives |
|---|---|---|
| Dev database URL (Neon, fake data) | Flow owners who run the apps locally | Your own `apps/web/.env.local` and `apps/console/.env.local`, never in git or chat |
| Production database, Supabase keys, Resend key, Vercel token | Ojas and Vercel only | Vercel project settings |

Locally, emails aren't really sent: they're written to `.mail/outbox.jsonl`, so you don't need an email key to
develop.

## What the repo enforces for you

- A pre-commit hook scans the lines you're committing for secrets (tokens, API keys, private keys, database URLs
  with a password) and refuses the commit if it finds one. It prints where, never the value. Obviously fake
  passwords (like `p` or `secret`) are allowed only in test files and `.env.example`.
- A commit-msg hook refuses AI attribution lines, and a pre-push hook refuses pushes to `main`.
- CI scans every commit in a pull request for secrets again, with gitleaks (`docs/tech/gitleaks.md`), so skipped
  or missing hooks don't let one through.
- `.env*` files are git-ignored.
- The seed script refuses to run against production.

These are nets, not permission: the rules above still apply.
