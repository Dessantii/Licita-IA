import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const companyDocumentTypeEnum = [
  "cnpj",
  "estatuto_social",
  "ata_eleicao",
  "certidao_federal",
  "certidao_estadual",
  "certidao_municipal",
  "certidao_trabalhista",
  "certidao_fgts",
  "balanco_patrimonial",
  "declaracao",
  "procuracao",
  "outros",
] as const;

export const companyDocumentsTable = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  tipo: text("tipo").notNull(),
  dataEmissao: text("data_emissao"),
  dataValidade: text("data_validade"),
  name: text("name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").default("manual"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  ocrExtractedExpiry: boolean("ocr_extracted_expiry").default(false),
});

export const insertCompanyDocumentSchema = createInsertSchema(companyDocumentsTable).omit({
  id: true,
  uploadedAt: true,
});

export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;
export type CompanyDocument = typeof companyDocumentsTable.$inferSelect;
