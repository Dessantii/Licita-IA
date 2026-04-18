import { Router, type IRouter } from "express";
import { createRequire } from "node:module";
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

const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = _require("pdfkit") as typeof import("pdfkit");

const router: IRouter = Router();

const VALID_SECTION_TYPES = projectSectionTypeEnum.enumValues;

// GET /api/projects — listar projetos do usuário autenticado
router.get("/", async (req, res) => {
  const userId = (req as any).userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Não autenticado" }); return; }

  const projects = await db
    .select({
      id: fundingProjectsTable.id,
      title: fundingProjectsTable.title,
      status: fundingProjectsTable.status,
      fundingNoticeId: fundingProjectsTable.fundingNoticeId,
      validatedAt: fundingProjectsTable.validatedAt,
      createdAt: fundingProjectsTable.createdAt,
      updatedAt: fundingProjectsTable.updatedAt,
      noticeTitle: fundingNoticesTable.title,
      noticeSource: fundingNoticesTable.source,
    })
    .from(fundingProjectsTable)
    .leftJoin(fundingNoticesTable, eq(fundingProjectsTable.fundingNoticeId, fundingNoticesTable.id))
    .where(eq(fundingProjectsTable.userId, userId));

  res.json(
    projects.map((p) => ({
      ...p,
      validatedAt: p.validatedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

// POST /api/projects — criar novo projeto
router.post("/", async (req, res) => {
  const userId = (req as any).userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Não autenticado" }); return; }

  const schema = z.object({
    title: z.string().min(1, "Título obrigatório"),
    fundingNoticeId: z.number().int().positive().optional(),
    description: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const [project] = await db
    .insert(fundingProjectsTable)
    .values({ userId, ...parsed.data })
    .returning();

  res.status(201).json({
    ...project!,
    createdAt: project!.createdAt.toISOString(),
    updatedAt: project!.updatedAt.toISOString(),
  });
});

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

  // 3. Montar prompt com system/user separados
  const sectionLabel = SECTION_LABELS[section_type] ?? section_type;

  const systemMsg = `Você é um especialista em elaboração de projetos para editais de captação de recursos.
Seu trabalho é escrever conteúdos que aumentem a chance de aprovação.
REGRAS CRÍTICAS:
* Evite frases genéricas
* Use linguagem clara e objetiva
* Seja específico e contextualizado
* Alinhe SEMPRE com os critérios do edital
* Não repita informações desnecessárias
* Escreva como se fosse avaliado por um comitê`;

  const userMsg = `Gere a seção "${sectionLabel}" para o projeto abaixo.

EDITAL:
${editalContext}

PROJETO:
${contexto}

REGRAS:
* Deve estar alinhado ao edital
* Deve ser convincente
* Deve demonstrar impacto
* Evitar clichês

Retorne apenas o texto final da seção.`;

  // 4. Chamar OpenAI
  let generatedContent: string;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1000,
      temperature: 0.6,
      top_p: 1,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
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

  // 4. Prompt com system/user separados
  const validateSystemMsg = `Você é um avaliador de editais de captação de recursos.
Seu trabalho é avaliar criticamente projetos.
Seja direto, objetivo e honesto. Aponte problemas sem suavizar.
Retorne APENAS JSON.`;

  const validateUserMsg = `Compare o projeto com o edital.

EDITAL:
${editalText}

PROJETO (título: ${project.title}):
${projectText}

Retorne:
{
  "aderencia_score": 0-100,
  "pontos_fortes": [],
  "pontos_fracos": [],
  "itens_faltantes": [],
  "recomendacoes": [],
  "resumo": "parágrafo objetivo da avaliação"
}

Regras:
* Score baseado em aderência real
* Não inventar
* Seja crítico`;

  // 5. Chamar OpenAI forçando resposta JSON
  let validation: {
    pontos_fortes: string[];
    pontos_fracos: string[];
    itens_faltantes: string[];
    recomendacoes: string[];
    nivel_aderencia: number;
    resumo: string;
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 800,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: validateSystemMsg },
        { role: "user", content: validateUserMsg },
      ],
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

    // Normalizar — aceita tanto aderencia_score (novo) quanto nivel_aderencia (legado)
    const toStringArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : [];

    const nivel = Number(parsed.aderencia_score ?? parsed.nivel_aderencia ?? parsed.nivel ?? 0);

    validation = {
      pontos_fortes: toStringArray(parsed.pontos_fortes),
      pontos_fracos: toStringArray(parsed.pontos_fracos),
      itens_faltantes: toStringArray(parsed.itens_faltantes),
      recomendacoes: toStringArray(parsed.recomendacoes),
      nivel_aderencia: Math.min(100, Math.max(0, Math.round(nivel))),
      resumo: String(parsed.resumo ?? ""),
    };
  } catch (err) {
    req.log.error({ err }, "Falha ao chamar OpenAI para validação");
    res.status(502).json({ error: "Falha ao processar validação com IA" });
    return;
  }

  // 6. Salvar resultado no banco
  const now = new Date();
  const resultToSave = {
    projectId,
    projectTitle: project.title,
    sectionsAnalyzed: sections.length,
    ...validation,
    validatedAt: now.toISOString(),
  };

  await db
    .update(fundingProjectsTable)
    .set({ validationResult: resultToSave, validatedAt: now })
    .where(eq(fundingProjectsTable.id, projectId));

  res.json(resultToSave);
});

// POST /api/projects/:id/rewrite-section — melhorar texto escrito pelo usuário
router.post("/:id/rewrite-section", async (req, res) => {
  const projectId = parseInt(req.params.id!);
  if (isNaN(projectId)) { res.status(400).json({ error: "ID inválido" }); return; }

  const schema = z.object({
    section_type: z.enum(VALID_SECTION_TYPES as [string, ...string[]]),
    texto: z.string().min(10, "Texto muito curto para reescrita"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { section_type, texto } = parsed.data;

  // Buscar projeto e edital
  const [project] = await db.select().from(fundingProjectsTable).where(eq(fundingProjectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }

  let editalContext = "Nenhum edital vinculado.";
  if (project.fundingNoticeId) {
    const [notice] = await db.select().from(fundingNoticesTable).where(eq(fundingNoticesTable.id, project.fundingNoticeId));
    if (notice) {
      const structured = notice.structuredData as Record<string, unknown> | null;
      const parts: string[] = [];
      if (notice.title) parts.push(`Título: ${notice.title}`);
      if (structured) {
        for (const [k, v] of Object.entries(structured)) {
          if (v && typeof v !== "object") parts.push(`${k}: ${String(v)}`);
          else if (Array.isArray(v)) parts.push(`${k}:\n${(v as string[]).map(i => `- ${i}`).join("\n")}`);
        }
      }
      editalContext = parts.join("\n");
    }
  }

  const SECTION_LABELS: Record<string, string> = {
    problema: "Problema", justificativa: "Justificativa", objetivo_geral: "Objetivo Geral",
    objetivos_especificos: "Objetivos Específicos", metodologia: "Metodologia",
    impacto: "Impacto Esperado", cronograma: "Cronograma", orcamento: "Orçamento",
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 800,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `Você é um especialista em escrita estratégica para aprovação em editais.
Seu papel é melhorar textos mantendo o sentido original.
REGRAS:
* Não mudar o significado
* Melhorar clareza e impacto
* Tornar mais profissional
* Evitar linguagem genérica
* Alinhar com critérios de avaliação`,
        },
        {
          role: "user",
          content: `Melhore o texto abaixo para a seção "${SECTION_LABELS[section_type] ?? section_type}":

TEXTO:
${texto}

EDITAL:
${editalContext}

Retorne apenas a versão melhorada.`,
        },
      ],
    });

    const improved = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!improved) { res.status(502).json({ error: "IA retornou conteúdo vazio" }); return; }

    res.json({ improved, section_type });
  } catch (err) {
    req.log.error({ err }, "Falha ao reescrever seção com OpenAI");
    res.status(502).json({ error: "Falha ao melhorar o texto com IA" });
  }
});

// GET /api/projects/:id/export — exportar projeto como PDF
router.get("/:id/export", async (req, res) => {
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

  // 2. Buscar edital vinculado (se houver)
  let notice: { title: string | null; source: string | null; deadline: Date | null; maxValue: string | null } | null = null;
  if (project.fundingNoticeId) {
    const [n] = await db
      .select({
        title: fundingNoticesTable.title,
        source: fundingNoticesTable.source,
        deadline: fundingNoticesTable.deadline,
        maxValue: fundingNoticesTable.maxValue,
      })
      .from(fundingNoticesTable)
      .where(eq(fundingNoticesTable.id, project.fundingNoticeId));
    notice = n ?? null;
  }

  // 3. Buscar seções na ordem canônica
  const SECTION_ORDER = [
    "problema", "justificativa", "objetivo_geral", "objetivos_especificos",
    "metodologia", "impacto", "cronograma", "orcamento",
  ] as const;

  const SECTION_LABELS: Record<string, string> = {
    problema: "1. Problema",
    justificativa: "2. Justificativa",
    objetivo_geral: "3. Objetivo Geral",
    objetivos_especificos: "4. Objetivos Específicos",
    metodologia: "5. Metodologia",
    impacto: "6. Impacto Esperado",
    cronograma: "7. Cronograma",
    orcamento: "8. Orçamento",
  };

  const allSections = await db
    .select()
    .from(projectSectionsTable)
    .where(eq(projectSectionsTable.projectId, projectId));

  const sectionMap = new Map(allSections.map((s) => [s.type, s]));

  const sections = SECTION_ORDER
    .map((type) => ({ type, label: SECTION_LABELS[type]!, data: sectionMap.get(type) ?? null }))
    .filter((s) => s.data?.content);

  // 4. Gerar PDF
  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    info: {
      Title: project.title,
      Author: "LicitaIA",
      Subject: "Projeto de Captacao de Recursos",
    },
  });

  // Headers de download
  const safeTitle = project.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="projeto_${safeTitle}.pdf"`);

  doc.pipe(res);

  const PRIMARY = "#1e40af";
  const TEXT = "#1e293b";
  const MUTED = "#64748b";
  const WIDTH = doc.page.width - 144;

  // --- Capa ---
  doc.rect(0, 0, doc.page.width, 200).fill(PRIMARY);

  doc.fill("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("PROJETO DE CAPTAÇÃO DE RECURSOS", 72, 72, { width: WIDTH, align: "center" });

  doc.moveDown(0.5)
    .fontSize(13)
    .font("Helvetica")
    .text("LicitaIA - Elaboracao assistida por IA", { width: WIDTH, align: "center" });

  // Caixa de informações do projeto
  doc.fill(TEXT);
  const infoY = 230;
  doc.rect(72, infoY, WIDTH, 1).fill("#e2e8f0");
  doc.moveDown(1);

  doc.fill(TEXT).font("Helvetica-Bold").fontSize(18).text(project.title, 72, infoY + 16, { width: WIDTH });

  let metaY = infoY + 50;
  if (notice?.source) {
    doc.fill(MUTED).font("Helvetica").fontSize(10).text(`Fonte: ${notice.source}`, 72, metaY);
    metaY += 16;
  }
  if (notice?.deadline) {
    const dl = new Date(notice.deadline);
    const fmt = dl.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    doc.fill(MUTED).fontSize(10).text(`Prazo: ${fmt}`, 72, metaY);
    metaY += 16;
  }
  if (notice?.maxValue) {
    const val = parseFloat(notice.maxValue);
    if (!isNaN(val)) {
      doc.fill(MUTED).fontSize(10).text(
        `Valor máximo: ${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        72, metaY
      );
      metaY += 16;
    }
  }

  const exportDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.fill(MUTED).fontSize(10).text(`Gerado em: ${exportDate}`, 72, metaY);

  doc.rect(72, metaY + 20, WIDTH, 1).fill("#e2e8f0");

  if (sections.length === 0) {
    doc.addPage();
    doc.fill(MUTED).font("Helvetica").fontSize(12)
      .text("Nenhuma seção foi preenchida ainda.", { align: "center" });
  }

  // --- Seções ---
  for (const section of sections) {
    doc.addPage();

    // Cabeçalho da seção
    doc.rect(72, 72, WIDTH, 36).fill(PRIMARY);
    doc.fill("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(section.label.toUpperCase(), 84, 82, { width: WIDTH - 24 });

    doc.moveDown(2);

    // Conteúdo
    const content = section.data!.content!;
    const paragraphs = content.split(/\n\n+/);

    doc.fill(TEXT).font("Helvetica").fontSize(11);
    let first = true;
    for (const para of paragraphs) {
      if (!first) doc.moveDown(0.8);
      first = false;
      const trimmed = para.trim();
      if (!trimmed) continue;
      doc.text(trimmed, 72, undefined, {
        width: WIDTH,
        align: "justify",
        lineGap: 4,
      });
    }

    // Rodapé com badge IA
    if (section.data!.aiGenerated) {
      const footY = doc.page.height - 60;
      doc.fill(MUTED).font("Helvetica").fontSize(8)
        .text("* Conteudo gerado com auxilio de IA (LicitaIA) - sujeito a revisao humana", 72, footY, {
          width: WIDTH,
          align: "right",
        });
    }
  }

  // --- Numeração de páginas ---
  const pageCount = (doc as any).bufferedPageRange?.()?.count ?? 0;
  if (pageCount > 0) {
    for (let i = 0; i < pageCount; i++) {
      (doc as any).switchToPage?.(i);
      if (i === 0) continue; // pula capa
      doc.fill(MUTED).font("Helvetica").fontSize(8)
        .text(`Página ${i} de ${pageCount - 1}`, 72, doc.page.height - 40, {
          width: WIDTH,
          align: "center",
        });
    }
  }

  doc.end();
});

