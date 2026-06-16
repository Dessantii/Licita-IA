import { pgTable, serial, integer, text, boolean, numeric, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { processesTable } from "./processes";

export const processAnalysisTable = pgTable("process_analysis", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),

  viabilityStatus: text("viability_status").notNull().default("caution"),
  viabilityReasons: jsonb("viability_reasons").$type<string[]>(),

  hasFictitiousTie: boolean("has_fictitious_tie").default(false),
  isMepppExclusive: boolean("is_meppp_exclusive").default(false),
  hasReservedQuota: boolean("has_reserved_quota").default(false),
  reservedQuotaItems: jsonb("reserved_quota_items").$type<string[]>(),
  mepppExclusiveValue: numeric("meppp_exclusive_value"),

  technicalRequirements: jsonb("technical_requirements").$type<Array<{
    description: string;
    difficulty: "easy" | "medium" | "hard";
    how_to_solve: string;
  }>>(),

  timelineEvents: jsonb("timeline_events").$type<Array<{
    label: string;
    date: string;
    type: "deadline" | "session" | "visit" | "contract" | "other";
  }>>(),

  similarProcesses: jsonb("similar_processes"),
  pricePatternInsight: text("price_pattern_insight"),
  suggestedBidMin: numeric("suggested_bid_min"),
  suggestedBidMax: numeric("suggested_bid_max"),

  estimatedValue: numeric("estimated_value"),
  estimatedTaxesPercent: numeric("estimated_taxes_percent"),

  riskAnalysis: jsonb("risk_analysis"),
  riskAnalyzedAt: timestamp("risk_analyzed_at", { withTimezone: true }),
  riskScore: text("risk_score"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("process_analysis_process_id_unique").on(t.processId),
]);

export type ProcessAnalysis = typeof processAnalysisTable.$inferSelect;
