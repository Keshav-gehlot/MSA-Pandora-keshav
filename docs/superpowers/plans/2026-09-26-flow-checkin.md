# Flow D: Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` (root) and the `AGENTS.md` of every folder you touch first. Teaching mode applies.

**Owner:** Alrik Chishi. **Milestone:** M3 Event day.

**Goal:** Every member of a shortlisted team has a personal QR pass on their dashboard; at the venue, staff scan it on a phone (or search by name) and mark the member present exactly once.

**Architecture:** Browser-safe pass payload helpers in `packages/core/src/flows/checkin.ts`; pass issuing, lookup, check-in, search and attendance queries in `packages/db/src/queries/checkin.ts`; the pass card in `apps/web/src/features/checkin/`; the staff portal in `apps/console/src/app/staff/**` and `apps/console/src/features/checkin/**`; the email in `packages/email/src/templates/checkin/`.

**Tech Stack:** Next.js 16, Drizzle, Node `crypto` (HMAC), a QR rendering library in the web app and a camera QR scanner in the console (you choose both; see Task D3/D4).

**Spec:** `docs/superpowers/specs/2026-09-26-registration-and-operations-design.md` sections 3 and 7.

## Ruling carried from the plan (differs from the spec's wording)
The spec says a pass is "a random 128-bit token (only its hash stored)". The dashboard must show the same QR every visit, which a stored hash can't reproduce. So: **token = base64url(HMAC-SHA256(`PASS_SECRET`, pass id))**. Only the token's SHA-256 is stored (for lookup); the token itself is recomputed from the pass id whenever it's shown. Without `PASS_SECRET` (a server-only env var, ≥ 32 random bytes) a token can't be guessed or forged. Revoking a pass makes its token useless.

## Global Constraints
- Only edit: `packages/core/src/flows/checkin.ts` (+ test), `packages/db/src/queries/checkin.ts` (+ test), `packages/email/src/templates/checkin/**`, `apps/web/src/features/checkin/**`, `apps/console/src/app/staff/**`, `apps/console/src/features/checkin/**`.
- Staff pages begin with `const staffUser = await requireStaff();` (role `staff` or `admin`). Console sign-in is Flow C's Task C1; until it merges, build against a seeded session locally.
- QR payload format (exact): `pandora-pass:<token>`.
- Passes exist only for members of teams with `shortlist_status = 'shortlisted'`; one pass per member.
- A member is checked in at most once per event (`attendance` unique `(member_id, event)`); the event name is `"episode_1"`.
- Never log or display a token except inside the rendered QR; never put `PASS_SECRET` anywhere but server env.
- Adding a library (QR rendering, QR scanning) needs a `docs/tech/<name>.md` note in the same PR (what, why here, what else you considered).
- No AI attribution in commits or PRs. Branch `<issue>-<short-name>`, PR body starts with `Closes #<issue>`.

---

### Task D1: Pass payload helpers

**Files:** `packages/core/src/flows/checkin.ts`, test `packages/core/src/flows/checkin.test.ts`.

**Produces:** `PASS_PREFIX = "pandora-pass:"`, `formatPassPayload(token: string): string`, `parsePassPayload(text: string): string | null` (trims; returns the token only if the text is the prefix + 43 base64url characters).

- [ ] **Tests**
```ts
import { describe, expect, it } from "vitest";
import { formatPassPayload, parsePassPayload } from "./checkin";

const token = "A".repeat(40) + "b-_";
describe("pass payload", () => {
  it("round-trips a token", () => {
    expect(formatPassPayload(token)).toBe(`pandora-pass:${token}`);
    expect(parsePassPayload(` pandora-pass:${token}\n`)).toBe(token);
  });
  it("rejects anything else", () => {
    expect(parsePassPayload(token)).toBeNull();
    expect(parsePassPayload("pandora-pass:short")).toBeNull();
    expect(parsePassPayload(`pandora-pass:${token}x`)).toBeNull();
    expect(parsePassPayload(`https://evil.example/${token}`)).toBeNull();
  });
});
```
- [ ] FAIL → implement → PASS (core test/typecheck/lint); commit `Add event pass payload helpers`.

---

### Task D2: Passes, check-in and attendance queries

**Files:** `packages/db/src/queries/checkin.ts`, test `packages/db/src/queries/checkin.test.ts`.

**Produces:**
```ts
export const CHECKIN_EVENT = "episode_1";
export function issuePassesForTeam(db: Db, input: { teamId: string; secret: string; now?: Date }):
  Promise<{ ok: true; issued: number } | { ok: false; reason: "not_shortlisted" }>; // idempotent: members who already have an unrevoked pass are skipped
