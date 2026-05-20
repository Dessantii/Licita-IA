import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  processesTable,
  extractedRequirementsTable,
  companyDocumentsTable,
} from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// ── PATCH /processes/:id/post-session-timeline ────────────────────────────────

router.patch("/processes/:id/post-session-timeline", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { timeline } = req.body;
  await db.update(processesTable).set({ postSessionTimeline: timeline }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── PATCH /processes/:id/habilitacao-deadline ─────────────────────────────────

router.patch("/processes/:id/habilitacao-deadline", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { deadline } = req.body as { deadline: string };
  const date = deadline ? new Date(deadline) : null;
  await db.update(processesTable).set({ postSessionHabilitacaoDeadline: date }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── PATCH /processes/:id/adjudication ────────────────────────────────────────

router.patch("/processes/:id/adjudication", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { adjudicatedAt, adjudicationNumber } = req.body as { adjudicatedAt?: string; adjudicationNumber?: string };
  await db.update(processesTable).set({
    adjudicatedAt: adjudicatedAt ? new Date(adjudicatedAt) : null,
    adjudicationNumber: adjudicationNumber ?? null,
    currentPhase: adjudicatedAt ? "adjudicado" : undefined,
  }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── PATCH /processes/:id/homologation ────────────────────────────────────────

router.patch("/processes/:id/homologation", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { homologatedAt, homologationNumber } = req.body as { homologatedAt?: string; homologationNumber?: string };
  await db.update(processesTable).set({
    homologatedAt: homologatedAt ? new Date(homologatedAt) : null,
    homologationNumber: homologationNumber ?? null,
    currentPhase: homologatedAt ? "homologado" : undefined,
  }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── GET /processes/:id/habilitacao-docs ──────────────────────────────────────

const TIPO_KEYWORDS: Record<string, string[]> = {
  certidao_federal: ["federal", "receita", "rfb", "pgfn", "débito federal"],
  certidao_estadual: ["estadual", "sefaz", "icms", "fazenda estadual"],
  certidao_municipal: ["municipal", "iss", "issqn", "prefeitura", "tributo municipal"],
  certidao_trabalhista: ["trabalhista", "tst", "tribunal superior"],
  certidao_fgts: ["fgts", "crf", "fundo de garantia"],
  cnpj: ["cnpj", "cadastro nacional", "comprovante de inscrição"],
  estatuto_social: ["estatuto", "contrato social", "ata de constituição"],
  balanco_patrimonial: ["balanço", "balanco", "patrimonial", "demonstração"],
  declaracao: ["declaração", "declaracao", "declaração de"],
};

function detectTipoFromTitle(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [tipo, keywords] of Object.entries(TIPO_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return tipo;
  }
  return null;
}

function isDocExpired(doc: { dataValidade?: string | null }): boolean {
  if (!doc.dataValidade) return false;
  return new Date(doc.dataValidade) < new Date();
}

router.get("/processes/:id/habilitacao-docs", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [process] = await db.select({ id: processesTable.id, companyId: processesTable.companyId })
    .from(processesTable).where(eq(processesTable.id, id));
  if (!process) { res.status(404).json({ error: "Not found" }); return; }

  const requirements = await db.select()
    .from(extractedRequirementsTable)
    .where(and(
      eq(extractedRequirementsTable.processId, id),
      or(
        ilike(extractedRequirementsTable.category, "%habilitação%"),
        ilike(extractedRequirementsTable.category, "%habilitacao%"),
        ilike(extractedRequirementsTable.category, "%documental%"),
      )
    ));

  if (!process.companyId) {
    res.json(requirements.map((r) => ({ ...r, matchedDocument: null, status: "absent" })));
    return;
  }

  const companyDocs = await db.select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.companyId, process.companyId));

  const result = requirements.map((req) => {
    const tipo = detectTipoFromTitle(req.title);
    const matched = tipo ? companyDocs.find((d) => d.tipo === tipo) ?? null : null;
    const status = matched
      ? (isDocExpired(matched) ? "expired" : "available")
      : "absent";
    return {
      id: req.id,
      title: req.title,
      description: req.description,
      mandatory: req.mandatory,
      matchedDocument: matched
        ? {
            id: matched.id,
            titulo: matched.titulo,
            tipo: matched.tipo,
            dataValidade: matched.dataValidade,
          }
        : null,
      status,
    };
  });

  res.json(result);
});

// ── POST /processes/:id/generate-recurso ─────────────────────────────────────

router.post("/processes/:id/generate-recurso", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [process] = await db.select().from(processesTable).where(eq(processesTable.id, id));
  if (!process) { res.status(404).json({ error: "Not found" }); return; }

  const {
    type,
    motivoRecurso,
    pontosContestacao,
    lanceVencedor,
    lanceUsuario,
  } = req.body as {
    type: "recurso" | "contrarrazoes";
    motivoRecurso?: string;
    pontosContestacao?: string;
    lanceVencedor?: string;
    lanceUsuario?: string;
  };

  const isRecurso = type === "recurso";

  const systemPrompt = `Você é um especialista em licitações públicas brasileiras com amplo conhecimento jurídico em direito administrativo. 
Redija documentos formais, claros e tecnicamente precisos, conforme a Lei 14.133/2021 e jurisprudência dos Tribunais de Contas.`;

  const userPrompt = isRecurso
    ? `Redija uma minuta formal de recurso administrativo para a seguinte licitação:

Objeto: ${process.title}
Órgão: ${process.agency}
Modalidade: ${process.modality}
Número do edital: ${process.editalNumber ?? "não informado"}
Lance do recorrente (nossa proposta): R$ ${lanceUsuario ?? "não informado"}
Lance vencedor: R$ ${lanceVencedor ?? "não informado"}
Motivo do recurso: ${motivoRecurso ?? ""}

A minuta deve conter:
1. Cabeçalho formal com identificação do processo e do recorrente
2. "Dos Fatos" — resumo objetivo do resultado da sessão
3. "Do Direito" — fundamentação jurídica
4. "Do Recurso" — argumentos em favor do recorrente
5. "Do Pedido" — solicitação de provimento do recurso
6. Data e espaço para assinatura

Linguagem: formal, técnica, acessível. Máximo 800 palavras.`
    : `Redija uma minuta formal de contrarrazões ao recurso administrativo para a seguinte licitação:

Objeto: ${process.title}
Órgão: ${process.agency}
Modalidade: ${process.modality}
Número do edital: ${process.editalNumber ?? "não informado"}
Motivo alegado pelo recorrente: ${motivoRecurso ?? ""}
Pontos que queremos contestar: ${pontosContestacao ?? ""}

A minuta deve conter:
1. Cabeçalho formal com identificação do processo e das partes
2. "Dos Fatos" — resumo da sessão e resultado
3. "Das Contrarrazões" — contra-argumentos ao recurso
4. "Do Pedido" — manutenção da decisão original
5. Data e espaço para assinatura

Linguagem: formal, técnica, acessível. Máximo 700 palavras.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const minuta = completion.choices[0]?.message?.content ?? "";
    res.json({ minuta });
  } catch (err) {
    logger.error({ err }, "Failed to generate recurso minuta");
    res.status(500).json({ error: "Falha ao gerar minuta" });
  }
});

export default router;
export { router as postSessionRouter };
