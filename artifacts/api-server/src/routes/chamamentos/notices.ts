import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  callNoticesTable,
  noticeFilesTable,
  callExtractedRequirementsTable,
  callValidationItemsTable,
  callSubmittedDocumentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createCallNoticeSchema = z.object({
  title: z.string().min(1),
  agency: z.string().min(1),
  referenceNumber: z.string().nullish(),
  category: z.string().nullish(),
  deadline: z.string().nullish(),
  notes: z.string().nullish(),
});

const updateCallNoticeSchema = z.object({
  title: z.string().min(1).optional(),
  agency: z.string().min(1).optional(),
  referenceNumber: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum([
    "criado",
    "edital_enviado",
    "edital_processando",
    "requisitos_extraidos",
    "aguardando_documentos",
    "documentos_enviados",
    "em_conferencia",
    "pendencias_encontradas",
    "pronto_para_submissao",
    "concluido",
  ]).optional(),
});

router.get("/", async (_req, res) => {
  const notices = await db.select().from(callNoticesTable).orderBy(callNoticesTable.createdAt);
  res.json(notices.map(n => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const parsed = createCallNoticeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [notice] = await db.insert(callNoticesTable).values(parsed.data).returning();
  res.status(201).json({
    ...notice,
    createdAt: notice!.createdAt.toISOString(),
    updatedAt: notice!.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [notice] = await db.select().from(callNoticesTable).where(eq(callNoticesTable.id, id));
  if (!notice) {
    res.status(404).json({ error: "Call notice not found" });
    return;
  }

  const files = await db.select().from(noticeFilesTable).where(eq(noticeFilesTable.callNoticeId, id));
  const requirements = await db.select().from(callExtractedRequirementsTable).where(eq(callExtractedRequirementsTable.callNoticeId, id));

  const validationRaw = await db.select().from(callValidationItemsTable)
    .where(eq(callValidationItemsTable.callNoticeId, id));

  const submittedDocs = await db.select().from(callSubmittedDocumentsTable).where(eq(callSubmittedDocumentsTable.callNoticeId, id));

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

  const editalFile = files.find(f => f.fileType === "edital");
  const documentFiles = files.filter(f => f.fileType !== "edital");

  res.json({
    ...notice,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
    editalFile: editalFile ? { ...editalFile, uploadedAt: editalFile.uploadedAt.toISOString() } : null,
    documentFiles: documentFiles.map(f => ({ ...f, uploadedAt: f.uploadedAt.toISOString() })),
    requirements: requirements.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })),
    validationItems,
  });
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updateCallNoticeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [notice] = await db.update(callNoticesTable)
    .set(parsed.data)
    .where(eq(callNoticesTable.id, id))
    .returning();

  if (!notice) {
    res.status(404).json({ error: "Call notice not found" });
    return;
  }

  res.json({
    ...notice,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db.delete(callNoticesTable).where(eq(callNoticesTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Call notice not found" });
    return;
  }

  res.status(204).send();
});

router.get("/:id/files", async (req, res) => {
  const id = parseInt(req.params.id!);
  const files = await db.select().from(noticeFilesTable).where(eq(noticeFilesTable.callNoticeId, id));
  res.json(files.map(f => ({ ...f, uploadedAt: f.uploadedAt.toISOString() })));
});

router.get("/:id/requirements", async (req, res) => {
  const id = parseInt(req.params.id!);
  const requirements = await db.select().from(callExtractedRequirementsTable).where(eq(callExtractedRequirementsTable.callNoticeId, id));
  res.json(requirements.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.get("/:id/validation", async (req, res) => {
  const id = parseInt(req.params.id!);
  const requirements = await db.select().from(callExtractedRequirementsTable).where(eq(callExtractedRequirementsTable.callNoticeId, id));
  const validationRaw = await db.select().from(callValidationItemsTable).where(eq(callValidationItemsTable.callNoticeId, id));
  const submittedDocs = await db.select().from(callSubmittedDocumentsTable).where(eq(callSubmittedDocumentsTable.callNoticeId, id));

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

const updateValidationItemSchema = z.object({
  status: z.enum(["ok", "pendente", "divergente", "vencido", "incompleto", "revisar_manualmente"]).optional(),
  notes: z.string().nullable().optional(),
  submittedDocumentId: z.number().nullable().optional(),
});

router.patch("/validation/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updateValidationItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    return;
  }

  const { status, notes, submittedDocumentId } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (submittedDocumentId !== undefined) updateData.submittedDocumentId = submittedDocumentId;

  const [updated] = await db.update(callValidationItemsTable)
    .set(updateData)
    .where(eq(callValidationItemsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Validation item not found" });
    return;
  }

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
