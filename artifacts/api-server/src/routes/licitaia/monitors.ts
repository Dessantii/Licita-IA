import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { monitorsTable, monitorAlertsTable } from "@workspace/db";
import { eq, and, desc, count, ilike, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { buscarPublicacoesPncp, filtragemPorPalavras, pncpUrl, MODALIDADES } from "../../services/pncp";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const userId = (req as any).userId as number;
  const monitors = await db
    .select()
    .from(monitorsTable)
    .where(eq(monitorsTable.userId, userId))
    .orderBy(desc(monitorsTable.createdAt));
  res.json(monitors);
});

const monitorSchema = z.object({
  name: z.string().min(1),
  uf: z.string().length(2).optional(),
  municipio: z.string().optional(),
  modalidadeId: z.number().int().optional(),
  palavrasChave: z.array(z.string()).optional(),
});

router.post("/", async (req, res) => {
  const userId = (req as any).userId as number;
  const parsed = monitorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const [monitor] = await db.insert(monitorsTable).values({
    userId,
    ...parsed.data,
  }).returning();
  res.status(201).json(monitor);
});

router.patch("/:id", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const parsed = monitorSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const [updated] = await db
    .update(monitorsTable)
    .set(parsed.data)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, userId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Monitor não encontrado." });
    return;
  }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  await db
    .delete(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, userId)));
  res.status(204).send();
});

router.post("/:id/toggle", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const [monitor] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, userId)));
  if (!monitor) {
    res.status(404).json({ error: "Monitor não encontrado." });
    return;
  }
  const [updated] = await db
    .update(monitorsTable)
    .set({ isActive: !monitor.isActive })
    .where(eq(monitorsTable.id, id))
    .returning();
  res.json(updated);
});

router.post("/:id/check", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const [monitor] = await db
    .select()
    .from(monitorsTable)
    .where(and(eq(monitorsTable.id, id), eq(monitorsTable.userId, userId)));
  if (!monitor) {
    res.status(404).json({ error: "Monitor não encontrado." });
    return;
  }
  try {
    const novos = await checkMonitor(monitor, userId);
    res.json({ novosAlertas: novos });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Erro ao verificar PNCP." });
  }
});

