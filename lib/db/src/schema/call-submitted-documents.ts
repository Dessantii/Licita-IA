import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { callNoticesTable } from "./call-notices";
import { noticeFilesTable } from "./notice-files";

export const callSubmittedDocumentsTable = pgTable("call_submitted_documents", {
  id: serial("id").primaryKey(),
  callNoticeId: integer("call_notice_id").notNull().references(() => callNoticesTable.id, { onDelete: "cascade" }),
  fileId: integer("file_id").notNull().references(() => noticeFilesTable.id, { onDelete: "cascade" }),
  detectedType: text("detected_type"),
  detectedDate: text("detected_date"),
  detectedValidity: text("detected_validity"),
  confidence: real("confidence").notNull().default(1.0),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCallSubmittedDocumentSchema = createInsertSchema(callSubmittedDocumentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCallSubmittedDocument = z.infer<typeof insertCallSubmittedDocumentSchema>;
export type CallSubmittedDocument = typeof callSubmittedDocumentsTable.$inferSelect;
