import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  processesTable,
  uploadedFilesTable,
  extractedRequirementsTable,
  submittedDocumentsTable,
  validationItemsTable,
  finalReportsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;


const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  const fullPath = path.join(UPLOADS_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    return "";
  }

  if (mimeType.includes("pdf")) {
    const buffer = fs.readFileSync(fullPath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  return "";
}

router.post("/processes/:id/analyze-edital", async (req, res) => {
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

  const [editalFile] = await db.select().from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.processId, id))
    .limit(1);

  if (!editalFile || editalFile.fileType !== "edital") {
    res.status(400).json({ error: "No edital uploaded for this process" });
    return;
  }

  await db.update(processesTable)
    .set({ status: "edital_processando" })
    .where(eq(processesTable.id, id));

  const editalText = await extractTextFromFile(editalFile.path, editalFile.mimeType);
  const textSample = editalText.slice(0, 12000);

  const prompt = `Você é um especialista em licitações públicas brasileiras. Analise o edital abaixo e extraia TODOS os documentos e exigências que a empresa licitante precisa apresentar.

EDITAL (primeiros 12.000 caracteres):
${textSample}

Retorne um JSON com a seguinte estrutura exata:
{
  "requirements": [
    {
      "title": "Nome curto e claro do documento ou exigência",
      "description": "Descrição detalhada do que é exigido",
      "category": "habilitacao_juridica | habilitacao_fiscal | habilitacao_financeira | qualificacao_tecnica | documentacao_complementar | proposta",
      "mandatory": true,
      "sourceExcerpt": "Trecho exato do edital que menciona esta exigência (máximo 200 chars)",
      "sourcePage": null,
      "confidence": 0.95,
      "needsReview": false
    }
  ]
}

Instruções:
- Liste TODOS os documentos exigidos, mesmo que apareçam em seções diferentes
- Seja específico: "Certidão Negativa de Débitos Federais" em vez de "certidões negativas"
- Inclua prazos de validade quando mencionados na descrição
- Para itens ambíguos, defina needsReview: true e confidence menor
- Responda APENAS com o JSON, sem texto adicional`;

  let requirements: {
    title: string;
    description?: string;
    category?: string;
    mandatory: boolean;
    sourceExcerpt?: string;
    sourcePage?: number;
    confidence: number;
    needsReview: boolean;
  }[] = [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanContent);
    requirements = parsed.requirements ?? [];
  } catch (err) {
    req.log.error({ err }, "Failed to parse AI response for edital");
    await db.update(processesTable)
      .set({ status: "edital_enviado" })
      .where(eq(processesTable.id, id));
    res.status(500).json({ error: "Failed to analyze edital" });
    return;
  }

  await db.delete(extractedRequirementsTable).where(eq(extractedRequirementsTable.processId, id));
  await db.delete(validationItemsTable).where(eq(validationItemsTable.processId, id));

  if (requirements.length > 0) {
    const insertedReqs = await db.insert(extractedRequirementsTable).values(
      requirements.map(r => ({
        processId: id,
        title: r.title,
        description: r.description ?? null,
        category: r.category ?? null,
        mandatory: r.mandatory ?? true,
        sourceExcerpt: r.sourceExcerpt ?? null,
        sourcePage: r.sourcePage ?? null,
        confidence: r.confidence ?? 1.0,
        needsReview: r.needsReview ?? false,
      }))
    ).returning();

    await db.insert(validationItemsTable).values(
      insertedReqs.map(req => ({
        processId: id,
        requirementId: req.id,
        status: "faltando",
        notes: null,
        submittedDocumentId: null,
      }))
    );
  }

  await db.update(processesTable)
    .set({ status: "exigencias_extraidas" })
    .where(eq(processesTable.id, id));

  res.json({
    success: true,
    message: `Edital analisado. ${requirements.length} exigências identificadas.`,
    processStatus: "exigencias_extraidas",
  });
});

