import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { fundingProjectsTable } from "./funding-projects";

export const projectSectionTypeEnum = pgEnum("project_section_type", [
  "problema",
  "justificativa",
  "objetivo_geral",
  "objetivos_especificos",
  "metodologia",
  "impacto",
  "cronograma",
  "orcamento",
]);

export const projectSectionsTable = pgTable(
  "project_sections",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => fundingProjectsTable.id, { onDelete: "cascade" }),
    type: projectSectionTypeEnum("type").notNull(),
    content: text("content"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("project_sections_project_id_idx").on(t.projectId),
    index("project_sections_type_idx").on(t.type),
    index("project_sections_project_type_idx").on(t.projectId, t.type),
  ]
);

export const insertProjectSectionSchema = createInsertSchema(projectSectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectProjectSectionSchema = createSelectSchema(projectSectionsTable);

export type InsertProjectSection = z.infer<typeof insertProjectSectionSchema>;
export type ProjectSection = typeof projectSectionsTable.$inferSelect;
export type ProjectSectionType = typeof projectSectionTypeEnum.enumValues[number];
