import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { callNoticesTable } from "./call-notices";
import { callExtractedRequirementsTable } from "./call-extracted-requirements";
import { callSubmittedDocumentsTable } from "./call-submitted-documents";

export const callValidationStatusEnum = [
  "ok",
  "pendente",
  "divergente",
  "vencido",
  "incompleto",
  "revisar_manualmente",
] as const;

export const callValidationItemsTable = pgTable("call_validation_items", {
  id: serial("id").primaryKey(),
  callNoticeId: integer("call_notice_id").notNull().references(() => callNoticesTable.id, { onDelete: "cascade" }),
  requirementId: integer("requirement_id").notNull().references(() => callExtractedRequirementsTable.id, { onDelete: "cascade" }),
  submittedDocumentId: integer("submitted_document_id").references(() => callSubmittedDocumentsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pendente"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCallValidationItemSchema = createInsertSchema(callValidationItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCallValidationItem = z.infer<typeof insertCallValidationItemSchema>;
export type CallValidationItem = typeof callValidationItemsTable.$inferSelect;
