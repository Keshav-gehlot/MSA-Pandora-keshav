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
