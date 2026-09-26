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
    verifiedAt: timestamp({ withTimezone: true }),
    claimedAt: timestamp({ withTimezone: true }),
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
