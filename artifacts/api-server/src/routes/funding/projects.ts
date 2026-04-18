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
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    info: {
      Title: project.title,
      Author: "LicitaIA",
      Subject: "Projeto de Captacao de Recursos",
    },
  });

  const safeTitle = project.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="projeto_${safeTitle}.pdf"`);

  doc.pipe(res);

  const PRIMARY = "#1e40af";
  const LIGHT_BG = "#f0f4ff";
  const TEXT = "#1e293b";
  const MUTED = "#64748b";
  const PW = doc.page.width;        // 595.28
  const PH = doc.page.height;       // 841.89
  const ML = 56;                    // margin left
  const MR = 56;                    // margin right
  const W  = PW - ML - MR;          // usable width

  // ============================================================
  // CAPA
  // ============================================================
  // Faixa azul no topo
  doc.rect(0, 0, PW, 180).fill(PRIMARY);

  // Subtítulo
  doc.fill("#c7d7ff").font("Helvetica").fontSize(9)
    .text("CAPTACAO DE RECURSOS", ML, 62, { width: W, align: "center", characterSpacing: 2 });

  // Título
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(20)
    .text("PROJETO DE CAPTACAO", ML, 80, { width: W, align: "center" });
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(20)
    .text("DE RECURSOS", ML, 104, { width: W, align: "center" });

  // Badge LicitaIA
  doc.fill("#3b5fd9").rect(ML + W / 2 - 55, 136, 110, 22).fill("#3b5fd9");
  doc.fill("#ffffff").font("Helvetica").fontSize(9)
    .text("LicitaIA", ML, 141, { width: W, align: "center" });

  // Bloco info do projeto
  let y = 198;

  // Título do projeto
  doc.fill(TEXT).font("Helvetica-Bold").fontSize(17)
    .text(project.title, ML, y, { width: W });
  y = doc.y + 10;

  // Linha separadora
  doc.rect(ML, y, W, 1).fill("#e2e8f0");
  y += 12;

  // Metadados
  doc.font("Helvetica").fontSize(10);
  const metaLine = (label: string, value: string) => {
    doc.fill(MUTED).text(`${label}  `, ML, y, { continued: true, width: W })
       .fill(TEXT).text(value, { width: W - 80 });
    y = doc.y + 4;
  };

  if (notice?.source)   metaLine("Fonte:", notice.source);
  if (notice?.deadline) {
    const dl = new Date(notice.deadline);
    metaLine("Prazo:", dl.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }));
  }
  if (notice?.maxValue) {
    const val = parseFloat(notice.maxValue);
    if (!isNaN(val))
      metaLine("Valor max.:", val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  }

  const exportDate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  metaLine("Gerado em:", exportDate);

  y += 8;
  doc.rect(ML, y, W, 1).fill("#e2e8f0");
  y += 16;

  // Índice de seções (se houver)
  if (sections.length > 0) {
    doc.fill(MUTED).font("Helvetica-Bold").fontSize(9)
      .text("SECOES DO PROJETO", ML, y, { width: W, characterSpacing: 1 });
    y = doc.y + 6;
    sections.forEach((s, idx) => {
      doc.fill(TEXT).font("Helvetica").fontSize(10)
        .text(`${idx + 1}.  ${s.label.replace(/^\d+\.\s*/, "")}`, ML + 4, y, { width: W });
      y = doc.y + 2;
    });
  }

  // ============================================================
  // SEÇÕES — uma por página
  // ============================================================
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si]!;
    doc.addPage();

    // Número da seção
    const secNum = `${si + 1}/${sections.length}`;

    // Faixa de cabeçalho
    doc.rect(0, 0, PW, 52).fill(PRIMARY);

    // Número da página (canto superior direito)
    doc.fill("#a0b4e8").font("Helvetica").fontSize(8)
      .text(secNum, PW - MR - 30, 12, { width: 30, align: "right" });

    // Label da seção
    const sectionName = section.label.replace(/^\d+\.\s*/, "");
    doc.fill("#c7d7ff").font("Helvetica").fontSize(8)
      .text(`SECAO ${si + 1}`, ML, 14, { width: W, characterSpacing: 1 });
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(15)
      .text(sectionName.toUpperCase(), ML, 28, { width: W - 40 });

    // Badge IA no cabeçalho
    if (section.data!.aiGenerated) {
      doc.fill("#3b5fd9").font("Helvetica").fontSize(7)
        .text("IA", PW - MR - 20, 32, { width: 20, align: "center" });
    }

    // Linha horizontal após cabeçalho
    doc.rect(ML, 58, W, 1).fill(LIGHT_BG);

    // Conteúdo
    const content = section.data!.content ?? "";
    // Remover linhas duplas excessivas e normalizar
    const normalized = content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const paragraphs = normalized.split(/\n\n/);

    doc.fill(TEXT).font("Helvetica").fontSize(11);
    let cy = 72; // cursor inicial após cabeçalho

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Verificar se é item de lista
      const isListItem = /^[-*•]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed);

      if (isListItem) {
        // Processar linhas individuais de lista
        const lines = trimmed.split("\n");
        for (const line of lines) {
          const lt = line.trim().replace(/^[-*•]\s*/, "");
          if (!lt) continue;
          doc.fill(PRIMARY).font("Helvetica-Bold").fontSize(11)
            .text("•", ML, cy, { width: 12, lineGap: 2 });
          doc.fill(TEXT).font("Helvetica").fontSize(11)
            .text(lt, ML + 14, cy, { width: W - 14, align: "justify", lineGap: 2 });
          cy = doc.y + 3;
        }
      } else {
        doc.fill(TEXT).font("Helvetica").fontSize(11)
          .text(trimmed, ML, cy, { width: W, align: "justify", lineGap: 3 });
        cy = doc.y + 10;
      }
    }

    // (sem rodapé absoluto — evita páginas em branco extras)
  }

  // Página vazia (apenas se não houver seções)
  if (sections.length === 0) {
    doc.addPage();
    doc.fill(MUTED).font("Helvetica").fontSize(12)
      .text("Nenhuma secao foi preenchida ainda.", ML, 200, { width: W, align: "center" });
  }

  // ── Página de Validação (opcional) ──────────────────────────────────────
  const wantValidation = req.query.includeValidation === "true";
  if (wantValidation && project.validationResult) {
    const vr = project.validationResult as {
      pontos_fortes?: string[];
      pontos_fracos?: string[];
      itens_faltantes?: string[];
      recomendacoes?: string[];
      nivel_aderencia?: number;
      resumo?: string;
    };
    doc.addPage();

    // Cabeçalho colorido
    const GREEN = "#16a34a";
    const RED = "#dc2626";
    const AMBER = "#d97706";
    const VAL_COLOR = "#7c3aed"; // roxo para distinguir das seções de projeto
    doc.rect(0, 0, PW, 52).fill(VAL_COLOR);
    doc.fill("#ffffff").font("Helvetica-Bold").fontSize(8)
      .text("RELATORIO DE VALIDACAO", ML, 14, { width: W, align: "left" });
    doc.fill("#e2e8f0").font("Helvetica").fontSize(14)
      .text("Conferencia de Aderencia ao Edital", ML, 28, { width: W });
    doc.rect(ML, 58, W, 0.5).fill("#7c3aed");

    let vy = 72;

    // Score de aderência (destaque visual)
    const score = Number(vr.nivel_aderencia ?? 0);
    const scoreColor = score >= 70 ? GREEN : score >= 40 ? AMBER : RED;
    doc.roundedRect(ML, vy, W, 56, 6).fill("#f5f3ff");
    doc.fill(scoreColor).font("Helvetica-Bold").fontSize(36)
      .text(`${score}%`, ML + 12, vy + 10, { width: 80, align: "center" });
    doc.fill(TEXT).font("Helvetica-Bold").fontSize(12)
      .text("Score de aderencia", ML + 100, vy + 10, { width: W - 100 });
    const scoreLabel = score >= 70 ? "Alta aderencia ao edital" : score >= 40 ? "Aderencia moderada — requer ajustes" : "Baixa aderencia — revisao necessaria";
    doc.fill(MUTED).font("Helvetica").fontSize(9)
      .text(scoreLabel, ML + 100, vy + 30, { width: W - 100 });
    vy += 68;

    // Resumo (se houver)
    if (vr.resumo?.trim()) {
      doc.fill(MUTED).font("Helvetica").fontSize(8).text("Resumo:", ML, vy);
      vy = doc.y + 2;
      doc.fill(TEXT).font("Helvetica").fontSize(9).text(vr.resumo, ML, vy, { width: W });
      vy = doc.y + 12;
    }

    // Helper para renderizar uma categoria
    function renderValSection(label: string, items: string[], color: string, bgColor: string) {
      if (!items || items.length === 0) return;
      if (vy > PH - 72 - 80) { doc.addPage(); vy = 72; }
      doc.rect(ML, vy, W, 22).fill(bgColor);
      doc.fill(color).font("Helvetica-Bold").fontSize(9)
        .text(label, ML + 10, vy + 7, { width: W - 20 });
      vy += 28;
      for (const item of items) {
        if (vy > PH - 72 - 20) { doc.addPage(); vy = 72; }
        const safe = item.replace(/[\u0100-\uFFFF]/g, (c) => {
          const map: Record<string,string> = {
            "\u2013":"- ", "\u2014":"- ", "\u2026":"...",
            "\u201c":'"', "\u201d":'"', "\u2018":"'", "\u2019":"'",
            "\u00b7":"-", "\u2022":"-",
          };
          return map[c] ?? "";
        });
        doc.fill(TEXT).font("Helvetica").fontSize(9)
          .text(`- ${safe}`, ML + 6, vy, { width: W - 12 });
        vy = doc.y + 5;
      }
      vy += 8;
    }

    renderValSection("Pontos Fortes", vr.pontos_fortes ?? [], GREEN, "#f0fdf4");
    renderValSection("Pontos a Melhorar", vr.pontos_fracos ?? [], RED, "#fef2f2");
    renderValSection("Itens Faltantes", vr.itens_faltantes ?? [], AMBER, "#fffbeb");
    renderValSection("Recomendacoes", vr.recomendacoes ?? [], VAL_COLOR, "#f5f3ff");
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
