import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const callNoticeStatusEnum = [
  "criado",
  "edital_enviado",
  "edital_processando",
  "requisitos_extraidos",
  "aguardando_documentos",
  "documentos_enviados",
  "em_conferencia",
  "pendencias_encontradas",
  "pronto_para_submissao",
  "concluido",
] as const;

export const callNoticeCategoryEnum = [
  "saude",
  "educacao",
  "assistencia_social",
  "cultura",
  "esporte",
  "meio_ambiente",
  "habitacao",
  "seguranca_publica",
  "ciencia_tecnologia",
  "outros",
] as const;

export const callNoticesTable = pgTable("call_notices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  agency: text("agency").notNull(),
  referenceNumber: text("reference_number"),
  category: text("category"),
  deadline: text("deadline"),
  notes: text("notes"),
  status: text("status").notNull().default("criado"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCallNoticeSchema = createInsertSchema(callNoticesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCallNotice = z.infer<typeof insertCallNoticeSchema>;
export type CallNotice = typeof callNoticesTable.$inferSelect;