export function getPassToken(db: Db, input: { memberId: string; secret: string }): Promise<string | null>; // null: no pass, revoked, or team no longer shortlisted
export function lookupPass(db: Db, token: string): Promise<null | {
  memberId: string; memberName: string; regNumber: string; photoPath: string | null;
  teamName: string; track: string; revoked: boolean;
  checkedIn: { at: Date; byName: string } | null;
}>;
export function checkIn(db: Db, input: { memberId: string; staffId: string; now?: Date }):
  Promise<{ ok: true; at: Date } | { ok: false; reason: "already"; at: Date; byName: string } | { ok: false; reason: "no_pass" | "revoked" }>;
export function revokePass(db: Db, memberId: string): Promise<void>;
export function searchCheckin(db: Db, query: string): Promise<Array<{ memberId: string; memberName: string; regNumber: string; teamName: string; hasPass: boolean; checkedInAt: Date | null }>>; // shortlisted teams only; name / reg number / team name, case-insensitive; max 20
export function attendanceSummary(db: Db): Promise<Array<{ teamId: string; teamName: string; expected: number; present: number }>>; // shortlisted teams, by team name
```
Behaviour: token = `createHmac("sha256", secret).update(passId).digest("base64url")` (43 chars); store `hashToken(token)` from `@pandora/core/server`. `checkIn` inserts into `attendance` with `ON CONFLICT DO NOTHING`; when nothing was inserted it reads the existing row and returns `already` with the checking-in staff member's name (safe when two phones scan at once). `revokePass` sets `revoked_at`.

- [ ] **Tests** (seed: team Alpha shortlisted with 3 members, team Beta pending, one staff row "Gate One"; `SECRET = "test-secret-at-least-32-bytes-long!!"`):
```ts
it("issues one pass per member of a shortlisted team, idempotently", async () => {
  expect(await issuePassesForTeam(db, { teamId: alpha, secret: SECRET })).toEqual({ ok: true, issued: 3 });
  expect(await issuePassesForTeam(db, { teamId: alpha, secret: SECRET })).toEqual({ ok: true, issued: 0 });
  expect(await issuePassesForTeam(db, { teamId: beta, secret: SECRET })).toEqual({ ok: false, reason: "not_shortlisted" });
});
it("recomputes the same token and finds the member by it", async () => {
  await issuePassesForTeam(db, { teamId: alpha, secret: SECRET });
  const token = await getPassToken(db, { memberId: alphaMembers[0], secret: SECRET });
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await getPassToken(db, { memberId: alphaMembers[0], secret: SECRET })).toBe(token);
  expect(await lookupPass(db, token!)).toMatchObject({ memberId: alphaMembers[0], teamName: "Alpha", revoked: false, checkedIn: null });
  expect(await lookupPass(db, "x".repeat(43))).toBeNull();
  expect(await getPassToken(db, { memberId: betaMembers[0], secret: SECRET })).toBeNull();
});
it("a different secret can't produce a valid token", async () => {
  await issuePassesForTeam(db, { teamId: alpha, secret: SECRET });
  const forged = await getPassToken(db, { memberId: alphaMembers[0], secret: "some-other-secret-that-is-long-enough" });
  expect(await lookupPass(db, forged!)).toBeNull();
});
it("checks a member in once and reports who did it the second time", async () => {
  await issuePassesForTeam(db, { teamId: alpha, secret: SECRET });
  const first = await checkIn(db, { memberId: alphaMembers[0], staffId, now: new Date("2026-10-27T03:40:00Z") });
  expect(first).toEqual({ ok: true, at: new Date("2026-10-27T03:40:00Z") });
  expect(await checkIn(db, { memberId: alphaMembers[0], staffId })).toEqual({ ok: false, reason: "already", at: new Date("2026-10-27T03:40:00Z"), byName: "Gate One" });
});
it("lets only one of two simultaneous scans record the check-in", async () => {
  await issuePassesForTeam(db, { teamId: alpha, secret: SECRET });
  const r = await Promise.all([checkIn(db, { memberId: alphaMembers[1], staffId }), checkIn(db, { memberId: alphaMembers[1], staffId })]);
  expect(r.filter((x) => x.ok)).toHaveLength(1);
});
it("refuses members without a pass and revoked passes", async () => {
  expect(await checkIn(db, { memberId: betaMembers[0], staffId })).toEqual({ ok: false, reason: "no_pass" });
  await issuePassesForTeam(db, { teamId: alpha, secret: SECRET });
  await revokePass(db, alphaMembers[2]);
  expect(await checkIn(db, { memberId: alphaMembers[2], staffId })).toEqual({ ok: false, reason: "revoked" });
});
it("searches shortlisted members and summarizes attendance", async () => {
  await issuePassesForTeam(db, { teamId: alpha, secret: SECRET });
  await checkIn(db, { memberId: alphaMembers[0], staffId });
  expect((await searchCheckin(db, "alpha")).map((r) => r.memberId).sort()).toEqual([...alphaMembers].sort());
  expect(await searchCheckin(db, "beta")).toEqual([]);
  expect(await attendanceSummary(db)).toEqual([{ teamId: alpha, teamName: "Alpha", expected: 3, present: 1 }]);
});
```
- [ ] FAIL → implement → PASS (db test/typecheck/lint); commit `Add event pass and check-in queries`.

---

### Task D3: The pass on the participant dashboard

**Files:** replace the body of `apps/web/src/features/checkin/pass-card.tsx` (Flow B already mounts `<CheckinPassCard memberId={member.id} />`); `packages/email/src/templates/checkin/pass-ready.tsx` (`"checkin-pass-ready"`, props `{ firstName: string; teamName: string; dashboardUrl: string }`, test its subject `"Your MSA Pandora event pass is ready"` and that the text contains the dashboard link), registered in `templates/checkin/index.ts`.
- [ ] `CheckinPassCard` (server component): `getPassToken(getDb(), { memberId, secret: process.env.PASS_SECRET! })`; null → render nothing; otherwise render the QR of `formatPassPayload(token)` with the member's name and "Show this at the entrance". Choose a QR library (for example `qrcode` rendering an SVG on the server) and add `docs/tech/<library>.md`.
- [ ] The QR scans correctly from a phone screen at arm's length (test with the console scanner or any phone camera).
- [ ] web + email checks → PASS; commit `Show the event pass on the dashboard`.

---

### Task D4: Staff portal

**Files:** `apps/console/src/app/staff/page.tsx` (scan + search), `apps/console/src/app/staff/attendance/page.tsx`, `apps/console/src/features/checkin/{scanner.tsx ("use client"), actions.ts ("use server")}`.

**Actions:** `lookupScan(payload: string)` → `parsePassPayload` → `lookupPass` (bad payload or unknown token → "This isn't a valid Pandora pass."; revoked → "This pass was cancelled."); `confirmCheckIn(memberId: string)` → `requireStaff()` then `checkIn` with the staff id (`already` → "Already checked in at 09:12 by Gate One." in IST); `searchMembers(query)` → `searchCheckin`.
- [ ] Checklist (phone-first, 375 px): camera scanner (choose a library, add its `docs/tech/` note; must work on Android Chrome and iOS Safari over HTTPS, which the preview is); after a scan show photo (signed URL), name, registration number, team, track and a big **Mark present** button; a manual search box as the fallback; clear success, already-checked-in and error states with a "Scan next" button; `/staff/attendance` shows present / expected per team and the total, refreshing every 15 seconds.
- [ ] console checks → PASS; commit `Add the staff check-in portal`.

---

### Task D5: Check on the preview
- [ ] With Ojas: seed fake teams, shortlist one (Flow C, or a direct update in the dev database), issue passes (C8, or call `issuePassesForTeam` from a script), open a member's dashboard on one phone and scan it from the staff portal on another. Try a second scan, a manual search check-in, and a revoked pass.

## Done when
Spec section 7: a staff member on a phone can check in a shortlisted member by QR and by manual search, and duplicate scans are handled.
