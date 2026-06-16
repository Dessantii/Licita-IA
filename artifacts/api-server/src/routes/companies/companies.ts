import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  companiesTable,
  companyDocumentsTable,
  processesTable,
  callNoticesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { url: string }) => { getText: () => Promise<{ text: string }> };
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const tempUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `cnpj-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router: IRouter = Router();

const certidaoSchema = z.object({
  validade: z.string().nullish(),
  url: z.string().nullish(),
}).nullish();

const certidoesSchema = z.object({
  federal: certidaoSchema,
  estadual: certidaoSchema,
  municipal: certidaoSchema,
  fgts: certidaoSchema,
  trabalhista: certidaoSchema,
  falencia: certidaoSchema,
}).nullish();

const createCompanySchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().nullish(),
  cnpj: z.string().min(1),
  naturezaJuridica: z.string().nullish(),
  porte: z.string().nullish(),
  dataAbertura: z.string().nullish(),
  situacaoCadastralReceita: z.string().nullish(),
  cep: z.string().nullish(),
  logradouro: z.string().nullish(),
  numero: z.string().nullish(),
  complemento: z.string().nullish(),
  bairro: z.string().nullish(),
  municipio: z.string().nullish(),
  uf: z.string().nullish(),
  email: z.string().nullish(),
  telefone: z.string().nullish(),
  site: z.string().nullish(),
  endereco: z.string().nullish(),
  nomeResponsavel: z.string().nullish(),
  cpfResponsavel: z.string().nullish(),
  emailResponsavel: z.string().nullish(),
  inscricaoEstadual: z.string().nullish(),
  inscricaoMunicipal: z.string().nullish(),
  representanteLegal: z.string().nullish(),
  observacoes: z.string().nullish(),
  nivelSicaf: z.number().int().nullish(),
  dataValidadeSicaf: z.string().nullish(),
  certidoes: certidoesSchema,
  certificadoValidade: z.string().nullish(),
  certificadoTipo: z.string().nullish(),
  usarCertificadoParaSubmissao: z.boolean().nullish(),
  capitalSocial: z.string().nullish(),
  balancoPatrimonialAno: z.number().int().nullish(),
  indicesLiquidezCorrente: z.string().nullish(),
  indicesLiquidezGeral: z.string().nullish(),
  indicesSolvenciaGeral: z.string().nullish(),
  biddingProfile: z.any().nullish(),
});

const updateCompanySchema = createCompanySchema.partial();

// ── CNPJ Card extraction ──────────────────────────────────────────────────────
const EXTRACTION_SYSTEM_PROMPT =
  "Você é um extrator de dados estrito. Copie valores SOMENTE do documento fornecido. " +
  "NUNCA invente, suponha ou complete dados ausentes. " +
  "Se um campo não estiver visível no documento, retorne null para aquele campo. " +
  "Proibido usar valores fictícios ou de exemplo.";

const EXTRACTION_JSON_SCHEMA = `{
  "razaoSocial": <string exata do documento ou null>,
  "nomeFantasia": <string exata do documento ou null>,
  "cnpj": <CNPJ no formato XX.XXX.XXX/XXXX-XX exatamente como no documento ou null>,
  "email": <e-mail exato do documento ou null>,
  "telefone": <telefone exato do documento ou null>,
  "endereco": <endereço completo em uma linha exatamente como no documento ou null>,
  "inscricaoEstadual": <inscrição estadual exata ou null>,
  "inscricaoMunicipal": <inscrição municipal exata ou null>,
  "representanteLegal": <nome do responsável legal exato ou null>
}`;

router.post("/extract-cnpj", tempUpload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }

  const tmpPath = req.file.path;
  const mime = req.file.mimetype;

  try {
    // ── IMAGES: single vision call → JSON directly ───────────────────────
    if (mime.startsWith("image/")) {
      const imgBuffer = fs.readFileSync(tmpPath);
      const b64 = imgBuffer.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;

      const visionRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
              {
                type: "text",
                text: `Analise esta imagem de Cartão CNPJ (Comprovante de Inscrição e de Situação Cadastral da Receita Federal Brasileira).

Extraia SOMENTE os dados que estão VISÍVEIS na imagem. NÃO invente dados.

Retorne um objeto JSON com exatamente estas chaves:
${EXTRACTION_JSON_SCHEMA}

