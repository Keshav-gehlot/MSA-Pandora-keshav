# MSA Pandora: Orchestration Design

**Status:** Approved in conversation 2026-09-25, pending written review
**Scope:** How the whole Pandora system is organized, built, deployed and managed.
Feature behaviour (registration fields, episodes, Wrapped) lives in the sub-project specs listed in section 2.

---

## 1. What Pandora is

MSA Pandora is the platform for MSA SRM's one-day event (formerly "Tech Heist" / "Labyrinth"; the name may still change).
It covers the full participant lifecycle: discovering the event, registering a team, qualifying through Episode 0,
checking in on event day, playing through Episodes 1 to 3, and receiving a personal Wrapped recap afterwards.

It is built by MSA associates, most of whom work through AI coding agents and many of whom are meeting parts of this
stack for the first time. The orchestration below exists so that a large group can build one system in parallel
without drifting out of their lane, and learn the technology while doing it.

## 2. Sub-projects

The system is split into six sub-projects. Each gets its own spec and implementation plan before any code is written.

| # | Sub-project | Lives in | Milestone |
|---|---|---|---|
| 1 | Landing + registration | `apps/web` | M1 Registration opens |
| 2 | Participant sign-in + team dashboard | `apps/web` | M2 Shortlisting (Episode 0) |
| 3 | Admin portal | `apps/console` | M2 Shortlisting (Episode 0) |
| 4 | Staff portal (QR check-in) | `apps/console` | M3 Event day |
| 5 | Event-day system (episodes, Lock and Key, points, leaderboard) | `apps/web` + `apps/console` | M3 Event day |
| 6 | Wrapped + journey map | `apps/web` | M4 Post-event |

Sub-projects 1 to 4 share one data model and one sign-in flow, so they are specified together as
**"Registration and Operations"**. Sub-projects 5 and 6 are specified separately once event mechanics settle.

## 3. Repository

One repository, `MSA-SRM/pandora`, organized as a **pnpm workspace monorepo** with **Turborepo** running tasks.
This is the same workspace pattern as `msa-auth`, so associates learn one convention.

```
pandora/
├─ apps/
│  ├─ web/        pandora.msasrm.in          landing, registration, team dashboard, event-day participant UI, Wrapped
│  └─ console/    console.pandora.msasrm.in  admin portal + staff portal
├─ packages/
│  ├─ db/         Drizzle schema, migrations, and the only code that queries the database
│  ├─ core/       business rules (registration, OTP, edit requests, shortlisting, points); framework-free TypeScript
│  ├─ email/      email templates and sending
│  ├─ ui/         Pandora design system: tokens, components, motion primitives
│  └─ config/     shared TypeScript and ESLint configuration
├─ docs/
│  ├─ superpowers/specs/   design specs (this file lives here)
│  ├─ superpowers/plans/   implementation plans
│  ├─ decisions/           short architecture decision records
│  └─ tech/                "what is this and why do we use it" notes, one per technology
├─ AGENTS.md      rules every agent reads first
└─ CODEOWNERS
```

### 3.1 Why two apps

The public site and the admin/staff console are separate Next.js apps. Admin code never ships in the
participant-facing bundle, the two deploy independently, and the split draws a clean ownership line between
people building the public experience and people building internal tooling.

### 3.2 Dependency rules (enforced in CI)

| Rule | Reason |
|---|---|
| An app never imports from another app | Keeps web and console independently deployable |
| Only `packages/db` talks to the database | One place to review queries and permissions |
| `packages/core` has no React and no Next.js imports | Business rules stay testable and reusable by both apps |
| `packages/ui` has no data access | Components stay presentational |
| Packages never import from apps | Dependencies flow one way: apps → packages |

These are enforced by lint rules in CI, so a violation fails the pull request rather than relying on reviewers to notice.

## 4. Stack and deployment

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Same as msa-auth and recruitment-portal; server and client in one app |
| Database | Supabase Postgres, accessed through Drizzle ORM | Already used by MSA; Drizzle keeps the schema in TypeScript and migrations reviewable |
| File storage | Supabase Storage, private buckets | Payment proofs and photos; access controlled per team |
| Email | Resend | Already set up for msa-auth; OTPs and confirmations |
| Hosting | Vercel, two projects from this repo (`web`, `console`) | Preview URL on every pull request; free tier fits |

