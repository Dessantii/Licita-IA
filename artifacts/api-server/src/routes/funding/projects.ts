import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  fundingProjectsTable,
  fundingNoticesTable,
  projectSectionsTable,
  projectSectionTypeEnum,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const VALID_SECTION_TYPES = projectSectionTypeEnum.enumValues;

const SECTION_LABELS: Record<string, string> = {
  problema: "Problema",
  justificativa: "Justificativa",
  objetivo_geral: "Objetivo Geral",
  objetivos_especificos: "Objetivos Específicos",
  metodologia: "Metodologia",
  impacto: "Impacto Esperado",
  cronograma: "Cronograma",
  orcamento: "Orçamento",
};

const generateSectionSchema = z.object({
  section_type: z.enum(VALID_SECTION_TYPES as [string, ...string[]]),
  contexto: z.string().min(1, "Contexto do projeto é obrigatório"),
});

// POST /api/projects/:id/generate-section
router.post("/:id/generate-section", async (req, res) => {
  const projectId = parseInt(req.params.id!);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "ID de projeto inválido" });
    return;
  }

  const parsed = generateSectionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Dados inválidos",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { section_type, contexto } = parsed.data;

  // 1. Buscar o projeto
  const [project] = await db
    .select()
    .from(fundingProjectsTable)
    .where(eq(fundingProjectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  // 2. Buscar dados do edital vinculado (se houver)
  let editalContext = "Nenhum edital vinculado ao projeto.";

  if (project.fundingNoticeId) {
    const [notice] = await db
      .select({
        title: fundingNoticesTable.title,
        description: fundingNoticesTable.description,
        source: fundingNoticesTable.source,
        structuredData: fundingNoticesTable.structuredData,
        rawText: fundingNoticesTable.rawText,
      })
      .from(fundingNoticesTable)
      .where(eq(fundingNoticesTable.id, project.fundingNoticeId));

    if (notice) {
      const structured = notice.structuredData as Record<string, unknown> | null;
      const parts: string[] = [];

      if (notice.title) parts.push(`Título: ${notice.title}`);
      if (notice.source) parts.push(`Fonte: ${notice.source}`);

      if (structured && typeof structured === "object") {
        for (const [key, value] of Object.entries(structured)) {
          if (value && typeof value !== "object") {
            parts.push(`${key}: ${String(value)}`);
          } else if (Array.isArray(value)) {
            parts.push(`${key}:\n${(value as string[]).map((v) => `- ${v}`).join("\n")}`);
          }
        }
      }

      // Fallback para rawText se não houver dados estruturados
      if (parts.length <= 2 && notice.rawText) {
        parts.push(`\nConteúdo do edital (trecho):\n${notice.rawText.slice(0, 6000)}`);
      }

      editalContext = parts.join("\n");
    }
  }

  // 3. Montar prompt exato conforme especificado
  const sectionLabel = SECTION_LABELS[section_type] ?? section_type;

  const prompt = `Você é especialista em elaboração de projetos para captação de recursos.

Baseado no edital abaixo:
${editalContext}

E no contexto do projeto:
${contexto}

Gere o conteúdo para a seção: ${sectionLabel}

Regras:
* seja específico
* evite texto genérico
* escreva de forma convincente
* alinhe com critérios do edital

Retorne apenas o texto final.`;

  // 4. Chamar OpenAI
  let generatedContent: string;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    generatedContent = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!generatedContent) {
      res.status(502).json({ error: "IA retornou conteúdo vazio" });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Falha ao gerar seção com OpenAI");
    res.status(502).json({ error: "Falha ao gerar conteúdo com IA" });
    return;
  }

  // 5. Upsert em project_sections (atualiza se já existir para este projeto + tipo)
  const [existing] = await db
    .select({ id: projectSectionsTable.id })
    .from(projectSectionsTable)
    .where(
      and(
        eq(projectSectionsTable.projectId, projectId),
        eq(projectSectionsTable.type, section_type as typeof VALID_SECTION_TYPES[number])
      )
    );

  let section;

  if (existing) {
    [section] = await db
      .update(projectSectionsTable)
      .set({
        content: generatedContent,
        aiGenerated: true,
      })
      .where(eq(projectSectionsTable.id, existing.id))
      .returning();
  } else {
    [section] = await db
      .insert(projectSectionsTable)
      .values({
        projectId,
        type: section_type as typeof VALID_SECTION_TYPES[number],
        content: generatedContent,
        aiGenerated: true,
      })
      .returning();
  }

  res.status(existing ? 200 : 201).json({
    ...section,
    createdAt: section!.createdAt.toISOString(),
    updatedAt: section!.updatedAt.toISOString(),
  });
});

