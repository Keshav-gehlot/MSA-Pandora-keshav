# Flow B: Participant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` (root) and the `AGENTS.md` of every folder you touch first. Teaching mode applies.

**Owner:** Sasmita Karthikeyan. **Milestone:** M2 Shortlisting (Episode 0).

**Goal:** Any member of a registered team signs in with their SRM email and a one-time code, lands on their team's dashboard, sees notices, proposes corrections to team details (reviewed by admins), and submits Episode 0.

**Architecture:** Schemas in `packages/core/src/flows/participant.ts`; queries in `packages/db/src/queries/participant.ts`; sign-in and dashboard Server Actions and pages in `apps/web/src/features/participant/` and `apps/web/src/app/(participant)/`. This flow owns `apps/web/src/lib/session.ts`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), zod 4, Drizzle, Astryx.

**Spec:** `docs/superpowers/specs/2026-09-26-registration-and-operations-design.md` sections 2, 3 and 5.

## How this plan is written
Logic tasks give exact signatures and the exact tests (write tests first, see them fail, implement). Screen tasks give behaviour and a checklist. Your files are already wired into the package exports; never edit another flow's files, `registry.ts`, or package `index.ts` files.

## Global Constraints
- Only edit: `packages/core/src/flows/participant.ts` (+ test), `packages/db/src/queries/participant.ts` (+ test), `packages/email/src/templates/participant/**`, `apps/web/src/features/participant/**`, `apps/web/src/app/(participant)/**`, `apps/web/src/app/sign-in/**`, `apps/web/src/lib/session.ts`.
- Sign-in never reveals whether an email is registered: known and unknown emails get the same "check your inbox" response; codes are only sent to registered members (`purpose: "participant_sign_in"`).
- Every signed-in page and action starts with `const { member, team } = await requireMember();` and only ever reads or writes `team.id`'s data. Never take a team id from the browser.
- Edit requests are field-level (`diffTeam`); one pending request per team at a time; nothing changes until an admin approves (flow C).
- Episode 0 closes at `EPISODE_0_DEADLINE` (ISO timestamp env var, e.g. `2026-10-15T23:59:00+05:30`); unset means open.
- The event pass card is Flow D's component: mount `<CheckinPassCard memberId={member.id} />` from `@/features/checkin/pass-card` in the dashboard; don't build it.
- No AI attribution in commits or PRs. Branch `<issue>-<short-name>`, PR body starts with `Closes #<issue>`.

---

### Task B1: Participant schemas and the Episode 0 window

**Files:** Modify `packages/core/src/flows/participant.ts`; Test `packages/core/src/flows/participant.test.ts`.

**Interfaces — produces:**
```ts
export const teamEditSchema: z.ZodType; // { teamName, track, members: Array<{ id: uuid } & Member> } — 3 to 4 members; output type = TeamSnapshot
export const submissionSchema: z.ZodType; // { repoUrl: https URL (required), demoUrl: https URL or "" → null, notes: trimmed, ≤ 2000 chars }
export type SubmissionInput = z.input<typeof submissionSchema>;
export type Submission = z.output<typeof submissionSchema>;
export function isEpisodeZeroOpen(now: Date, deadline: string | undefined): boolean;
```

