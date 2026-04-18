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
});

const updateCompanySchema = createCompanySchema.partial();

// ── CNPJ Card extraction ──────────────────────────────────────────────────────
router.post("/extract-cnpj", tempUpload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }

  const tmpPath = req.file.path;
  let text = "";

  try {
    const mime = req.file.mimetype;

    if (mime === "application/pdf") {
      const parser = new PDFParse({ url: `file://${tmpPath}` });
      const data = await parser.getText();
      text = data.text;
    } else if (mime.startsWith("image/")) {
      // For images, convert to base64 and use vision
      const imgBuffer = fs.readFileSync(tmpPath);
      const b64 = imgBuffer.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;

      const visionRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "high" },
              },
              {
                type: "text",
                text: "Extraia todo o texto desta imagem de Cartão CNPJ brasileiro. Retorne apenas o texto extraído, sem formatação extra.",
              },
            ],
          },
        ],
        max_tokens: 1500,
      });
      text = visionRes.choices[0]?.message?.content ?? "";
    }
  } catch (err) {
    fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
    res.status(500).json({ error: "Não foi possível ler o arquivo" });
    return;
  } finally {
    fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
  }

  if (!text.trim()) {
    res.status(422).json({ error: "Não foi possível extrair texto do arquivo" });
    return;
  }

  const prompt = `Você é um especialista em documentos empresariais brasileiros. Analise o texto abaixo extraído de um Cartão CNPJ (Comprovante de Inscrição e de Situação Cadastral da Receita Federal) e extraia os dados cadastrais da empresa.

TEXTO DO CARTÃO CNPJ:
${text.slice(0, 8000)}

Retorne um JSON com a seguinte estrutura exata (sem markdown, sem texto extra):
{
  "razaoSocial": "razão social completa da empresa",
  "nomeFantasia": "nome fantasia ou null se não houver",
  "cnpj": "CNPJ formatado como XX.XXX.XXX/XXXX-XX",
  "email": "e-mail ou null",
  "telefone": "telefone ou null",
  "endereco": "endereço completo em uma linha: rua, número, bairro, cidade - UF, CEP ou null",
  "inscricaoEstadual": "inscrição estadual ou null",
  "inscricaoMunicipal": "inscrição municipal ou null",
  "representanteLegal": "nome do responsável legal ou sócio administrador ou null"
}

Regras:
- Se um campo não estiver presente no texto, use null
- O CNPJ deve ter a máscara XX.XXX.XXX/XXXX-XX
- O endereço deve ser uma única string compacta
- Razão social é obrigatória`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(422).json({ error: "IA não retornou dados estruturados" });
      return;
    }

    const extracted = JSON.parse(jsonMatch[0]);
    res.json({ extracted });
  } catch {
    res.status(500).json({ error: "Erro ao processar com IA" });
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
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company) { res.status(404).json({ error: "Empresa não encontrada" }); return; }
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

router.get("/", async (_req, res) => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.razaoSocial);
  const documents = await db.select().from(companyDocumentsTable);

  const result = companies.map(c => {
    const companyDocs = documents.filter(d => d.companyId === c.id);
    return {
      ...formatCompany(c),
      documentStatus: getDocumentStatus(companyDocs),
      documentCount: companyDocs.length,
    };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [company] = await db.insert(companiesTable).values(parsed.data).returning();
  res.status(201).json(formatCompany(company!));
});

router.get("/:id", async (req, res) => {
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
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [company] = await db
    .update(companiesTable)
    .set(parsed.data)
    .where(eq(companiesTable.id, id))
    .returning();

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.json(formatCompany(company));
});

router.delete("/:id", async (req, res) => {
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

  await db.delete(companiesTable).where(eq(companiesTable.id, id));
  res.status(204).send();
});

export default router;
