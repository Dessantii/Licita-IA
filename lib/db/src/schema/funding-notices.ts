import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fundingNoticesTable = pgTable(
  "funding_notices",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    source: text("source"),
    deadline: timestamp("deadline", { withTimezone: true }),
    maxValue: numeric("max_value", { precision: 18, scale: 2 }),
    rawText: text("raw_text"),
    structuredData: jsonb("structured_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("funding_notices_source_idx").on(t.source),
    index("funding_notices_deadline_idx").on(t.deadline),
    index("funding_notices_created_at_idx").on(t.createdAt),
  ]
);

export const insertFundingNoticeSchema = createInsertSchema(fundingNoticesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectFundingNoticeSchema = createSelectSchema(fundingNoticesTable);

export type InsertFundingNotice = z.infer<typeof insertFundingNoticeSchema>;
export type FundingNotice = typeof fundingNoticesTable.$inferSelect;
