# MSA Pandora: Registration and Operations Design

**Status:** Draft for review, 2026-09-26
**Covers:** sub-projects 1-4 of the orchestration spec (landing + registration, participant sign-in + dashboard,
admin portal, staff check-in). **Parent:** `2026-09-25-pandora-orchestration-design.md`.

This spec is organized by **flow**, because each flow has one owner who builds it end to end (UI, server logic,
queries, emails). Underneath the flows sits a thin **shared platform** that every flow uses and nobody duplicates.

| Flow | Owner | App | Milestone |
|---|---|---|---|
| Shared platform (section 3) | Claude, first | packages | M1 |
| A. Registration (section 4) | Harsh Chaudhary | web | M1 Registration opens |
| B. Participant (section 5) | Sasmita Karthikeyan | web | M2 Shortlisting (Episode 0) |
| C. Admin (section 6) | Ujaan Basu, Ritwik Negi | console | M2 Shortlisting (Episode 0) |
| D. Check-in (section 7) | Alrik Chishi | web + console | M3 Event day |
| Landing page visuals | Frontend team | web | M1 |

---

## 1. Decisions already made

| Topic | Decision |
|---|---|
| Identity | Pandora's own email OTP. No passwords, no msa-auth dependency. |
| UI kit | Astryx (the kit msa-auth uses), with the MSA theme copied from msa-auth into `packages/ui`. Landing-page art and motion are custom CSS on top. |
| Payment | Built, behind `PAYMENT_ENABLED` (default `false`). Off: registration confirms immediately. On: registration waits for an admin to approve the payment proof. |
| Team size | 3 or 4 members. Member 4 is optional. |
| Tracks | Four tracks, one per team. Names live in one config constant; placeholders `Track A`-`Track D` until named. |
| Hosting | Vercel Hobby, deployed from GitHub Actions; Mumbai region; Supabase project `pandora` in Mumbai. |

## 2. Rules (one source of truth in `packages/core`)

Both the browser form and the server validate with the **same** schemas from `@pandora/core`.

| Rule | Value |
|---|---|
| SRM email | Ends with `@srmist.edu.in`, stored lower-cased |
| Registration number | `RA` + 13 digits, e.g. `RA2611026010690`; stored upper-cased |
| Phone (WhatsApp) | 10 digits starting 6-9; an optional `+91` prefix is stripped |
| Names | First and last name, 1-50 characters each, trimmed |
| Team name | 3-40 characters; unique ignoring case and surrounding spaces |
| Uniqueness | A registration number or SRM email can belong to only one member of one team |
| Photo | Optional; JPEG, PNG or WebP; at most 5 MB |
| Payment proof | JPEG or PNG; at most 5 MB |
| OTP | 6 digits; valid 10 minutes; 5 wrong attempts invalidate it; a new code at most every 60 seconds per email |
| Session | 7 days; one random token in an `httpOnly`, `secure`, `sameSite=lax` cookie; only its SHA-256 hash is stored |

## 3. Shared platform

Built first, so every flow owner starts on working primitives instead of inventing their own.

### 3.1 Data model (`packages/db`, Drizzle)

| Table | Key columns | Notes |
|---|---|---|
| `teams` | `id` uuid, `name`, `name_key` (unique, normalized), `track`, `payment_status` (`not_required`/`pending`/`approved`/`declined`), `shortlist_status` (`pending`/`shortlisted`/`not_shortlisted`), timestamps | The team UUID is the team's identity everywhere |
| `members` | `id` uuid, `team_id`, `position` 1-4, `is_leader`, `first_name`, `last_name`, `reg_number` (unique), `srm_email` (unique), `personal_email`, `phone`, `photo_path` | Exactly one leader per team |
| `email_otps` | `id`, `email`, `purpose` (`registration`/`participant_sign_in`/`staff_sign_in`), `code_hash`, `expires_at`, `attempts`, `consumed_at` | Codes never stored in plain text |
| `sessions` | `token_hash` (pk), `subject_type` (`member`/`staff`), `subject_id`, `expires_at` | Shared by participants and staff |
| `staff` | `id`, `email` (unique), `name`, `role` (`admin`/`staff`) | Seeded by Ojas; no self sign-up |
| `payment_proofs` | `id`, `team_id`, `file_path`, `status` (`pending`/`approved`/`declined`), `reviewed_by`, `reviewed_at`, `note` | Newest row is the current proof |
| `edit_requests` | `id`, `team_id`, `requested_by` (member), `changes` (jsonb field-level diff), `status`, `reviewed_by`, `reviewed_at`, `note` | Approved changes are applied in the same transaction |
| `notifications` | `id`, `team_id` (null = every team), `title`, `body`, `created_by`, `created_at` | |
| `notification_reads` | `notification_id`, `member_id`, `read_at` | Per-member unread state |
| `submissions` | `id`, `team_id`, `episode` (0 for now), `repo_url`, `demo_url`, `notes`, `submitted_at`, `updated_at`, `score`, `review_note` | Unique per team per episode; editable until the deadline |
| `checkin_passes` | `id`, `member_id` (unique), `token_hash` (unique), `issued_at`, `revoked_at` | One personal pass per shortlisted member |
| `attendance` | `id`, `member_id`, `event` (`episode_1`), `checked_in_at`, `checked_in_by` | Unique per member per event |
| `admin_actions` | `id`, `staff_id`, `action`, `target_type`, `target_id`, `detail` jsonb, `created_at` | Audit trail for every approve/decline/shortlist/check-in |

