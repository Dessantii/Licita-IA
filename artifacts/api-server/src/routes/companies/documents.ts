import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { companiesTable, companyDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { url: string }) => { getText: () => Promise<{ text: string }> };
};

// ── Document metadata extraction ─────────────────────────────────────────────

async function getRawText(filePath: string, mime: string): Promise<{ text: string; viaVision: boolean }> {
  if (mime === "application/pdf") {
    try {
      const parser = new PDFParse({ url: `file://${filePath}` });
      const data = await parser.getText();
      const text = data.text.trim();
      if (text.length > 30) return { text, viaVision: false };
    } catch {
      // fall through
    }
  }

  if (mime.startsWith("image/")) {
    const imgBuffer = fs.readFileSync(filePath);
    const b64 = imgBuffer.toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          { type: "text", text: "Extraia todo o texto deste documento brasileiro. Retorne apenas o texto bruto extraído, sem formatação extra." },
        ],
      }],
      max_tokens: 2000,
    });
    return { text: res.choices[0]?.message?.content ?? "", viaVision: true };
  }

  return { text: "", viaVision: false };
}

const TIPO_VALORES = [
  "cnpj", "estatuto_social", "ata_eleicao", "certidao_federal",
  "certidao_estadual", "certidao_municipal", "certidao_trabalhista",
  "certidao_fgts", "balanco_patrimonial", "declaracao", "procuracao", "outros",
] as const;

const AI_EXTRACTION_PROMPT = `Você é especialista em documentos empresariais brasileiros. Analise o texto abaixo e extraia as seguintes informações.

Retorne SOMENTE um JSON válido (sem markdown, sem texto extra) com esta estrutura exata:
{
  "titulo": "nome oficial completo do documento (ex: Certidão Negativa de Débitos Relativos às Contribuições Previdenciárias)",
  "tipo": "um dos valores: cnpj | estatuto_social | ata_eleicao | certidao_federal | certidao_estadual | certidao_municipal | certidao_trabalhista | certidao_fgts | balanco_patrimonial | declaracao | procuracao | outros",
  "dataEmissao": "data de emissão no formato YYYY-MM-DD ou null",
  "dataValidade": "data de validade/vencimento no formato YYYY-MM-DD ou null"
}

Regras:
- titulo: use o nome oficial que aparece no cabeçalho do documento; se não houver, descreva brevemente o tipo de documento
- tipo: classifique com base no conteúdo; certidão da Receita Federal/PGFN → certidao_federal; CNDT → certidao_trabalhista; CRF/FGTS → certidao_fgts; cartão CNPJ → cnpj
- dataEmissao: procure termos como "emissão", "emitida em", "data de emissão", "gerada em", "expedida em"
- dataValidade: procure termos como "válido até", "válida até", "validade", "vencimento", "data de vencimento"
- Se uma data não existir no documento, use null
- Datas devem ser YYYY-MM-DD

TEXTO DO DOCUMENTO:
`;

async function extractDocMetadata(
  filePath: string,
  mime: string,
  filename: string,
): Promise<{ titulo: string; tipo: string; dataEmissao: string | null; dataValidade: string | null; aiUsed: boolean }> {
  const { text, viaVision } = await getRawText(filePath, mime);

  if (!text.trim()) {
    return {
      titulo: filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim(),
      tipo: "outros",
      dataEmissao: null,
      dataValidade: null,
      aiUsed: false,
    };
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: AI_EXTRACTION_PROMPT + text.slice(0, 6000) }],
    temperature: 0,
    max_tokens: 300,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      titulo: filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim(),
      tipo: "outros",
      dataEmissao: null,
      dataValidade: null,
      aiUsed: true,
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validTipos = new Set(TIPO_VALORES as readonly string[]);

  return {
    titulo: parsed.titulo ?? filename.replace(/\.[^.]+$/, ""),
    tipo: validTipos.has(parsed.tipo) ? parsed.tipo : "outros",
    dataEmissao: parsed.dataEmissao ?? null,
    dataValidade: parsed.dataValidade ?? null,
    aiUsed: true,
  };
}

const tempUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `doc-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

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

// POST /api/companies/analyze-doc — analyze file metadata before saving
router.post("/analyze-doc", tempUpload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }

  const tmpPath = req.file.path;
  const originalName = req.file.originalname;
  const mime = req.file.mimetype;

  try {
    const result = await extractDocMetadata(tmpPath, mime, originalName);
    res.json(result);
  } catch (err) {
    console.error("analyze-doc error:", err);
    res.status(500).json({ error: "Erro ao analisar documento" });
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
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
