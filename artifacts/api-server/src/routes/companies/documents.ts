import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { companiesTable, companyDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const VALID_DOC_TYPES = [
  "cnpj",
  "estatuto_social",
  "ata_eleicao",
  "certidao_federal",
  "certidao_estadual",
  "certidao_municipal",
  "certidao_trabalhista",
  "certidao_fgts",
  "balanco_patrimonial",
  "declaracao",
  "procuracao",
  "outros",
] as const;

const docTypeSchema = z.enum(VALID_DOC_TYPES);

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
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

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function formatDocument(d: typeof companyDocumentsTable.$inferSelect) {
  return {
    ...d,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

router.post("/:id/documents", upload.single("file"), async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const rawType = (req.body.tipo as string) || "outros";
  const parsedType = docTypeSchema.safeParse(rawType);
  if (!parsedType.success) {
    res.status(400).json({ error: `Tipo inválido: "${rawType}". Valores aceitos: ${VALID_DOC_TYPES.join(", ")}` });
    return;
  }

  const titulo = (req.body.titulo as string) || req.file.originalname;
  const dataEmissao = (req.body.dataEmissao as string) || null;
  const dataValidade = (req.body.dataValidade as string) || null;

  const [doc] = await db.insert(companyDocumentsTable).values({
    companyId: id,
    titulo,
    tipo: parsedType.data,
    dataEmissao,
    dataValidade,
    name: req.file.originalname,
    path: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  }).returning();

  res.status(201).json(formatDocument(doc!));
});

router.delete("/:companyId/documents/:docId", async (req, res) => {
  const docId = parseInt(req.params.docId!);
  if (isNaN(docId)) {
    res.status(400).json({ error: "Invalid document ID" });
    return;
  }

  const [doc] = await db.select().from(companyDocumentsTable).where(eq(companyDocumentsTable.id, docId));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, doc.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.id, docId));
  res.status(204).send();
});

export default router;
