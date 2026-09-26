import { sql } from "drizzle-orm";
import { boolean, pgTable, smallint, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    regNumber: text().notNull(),
    srmEmail: text().notNull(),
    personalEmail: text().notNull(),
    phone: text().notNull(),
    photoPath: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("members_team_position").on(t.teamId, t.position),
    unique("members_reg_number_unique").on(t.regNumber),
    unique("members_srm_email_unique").on(t.srmEmail),
    uniqueIndex("members_one_leader").on(t.teamId).where(sql`${t.isLeader}`),
  ],
);
