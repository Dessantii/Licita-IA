import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { fundingNoticesTable } from "./funding-notices";

export const fundingProjectStatusEnum = pgEnum("funding_project_status", [
  "draft",
  "in_progress",
  "completed",
]);

export const fundingProjectsTable = pgTable(
  "funding_projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    fundingNoticeId: integer("funding_notice_id").references(
      () => fundingNoticesTable.id,
      { onDelete: "set null" }
    ),
    title: text("title").notNull(),
    status: fundingProjectStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("funding_projects_user_id_idx").on(t.userId),
    index("funding_projects_funding_notice_id_idx").on(t.fundingNoticeId),
    index("funding_projects_status_idx").on(t.status),
  ]
);

export const insertFundingProjectSchema = createInsertSchema(fundingProjectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectFundingProjectSchema = createSelectSchema(fundingProjectsTable);

export type InsertFundingProject = z.infer<typeof insertFundingProjectSchema>;
export type FundingProject = typeof fundingProjectsTable.$inferSelect;
export type FundingProjectStatus = typeof fundingProjectStatusEnum.enumValues[number];
