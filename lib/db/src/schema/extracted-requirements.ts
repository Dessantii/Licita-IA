import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { processesTable } from "./processes";

export const extractedRequirementsTable = pgTable("extracted_requirements", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  mandatory: boolean("mandatory").notNull().default(true),
  sourceExcerpt: text("source_excerpt"),
  sourcePage: integer("source_page"),
  confidence: real("confidence").notNull().default(1.0),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExtractedRequirementSchema = createInsertSchema(extractedRequirementsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertExtractedRequirement = z.infer<typeof insertExtractedRequirementSchema>;
export type ExtractedRequirement = typeof extractedRequirementsTable.$inferSelect;