// POST /api/projects/:id/validate — comparar projeto com edital via IA
router.post("/:id/validate", async (req, res) => {
  const projectId = parseInt(req.params.id!);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "ID de projeto inválido" });
    return;
  }

  // 1. Buscar projeto
  const [project] = await db
    .select()
    .from(fundingProjectsTable)
    .where(eq(fundingProjectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  // 2. Buscar todas as seções do projeto
  const sections = await db
    .select()
    .from(projectSectionsTable)
    .where(eq(projectSectionsTable.projectId, projectId));

  if (sections.length === 0) {
    res.status(422).json({
      error: "O projeto não possui seções geradas ainda. Gere ao menos uma seção antes de validar.",
    });
    return;
  }

  // Montar resumo do projeto com todas as seções
  const SECTION_LABELS: Record<string, string> = {
    problema: "Problema",
    justificativa: "Justificativa",
    objetivo_geral: "Objetivo Geral",
    objetivos_especificos: "Objetivos Específicos",
    metodologia: "Metodologia",
    impacto: "Impacto Esperado",
    cronograma: "Cronograma",
    orcamento: "Orçamento",
  };

  const projectText = sections
    .map((s) => `## ${SECTION_LABELS[s.type] ?? s.type}\n${s.content ?? "(sem conteúdo)"}`)
    .join("\n\n");

  // 3. Buscar dados do edital vinculado
  let editalText = "Nenhum edital vinculado ao projeto.";

  if (project.fundingNoticeId) {
    const [notice] = await db
      .select()
      .from(fundingNoticesTable)
      .where(eq(fundingNoticesTable.id, project.fundingNoticeId));

    if (notice) {
      const parts: string[] = [];
      if (notice.title) parts.push(`Título: ${notice.title}`);
      if (notice.source) parts.push(`Fonte: ${notice.source}`);

      const structured = notice.structuredData as Record<string, unknown> | null;
      if (structured && typeof structured === "object") {
        for (const [key, value] of Object.entries(structured)) {
          if (value == null) continue;
          if (typeof value !== "object") {
            parts.push(`${key}: ${String(value)}`);
          } else if (Array.isArray(value)) {
            parts.push(`${key}:\n${(value as string[]).map((v) => `- ${v}`).join("\n")}`);
          }
        }
      }

      if (parts.length <= 2 && notice.rawText) {
        parts.push(`\nConteúdo do edital:\n${notice.rawText.slice(0, 5000)}`);
      }

      editalText = parts.join("\n");
    }
  }

  // 4. Prompt de validação
  const prompt = `Compare o projeto com o edital.

EDITAL:
${editalText}

PROJETO (título: ${project.title}):
${projectText}

Retorne:
* pontos fortes
* pontos fracos
* itens faltantes
* nível de aderência (0 a 100)

Seja objetivo e crítico.

Responda APENAS com JSON válido nesta estrutura exata:
{
  "pontos_fortes": ["string", ...],
  "pontos_fracos": ["string", ...],
  "itens_faltantes": ["string", ...],
  "nivel_aderencia": número inteiro de 0 a 100,
  "resumo": "parágrafo resumindo a avaliação geral"
}`;

  // 5. Chamar OpenAI forçando resposta JSON
  let validation: {
    pontos_fortes: string[];
    pontos_fracos: string[];
    itens_faltantes: string[];
    nivel_aderencia: number;
    resumo: string;
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      req.log.error({ raw }, "IA retornou JSON inválido na validação");
      res.status(502).json({ error: "IA retornou resposta em formato inválido" });
      return;
    }

    // Normalizar e validar campos obrigatórios
    const toStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];

    const nivel = Number(parsed.nivel_aderencia ?? parsed.nivel ?? 0);

    validation = {
      pontos_fortes: toStringArray(parsed.pontos_fortes),
      pontos_fracos: toStringArray(parsed.pontos_fracos),
      itens_faltantes: toStringArray(parsed.itens_faltantes),
      nivel_aderencia: Math.min(100, Math.max(0, Math.round(nivel))),
      resumo: String(parsed.resumo ?? ""),
    };
  } catch (err) {
    req.log.error({ err }, "Falha ao chamar OpenAI para validação");
    res.status(502).json({ error: "Falha ao processar validação com IA" });
    return;
  }

  // 6. Salvar resultado no banco (upsert na seção especial "validacao")
  // Salvo diretamente na tabela de projetos via update de um campo jsonb dedicado
  await db
    .update(fundingProjectsTable)
    .set({ status: project.status }) // força updatedAt via $onUpdate
    .where(eq(fundingProjectsTable.id, projectId));

  res.json({
    projectId,
    projectTitle: project.title,
    sectionsAnalyzed: sections.length,
    ...validation,
    validatedAt: new Date().toISOString(),
  });
});

// GET /api/projects/:id/sections — listar todas as seções de um projeto
router.get("/:id/sections", async (req, res) => {
  const projectId = parseInt(req.params.id!);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [project] = await db
    .select({ id: fundingProjectsTable.id })
    .from(fundingProjectsTable)
    .where(eq(fundingProjectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return;
  }

  const sections = await db
    .select()
    .from(projectSectionsTable)
    .where(eq(projectSectionsTable.projectId, projectId));

  res.json(
    sections.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  );
});

export default router;
