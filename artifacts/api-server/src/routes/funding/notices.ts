import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { fundingNoticesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (opts: { url: string }) => { getText: () => Promise<{ text: string }> };
};

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const tempUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `tmp-funding-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são aceitos"));
    }
  },
});

const AI_SYSTEM = `Você é um especialista em análise de editais de captação de recursos (inovação, social, cultural e empresarial).
Sua tarefa é extrair informações estruturadas de forma precisa e objetiva. NUNCA invente informações. Se algo não estiver explícito, retorne null.
Retorne APENAS JSON válido.`;

const AI_USER_TEMPLATE = `Analise o edital abaixo e extraia os seguintes campos:
* objetivo
* publico_alvo
* criterios_avaliacao (lista)
* valor_maximo
* prazo_final
* requisitos_obrigatorios (lista)
* tipo_projeto
* formato_submissao
* documentos_exigidos (lista)

EDITAL:
{texto}

Formato de resposta:
{
  "objetivo": "",
  "publico_alvo": "",
  "criterios_avaliacao": [],
  "valor_maximo": "",
  "prazo_final": "",
  "requisitos_obrigatorios": [],
  "tipo_projeto": "",
  "formato_submissao": "",
  "documentos_exigidos": []
}`;

// POST /api/funding-notices/upload
router.post("/upload", tempUpload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }

  const tmpPath = req.file.path;

  // 1. Extrair texto do PDF
  let rawText = "";
  try {
    const parser = new PDFParse({ url: `file://${tmpPath}` });
    const data = await parser.getText();
    rawText = data.text;
  } catch (err) {
    req.log.error({ err }, "Falha ao extrair texto do PDF");
    fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
    res.status(422).json({ error: "Não foi possível extrair texto do PDF" });
    return;
  }

  fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);

  if (!rawText.trim()) {
    res.status(422).json({ error: "O PDF não contém texto extraível" });
    return;
  }

  // 2. Enviar para OpenAI
  const textSample = rawText.slice(0, 12000);

  let structuredData: Record<string, unknown> | null = null;
  let aiRaw = "";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1200,
      temperature: 0.2,
      top_p: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AI_SYSTEM },
        { role: "user", content: AI_USER_TEMPLATE.replace("{texto}", textSample) },
      ],
    });

    aiRaw = completion.choices[0]?.message?.content ?? "";

    // 3. Limpar markdown e parsear JSON
    const cleaned = aiRaw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      structuredData = JSON.parse(cleaned);
    } catch {
      // Tentar extrair JSON da resposta mesmo que venha com texto ao redor
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          structuredData = JSON.parse(jsonMatch[0]);
        } catch {
          req.log.warn({ aiRaw }, "IA retornou JSON inválido — salvando estrutura nula");
          structuredData = null;
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, "Falha na chamada à OpenAI");
    res.status(502).json({ error: "Falha ao processar o edital com IA" });
    return;
  }

  // 4. Extrair campos de alto nível do JSON estruturado para colunas dedicadas

  // Título: tentar chaves com espaço, underscore ou parte do nome
  const titleFromAi = (() => {
    if (!structuredData) return null;
    const keys = Object.keys(structuredData);
    const titleKey = keys.find(k =>
      k.toLowerCase().includes("objetivo") || k.toLowerCase().includes("title")
    );
    return titleKey ? (structuredData[titleKey] as string) : null;
  })();

  const sourceFromBody = (req.body as Record<string, string>)?.source ?? null;

  // Deadline: tentar chaves com espaço, underscore, e parsear formatos PT-BR
  const deadlineRaw = (() => {
    if (!structuredData) return null;
    const keys = Object.keys(structuredData);
    const key = keys.find(k =>
      k.toLowerCase().includes("prazo") || k.toLowerCase().includes("deadline")
    );
    return key ? (structuredData[key] as string) : null;
  })();

  const parseBrazilianDate = (raw: string): Date | null => {
    // DD/MM/YYYY or DD/MM/YYYY. or DD de mês de YYYY
    const dmyMatch = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T23:59:00Z`);
      if (!isNaN(dt.getTime())) return dt;
    }
    // ISO 8601 fallback
    const dt = new Date(raw);
    return !isNaN(dt.getTime()) ? dt : null;
  };

  const deadlineParsed = deadlineRaw ? parseBrazilianDate(deadlineRaw) : null;

  // Max value: tentar chaves com espaço/underscore e extrair número
  const maxValueRaw = (() => {
    if (!structuredData) return null;
    const keys = Object.keys(structuredData);
    const key = keys.find(k =>
      k.toLowerCase().includes("valor") || k.toLowerCase().includes("max")
    );
    return key ? (structuredData[key] as string) : null;
  })();

  const maxValueParsed = (() => {
    if (maxValueRaw == null) return null;
    // Remove currency symbols, letters; keep digits, comma, dot
    const cleaned = String(maxValueRaw)
      .replace(/R\$\s*/g, "")
      .replace(/[^0-9,\.]/g, "")
      .replace(",", ".");
    const num = parseFloat(cleaned);
    return !isNaN(num) && isFinite(num) && cleaned.length > 0 ? cleaned : null;
  })();

  // 5. Salvar no banco
  const title = titleFromAi
    ? String(titleFromAi).slice(0, 500)
    : (req.file?.originalname?.replace(/\.pdf$/i, "") ?? "Edital sem título");

  const [saved] = await db
    .insert(fundingNoticesTable)
    .values({
      title,
      source: sourceFromBody,
      rawText,
      structuredData: structuredData ?? {},
      deadline: deadlineParsed,
      maxValue: maxValueParsed || null,
    })
    .returning();

  // Não retornar rawText no response (pode ser muito grande)
  const { rawText: _omit, ...savedWithout } = saved!;

  res.status(201).json({
    ...savedWithout,
    createdAt: saved!.createdAt.toISOString(),
    updatedAt: saved!.updatedAt.toISOString(),
    deadline: saved!.deadline?.toISOString() ?? null,
    aiParsingSuccess: structuredData !== null,
  });
});

// GET /api/funding-notices
router.get("/", async (_req, res) => {
  const notices = await db
    .select({
      id: fundingNoticesTable.id,
      title: fundingNoticesTable.title,
      source: fundingNoticesTable.source,
      deadline: fundingNoticesTable.deadline,
      maxValue: fundingNoticesTable.maxValue,
      createdAt: fundingNoticesTable.createdAt,
    })
    .from(fundingNoticesTable)
    .orderBy(desc(fundingNoticesTable.createdAt));

  res.json(
    notices.map((n) => ({
      ...n,
      deadline: n.deadline?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }))
  );
});

// POST /api/funding-notices/:id/project-ideas — sugestões de ideias de projeto para o edital
router.post("/:id/project-ideas", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [notice] = await db.select().from(fundingNoticesTable).where(eq(fundingNoticesTable.id, id));
  if (!notice) { res.status(404).json({ error: "Edital não encontrado" }); return; }

  const structured = notice.structuredData as Record<string, unknown> | null;
  const parts: string[] = [];
  if (notice.title) parts.push(`Título: ${notice.title}`);
  if (notice.source) parts.push(`Fonte: ${notice.source}`);
  if (structured) {
    for (const [k, v] of Object.entries(structured)) {
      if (v == null) continue;
      if (typeof v !== "object") parts.push(`${k}: ${String(v)}`);
      else if (Array.isArray(v)) parts.push(`${k}:\n${(v as string[]).map(i => `- ${i}`).join("\n")}`);
    }
  }
  if (parts.length <= 2 && notice.rawText) {
    parts.push(`Conteúdo:\n${notice.rawText.slice(0, 5000)}`);
  }
  const editalContext = parts.join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 900,
      temperature: 0.7,
      top_p: 1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é um especialista em criação de projetos para editais. Responda sempre em JSON válido.
Seu trabalho é propor ideias viáveis e alinhadas ao edital.`,
        },
        {
          role: "user",
          content: `Com base no edital abaixo, sugira 3 ideias de projetos viáveis. Responda em JSON.

EDITAL:
${editalContext}

Formato JSON de resposta:
{
  "ideias": [
    { "titulo": "", "descricao": "", "impacto": "" }
  ]
}

Regras:
* ideias realistas
* alinhadas ao edital
* com potencial de aprovação`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: { ideias: { titulo: string; descricao: string; impacto: string }[] };
    try {
      const parsed = JSON.parse(raw);
      result = { ideias: Array.isArray(parsed.ideias) ? parsed.ideias : [] };
    } catch {
      res.status(502).json({ error: "IA retornou resposta inválida" });
      return;
    }

    res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Falha ao gerar ideias de projeto com OpenAI");
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(502).json({ error: "Falha ao gerar ideias com IA", detail: message });
  }
});

// GET /api/funding-notices/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [notice] = await db
    .select()
    .from(fundingNoticesTable)
    .where(eq(fundingNoticesTable.id, id));

  if (!notice) {
    res.status(404).json({ error: "Edital não encontrado" });
    return;
  }

  res.json({
    ...notice,
    deadline: notice.deadline?.toISOString() ?? null,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  });
});

export default router;
