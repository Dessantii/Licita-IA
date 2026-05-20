import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const guideArticlesTable = pgTable("guide_articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  readingTime: integer("reading_time").notNull(),
  icon: text("icon").notNull(),
  published: boolean("published").default(true),
  orderInCategory: integer("order_in_category").default(0),
  helpfulYes: integer("helpful_yes").default(0),
  helpfulNo: integer("helpful_no").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGuideArticleSchema = createInsertSchema(guideArticlesTable);
export type GuideArticle = typeof guideArticlesTable.$inferSelect;
export type InsertGuideArticle = z.infer<typeof insertGuideArticleSchema>;
