import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  callNoticesTable,
  noticeFilesTable,
  callExtractedRequirementsTable,
  callSubmittedDocumentsTable,
  callValidationItemsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse") as { PDFParse: new (opts: { url: string }) => { getText: () => Promise<{ text: string }> } };

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const tempUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) => cb(null, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  // filePath is stored as "/uploads/filename.pdf" (URL path).
  // Strip the leading "/uploads/" prefix so we can join it with UPLOADS_DIR correctly.
  const filename = filePath.replace(/^\/uploads\//, "");
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    return "";
  }

  if (mimeType.includes("pdf")) {
    const fileUrl = `file://${fullPath}`;
    const parser = new PDFParse({ url: fileUrl });
    const data = await parser.getText();
    return data.text;
  }

  return "";
}

router.post("/extract-meta", tempUpload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado" });
    return;
  }

  const tmpPath = req.file.path;

  let editalText = "";
  try {
    const parser = new PDFParse({ url: `file://${tmpPath}` });
    const data = await parser.getText();
    editalText = data.text;
  } catch (err) {
    fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);
    res.status(500).json({ error: "Não foi possível ler o PDF" });
    return;
  }

  fs.existsSync(tmpPath) && fs.unlinkSync(tmpPath);

  const textSample = editalText.slice(0, 10000);

  const prompt = `Você é um especialista em chamamentos públicos e parcerias com OSCs (Organizações da Sociedade Civil) no Brasil. Analise o trecho do edital/chamamento abaixo e extraia as informações básicas.

EDITAL/CHAMAMENTO (primeiros 10.000 caracteres):
${textSample}

Retorne um JSON com a seguinte estrutura exata (sem markdown, sem texto extra):
{
  "title": "Descrição completa do objeto/escopo do chamamento, exatamente como consta no edital",
  "agency": "Nome do órgão/entidade que promove o chamamento",
  "referenceNumber": "Número de referência do chamamento (ex: Chamamento 001/2026) ou null se não encontrado",
  "category": "Área temática: saude, educacao, assistencia_social, cultura, esporte, meio_ambiente, habitacao, seguranca_publica, ciencia_tecnologia, ou outros",
  "deadline": "Data e hora limite de inscrição no formato ISO 8601 (YYYY-MM-DDTHH:MM) ou null se não encontrado"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({
      title: parsed.title ?? null,
      agency: parsed.agency ?? null,
      referenceNumber: parsed.referenceNumber ?? null,
      category: parsed.category ?? null,
      deadline: parsed.deadline ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to extract metadata from chamamento edital");
    res.status(500).json({ error: "Falha ao processar o edital com IA" });
  }
});

router.post("/:id/analyze-edital", async (req, res) => {
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

  const [editalFile] = await db.select().from(noticeFilesTable)
    .where(and(eq(noticeFilesTable.callNoticeId, id), eq(noticeFilesTable.fileType, "edital")))
    .limit(1);

  if (!editalFile) {
    res.status(400).json({ error: "Nenhum edital enviado para este chamamento" });
    return;
  }

  await db.update(callNoticesTable)
    .set({ status: "edital_processando" })
    .where(eq(callNoticesTable.id, id));

  let editalText = "";
  try {
    editalText = await extractTextFromFile(editalFile.path, editalFile.mimeType);
  } catch (extractErr) {
    req.log.error({ extractErr }, "Failed to extract text from chamamento edital");
    await db.update(callNoticesTable).set({ status: "edital_enviado" }).where(eq(callNoticesTable.id, id));
    res.status(500).json({ error: "Falha ao ler o arquivo do edital" });
    return;
  }

  const textSample = editalText.slice(0, 12000);

  const prompt = `Você é um especialista em chamamentos públicos e parcerias com OSCs (Organizações da Sociedade Civil) no Brasil. Analise o edital de chamamento abaixo e extraia todos os requisitos e documentos exigidos das OSCs interessadas.

EDITAL DO CHAMAMENTO (primeiros 12.000 caracteres):
${textSample}

Retorne um JSON com a seguinte estrutura exata:
{
  "requirements": [
    {
      "title": "Nome curto e claro do requisito ou documento",
      "description": "Descrição detalhada ou especificação do requisito",
      "requirementType": "tipo do requisito (ver lista abaixo)",
      "mandatory": true,
      "sourceExcerpt": "Trecho exato do edital (máximo 200 chars)",
      "sourcePage": null,
      "confidence": 0.95,
      "needsReview": false
    }
  ]
}

