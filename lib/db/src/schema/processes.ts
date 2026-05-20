import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const processStatusEnum = [
  "criado",
  "edital_enviado",
  "edital_processando",
  "exigencias_extraidas",
  "aguardando_documentos",
  "documentos_enviados",
  "em_conferencia",
  "pendencias_encontradas",
  "pronto_para_revisao",
  "concluido",
] as const;

export const processesTable = pgTable("processes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  agency: text("agency").notNull(),
  modality: text("modality").notNull(),
  editalNumber: text("edital_number"),
  deadline: text("deadline"),
  notes: text("notes"),
  status: text("status").notNull().default("criado"),
  pncpId: text("pncp_id"),
  // Session
  sessionDate: timestamp("session_date", { withTimezone: true }),
  sessionAlertsEnabled: boolean("session_alerts_enabled").default(false),
  sessionResult: jsonb("session_result"),
  sessionChecklist: jsonb("session_checklist"),
  // Post-session
  postSessionTimeline: jsonb("post_session_timeline"),
  postSessionHabilitacaoDeadline: timestamp("post_session_habilitacao_deadline", { withTimezone: true }),
  adjudicatedAt: timestamp("adjudicated_at", { withTimezone: true }),
  adjudicationNumber: text("adjudication_number"),
  homologatedAt: timestamp("homologated_at", { withTimezone: true }),
  homologationNumber: text("homologation_number"),
  currentPhase: text("current_phase"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProcessSchema = createInsertSchema(processesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProcess = z.infer<typeof insertProcessSchema>;
export type Process = typeof processesTable.$inferSelect;