router.post("/processes/:id/analyze-documents", async (req, res) => {
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

  const requirements = await db.select().from(extractedRequirementsTable)
    .where(eq(extractedRequirementsTable.processId, id));

  if (requirements.length === 0) {
    res.status(400).json({ error: "No requirements extracted. Analyze the edital first." });
    return;
  }

  const documentFiles = await db.select().from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.processId, id));

  const companyDocs = documentFiles.filter(f => f.fileType === "documento_empresa");

  if (companyDocs.length === 0) {
    res.status(400).json({ error: "No company documents uploaded" });
    return;
  }

  await db.update(processesTable)
    .set({ status: "em_conferencia" })
    .where(eq(processesTable.id, id));

  const docsText: { name: string; text: string }[] = [];
  for (const doc of companyDocs) {
    const text = await extractTextFromFile(doc.path, doc.mimeType);
    docsText.push({ name: doc.name, text: text.slice(0, 3000) });
  }

  const requirementsList = requirements.map((r, i) => `${i + 1}. ${r.title}${r.description ? `: ${r.description}` : ""}`).join("\n");
  const docsList = docsText.map((d, i) => `DOCUMENTO ${i + 1}: ${d.name}\n${d.text || "(sem texto extraído)"}`).join("\n\n---\n\n");

  const prompt = `Você é um especialista em conferência documental para licitações. Analise os documentos enviados pela empresa e compare com as exigências do edital.

EXIGÊNCIAS DO EDITAL:
${requirementsList}

DOCUMENTOS DA EMPRESA:
${docsList.slice(0, 10000)}

Para cada exigência, determine o status baseado nos documentos apresentados:
- "ok": documento encontrado e aparentemente correto
- "faltando": documento não encontrado entre os enviados
- "vencido": documento encontrado mas vencido ou com prazo expirado
- "divergente": documento encontrado mas com dados inconsistentes
- "revisar": necessita verificação humana por ambiguidade

Retorne um JSON com estrutura exata:
{
  "items": [
    {
      "requirementIndex": 1,
      "status": "ok",
      "documentName": "Nome do documento que atende (ou null se faltando)",
      "notes": "Observação relevante (opcional)"
    }
  ],
  "summary": "Resumo executivo da conferência em 2-3 frases",
  "nextSteps": "Próximos passos recomendados"
}

Responda APENAS com o JSON, sem texto adicional.`;

  let conferenceResult: {
    items: { requirementIndex: number; status: string; documentName?: string | null; notes?: string | null }[];
    summary: string;
    nextSteps?: string;
  } = { items: [], summary: "", nextSteps: "" };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    conferenceResult = JSON.parse(cleanContent);
  } catch (err) {
    req.log.error({ err }, "Failed to parse AI response for document conference");
    await db.update(processesTable)
      .set({ status: "documentos_enviados" })
      .where(eq(processesTable.id, id));
    res.status(500).json({ error: "Failed to analyze documents" });
    return;
  }

  await db.delete(submittedDocumentsTable).where(eq(submittedDocumentsTable.processId, id));

  const submittedDocMap: Record<number, number> = {};
  for (const item of conferenceResult.items) {
    const reqIndex = item.requirementIndex - 1;
    const req = requirements[reqIndex];
    if (!req) continue;

    if (item.documentName && item.status !== "faltando") {
      const matchedFile = companyDocs.find(f => 
        f.name.toLowerCase().includes(item.documentName!.toLowerCase().slice(0, 10))
      ) ?? companyDocs[0];

      if (matchedFile) {
        const [submittedDoc] = await db.insert(submittedDocumentsTable).values({
          processId: id,
          fileId: matchedFile.id,
          detectedType: item.documentName ?? null,
          confidence: 0.85,
          needsReview: item.status === "revisar",
        }).returning();
        submittedDocMap[req.id] = submittedDoc!.id;
      }
    }
  }

  for (const item of conferenceResult.items) {
    const reqIndex = item.requirementIndex - 1;
    const req = requirements[reqIndex];
    if (!req) continue;

    const validStatus = ["ok", "faltando", "vencido", "divergente", "revisar"].includes(item.status)
      ? item.status
      : "revisar";

    await db.update(validationItemsTable)
      .set({
        status: validStatus,
        notes: item.notes ?? null,
        submittedDocumentId: submittedDocMap[req.id] ?? null,
      })
      .where(eq(validationItemsTable.requirementId, req.id));
  }

  const statusCounts = conferenceResult.items.reduce((acc, item) => {
    const s = item.status as string;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasPending = (statusCounts["faltando"] ?? 0) > 0 || 
    (statusCounts["vencido"] ?? 0) > 0 || 
    (statusCounts["divergente"] ?? 0) > 0;

  const newStatus = hasPending ? "pendencias_encontradas" : "pronto_para_revisao";

  await db.update(processesTable)
    .set({ status: newStatus })
    .where(eq(processesTable.id, id));

  await db.delete(finalReportsTable).where(eq(finalReportsTable.processId, id));
  await db.insert(finalReportsTable).values({
    processId: id,
    summary: conferenceResult.summary ?? "Conferência concluída.",
    okCount: statusCounts["ok"] ?? 0,
    missingCount: statusCounts["faltando"] ?? 0,
    expiredCount: statusCounts["vencido"] ?? 0,
    divergentCount: statusCounts["divergente"] ?? 0,
    reviewCount: statusCounts["revisar"] ?? 0,
    nextSteps: conferenceResult.nextSteps ?? null,
  });

  res.json({
    success: true,
    message: `Conferência concluída. ${statusCounts["ok"] ?? 0} itens OK, ${statusCounts["faltando"] ?? 0} faltando.`,
    processStatus: newStatus,
  });
});

router.patch("/validation/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { status, notes, submittedDocumentId } = req.body as {
    status?: string;
    notes?: string | null;
    submittedDocumentId?: number | null;
  };

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (submittedDocumentId !== undefined) updateData.submittedDocumentId = submittedDocumentId;

  const [updated] = await db.update(validationItemsTable)
    .set(updateData)
    .where(eq(validationItemsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Validation item not found" });
    return;
  }

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