TIPOS DE REQUISITO (use exatamente estes valores):
- "documento_institucional": estatuto, ata de eleição, CNPJ, certidão de existência
- "certidao_regularidade": certidões de regularidade fiscal, trabalhista, previdenciária
- "comprovacao_experiencia": comprovação de capacidade técnica e experiência da OSC
- "declaracao": declarações obrigatórias (idoneidade, não impedimento, conflito de interesses, etc.)
- "anexo_obrigatorio": anexos obrigatórios do edital que devem ser preenchidos/assinados
- "proposta_tecnica": proposta técnica do projeto ou programa
- "plano_trabalho": plano de trabalho detalhado
- "cronograma": cronograma de execução e desembolso
- "requisito_elegibilidade": critério que a OSC deve atender para ser elegível
- "documento_parceria": documentos específicos de parceria (termos, acordos, etc.)

INSTRUÇÕES:
- Liste TODOS os documentos e requisitos exigidos da OSC
- Para requisitos de elegibilidade, mandatory = true e needsReview = false
- Para itens ambíguos, defina needsReview: true e confidence menor que 0.7
- Seja específico: "Certidão Negativa de Débitos com a Fazenda Municipal" em vez de "certidões"
- Inclua prazos de validade na description quando mencionados

Responda APENAS com o JSON, sem texto adicional.`;

  let requirements: {
    title: string;
    description?: string;
    requirementType?: string;
    mandatory: boolean;
    sourceExcerpt?: string;
    sourcePage?: number;
    confidence: number;
    needsReview: boolean;
  }[] = [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanContent);
    requirements = parsed.requirements ?? [];
  } catch (err) {
    req.log.error({ err }, "Failed to parse AI response for chamamento edital");
    await db.update(callNoticesTable)
      .set({ status: "edital_enviado" })
      .where(eq(callNoticesTable.id, id));
    res.status(500).json({ error: "Falha ao analisar o edital" });
    return;
  }

  await db.delete(callExtractedRequirementsTable).where(eq(callExtractedRequirementsTable.callNoticeId, id));
  await db.delete(callValidationItemsTable).where(eq(callValidationItemsTable.callNoticeId, id));

  if (requirements.length > 0) {
    const insertedReqs = await db.insert(callExtractedRequirementsTable).values(
      requirements.map(r => ({
        callNoticeId: id,
        title: r.title,
        description: r.description ?? null,
        requirementType: r.requirementType ?? null,
        mandatory: r.mandatory ?? true,
        sourceExcerpt: r.sourceExcerpt ?? null,
        sourcePage: r.sourcePage ?? null,
        confidence: r.confidence ?? 1.0,
        needsReview: r.needsReview ?? false,
      }))
    ).returning();

    await db.insert(callValidationItemsTable).values(
      insertedReqs.map(req => ({
        callNoticeId: id,
        requirementId: req.id,
        status: "pendente",
        notes: null,
        submittedDocumentId: null,
      }))
    );
  }

  await db.update(callNoticesTable)
    .set({ status: "requisitos_extraidos" })
    .where(eq(callNoticesTable.id, id));

  res.json({
    success: true,
    message: `Edital analisado. ${requirements.length} requisitos identificados.`,
    noticeStatus: "requisitos_extraidos",
  });
});

router.post("/:id/analyze-documents", async (req, res) => {
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

  const requirements = await db.select().from(callExtractedRequirementsTable)
    .where(eq(callExtractedRequirementsTable.callNoticeId, id));

  if (requirements.length === 0) {
    res.status(400).json({ error: "Nenhum requisito extraído. Analise o edital primeiro." });
    return;
  }

  const allFiles = await db.select().from(noticeFilesTable)
    .where(eq(noticeFilesTable.callNoticeId, id));

  const oscDocs = allFiles.filter(f => f.fileType !== "edital");

  if (oscDocs.length === 0) {
    res.status(400).json({ error: "Nenhum documento da OSC enviado" });
    return;
  }

  await db.update(callNoticesTable)
    .set({ status: "em_conferencia" })
    .where(eq(callNoticesTable.id, id));

  const docsText: { name: string; type: string; text: string }[] = [];
  for (const doc of oscDocs) {
    const text = await extractTextFromFile(doc.path, doc.mimeType);
    docsText.push({ name: doc.name, type: doc.fileType, text: text.slice(0, 3000) });
  }

  const requirementsList = requirements.map((r, i) =>
    `${i + 1}. [${r.requirementType ?? "geral"}] ${r.title}${r.description ? `: ${r.description}` : ""}${r.mandatory ? " (OBRIGATÓRIO)" : ""}`
  ).join("\n");

  const docsList = docsText.map((d, i) =>
    `DOCUMENTO ${i + 1} [${d.type}]: ${d.name}\n${d.text || "(sem texto extraído)"}`
  ).join("\n\n---\n\n");

  const prompt = `Você é um especialista em conferência documental para chamamentos públicos com OSCs no Brasil. Analise os documentos enviados pela OSC e compare com os requisitos do edital.