router.get("/portal", async (req, res) => {
  const userId = (req as any).userId as number;
  const { search, uf, municipio, modalidade, dataInicial, dataFinal, page = "1", limit = "20" } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [eq(monitorAlertsTable.userId, userId) as any];
  if (uf) conditions.push(eq(monitorAlertsTable.uf, uf) as any);
  if (modalidade) conditions.push(eq(monitorAlertsTable.modalidade, modalidade) as any);
  if (municipio) conditions.push(ilike(monitorAlertsTable.municipio, `%${municipio}%`) as any);
  if (search) {
    conditions.push(
      sql`(${monitorAlertsTable.titulo} ilike ${'%' + search + '%'} OR ${monitorAlertsTable.orgao} ilike ${'%' + search + '%'})` as any
    );
  }
  if (dataInicial) conditions.push(gte(monitorAlertsTable.dataPublicacao, dataInicial) as any);
  if (dataFinal) conditions.push(lte(monitorAlertsTable.dataPublicacao, dataFinal) as any);

  const where = and(...conditions);

  const [totalRow] = await db.select({ total: count() }).from(monitorAlertsTable).where(where);
  const total = Number(totalRow?.total ?? 0);

  const alerts = await db
    .select()
    .from(monitorAlertsTable)
    .where(where)
    .orderBy(desc(monitorAlertsTable.dataPublicacao), desc(monitorAlertsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const statsToday = await db.select({ total: count() }).from(monitorAlertsTable).where(
    and(
      eq(monitorAlertsTable.userId, userId),
      gte(monitorAlertsTable.createdAt, new Date(new Date().setHours(0, 0, 0, 0))),
    )
  );
  const todayCount = Number(statsToday[0]?.total ?? 0);

  res.json({
    data: alerts,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
    todayCount,
  });
});

router.get("/portal/stats", async (req, res) => {
  const userId = (req as any).userId as number;
  const allAlerts = await db.select({
    uf: monitorAlertsTable.uf,
    municipio: monitorAlertsTable.municipio,
    modalidade: monitorAlertsTable.modalidade,
  }).from(monitorAlertsTable).where(eq(monitorAlertsTable.userId, userId));

  const byUf: Record<string, number> = {};
  const byModalidade: Record<string, number> = {};
  for (const a of allAlerts) {
    if (a.uf) byUf[a.uf] = (byUf[a.uf] ?? 0) + 1;
    if (a.modalidade) byModalidade[a.modalidade] = (byModalidade[a.modalidade] ?? 0) + 1;
  }

  res.json({ total: allAlerts.length, byUf, byModalidade });
});

router.get("/alerts", async (req, res) => {
  const userId = (req as any).userId as number;
  const alerts = await db
    .select()
    .from(monitorAlertsTable)
    .where(eq(monitorAlertsTable.userId, userId))
    .orderBy(desc(monitorAlertsTable.createdAt))
    .limit(50);
  res.json(alerts);
});

router.get("/alerts/unread-count", async (req, res) => {
  const userId = (req as any).userId as number;
  const [{ value }] = await db
    .select({ value: count() })
    .from(monitorAlertsTable)
    .where(and(eq(monitorAlertsTable.userId, userId), eq(monitorAlertsTable.isRead, false)));
  res.json({ count: Number(value) });
});

router.post("/alerts/:id/read", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  await db
    .update(monitorAlertsTable)
    .set({ isRead: true })
    .where(and(eq(monitorAlertsTable.id, id), eq(monitorAlertsTable.userId, userId)));
  res.status(204).send();
});

router.post("/alerts/read-all", async (req, res) => {
  const userId = (req as any).userId as number;
  await db
    .update(monitorAlertsTable)
    .set({ isRead: true })
    .where(eq(monitorAlertsTable.userId, userId));
  res.status(204).send();
});

export async function checkMonitor(monitor: typeof monitorsTable.$inferSelect, userId: number): Promise<number> {
  const dataFinal = new Date();
  const dataInicial = monitor.lastCheckedAt
    ? new Date(monitor.lastCheckedAt)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await buscarPublicacoesPncp({
    dataInicial,
    dataFinal,
    uf: monitor.uf ?? undefined,
    municipio: monitor.municipio ?? undefined,
    modalidadeId: monitor.modalidadeId ?? undefined,
  });

  const municipioFiltro = monitor.municipio?.toLowerCase().trim();
  const filtrados = result.data.filter((c) => {
    const municipioOk = !municipioFiltro ||
      c.unidadeOrgao.municipioNome?.toLowerCase().includes(municipioFiltro);
    return municipioOk && filtragemPorPalavras(c, monitor.palavrasChave ?? []);
  });

  const existingIds = filtrados.length > 0
    ? (await db.select({ pncpId: monitorAlertsTable.pncpId })
        .from(monitorAlertsTable)
        .where(eq(monitorAlertsTable.monitorId, monitor.id))).map((r) => r.pncpId)
    : [];

  const novos = filtrados.filter((c) => {
    const id = `${c.orgaoEntidade.cnpj}-${c.anoCompra}-${c.sequencialCompra}`;
    return !existingIds.includes(id);
  });

  if (novos.length > 0) {
    await db.insert(monitorAlertsTable).values(
      novos.map((c) => ({
        monitorId: monitor.id,
        userId,
        titulo: c.objetoCompra,
        modalidade: MODALIDADES[c.modalidadeId] ?? c.modalidadeNome,
        orgao: c.orgaoEntidade.razaoSocial,
        municipio: c.unidadeOrgao.municipioNome,
        uf: c.unidadeOrgao.ufSigla,
        dataPublicacao: c.dataPublicacaoPncp,
        urlPncp: pncpUrl(c.orgaoEntidade.cnpj, c.anoCompra, c.sequencialCompra),
        pncpId: `${c.orgaoEntidade.cnpj}-${c.anoCompra}-${c.sequencialCompra}`,
      })),
    );
  }

  await db
    .update(monitorsTable)
    .set({ lastCheckedAt: dataFinal })
    .where(eq(monitorsTable.id, monitor.id));

  return novos.length;
}

export default router;
