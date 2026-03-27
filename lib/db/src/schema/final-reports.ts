import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { processesTable } from "./processes";

export const finalReportsTable = pgTable("final_reports", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  okCount: integer("ok_count").notNull().default(0),
  missingCount: integer("missing_count").notNull().default(0),
  expiredCount: integer("expired_count").notNull().default(0),
  divergentCount: integer("divergent_count").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  nextSteps: text("next_steps"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFinalReportSchema = createInsertSchema(finalReportsTable).omit({
  id: true,
  generatedAt: true,
});

export type InsertFinalReport = z.infer<typeof insertFinalReportSchema>;
export type FinalReport = typeof finalReportsTable.$inferSelect;