- [ ] **Step 1: Tests**
```ts
import { describe, expect, it } from "vitest";
import { isEpisodeZeroOpen, submissionSchema, teamEditSchema } from "./participant";

const m = (id: string, n: number) => ({ id, firstName: `M${n}`, lastName: "T", regNumber: `RA261102601069${n}`, srmEmail: `m${n}@srmist.edu.in`, personalEmail: `m${n}@gmail.com`, phone: `987654321${n}` });
const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"];

describe("teamEditSchema", () => {
  it("accepts a full snapshot and normalizes it", () => {
    const r = teamEditSchema.parse({ teamName: " Null Pointers ", track: "Track A", members: ids.map((id, i) => ({ ...m(id, i + 1), srmEmail: `M${i + 1}@SRMIST.EDU.IN` })) });
    expect(r.teamName).toBe("Null Pointers");
    expect(r.members[0]).toMatchObject({ id: ids[0], srmEmail: "m1@srmist.edu.in" });
  });
  it("rejects a member without an id and a bad phone", () => {
    const r = teamEditSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [{ ...m(ids[0]!, 1), id: "nope" }, { ...m(ids[1]!, 2), phone: "123" }, m(ids[2]!, 3)] });
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["members.0.id", "members.1.phone"]);
  });
});

describe("submissionSchema", () => {
  it("accepts a repo link, turns an empty demo link into null, trims notes", () => {
    expect(submissionSchema.parse({ repoUrl: "https://github.com/a/b", demoUrl: "", notes: "  hi " })).toEqual({ repoUrl: "https://github.com/a/b", demoUrl: null, notes: "hi" });
  });
  it("requires https links and limits notes", () => {
    const r = submissionSchema.safeParse({ repoUrl: "github.com/a/b", demoUrl: "http://x.dev", notes: "x".repeat(2001) });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["repoUrl", "demoUrl", "notes"]);
  });
});

describe("isEpisodeZeroOpen", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("is open with no deadline or before it, closed after it", () => {
    expect(isEpisodeZeroOpen(now, undefined)).toBe(true);
    expect(isEpisodeZeroOpen(now, "")).toBe(true);
    expect(isEpisodeZeroOpen(now, "2026-10-15T23:59:00+05:30")).toBe(true);
    expect(isEpisodeZeroOpen(now, "2026-10-01T00:00:00Z")).toBe(false);
  });
});
```
- [ ] **Step 2:** `pnpm --filter @pandora/core test` → FAIL. **Step 3:** Implement (build `teamEditSchema` from `teamNameSchema`, `trackSchema`, `memberSchema.extend({ id: z.uuid() })`, `TEAM_SIZE`). **Step 4:** test + typecheck + lint → PASS. **Step 5:** Commit `Add participant schemas and the Episode 0 window`.

---

### Task B2: Dashboard, notices, edit requests and submissions

**Files:** Modify `packages/db/src/queries/participant.ts`; Test `packages/db/src/queries/participant.test.ts`.

**Interfaces — produces:**
```ts
export function getTeamSnapshot(db: Db, teamId: string): Promise<TeamSnapshot | null>;
export type Dashboard = {
  team: { id: string; name: string; track: string; paymentStatus: string; shortlistStatus: string };
  members: Array<{ id: string; position: number; isLeader: boolean; firstName: string; lastName: string; srmEmail: string }>;
  notifications: Array<{ id: string; title: string; body: string; createdAt: Date; read: boolean }>; // newest first
  unreadCount: number;
  submission: { repoUrl: string | null; demoUrl: string | null; notes: string | null; updatedAt: Date } | null; // episode 0
  pendingEdit: { id: string; changes: FieldChange[]; createdAt: Date } | null;
};
export function getDashboard(db: Db, input: { teamId: string; memberId: string }): Promise<Dashboard>;
export function markNotificationRead(db: Db, input: { notificationId: string; memberId: string; teamId: string }): Promise<void>;
export function proposeEdit(db: Db, input: { teamId: string; memberId: string; proposed: TeamSnapshot }):
  Promise<{ ok: true; changes: FieldChange[] } | { ok: false; reason: "no_changes" | "pending_exists" }>;
export function saveSubmission(db: Db, input: { teamId: string; submission: Submission; now?: Date; deadline?: string }):
  Promise<{ ok: true } | { ok: false; reason: "closed" | "not_verified" }>; // not_verified: payment_status is pending or declined (only approved / not_required teams may submit)
```
Rules: notifications visible to a team = `team_id = teamId OR team_id IS NULL`; `markNotificationRead` ignores notifications the team can't see and is idempotent; `proposeEdit` computes `diffTeam(current, proposed)` and stores it; `saveSubmission` upserts the team's episode-0 row (unique `(team_id, episode)`).

