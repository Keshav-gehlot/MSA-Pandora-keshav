# Shared Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared layer every Pandora flow stands on: validation rules, OTP and session primitives, the full data model with migrations, email sending, file storage, the Astryx theme, and session glue in both apps, so the four flow owners can start in parallel.

**Architecture:** Browser-safe rules and schemas in `@pandora/core` (server-only crypto helpers under `@pandora/core/server`); every table, query and file-storage call in `@pandora/db` (Drizzle, `pg` driver in apps, PGlite in tests); email templates and transports in `@pandora/email`; the Astryx theme and providers in `@pandora/ui`; cookie handling in each app's `src/lib/session.ts`.

**Tech Stack:** zod 4, Drizzle ORM 0.45 + drizzle-kit 0.31, `pg` 8, PGlite 0.5 (tests only), React Email + Resend, Supabase Storage (`@supabase/supabase-js`), Astryx 0.6.1, Next.js 16 Server Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-registration-and-operations-design.md` (sections 2, 3 and 8). Parent: `docs/superpowers/specs/2026-09-25-pandora-orchestration-design.md`.

## Global Constraints

- Every Global Constraint of `docs/superpowers/plans/2026-09-25-m0-foundation.md` still holds (TypeScript `~5.9.3`, ESLint `^9`, Next `^16.3.0`, React `^19.2.0`, Vitest `^3.2.0`, `@pandora/<folder>` names, source-only packages, dependency rules, no AI attribution in commits or PRs, never assign or edit the board).
- All work on branch `platform-foundation`; it merges to `main` through one pull request.
- `@pandora/core`'s main entry (`src/index.ts`) must stay importable in the browser: no `node:` imports reachable from it. Node-only helpers live under `src/server/` and are exported as `@pandora/core/server`.
- Rules (spec section 2), exact values: SRM email domain `srmist.edu.in`; registration number `^RA\d{13}$` (upper-cased); phone `^[6-9]\d{9}$` after stripping spaces, hyphens and a leading `+91`; names 1-50 chars; team name 3-40 chars; team size 3-4; OTP 6 digits, 10-minute expiry, 5 attempts, 60-second resend gap; session 7 days; photo JPEG/PNG/WebP ≤ 5 MB; payment proof JPEG/PNG ≤ 5 MB.
- Tracks are `["Track A", "Track B", "Track C", "Track D"]` until renamed; stored as text, validated in core.
- Secrets are never hashed with plain SHA-256 of a short value alone: OTP hashes are `sha256("<email>:<code>")`; session and pass tokens are 32 random bytes (base64url) and only their SHA-256 hex is stored.
- The `pg` Pool is created lazily (first query), never at import time, so `next build` works without `DATABASE_URL`.
- No new production dependency outside this plan's list.

## File Structure

```
packages/core/src/
  config.ts          TRACKS, TEAM_SIZE, SRM_EMAIL_DOMAIN, OTP, SESSION_DAYS, UPLOADS
  rules.ts           zod field schemas, memberSchema, registrationSchema, otpCodeSchema, teamNameKey
  diff.ts            TeamSnapshot, FieldChange, diffTeam, applyChanges
  index.ts           browser-safe exports
  server/secrets.ts  generateOtpCode, hashOtp, hashToken, generateToken, safeEqualHex, otpExpiry, sessionExpiry
  server/index.ts
packages/db/
  drizzle.config.ts
  drizzle/           generated SQL migrations
  src/schema/*.ts    one table per file + enums.ts + index.ts
  src/client.ts      Db type, createDb, getDb
  src/storage.ts     Storage interface, supabaseStorage, diskStorage
  src/queries/auth.ts issueOtp, verifyOtp, createSession, getSession, revokeSession, findMemberByEmail, findStaffByEmail
  src/test-utils.ts  createTestDb (PGlite + migrations)
  src/index.ts
packages/email/src/
  transport.ts       MailMessage, MailTransport, fileTransport, resendTransport
  templates/otp-code.tsx
  registry.ts        templates map + types
  send.ts            sendEmail, getTransport
  index.ts
packages/ui/src/
  theme/msa.js msa.css msa.d.ts msa.variants.d.ts  (copied from msa-auth)
  providers.tsx      AppProviders
  styles.css         reset + astryx + theme
apps/web/src/lib/session.ts, apps/console/src/lib/session.ts
apps/*/.env.example, apps/*/next.config.ts, apps/*/src/app/layout.tsx
.github/workflows/deploy.yml  (migrate job)
```

---

### Task 1: Rules, config and edit-request diff in `@pandora/core`

**Files:**
- Modify: `packages/core/package.json` (add `zod`, add `./server` export)
- Create: `packages/core/src/config.ts`, `packages/core/src/rules.ts`, `packages/core/src/diff.ts`, `packages/core/src/server/secrets.ts`, `packages/core/src/server/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/rules.test.ts`, `packages/core/src/diff.test.ts`, `packages/core/src/server/secrets.test.ts`

**Interfaces:**
- Produces (from `@pandora/core`): `TRACKS`, `type Track`, `TEAM_SIZE`, `SRM_EMAIL_DOMAIN`, `OTP`, `SESSION_DAYS`, `UPLOADS`, `srmEmailSchema`, `personalEmailSchema`, `regNumberSchema`, `phoneSchema`, `nameSchema`, `teamNameSchema`, `trackSchema`, `memberSchema`, `type MemberInput`, `type Member`, `registrationSchema`, `type RegistrationInput`, `type Registration`, `otpCodeSchema`, `teamNameKey(name: string): string`, `type TeamSnapshot`, `type FieldChange`, `diffTeam(current, proposed): FieldChange[]`, `applyChanges(snapshot, changes): TeamSnapshot`, plus the existing `siteConfig`, `pageTitle`.
- Produces (from `@pandora/core/server`): `generateOtpCode(): string`, `hashOtp(email: string, code: string): string`, `generateToken(): string`, `hashToken(token: string): string`, `safeEqualHex(a: string, b: string): boolean`, `otpExpiry(now: Date): Date`, `sessionExpiry(now: Date): Date`.

- [ ] **Step 1: Add the dependency and the server export**

In `packages/core/package.json`: set `"exports": { ".": "./src/index.ts", "./server": "./src/server/index.ts" }` and add `"dependencies": { "zod": "^4.1.0" }`. Add `"@types/node": "^22.0.0"` to `devDependencies`. Run `pnpm install`.

- [ ] **Step 2: Write the failing tests**

`packages/core/src/rules.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { registrationSchema, teamNameKey, otpCodeSchema, phoneSchema } from "./rules";

const member = (n: number) => ({
  firstName: ` Member${n} `,
  lastName: "Test",
  regNumber: `ra261102601069${n}`,
  srmEmail: `M${n}@SRMIST.EDU.IN`,
  personalEmail: `m${n}@gmail.com`,
  phone: `+91 98765 4321${n}`,
});

describe("registrationSchema", () => {
  it("accepts a team of three and normalizes every field", () => {
    const r = registrationSchema.parse({ teamName: "  Null Pointers ", track: "Track A", members: [member(1), member(2), member(3)] });
    expect(r.teamName).toBe("Null Pointers");
    expect(r.members[0]).toEqual({
      firstName: "Member1",
      lastName: "Test",
      regNumber: "RA2611026010691",
      srmEmail: "m1@srmist.edu.in",
      personalEmail: "m1@gmail.com",
      phone: "9876543211",
    });
  });

  it("accepts four members and rejects two or five", () => {
    const base = { teamName: "Null Pointers", track: "Track B" };
    expect(registrationSchema.safeParse({ ...base, members: [1, 2, 3, 4].map(member) }).success).toBe(true);
    expect(registrationSchema.safeParse({ ...base, members: [1, 2].map(member) }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, members: [1, 2, 3, 4, 5].map(member) }).success).toBe(false);
  });

  it("rejects an email outside srmist.edu.in with a helpful message", () => {
    const r = registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [{ ...member(1), srmEmail: "a@gmail.com" }, member(2), member(3)] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Use your @srmist.edu.in email");
    expect(r.error?.issues[0]?.path).toEqual(["members", 0, "srmEmail"]);
  });

  it("rejects malformed registration numbers and phones", () => {
    const bad = registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [{ ...member(1), regNumber: "RA123" }, { ...member(2), phone: "12345" }, member(3)] });
    expect(bad.error?.issues.map((i) => i.path.join("."))).toEqual(["members.0.regNumber", "members.1.phone"]);
  });

  it("rejects the same registration number or SRM email twice in one team", () => {
    const dup = registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [member(1), { ...member(2), regNumber: "RA2611026010691" }, { ...member(3), srmEmail: "m1@srmist.edu.in" }] });
    expect(dup.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["members.1.regNumber", "Each member needs a different registration number"],
      ["members.2.srmEmail", "Each member needs a different SRM email"],
    ]);
  });

  it("rejects an unknown track", () => {
    expect(registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track Z", members: [1, 2, 3].map(member) }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("teamNameKey ignores case and extra spaces", () => {
    expect(teamNameKey("  Null   POINTERS ")).toBe("null pointers");
  });
  it("otpCodeSchema accepts exactly six digits", () => {
    expect(otpCodeSchema.safeParse(" 012345 ").success).toBe(true);
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
  });
  it("phoneSchema strips spaces, hyphens and +91", () => {
    expect(phoneSchema.parse("+91 98765-43210")).toBe("9876543210");
  });
});
```

`packages/core/src/diff.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyChanges, diffTeam, type TeamSnapshot } from "./diff";