Schema files are split one table per file under `packages/db/src/schema/`, and query functions one file per flow
under `packages/db/src/queries/` (`registration.ts`, `participant.ts`, `admin.ts`, `checkin.ts`), so flow owners
rarely edit the same file. A schema change always ships with its generated migration in the same pull request.

File storage (photos, payment proofs) is a Supabase Storage **private** bucket, wrapped by `packages/db/src/storage.ts`
(`putFile`, `signedUrl`). Files are only ever shown through short-lived signed URLs.

### 3.2 Environments and data safety

| Where | Database | Email |
|---|---|---|
| Local development | **Neon** dev database (`DATABASE_URL` in the app's `.env.local`; dev data only, never real participants) | `file` transport: writes to `.mail/outbox.jsonl` |
| Tests (local and CI) | PGlite in memory, fresh per test file | `file` transport |
| Pull request previews | **Neon** (free tier), a separate dev/test database | Resend, sending only to allowlisted addresses |
| Production | Supabase `pandora` | Resend from `pandora@msasrm.in` (until `msasrm.in` verifies: `pandora@recruitments.msasrm.in`) |

The database driver is `pg` (node-postgres) through Drizzle, which works unchanged against Neon and Supabase's
transaction pooler. msa-auth's `postgres.js` driver hung on pipelined queries through that pooler and needed a patch;
`pg` does not pipeline. Query code is written against Drizzle's driver-agnostic `PgDatabase` type, so the same
functions run on PGlite and on `pg`. Migrations are applied by the deploy workflow before each build: to Neon for
previews, to Supabase for production.

Associates never receive production credentials; the only credential they need is the Neon dev database URL. Real participants'
personal data exists only in production.

### 3.3 Shared building blocks

| Block | Lives in | Provides |
|---|---|---|
| Config and rules | `@pandora/core` | `TRACKS`, `TEAM_SIZE`, the section 2 rules, zod schemas for every form |
| OTP logic | `@pandora/core` | code generation, hashing, expiry and attempt rules (pure functions) |
| Edit-request diff | `@pandora/core` | compute and apply a field-level diff between current and proposed team data |
| OTP and session storage | `@pandora/db` | issue/verify OTP rows, create/read/revoke sessions |
| Email | `@pandora/email` | `sendEmail({ to, template, data })` with `resend` and `file` transports; one template file per email |
| Session glue | each app's `src/lib/session.ts` | read/write the session cookie, `requireMember()`, `requireStaff(role)` |

Server work uses **Next.js Server Actions** for forms. Uploads go through a server action (body limit raised to 6 MB).

## 4. Flow A: Registration (Harsh)

On the landing page, same page as everything else. The navbar's **Register** button scrolls to it.

| Step | Collects | Rules |
|---|---|---|
| 1. Team | Team name, track | Name available (checked live), track from `TRACKS` |
| 2. Leader | Leader's details (section 2 fields) | **OTP sent to the leader's SRM email and verified here** before continuing |
| 3. Member 2 | Member details | |
| 4. Member 3 | Member details | |
| 5. Member 4 (optional) | Member details, or skip | |
| 6. Review | Everything, with edit links back to each step | All uniqueness checks re-run on submit |
| 7. Payment (only when `PAYMENT_ENABLED`) | Shows the payment QR; upload of the payment screenshot | |

- Progress survives a page refresh (form state kept in the browser until submit). Nothing is written to the
  database before the final submit, except the OTP.
- Submit is one database transaction: team, members, payment proof (if any). If any uniqueness rule fails, nothing
  is saved and the form shows which field clashed.
- Payment **off**: status `not_required`; every member gets **"You're registered"** (team, track, members, what
  happens next).
- Payment **on**: status `pending`; every member gets **"Registration received, payment under review"**. The admin
  decision (section 6) sends **"Registration confirmed"** or **"Payment declined"** (with the QR again and how to
  resend proof by replying to the email).
- Rate limits: OTP per section 2; registration submit at most 5 per IP per 10 minutes.

**Done when:** a team of 3 and a team of 4 can register end to end on a preview deployment; duplicate team name,
registration number and SRM email are rejected with a clear message; the emails arrive (outbox locally, Resend on
preview).

## 5. Flow B: Participant (Sasmita)

- **Sign in** (navbar): enter SRM email → if it belongs to a registered member, an OTP is sent → verify → 7-day
  session. Unknown emails see the same "check your inbox" screen (no account enumeration). Sign out anytime.
- After sign-in the member lands directly on **their team's dashboard** (team resolved from the email; no invites).
- **Dashboard** (single page, mobile first):
  - Welcome, team name, track, members.
  - Journey: Registration ✓ → Shortlisting (pending/shortlisted/not shortlisted) → Episode 1-3 (locked until the event).
  - Payment status when payments are on.
  - **Notifications**: team-specific and all-team notices, unread badge, mark as read.
  - **Edit details**: any member can propose changes to team or member fields; the change is saved as an edit
    request (diff) and shown as "pending review" until an admin decides. Nothing changes until approval.
  - **Episode 0 submission**: repository URL, demo URL, notes; editable until the Episode 0 deadline
    (`EPISODE_0_DEADLINE` config).
    **Only verified teams can submit.** A team is verified when an admin approved its payment (`payment_status`
    `approved`), or when the event has no payment (`not_required`). Until then the dashboard explains that the
    registration is being verified (`pending`) or that the payment needs another look (`declined`), and the server
    refuses the submission. Verification happens before shortlisting, so shortlisting needs no separate payment check.
  - **Check-in pass** (from flow D) appears once the team is shortlisted.

**Done when:** every member of a registered team can sign in and see the same dashboard; an edit request and an
Episode 0 submission can be made and are visible to admins.

## 6. Flow C: Admin (Ujaan, Ritwik)

`apps/console`, signed in with the same OTP mechanism against the `staff` table (role `admin`). Every page requires
an admin session; every decision writes to `admin_actions`.

| Screen | Does |
|---|---|
| Overview | Counts: teams, members, by track, payment pending, edit requests pending, submissions |
| Teams | Search/filter by name, track, status; team detail with members, photos (signed URLs), history |
| Payments | Queue of pending proofs with the image; approve or decline with a note; triggers the emails |
| Edit requests | Queue with a before/after diff; approve (applies it) or decline with a note; notifies the team |
| Notifications | Compose a notice to one team or every team |
| Episode 0 | Submissions list, score and review note, mark teams `shortlisted` / `not_shortlisted`, shortlist count vs target |
| Export | CSV of teams and members |

**Done when:** an admin can take a registration from payment review through shortlisting without touching the
database directly.

## 7. Flow D: Check-in (Alrik)

- When a team becomes `shortlisted`, every member gets a **personal check-in pass**: a random 128-bit token (only its
  hash stored), shown as a QR code on the participant dashboard and sent by email.
- **Staff portal** (`apps/console`, role `staff` or `admin`), phone-first: camera QR scanner → shows the member's
  photo, name, team and track → **Mark present** (records who and when). A manual search by name/registration
  number is the fallback when a phone can't scan.
- Scanning a pass twice shows "already checked in at 09:12 by …" rather than a second record. Revoked or unknown
  passes show a clear error.
- Live attendance view: present / expected, per team.

**Done when:** a staff member on a phone can check in a shortlisted member by QR and by manual search, and duplicate
scans are handled.

## 8. Ownership and sequencing

1. **Shared platform** (section 3) first, as one pull request: schema + migrations, PGlite test setup, OTP and
   session modules, email package with the `file` transport, core rules and schemas, Astryx theme in `packages/ui`.
2. Then the four flows proceed **in parallel**, each owner in their own files:
   - Flow A needs only the platform.
   - Flow B needs the platform; its dashboard reads data flow A writes.
   - Flow C needs the platform; its queues read data flows A and B write.
   - Flow D needs the platform and flow C's shortlisting (can be built and tested against seeded data before that lands).
3. Frontend team: design and inspiration now; landing page sections, then styling of the flows' screens, using
   `@pandora/ui`.
4. Each flow is broken into issues of half a day or less, labelled with area, priority, size and milestone, unassigned
   until Ojas assigns them.

## 9. Open items

| # | Item | Default if not decided |
|---|---|---|
| 1 | Preview database | **Decided 2026-09-26: Neon (free tier)** |
| 2 | Track names | `Track A`-`Track D` |
| 3 | Episode 0 task content and deadline | Generic submission (repo URL, demo URL, notes); deadline set in config later |
| 4 | Payment QR image and amount | Not needed while `PAYMENT_ENABLED` is `false` |
| 5 | Staff and admin list | Ojas provides emails; seeded into `staff` |
