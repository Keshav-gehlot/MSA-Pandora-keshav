# Flow A: Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Read `AGENTS.md` (root) and the `AGENTS.md` of every folder you touch first. Teaching mode applies.

**Owner:** Harsh Chaudhary. **Milestone:** M1 Registration opens.

**Goal:** A team of 3 or 4 can register on the landing page in five short steps, with the leader's SRM email proven by a one-time code, every member gets a confirmation email, and nothing is saved unless the whole team is valid.

**Architecture:** Rules and schemas in `packages/core/src/flows/registration.ts`; every database write in `packages/db/src/queries/registration.ts` (one transaction per registration); emails in `packages/email/src/templates/registration/`; thin Server Actions and the form in `apps/web/src/features/registration/`. The page only calls Server Actions; Server Actions only call `@pandora/*` functions.

**Tech Stack:** Next.js 16 Server Actions, zod 4 (`@pandora/core`), Drizzle (`@pandora/db`), React Email (`@pandora/email`), Astryx components (`@astryxdesign/core`, themed by `@pandora/ui`).

**Spec:** `docs/superpowers/specs/2026-09-26-registration-and-operations-design.md` sections 2, 3 and 4.

## How this plan is written

Logic tasks (core, db, email) give you **exact signatures and the exact tests**: write the tests first, watch them fail, then write the implementation that makes them pass. Screen tasks give you **the behaviour to build and a checklist to verify**; how it looks is yours (the frontend team restyles it later). You never edit another flow's files, `registry.ts`, or any package `index.ts`: your files are already wired in.

## Global Constraints

- Only edit: `packages/core/src/flows/registration.ts` (+ its test), `packages/db/src/queries/registration.ts` (+ test), `packages/email/src/templates/registration/**`, `apps/web/src/features/registration/**`, and the one line in `apps/web/src/app/page.tsx` that mounts the section. Anything else: stop and ask Ojas for an issue.
- Rules come from `@pandora/core` (`registrationSchema`, `memberSchema`, `teamNameSchema`, `trackSchema`, `srmEmailSchema`, `otpCodeSchema`, `TEAM_SIZE`, `TRACKS`, `UPLOADS`). Never re-implement a rule in the app.
- The leader is `members[0]`. Only the leader's SRM email is verified during registration (spec section 4).
- Registration proof: the server calls `claimVerifiedOtp(tx, { email: leader.srmEmail, purpose: "registration" })` **inside** the registration transaction. A browser-side "verified" flag is never trusted.
- Payment is controlled by the `PAYMENT_ENABLED` environment variable (`"true"` = on). It is off for now.
- Uploaded files go through `getStorage().putFile(path, bytes, contentType)` at `teams/<teamId>/photos/<position>.<ext>` and `teams/<teamId>/payment/<uuid>.<ext>`.
- Every error shown to the user is a plain sentence; never show a stack trace or a database message.
- Commits and PRs: no AI attribution of any kind. Branch `<issue-number>-<short-name>`, PR body starts with `Closes #<issue>`.

---

### Task A1: Registration rules in core

**Files:**
- Modify: `packages/core/src/flows/registration.ts`
- Test: `packages/core/src/flows/registration.test.ts`

**Interfaces:**
- Consumes: `teamNameSchema`, `trackSchema`, `UPLOADS` from `../rules` and `../config`.
- Produces: `teamStepSchema` (zod object `{ teamName, track }`), `type UploadKind = "photo" | "paymentProof"`, `checkUpload(kind, file: { type: string; size: number }): { ok: true } | { ok: false; message: string }`, `uploadExtension(type: string): "jpg" | "png" | "webp"`, `isPaymentEnabled(value: string | undefined): boolean`.

- [ ] **Step 1: Write the tests**