// GET /api/projects/:id/validation — retornar resultado de validação salvo
router.get("/:id/validation", async (req, res) => {
  const projectId = parseInt(req.params.id!);
  if (isNaN(projectId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const userId = (req as any).userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Não autenticado" }); return; }

  const [project] = await db
    .select({ validationResult: fundingProjectsTable.validationResult, userId: fundingProjectsTable.userId })
    .from(fundingProjectsTable)
    .where(eq(fundingProjectsTable.id, projectId));

  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (!project.validationResult) { res.status(404).json({ error: "Validação não encontrada" }); return; }

  res.json(project.validationResult);
});

// DELETE /api/projects/:id — excluir projeto
router.delete("/:id", async (req, res) => {
  const projectId = parseInt(req.params.id!);
  if (isNaN(projectId)) { res.status(400).json({ error: "ID inválido" }); return; }
  const userId = (req as any).userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Não autenticado" }); return; }

  const [project] = await db
    .select({ id: fundingProjectsTable.id, userId: fundingProjectsTable.userId })
    .from(fundingProjectsTable)
    .where(eq(fundingProjectsTable.id, projectId));

  if (!project) { res.status(404).json({ error: "Projeto não encontrado" }); return; }
  if (project.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  await db.delete(fundingProjectsTable).where(eq(fundingProjectsTable.id, projectId));
  res.json({ success: true });
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
