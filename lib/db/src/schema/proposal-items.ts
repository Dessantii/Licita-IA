import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { processesTable } from "./processes";

export const proposalItemsTable = pgTable("proposal_items", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull().references(() => processesTable.id, { onDelete: "cascade" }),
  numeroItem: integer("numero_item").notNull(),
  descricao: text("descricao"),
  precoUnitario: real("preco_unitario").notNull(),
  marca: text("marca"),
  fabricante: text("fabricante"),
  prazoEntrega: text("prazo_entrega"),
  unidade: text("unidade"),
  quantidade: real("quantidade"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProposalItemSchema = createInsertSchema(proposalItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertProposalItemsSchema = z.array(
  z.object({
    numeroItem: z.number().int().min(1),
    descricao: z.string().optional(),
    precoUnitario: z.number().positive(),
    marca: z.string().optional(),
    fabricante: z.string().optional(),
    prazoEntrega: z.string().optional(),
    unidade: z.string().optional(),
    quantidade: z.number().optional(),
  })
);

export type InsertProposalItem = z.infer<typeof insertProposalItemSchema>;
export type ProposalItem = typeof proposalItemsTable.$inferSelect;
