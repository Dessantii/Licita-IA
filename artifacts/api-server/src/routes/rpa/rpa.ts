import { Router, type IRouter } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@workspace/db";
import {
  rpaJobsTable, rpaLogsTable,
  createRpaJobSchema,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { enqueueJob } from "../../rpa/queue.js";
import { ComprasGovAutomation } from "../../rpa/automation.js";
import { logger } from "../../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, "../../../storage/screenshots");

const router: IRouter = Router();

router.get("/jobs", async (_req, res) => {
  const jobs = await db
    .select()
    .from(rpaJobsTable)
    .orderBy(desc(rpaJobsTable.criadoEm))
    .limit(100);
  res.json(jobs);
});

router.get("/jobs/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [job] = await db.select().from(rpaJobsTable).where(eq(rpaJobsTable.id, id));
  if (!job) { res.status(404).json({ error: "Job não encontrado" }); return; }

  const logs = await db
    .select()
    .from(rpaLogsTable)
    .where(eq(rpaLogsTable.jobId, id))
    .orderBy(desc(rpaLogsTable.timestamp));

  res.json({ job, logs });
});

router.get("/logs/:processoId", async (req, res) => {
  const processoId = parseInt(req.params.processoId!);
  if (isNaN(processoId)) { res.status(400).json({ error: "processo_id inválido" }); return; }

  const logs = await db
    .select()
    .from(rpaLogsTable)
    .where(eq(rpaLogsTable.processoId, processoId))
    .orderBy(desc(rpaLogsTable.timestamp));

  res.json(logs);
});

router.post("/jobs", async (req, res) => {
  const parsed = createRpaJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", issues: parsed.error.issues });
    return;
  }
  const job = await enqueueJob(parsed.data as any);
  res.status(201).json(job);
});

router.post("/jobs/:id/cancelar", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [job] = await db.select().from(rpaJobsTable).where(eq(rpaJobsTable.id, id));
  if (!job) { res.status(404).json({ error: "Job não encontrado" }); return; }

  if (!["pendente"].includes(job.status)) {
    res.status(409).json({ error: `Não é possível cancelar job com status "${job.status}"` });
    return;
  }

  const [updated] = await db
    .update(rpaJobsTable)
    .set({ status: "cancelado", finalizadoEm: new Date() })
    .where(eq(rpaJobsTable.id, id))
    .returning();

  res.json(updated);
});

router.post("/jobs/:id/retentar", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [job] = await db.select().from(rpaJobsTable).where(eq(rpaJobsTable.id, id));
  if (!job) { res.status(404).json({ error: "Job não encontrado" }); return; }

  if (!["erro", "cancelado"].includes(job.status)) {
    res.status(409).json({ error: `Não é possível retentar job com status "${job.status}"` });
    return;
  }

  const [updated] = await db
    .update(rpaJobsTable)
    .set({
      status: "pendente",
      tentativasRealizadas: 0,
      errorType: null,
      errorMessage: null,
      finalizadoEm: null,
      iniciadoEm: null,
      proximaTentativaEm: null,
    })
    .where(eq(rpaJobsTable.id, id))
    .returning();

  res.json(updated);
});

router.post("/testar-conexao", async (_req, res) => {
  const automation = new ComprasGovAutomation();
  const startedAt = new Date();

  try {
    await automation.iniciar(0);

    const page = (automation as any).page;
    await page.goto("https://www.compras.gov.br", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const title = await page.title();
    const url = page.url();
    const screenshotPath = await automation.tirarScreenshot(`teste_conexao_${Date.now()}`);

    const durationMs = Date.now() - startedAt.getTime();

    res.json({
      acessivel: true,
      url,
      title,
      durationMs,
      screenshotPath: screenshotPath
        ? path.relative(path.resolve(__dirname, "../../.."), screenshotPath)
        : null,
      testedAt: startedAt.toISOString(),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "RPA: teste de conexão falhou");
    const screenshotPath = await automation.tirarScreenshot(`teste_erro_${Date.now()}`).catch(() => null);

    res.status(502).json({
      acessivel: false,
      error: err.message,
      screenshotPath: screenshotPath
        ? path.relative(path.resolve(__dirname, "../../.."), screenshotPath)
        : null,
      testedAt: startedAt.toISOString(),
    });
  } finally {
    await automation.encerrar();
  }
});

export default router;
