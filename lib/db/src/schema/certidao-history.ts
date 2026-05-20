import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const certidaoHistoryTable = pgTable("certidao_history", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  certidaoType: text("certidao_type").notNull(),
  resultado: text("resultado").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  fileUrl: text("file_url"),
  extractionData: jsonb("extraction_data"),
  emissionMethod: text("emission_method").notNull().default("manual_upload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CertidaoHistory = typeof certidaoHistoryTable.$inferSelect;
