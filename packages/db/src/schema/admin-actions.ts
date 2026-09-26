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
