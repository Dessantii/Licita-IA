import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { processesTable } from "./processes";

export const sessionBidsTable = pgTable("session_bids", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").references(() => processesTable.id, { onDelete: "cascade" }),
  bidTime: timestamp("bid_time", { withTimezone: true }).notNull().defaultNow(),
  bidValue: numeric("bid_value", { precision: 12, scale: 2 }).notNull(),
  bidType: text("bid_type").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SessionBid = typeof sessionBidsTable.$inferSelect;
