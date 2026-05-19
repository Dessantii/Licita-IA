import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { processesTable } from "./processes";

export const generatedDeclarationsTable = pgTable("generated_declarations", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  declarationType: text("declaration_type").notNull(),
  declarationText: text("declaration_text"),
  filePath: text("file_path"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  uploadedSignedAt: timestamp("uploaded_signed_at", { withTimezone: true }),
});

export type GeneratedDeclaration = typeof generatedDeclarationsTable.$inferSelect;
