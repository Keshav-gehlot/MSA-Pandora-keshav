import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { members } from "./members";
import { staff } from "./staff";

export const checkinPasses = pgTable(
  "checkin_passes",
  {
    id: uuid().primaryKey().defaultRandom(),
    memberId: uuid().notNull().references(() => members.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    unique("checkin_passes_member_id_unique").on(t.memberId),
    unique("checkin_passes_token_hash_unique").on(t.tokenHash),
  ],
);

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
