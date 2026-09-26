# Flow C: Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` (root) and the `AGENTS.md` of every folder you touch first. Teaching mode applies.

**Owners:** Ujaan Basu (C1, C3) and Ritwik Negi (C2, C4-C8) — a suggested split; Ojas assigns. **Milestone:** M2 Shortlisting (Episode 0).

**Goal:** Admins sign in to the console with a one-time code and take a registration from payment review through shortlisting, without touching the database directly. Every decision is recorded.

**Architecture:** Schemas in `packages/core/src/flows/admin.ts`; read-only queries (overview, team list and detail, export) in `packages/db/src/queries/admin.ts` (Ujaan); decision queries (payments, edit requests, notices, Episode 0, shortlist, audit) in `packages/db/src/queries/admin-review.ts` (Ritwik); emails in `packages/email/src/templates/admin/`; pages and Server Actions in `apps/console/src/app/**` and `apps/console/src/features/admin/**`.

**Tech Stack:** Next.js 16, zod 4, Drizzle, Astryx (its `AppShell`/`SideNav` suit the console layout).

**Spec:** `docs/superpowers/specs/2026-09-26-registration-and-operations-design.md` sections 2, 3 and 6.

## How this plan is written
Logic tasks give exact signatures and tests (tests first). Screen tasks give behaviour and a checklist. Your files are already wired into the package exports; never edit other flows' files, `registry.ts` or package `index.ts` files.

