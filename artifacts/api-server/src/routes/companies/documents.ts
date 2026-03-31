import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { companiesTable, companyDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router({ mergeParams: true });

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "company-documents");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use PDF, imagem ou documento Word."));
    }
  },
});

function computeDocumentStatus(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "sem_validade";
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "vencido";
  if (diffDays <= 30) return "vencendo";
  return "valido";
}

function formatDoc(doc: typeof companyDocumentsTable.$inferSelect) {
  return {
    ...doc,
    status: computeDocumentStatus(doc.expiryDate),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  if (isNaN(companyId)) {
    res.status(400).json({ error: "Invalid company ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const docs = await db
    .select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.companyId, companyId));

  res.json(docs.map(formatDoc));
});

router.post("/", upload.single("file"), async (req, res) => {
  const companyId = parseInt(req.params.id!);
  if (isNaN(companyId)) {
    res.status(400).json({ error: "Invalid company ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const isoDateOptional = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD").optional();
  const schema = z.object({
    title: z.string().min(1),
    documentType: z.string().min(1),
    issueDate: isoDateOptional,
    expiryDate: isoDateOptional,
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const expiryDate = parsed.data.expiryDate || null;
  const status = computeDocumentStatus(expiryDate);

  const [doc] = await db
    .insert(companyDocumentsTable)
    .values({
      companyId,
      title: parsed.data.title,
      documentType: parsed.data.documentType,
      originalName: req.file.originalname,
      filePath: req.file.filename,
      issueDate: parsed.data.issueDate || null,
      expiryDate,
      status,
      notes: parsed.data.notes || null,
    })
    .returning();

  res.status(201).json(formatDoc(doc!));
});

router.patch("/:docId", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const docId = parseInt(req.params.docId!);
  if (isNaN(companyId) || isNaN(docId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const isoDateNullableOptional = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD").nullable().optional();
  const schema = z.object({
    title: z.string().min(1).optional(),
    documentType: z.string().min(1).optional(),
    issueDate: isoDateNullableOptional,
    expiryDate: isoDateNullableOptional,
    notes: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.id, docId));

  if (!existing || existing.companyId !== companyId) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if ("expiryDate" in parsed.data) {
    updateData.status = computeDocumentStatus(parsed.data.expiryDate ?? null);
  }

  const [doc] = await db
    .update(companyDocumentsTable)
    .set(updateData)
    .where(eq(companyDocumentsTable.id, docId))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(formatDoc(doc));
});

router.delete("/:docId", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const docId = parseInt(req.params.docId!);
  if (isNaN(companyId) || isNaN(docId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));

  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const [doc] = await db
    .select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.id, docId));

  if (!doc || doc.companyId !== companyId) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, doc.filePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.id, docId));
  res.status(204).send();
});

export default router;
