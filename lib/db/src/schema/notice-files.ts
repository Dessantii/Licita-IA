import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { callNoticesTable } from "./call-notices";

export const noticeFileTypeEnum = [
  "edital",
  "anexo",
  "documento_osc",
  "proposta",
  "plano_trabalho",
  "cronograma",
] as const;

export const noticeFilesTable = pgTable("notice_files", {
  id: serial("id").primaryKey(),
  callNoticeId: integer("call_notice_id").notNull().references(() => callNoticesTable.id, { onDelete: "cascade" }),
  fileType: text("file_type").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  dataValidade: text("data_validade"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoticeFileSchema = createInsertSchema(noticeFilesTable).omit({
  id: true,
  uploadedAt: true,
});

export type InsertNoticeFile = z.infer<typeof insertNoticeFileSchema>;
export type NoticeFile = typeof noticeFilesTable.$inferSelect;
