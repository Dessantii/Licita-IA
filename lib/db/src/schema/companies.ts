import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  stateRegistration: text("state_registration"),
  municipalRegistration: text("municipal_registration"),
  legalRepresentative: text("legal_representative"),
  notes: text("notes"),
  status: text("status").notNull().default("ativa"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