### 4.1 Environments

| Environment | Database | Deployed from |
|---|---|---|
| Local | Dev Supabase project | Developer machine |
| Preview | Dev Supabase project | Every pull request (Vercel preview) |
| Production | Separate production Supabase project | `main` |

Production data is never used for development. Secrets live in Vercel environment variables and local `.env` files,
never in the repository; each app ships a `.env.example` listing the variables it needs.

## 5. Working model

### 5.1 Flow of work

1. A sub-project spec is written and approved.
2. An implementation plan is written from the spec and approved.
3. Issues are created from the plan, one per task, each labelled with `area:`, `priority:`, `size:`, `type:` and a milestone.
4. Ojas assigns issues. Nobody (human or agent) self-assigns or assigns others.
5. The assignee branches from `main` as `<issue-number>-<short-name>`, e.g. `42-registration-otp`.
6. The pull request says `Closes #<issue>`, passes CI, and is reviewed by the code owner of the area it touches.
7. Squash-merge to `main`. The project board moves the card to Done automatically.

### 5.2 Guardrails

- **Branch protection on `main`:** changes only through pull requests; CI must pass; at least one approving review.
- **CI checks:** typecheck, lint (including the dependency rules in 3.2), tests, and build for every affected app and package.
- **CODEOWNERS:** maps each folder to its owner. Until Ojas names owners, every path is owned by Ojas.
- **Scope discipline:** a pull request changes only the area its issue is labelled with. Needed changes elsewhere become a new issue.

### 5.3 Project board

Board: https://github.com/orgs/MSA-SRM/projects/1

| Element | Values |
|---|---|
| Status | Backlog → Ready → In progress → In review → Blocked → Done |
| Area | Web, Console, DB, Core, Email, UI, Infra, Docs |
| Priority / Size | P0-P2 / S, M, L |
| Sprint | Weekly from 2026-09-28; Sprint 5 is event week |
| Milestones | M0 Foundation, M1 Registration opens, M2 Shortlisting (Episode 0), M3 Event day (2026-10-27), M4 Post-event |

Issues and pull requests are added to the board automatically. First-year class tests run 2026-10-06 to 10-14
(Sprints 2 and 3); plans keep the load lighter in those weeks.

## 6. Agent orchestration and teaching mode

Most code is written by associates' AI agents. Every agent must read the root `AGENTS.md`, and the `AGENTS.md` of
the app or package it is working in, before doing anything. Those files carry:

1. **What this area is for and what it must not do** (the rules in 3.2, restated locally).
2. **Scope rule:** work only on the assigned issue; stop and report instead of editing outside its area.
3. **Teaching mode:** before introducing or using a technology, library or pattern, the agent explains to the
   associate what it is, what problem it solves here, why it was chosen over the obvious alternative, and what to
   read next. Where a `docs/tech/<name>.md` note exists, the agent points to it; where one should exist and doesn't,
   the agent proposes it.
4. **Definition of done:** tests written and passing, CI green, `.env.example` updated if new variables were added,
   and a pull request description that explains what changed and why in plain language.

## 7. Open decisions

These are known and deliberately deferred to the sub-project specs; they do not block Foundation work.

| Decision | Decided in |
|---|---|
| Participant sign-in: standalone email OTP in Pandora, or through msa-auth | Registration and Operations spec |
| UI component approach and animation library | Registration and Operations spec |
| Whether registration carries a payment step in production | Registration and Operations spec |
| Team size (3-4), the four tracks, and shortlist count (48 or 62/64) | Registration and Operations spec |
| Episode mechanics, points and hint rules | Event-day spec |

## 8. Foundation milestone (M0) deliverables

1. Monorepo skeleton: both apps and all packages, building and deployable as empty shells.
2. Root and per-area `AGENTS.md`, `CODEOWNERS`, `.env.example` files.
3. CI workflow with the checks in 5.2.
4. Branch protection on `main`.
5. Two Vercel projects connected, with previews on pull requests.
6. `docs/tech/` notes for the core stack: Next.js, pnpm workspaces, Turborepo, Drizzle, Supabase, Resend, Vercel.
