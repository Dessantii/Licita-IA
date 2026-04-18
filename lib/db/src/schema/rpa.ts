import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const RPA_JOB_TYPES = ["submeter_proposta", "verificar_status", "enviar_habilitacao"] as const;
export const RPA_JOB_STATUS = ["pendente", "em_execucao", "concluido", "erro", "cancelado"] as const;
export const RPA_ERROR_TYPES = [
  "certificado_invalido",
  "timeout_portal",
  "sessao_expirada",
  "portal_fora_do_ar",
  "proposta_ja_enviada",
  "erro_generico",
] as const;
export const RPA_LOG_STATUS = ["sucesso", "erro", "aviso"] as const;

export const rpaJobsTable = pgTable("rpa_jobs", {
  id: serial("id").primaryKey(),
  processoId: integer("processo_id"),
  empresaId: integer("empresa_id"),
  tipo: text("tipo").notNull().$type<typeof RPA_JOB_TYPES[number]>(),
  prioridade: integer("prioridade").notNull().default(3),
  status: text("status").notNull().default("pendente").$type<typeof RPA_JOB_STATUS[number]>(),
  tentativasRealizadas: integer("tentativas_realizadas").notNull().default(0),
  maxTentativas: integer("max_tentativas").notNull().default(3),
  errorType: text("error_type").$type<typeof RPA_ERROR_TYPES[number]>(),
  errorMessage: text("error_message"),
  payload: jsonb("payload"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  iniciadoEm: timestamp("iniciado_em", { withTimezone: true }),
  finalizadoEm: timestamp("finalizado_em", { withTimezone: true }),
  proximaTentativaEm: timestamp("proxima_tentativa_em", { withTimezone: true }),
});

export const rpaLogsTable = pgTable("rpa_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id"),
  processoId: integer("processo_id"),
  empresaId: integer("empresa_id"),
  acao: text("acao").notNull(),
  status: text("status").notNull().$type<typeof RPA_LOG_STATUS[number]>(),
  detalhe: text("detalhe"),
  screenshotPath: text("screenshot_path"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type RpaJob = typeof rpaJobsTable.$inferSelect;
export type RpaLog = typeof rpaLogsTable.$inferSelect;

export const createRpaJobSchema = z.object({
  processoId: z.number().int().optional(),
  empresaId: z.number().int().optional(),
  tipo: z.enum(RPA_JOB_TYPES),
  prioridade: z.number().int().min(1).max(5).default(3),
  payload: z.record(z.unknown()).optional(),
});
