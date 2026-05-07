import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { monitorsTable, monitorAlertsTable, notificationSettingsTable, processesTable, uploadedFilesTable } from "@workspace/db";
import { eq, and, desc, count, ilike, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { buscarPublicacoesPncp, filtragemPorPalavras, pncpUrl, MODALIDADES } from "../../services/pncp";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

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

router.get("/notification-settings", async (req, res) => {
  const userId = (req as any).userId as number;
  const [settings] = await db
    .select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.userId, userId));
  if (!settings) {
    const [created] = await db
      .insert(notificationSettingsTable)
      .values({ userId, enabled: true, palavrasChave: [] })
      .returning();
    res.json(created);
    return;
  }
  res.json(settings);
});

const notificationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  palavrasChave: z.array(z.string()).optional(),
});

router.patch("/notification-settings", async (req, res) => {
  const userId = (req as any).userId as number;
  const parsed = notificationSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const existing = await db
    .select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.userId, userId));
  if (existing.length === 0) {
    const [created] = await db
      .insert(notificationSettingsTable)
      .values({ userId, enabled: true, palavrasChave: [], ...parsed.data })
      .returning();
    res.json(created);
    return;
  }
  const [updated] = await db
    .update(notificationSettingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(notificationSettingsTable.userId, userId))
    .returning();
  res.json(updated);
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

router.post("/import-from-pncp", async (req, res) => {
  const { urlPncp, title, agency, modality, companyId } = req.body as {
    urlPncp: string;
    title: string;
    agency: string;
    modality: string;
    companyId?: number | null;
  };

  if (!urlPncp || !title || !agency) {
    res.status(400).json({ error: "Dados obrigatórios ausentes." });
    return;
  }

  const match = urlPncp.match(/\/editais\/(\d+)\/(\d{4})\/(\d+)/);
  if (!match) {
    res.status(400).json({ error: "URL PNCP inválida." });
    return;
  }

  const [, cnpj, anoStr, seqStr] = match;
  const sequencial = parseInt(seqStr, 10);

  let docs: any[] = [];
  try {
    const docsApiUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${anoStr}/${sequencial}/arquivos`;
    const docsRes = await fetch(docsApiUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (docsRes.ok) {
      const body = await docsRes.json();
      docs = Array.isArray(body) ? body : [];
    }
  } catch {
    // Continue — process will be created without edital
  }

  const editalDoc = docs.find((d: any) =>
    d.url && (
      d.tipoDocumentoDescricao?.toLowerCase().includes("edital") ||
      d.titulo?.toLowerCase().includes("edital")
    )
  ) ?? docs.find((d: any) => d.url) ?? null;

  const [process] = await db.insert(processesTable).values({
    title,
    agency,
    modality: modality || "Não informada",
    status: editalDoc ? "edital_enviado" : "criado",
    companyId: companyId ?? null,
  }).returning();

  if (!process) {
    res.status(500).json({ error: "Erro ao criar processo." });
    return;
  }

  let editalDownloaded = false;

  if (editalDoc) {
    const downloadUrl = editalDoc.url as string;
    try {
      const fileRes = await fetch(downloadUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (fileRes.ok) {
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const filename = `edital_${process.id}_${Date.now()}.pdf`;
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        fs.writeFileSync(`${UPLOADS_DIR}/${filename}`, buffer);
        const docName = (editalDoc.titulo as string | undefined) ?? "Edital";
        await db.insert(uploadedFilesTable).values({
          processId: process.id,
          fileType: "edital",
          name: docName.length > 200 ? docName.slice(0, 200) : docName,
          path: `/uploads/${filename}`,
          mimeType: "application/pdf",
          size: buffer.length,
        });
        editalDownloaded = true;
      }
    } catch {
      // Download failed — process still exists, just without edital
    }
  }

  res.status(201).json({ processId: process.id, editalDownloaded });
});

export async function checkMonitor(monitor: typeof monitorsTable.$inferSelect, userId: number): Promise<number> {
  const dataFinal = new Date();

  const MAX_LOOKBACK_DAYS = 7;
  const maxDataInicial = new Date(Date.now() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const rawDataInicial = monitor.lastCheckedAt
    ? new Date(monitor.lastCheckedAt)
    : maxDataInicial;
  const dataInicial = rawDataInicial < maxDataInicial ? maxDataInicial : rawDataInicial;

  const municipioFiltro = monitor.municipio?.toLowerCase().trim();

  const existingIds = new Set(
    (await db.select({ pncpId: monitorAlertsTable.pncpId })
      .from(monitorAlertsTable)
      .where(eq(monitorAlertsTable.monitorId, monitor.id))).map((r) => r.pncpId)
  );

  const allNovos: typeof monitorAlertsTable.$inferInsert[] = [];

  const MAX_PAGES = municipioFiltro ? 20 : 5;

  let pagina = 1;
  while (pagina <= MAX_PAGES) {
    let result;
    try {
      result = await buscarPublicacoesPncp({
        dataInicial,
        dataFinal,
        uf: monitor.uf ?? undefined,
        modalidadeId: monitor.modalidadeId ?? undefined,
        pagina,
        tamanhoPagina: 50,
      });
    } catch {
      break;
    }

    if (!result.data.length) break;

    const filtrados = result.data.filter((c) => {
      const municipioOk = !municipioFiltro ||
        c.unidadeOrgao.municipioNome?.toLowerCase().includes(municipioFiltro);
      return municipioOk && filtragemPorPalavras(c, monitor.palavrasChave ?? []);
    });

    for (const c of filtrados) {
      const pncpId = `${c.orgaoEntidade.cnpj}-${c.anoCompra}-${c.sequencialCompra}`;
      if (!existingIds.has(pncpId)) {
        existingIds.add(pncpId);
        allNovos.push({
          monitorId: monitor.id,
          userId,
          titulo: c.objetoCompra,
          modalidade: MODALIDADES[c.modalidadeId] ?? c.modalidadeNome,
          orgao: c.orgaoEntidade.razaoSocial,
          municipio: c.unidadeOrgao.municipioNome,
          uf: c.unidadeOrgao.ufSigla,
          dataPublicacao: c.dataPublicacaoPncp,
          urlPncp: pncpUrl(c.orgaoEntidade.cnpj, c.anoCompra, c.sequencialCompra),
          pncpId,
        });
      }
    }

    if (pagina >= result.totalPaginas) break;
    pagina++;
  }

  if (allNovos.length > 0) {
    for (let i = 0; i < allNovos.length; i += 100) {
      await db.insert(monitorAlertsTable).values(allNovos.slice(i, i + 100));
    }
  }

  await db
    .update(monitorsTable)
    .set({ lastCheckedAt: dataFinal })
    .where(eq(monitorsTable.id, monitor.id));

  return allNovos.length;
}

export default router;
