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
