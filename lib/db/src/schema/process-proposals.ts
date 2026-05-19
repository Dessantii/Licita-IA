import { pgTable, serial, integer, text, decimal, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const processProposalsTable = pgTable("process_proposals", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull(),
  companyId: integer("company_id"),
  items: jsonb("items").notNull().default([]),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  validityDays: integer("validity_days").notNull().default(60),
  deliveryTerm: text("delivery_term"),
  brandManufacturer: text("brand_manufacturer"),
  observations: text("observations"),
  estimatedTaxesPercent: decimal("estimated_taxes_percent", { precision: 5, scale: 2 }),
  declaredCost: decimal("declared_cost", { precision: 15, scale: 2 }),
  calculatedMargin: decimal("calculated_margin", { precision: 5, scale: 2 }),
  docxPath: text("docx_path"),
  signedDocxPath: text("signed_docx_path"),
  generatedAt: timestamp("generated_at"),
  signedUploadedAt: timestamp("signed_uploaded_at"),
  status: text("status").default("draft"),
  // Signing flow
  proposalStep: integer("proposal_step").notNull().default(1),
  platformName: text("platform_name"),
  platformSubmitted: boolean("platform_submitted").default(false),
  platformProtocol: text("platform_protocol"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
