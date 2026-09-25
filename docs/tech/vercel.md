# Vercel

**What it is.** A hosting platform for web apps. Connect a GitHub repository and every push deploys, and every
pull request gets its own preview URL.

**Why here.** Zero servers to manage, first-class Next.js support, and preview links let reviewers click through a
change before it merges.

**Instead of.** A VPS we maintain ourselves, or a container platform: more control, much more work.

**In this repo.** Two Vercel projects, `pandora-web` (root directory `apps/web`, → pandora.msasrm.in) and
`pandora-console` (root directory `apps/console`, → console.pandora.msasrm.in), with functions in Mumbai (`bom1`).
Vercel is **not** connected to GitHub: its Git integration needs a paid plan for private organization repos. Instead
`.github/workflows/deploy.yml` builds each affected app in GitHub Actions and uploads it with the Vercel CLI. Every
pull request gets a preview link as a PR comment; every merge to `main` deploys to production. The console's
deployments require a Vercel login; the public site's don't. Environment variables live in Vercel's project settings,
never in git.

**Read next.** https://vercel.com/docs/monorepos
