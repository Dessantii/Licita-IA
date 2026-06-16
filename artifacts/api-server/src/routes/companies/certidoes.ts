import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { companiesTable, companyDocumentsTable, certidaoHistoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
import { emitirCertidao, isEstadoSupported, isMunicipioSupported } from "../../rpa/index";

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

function normalizeCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  return cnpj.replace(/\D/g, "").slice(0, 14).padStart(14, "0");
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

// ── Verification helpers ───────────────────────────────────────────────────────

type VerificacaoStatus = "valido" | "invalido" | "nao_verificavel";

/**
 * Trusted hostname suffixes for Brazilian government certificate verification portals.
 * Only URLs whose hostname ends with one of these suffixes will be fetched.
 * This prevents SSRF by refusing to contact any host not on this list.
 */
const ALLOWED_HOSTNAME_SUFFIXES = [
  ".receita.fazenda.gov.br",
  ".receita.economia.gov.br",
  ".pgfn.gov.br",
  ".caixa.gov.br",
  ".tst.jus.br",
  ".fazenda.sp.gov.br",
  ".sefaz.sp.gov.br",
  ".sefaz.rj.gov.br",
  ".sefaz.mg.gov.br",
  ".sefaz.ba.gov.br",
  ".sefaz.rs.gov.br",
  ".sefaz.pr.gov.br",
  ".sefaz.sc.gov.br",
  ".sefaz.go.gov.br",
  ".sefaz.pe.gov.br",
  ".sefaz.ce.gov.br",
  ".sefaz.am.gov.br",
  ".sefaz.pa.gov.br",
  ".sefaz.mt.gov.br",
  ".sefaz.ms.gov.br",
  ".sefaz.df.gov.br",
  ".fazenda.gov.br",
  ".gov.br",
  ".jus.br",
];

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^169\.254\./,
  /^0\./,
];

const VALID_KEYWORDS = [
  "certidão negativa",
  "certidao negativa",
  "regularidade",
  "negativa de débitos",
  "negativa de debitos",
  "situação regular",
  "situacao regular",
  "certidão válida",
  "certidao valida",
  "documento válido",
  "documento valido",
  "autêntico",
  "autentico",
];

const INVALID_KEYWORDS = [
  "não encontrado",
  "nao encontrado",
  "não localizado",
  "nao localizado",
  "código inválido",
  "codigo invalido",
  "código não",
  "codigo nao",
  "expirado",
  "revogado",
  "cancelado",
];

