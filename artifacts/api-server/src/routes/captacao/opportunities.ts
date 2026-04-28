import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  opportunitiesTable,
  opportunitySourcesTable,
  userOpportunityPrefsTable,
} from "@workspace/db";
import {
  eq, desc, and, or, ilike, gte, lte, inArray, sql,
} from "drizzle-orm";
import { z } from "zod";
import { runOpportunityCollection } from "../../services/opportunity-collector";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// GET /api/opportunities — list with filters + user prefs matching
router.get("/", async (req, res) => {
  const userId = (req as any).userId as number;
  const {
    q,
    area,
    novasSomente,
    page = "1",
    limit = "20",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(5, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: any[] = [];

  if (q) {
    conditions.push(
      or(
        ilike(opportunitiesTable.title, `%${q}%`),
        ilike(opportunitiesTable.description, `%${q}%`),
        ilike(opportunitiesTable.sourceName, `%${q}%`)
      )
    );
  }

  if (area && area !== "todos") {
    conditions.push(eq(opportunitiesTable.area, area));
  }

  if (novasSomente === "true") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    conditions.push(gte(opportunitiesTable.createdAt, sevenDaysAgo));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(opportunitiesTable)
      .where(where)
      .orderBy(desc(opportunitiesTable.createdAt))
      .limit(limitNum)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(opportunitiesTable)
      .where(where),
  ]);

  const total = countResult[0]?.total ?? 0;

  // Mark as seen (isNew = false if older than 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db
    .update(opportunitiesTable)
    .set({ isNew: false })
    .where(lte(opportunitiesTable.createdAt, sevenDaysAgo));

  res.json({
    data: items,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// GET /api/opportunities/stats — summary stats
router.get("/stats", async (_req, res) => {
  const [totalResult, newResult, sourcesResult] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(opportunitiesTable),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(opportunitiesTable)
      .where(eq(opportunitiesTable.isNew, true)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(opportunitySourcesTable)
      .where(eq(opportunitySourcesTable.isActive, true)),
  ]);

  res.json({
    total: totalResult[0]?.total ?? 0,
    novas: newResult[0]?.total ?? 0,
    fontes: sourcesResult[0]?.total ?? 0,
  });
});

// GET /api/opportunities/sources — list all sources
router.get("/sources", async (_req, res) => {
  const sources = await db
    .select()
    .from(opportunitySourcesTable)
    .orderBy(desc(opportunitySourcesTable.createdAt));
  res.json(sources);
});

// PATCH /api/opportunities/sources/:id — toggle source active/inactive
router.patch("/sources/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "ID inválido." }); return; }
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos." }); return; }
  const [updated] = await db
    .update(opportunitySourcesTable)
    .set({ isActive: parsed.data.isActive })
    .where(eq(opportunitySourcesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Fonte não encontrada." }); return; }
  res.json(updated);
});

// POST /api/opportunities/sources — add new source
router.post("/sources", async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    url: z.string().url(),
    fetchMethod: z.enum(["rss", "html_ai"]).default("html_ai"),
    areaHint: z.string().optional(),
    fetchIntervalHours: z.number().int().min(1).max(168).default(12),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos." }); return; }
  const [source] = await db.insert(opportunitySourcesTable).values(parsed.data).returning();
  res.status(201).json(source);
});

// GET /api/opportunities/preferences — user preferences
router.get("/preferences", async (req, res) => {
  const userId = (req as any).userId as number;
  const [prefs] = await db
    .select()
    .from(userOpportunityPrefsTable)
    .where(eq(userOpportunityPrefsTable.userId, userId));

  if (!prefs) {
    const [created] = await db
      .insert(userOpportunityPrefsTable)
      .values({ userId, areas: [], keywords: [] })
      .returning();
    res.json(created);
    return;
  }
  res.json(prefs);
});

// PATCH /api/opportunities/preferences — update user preferences
router.patch("/preferences", async (req, res) => {
  const userId = (req as any).userId as number;
  const parsed = z.object({
    areas: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados inválidos." }); return; }

  const existing = await db
    .select()
    .from(userOpportunityPrefsTable)
    .where(eq(userOpportunityPrefsTable.userId, userId));

  if (existing.length === 0) {
    const [created] = await db
      .insert(userOpportunityPrefsTable)
      .values({ userId, areas: [], keywords: [], ...parsed.data })
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(userOpportunityPrefsTable)
    .set({ ...parsed.data })
    .where(eq(userOpportunityPrefsTable.userId, userId))
    .returning();
  res.json(updated);
});

// POST /api/opportunities/collect — manual trigger (admin or any logged in user)
router.post("/collect", async (_req, res) => {
  logger.info("Manual opportunity collection triggered");
  // Run async, respond immediately
  runOpportunityCollection()
    .then((r) => logger.info(r, "Manual collection complete"))
    .catch((err) => logger.error({ err }, "Manual collection error"));
  res.json({ message: "Coleta iniciada. Os resultados aparecerão em breve." });
});

export default router;
