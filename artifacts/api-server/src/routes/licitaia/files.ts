import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  processesTable,
  uploadedFilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

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
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (allowed.includes(file.mimetype) || file.mimetype.includes("pdf")) {
      cb(null, true);
    } else {
      cb(null, true);
    }
  },
});

router.post("/processes/:id/upload-edital", upload.single("file"), async (req, res) => {
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

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [file] = await db.insert(uploadedFilesTable).values({
    processId: id,
    fileType: "edital",
    name: req.file.originalname,
    path: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  }).returning();

  await db.update(processesTable)
    .set({ status: "edital_enviado" })
    .where(eq(processesTable.id, id));

  res.json({ ...file, uploadedAt: file!.uploadedAt.toISOString() });
});

router.post("/processes/:id/upload-document", upload.single("file"), async (req, res) => {
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

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [file] = await db.insert(uploadedFilesTable).values({
    processId: id,
    fileType: "documento_empresa",
    name: req.file.originalname,
    path: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
  }).returning();

  const currentStatus = process.status;
  if (currentStatus === "exigencias_extraidas" || currentStatus === "aguardando_documentos") {
    await db.update(processesTable)
      .set({ status: "documentos_enviados" })
      .where(eq(processesTable.id, id));
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
    .update(uploadedFilesTable)
    .set({ dataValidade: dataValidade || null })
    .where(eq(uploadedFilesTable.id, id))
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

  const [file] = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.id, id));
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, file.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await db.delete(uploadedFilesTable).where(eq(uploadedFilesTable.id, id));
  res.status(204).send();
});

export default router;