Se a imagem não for um Cartão CNPJ ou não contiver dados legíveis, retorne todas as chaves com valor null.`,
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 700,
        response_format: { type: "json_object" },
      });

      const raw = visionRes.choices[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        res.status(422).json({ error: "IA não retornou dados da imagem" });
        return;
      }
      const extracted = JSON.parse(raw);
      res.json({ extracted });
      return;
    }

    // ── PDFs: extract text first, then structured JSON ───────────────────
    if (mime !== "application/pdf") {
      res.status(400).json({ error: "Formato não suportado. Envie um PDF ou imagem." });
      return;
    }

    // Try text extraction first
    let text = "";
    try {
      const parser = new PDFParse({ url: `file://${tmpPath}` });
      const data = await parser.getText();
      text = data.text?.trim() ?? "";
    } catch {
      // text stays empty; we'll fall back to image rendering below
    }

    // If text is sufficient, use text-based extraction
    if (text.length > 80) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analise o texto abaixo extraído de um Cartão CNPJ (Comprovante de Inscrição e de Situação Cadastral da Receita Federal Brasileira).

Extraia SOMENTE os dados que aparecem LITERALMENTE no texto. NÃO invente dados.

TEXTO DO DOCUMENTO:
${text.slice(0, 8000)}

Retorne um objeto JSON com exatamente estas chaves:
${EXTRACTION_JSON_SCHEMA}

Se o texto não contiver dados de uma empresa real, retorne todas as chaves com valor null.`,
          },
        ],
        temperature: 0,
        max_tokens: 700,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        res.status(422).json({ error: "IA não retornou dados estruturados" });
        return;
      }
      res.json({ extracted: JSON.parse(raw) });
      return;
    }

    // PDF has no text layer (image-based PDF) — extract the embedded JPEG directly
    // from the binary without relying on any external rendering tools.
    const pdfBytes = fs.readFileSync(tmpPath);

    // Find first JPEG stream: SOI marker = 0xFF 0xD8 0xFF
    let jpegStart = -1;
    for (let i = 0; i < pdfBytes.length - 2; i++) {
      if (pdfBytes[i] === 0xFF && pdfBytes[i + 1] === 0xD8 && pdfBytes[i + 2] === 0xFF) {
        jpegStart = i;
        break;
      }
    }

    if (jpegStart === -1) {
      res.status(422).json({
        error: "O PDF não contém imagem ou texto legível. Tente digitalizar o documento e enviar como JPG/PNG.",
      });
      return;
    }

    // Find EOI marker = 0xFF 0xD9
    let jpegEnd = -1;
    for (let i = jpegStart + 2; i < pdfBytes.length - 1; i++) {
      if (pdfBytes[i] === 0xFF && pdfBytes[i + 1] === 0xD9) {
        jpegEnd = i + 2;
        break;
      }
    }

    if (jpegEnd <= jpegStart) {
      res.status(422).json({ error: "Falha ao extrair imagem do PDF." });
      return;
    }

    const jpegBuffer = pdfBytes.slice(jpegStart, jpegEnd);
    const b64 = jpegBuffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${b64}`;

    const visionRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            {
              type: "text",
              text: `Analise esta imagem de Cartão CNPJ (Comprovante de Inscrição e de Situação Cadastral da Receita Federal Brasileira).

Extraia SOMENTE os dados que estão VISÍVEIS na imagem. NÃO invente dados.

Retorne um objeto JSON com exatamente estas chaves:
${EXTRACTION_JSON_SCHEMA}

Se a imagem não contiver dados legíveis de uma empresa real, retorne todas as chaves com valor null.`,
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });

    const raw = visionRes.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      res.status(422).json({ error: "IA não retornou dados da imagem do PDF" });
      return;
    }
    res.json({ extracted: JSON.parse(raw) });
  } catch (err) {
    res.status(500).json({ error: "Erro ao processar o arquivo" });
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  }
});

