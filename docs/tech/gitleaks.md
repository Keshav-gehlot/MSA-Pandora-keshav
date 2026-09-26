# Gitleaks

**What it is.** A secret scanner. It reads git history and reports anything that looks like a credential (API keys,
tokens, private keys, passwords in URLs), using a large set of built-in rules.

**Why here.** The pre-commit hook (`scripts/hooks/scan-secrets.mjs`) catches most secrets on your machine, but hooks
can be missing (someone never ran `pnpm install`) or skipped. The `secrets` job in `.github/workflows/pr-hygiene.yml`
scans every commit of every pull request again, so a secret can't reach `main` unnoticed. If it fails, remove the
secret from the branch and tell Ojas so the key can be rotated: once pushed, treat it as leaked.

**Instead of.** `gitleaks/gitleaks-action`: needs a paid license for organization repos, so we download the CLI
from its GitHub release (version pinned, checksum verified) and run it directly. GitHub's own secret scanning: for private
repos it needs the paid Secret Protection add-on. TruffleHog: also good, but heavier; gitleaks is one small binary.

**In this repo.** `.gitleaks.toml` extends the default rules. Its only allowlist entry covers the fake database URLs
in `packages/db/scripts/seed-lib.test.ts`, and only when both the path and the pattern match. Add to it only for
obviously fake test values, and keep each entry that narrow. To upgrade: change `GITLEAKS_VERSION` and
`GITLEAKS_SHA256` in the workflow (the checksum is in the release's `checksums.txt`).

**Read next.** https://github.com/gitleaks/gitleaks
