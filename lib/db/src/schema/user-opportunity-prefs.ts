import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userOpportunityPrefsTable = pgTable("user_opportunity_prefs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  areas: text("areas").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserOpportunityPrefs = typeof userOpportunityPrefsTable.$inferSelect;
export type InsertUserOpportunityPrefs = typeof userOpportunityPrefsTable.$inferInsert;
