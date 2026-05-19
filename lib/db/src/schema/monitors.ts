import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const monitorsTable = pgTable("monitors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  uf: text("uf"),
  modalidadeId: integer("modalidade_id"),
  palavrasChave: text("palavras_chave").array(),
  municipio: text("municipio"),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),

  useBiddingProfile: boolean("use_bidding_profile").default(true),
  minScoreForAlert: integer("min_score_for_alert").default(0),
  mepppOnly: boolean("meppp_only").default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Monitor = typeof monitorsTable.$inferSelect;
export type InsertMonitor = typeof monitorsTable.$inferInsert;
