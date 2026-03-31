import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const companyDocumentsTable = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  issueDate: text("issue_date"),
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("sem_validade"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanyDocumentSchema = createInsertSchema(companyDocumentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;
export type CompanyDocument = typeof companyDocumentsTable.$inferSelect;