const snap: TeamSnapshot = {
  teamName: "Null Pointers",
  track: "Track A",
  members: [
    { id: "m1", firstName: "A", lastName: "One", regNumber: "RA2611026010691", srmEmail: "a@srmist.edu.in", personalEmail: "a@gmail.com", phone: "9876543211" },
    { id: "m2", firstName: "B", lastName: "Two", regNumber: "RA2611026010692", srmEmail: "b@srmist.edu.in", personalEmail: "b@gmail.com", phone: "9876543212" },
  ],
};

describe("diffTeam", () => {
  it("returns nothing when nothing changed", () => {
    expect(diffTeam(snap, structuredClone(snap))).toEqual([]);
  });
  it("lists team and member field changes with stable paths", () => {
    const next = structuredClone(snap);
    next.teamName = "Segfaults";
    next.members[1]!.phone = "9000000000";
    expect(diffTeam(snap, next)).toEqual([
      { path: "teamName", from: "Null Pointers", to: "Segfaults" },
      { path: "members.m2.phone", from: "9876543212", to: "9000000000" },
    ]);
  });
});

describe("applyChanges", () => {
  it("applies a diff and leaves the original untouched", () => {
    const next = structuredClone(snap);
    next.track = "Track C";
    next.members[0]!.lastName = "Uno";
    const applied = applyChanges(snap, diffTeam(snap, next));
    expect(applied).toEqual(next);
    expect(snap.track).toBe("Track A");
  });
  it("throws on a path that does not exist", () => {
    expect(() => applyChanges(snap, [{ path: "members.m9.phone", from: "", to: "1" }])).toThrow("Unknown member m9");
  });
});
```

`packages/core/src/server/secrets.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { generateOtpCode, generateToken, hashOtp, hashToken, otpExpiry, safeEqualHex, sessionExpiry } from "./secrets";

describe("secrets", () => {
  it("generates six-digit codes, including leading zeros", () => {
    for (let i = 0; i < 200; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it("binds an OTP hash to the email", () => {
    expect(hashOtp("a@srmist.edu.in", "123456")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp("a@srmist.edu.in", "123456")).not.toBe(hashOtp("b@srmist.edu.in", "123456"));
  });
  it("generates unguessable tokens and stable hashes", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
  });
  it("compares hex digests safely", () => {
    const h = hashToken("x");
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashToken("y"))).toBe(false);
    expect(safeEqualHex(h, "short")).toBe(false);
  });
  it("computes expiries from the rules", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(otpExpiry(now).toISOString()).toBe("2026-10-01T10:10:00.000Z");
    expect(sessionExpiry(now).toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @pandora/core test`
Expected: FAIL: cannot resolve `./rules`, `./diff`, `./secrets`.

- [ ] **Step 4: Implement**

`packages/core/src/config.ts`:
```ts
export const TRACKS = ["Track A", "Track B", "Track C", "Track D"] as const;
export type Track = (typeof TRACKS)[number];

export const TEAM_SIZE = { min: 3, max: 4 } as const;
export const SRM_EMAIL_DOMAIN = "srmist.edu.in";
export const OTP = { length: 6, ttlMinutes: 10, maxAttempts: 5, resendSeconds: 60 } as const;
export const SESSION_DAYS = 7;

const MB = 1024 * 1024;
export const UPLOADS = {
  photo: { maxBytes: 5 * MB, types: ["image/jpeg", "image/png", "image/webp"] },
  paymentProof: { maxBytes: 5 * MB, types: ["image/jpeg", "image/png"] },
} as const;
```

`packages/core/src/rules.ts`:
```ts
import { z } from "zod";
import { SRM_EMAIL_DOMAIN, TEAM_SIZE, TRACKS } from "./config";

export const personalEmailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
export const srmEmailSchema = personalEmailSchema.refine(
  (email) => email.endsWith(`@${SRM_EMAIL_DOMAIN}`),
  `Use your @${SRM_EMAIL_DOMAIN} email`,
);
export const regNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^RA\d{13}$/, "Registration numbers look like RA2611026010690");
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+91/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"));
export const nameSchema = z.string().trim().min(1, "Required").max(50, "At most 50 characters");
export const teamNameSchema = z.string().trim().min(3, "At least 3 characters").max(40, "At most 40 characters");
export const trackSchema = z.enum(TRACKS, "Pick one of the tracks");
export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const memberSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  regNumber: regNumberSchema,
  srmEmail: srmEmailSchema,
  personalEmail: personalEmailSchema,
  phone: phoneSchema,
});
export type MemberInput = z.input<typeof memberSchema>;
export type Member = z.output<typeof memberSchema>;

export const registrationSchema = z
  .object({
    teamName: teamNameSchema,
    track: trackSchema,
    members: z.array(memberSchema).min(TEAM_SIZE.min, `A team has at least ${TEAM_SIZE.min} members`).max(TEAM_SIZE.max, `A team has at most ${TEAM_SIZE.max} members`),
  })
  .superRefine((reg, ctx) => {
    const seen = { regNumber: new Set<string>(), srmEmail: new Set<string>() };
    reg.members.forEach((m, i) => {
      if (seen.regNumber.has(m.regNumber)) {
        ctx.addIssue({ code: "custom", path: ["members", i, "regNumber"], message: "Each member needs a different registration number" });
      }
      if (seen.srmEmail.has(m.srmEmail)) {
        ctx.addIssue({ code: "custom", path: ["members", i, "srmEmail"], message: "Each member needs a different SRM email" });
      }
      seen.regNumber.add(m.regNumber);
      seen.srmEmail.add(m.srmEmail);
    });
  });
export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

export function teamNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
```

`packages/core/src/diff.ts`:
```ts
import type { Track } from "./config";
import type { Member } from "./rules";

export type TeamSnapshot = { teamName: string; track: Track; members: Array<{ id: string } & Member> };
export type FieldChange = { path: string; from: string; to: string };

const MEMBER_FIELDS = ["firstName", "lastName", "regNumber", "srmEmail", "personalEmail", "phone"] as const;
type MemberField = (typeof MEMBER_FIELDS)[number];

export function diffTeam(current: TeamSnapshot, proposed: TeamSnapshot): FieldChange[] {
  const changes: FieldChange[] = [];
  if (current.teamName !== proposed.teamName) changes.push({ path: "teamName", from: current.teamName, to: proposed.teamName });
  if (current.track !== proposed.track) changes.push({ path: "track", from: current.track, to: proposed.track });
  for (const before of current.members) {
    const after = proposed.members.find((m) => m.id === before.id);
    if (!after) continue;
    for (const field of MEMBER_FIELDS) {
      if (before[field] !== after[field]) changes.push({ path: `members.${before.id}.${field}`, from: before[field], to: after[field] });
    }
  }
  return changes;
}

export function applyChanges(snapshot: TeamSnapshot, changes: FieldChange[]): TeamSnapshot {
  const next = structuredClone(snapshot);
  for (const change of changes) {
    if (change.path === "teamName") next.teamName = change.to;
    else if (change.path === "track") next.track = change.to as Track;
    else {
      const [, id, field] = change.path.split(".");
      const member = next.members.find((m) => m.id === id);
      if (!member) throw new Error(`Unknown member ${id}`);
      if (!MEMBER_FIELDS.includes(field as MemberField)) throw new Error(`Unknown field ${field}`);
      member[field as MemberField] = change.to;
    }
  }
  return next;
}
```

`packages/core/src/server/secrets.ts`:
```ts
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { OTP, SESSION_DAYS } from "../config";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP.length).toString().padStart(OTP.length, "0");
}
export function hashOtp(email: string, code: string): string {
  return sha256(`${email}:${code}`);
}
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token: string): string {
  return sha256(token);
}
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export function otpExpiry(now: Date): Date {
  return new Date(now.getTime() + OTP.ttlMinutes * 60_000);
}
export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60_000);
}
```

`packages/core/src/server/index.ts`:
```ts
export { generateOtpCode, generateToken, hashOtp, hashToken, otpExpiry, safeEqualHex, sessionExpiry } from "./secrets";
```

`packages/core/src/index.ts`:
```ts
export { pageTitle, siteConfig } from "./site";
export { OTP, SESSION_DAYS, SRM_EMAIL_DOMAIN, TEAM_SIZE, TRACKS, UPLOADS, type Track } from "./config";
export {
  memberSchema,
  nameSchema,
  otpCodeSchema,
  personalEmailSchema,
  phoneSchema,
  regNumberSchema,
  registrationSchema,
  srmEmailSchema,
  teamNameKey,
  teamNameSchema,
  trackSchema,
  type Member,
  type MemberInput,
  type Registration,
  type RegistrationInput,
} from "./rules";
export { applyChanges, diffTeam, type FieldChange, type TeamSnapshot } from "./diff";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @pandora/core test && pnpm --filter @pandora/core typecheck && pnpm --filter @pandora/core lint`
Expected: PASS (existing 4 + new tests); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "Add registration rules, edit-request diff and secret helpers to core"
```

