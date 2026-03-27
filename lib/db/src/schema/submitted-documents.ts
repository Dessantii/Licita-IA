import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { processesTable } from "./processes";
import { uploadedFilesTable } from "./uploaded-files";

export const submittedDocumentsTable = pgTable("submitted_documents", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),
  fileId: integer("file_id").notNull().references(() => uploadedFilesTable.id, { onDelete: "cascade" }),
  detectedType: text("detected_type"),
  detectedDate: text("detected_date"),
  detectedValidity: text("detected_validity"),
  confidence: real("confidence").notNull().default(1.0),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubmittedDocumentSchema = createInsertSchema(submittedDocumentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSubmittedDocument = z.infer<typeof insertSubmittedDocumentSchema>;
export type SubmittedDocument = typeof submittedDocumentsTable.$inferSelect;