```ts
import { describe, expect, it } from "vitest";
import { checkUpload, isPaymentEnabled, teamStepSchema, uploadExtension } from "./registration";

const MB = 1024 * 1024;

describe("teamStepSchema", () => {
  it("accepts a team name and a known track", () => {
    expect(teamStepSchema.parse({ teamName: "  Null Pointers ", track: "Track B" })).toEqual({ teamName: "Null Pointers", track: "Track B" });
  });
  it("rejects a short name and an unknown track", () => {
    const r = teamStepSchema.safeParse({ teamName: "ab", track: "Track Z" });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["teamName", "track"]);
  });
});

describe("checkUpload", () => {
  it("accepts a 2 MB PNG photo and payment proof", () => {
    expect(checkUpload("photo", { type: "image/png", size: 2 * MB })).toEqual({ ok: true });
    expect(checkUpload("paymentProof", { type: "image/png", size: 2 * MB })).toEqual({ ok: true });
  });
  it("accepts WebP for photos but not for payment proofs", () => {
    expect(checkUpload("photo", { type: "image/webp", size: MB })).toEqual({ ok: true });
    expect(checkUpload("paymentProof", { type: "image/webp", size: MB })).toEqual({ ok: false, message: "Use a JPEG or PNG image" });
  });
  it("rejects other types, empty files and files over 5 MB", () => {
    expect(checkUpload("photo", { type: "application/pdf", size: MB })).toEqual({ ok: false, message: "Use a JPEG, PNG or WebP image" });
    expect(checkUpload("photo", { type: "image/png", size: 0 })).toEqual({ ok: false, message: "The file is empty" });
    expect(checkUpload("photo", { type: "image/png", size: 5 * MB + 1 })).toEqual({ ok: false, message: "Files must be 5 MB or smaller" });
  });
});

describe("helpers", () => {
  it("maps content types to file extensions", () => {
    expect(uploadExtension("image/jpeg")).toBe("jpg");
    expect(uploadExtension("image/png")).toBe("png");
    expect(uploadExtension("image/webp")).toBe("webp");
  });
  it("turns payments on only for the exact value true", () => {
    expect(isPaymentEnabled("true")).toBe(true);
    expect(isPaymentEnabled(" TRUE ")).toBe(true);
    expect(isPaymentEnabled("false")).toBe(false);
    expect(isPaymentEnabled(undefined)).toBe(false);
    expect(isPaymentEnabled("1")).toBe(false);
  });
});
```

