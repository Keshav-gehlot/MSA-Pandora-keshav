# Next.js

**What it is.** A React framework that renders pages on the server and in the browser, with file-based routing
(`src/app/<route>/page.tsx`) and server-side code (Server Components, Server Actions, Route Handlers) in the same project.

**Why here.** Pandora's pages need server work (registration, OTP, dashboards) and fast public pages, and we deploy to
Vercel, which is built around Next.js. MSA's other apps (msa-auth, recruitment-portal) use it too, so what you learn transfers.

**Instead of.** A separate React single-page app plus an Express API: twice the projects, twice the deploys, and a
network boundary to secure between them.

**In this repo.** `apps/web` and `apps/console` are two Next.js apps (App Router). Shared code comes from `packages/*`
through `transpilePackages` in `next.config.ts`.

**Read next.** https://nextjs.org/docs/app/getting-started