REQUISITOS DO EDITAL:
${requirementsList}

DOCUMENTOS DA OSC:
${docsList.slice(0, 10000)}

Para cada requisito, determine o status baseado nos documentos apresentados:
- "ok": documento encontrado e aparentemente correto e dentro da validade
- "pendente": documento não encontrado entre os enviados
- "divergente": documento encontrado mas com dados inconsistentes ou incorretos
- "vencido": documento encontrado mas com prazo de validade expirado
- "incompleto": documento enviado mas incompleto ou parcial
- "revisar_manualmente": necessita verificação humana por ambiguidade ou complexidade

Retorne um JSON com estrutura exata:
{
  "items": [
    {
      "requirementIndex": 1,
      "status": "ok",
      "documentName": "Nome do documento que atende (ou null se pendente)",
      "notes": "Observação relevante (opcional)"
    }
  ],
  "summary": "Resumo executivo da conferência em 2-3 frases",
  "nextSteps": "Próximos passos recomendados para a OSC"
}

Responda APENAS com o JSON, sem texto adicional.`;

  let conferenceResult: {
    items: { requirementIndex: number; status: string; documentName?: string | null; notes?: string | null }[];
    summary: string;
    nextSteps?: string;
  } = { items: [], summary: "", nextSteps: "" };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    conferenceResult = JSON.parse(cleanContent);
  } catch (err) {
    req.log.error({ err }, "Failed to parse AI response for chamamento document conference");
    await db.update(callNoticesTable)
      .set({ status: "documentos_enviados" })
      .where(eq(callNoticesTable.id, id));
    res.status(500).json({ error: "Falha ao analisar os documentos" });
    return;
  }

  await db.delete(callSubmittedDocumentsTable).where(eq(callSubmittedDocumentsTable.callNoticeId, id));

  const submittedDocMap: Record<number, number> = {};
  for (const item of conferenceResult.items) {
    const reqIndex = item.requirementIndex - 1;
    const req = requirements[reqIndex];
    if (!req) continue;

    if (item.documentName && item.status !== "pendente") {
      const matchedFile = oscDocs.find(f =>
        f.name.toLowerCase().includes(item.documentName!.toLowerCase().slice(0, 10))
      ) ?? oscDocs[0];

      if (matchedFile) {
        const [submittedDoc] = await db.insert(callSubmittedDocumentsTable).values({
          callNoticeId: id,
          fileId: matchedFile.id,
          detectedType: item.documentName ?? null,
          confidence: 0.85,
          needsReview: item.status === "revisar_manualmente",
        }).returning();
        submittedDocMap[req.id] = submittedDoc!.id;
      }
    }
  }

  for (const item of conferenceResult.items) {
    const reqIndex = item.requirementIndex - 1;
    const req = requirements[reqIndex];
    if (!req) continue;

    const validStatus = ["ok", "pendente", "divergente", "vencido", "incompleto", "revisar_manualmente"].includes(item.status)
      ? item.status
      : "revisar_manualmente";

    await db.update(callValidationItemsTable)
      .set({
        status: validStatus,
        notes: item.notes ?? null,
        submittedDocumentId: submittedDocMap[req.id] ?? null,
      })
      .where(eq(callValidationItemsTable.requirementId, req.id));
  }

  const statusCounts = conferenceResult.items.reduce((acc, item) => {
    const s = item.status as string;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasPending = (statusCounts["pendente"] ?? 0) > 0 ||
    (statusCounts["vencido"] ?? 0) > 0 ||
    (statusCounts["divergente"] ?? 0) > 0 ||
    (statusCounts["incompleto"] ?? 0) > 0;

  const newStatus = hasPending ? "pendencias_encontradas" : "pronto_para_submissao";

  await db.update(callNoticesTable)
    .set({ status: newStatus })
    .where(eq(callNoticesTable.id, id));

  res.json({
    success: true,
    message: `Conferência concluída. ${statusCounts["ok"] ?? 0} itens OK, ${statusCounts["pendente"] ?? 0} pendentes.`,
    noticeStatus: newStatus,
    summary: conferenceResult.summary,
    nextSteps: conferenceResult.nextSteps,
  });
});

export default router;