## Global Constraints
- Ujaan edits: `packages/db/src/queries/admin.ts` (+ test), `apps/console/src/app/sign-in/**`, `apps/console/src/app/layout.tsx` body/nav, `apps/console/src/app/page.tsx`, `apps/console/src/app/teams/**`, `apps/console/src/app/export/**`, `apps/console/src/features/admin/{sign-in,shell,teams}/**`.
- Ritwik edits: `packages/core/src/flows/admin.ts` (+ test), `packages/db/src/queries/admin-review.ts` (+ test), `packages/email/src/templates/admin/**`, `apps/console/src/app/{payments,edits,notices,episode-0}/**`, `apps/console/src/features/admin/{review,notices,episode-0}/**`.
- Every console page and action begins with `const admin = await requireStaff("admin");` except the sign-in page and `/` (which routes: admins see the overview, staff are redirected to `/staff`, Flow D's area). Never add a public page.
- `/` must never itself call `requireStaff("admin")`: `requireStaff("admin")` redirects non-admins to `/`, so `/` would loop. Use `requireStaff()` there and branch on `role`.
- Every decision (payment, edit request, notice, score, shortlist) writes an `admin_actions` row via `recordAdminAction`, in the same transaction as the change.
- Staff never self-register: rows come from the seed (`SEED_STAFF`), managed by Ojas.
- Files are shown only through `getStorage().signedUrl(path)` (5-minute links).
- No AI attribution in commits or PRs. Branch `<issue>-<short-name>`, PR body starts with `Closes #<issue>`.

---

### Task C1 (Ujaan): Console sign-in and shell

**Files:** `apps/console/src/features/admin/sign-in/actions.ts` (`"use server"`), `apps/console/src/app/sign-in/page.tsx`, `apps/console/src/features/admin/shell/*`, `apps/console/src/app/page.tsx`.

**Interfaces — produces:**
```ts
export async function requestStaffCode(email: string): Promise<{ ok: true } | { ok: false; message: string }>;
export async function verifyStaffSignIn(email: string, code: string): Promise<{ ok: false; message: string }>; // success → redirect("/")
export async function staffSignOut(): Promise<never>;
```
Same behaviour as participant sign-in (Flow B, Task B3) with `purpose: "staff_sign_in"`, `findStaffByEmail` and `startStaffSession`; unknown emails get the same neutral response and no email.

- [ ] Checklist: sign in as a seeded admin and as a seeded staff user; admin lands on the overview, staff on `/staff`; sign-out revokes the session; the sign-in page is the only page reachable signed-out; the shell's navigation lists Overview, Teams, Payments, Edit requests, Notices, Episode 0, Export (admins only).
- [ ] `pnpm --filter @pandora/console typecheck && lint && build` → PASS; commit `Add console sign-in and admin shell`.

---

### Task C2 (Ritwik): Admin schemas and CSV escaping

**Files:** `packages/core/src/flows/admin.ts`, test `packages/core/src/flows/admin.test.ts`.

**Interfaces — produces:** `notificationSchema` (`{ title: 3-120 chars, body: 1-2000 chars }`, trimmed), `reviewSchema` (`{ score: integer 0-100 (coerced from string), reviewNote: ≤ 1000 chars, trimmed }`), `decisionNoteSchema` (`string`, trimmed, ≤ 500), `csvCell(value: string | number | boolean | null): string`.

- [ ] **Step 1: Tests**
```ts
import { describe, expect, it } from "vitest";
import { csvCell, decisionNoteSchema, notificationSchema, reviewSchema } from "./admin";

describe("admin schemas", () => {
  it("validates notices", () => {
    expect(notificationSchema.parse({ title: "  Episode 0 is live ", body: "Go" })).toEqual({ title: "Episode 0 is live", body: "Go" });
    expect(notificationSchema.safeParse({ title: "Hi", body: "" }).error?.issues.map((i) => i.path[0])).toEqual(["title", "body"]);
  });
  it("coerces and bounds scores", () => {
    expect(reviewSchema.parse({ score: "87", reviewNote: " solid " })).toEqual({ score: 87, reviewNote: "solid" });
    expect(reviewSchema.safeParse({ score: "101", reviewNote: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ score: "7.5", reviewNote: "" }).success).toBe(false);
  });
  it("limits decision notes", () => {
    expect(decisionNoteSchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+91")).toBe("'+91");
    expect(csvCell("-x")).toBe("'-x");
    expect(csvCell("@x")).toBe("'@x");
  });
});
```
- [ ] FAIL → implement → PASS (`pnpm --filter @pandora/core test && typecheck && lint`); commit `Add admin schemas and CSV escaping`.

---

### Task C3 (Ujaan): Overview, teams and export

**Files:** `packages/db/src/queries/admin.ts` (+ `admin.test.ts`); pages `apps/console/src/app/page.tsx` (overview for admins), `apps/console/src/app/teams/page.tsx`, `apps/console/src/app/teams/[teamId]/page.tsx`, `apps/console/src/app/export/route.ts` (CSV download, admin-only).

**Interfaces — produces:**
```ts
export function getOverview(db: Db): Promise<{ teams: number; members: number; byTrack: Record<string, number>; paymentPending: number; editRequestsPending: number; submissions: number; shortlisted: number }>;
export function listTeams(db: Db, filter?: { search?: string; track?: string; shortlistStatus?: "pending" | "shortlisted" | "not_shortlisted"; limit?: number; offset?: number }):
  Promise<Array<{ id: string; name: string; track: string; paymentStatus: string; shortlistStatus: string; memberCount: number; leaderName: string; createdAt: Date }>>; // newest first; search matches team name, member names, registration numbers, SRM emails (case-insensitive)
export function getTeamDetail(db: Db, teamId: string): Promise<{
  team: typeof teams.$inferSelect; members: Array<typeof members.$inferSelect>;
  paymentProofs: Array<typeof paymentProofs.$inferSelect>; editRequests: Array<typeof editRequests.$inferSelect>;
  submission: typeof submissions.$inferSelect | null;
} | null>;
export function exportTeamsCsv(db: Db): Promise<string>; // header + one row per member, via csvCell
```
CSV header (exact): `team_name,track,payment_status,shortlist_status,position,is_leader,first_name,last_name,reg_number,srm_email,personal_email,phone`; rows ordered by team name then position; `\n` line endings.

- [ ] **Step 1: Tests** (seed with direct inserts, as in Flow B's test)
```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { members, submissions, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { exportTeamsCsv, getOverview, getTeamDetail, listTeams } from "./admin";

let db: Db;
async function seedTeam(name: string, track: string, n: number, size = 3) {
  const [t] = await db.insert(teams).values({ name, nameKey: name.toLowerCase(), track }).returning();
  await db.insert(members).values(Array.from({ length: size }, (_, i) => ({ teamId: t!.id, position: i + 1, isLeader: i === 0, firstName: `F${n}${i + 1}`, lastName: "L", regNumber: `RA26110260106${n}${i + 1}`, srmEmail: `t${n}m${i + 1}@srmist.edu.in`, personalEmail: `t${n}m${i + 1}@gmail.com`, phone: `98765432${n}${i + 1}` })));
  return t!;
}
beforeEach(async () => {
  db = await createTestDb();
});

describe("admin read queries", () => {
  it("counts teams, members and tracks", async () => {
    const a = await seedTeam("Alpha", "Track A", 1);
    await seedTeam("Beta", "Track B", 2, 4);
    await db.insert(submissions).values({ teamId: a.id, repoUrl: "https://github.com/a/b" });
    expect(await getOverview(db)).toEqual({ teams: 2, members: 7, byTrack: { "Track A": 1, "Track B": 1 }, paymentPending: 0, editRequestsPending: 0, submissions: 1, shortlisted: 0 });
  });
  it("searches by team, member name, registration number and email", async () => {
    await seedTeam("Alpha", "Track A", 1);
    await seedTeam("Beta", "Track B", 2);
    expect((await listTeams(db, { search: "alp" })).map((t) => t.name)).toEqual(["Alpha"]);
    expect((await listTeams(db, { search: "F22" })).map((t) => t.name)).toEqual(["Beta"]);
    expect((await listTeams(db, { search: "RA2611026010613" })).map((t) => t.name)).toEqual(["Alpha"]);
    expect((await listTeams(db, { search: "T2M3@SRMIST" })).map((t) => t.name)).toEqual(["Beta"]);
    expect((await listTeams(db, { track: "Track B" }))[0]).toMatchObject({ name: "Beta", memberCount: 3, leaderName: "F21 L" });
  });
  it("returns a team's full detail", async () => {
    const a = await seedTeam("Alpha", "Track A", 1);
    const d = await getTeamDetail(db, a.id);
    expect(d?.members.map((m) => m.position)).toEqual([1, 2, 3]);
    expect(d?.submission).toBeNull();
  });
  it("exports one CSV row per member", async () => {
    await seedTeam("Beta", "Track B", 2);
    await seedTeam("Alpha", "Track A", 1);
    const lines = (await exportTeamsCsv(db)).trim().split("\n");
    expect(lines[0]).toBe("team_name,track,payment_status,shortlist_status,position,is_leader,first_name,last_name,reg_number,srm_email,personal_email,phone");
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe("Alpha,Track A,not_required,pending,1,true,F11,L,RA2611026010611,t1m1@srmist.edu.in,t1m1@gmail.com,9876543211");
  });
});
```
- [ ] FAIL → implement → PASS (`pnpm --filter @pandora/db test && typecheck && lint`).
- [ ] Pages checklist: overview cards from `getOverview`; teams table with search box and track/shortlist filters, paged 50 at a time; team detail with members, photos (signed URLs), payment proofs, edit history, submission; `/export` returns `text/csv` with `Content-Disposition: attachment; filename="pandora-teams.csv"` and records nothing (read-only).
- [ ] console typecheck + lint + build → PASS; commit `Add admin overview, team list, team detail and CSV export`.

---

### Task C4 (Ritwik): Payment review

**Files:** `packages/db/src/queries/admin-review.ts` (+ `admin-review.test.ts`), `packages/email/src/templates/admin/{payment-approved,payment-declined}.tsx` (+ tests, registered in `templates/admin/index.ts` as `"admin-payment-approved"` / `"admin-payment-declined"`), `apps/console/src/app/payments/page.tsx`, `apps/console/src/features/admin/review/payment-actions.ts`.

**Interfaces — produces:**
```ts
export function recordAdminAction(db: Db, input: { staffId: string; action: string; targetType: string; targetId: string; detail?: Record<string, unknown> }): Promise<void>;
export function listPendingPayments(db: Db): Promise<Array<{ proofId: string; teamId: string; teamName: string; filePath: string; createdAt: Date }>>; // oldest first
export function decidePayment(db: Db, input: { proofId: string; staffId: string; decision: "approved" | "declined"; note?: string; now?: Date }):
  Promise<{ ok: true; teamName: string; memberEmails: string[] } | { ok: false; reason: "not_found" | "already_decided" }>;
```
Behaviour: one transaction; the proof update is conditional (`WHERE id = ? AND status = 'pending'`), so two admins clicking at once can't both decide; sets `teams.payment_status` to the decision; records `payment.approved` / `payment.declined` with the note. Emails: approved → "Registration confirmed" (`{ teamName }`); declined → `{ teamName, note }` with the payment QR instructions and "reply to this email with the new screenshot".

- [ ] **Tests** (add to `admin-review.test.ts`; seed a team with a pending proof and a staff row):
```ts
it("approves a pending payment once, updates the team and records it", async () => {
  const r = await decidePayment(db, { proofId, staffId, decision: "approved" });
  expect(r).toEqual({ ok: true, teamName: "Alpha", memberEmails: ["t1m1@srmist.edu.in", "t1m2@srmist.edu.in", "t1m3@srmist.edu.in"] });
  expect((await db.select().from(teams))[0]?.paymentStatus).toBe("approved");
  expect((await db.select().from(adminActions)).map((a) => [a.action, a.targetId])).toEqual([["payment.approved", proofId]]);
  expect(await decidePayment(db, { proofId, staffId, decision: "declined" })).toEqual({ ok: false, reason: "already_decided" });
});
it("declines with a note", async () => {
  await decidePayment(db, { proofId, staffId, decision: "declined", note: "Blurry screenshot" });
  expect((await db.select().from(paymentProofs))[0]).toMatchObject({ status: "declined", note: "Blurry screenshot", reviewedBy: staffId });
  expect((await db.select().from(teams))[0]?.paymentStatus).toBe("declined");
});
it("lets only one of two concurrent decisions win", async () => {
  const results = await Promise.all([decidePayment(db, { proofId, staffId, decision: "approved" }), decidePayment(db, { proofId, staffId, decision: "declined" })]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
});
it("reports an unknown proof", async () => {
  expect(await decidePayment(db, { proofId: "00000000-0000-4000-8000-00000000dead", staffId, decision: "approved" })).toEqual({ ok: false, reason: "not_found" });
});
```
Email tests: subjects `"Alpha: registration confirmed"` and `"Alpha: payment needs another look"`; the declined text contains the note.
- [ ] Page checklist: queue oldest first with the proof image (signed URL), approve / decline (note required for decline, `decisionNoteSchema`), the row disappears after deciding, emails sent to every member (a failed send shows a warning but keeps the decision). Only visible when `PAYMENT_ENABLED` is `"true"`; otherwise the page says payments are off.
- [ ] db/email/console checks → PASS; commit `Add payment review`.

---

### Task C5 (Ritwik): Edit request review

**Files:** add to `admin-review.ts` (+ tests), `packages/email/src/templates/admin/edit-decided.tsx` (`"admin-edit-decided"`, props `{ teamName; approved: boolean; note: string | null }`), `apps/console/src/app/edits/page.tsx`, `apps/console/src/features/admin/review/edit-actions.ts`.

**Interfaces — produces:**
```ts
export function listPendingEditRequests(db: Db): Promise<Array<{ requestId: string; teamId: string; teamName: string; requestedByName: string; changes: FieldChange[]; createdAt: Date }>>;
export function decideEditRequest(db: Db, input: { requestId: string; staffId: string; decision: "approved" | "declined"; note?: string; now?: Date }):
  Promise<
    | { ok: true; teamName: string; memberEmails: string[] }
    | { ok: false; reason: "not_found" | "already_decided" }
    | { ok: false; reason: "invalid"; message: string }
    | { ok: false; reason: "taken"; field: UniqueField }
  >;
```
Behaviour (one transaction): conditional status update as in C4; on approve, `applyChanges(getTeamSnapshot(...), changes)` (Flow B's `getTeamSnapshot` from `@pandora/db`), validate with `teamEditSchema` (Flow B, `@pandora/core`; invalid → `invalid` with the first issue's message), write `teams.name`, `name_key` (`teamNameKey`), `track` and every changed member field; a unique violation rolls back and returns `taken`. Both decisions insert a notification to the team ("Your change request was approved" / "…was declined", body = note or a default sentence) and record `edit.approved` / `edit.declined`.
**Depends on:** Flow B Tasks B1 and B2 being merged.

- [ ] **Tests** — cover: approve applies a phone change and the team sees one new notification; approve of a team rename updates `name_key`; approve that would duplicate another team's name returns `{ ok: false, reason: "taken", field: "teamName" }` and changes nothing (request stays `pending`); approve of a change that makes a phone invalid returns `invalid`; decline leaves data untouched and records the note; a second decision returns `already_decided`.
- [ ] Page checklist: queue with a before → after table per change, approve / decline with note, the team's emails go out.
- [ ] checks → PASS; commit `Add edit request review`.

---

### Task C6 (Ritwik): Notices

**Files:** add `createNotification(db, { staffId, teamId: string | null, title, body }): Promise<{ id: string }>` (records `notification.created`) to `admin-review.ts` (+ test: an all-team notice and a single-team notice both stored with the audit row); `apps/console/src/app/notices/page.tsx` + action.
- [ ] Page checklist: compose (title, body, "all teams" or a searchable team picker), `notificationSchema` validation, list of sent notices newest first.
- [ ] checks → PASS; commit `Add notices`.

---

### Task C7 (Ritwik): Episode 0 review and shortlisting

**Files:** add to `admin-review.ts` (+ tests): 
```ts
export function listSubmissions(db: Db): Promise<Array<{ submissionId: string; teamId: string; teamName: string; track: string; repoUrl: string | null; demoUrl: string | null; notes: string | null; score: number | null; reviewNote: string | null; shortlistStatus: string; updatedAt: Date }>>; // episode 0, highest score first, unscored last
export function reviewSubmission(db: Db, input: { submissionId: string; staffId: string; score: number; reviewNote: string }): Promise<{ ok: boolean }>; // records submission.reviewed
export function setShortlistStatus(db: Db, input: { teamId: string; staffId: string; status: "pending" | "shortlisted" | "not_shortlisted" }): Promise<{ ok: true } | { ok: false; reason: "not_found" }>; // records team.shortlist
```
Pages: `apps/console/src/app/episode-0/page.tsx` — table sorted by score, score + note form (`reviewSchema`), shortlist / not-shortlist buttons, a counter "shortlisted N of target" (target from `SHORTLIST_TARGET` env, default 48).
- [ ] Tests: ordering (scored desc, unscored last), review stored and audited, shortlist status change audited, unknown team → `not_found`.
- [ ] checks → PASS; commit `Add Episode 0 review and shortlisting`.

---

### Task C8 (Ritwik): Issue event passes on shortlisting

**Depends on:** Flow D Task D2 merged (`issuePassesForTeam`).
- [ ] In the shortlist action, after `setShortlistStatus(..., "shortlisted")` succeeds, call `issuePassesForTeam(getDb(), { teamId, secret: process.env.PASS_SECRET! })` and send Flow D's `"checkin-pass-ready"` email to each member. Show a warning (not an error) if `PASS_SECRET` isn't configured.
- [ ] console checks → PASS; commit `Issue event passes when a team is shortlisted`.

## Done when
Spec section 6: an admin can take a registration from payment review through shortlisting without touching the database directly.
