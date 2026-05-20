import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { processesTable } from "./processes";
import { usersTable } from "./users";

export const sessionAlertsTable = pgTable("session_alerts", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").references(() => processesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  alertTime: timestamp("alert_time", { withTimezone: true }).notNull(),
  alertType: text("alert_type").notNull(),
  sent: boolean("sent").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SessionAlert = typeof sessionAlertsTable.$inferSelect;
