import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { paymentStatus, shortlistStatus } from "./enums";

export const teams = pgTable(
  "teams",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    nameKey: text().notNull(),
    track: text().notNull(),
    paymentStatus: paymentStatus().notNull().default("not_required"),
    shortlistStatus: shortlistStatus().notNull().default("pending"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [unique("teams_name_key_unique").on(t.nameKey)],
);