function isUrlAllowed(rawUrl: string): { allowed: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "URL inválida" };
  }

  if (parsed.protocol !== "https:") {
    return { allowed: false, reason: "Apenas HTTPS é permitido" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (PRIVATE_IP_PATTERNS.some(re => re.test(hostname))) {
    return { allowed: false, reason: "Hostname privado/interno bloqueado" };
  }

  const allowed = ALLOWED_HOSTNAME_SUFFIXES.some(
    suffix => hostname === suffix.slice(1) || hostname.endsWith(suffix),
  );
  if (!allowed) {
    return { allowed: false, reason: `Hostname não está na lista de portais confiáveis: ${hostname}` };
  }

  return { allowed: true };
}

async function verificarAutenticidade(
  codigoVerificacao: string,
  urlVerificacao: string,
): Promise<VerificacaoStatus> {
  const { allowed, reason } = isUrlAllowed(urlVerificacao);
  if (!allowed) {
    console.warn(`[certidoes/verificar] URL bloqueada: ${reason}`);
    return "nao_verificavel";
  }

  let targetUrl: string;
  try {
    const base = new URL(urlVerificacao);
    base.searchParams.set("codigo", codigoVerificacao);
    targetUrl = base.toString();
  } catch {
    return "nao_verificavel";
  }

  const { allowed: recheck } = isUrlAllowed(targetUrl);
  if (!recheck) {
    console.warn("[certidoes/verificar] URL após modificação de params bloqueada");
    return "nao_verificavel";
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "LicitaIA/1.0 (+https://licitaia.com.br)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "";
      const { allowed: redirAllowed } = isUrlAllowed(location);
      if (!redirAllowed) {
        console.warn("[certidoes/verificar] Redirect bloqueado para host não confiável");
        return "nao_verificavel";
      }
    }

    if (!response.ok) return "nao_verificavel";

    const text = (await response.text()).toLowerCase();

    if (INVALID_KEYWORDS.some(kw => text.includes(kw))) return "invalido";
    if (VALID_KEYWORDS.some(kw => text.includes(kw))) return "valido";
  } catch (err) {
    console.warn("[certidoes/verificar] fetch falhou (detalhes omitidos por segurança)");
  }

  return "nao_verificavel";
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
        urlVerificacao: meta?.url_verificacao ?? null,
        verificacaoStatus: doc.verificacaoStatus ?? null,
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

// ── POST /api/companies/:id/certidoes/:tipo/verificar ────────────────────────

router.post("/:id/certidoes/:tipo/verificar", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const tipo = req.params.tipo!;

  if (isNaN(companyId) || !VALID_TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Parâmetros inválidos" }); return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const docs = await db
    .select()
    .from(companyDocumentsTable)
    .where(and(
      eq(companyDocumentsTable.companyId, companyId),
      eq(companyDocumentsTable.certidaoType, tipo),
    ))
    .orderBy(desc(companyDocumentsTable.uploadedAt))
    .limit(1);

  const doc = docs[0];
  if (!doc) { res.status(404).json({ error: "Certidão não encontrada" }); return; }

  const meta = doc.metadata as Record<string, any> | null;
  const codigoVerificacao = meta?.codigo_verificacao as string | null | undefined;
  const urlVerificacao = meta?.url_verificacao as string | null | undefined;

  async function updateLatestHistoryVerificacao(status: string) {
    const [latestHistory] = await db
      .select({ id: certidaoHistoryTable.id })
      .from(certidaoHistoryTable)
      .where(and(
        eq(certidaoHistoryTable.companyId, companyId),
        eq(certidaoHistoryTable.certidaoType, tipo),
      ))
      .orderBy(desc(certidaoHistoryTable.createdAt))
      .limit(1);
    if (latestHistory) {
      await db
        .update(certidaoHistoryTable)
        .set({ verificacaoStatus: status })
        .where(eq(certidaoHistoryTable.id, latestHistory.id));
    }
  }

  if (!codigoVerificacao || !urlVerificacao) {
    await db
      .update(companyDocumentsTable)
      .set({ verificacaoStatus: "nao_verificavel" })
      .where(eq(companyDocumentsTable.id, doc.id));
    await updateLatestHistoryVerificacao("nao_verificavel");
    res.json({ verificacaoStatus: "nao_verificavel", documentId: doc.id });
    return;
  }

  console.log(`[certidoes/verificar] Verificando ${tipo} para empresa ${companyId} com código ${codigoVerificacao}`);

  const verificacaoStatus = await verificarAutenticidade(codigoVerificacao, urlVerificacao);

  await db
    .update(companyDocumentsTable)
    .set({ verificacaoStatus })
    .where(eq(companyDocumentsTable.id, doc.id));
  await updateLatestHistoryVerificacao(verificacaoStatus);

  res.json({ verificacaoStatus, documentId: doc.id, codigoVerificacao, urlVerificacao });
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

    // ── CNPJ validation ─────────────────────────────────────────────────────
    if (extracted?.cnpj && company.cnpj) {
      const extractedNorm = normalizeCnpj(extracted.cnpj);
      const companyNorm = normalizeCnpj(company.cnpj);
      if (extractedNorm && companyNorm && extractedNorm !== companyNorm) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(422).json({
          error: "CNPJ da certidão não corresponde ao CNPJ da empresa",
          cnpjExtraido: extracted.cnpj,
          cnpjEmpresa: company.cnpj,
        });
        return;
      }
    }

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

    // ── Always persist to certidao_history ──────────────────────────────────
    const [historyRow] = await db.insert(certidaoHistoryTable).values({
      companyId,
      certidaoType: tipo,
      resultado,
      issuedAt: dataEmissao ? new Date(dataEmissao + "T12:00:00Z") : new Date(),
      expiresAt: dataValidade ? new Date(dataValidade + "T12:00:00Z") : null,
      fileUrl: `/api/companies/${companyId}/documents/${doc!.id}/download`,
      extractionData: extracted ?? null,
      emissionMethod: "manual_upload",
    }).returning();

    const codigoVerificacaoExtracted = extracted?.codigo_verificacao as string | null | undefined;
    const urlVerificacaoExtracted = extracted?.url_verificacao as string | null | undefined;

    if (codigoVerificacaoExtracted && urlVerificacaoExtracted) {
      verificarAutenticidade(codigoVerificacaoExtracted, urlVerificacaoExtracted)
        .then(async (status) => {
          await db
            .update(companyDocumentsTable)
            .set({ verificacaoStatus: status })
            .where(eq(companyDocumentsTable.id, doc!.id));
          if (historyRow) {
            await db
              .update(certidaoHistoryTable)
              .set({ verificacaoStatus: status })
              .where(eq(certidaoHistoryTable.id, historyRow.id));
          }
          console.log(`[certidoes/extract] Verificação automática: ${status} para doc ${doc!.id}`);
        })
        .catch(err => console.error("[certidoes/extract] Verificação automática falhou:", err));
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
      verificacaoStatus: codigoVerificacaoExtracted && urlVerificacaoExtracted
        ? "verificando"
        : null,
      hasCodigoVerificacao: !!codigoVerificacaoExtracted,
    });
  } catch (err) {
    console.error("[certidoes] extract error:", err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "Erro ao processar o PDF" });
  }
});

