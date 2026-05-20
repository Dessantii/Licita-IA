import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { companiesTable, companyDocumentsTable, certidaoHistoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { url: string }) => { getText: () => Promise<{ text: string }> };
};

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `certidao-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Apenas arquivos PDF são aceitos"));
  },
});

// ── Certidão type definitions ─────────────────────────────────────────────────

const CERTIDAO_DEFS: Record<string, {
  label: string;
  emissor: string;
  portalUrl: string;
  instructions: string;
  validityDays: number;
}> = {
  cnd_federal: {
    label: "CND Federal (Receita / PGFN)",
    emissor: "Receita Federal / PGFN",
    portalUrl: "https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet/pj/emitir",
    instructions: "1. Acesse o portal da Receita Federal\n2. Informe o CNPJ da empresa\n3. Clique em Emitir\n4. Baixe o PDF gerado\n5. Faça o upload aqui",
    validityDays: 180,
  },
  crf_fgts: {
    label: "CRF — Regularidade do FGTS",
    emissor: "Caixa Econômica Federal",
    portalUrl: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    instructions: "1. Acesse o portal da Caixa Econômica Federal\n2. Informe o CNPJ da empresa\n3. Clique em Consultar\n4. Baixe o PDF do CRF\n5. Faça o upload aqui",
    validityDays: 30,
  },
  cndt: {
    label: "CNDT — Certidão Trabalhista",
    emissor: "Tribunal Superior do Trabalho",
    portalUrl: "https://cndt-certidao.tst.jus.br/inicio.faces",
    instructions: "1. Acesse o portal do TST\n2. Informe o CNPJ da empresa\n3. Clique em Emitir\n4. Baixe o PDF da CNDT\n5. Faça o upload aqui",
    validityDays: 180,
  },
  certidao_estadual: {
    label: "Certidão Estadual (SEFAZ)",
    emissor: "Secretaria da Fazenda Estadual",
    portalUrl: "https://www.fazenda.sp.gov.br/certidaoCD/faces/index.xhtml",
    instructions: "1. Acesse o portal da SEFAZ do seu estado\n2. Informe o CNPJ da empresa\n3. Emita a certidão\n4. Baixe o PDF\n5. Faça o upload aqui",
    validityDays: 90,
  },
  certidao_municipal: {
    label: "Certidão Municipal (ISS)",
    emissor: "Prefeitura Municipal",
    portalUrl: "https://notadomilhao.prefeitura.sp.gov.br/",
    instructions: "1. Acesse o portal da Prefeitura do seu município\n2. Informe o CNPJ da empresa\n3. Emita a certidão de débitos municipais\n4. Baixe o PDF\n5. Faça o upload aqui",
    validityDays: 180,
  },
};

const VALID_TIPOS = Object.keys(CERTIDAO_DEFS);

// ── AI extraction ─────────────────────────────────────────────────────────────

const CERTIDAO_PROMPT = `Você é um assistente especializado em certidões brasileiras.
Analise o texto da certidão abaixo e extraia as informações em formato JSON.
Retorne APENAS o JSON, sem texto adicional, sem markdown.

Retorne:
{
  "tipo_certidao": "nome oficial da certidão",
  "emissor": "órgão emissor",
  "cnpj": "CNPJ consultado (apenas números, 14 dígitos)",
  "razao_social": "razão social da empresa",
  "resultado": "negativa|positiva|positiva_efeito_negativa|nao_identificado",
  "data_emissao": "DD/MM/AAAA",
  "data_validade": "DD/MM/AAAA ou null se não encontrada",
  "codigo_verificacao": "código ou null",
  "url_verificacao": "URL de verificação ou null",
  "observacoes": "informações relevantes adicionais ou null"
}

Regras:
- resultado "negativa" = empresa regular, sem débitos
- resultado "positiva" = empresa irregular, com débitos
- resultado "positiva_efeito_negativa" = tem débitos mas tem efeito de negativa (parcelado, suspenso)
- Para datas, use formato DD/MM/AAAA
- Se um campo não existir no documento, use null

