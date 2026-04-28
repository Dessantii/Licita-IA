import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { opportunitySourcesTable } from "./opportunity-sources";

export const opportunitiesTable = pgTable(
  "opportunities",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    sourceId: integer("source_id").references(() => opportunitySourcesTable.id, {
      onDelete: "set null",
    }),
    sourceName: text("source_name"),
    area: text("area"), // "cultura" | "saude" | "educacao" | "inovacao" | "social" | "meio_ambiente" | "esporte" | "outro"
    targetAudience: text("target_audience"),
    link: text("link"),
    maxValue: text("max_value"),
    publishDate: timestamp("publish_date", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true }),
    contentHash: text("content_hash"), // SHA-like dedup key: title+link hash
    rawText: text("raw_text"),
    isNew: boolean("is_new").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("opportunities_area_idx").on(t.area),
    index("opportunities_deadline_idx").on(t.deadline),
    index("opportunities_created_at_idx").on(t.createdAt),
    index("opportunities_source_id_idx").on(t.sourceId),
    unique("opportunities_content_hash_unique").on(t.contentHash),
  ]
);

export type Opportunity = typeof opportunitiesTable.$inferSelect;
export type InsertOpportunity = typeof opportunitiesTable.$inferInsert;