// ── In-memory job store ───────────────────────────────────────────────────────

interface JobState {
  status: "running" | "done" | "failed";
  step: string;
  result?: Record<string, any>;
}

const jobStore = new Map<string, JobState>();

function createJob(): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  jobStore.set(jobId, { status: "running", step: "Iniciando..." });
  setTimeout(() => jobStore.delete(jobId), 10 * 60 * 1000);
  return jobId;
}

// ── GET /api/companies/:id/certidoes/:tipo/status/:jobId ──────────────────────

router.get("/:id/certidoes/:tipo/status/:jobId", async (req, res) => {
  const companyId = parseInt(req.params.id!);
  const tipo = req.params.tipo!;
  const jobId = req.params.jobId!;

  if (isNaN(companyId) || !VALID_TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Parâmetros inválidos" }); return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }

  const job = jobStore.get(jobId);
  if (!job) { res.status(404).json({ error: "Job não encontrado ou expirado" }); return; }

  res.json({ status: job.status, step: job.step, result: job.result ?? null });
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

  const AUTOMATION_TYPES = ["cnd_federal", "crf_fgts", "cndt", "certidao_estadual", "certidao_municipal"];

  const isRegionSupported = (): boolean => {
    if (tipo === "certidao_estadual") return isEstadoSupported(company.uf);
    if (tipo === "certidao_municipal") return isMunicipioSupported(company.municipio, company.uf);
    return true;
  };

  const regionFallbackMessage = (): string => {
    if (tipo === "certidao_estadual") {
      return `Emissão automática não disponível para o estado "${company.uf ?? "não informado"}". Emita manualmente e faça o upload do PDF.`;
    }
    if (tipo === "certidao_municipal") {
      return `Emissão automática não disponível para o município "${company.municipio ?? "não informado"} - ${company.uf ?? ""}". Emita manualmente e faça o upload do PDF.`;
    }
    return "Emissão automática não disponível para este tipo de certidão. Emita manualmente e faça o upload do PDF.";
  };

  if (!puppeteerAvailable || !AUTOMATION_TYPES.includes(tipo)) {
    res.json({
      jobId: null,
      success: false,
      method: "manual",
      portalUrl: def.portalUrl,
      instructions: def.instructions,
      message: puppeteerAvailable
        ? "Emissão automática não disponível para este tipo de certidão. Emita manualmente e faça o upload do PDF."
        : "A emissão automática não está disponível neste ambiente. Emita manualmente e faça o upload do PDF.",
    });
    return;
  }

  if (!isRegionSupported()) {
    res.json({
      jobId: null,
      success: false,
      method: "manual",
      portalUrl: def.portalUrl,
      instructions: def.instructions,
      message: regionFallbackMessage(),
    });
    return;
  }

  const cnpj = company.cnpj ?? "";
  if (!cnpj) {
    res.json({
      jobId: null,
      success: false,
      method: "manual",
      portalUrl: def.portalUrl,
      instructions: def.instructions,
      message: "CNPJ da empresa não cadastrado. Atualize o cadastro antes de emitir.",
    });
    return;
  }

  console.log(`[certidoes/emitir] Iniciando job de automação para ${tipo} | empresa ${companyId}`);

  const jobId = createJob();
  res.json({ jobId, status: "running", step: "Iniciando..." });

  (async () => {
    const job = jobStore.get(jobId)!;

    const onStep = (msg: string) => {
      job.step = msg;
    };

    let rpaResult: Awaited<ReturnType<typeof emitirCertidao>>;
    try {
      rpaResult = await emitirCertidao(tipo, cnpj, onStep, { uf: company.uf, municipio: company.municipio });
    } catch (err) {
      console.error("[certidoes/emitir] RPA error:", err);
      job.status = "done";
      job.step = "Concluído";
      job.result = {
        success: false,
        method: "manual",
        portalUrl: def.portalUrl,
        instructions: def.instructions,
        message: "Erro interno durante a automação. Emita manualmente e faça o upload do PDF.",
      };
      return;
    }

    if (!rpaResult.success || !rpaResult.pdfPath) {
      const message = rpaResult.captchaDetected
        ? "CAPTCHA detectado no portal. Emita manualmente e faça o upload do PDF."
        : (rpaResult.error ?? "Automação falhou. Emita manualmente e faça o upload do PDF.");
      job.status = "done";
      job.step = "Concluído";
      job.result = {
        success: false,
        method: "manual",
        portalUrl: def.portalUrl,
        instructions: def.instructions,
        message,
        captchaDetected: rpaResult.captchaDetected ?? false,
      };
      return;
    }

    const pdfPath = rpaResult.pdfPath;

    try {
      onStep("Extraindo dados...");
      const extracted = await extractCertidaoData(pdfPath);

      const dataEmissao = extracted ? toISO(extracted.data_emissao) : null;
      const dataValidade = extracted ? toISO(extracted.data_validade) : null;
      const resultado = extracted?.resultado ?? "nao_identificado";
      const titulo = extracted?.tipo_certidao ?? def.label;

      const destFilename = `certidao-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const destPath = path.join(process.cwd(), "uploads", destFilename);
      fs.copyFileSync(pdfPath, destPath);

      const pdfSize = fs.statSync(destPath).size;

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
        name: `${tipo}-${Date.now()}.pdf`,
        path: destFilename,
        mimeType: "application/pdf",
        size: pdfSize,
        source: "automatic",
        emissionMethod: "automatic",
        metadata: extracted ?? null,
      }).returning();

      await db.insert(certidaoHistoryTable).values({
        companyId,
        certidaoType: tipo,
        resultado,
        issuedAt: dataEmissao ? new Date(dataEmissao + "T12:00:00Z") : new Date(),
        expiresAt: dataValidade ? new Date(dataValidade + "T12:00:00Z") : null,
        fileUrl: `/api/companies/${companyId}/documents/${doc!.id}/download`,
        extractionData: extracted ?? null,
        emissionMethod: "automatic",
      });

      try { fs.unlinkSync(pdfPath); } catch { }

      job.status = "done";
      job.step = "Concluído";
      job.result = {
        success: true,
        method: "automatic",
        documentId: doc!.id,
        fileUrl: `/api/companies/${companyId}/documents/${doc!.id}/download`,
        extracted,
        dataEmissao,
        dataValidade,
        resultado,
        status: calcStatus(dataValidade),
      };
    } catch (err) {
      console.error("[certidoes/emitir] post-processing error:", err);
      try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch { }
      job.status = "failed";
      job.step = "Erro ao processar PDF";
      job.result = {
        success: false,
        method: "manual",
        portalUrl: def.portalUrl,
        instructions: def.instructions,
        message: "Erro ao processar o PDF baixado automaticamente. Emita manualmente e faça o upload.",
      };
    }
  })();
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

// ── DELETE /api/companies/:id/certidoes/:tipo ─────────────────────────────────

router.delete("/:id/certidoes/:tipo", async (req, res) => {
  const userId = (req as any).userId as number;
  const companyId = parseInt(req.params.id!);
  const tipo = req.params.tipo!;
  if (isNaN(companyId) || !VALID_TIPOS.includes(tipo)) {
    res.status(400).json({ error: "Parâmetros inválidos" }); return;
  }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId));
  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Empresa não encontrada" }); return;
  }

  const [doc] = await db
    .select()
    .from(companyDocumentsTable)
    .where(and(
      eq(companyDocumentsTable.companyId, companyId),
      eq(companyDocumentsTable.certidaoType, tipo)
    ))
    .orderBy(desc(companyDocumentsTable.uploadedAt))
    .limit(1);

  if (!doc) {
    res.status(404).json({ error: "Certidão não encontrada" }); return;
  }

  try {
    const filePath = path.join(UPLOADS_DIR, doc.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}

  await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.id, doc.id));

  res.status(204).send();
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
