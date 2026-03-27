import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { processesTable } from "./processes";
import { extractedRequirementsTable } from "./extracted-requirements";
import { submittedDocumentsTable } from "./submitted-documents";

export const validationStatusEnum = ["ok", "faltando", "vencido", "divergente", "revisar"] as const;

export const validationItemsTable = pgTable("validation_items", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),
  requirementId: integer("requirement_id").notNull().references(() => extractedRequirementsTable.id, { onDelete: "cascade" }),
  submittedDocumentId: integer("submitted_document_id").references(() => submittedDocumentsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("faltando"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertValidationItemSchema = createInsertSchema(validationItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertValidationItem = z.infer<typeof insertValidationItemSchema>;
export type ValidationItem = typeof validationItemsTable.$inferSelect;
