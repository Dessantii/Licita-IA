import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const emitirJobsTable = pgTable("emitir_jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  companyId: integer("company_id").notNull(),
  certidaoType: text("certidao_type").notNull(),
  status: text("status").notNull().default("running"),
  step: text("step").notNull().default("Iniciando..."),
  result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type EmitirJob = typeof emitirJobsTable.$inferSelect;
