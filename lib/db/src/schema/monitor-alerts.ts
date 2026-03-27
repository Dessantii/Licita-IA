import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { monitorsTable } from "./monitors";
import { usersTable } from "./users";

export const monitorAlertsTable = pgTable("monitor_alerts", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitor_id").notNull().references(() => monitorsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  modalidade: text("modalidade"),
  orgao: text("orgao"),
  municipio: text("municipio"),
  uf: text("uf"),
  dataPublicacao: text("data_publicacao"),
  urlPncp: text("url_pncp"),
  pncpId: text("pncp_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MonitorAlert = typeof monitorAlertsTable.$inferSelect;
export type InsertMonitorAlert = typeof monitorAlertsTable.$inferInsert;