- [ ] **Step 2:** `pnpm --filter @pandora/core test` → FAIL (functions don't exist).
- [ ] **Step 3:** Implement the five exports in `registration.ts` (replace the `export {}` line). The size limit and allowed types come from `UPLOADS`; check emptiness first, then type, then size.
- [ ] **Step 4:** `pnpm --filter @pandora/core test && pnpm --filter @pandora/core typecheck && pnpm --filter @pandora/core lint` → PASS.
- [ ] **Step 5:** Commit `Add registration step and upload rules`.

---

### Task A2: Saving a registration

**Files:**
- Modify: `packages/db/src/queries/registration.ts`
- Test: `packages/db/src/queries/registration.test.ts`

**Interfaces:**
- Consumes: `Db`, `claimVerifiedOtp`, `uniqueViolationField`, `type UniqueField`, tables `teams`, `members`, `paymentProofs`; `teamNameKey`, `type Registration` from `@pandora/core`.
- Produces:

```ts
export type RegisterTeamInput = {
  teamId: string;                       // generated by the caller (so uploads can use it before insert)
  registration: Registration;           // already parsed by registrationSchema
  paymentEnabled: boolean;
  photoPaths?: Array<string | null>;    // index = member index
  paymentProofPath?: string | null;
  now?: Date;
};
export type RegisterTeamResult =
  | { ok: true; teamId: string }
  | { ok: false; reason: "email_not_verified" }
  | { ok: false; reason: "taken"; field: UniqueField };
export function registerTeam(db: Db, input: RegisterTeamInput): Promise<RegisterTeamResult>;
export function isTeamNameAvailable(db: Db, name: string): Promise<boolean>;
export function findTakenMemberFields(
  db: Db,
  members: Array<{ regNumber: string; srmEmail: string }>,
): Promise<Array<{ index: number; field: "regNumber" | "srmEmail" }>>;
```

Behaviour: `registerTeam` runs ONE transaction: claim the leader's verification (none → `email_not_verified`, nothing written); insert the team (`nameKey = teamNameKey(name)`, `paymentStatus = paymentEnabled ? "pending" : "not_required"`); insert members with `position = index + 1`, `isLeader = index === 0`, `photoPath` from `photoPaths`; insert the payment proof row when `paymentProofPath` is given. A unique violation rolls the whole transaction back (including the claim, so the leader can fix the form and resubmit without a new code) and returns `{ ok: false, reason: "taken", field: uniqueViolationField(error) }`. Any other error is re-thrown.

- [ ] **Step 1: Write the tests**

```ts
import { eq } from "drizzle-orm";
import type { Registration } from "@pandora/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { members, paymentProofs, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { issueOtp, verifyOtp } from "./auth";
import { findTakenMemberFields, isTeamNameAvailable, registerTeam } from "./registration";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";
const member = (team: 1 | 2, n: number) => ({
  firstName: `M${n}`,
  lastName: "Test",
  regNumber: `RA26110260106${team}${n}`,
  srmEmail: `t${team}m${n}@srmist.edu.in`,
  personalEmail: `t${team}m${n}@gmail.com`,
  phone: `98765432${team}${n}`,
});
const reg = (teamName: string, team: 1 | 2, count = 3): Registration => ({
  teamName,
  track: "Track A",
  members: Array.from({ length: count }, (_, i) => member(team, i + 1)),
});
async function verify(email: string) {
  const issued = await issueOtp(db, { email, purpose: "registration" });
  if (!issued.ok) throw new Error("could not issue");
  expect(await verifyOtp(db, { email, purpose: "registration", code: issued.code })).toEqual({ ok: true });
}

describe("registerTeam", () => {
  it("saves a verified team of three with the first member as leader", async () => {
    await verify("t1m1@srmist.edu.in");
    expect(await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: false })).toEqual({ ok: true, teamId: TEAM_A });
    const [team] = await db.select().from(teams);
    expect(team).toMatchObject({ id: TEAM_A, name: "Null Pointers", nameKey: "null pointers", track: "Track A", paymentStatus: "not_required", shortlistStatus: "pending" });
    const rows = await db.select().from(members).where(eq(members.teamId, TEAM_A)).orderBy(members.position);
    expect(rows.map((m) => [m.position, m.isLeader, m.srmEmail])).toEqual([
      [1, true, "t1m1@srmist.edu.in"],
      [2, false, "t1m2@srmist.edu.in"],
      [3, false, "t1m3@srmist.edu.in"],
    ]);
  });

  it("saves a team of four with photo paths", async () => {
    await verify("t1m1@srmist.edu.in");
    await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1, 4), paymentEnabled: false, photoPaths: ["p/1.png", null, null, "p/4.jpg"] });
    const rows = await db.select().from(members).orderBy(members.position);
    expect(rows.map((m) => m.photoPath)).toEqual(["p/1.png", null, null, "p/4.jpg"]);
  });

  it("refuses an unverified leader and saves nothing", async () => {
    expect(await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: false })).toEqual({ ok: false, reason: "email_not_verified" });
    expect(await db.select().from(teams)).toHaveLength(0);
  });

  it("reports a taken team name, saves nothing, and lets the leader resubmit without a new code", async () => {
    await verify("t1m1@srmist.edu.in");
    await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: false });
    await verify("t2m1@srmist.edu.in");
    expect(await registerTeam(db, { teamId: TEAM_B, registration: reg("  NULL   pointers ", 2), paymentEnabled: false })).toEqual({ ok: false, reason: "taken", field: "teamName" });
    expect(await db.select().from(members)).toHaveLength(3);
    expect(await registerTeam(db, { teamId: TEAM_B, registration: reg("Segfaults", 2), paymentEnabled: false })).toEqual({ ok: true, teamId: TEAM_B });
  });

  it("reports a registration number already used by another team", async () => {
    await verify("t1m1@srmist.edu.in");
    await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: false });
    await verify("t2m1@srmist.edu.in");
    const clash = reg("Segfaults", 2);
    clash.members[1] = { ...clash.members[1]!, regNumber: "RA2611026010612" };
    expect(await registerTeam(db, { teamId: TEAM_B, registration: clash, paymentEnabled: false })).toEqual({ ok: false, reason: "taken", field: "regNumber" });
  });

  it("records a pending payment and its proof when payments are on", async () => {
    await verify("t1m1@srmist.edu.in");
    await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: true, paymentProofPath: `teams/${TEAM_A}/payment/x.png` });
    const [team] = await db.select().from(teams);
    expect(team?.paymentStatus).toBe("pending");
    const proofs = await db.select().from(paymentProofs);
    expect(proofs.map((p) => [p.teamId, p.filePath, p.status])).toEqual([[TEAM_A, `teams/${TEAM_A}/payment/x.png`, "pending"]]);
  });
});

describe("availability checks", () => {
  it("reports whether a team name is free, ignoring case and spacing", async () => {
    expect(await isTeamNameAvailable(db, "Null Pointers")).toBe(true);
    await verify("t1m1@srmist.edu.in");
    await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: false });
    expect(await isTeamNameAvailable(db, "  null   POINTERS ")).toBe(false);
  });

  it("lists which member fields are already taken", async () => {
    await verify("t1m1@srmist.edu.in");
    await registerTeam(db, { teamId: TEAM_A, registration: reg("Null Pointers", 1), paymentEnabled: false });
    expect(
      await findTakenMemberFields(db, [
        { regNumber: "RA2611026010612", srmEmail: "new1@srmist.edu.in" },
        { regNumber: "RA2611026010699", srmEmail: "t1m3@srmist.edu.in" },
        { regNumber: "RA2611026010698", srmEmail: "new2@srmist.edu.in" },
      ]),
    ).toEqual([
      { index: 0, field: "regNumber" },
      { index: 1, field: "srmEmail" },
    ]);
  });
});
```

- [ ] **Step 2:** `pnpm --filter @pandora/db test registration` → FAIL.
- [ ] **Step 3:** Implement the three functions. Use `db.transaction(async (tx) => ...)` and pass `tx` to `claimVerifiedOtp`. To roll back on a unique violation, let the error escape the transaction callback and catch it outside.
- [ ] **Step 4:** `pnpm --filter @pandora/db test && pnpm --filter @pandora/db typecheck && pnpm --filter @pandora/db lint` → PASS.
- [ ] **Step 5:** Commit `Save registrations in one transaction with verified-leader proof`.

---

### Task A3: Registration emails

**Files:**
- Create: `packages/email/src/templates/registration/received.tsx`, `packages/email/src/templates/registration/received.test.tsx`
- Modify: `packages/email/src/templates/registration/index.ts` (add `"registration-received": registrationReceived`)

**Interfaces:**
- Produces template `"registration-received"` with props `{ teamName: string; track: string; memberNames: string[]; paymentPending: boolean }`.

- [ ] **Step 1: Write the test**

```tsx
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { registrationReceived } from "./received";

const props = { teamName: "Null Pointers", track: "Track A", memberNames: ["Asha Rao", "Ben Paul", "Chitra N"], paymentPending: false };

describe("registration-received", () => {
  it("confirms a registration when no payment is due", async () => {
    expect(registrationReceived.subject(props)).toBe("Null Pointers is registered for MSA Pandora");
    const text = registrationReceived.text(props);
    for (const s of ["Null Pointers", "Track A", "Asha Rao", "Ben Paul", "Chitra N"]) expect(text).toContain(s);
    expect(await render(registrationReceived.html(props))).toContain("Null Pointers");
  });
  it("says the payment is under review when it is", () => {
    const pending = { ...props, paymentPending: true };
    expect(registrationReceived.subject(pending)).toBe("We've received Null Pointers's registration");
    expect(registrationReceived.text(pending)).toContain("payment");
  });
});
```

- [ ] **Step 2:** `pnpm --filter @pandora/email test` → FAIL.
- [ ] **Step 3:** Implement following `templates/otp-code.tsx` as the pattern; register it in `templates/registration/index.ts`. The text also says what happens next (shortlisting via Episode 0, sign in with your SRM email at the site).
- [ ] **Step 4:** `pnpm --filter @pandora/email test && pnpm --filter @pandora/email typecheck && pnpm --filter @pandora/email lint` → PASS.
- [ ] **Step 5:** Commit `Add the registration confirmation email`.

---

### Task A4: Server Actions

**Files:**
- Create: `apps/web/src/features/registration/actions.ts` (`"use server"`)

**Interfaces:**
- Consumes: everything above plus `issueOtp`, `verifyOtp`, `findMemberByEmail`, `getDb`, `getStorage`, `sendEmail`, `srmEmailSchema`, `otpCodeSchema`, `registrationSchema`.
- Produces (called by the form only):

```ts
type Result = { ok: true } | { ok: false; message: string };
export async function sendRegistrationCode(email: string): Promise<Result>;
export async function verifyRegistrationCode(email: string, code: string): Promise<Result>;
export async function checkTeamName(name: string): Promise<{ available: boolean }>;
export async function submitRegistration(formData: FormData): Promise<
  { ok: true; teamName: string } | { ok: false; message: string; field?: "teamName" | "regNumber" | "srmEmail" }
>;
```

Behaviour (messages are exact):
- `sendRegistrationCode`: invalid SRM email → the schema's message; email already belongs to a member → `"This email is already part of a registered team."`; `issueOtp` `too_soon` → `"Wait ${retryAfterSeconds} seconds before asking for another code."`; `daily_limit` → `"Too many codes today. Try again tomorrow."`; send failure → `"We couldn't send the email. Try again in a minute."`; else send the `otp-code` email (`purpose: "registration"`) and return ok.
- `verifyRegistrationCode`: `invalid` → `"That code isn't right."`; `expired` → `"That code has expired. Ask for a new one."`; `too_many_attempts` → `"Too many tries. Ask for a new code."`; `not_found` → `"Ask for a code first."`.
- `submitRegistration`: the form posts a `registration` field (JSON of `RegistrationInput`), optional files `photo-0`…`photo-3`, and `paymentProof`. Parse with `registrationSchema` (first issue's message on failure). Check each file with `checkUpload`. Require `paymentProof` when `isPaymentEnabled(process.env.PAYMENT_ENABLED)`. Generate `teamId = crypto.randomUUID()`, upload files, call `registerTeam`. `email_not_verified` → `"Verify the team leader's email first."`; `taken` → `teamName`: `"That team name is taken."`, `regNumber`: `"One of these registration numbers is already registered."`, `srmEmail`: `"One of these SRM emails is already registered."` (with `field`). On success send `registration-received` to every member's SRM email (a failed send doesn't fail the registration) and return `{ ok: true, teamName }`.

- [ ] **Step 1:** Implement the four actions exactly as above. Keep every rule call in `@pandora/*`; the actions only translate results to messages.
- [ ] **Step 2:** `pnpm --filter @pandora/web typecheck && pnpm --filter @pandora/web lint && pnpm --filter @pandora/web build` → PASS.
- [ ] **Step 3:** Commit `Add registration Server Actions`.

---

### Task A5: The registration form

**Files:**
- Create: `apps/web/src/features/registration/registration-form.tsx` (`"use client"`), plus one component per step as you see fit (`team-step.tsx`, `member-step.tsx`, `otp-step.tsx`, `review-step.tsx`, `payment-step.tsx`, `done.tsx`), and `registration-section.tsx` (server component that renders the form and reads `PAYMENT_ENABLED` to pass `paymentEnabled`).
- Modify: `apps/web/src/app/page.tsx` — mount `<RegistrationSection />` inside an element with `id="register"` (one import + one element).

**Behaviour (the checklist is the test):**
- [ ] Steps: 1 Team (name + track) → 2 Leader (details, then "Send code" and a 6-digit code box; can't continue until the code is verified) → 3 Member 2 → 4 Member 3 → 5 Member 4 (with a clear "Skip, we're a team of 3") → 6 Review (every field, an "Edit" link per step) → 7 Payment (only when `paymentEnabled`: the payment QR placeholder and a proof upload) → Done screen.
- [ ] Each step validates with the same `@pandora/core` schemas before "Next"; errors appear under the field that caused them.
- [ ] The team name shows "available" / "taken" as the user types (debounced ~400 ms, via `checkTeamName`).
- [ ] "Send code" disables with a countdown for 60 seconds after sending.
- [ ] Progress survives a page refresh (`localStorage`, key `pandora-registration-v1`), except files and the verified state; clear it after a successful submit. Wrap every `localStorage` call in `try/catch`.
- [ ] Photo upload per member is optional; show the file name and size, reject with the `checkUpload` message.
- [ ] If submit returns a `field`, jump back to the step that owns it and show the message there.
- [ ] Works at 375 px wide; every control reachable by keyboard; buttons have visible labels.
- [ ] Use Astryx components for inputs, buttons, steps and alerts (see `docs/tech/` and msa-auth's forms for examples of the Astryx API).

- [ ] **Step 1:** Build the steps. **Step 2:** `pnpm --filter @pandora/web typecheck && lint && build` → PASS. **Step 3:** Commit `Add the multi-step registration form`.

---

### Task A6: End-to-end check on the preview

- [ ] Open the PR; the deploy workflow comments the preview link (`pandora-pr-<n>.vercel.app`).
- [ ] On the preview, register a team of 3 and a team of 4 using your own SRM email as leader (preview emails only reach addresses in `MAIL_ALLOWLIST`; ask Ojas to add yours).
- [ ] Try a duplicate team name, a duplicate registration number and a duplicate SRM email: each is rejected with its message and the right step.
- [ ] Ask Ojas to confirm in the Neon dev database that exactly the expected rows exist.
- [ ] Record what you tested in the PR description.

## Done when
Spec section 4: a team of 3 and a team of 4 register end to end on a preview deployment; duplicate team name, registration number and SRM email are rejected with a clear message; the emails arrive.
