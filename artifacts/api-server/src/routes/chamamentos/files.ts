import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { callNoticesTable, noticeFilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const VALID_FILE_TYPES = ["edital", "anexo", "documento_osc", "proposta", "plano_trabalho", "cronograma"] as const;
const fileTypeSchema = z.enum(VALID_FILE_TYPES);

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

router.post("/:id/upload-edital", upload.single("file"), async (req, res) => {
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

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [file] = await db.insert(noticeFilesTable).values({
    callNoticeId: id,
    fileType: "edital",
    name: req.file.originalname,
    path: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  }).returning();

  await db.update(callNoticesTable)
    .set({ status: "edital_enviado" })
    .where(eq(callNoticesTable.id, id));

  res.json({ ...file, uploadedAt: file!.uploadedAt.toISOString() });
});

router.post("/:id/upload-document", upload.single("file"), async (req, res) => {
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

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const rawFileType = (req.body.fileType as string) || "documento_osc";
  const parsedFileType = fileTypeSchema.safeParse(rawFileType);
  if (!parsedFileType.success) {
    res.status(400).json({ error: `Tipo de arquivo inválido: "${rawFileType}". Valores aceitos: ${VALID_FILE_TYPES.join(", ")}` });
    return;
  }
  const fileType = parsedFileType.data;

  const [file] = await db.insert(noticeFilesTable).values({
    callNoticeId: id,
    fileType,
    name: req.file.originalname,
    path: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  }).returning();

  const currentStatus = notice.status;
  if (currentStatus === "requisitos_extraidos" || currentStatus === "aguardando_documentos") {
    await db.update(callNoticesTable)
      .set({ status: "documentos_enviados" })
      .where(eq(callNoticesTable.id, id));
  }

  res.json({ ...file, uploadedAt: file!.uploadedAt.toISOString() });
});

router.patch("/files/:id/validity", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const { dataValidade } = req.body;
  const [file] = await db
    .update(noticeFilesTable)
    .set({ dataValidade: dataValidade || null })
    .where(eq(noticeFilesTable.id, id))
    .returning();
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.json({ ...file, uploadedAt: file.uploadedAt.toISOString() });
});

router.delete("/files/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [file] = await db.select().from(noticeFilesTable).where(eq(noticeFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, file.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await db.delete(noticeFilesTable).where(eq(noticeFilesTable.id, id));
  res.status(204).send();
});

export default router;
