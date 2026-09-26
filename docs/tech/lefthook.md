# Lefthook

**What it is.** A git hooks manager. Git can run a script at certain moments (before a commit, after you write the
commit message, before a push); lefthook reads those scripts from one committed file, `lefthook.yml`, and installs
them into `.git/hooks` so everyone runs the same ones.

**Why here.** The rules in `AGENTS.md` (no secrets in git, no AI attribution in commits, never push to `main`) are
easy to forget, especially for someone new working with an AI tool. The hooks catch mistakes on your own machine,
before anything leaves it. The root `prepare` script runs `lefthook install`, so `pnpm install` sets them up with no
extra step.

**Instead of.** Husky: the most common choice, but its hooks are shell scripts, which behave differently in Git Bash,
PowerShell and Linux, and it needs a folder of hook files. simple-git-hooks: tiny, but one command per hook, no
parallel commands and no stdin for `pre-push`. Lefthook is a single binary (installed from npm), runs commands in
parallel, works the same on Windows and Linux, and keeps every hook in one readable file.

**In this repo.** `lefthook.yml` defines:
- `pre-commit`: `scripts/hooks/scan-secrets.mjs --staged` (refuses a commit whose added lines contain something that
  looks like a token, key or database URL with a password) and `scripts/check-boundaries.mjs`.
- `commit-msg`: `scripts/hooks/check-commit-message.mjs` (refuses AI attribution lines).
- `pre-push`: `scripts/hooks/protect-main.mjs` (refuses any push to `main`).

The logic lives in those Node scripts, with tests next to them, so it runs the same everywhere. If a hook refuses
your commit, read its message and fix the cause; never skip it with `--no-verify`. To audit the whole repo for
secrets: `node scripts/hooks/scan-secrets.mjs --all`.

**Read next.** https://lefthook.dev
