# Vercel

**What it is.** A hosting platform for web apps. Connect a GitHub repository and every push deploys, and every
pull request gets its own preview URL.

**Why here.** Zero servers to manage, first-class Next.js support, and preview links let reviewers click through a
change before it merges.

**Instead of.** A VPS we maintain ourselves, or a container platform: more control, much more work.

**In this repo.** Two Vercel projects deploy from this one repository: root directory `apps/web` → pandora.msasrm.in
and `apps/console` → console.pandora.msasrm.in. Environment variables live in Vercel's project settings, never in git.

**Read next.** https://vercel.com/docs/monorepos
