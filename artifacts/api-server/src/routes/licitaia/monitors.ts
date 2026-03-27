import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { monitorsTable, monitorAlertsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
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