---

### Task 2: Data model, client and test database in `@pandora/db`

**Files:**
- Modify: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`, `packages/db/AGENTS.md`, `scripts/check-boundaries.mjs` (add `@electric-sql/pglite` to `DB_DRIVERS`)
- Create: `packages/db/drizzle.config.ts`, `packages/db/vitest.config.ts`, `packages/db/src/schema/enums.ts`, `teams.ts`, `members.ts`, `auth.ts`, `staff.ts`, `reviews.ts`, `notifications.ts`, `submissions.ts`, `checkin.ts`, `admin-actions.ts`, `index.ts` (all under `src/schema/`), `packages/db/src/client.ts`, `packages/db/src/test-utils.ts`, `packages/db/drizzle/` (generated)
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Consumes: `type FieldChange` from `@pandora/core`.
- Produces: `import { getDb, createDb, type Db } from "@pandora/db"`; `import * as schema from "@pandora/db/schema"` exposing tables `teams, members, emailOtps, sessions, staff, paymentProofs, editRequests, notifications, notificationReads, submissions, checkinPasses, attendance, adminActions` and enums `paymentStatus, shortlistStatus, otpPurpose, sessionSubject, staffRole, reviewStatus`; `import { createTestDb } from "@pandora/db/test-utils"` returning `Promise<Db>`.

- [ ] **Step 1: Dependencies and config**

`packages/db/package.json` becomes:
```json
{
  "name": "@pandora/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./test-utils": "./src/test-utils.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "generate": "drizzle-kit generate",
    "migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@pandora/core": "workspace:*",
    "drizzle-orm": "^0.45.0",
    "pg": "^8.23.0"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.5.0",
    "@pandora/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.23.0",
    "drizzle-kit": "^0.31.0",
    "eslint": "^9.0.0",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```
(`postgres` is removed; `pg` replaces it.)

`packages/db/tsconfig.json`:
```json
{ "extends": "@pandora/config/tsconfig.base.json", "include": ["src", "drizzle.config.ts", "vitest.config.ts"] }
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

`packages/db/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node", testTimeout: 30_000 } });
```

In `scripts/check-boundaries.mjs` change `const DB_DRIVERS = ["drizzle-orm", "drizzle-kit", "postgres", "pg"];` to `const DB_DRIVERS = ["drizzle-orm", "drizzle-kit", "postgres", "pg", "@electric-sql/pglite"];`.

Run `pnpm install`.

- [ ] **Step 2: Write the schema**

`packages/db/src/schema/enums.ts`:
```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const paymentStatus = pgEnum("payment_status", ["not_required", "pending", "approved", "declined"]);
export const shortlistStatus = pgEnum("shortlist_status", ["pending", "shortlisted", "not_shortlisted"]);
export const otpPurpose = pgEnum("otp_purpose", ["registration", "participant_sign_in", "staff_sign_in"]);
export const sessionSubject = pgEnum("session_subject", ["member", "staff"]);
export const staffRole = pgEnum("staff_role", ["admin", "staff"]);
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "declined"]);
```

`packages/db/src/schema/teams.ts`:
```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { paymentStatus, shortlistStatus } from "./enums";

export const teams = pgTable("teams", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  nameKey: text().notNull().unique(),
  track: text().notNull(),
  paymentStatus: paymentStatus().notNull().default("not_required"),
  shortlistStatus: shortlistStatus().notNull().default("pending"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

`packages/db/src/schema/members.ts`:
```ts
import { boolean, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { teams } from "./teams";

export const members = pgTable(
  "members",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid().notNull().references(() => teams.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    isLeader: boolean().notNull().default(false),
    firstName: text().notNull(),
    lastName: text().notNull(),
    regNumber: text().notNull().unique(),
    srmEmail: text().notNull().unique(),
    personalEmail: text().notNull(),
    phone: text().notNull(),
    photoPath: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("members_team_position").on(t.teamId, t.position)],
);
```

`packages/db/src/schema/staff.ts`:
```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { staffRole } from "./enums";

export const staff = pgTable("staff", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text().notNull(),
  role: staffRole().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
```

`packages/db/src/schema/auth.ts`:
```ts
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { otpPurpose, sessionSubject } from "./enums";

export const emailOtps = pgTable(
  "email_otps",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    purpose: otpPurpose().notNull(),
    codeHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    attempts: integer().notNull().default(0),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_otps_lookup").on(t.email, t.purpose, t.createdAt)],
);

export const sessions = pgTable("sessions", {
  tokenHash: text().primaryKey(),
  subjectType: sessionSubject().notNull(),
  subjectId: uuid().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
```

`packages/db/src/schema/reviews.ts`:
```ts
import type { FieldChange } from "@pandora/core";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { reviewStatus } from "./enums";
import { members } from "./members";
import { staff } from "./staff";
import { teams } from "./teams";

export const paymentProofs = pgTable("payment_proofs", {
  id: uuid().primaryKey().defaultRandom(),
  teamId: uuid().notNull().references(() => teams.id, { onDelete: "cascade" }),
  filePath: text().notNull(),
  status: reviewStatus().notNull().default("pending"),
  reviewedBy: uuid().references(() => staff.id),
  reviewedAt: timestamp({ withTimezone: true }),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const editRequests = pgTable("edit_requests", {
  id: uuid().primaryKey().defaultRandom(),
  teamId: uuid().notNull().references(() => teams.id, { onDelete: "cascade" }),
  requestedBy: uuid().notNull().references(() => members.id, { onDelete: "cascade" }),
  changes: jsonb().$type<FieldChange[]>().notNull(),
  status: reviewStatus().notNull().default("pending"),
  reviewedBy: uuid().references(() => staff.id),
  reviewedAt: timestamp({ withTimezone: true }),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
```

`packages/db/src/schema/notifications.ts`:
```ts
import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { members } from "./members";
import { staff } from "./staff";
import { teams } from "./teams";

export const notifications = pgTable("notifications", {
  id: uuid().primaryKey().defaultRandom(),
  teamId: uuid().references(() => teams.id, { onDelete: "cascade" }),
  title: text().notNull(),
  body: text().notNull(),
  createdBy: uuid().notNull().references(() => staff.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const notificationReads = pgTable(
  "notification_reads",
  {
    notificationId: uuid().notNull().references(() => notifications.id, { onDelete: "cascade" }),
    memberId: uuid().notNull().references(() => members.id, { onDelete: "cascade" }),
    readAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.notificationId, t.memberId] })],
);
```

`packages/db/src/schema/submissions.ts`:
```ts
import { integer, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { teams } from "./teams";

export const submissions = pgTable(
  "submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid().notNull().references(() => teams.id, { onDelete: "cascade" }),
    episode: smallint().notNull().default(0),
    repoUrl: text(),
    demoUrl: text(),
    notes: text(),
    submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    score: integer(),
    reviewNote: text(),
  },
  (t) => [unique("submissions_team_episode").on(t.teamId, t.episode)],
);
```

`packages/db/src/schema/checkin.ts`:
```ts
import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { members } from "./members";
import { staff } from "./staff";

export const checkinPasses = pgTable("checkin_passes", {
  id: uuid().primaryKey().defaultRandom(),
  memberId: uuid().notNull().unique().references(() => members.id, { onDelete: "cascade" }),
  tokenHash: text().notNull().unique(),
  issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp({ withTimezone: true }),
});

export const attendance = pgTable(
  "attendance",
  {
    id: uuid().primaryKey().defaultRandom(),
    memberId: uuid().notNull().references(() => members.id, { onDelete: "cascade" }),
    event: text().notNull().default("episode_1"),
    checkedInAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    checkedInBy: uuid().notNull().references(() => staff.id),
  },
  (t) => [unique("attendance_member_event").on(t.memberId, t.event)],
);
```

`packages/db/src/schema/admin-actions.ts`:
```ts
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { staff } from "./staff";

export const adminActions = pgTable("admin_actions", {
  id: uuid().primaryKey().defaultRandom(),
  staffId: uuid().notNull().references(() => staff.id),
  action: text().notNull(),
  targetType: text().notNull(),
  targetId: text().notNull(),
  detail: jsonb().$type<Record<string, unknown>>(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
```

`packages/db/src/schema/index.ts`:
```ts
export * from "./enums";
export * from "./teams";
export * from "./members";
export * from "./staff";
export * from "./auth";
export * from "./reviews";
export * from "./notifications";
export * from "./submissions";
export * from "./checkin";
export * from "./admin-actions";
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @pandora/db generate`
Expected: creates `packages/db/drizzle/0000_*.sql` and `packages/db/drizzle/meta/`. The SQL contains `CREATE TABLE` for all 13 tables and the 6 enums. No database connection is needed.

- [ ] **Step 4: Client and test database**

`packages/db/src/client.ts`:
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(url: string): Db {
  return drizzle({ connection: { connectionString: url, max: 5 }, schema, casing: "snake_case" });
}

let cached: Db | undefined;

// Lazily created so `next build` works without DATABASE_URL; the first query needs it.
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to this app's .env.local (ask Ojas for the dev database URL).");
  }
  cached = createDb(url);
  return cached;
}
```

`packages/db/src/test-utils.ts`:
```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

// A fresh in-memory Postgres with every migration applied. One per test file (or per test when isolation matters).
export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}
```

`packages/db/src/index.ts`:
```ts
export { createDb, getDb, type Db } from "./client";
```

- [ ] **Step 5: Write the schema test and run it**

`packages/db/src/schema.test.ts`:
```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./client";
import { members, teams } from "./schema";
import { createTestDb } from "./test-utils";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const member = (teamId: string, n: number) => ({
  teamId,
  position: n,
  isLeader: n === 1,
  firstName: `M${n}`,
  lastName: "Test",
  regNumber: `RA261102601069${n}`,
  srmEmail: `m${n}@srmist.edu.in`,
  personalEmail: `m${n}@gmail.com`,
  phone: `987654321${n}`,
});

describe("schema", () => {
  it("stores a team with its members and defaults", async () => {
    const [team] = await db.insert(teams).values({ name: "Null Pointers", nameKey: "null pointers", track: "Track A" }).returning();
    await db.insert(members).values([member(team!.id, 1), member(team!.id, 2), member(team!.id, 3)]);
    const rows = await db.select().from(members).where(eq(members.teamId, team!.id));
    expect(rows).toHaveLength(3);
    expect(team!.paymentStatus).toBe("not_required");
    expect(team!.shortlistStatus).toBe("pending");
  });

  it("rejects a second team with the same name key", async () => {
    await db.insert(teams).values({ name: "Null Pointers", nameKey: "null pointers", track: "Track A" });
    await expect(db.insert(teams).values({ name: "NULL pointers", nameKey: "null pointers", track: "Track B" })).rejects.toThrow();
  });

  it("rejects a registration number or SRM email already used by another member", async () => {
    const [a] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    const [b] = await db.insert(teams).values({ name: "B", nameKey: "b", track: "Track A" }).returning();
    await db.insert(members).values(member(a!.id, 1));
    await expect(db.insert(members).values({ ...member(b!.id, 1), srmEmail: "other@srmist.edu.in" })).rejects.toThrow();
    await expect(db.insert(members).values({ ...member(b!.id, 1), regNumber: "RA2611026010699" })).rejects.toThrow();
  });

  it("deletes members with their team", async () => {
    const [team] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    await db.insert(members).values(member(team!.id, 1));
    await db.delete(teams).where(eq(teams.id, team!.id));
    expect(await db.select().from(members)).toHaveLength(0);
  });
});
```

Run: `pnpm --filter @pandora/db test && pnpm --filter @pandora/db typecheck && pnpm --filter @pandora/db lint && pnpm lint`
Expected: 4 tests pass; typecheck, lint and the boundary check pass.

- [ ] **Step 6: Update the area guide**

Replace the last bullet of `packages/db/AGENTS.md` (the "Known issue from msa-auth" bullet) with:
```markdown
- The driver is `pg` (node-postgres). Write queries against the `Db` type from `./client`, never a driver-specific
  type, so the same code runs in tests (PGlite) and in the apps (`pg`).
- Tests use `createTestDb()` from `@pandora/db/test-utils`: an in-memory Postgres with every migration applied. Never
  point tests at a real database.
- Put a flow's queries in `src/queries/<flow>.ts` (`registration`, `participant`, `admin`, `checkin`), so flow owners
  rarely touch the same file.
```

- [ ] **Step 7: Commit**

```bash
git add packages/db scripts/check-boundaries.mjs pnpm-lock.yaml
git commit -m "Add the data model, migrations, pg client and PGlite test database"
```

---

### Task 3: OTP and session queries in `@pandora/db`

**Files:**
- Create: `packages/db/src/queries/auth.ts`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/queries/auth.test.ts`

**Interfaces:**
- Consumes: `Db`, `createTestDb`, tables `emailOtps`, `sessions`, `members`, `staff`; `OTP` from `@pandora/core`; `generateOtpCode`, `hashOtp`, `generateToken`, `hashToken`, `safeEqualHex`, `otpExpiry`, `sessionExpiry` from `@pandora/core/server`.
- Produces (exported from `@pandora/db`):
  - `type OtpPurpose = "registration" | "participant_sign_in" | "staff_sign_in"`
  - `issueOtp(db, { email, purpose, now? }): Promise<{ ok: true; code: string } | { ok: false; reason: "too_soon"; retryAfterSeconds: number }>`
  - `verifyOtp(db, { email, purpose, code, now? }): Promise<{ ok: true } | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "invalid" }>`
  - `createSession(db, { subjectType: "member" | "staff", subjectId, now? }): Promise<{ token: string; expiresAt: Date }>`
  - `getSession(db, token, now?): Promise<{ subjectType: "member" | "staff"; subjectId: string; expiresAt: Date } | null>`
  - `revokeSession(db, token): Promise<void>`
  - `findMemberByEmail(db, email): Promise<typeof members.$inferSelect | null>`
  - `findStaffByEmail(db, email): Promise<typeof staff.$inferSelect | null>`
  Callers pass emails already normalized by the core schemas.

- [ ] **Step 1: Add `@pandora/core` to the db package's workspace resolution**

Already a dependency since Task 2. Confirm `import { OTP } from "@pandora/core"` resolves: `pnpm --filter @pandora/db typecheck`.

- [ ] **Step 2: Write the failing tests**

`packages/db/src/queries/auth.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { members, staff, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { createSession, findMemberByEmail, findStaffByEmail, getSession, issueOtp, revokeSession, verifyOtp } from "./auth";

let db: Db;
const email = "m1@srmist.edu.in";
const t0 = new Date("2026-10-01T10:00:00Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

beforeEach(async () => {
  db = await createTestDb();
});

describe("issueOtp", () => {
  it("issues a six-digit code", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(r.ok && r.code).toMatch(/^\d{6}$/);
  });
  it("refuses a second code within 60 seconds, then allows it", async () => {
    await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(await issueOtp(db, { email, purpose: "registration", now: at(30) })).toEqual({ ok: false, reason: "too_soon", retryAfterSeconds: 30 });
    expect((await issueOtp(db, { email, purpose: "registration", now: at(60) })).ok).toBe(true);
  });
  it("keeps purposes separate", async () => {
    await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect((await issueOtp(db, { email, purpose: "participant_sign_in", now: at(1) })).ok).toBe(true);
  });
});

describe("verifyOtp", () => {
  it("accepts the right code once", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    const code = r.ok ? r.code : "";
    expect(await verifyOtp(db, { email, purpose: "registration", code, now: at(5) })).toEqual({ ok: true });
    expect(await verifyOtp(db, { email, purpose: "registration", code, now: at(6) })).toEqual({ ok: false, reason: "not_found" });
  });
  it("only honours the newest code", async () => {
    const first = await issueOtp(db, { email, purpose: "registration", now: t0 });
    await issueOtp(db, { email, purpose: "registration", now: at(61) });
    expect(await verifyOtp(db, { email, purpose: "registration", code: first.ok ? first.code : "", now: at(62) })).toEqual({ ok: false, reason: "invalid" });
  });
  it("expires after 10 minutes", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(await verifyOtp(db, { email, purpose: "registration", code: r.ok ? r.code : "", now: at(601) })).toEqual({ ok: false, reason: "expired" });
  });
  it("locks after 5 wrong attempts, even for the right code", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    const wrong = r.ok && r.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      expect(await verifyOtp(db, { email, purpose: "registration", code: wrong, now: at(1) })).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await verifyOtp(db, { email, purpose: "registration", code: r.ok ? r.code : "", now: at(2) })).toEqual({ ok: false, reason: "too_many_attempts" });
  });
  it("reports not_found when no code was issued", async () => {
    expect(await verifyOtp(db, { email, purpose: "staff_sign_in", code: "123456", now: t0 })).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("sessions", () => {
  it("creates, reads and revokes a session", async () => {
    const subjectId = "00000000-0000-4000-8000-000000000001";
    const { token, expiresAt } = await createSession(db, { subjectType: "member", subjectId, now: t0 });
    expect(expiresAt.toISOString()).toBe("2026-10-08T10:00:00.000Z");
    expect(await getSession(db, token, at(10))).toEqual({ subjectType: "member", subjectId, expiresAt });
    await revokeSession(db, token);
    expect(await getSession(db, token, at(11))).toBeNull();
  });
  it("treats an expired or unknown session as signed out", async () => {
    const { token } = await createSession(db, { subjectType: "staff", subjectId: "00000000-0000-4000-8000-000000000002", now: t0 });
    expect(await getSession(db, token, new Date("2026-10-08T10:00:01Z"))).toBeNull();
    expect(await getSession(db, "not-a-token", t0)).toBeNull();
  });
});

describe("lookups", () => {
  it("finds members and staff by email", async () => {
    const [team] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    await db.insert(members).values({ teamId: team!.id, position: 1, isLeader: true, firstName: "A", lastName: "B", regNumber: "RA2611026010691", srmEmail: email, personalEmail: "a@gmail.com", phone: "9876543211" });
    await db.insert(staff).values({ email: "admin@srmist.edu.in", name: "Admin", role: "admin" });
    expect((await findMemberByEmail(db, email))?.teamId).toBe(team!.id);
    expect((await findStaffByEmail(db, "admin@srmist.edu.in"))?.role).toBe("admin");
    expect(await findMemberByEmail(db, "nobody@srmist.edu.in")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @pandora/db test`
Expected: FAIL: cannot resolve `./auth`.

- [ ] **Step 4: Implement**

`packages/db/src/queries/auth.ts`:
```ts
import { OTP } from "@pandora/core";
import { generateOtpCode, generateToken, hashOtp, hashToken, otpExpiry, safeEqualHex, sessionExpiry } from "@pandora/core/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { emailOtps, members, sessions, staff } from "../schema";

export type OtpPurpose = "registration" | "participant_sign_in" | "staff_sign_in";

async function latestOpenOtp(db: Db, email: string, purpose: OtpPurpose) {
  const [row] = await db
    .select()
    .from(emailOtps)
    .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose), isNull(emailOtps.consumedAt)))
    .orderBy(desc(emailOtps.createdAt))
    .limit(1);
  return row ?? null;
}

export async function issueOtp(
  db: Db,
  { email, purpose, now = new Date() }: { email: string; purpose: OtpPurpose; now?: Date },
): Promise<{ ok: true; code: string } | { ok: false; reason: "too_soon"; retryAfterSeconds: number }> {
  const previous = await latestOpenOtp(db, email, purpose);
  if (previous) {
    const elapsed = Math.floor((now.getTime() - previous.createdAt.getTime()) / 1000);
    if (elapsed < OTP.resendSeconds) return { ok: false, reason: "too_soon", retryAfterSeconds: OTP.resendSeconds - elapsed };
  }
  const code = generateOtpCode();
  await db.transaction(async (tx) => {
    await tx
      .update(emailOtps)
      .set({ consumedAt: now })
      .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose), isNull(emailOtps.consumedAt)));
    await tx.insert(emailOtps).values({ email, purpose, codeHash: hashOtp(email, code), expiresAt: otpExpiry(now), createdAt: now });
  });
  return { ok: true, code };
}

export async function verifyOtp(
  db: Db,
  { email, purpose, code, now = new Date() }: { email: string; purpose: OtpPurpose; code: string; now?: Date },
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "invalid" }> {
  const row = await latestOpenOtp(db, email, purpose);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (row.attempts >= OTP.maxAttempts) return { ok: false, reason: "too_many_attempts" };
  if (!safeEqualHex(row.codeHash, hashOtp(email, code))) {
    await db.update(emailOtps).set({ attempts: row.attempts + 1 }).where(eq(emailOtps.id, row.id));
    return { ok: false, reason: "invalid" };
  }
  await db.update(emailOtps).set({ consumedAt: now }).where(eq(emailOtps.id, row.id));
  return { ok: true };
}

export async function createSession(
  db: Db,
  { subjectType, subjectId, now = new Date() }: { subjectType: "member" | "staff"; subjectId: string; now?: Date },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = sessionExpiry(now);
  await db.insert(sessions).values({ tokenHash: hashToken(token), subjectType, subjectId, expiresAt, createdAt: now });
  return { token, expiresAt };
}

export async function getSession(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<{ subjectType: "member" | "staff"; subjectId: string; expiresAt: Date } | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(token))).limit(1);
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return { subjectType: row.subjectType, subjectId: row.subjectId, expiresAt: row.expiresAt };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function findMemberByEmail(db: Db, email: string) {
  const [row] = await db.select().from(members).where(eq(members.srmEmail, email)).limit(1);
  return row ?? null;
}

export async function findStaffByEmail(db: Db, email: string) {
  const [row] = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
  return row ?? null;
}
```

`packages/db/src/index.ts`:
```ts
export { createDb, getDb, type Db } from "./client";
export {
  createSession,
  findMemberByEmail,
  findStaffByEmail,
  getSession,
  issueOtp,
  revokeSession,
  verifyOtp,
  type OtpPurpose,
} from "./queries/auth";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @pandora/db test && pnpm --filter @pandora/db typecheck && pnpm --filter @pandora/db lint`
Expected: PASS (4 schema + 11 auth tests).

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "Add OTP issue/verify and session queries"
```

---

### Task 4: Email sending in `@pandora/email`

**Files:**
- Modify: `packages/email/package.json`, `packages/email/tsconfig.json`, `packages/email/src/index.ts`
- Create: `packages/email/vitest.config.ts`, `packages/email/src/transport.ts`, `packages/email/src/templates/otp-code.tsx`, `packages/email/src/registry.ts`, `packages/email/src/send.ts`
- Test: `packages/email/src/send.test.ts`

**Interfaces:**
- Produces (from `@pandora/email`): `type MailMessage = { from: string; to: string; subject: string; html: string; text: string }`, `type MailTransport = { send(msg: MailMessage): Promise<{ id: string }> }`, `fileTransport(path: string): MailTransport`, `resendTransport(apiKey: string): MailTransport`, `type TemplateName`, `type TemplateProps<T>`, `sendEmail<T extends TemplateName>(input: { to: string; template: T; props: TemplateProps<T> }, options?: { transport?: MailTransport }): Promise<{ ok: true; id: string } | { ok: false; error: string }>`.
- Environment: `MAIL_TRANSPORT` (`file` default | `resend`), `MAIL_OUTBOX_PATH` (default `.mail/outbox.jsonl`), `RESEND_API_KEY`, `EMAIL_FROM` (default `MSA Pandora <pandora@recruitments.msasrm.in>`), `MAIL_ALLOWLIST` (comma-separated; when set, other recipients are skipped).
- Template `"otp-code"` props: `{ code: string; purpose: "registration" | "participant_sign_in" | "staff_sign_in" }`. Flows add templates by adding a file under `templates/` and one line in `registry.ts`.

- [ ] **Step 1: Package setup**

`packages/email/package.json`:
```json
{
  "name": "@pandora/email",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@react-email/components": "^1.0.0",
    "@react-email/render": "^2.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "resend": "^6.0.0"
  },
  "devDependencies": {
    "@pandora/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "eslint": "^9.0.0",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0"
  }
}
```

`packages/email/tsconfig.json`:
```json
{ "extends": "@pandora/config/tsconfig.react-library.json", "include": ["src", "vitest.config.ts"] }
```

`packages/email/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ esbuild: { jsx: "automatic" }, test: { environment: "node" } });
```

Run `pnpm install`.

- [ ] **Step 2: Write the failing test**

`packages/email/src/send.test.ts`:
```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sendEmail } from "./send";
import { fileTransport, type MailMessage, type MailTransport } from "./transport";

const captured: MailMessage[] = [];
const capture: MailTransport = { async send(msg) { captured.push(msg); return { id: `t${captured.length}` }; } };

afterEach(() => {
  captured.length = 0;
  delete process.env.MAIL_ALLOWLIST;
});

describe("sendEmail", () => {
  it("renders the OTP email with the code in subject, html and text", async () => {
    const r = await sendEmail({ to: "m1@srmist.edu.in", template: "otp-code", props: { code: "042917", purpose: "registration" } }, { transport: capture });
    expect(r).toEqual({ ok: true, id: "t1" });
    const msg = captured[0]!;
    expect(msg.to).toBe("m1@srmist.edu.in");
    expect(msg.from).toBe("MSA Pandora <pandora@recruitments.msasrm.in>");
    expect(msg.subject).toBe("042917 is your MSA Pandora registration code");
    expect(msg.html).toContain("042917");
    expect(msg.text).toContain("042917");
    expect(msg.text).toContain("10 minutes");
  });

  it("skips recipients outside MAIL_ALLOWLIST", async () => {
    process.env.MAIL_ALLOWLIST = "ok@srmist.edu.in";
    const r = await sendEmail({ to: "other@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "participant_sign_in" } }, { transport: capture });
    expect(r).toEqual({ ok: true, id: "skipped-not-allowlisted" });
    expect(captured).toHaveLength(0);
  });

  it("returns an error instead of throwing when the transport fails", async () => {
    const broken: MailTransport = { async send() { throw new Error("smtp down"); } };
    const r = await sendEmail({ to: "a@srmist.edu.in", template: "otp-code", props: { code: "123456", purpose: "staff_sign_in" } }, { transport: broken });
    expect(r).toEqual({ ok: false, error: "smtp down" });
  });
});

describe("fileTransport", () => {
  it("appends one JSON line per message", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "mail-")), "outbox.jsonl");
    const t = fileTransport(file);
    await t.send({ from: "f", to: "a", subject: "s1", html: "<p>1</p>", text: "1" });
    await t.send({ from: "f", to: "b", subject: "s2", html: "<p>2</p>", text: "2" });
    const lines = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.subject)).toEqual(["s1", "s2"]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @pandora/email test`
Expected: FAIL: cannot resolve `./send`.

- [ ] **Step 4: Implement**

`packages/email/src/transport.ts`:
```ts
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Resend } from "resend";

export type MailMessage = { from: string; to: string; subject: string; html: string; text: string };
export type MailTransport = { send(msg: MailMessage): Promise<{ id: string }> };

// Local development and tests: one JSON line per message instead of sending anything.
export function fileTransport(path: string): MailTransport {
  return {
    async send(msg) {
      mkdirSync(dirname(path), { recursive: true });
      const id = crypto.randomUUID();
      appendFileSync(path, JSON.stringify({ id, at: new Date().toISOString(), ...msg }) + "\n");
      return { id };
    },
  };
}

export function resendTransport(apiKey: string): MailTransport {
  const resend = new Resend(apiKey);
  return {
    async send(msg) {
      const { data, error } = await resend.emails.send(msg);
      if (error) throw new Error(error.message);
      return { id: data?.id ?? "" };
    },
  };
}
```

`packages/email/src/templates/otp-code.tsx`:
```tsx
import { Body, Container, Heading, Html, Preview, Text } from "@react-email/components";

export type OtpCodeProps = { code: string; purpose: "registration" | "participant_sign_in" | "staff_sign_in" };

const PURPOSE_LABEL: Record<OtpCodeProps["purpose"], string> = {
  registration: "registration",
  participant_sign_in: "sign-in",
  staff_sign_in: "staff sign-in",
};

export const otpCode = {
  subject: (p: OtpCodeProps) => `${p.code} is your MSA Pandora ${PURPOSE_LABEL[p.purpose]} code`,
  text: (p: OtpCodeProps) =>
    `Your MSA Pandora ${PURPOSE_LABEL[p.purpose]} code is ${p.code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
  html: (p: OtpCodeProps) => (
    <Html>
      <Preview>{`Your code is ${p.code}`}</Preview>
      <Body style={{ fontFamily: "system-ui, sans-serif", backgroundColor: "#ffffff" }}>
        <Container style={{ padding: "24px" }}>
          <Heading as="h2">MSA Pandora</Heading>
          <Text>Your {PURPOSE_LABEL[p.purpose]} code:</Text>
          <Text style={{ fontSize: "32px", fontWeight: 600, letterSpacing: "0.2em" }}>{p.code}</Text>
          <Text>It expires in 10 minutes. If you didn&apos;t ask for it, ignore this email.</Text>
        </Container>
      </Body>
    </Html>
  ),
};
```

`packages/email/src/registry.ts`:
```ts
import type { ReactElement } from "react";
import { otpCode } from "./templates/otp-code";

type Template<P> = { subject: (p: P) => string; text: (p: P) => string; html: (p: P) => ReactElement };

// Add a template: create templates/<name>.tsx exporting { subject, text, html }, then add one line here.
export const templates = {
  "otp-code": otpCode,
} satisfies Record<string, Template<never>>;

export type TemplateName = keyof typeof templates;
export type TemplateProps<T extends TemplateName> = Parameters<(typeof templates)[T]["subject"]>[0];
```

`packages/email/src/send.ts`:
```ts
import { render } from "@react-email/render";
import { templates, type TemplateName, type TemplateProps } from "./registry";
import { fileTransport, resendTransport, type MailTransport } from "./transport";

const DEFAULT_FROM = "MSA Pandora <pandora@recruitments.msasrm.in>";

export function getTransport(): MailTransport {
  if (process.env.MAIL_TRANSPORT === "resend") return resendTransport(process.env.RESEND_API_KEY ?? "");
  return fileTransport(process.env.MAIL_OUTBOX_PATH ?? ".mail/outbox.jsonl");
}

export async function sendEmail<T extends TemplateName>(
  input: { to: string; template: T; props: TemplateProps<T> },
  options: { transport?: MailTransport } = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const allowlist = process.env.MAIL_ALLOWLIST?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowlist && allowlist.length > 0 && !allowlist.includes(input.to.toLowerCase())) {
    return { ok: true, id: "skipped-not-allowlisted" };
  }
  const template = templates[input.template];
  const props = input.props as never;
  try {
    const transport = options.transport ?? getTransport();
    const { id } = await transport.send({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: input.to,
      subject: template.subject(props),
      html: await render(template.html(props)),
      text: template.text(props),
    });
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
```

`packages/email/src/index.ts`:
```ts
export { getTransport, sendEmail } from "./send";
export { fileTransport, resendTransport, type MailMessage, type MailTransport } from "./transport";
export { templates, type TemplateName, type TemplateProps } from "./registry";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @pandora/email test && pnpm --filter @pandora/email typecheck && pnpm --filter @pandora/email lint`
Expected: PASS (4 tests); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/email pnpm-lock.yaml
git commit -m "Add email sending with file and Resend transports and the OTP template"
```

---

### Task 5: File storage in `@pandora/db`

**Files:**
- Modify: `packages/db/package.json` (add `@supabase/supabase-js`), `packages/db/src/index.ts`
- Create: `packages/db/src/storage.ts`
- Test: `packages/db/src/storage.test.ts`

**Interfaces:**
- Produces (from `@pandora/db`): `type Storage = { putFile(path: string, data: Uint8Array, contentType: string): Promise<void>; signedUrl(path: string, expiresInSeconds?: number): Promise<string> }`, `diskStorage(rootDir: string): Storage`, `supabaseStorage({ url, secretKey, bucket }): Storage`, `getStorage(): Storage` (Supabase when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set, else local files under `.storage/`), `STORAGE_BUCKET = "pandora-uploads"`.
- Paths are `teams/<teamId>/<kind>/<uuid>.<ext>`; building them is each flow's job.

- [ ] **Step 1: Dependency**

Add `"@supabase/supabase-js": "^2.117.0"` to `dependencies` in `packages/db/package.json`; run `pnpm install`.

- [ ] **Step 2: Write the failing test**

`packages/db/src/storage.test.ts`:
```ts
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diskStorage } from "./storage";

describe("diskStorage", () => {
  it("writes files under the root and returns a file URL for them", async () => {
    const root = mkdtempSync(join(tmpdir(), "storage-"));
    const storage = diskStorage(root);
    await storage.putFile("teams/t1/photo/a.png", new Uint8Array([1, 2, 3]), "image/png");
    const file = join(root, "teams", "t1", "photo", "a.png");
    expect(existsSync(file)).toBe(true);
    expect([...readFileSync(file)]).toEqual([1, 2, 3]);
    expect(await storage.signedUrl("teams/t1/photo/a.png")).toMatch(/^file:\/\//);
  });

  it("refuses paths that escape the root", async () => {
    const storage = diskStorage(mkdtempSync(join(tmpdir(), "storage-")));
    await expect(storage.putFile("../evil.txt", new Uint8Array([1]), "text/plain")).rejects.toThrow("Invalid storage path");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @pandora/db test storage`
Expected: FAIL: cannot resolve `./storage`.

- [ ] **Step 4: Implement**

`packages/db/src/storage.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STORAGE_BUCKET = "pandora-uploads";

export type Storage = {
  putFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  signedUrl(path: string, expiresInSeconds?: number): Promise<string>;
};

// Local development: files on disk. signedUrl returns a file:// URL, which is enough to check an upload happened.
export function diskStorage(rootDir: string): Storage {
  const root = resolve(rootDir);
  const safe = (path: string) => {
    const full = resolve(root, path);
    const rel = relative(root, full);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Invalid storage path");
    return full;
  };
  return {
    async putFile(path, data) {
      const full = safe(path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, data);
    },
    async signedUrl(path) {
      return pathToFileURL(safe(path)).href;
    },
  };
}

export function supabaseStorage({ url, secretKey, bucket = STORAGE_BUCKET }: { url: string; secretKey: string; bucket?: string }): Storage {
  const client = createClient(url, secretKey, { auth: { persistSession: false } });
  return {
    async putFile(path, data, contentType) {
      const { error } = await client.storage.from(bucket).upload(path, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
    },
    async signedUrl(path, expiresInSeconds = 300) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error(error?.message ?? "Could not sign URL");
      return data.signedUrl;
    },
  };
}

let cached: Storage | undefined;
export function getStorage(): Storage {
  if (cached) return cached;
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;
  cached = url && secretKey ? supabaseStorage({ url, secretKey }) : diskStorage(".storage");
  return cached;
}
```

Append to `packages/db/src/index.ts`:
```ts
export { getStorage, diskStorage, STORAGE_BUCKET, supabaseStorage, type Storage } from "./storage";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @pandora/db test && pnpm --filter @pandora/db typecheck && pnpm --filter @pandora/db lint && pnpm lint`
Expected: PASS; the boundary check still passes (`@supabase/supabase-js` is allowed in `@pandora/db`).

- [ ] **Step 6: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "Add file storage with Supabase and local backends"
```

---

### Task 6: Astryx theme and providers in `@pandora/ui`, wired into both apps

**Files:**
- Modify: `packages/ui/package.json`, `packages/ui/src/index.ts`
- Create: `packages/ui/src/theme/msa.js`, `msa.css`, `msa.d.ts`, `msa.variants.d.ts` (copied verbatim from `D:/Code/MSA/msa-auth/apps/auth/src/theme/`), `packages/ui/src/providers.tsx`, `packages/ui/src/styles.css`
- Modify: `apps/web/src/app/layout.tsx`, `apps/console/src/app/layout.tsx`, `apps/web/package.json`, `apps/console/package.json`
- Test: `packages/ui/src/providers.test.tsx`

**Interfaces:**
- Produces: `import { AppProviders } from "@pandora/ui"` with props `{ children: ReactNode; linkComponent?: ElementType }`; stylesheet `@pandora/ui/styles.css`. Apps pass `next/link` as `linkComponent`.

- [ ] **Step 1: Dependencies and theme files**

In `packages/ui/package.json` add `"exports": { ".": "./src/index.ts", "./styles.css": "./src/styles.css" }` and `"dependencies": { "@astryxdesign/core": "0.6.1", "@stylexjs/stylex": "^0.19.0" }` (exact `0.6.1`: the copied theme was generated by Astryx 0.6.1). Copy the four files listed above from msa-auth unchanged. Run `pnpm install`.

`packages/ui/src/styles.css`:
```css
@import "@astryxdesign/core/reset.css";
@import "@astryxdesign/core/astryx.css";
@import "./theme/msa.css";
```

- [ ] **Step 2: Write the failing test**

`packages/ui/src/providers.test.tsx`:
```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./providers";

describe("AppProviders", () => {
  it("renders its children inside the theme", () => {
    const html = renderToStaticMarkup(
      <AppProviders>
        <p>hello</p>
      </AppProviders>,
    );
    expect(html).toContain("<p>hello</p>");
  });
});
```

Run: `pnpm --filter @pandora/ui test`
Expected: FAIL: cannot resolve `./providers`.

- [ ] **Step 3: Implement**

`packages/ui/src/providers.tsx`:
```tsx
"use client";

import { LayerProvider } from "@astryxdesign/core/Layer";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import type { ElementType, ReactNode } from "react";
import { msaTheme } from "./theme/msa";

export function AppProviders({ children, linkComponent }: { children: ReactNode; linkComponent?: ElementType }) {
  const content = <LayerProvider>{children}</LayerProvider>;
  return (
    <Theme theme={msaTheme} mode="system">
      {linkComponent ? <LinkProvider component={linkComponent}>{content}</LinkProvider> : content}
    </Theme>
  );
}
```

Append to `packages/ui/src/index.ts`:
```ts
export { AppProviders } from "./providers";
```

- [ ] **Step 3b: Keep lint off generated files**

If `pnpm --filter @pandora/ui lint` reports problems in `src/theme/` (generated by the Astryx CLI), change `packages/ui/eslint.config.js` to:
```js
import { globalIgnores } from "eslint/config";
import base from "@pandora/config/eslint/package";

export default [...base, globalIgnores(["src/theme/**"])];
```

- [ ] **Step 4: Wire both apps**

In `apps/web/package.json` and `apps/console/package.json` nothing new is needed beyond `@pandora/ui` (already a dependency). In each app's `next.config.ts` add `"@astryxdesign/core"` to `transpilePackages` only if the build fails without it.

`apps/web/src/app/layout.tsx` becomes:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { pageTitle, siteConfig } from "@pandora/core";
import { AppProviders } from "@pandora/ui";
import "@pandora/ui/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.web),
  title: pageTitle(),
  description: `${siteConfig.name}, by ${siteConfig.organizer}`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..800&display=swap" />
      </head>
      <body>
        <AppProviders linkComponent={Link}>{children}</AppProviders>
      </body>
    </html>
  );
}
```

`apps/console/src/app/layout.tsx`: same structure, keeping its existing metadata (`title: pageTitle("Console")`, `robots: { index: false, follow: false }`, `metadataBase: new URL(siteConfig.urls.console)`).

- [ ] **Step 5: Verify**

Run: `pnpm --filter @pandora/ui test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass; both apps build. Start `pnpm --filter @pandora/web start` in the background, `curl -s http://localhost:3000 | grep -o 'aria-label="MSA Pandora"'` prints the label; stop the server.

- [ ] **Step 6: Commit**

```bash
git add packages/ui apps pnpm-lock.yaml
git commit -m "Add the MSA Astryx theme and providers, used by both apps"
```

---

### Task 7: Session glue and environment in both apps

**Files:**
- Create: `apps/web/src/lib/session.ts`, `apps/console/src/lib/session.ts`
- Modify: `apps/web/package.json`, `apps/console/package.json` (add `@pandora/db`, `@pandora/email`), both `next.config.ts`, both `.env.example`

**Interfaces:**
- Consumes: `getDb`, `createSession`, `getSession`, `revokeSession` from `@pandora/db`.
- Produces:
  - web: `startMemberSession(memberId: string): Promise<void>`, `currentMemberId(): Promise<string | null>`, `requireMemberId(): Promise<string>` (redirects to `/?signin=1` when signed out), `endSession(): Promise<void>`.
  - console: `startStaffSession(staffId: string): Promise<void>`, `currentStaffId(): Promise<string | null>`, `requireStaffId(): Promise<string>` (redirects to `/sign-in`), `endSession(): Promise<void>`. Role checks are the admin flow's job (they need the staff row).
  - Cookie name `pandora_session` (web) and `pandora_console_session` (console); `httpOnly`, `secure` in production, `sameSite: "lax"`, `path: "/"`, `expires` = session expiry.

- [ ] **Step 1: Dependencies and config**

Add `"@pandora/db": "workspace:*"` and `"@pandora/email": "workspace:*"` to both apps' `dependencies`. In both `next.config.ts`, set:
```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  serverExternalPackages: ["pg"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
```
(console keeps its `headers()` block unchanged.) Run `pnpm install`.

- [ ] **Step 2: Session modules**

`apps/web/src/lib/session.ts`:
```ts
import { createSession, getDb, getSession, revokeSession } from "@pandora/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "pandora_session";

export async function startMemberSession(memberId: string): Promise<void> {
  const { token, expiresAt } = await createSession(getDb(), { subjectType: "member", subjectId: memberId });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentMemberId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(getDb(), token);
  return session?.subjectType === "member" ? session.subjectId : null;
}

export async function requireMemberId(): Promise<string> {
  const id = await currentMemberId();
  if (!id) redirect("/?signin=1");
  return id;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await revokeSession(getDb(), token);
  jar.delete(COOKIE);
}
```

`apps/console/src/lib/session.ts`: identical except `COOKIE = "pandora_console_session"`, `subjectType: "staff"`, function names `startStaffSession`, `currentStaffId`, `requireStaffId` (redirects to `/sign-in`), and the subject check `session?.subjectType === "staff"`.

- [ ] **Step 3: Environment examples**

`apps/web/.env.example`:
```bash
# Environment variables for apps/web. Copy to .env.local and fill in. Never commit .env.local.

# Dev database (Neon). Ask Ojas for the URL. Tests never need it.
DATABASE_URL=

# Email: "file" writes to MAIL_OUTBOX_PATH instead of sending (default). "resend" sends for real.
MAIL_TRANSPORT=file
MAIL_OUTBOX_PATH=.mail/outbox.jsonl
RESEND_API_KEY=
EMAIL_FROM=MSA Pandora <pandora@recruitments.msasrm.in>
# Comma-separated. When set, email to anyone else is skipped (used on previews).
MAIL_ALLOWLIST=

# File storage. Leave empty locally: uploads go to .storage/ on disk.
SUPABASE_URL=
SUPABASE_SECRET_KEY=

# "true" adds the payment step to registration.
PAYMENT_ENABLED=false
```

`apps/console/.env.example`: the same file without the `PAYMENT_ENABLED` block, and the first comment line naming `apps/console`.

Add `.mail/`, `.storage/` and `.pglite/` to the root `.gitignore`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all pass. The builds succeed without `DATABASE_URL` (the pool is created on first query).

- [ ] **Step 5: Commit**

```bash
git add apps .gitignore pnpm-lock.yaml
git commit -m "Add session helpers and environment configuration to both apps"
```

---

### Task 8: Migrations in the deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`, `docs/tech/drizzle.md`

**Interfaces:**
- Consumes: `pnpm --filter @pandora/db migrate` (Task 2), Vercel project env `DATABASE_URL` per environment.
- Produces: a `migrate` job that runs before `deploy`, applying migrations to the target environment's database (Neon for previews, Supabase for production). It skips with a warning when `DATABASE_URL` isn't configured in Vercel yet.

- [ ] **Step 1: Add the job**

In `.github/workflows/deploy.yml`, add a job between `plan` and `deploy`, and make `deploy` need it (`needs: [plan, migrate]`):
```yaml
  # Apply database migrations to the target environment before any app deploys against it.
  migrate:
    needs: plan
    if: needs.plan.outputs.apps != '[]'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    env:
      VERCEL_PROJECT_ID: prj_BMnZe3rs4aSPKr0TOljEIIVuz8DB
      VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      TARGET: ${{ github.event_name == 'pull_request' && 'preview' || 'production' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Pull the target environment's variables
        run: npx --yes vercel@latest pull --yes --environment="$TARGET" --token="$VERCEL_TOKEN"
      - name: Apply migrations
        run: |
          set -a; . ".vercel/.env.$TARGET.local"; set +a
          if [ -z "$DATABASE_URL" ]; then
            echo "::warning::DATABASE_URL is not set for $TARGET in Vercel; skipping migrations."
            exit 0
          fi
          pnpm --filter @pandora/db migrate
```

- [ ] **Step 2: Document it**

Append to the "In this repo." paragraph of `docs/tech/drizzle.md`:
```markdown
Schema changes are made in `packages/db/src/schema/`, turned into SQL with `pnpm --filter @pandora/db generate`,
and committed with the pull request. Nobody runs migrations by hand: the deploy workflow applies them to the preview
database (Neon) for pull requests and to production (Supabase) on merge, before the apps deploy.
```

- [ ] **Step 3: Verify**

Push the branch and open the pull request (Task 9). Expected: the `migrate` job runs and either applies migrations or, until `DATABASE_URL` is added to Vercel, finishes with the skip warning; `deploy` runs after it.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml docs/tech/drizzle.md
git commit -m "Apply database migrations in the deploy workflow"
```

---

### Task 9: Pull request

- [ ] **Step 1: Full local check**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin platform-foundation
gh pr create --base main --head platform-foundation --title "Shared platform: rules, data model, OTP and sessions, email, storage, theme" --body "Implements docs/superpowers/plans/2026-09-26-shared-platform.md: the layer every flow builds on. Core rules and schemas, the full data model with migrations, OTP and session queries, email with file and Resend transports, file storage, the MSA Astryx theme, session helpers in both apps, and migrations in the deploy workflow."
```

- [ ] **Step 3: Confirm CI and deploy**

Run: `gh pr checks --watch`
Expected: `checks` passes; `deploy` posts preview links.
