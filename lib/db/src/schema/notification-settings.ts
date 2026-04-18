import { pgTable, serial, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  palavrasChave: text("palavras_chave").array().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationSettings = typeof notificationSettingsTable.$inferSelect;
