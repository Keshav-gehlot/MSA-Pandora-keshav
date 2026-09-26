import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { staffRole } from "./enums";

export const staff = pgTable(
  "staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    name: text().notNull(),
    role: staffRole().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("staff_email_unique").on(t.email)],
);
