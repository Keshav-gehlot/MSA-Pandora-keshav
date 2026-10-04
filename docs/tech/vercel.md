# Vercel (production hosting for the public domains)

**What it is.** A hosting platform for Next.js. Here it serves only production, behind `pandora.msasrm.in` (web) and
`console.pandora.msasrm.in` (console). The projects are `pandora-web` and `pandora-console` in the club Vercel account (team `mlsa-srm-24s-projects`).

**Why here.** `msasrm.in`'s DNS lives at Hostinger and also serves other live sites (the main site on Framer,
`profile`, `resonate`, and mail records), so it stays there. At Hostinger, a plain CNAME to Vercel gives a proper
domain with certificates; a CNAME to a Cloudflare Worker does not, because a Worker only answers on a hostname whose
DNS Cloudflare manages. Pull-request previews and the `*.workers.dev` production Workers stay on Cloudflare (see
`cloudflare.md`).

**Instead of.** Moving the whole `msasrm.in` zone to Cloudflare (it would risk every other record on the domain), or
Vercel's Git integration (it blocked deploys by commit author on the free plan). Deploys here use the Vercel CLI from
GitHub Actions, so who wrote the commit does not matter.

**In this repo.** The `deploy-vercel` job in `.github/workflows/deploy.yml` runs on merges to `main` and manual
runs: `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod`, with the runtime variables passed from
the `production-web` / `production-console` environment secrets. It needs `VERCEL_TOKEN` in those environments and
skips with a warning when it is missing. `getDb()` in each app's `src/lib/cf-db.ts` skips the Cloudflare lookup when
`VERCEL` is set and uses `DATABASE_URL`. Domains and their DNS records are listed in the Vercel project's Domains
page: at Hostinger each hostname needs a CNAME (`pandora`, `console.pandora`) and a `_vercel` TXT record for
verification.

**Read next.** https://vercel.com/docs/deployments/overview and https://vercel.com/docs/cli/deploy. 
Production deploys must come from a commit authored by the club account, because Vercel's free plan blocks other authors. Never Stop Innovating
