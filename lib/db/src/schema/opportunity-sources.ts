import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const opportunitySourcesTable = pgTable("opportunity_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "rss" | "html_ai" | "api"
  url: text("url").notNull(),
  fetchMethod: text("fetch_method").notNull().default("html_ai"),
  areaHint: text("area_hint"), // hint for AI normalization, e.g. "cultura,arte"
  isActive: boolean("is_active").notNull().default(true),
  fetchIntervalHours: integer("fetch_interval_hours").notNull().default(12),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastFetchStatus: text("last_fetch_status"), // "ok" | "error" | "empty"
  lastFetchError: text("last_fetch_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpportunitySource = typeof opportunitySourcesTable.$inferSelect;
export type InsertOpportunitySource = typeof opportunitySourcesTable.$inferInsert;
