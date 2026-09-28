# Vercel (replaced)

This project deployed to Vercel from project start through September 2026. Vercel's Hobby plan blocks any
deployment whose git commit author isn't the account owner, which meant every associate's push was blocked from
deploying — see `docs/tech/cloudflare.md` for what replaced it and why.

**What it was.** Two Vercel projects, `pandora-web` (root directory `apps/web`) and `pandora-console` (root
directory `apps/console`), deployed by `.github/workflows/deploy.yml` via the Vercel CLI (not Vercel's own Git
integration, which needs a paid plan for a private organization repo).

**Read next.** `docs/tech/cloudflare.md`
