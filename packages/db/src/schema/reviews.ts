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
