import { pgTable, serial, integer, text, decimal, jsonb, timestamp } from "drizzle-orm/pg-core";

export const marketPriceResearchTable = pgTable("market_price_research", {
  id: serial("id").primaryKey(),
  processId: integer("process_id").notNull(),
  searchTerms: text("search_terms").array(),
  results: jsonb("results"),
  avgPrice: decimal("avg_price", { precision: 15, scale: 2 }),
  minPrice: decimal("min_price", { precision: 15, scale: 2 }),
  maxPrice: decimal("max_price", { precision: 15, scale: 2 }),
  priceInsight: text("price_insight"),
  suggestedBidMin: decimal("suggested_bid_min", { precision: 15, scale: 2 }),
  suggestedBidMax: decimal("suggested_bid_max", { precision: 15, scale: 2 }),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});
