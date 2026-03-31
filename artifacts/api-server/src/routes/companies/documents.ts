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

// ── Document metadata extraction helpers ─────────────────────────────────────

const MONTHS: Record<string, string> = {
  janeiro: "01", fevereiro: "02", março: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", agosto: "08",
  setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

function ddmmyyyyToIso(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Extract all dates from text, returning { date: ISO, context: surrounding text } */
function extractDatesWithContext(text: string): Array<{ iso: string; ctx: string }> {
  const results: Array<{ iso: string; ctx: string }> = [];
  const t = text.toLowerCase();

  // Pattern: DD/MM/YYYY
  const numRe = /(\d{2})\/(\d{2})\/(\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(t)) !== null) {
    const [, d, mo, y] = m;
    if (parseInt(mo!) > 12 || parseInt(d!) > 31) continue;
    const ctx = t.slice(Math.max(0, m.index - 80), m.index + 20);
    results.push({ iso: ddmmyyyyToIso(d!, mo!, y!), ctx });
  }

  // Pattern: DD de mês de YYYY
  const textRe = /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/g;
  while ((m = textRe.exec(t)) !== null) {
    const [, d, monthName, y] = m;
    const mo = MONTHS[monthName!];
    if (!mo) continue;
    const ctx = t.slice(Math.max(0, m.index - 80), m.index + 20);
    results.push({ iso: ddmmyyyyToIso(d!, mo, y!), ctx });
  }

  return results;
}

const VALIDADE_KEYWORDS = ["válido até", "válida até", "validade", "vencimento", "expira em", "expiração", "data de vencimento", "expira", "válido"];
const EMISSAO_KEYWORDS = ["emitid", "emissão", "expedid", "gerada em", "data de emissão", "data de consulta", "extraída em", "data de extração", "emitida em", "emitido em"];

function classifyDateByContext(ctx: string): "validade" | "emissao" | "unknown" {
  for (const kw of VALIDADE_KEYWORDS) {
    if (ctx.includes(kw)) return "validade";
  }
  for (const kw of EMISSAO_KEYWORDS) {
    if (ctx.includes(kw)) return "emissao";
  }
  return "unknown";
}

const TYPE_KEYWORD_MAP: Array<{ keywords: string[]; tipo: string }> = [
  { keywords: ["cartão cnpj", "comprovante de inscrição", "situação cadastral", "cnpj"], tipo: "cnpj" },
  { keywords: ["estatuto social", "contrato social"], tipo: "estatuto_social" },
  { keywords: ["ata de eleição", "ata de reunião", "eleição de diretores", "assembleia"], tipo: "ata_eleicao" },
  { keywords: ["certidão negativa de débitos trabalhistas", "cndt", "trabalhista"], tipo: "certidao_trabalhista" },
  { keywords: ["certificado de regularidade do fgts", "fgts", "crf fgts"], tipo: "certidao_fgts" },
  { keywords: ["certidão negativa de débitos federal", "certidão conjunta", "receita federal", "pgfn", "certidão federal", "certidão referente"], tipo: "certidao_federal" },
  { keywords: ["certidão estadual", "sefaz", "fazenda estadual", "tributos estaduais"], tipo: "certidao_estadual" },
  { keywords: ["certidão municipal", "tributos municipais", "fazenda municipal", "issqn", "iss"], tipo: "certidao_municipal" },
  { keywords: ["balanço patrimonial", "demonstração de resultado", "demonstrações contábeis"], tipo: "balanco_patrimonial" },
  { keywords: ["declaração"], tipo: "declaracao" },
  { keywords: ["procuração"], tipo: "procuracao" },
];

function detectDocType(text: string, filename: string): string {
  const combined = (text.slice(0, 3000) + " " + filename).toLowerCase();
  for (const { keywords, tipo } of TYPE_KEYWORD_MAP) {
    if (keywords.some(kw => combined.includes(kw))) return tipo;
  }
  return "outros";
}

function detectDocTitle(text: string, filename: string): string {
  // Try to find a meaningful title in the first lines
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 8 && l.length < 120 && /[A-ZÀ-Ú]/.test(l))
    .slice(0, 15);

  // Find first line that looks like a document title (all-caps or title-case, ≥ 4 words)
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 3 && words.length <= 15) {
      return line.replace(/[*_|]+/g, "").trim();
    }
  }
  // Fallback: clean up filename
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

async function extractTextFromFile(
  filePath: string,
  mime: string
): Promise<{ text: string; aiUsed: boolean }> {
  if (mime === "application/pdf") {
    try {
      const parser = new PDFParse({ url: `file://${filePath}` });
      const data = await parser.getText();
      const text = data.text.trim();
      if (text.length > 50) return { text, aiUsed: false };
    } catch {
      // fall through to AI
    }
  }

  if (mime.startsWith("image/")) {
    const imgBuffer = fs.readFileSync(filePath);
    const b64 = imgBuffer.toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;
    const visionRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          { type: "text", text: "Extraia todo o texto deste documento. Retorne apenas o texto extraído, sem formatação extra." },
        ],
      }],
      max_tokens: 2000,
    });
    const text = visionRes.choices[0]?.message?.content ?? "";
    return { text, aiUsed: true };
  }

  return { text: "", aiUsed: false };
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
    const { text, aiUsed } = await extractTextFromFile(tmpPath, mime);

    const dates = extractDatesWithContext(text);
    let dataEmissao: string | null = null;
    let dataValidade: string | null = null;
    const unknownDates: string[] = [];

    for (const { iso, ctx } of dates) {
      const classification = classifyDateByContext(ctx);
      if (classification === "validade" && !dataValidade) dataValidade = iso;
      else if (classification === "emissao" && !dataEmissao) dataEmissao = iso;
      else if (classification === "unknown") unknownDates.push(iso);
    }

    // If we couldn't classify, use unknowns as fallback (first=emissao, last=validade if diff)
    if (!dataEmissao && unknownDates.length > 0) dataEmissao = unknownDates[0]!;
    if (!dataValidade && unknownDates.length > 1) dataValidade = unknownDates[unknownDates.length - 1]!;

    const tipo = detectDocType(text, originalName);
    const titulo = detectDocTitle(text, originalName);

    res.json({ titulo, tipo, dataEmissao, dataValidade, aiUsed });
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