- [ ] **Step 1: Tests**
```ts
import type { TeamSnapshot } from "@pandora/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { editRequests, members, notifications, staff, submissions, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { getDashboard, getTeamSnapshot, markNotificationRead, proposeEdit, saveSubmission } from "./participant";

let db: Db;
let teamId: string, otherTeamId: string, memberId: string, staffId: string;

async function seedTeam(name: string, n: number) {
  const [t] = await db.insert(teams).values({ name, nameKey: name.toLowerCase(), track: "Track A" }).returning();
  const rows = await db.insert(members).values([1, 2, 3].map((p) => ({ teamId: t!.id, position: p, isLeader: p === 1, firstName: `M${p}`, lastName: "T", regNumber: `RA26110260106${n}${p}`, srmEmail: `t${n}m${p}@srmist.edu.in`, personalEmail: `t${n}m${p}@gmail.com`, phone: `98765432${n}${p}` }))).returning();
  return { teamId: t!.id, memberIds: rows.sort((a, b) => a.position - b.position).map((r) => r.id) };
}

beforeEach(async () => {
  db = await createTestDb();
  const a = await seedTeam("Null Pointers", 1);
  const b = await seedTeam("Segfaults", 2);
  teamId = a.teamId; memberId = a.memberIds[0]!; otherTeamId = b.teamId;
  const [s] = await db.insert(staff).values({ email: "admin@srmist.edu.in", name: "Admin", role: "admin" }).returning();
  staffId = s!.id;
});

describe("getTeamSnapshot", () => {
  it("returns the team and its members in position order", async () => {
    const snap = await getTeamSnapshot(db, teamId);
    expect(snap?.teamName).toBe("Null Pointers");
    expect(snap?.members.map((m) => m.srmEmail)).toEqual(["t1m1@srmist.edu.in", "t1m2@srmist.edu.in", "t1m3@srmist.edu.in"]);
    expect(await getTeamSnapshot(db, "00000000-0000-4000-8000-00000000dead")).toBeNull();
  });
});

describe("notifications", () => {
  it("shows the team its own and all-team notices, newest first, with read state", async () => {
    await db.insert(notifications).values([
      { teamId: null, title: "Welcome", body: "Hi all", createdBy: staffId, createdAt: new Date("2026-10-01T10:00:00Z") },
      { teamId, title: "Yours", body: "Just you", createdBy: staffId, createdAt: new Date("2026-10-02T10:00:00Z") },
      { teamId: otherTeamId, title: "Theirs", body: "Not you", createdBy: staffId, createdAt: new Date("2026-10-03T10:00:00Z") },
    ]);
    let d = await getDashboard(db, { teamId, memberId });
    expect(d.notifications.map((n) => [n.title, n.read])).toEqual([["Yours", false], ["Welcome", false]]);
    expect(d.unreadCount).toBe(2);
    await markNotificationRead(db, { notificationId: d.notifications[0]!.id, memberId, teamId });
    await markNotificationRead(db, { notificationId: d.notifications[0]!.id, memberId, teamId });
    d = await getDashboard(db, { teamId, memberId });
    expect(d.unreadCount).toBe(1);
  });
  it("ignores marking a notice the team can't see", async () => {
    const [theirs] = await db.insert(notifications).values({ teamId: otherTeamId, title: "Theirs", body: "x", createdBy: staffId }).returning();
    await markNotificationRead(db, { notificationId: theirs!.id, memberId, teamId });
    expect(await db.select().from(notifications)).toHaveLength(1);
  });
});

describe("proposeEdit", () => {
  it("stores the changed fields as one pending request", async () => {
    const current = (await getTeamSnapshot(db, teamId))!;
    const proposed: TeamSnapshot = structuredClone(current);
    proposed.members[1]!.phone = "9000000000";
    const r = await proposeEdit(db, { teamId, memberId, proposed });
    expect(r).toEqual({ ok: true, changes: [{ path: `members.${current.members[1]!.id}.phone`, from: current.members[1]!.phone, to: "9000000000" }] });
    expect((await getDashboard(db, { teamId, memberId })).pendingEdit?.changes).toHaveLength(1);
  });
  it("refuses an empty change and a second pending request", async () => {
    const current = (await getTeamSnapshot(db, teamId))!;
    expect(await proposeEdit(db, { teamId, memberId, proposed: current })).toEqual({ ok: false, reason: "no_changes" });
    await proposeEdit(db, { teamId, memberId, proposed: { ...current, teamName: "Renamed" } });
    expect(await proposeEdit(db, { teamId, memberId, proposed: { ...current, track: "Track C" } })).toEqual({ ok: false, reason: "pending_exists" });
    expect(await db.select().from(editRequests)).toHaveLength(1);
  });
});

describe("saveSubmission", () => {
  const sub = { repoUrl: "https://github.com/a/b", demoUrl: null, notes: "v1" };
  it("creates then updates the team's Episode 0 submission", async () => {
    await saveSubmission(db, { teamId, submission: sub });
    await saveSubmission(db, { teamId, submission: { ...sub, notes: "v2" } });
    const rows = await db.select().from(submissions);
    expect(rows.map((r) => [r.teamId, r.episode, r.notes])).toEqual([[teamId, 0, "v2"]]);
    expect((await getDashboard(db, { teamId, memberId })).submission?.notes).toBe("v2");
  });
  it("refuses after the deadline", async () => {
    expect(await saveSubmission(db, { teamId, submission: sub, now: new Date("2026-10-20T00:00:00Z"), deadline: "2026-10-15T23:59:00+05:30" })).toEqual({ ok: false, reason: "closed" });
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3:** Implement (`isEpisodeZeroOpen` and `diffTeam` from `@pandora/core`; upsert with `onConflictDoUpdate` on `(team_id, episode)`). **Step 4:** `pnpm --filter @pandora/db test && typecheck && lint` → PASS. **Step 5:** Commit `Add participant dashboard, notices, edit requests and Episode 0 submission queries`.

---

### Task B3: Sign-in

**Files:** Create `apps/web/src/features/participant/sign-in-actions.ts` (`"use server"`), `apps/web/src/app/sign-in/page.tsx`, `apps/web/src/features/participant/sign-in-form.tsx`; Modify `apps/web/src/lib/session.ts` (redirect target `/sign-in` instead of `/?signin=1`).

**Interfaces — produces:**
```ts
export async function requestSignInCode(email: string): Promise<{ ok: true } | { ok: false; message: string }>;
export async function verifySignIn(email: string, code: string): Promise<{ ok: false; message: string }>; // on success redirects to /team
export async function signOut(): Promise<never>; // endSession() then redirect("/")
```
Behaviour: invalid SRM email → schema message. Known member: `issueOtp` (`participant_sign_in`) → `too_soon` / `daily_limit` messages as in Flow A → send `otp-code`. Unknown email: send nothing. Both return `{ ok: true }` ("If this email is registered, a code is on its way."). `verifySignIn` maps reasons like Flow A; on `ok`, `findMemberByEmail` → `startMemberSession(member.id)` → `redirect("/team")`.

- [ ] Checklist: two-screen form (email → code), 60 s resend countdown, the same message for registered and unregistered emails, a signed-in user visiting `/sign-in` is redirected to `/team`, "Sign out" works and the old cookie no longer opens `/team`.
- [ ] `pnpm --filter @pandora/web typecheck && lint && build` → PASS; commit `Add participant sign-in`.

---

### Task B4: The team dashboard

**Files:** Create `apps/web/src/app/(participant)/team/page.tsx`, `apps/web/src/features/participant/*` (dashboard sections and `dashboard-actions.ts` with `markRead(notificationId)`, `submitEdit(formData)`, `submitEpisodeZero(formData)`).

- [ ] Every page/action begins with `requireMember()` and uses only `team.id` from it.
- [ ] Sections: welcome + team name + track; members list; journey (Registration ✓ → Shortlisting pending/shortlisted/not shortlisted → Episodes 1-3 locked); payment status (only when not `not_required`); notices with unread badge and "mark as read"; Edit details (pre-filled form built from `getTeamSnapshot`, validated with `teamEditSchema`, then `proposeEdit`; shows "pending review" with the listed changes while one is pending); Episode 0 submission form (`submissionSchema`, `saveSubmission`, disabled with a message once `isEpisodeZeroOpen` is false, and for teams whose `paymentStatus` is `pending` ("being verified") or `declined` ("payment needs another look"); handle the `not_verified` result too); `<CheckinPassCard memberId={member.id} />`.
- [ ] `no_changes` → "Nothing changed."; `pending_exists` → "You already have changes waiting for review."; `closed` → "Episode 0 submissions are closed."
- [ ] Mobile-first, 375 px; keyboard reachable.
- [ ] typecheck + lint + build → PASS; commit `Add the team dashboard`.

---

### Task B5: Check on the preview
- [ ] Ask Ojas to run `pnpm --filter @pandora/db seed -- --fake-teams` against the dev database, then sign in on the PR preview as a seeded member (your own email must be in `MAIL_ALLOWLIST`; ask Ojas).
- [ ] Every member of one team sees the same dashboard; an edit request and an Episode 0 submission appear in the database; another team's notices never appear.

## Done when
Spec section 5: every member of a registered team can sign in and see the same dashboard; an edit request and an Episode 0 submission can be made and are visible to admins.
