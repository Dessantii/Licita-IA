import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { companyDocumentsTable } from "./company-documents";

export const documentAlertsTable = pgTable("document_alerts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  documentId: integer("document_id").notNull().references(() => companyDocumentsTable.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  channel: text("channel").notNull().default("in_app"),
});

export type DocumentAlert = typeof documentAlertsTable.$inferSelect;
