import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { callNoticesTable } from "./call-notices";

export const callRequirementTypeEnum = [
  "documento_institucional",
  "certidao_regularidade",
  "comprovacao_experiencia",
  "declaracao",
  "anexo_obrigatorio",
  "proposta_tecnica",
  "plano_trabalho",
  "cronograma",
  "requisito_elegibilidade",
  "documento_parceria",
] as const;

export const callExtractedRequirementsTable = pgTable("call_extracted_requirements", {
  id: serial("id").primaryKey(),
  callNoticeId: integer("call_notice_id").notNull().references(() => callNoticesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  requirementType: text("requirement_type"),
  mandatory: boolean("mandatory").notNull().default(true),
  sourceExcerpt: text("source_excerpt"),
  sourcePage: integer("source_page"),
  confidence: real("confidence").notNull().default(1.0),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCallExtractedRequirementSchema = createInsertSchema(callExtractedRequirementsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCallExtractedRequirement = z.infer<typeof insertCallExtractedRequirementSchema>;
export type CallExtractedRequirement = typeof callExtractedRequirementsTable.$inferSelect;
