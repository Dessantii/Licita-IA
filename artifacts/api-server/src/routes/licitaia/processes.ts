import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  processesTable,
  uploadedFilesTable,
  extractedRequirementsTable,
  validationItemsTable,
  submittedDocumentsTable,
  finalReportsTable,
  companiesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createProcessSchema = z.object({
  title: z.string().min(1),
  agency: z.string().min(1),
  modality: z.string().min(1),
  editalNumber: z.string().nullish(),
  deadline: z.string().nullish(),
  notes: z.string().nullish(),
  companyId: z.number().nullable().optional(),
});

const updateProcessSchema = z.object({
  title: z.string().min(1).optional(),
  agency: z.string().min(1).optional(),
  modality: z.string().min(1).optional(),
  editalNumber: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  companyId: z.number().nullable().optional(),
  status: z.enum([
    "criado",
    "edital_enviado",
    "edital_processando",
    "exigencias_extraidas",
    "aguardando_documentos",
    "documentos_enviados",
    "em_conferencia",
    "pendencias_encontradas",
    "pronto_para_revisao",
    "concluido",
  ]).optional(),
});

router.get("/", async (req, res) => {
  const companyIdParam = req.query.companyId ? parseInt(req.query.companyId as string) : null;
  const query = db.select().from(processesTable).$dynamic();
  const processes = await (companyIdParam && !isNaN(companyIdParam)
    ? query.where(eq(processesTable.companyId, companyIdParam))
    : query
  ).orderBy(processesTable.createdAt);
  const companies = await db.select({ id: companiesTable.id, razaoSocial: companiesTable.razaoSocial }).from(companiesTable);
  const companyMap = new Map(companies.map(c => [c.id, c.razaoSocial]));
  res.json(processes.map(p => ({
    ...p,
    companyName: p.companyId ? (companyMap.get(p.companyId) ?? null) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const parsed = createProcessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [process] = await db.insert(processesTable).values(parsed.data).returning();
  res.status(201).json({
    ...process,
    createdAt: process!.createdAt.toISOString(),
    updatedAt: process!.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [process] = await db.select().from(processesTable).where(eq(processesTable.id, id));
  if (!process) {
    res.status(404).json({ error: "Process not found" });
    return;
  }

  let companyName: string | null = null;
  if (process.companyId) {
    const [company] = await db.select({ razaoSocial: companiesTable.razaoSocial }).from(companiesTable).where(eq(companiesTable.id, process.companyId));
    companyName = company?.razaoSocial ?? null;
  }

  const files = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.processId, id));
  const requirements = await db.select().from(extractedRequirementsTable).where(eq(extractedRequirementsTable.processId, id));
  
  const validationRaw = await db.select().from(validationItemsTable)
    .where(eq(validationItemsTable.processId, id));

  const submittedDocs = await db.select().from(submittedDocumentsTable).where(eq(submittedDocumentsTable.processId, id));
  
  const validationItems = validationRaw.map(v => {
    const req = requirements.find(r => r.id === v.requirementId);
    const doc = submittedDocs.find(d => d.id === v.submittedDocumentId);
    return {
      ...v,
      requirement: req ? {
        ...req,
        createdAt: req.createdAt.toISOString(),
      } : undefined,
      submittedDocument: doc ? {
        ...doc,
        createdAt: doc.createdAt.toISOString(),
      } : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  });

  const [report] = await db.select().from(finalReportsTable).where(eq(finalReportsTable.processId, id));

  const editalFile = files.find(f => f.fileType === "edital");
  const documentFiles = files.filter(f => f.fileType === "documento_empresa");

  res.json({
    ...process,
    companyName,
    createdAt: process.createdAt.toISOString(),
    updatedAt: process.updatedAt.toISOString(),
    sessionDate: process.sessionDate ? process.sessionDate.toISOString() : null,
    postSessionHabilitacaoDeadline: process.postSessionHabilitacaoDeadline?.toISOString() ?? null,
    adjudicatedAt: process.adjudicatedAt?.toISOString() ?? null,
    homologatedAt: process.homologatedAt?.toISOString() ?? null,
    editalFile: editalFile ? { ...editalFile, uploadedAt: editalFile.uploadedAt.toISOString() } : null,
    documentFiles: documentFiles.map(f => ({ ...f, uploadedAt: f.uploadedAt.toISOString() })),
    requirements: requirements.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    validationItems,
    report: report ? { ...report, generatedAt: report.generatedAt.toISOString() } : null,
  });
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updateProcessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [process] = await db.update(processesTable)
    .set(parsed.data)
    .where(eq(processesTable.id, id))
    .returning();
  
  if (!process) {
    res.status(404).json({ error: "Process not found" });
    return;
  }

  res.json({
    ...process,
    createdAt: process.createdAt.toISOString(),
    updatedAt: process.updatedAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db.delete(processesTable).where(eq(processesTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Process not found" });
    return;
  }

  res.status(204).send();
});

router.get("/:id/files", async (req, res) => {
  const id = parseInt(req.params.id!);
  const files = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.processId, id));
  res.json(files.map(f => ({ ...f, uploadedAt: f.uploadedAt.toISOString() })));
});

router.get("/:id/requirements", async (req, res) => {
  const id = parseInt(req.params.id!);
  const requirements = await db.select().from(extractedRequirementsTable).where(eq(extractedRequirementsTable.processId, id));
  res.json(requirements.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.get("/:id/validation", async (req, res) => {
  const id = parseInt(req.params.id!);
  const requirements = await db.select().from(extractedRequirementsTable).where(eq(extractedRequirementsTable.processId, id));
  const validationRaw = await db.select().from(validationItemsTable).where(eq(validationItemsTable.processId, id));
  const submittedDocs = await db.select().from(submittedDocumentsTable).where(eq(submittedDocumentsTable.processId, id));

  const validationItems = validationRaw.map(v => {
    const req = requirements.find(r => r.id === v.requirementId);
    const doc = submittedDocs.find(d => d.id === v.submittedDocumentId);
    return {
      ...v,
      requirement: req ? { ...req, createdAt: req.createdAt.toISOString() } : undefined,
      submittedDocument: doc ? { ...doc, createdAt: doc.createdAt.toISOString() } : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  });

  res.json(validationItems);
});

router.get("/:id/report", async (req, res) => {
  const id = parseInt(req.params.id!);
  const [report] = await db.select().from(finalReportsTable).where(eq(finalReportsTable.processId, id));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json({ ...report, generatedAt: report.generatedAt.toISOString() });
});

export default router;