TEXTO DA CERTIDÃO:
`;

async function extractCertidaoData(pdfPath: string): Promise<Record<string, any> | null> {
  try {
    const parser = new PDFParse({ url: `file://${pdfPath}` });
    const data = await parser.getText();
    const text = data.text.trim();

    if (!text || text.length < 20) return null;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: CERTIDAO_PROMPT + text.slice(0, 8000) }],
      temperature: 0,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("[certidoes] extract error:", err);
    return null;
  }
}

function parseDateBR(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [d, m, y] = dateStr.split("/");
  if (!d || !m || !y) return null;
  const parsed = new Date(`${y}-${m}-${d}T12:00:00Z`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function toISO(dateStr: string | null | undefined): string | null {
  const d = parseDateBR(dateStr);
  return d ? d.toISOString().split("T")[0]! : null;
}

function calcStatus(dataValidade: string | null): "valida" | "vencendo" | "vencida" | "nao_cadastrada" {
  if (!dataValidade) return "nao_cadastrada";
  const d = new Date(dataValidade + "T12:00:00");
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencida";
  if (diff <= 30) return "vencendo";
  return "valida";
}

// ── GET /api/companies/:id/certidoes ─────────────────────────────────────────

router.get("/:id/certidoes", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  if (isNaN(companyId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const docs = await db
    .select()
    .from(companyDocumentsTable)
    .where(and(
      eq(companyDocumentsTable.companyId, companyId),
    ))
    .orderBy(desc(companyDocumentsTable.uploadedAt));

  const result: Record<string, any> = {};

  for (const tipo of VALID_TIPOS) {
    const def = CERTIDAO_DEFS[tipo]!;
    const doc = docs.find(d => d.certidaoType === tipo);

    if (!doc) {
      result[tipo] = {
        tipo,
        label: def.label,
        emissor: def.emissor,
        portalUrl: def.portalUrl,
        status: "nao_cadastrada",
        dataEmissao: null,
        dataValidade: null,
        resultado: null,
        codigoVerificacao: null,
        fileUrl: doc ? `/api/companies/${companyId}/documents/${doc.id}/download` : null,
        metadata: null,
      };
    } else {
      const status = calcStatus(doc.dataValidade);
      const meta = doc.metadata as Record<string, any> | null;
      result[tipo] = {
        tipo,
        label: def.label,
        emissor: def.emissor,
        portalUrl: def.portalUrl,
        status,
        dataEmissao: doc.dataEmissao,
        dataValidade: doc.dataValidade,
        resultado: meta?.resultado ?? null,
        codigoVerificacao: meta?.codigo_verificacao ?? null,
        fileUrl: `/api/companies/${companyId}/documents/${doc.id}/download`,
        documentId: doc.id,
        metadata: meta,
      };
    }
  }

  res.json(result);
});

// ── GET /api/companies/:id/certidoes/:tipo/history ───────────────────────────

router.get("/:id/certidoes/:tipo/history", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const tipo = req.params.tipo!;
  if (isNaN(companyId) || !VALID_TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Parâmetros inválidos" }); return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const history = await db
    .select()
    .from(certidaoHistoryTable)
    .where(and(
      eq(certidaoHistoryTable.companyId, companyId),
      eq(certidaoHistoryTable.certidaoType, tipo),
    ))
    .orderBy(desc(certidaoHistoryTable.createdAt))
    .limit(10);

  res.json(history.map(h => ({
    ...h,
    issuedAt: h.issuedAt.toISOString(),
    expiresAt: h.expiresAt?.toISOString() ?? null,
    createdAt: h.createdAt.toISOString(),
  })));
});

// ── POST /api/companies/:id/certidoes/:tipo/extract ──────────────────────────

router.post("/:id/certidoes/:tipo/extract", upload.single("file"), async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const tipo = req.params.tipo!;

  if (isNaN(companyId) || !VALID_TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Parâmetros inválidos" }); return;
  }
  if (!req.file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) {
    fs.existsSync(req.file.path) && fs.unlinkSync(req.file.path);
    res.status(404).json({ error: "Empresa não encontrada" }); return;
  }

  const def = CERTIDAO_DEFS[tipo]!;
  const filePath = req.file.path;

  try {
    const extracted = await extractCertidaoData(filePath);

    const dataEmissao = extracted ? toISO(extracted.data_emissao) : null;
    const dataValidade = extracted ? toISO(extracted.data_validade) : null;
    const resultado = extracted?.resultado ?? "nao_identificado";
    const titulo = extracted?.tipo_certidao ?? def.label;

    const [doc] = await db.insert(companyDocumentsTable).values({
      companyId,
      titulo,
      tipo: tipo === "cnd_federal" ? "certidao_federal"
          : tipo === "crf_fgts" ? "certidao_fgts"
          : tipo === "cndt" ? "certidao_trabalhista"
          : tipo === "certidao_estadual" ? "certidao_estadual"
          : "certidao_municipal",
      certidaoType: tipo,
      dataEmissao,
      dataValidade,
      name: req.file.originalname || `${tipo}-${Date.now()}.pdf`,
      path: req.file.filename,
      mimeType: "application/pdf",
      size: req.file.size,
      source: "manual_upload",
      emissionMethod: "manual_upload",
      metadata: extracted ?? null,
    }).returning();

    if (extracted && dataEmissao) {
      await db.insert(certidaoHistoryTable).values({
        companyId,
        certidaoType: tipo,
        resultado,
        issuedAt: new Date(dataEmissao + "T12:00:00Z"),
        expiresAt: dataValidade ? new Date(dataValidade + "T12:00:00Z") : null,
        fileUrl: `/api/companies/${companyId}/documents/${doc!.id}/download`,
        extractionData: extracted,
        emissionMethod: "manual_upload",
      });
    }

    res.json({
      success: true,
      documentId: doc!.id,
      fileUrl: `/api/companies/${companyId}/documents/${doc!.id}/download`,
      extracted,
      dataEmissao,
      dataValidade,
      resultado,
      status: calcStatus(dataValidade),
    });
  } catch (err) {
    console.error("[certidoes] extract error:", err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "Erro ao processar o PDF" });
  }
});

// ── POST /api/companies/:id/certidoes/:tipo/emitir ───────────────────────────

router.post("/:id/certidoes/:tipo/emitir", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const tipo = req.params.tipo!;

  if (isNaN(companyId) || !VALID_TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Parâmetros inválidos" }); return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const def = CERTIDAO_DEFS[tipo]!;
  const puppeteerAvailable = (global as any).PUPPETEER_AVAILABLE === true;

  if (!puppeteerAvailable) {
    res.json({
      success: false,
      method: "manual",
      portalUrl: def.portalUrl,
      instructions: def.instructions,
      message: "A emissão automática não está disponível neste ambiente. Emita manualmente e faça o upload do PDF.",
    });
    return;
  }

  res.json({
    success: false,
    method: "manual",
    portalUrl: def.portalUrl,
    instructions: def.instructions,
    message: "Automação não implementada para este tipo de certidão. Emita manualmente e faça o upload do PDF.",
  });
});

// ── POST /api/companies/:id/certidoes/renovar-lote ───────────────────────────

router.post("/:id/certidoes/renovar-lote", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  if (isNaN(companyId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const tipos: string[] = req.body.tipos ?? [];
  const validTipos = tipos.filter(t => VALID_TIPOS.includes(t));

  const results: Record<string, any> = {};

  for (const tipo of validTipos) {
    const def = CERTIDAO_DEFS[tipo]!;
    results[tipo] = {
      success: false,
      method: "manual",
      portalUrl: def.portalUrl,
      instructions: def.instructions,
      message: "Emita manualmente e faça o upload do PDF.",
    };
  }

  res.json({ results });
});

// ── GET /api/companies/:id/documents/:docId/download ─────────────────────────

router.get("/:id/documents/:docId/download", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const docId = parseInt(req.params.docId!);
  if (isNaN(companyId) || isNaN(docId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const [doc] = await db.select().from(companyDocumentsTable).where(
    and(eq(companyDocumentsTable.id, docId), eq(companyDocumentsTable.companyId, companyId))
  );
  if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }

  const filePath = path.join(UPLOADS_DIR, doc.path);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Arquivo não encontrado no servidor" }); return; }

  res.setHeader("Content-Type", doc.mimeType || "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.name)}"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