function formatCompany(c: typeof companiesTable.$inferSelect) {
  return {
    ...c,
    name: c.nomeFantasia || c.razaoSocial,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function formatDocument(d: typeof companyDocumentsTable.$inferSelect) {
  return {
    ...d,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

function getDocumentStatus(docs: typeof companyDocumentsTable.$inferSelect[]) {
  if (docs.length === 0) return "sem_documentos";
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  let hasExpired = false;
  let hasExpiringSoon = false;

  for (const doc of docs) {
    if (!doc.dataValidade) continue;
    if (doc.dataValidade < today) {
      hasExpired = true;
      break;
    }
    if (doc.dataValidade <= in30Days) {
      hasExpiringSoon = true;
    }
  }

  if (hasExpired) return "vencido";
  if (hasExpiringSoon) return "vencendo";
  return "regular";
}

router.get("/cnpj-lookup/:cnpj", async (req, res) => {
  const cnpj = req.params.cnpj!.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    res.status(400).json({ error: "CNPJ inválido" });
    return;
  }
  try {
    const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      res.status(r.status).json({ error: "CNPJ não encontrado na Receita Federal" });
      return;
    }
    const data = await r.json() as any;
    res.json({
      razaoSocial: data.razao_social ?? null,
      nomeFantasia: data.nome_fantasia || data.razao_social || null,
      naturezaJuridica: data.natureza_juridica?.descricao ?? null,
      porte: data.porte?.descricao ?? null,
      dataAbertura: data.data_inicio_atividade ?? null,
      situacaoCadastralReceita: data.descricao_situacao_cadastral ?? null,
      email: data.email ?? null,
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : null,
      cep: data.cep?.replace(/\D/g, "") ?? null,
      logradouro: data.logradouro ?? null,
      numero: data.numero ?? null,
      complemento: data.complemento ?? null,
      bairro: data.bairro ?? null,
      municipio: data.municipio ?? null,
      uf: data.uf ?? null,
    });
  } catch (err: any) {
    res.status(502).json({ error: "Não foi possível consultar a Receita Federal" });
  }
});

router.post("/:id/verificar-sicaf", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company || company.userId !== userId) { res.status(404).json({ error: "Empresa não encontrada" }); return; }
  const cnpj = company.cnpj.replace(/\D/g, "");
  try {
    const r = await fetch(
      `https://compras.dados.gov.br/fornecedores/v1/fornecedores.json?cnpj=${cnpj}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!r.ok) {
      res.status(502).json({ error: "SICAF indisponível no momento" });
      return;
    }
    const data = await r.json() as any;
    const fornecedor = Array.isArray(data) ? data[0] : data?.fornecedores?.[0];
    if (!fornecedor) {
      res.json({ encontrado: false, mensagem: "CNPJ não localizado no SICAF" });
      return;
    }
    const [updated] = await db
      .update(companiesTable)
      .set({ ultimaVerificacaoSicaf: new Date() })
      .where(eq(companiesTable.id, id))
      .returning();
    res.json({
      encontrado: true,
      fornecedor,
      ultimaVerificacao: updated?.ultimaVerificacaoSicaf,
    });
  } catch {
    res.status(502).json({ error: "Erro ao consultar SICAF" });
  }
});

router.get("/", async (req, res) => {
  const userId = (req as any).userId as number;
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId))
    .orderBy(companiesTable.razaoSocial);
  const allDocs = await db.select().from(companyDocumentsTable);

  const result = companies.map(c => {
    const companyDocs = allDocs.filter(d => d.companyId === c.id);
    return {
      ...formatCompany(c),
      documentStatus: getDocumentStatus(companyDocs),
      documentCount: companyDocs.length,
    };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  const userId = (req as any).userId as number;
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [company] = await db.insert(companiesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(formatCompany(company!));
});

router.get("/:id", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const documents = await db.select().from(companyDocumentsTable).where(eq(companyDocumentsTable.companyId, id));
  const processes = await db.select().from(processesTable).where(eq(processesTable.companyId, id));
  const callNotices = await db.select().from(callNoticesTable).where(eq(callNoticesTable.companyId, id));

  res.json({
    ...formatCompany(company),
    documents: documents.map(formatDocument),
    documentStatus: getDocumentStatus(documents),
    processes: processes.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    callNotices: callNotices.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });
});

router.patch("/:id", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [company] = await db
    .update(companiesTable)
    .set(parsed.data)
    .where(eq(companiesTable.id, id))
    .returning();

  res.json(formatCompany(company!));
});

router.delete("/:id", async (req, res) => {
  const userId = (req as any).userId as number;
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  await db.delete(companiesTable).where(eq(companiesTable.id, id));
  res.status(204).send();
});

export default router;
