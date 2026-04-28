import { db } from "@workspace/db";
import {
  opportunitySourcesTable,
  opportunitiesTable,
  type OpportunitySource,
  type InsertOpportunity,
} from "@workspace/db";
import { eq, and, gte, isNull, or } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { fetchRssSource, fetchHtmlSource, type RawOpportunityData } from "./opportunity-fetcher";
import { logger } from "../lib/logger";

const AREAS = [
  "cultura", "arte", "saude", "educacao", "inovacao", "tecnologia",
  "social", "meio_ambiente", "esporte", "empreendedorismo", "pesquisa", "outro",
];

const SEED_SOURCES: Omit<typeof opportunitySourcesTable.$inferInsert, "id" | "createdAt">[] = [
  {
    name: "FINEP — Chamadas Públicas de Inovação",
    type: "html_ai",
    url: "https://www.finep.gov.br/chamadas-publicas",
    fetchMethod: "html_ai",
    areaHint: "inovacao,tecnologia,pesquisa",
    fetchIntervalHours: 12,
    isActive: true,
  },
  {
    name: "CNPq — Chamadas Abertas",
    type: "html_ai",
    url: "https://www.gov.br/cnpq/pt-br/acesso-a-informacao/acoes-e-programas/programas/chamadas-abertas",
    fetchMethod: "html_ai",
    areaHint: "pesquisa,ciencia,tecnologia,educacao",
    fetchIntervalHours: 12,
    isActive: true,
  },
  {
    name: "Ministério da Cultura — Editais",
    type: "html_ai",
    url: "https://www.gov.br/cultura/pt-br/assuntos/editais",
    fetchMethod: "html_ai",
    areaHint: "cultura,arte",
    fetchIntervalHours: 12,
    isActive: true,
  },
  {
    name: "BNDES — Chamadas Públicas",
    type: "html_ai",
    url: "https://www.bndes.gov.br/wps/portal/site/home/quem-somos/chamadas-publicas",
    fetchMethod: "html_ai",
    areaHint: "desenvolvimento,sustentabilidade,tecnologia",
    fetchIntervalHours: 24,
    isActive: true,
  },
  {
    name: "CAPES — Editais e Chamadas",
    type: "html_ai",
    url: "https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/editais",
    fetchMethod: "html_ai",
    areaHint: "educacao,pesquisa",
    fetchIntervalHours: 24,
    isActive: true,
  },
  {
    name: "FUNARTE — Editais de Fomento Cultural",
    type: "html_ai",
    url: "https://www.gov.br/funarte/pt-br/acesso-a-informacao/acoes-e-programas",
    fetchMethod: "html_ai",
    areaHint: "cultura,arte,teatro,musica",
    fetchIntervalHours: 24,
    isActive: true,
  },
  {
    name: "FAPESP — Oportunidades de Financiamento",
    type: "rss",
    url: "https://fapesp.br/rss/chamadas/",
    fetchMethod: "rss",
    areaHint: "pesquisa,ciencia,saude",
    fetchIntervalHours: 12,
    isActive: true,
  },
  {
    name: "Ministério do Desenvolvimento Social",
    type: "html_ai",
    url: "https://www.gov.br/mds/pt-br/acesso-a-informacao/acoes-e-programas",
    fetchMethod: "html_ai",
    areaHint: "social,assistencia",
    fetchIntervalHours: 24,
    isActive: true,
  },
  {
    name: "SEBRAE — Chamadas e Oportunidades",
    type: "html_ai",
    url: "https://www.sebrae.com.br/sites/PortalSebrae/programas",
    fetchMethod: "html_ai",
    areaHint: "empreendedorismo,negocios",
    fetchIntervalHours: 24,
    isActive: true,
  },
  {
    name: "FNDE — Programas e Editais",
    type: "html_ai",
    url: "https://www.fnde.gov.br/index.php/programas-e-acoes",
    fetchMethod: "html_ai",
    areaHint: "educacao",
    fetchIntervalHours: 24,
    isActive: true,
  },
];

async function seedSourcesIfEmpty(): Promise<void> {
  const existing = await db.select().from(opportunitySourcesTable);
  if (existing.length > 0) return;
  logger.info("Seeding opportunity sources...");
  for (const src of SEED_SOURCES) {
    try {
      await db.insert(opportunitySourcesTable).values(src).onConflictDoNothing();
    } catch (err) {
      logger.warn({ src: src.name, err }, "Failed to seed source");
    }
  }
  logger.info(`Seeded ${SEED_SOURCES.length} opportunity sources`);
}

function makeContentHash(title: string, link: string): string {
  const raw = `${title.toLowerCase().trim()}|${(link ?? "").toLowerCase().trim()}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i);
    h = h >>> 0;
  }
  return `djb2_${h.toString(16)}`;
}

async function normalizeWithAI(
  rawItems: RawOpportunityData[],
  areaHint: string,
  sourceName: string
): Promise<InsertOpportunity[]> {
  if (rawItems.length === 0) return [];

  const itemsJson = JSON.stringify(
    rawItems.slice(0, 15).map((i) => ({
      title: i.title,
      description: i.description,
      link: i.link,
      publishDate: i.publishDate,
      deadline: i.deadline,
    }))
  );

  const systemPrompt = `Você é um especialista em captação de recursos brasileiros. Sua tarefa é normalizar e enriquecer dados brutos de oportunidades de financiamento.
Para cada item, determine a área temática mais adequada entre: ${AREAS.join(", ")}.
Hint de área da fonte: ${areaHint || "nao definido"}.
NUNCA invente informações. Retorne apenas JSON válido.`;

  const userPrompt = `Normalize estas oportunidades de captação da fonte "${sourceName}":
${itemsJson}

Para cada item, retorne:
{
  "results": [
    {
      "title": "título limpo e conciso",
      "description": "descrição até 300 chars",
      "area": "uma das áreas listadas",
      "targetAudience": "público-alvo ou null",
      "link": "link original ou null",
      "publishDate": "ISO 8601 ou null",
      "deadline": "ISO 8601 ou null",
      "maxValue": "valor máximo formatado (ex: R$ 100.000) ou null"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    return results.map((r: any) => ({
      title: String(r.title ?? "").slice(0, 500),
      description: r.description ? String(r.description).slice(0, 1000) : null,
      area: AREAS.includes(r.area) ? r.area : "outro",
      targetAudience: r.targetAudience ? String(r.targetAudience).slice(0, 300) : null,
      link: r.link ? String(r.link).slice(0, 1000) : null,
      publishDate: r.publishDate ? new Date(r.publishDate) : null,
      deadline: r.deadline ? new Date(r.deadline) : null,
      maxValue: r.maxValue ? String(r.maxValue).slice(0, 100) : null,
      contentHash: makeContentHash(r.title ?? "", r.link ?? ""),
    }));
  } catch (err) {
    logger.warn({ err }, "AI normalization error");
    return [];
  }
}

async function normalizeHtmlWithAI(
  pageText: string,
  areaHint: string,
  sourceName: string,
  sourceUrl: string
): Promise<RawOpportunityData[]> {
  if (!pageText || pageText.length < 100) return [];

  const systemPrompt = `Você é um especialista em captação de recursos brasileiros. Encontre oportunidades de financiamento, editais e chamadas públicas em texto de páginas web.
Retorne apenas JSON válido. Se não encontrar oportunidades, retorne {"opportunities": []}.`;

  const userPrompt = `Analise o texto desta página (${sourceName}, ${sourceUrl}) e extraia todas as oportunidades de captação encontradas.
Área esperada: ${areaHint || "diversas"}.

TEXTO DA PÁGINA:
${pageText.slice(0, 5000)}

Retorne:
{
  "opportunities": [
    {
      "title": "título da oportunidade",
      "description": "descrição breve (máx 250 chars)",
      "link": "URL se mencionada",
      "deadline": "prazo em ISO 8601 ou null",
      "maxValue": "valor máximo ou null",
      "targetAudience": "público-alvo ou null"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
  } catch (err) {
    logger.warn({ err }, "HTML AI extraction error");
    return [];
  }
}

async function collectFromSource(source: OpportunitySource): Promise<number> {
  logger.info({ sourceId: source.id, name: source.name }, "Collecting from source");
  let rawItems: RawOpportunityData[] = [];
  let fetchError: string | undefined;

  if (source.fetchMethod === "rss") {
    const result = await fetchRssSource(source.url);
    rawItems = result.items;
    fetchError = result.error;
  } else {
    const result = await fetchHtmlSource(source.url);
    fetchError = result.error;
    if (result.text) {
      rawItems = await normalizeHtmlWithAI(result.text, source.areaHint ?? "", source.name, source.url);
    }
  }

  // Update source fetch status
  await db
    .update(opportunitySourcesTable)
    .set({
      lastFetchedAt: new Date(),
      lastFetchStatus: fetchError ? "error" : rawItems.length === 0 ? "empty" : "ok",
      lastFetchError: fetchError ?? null,
    })
    .where(eq(opportunitySourcesTable.id, source.id));

  if (rawItems.length === 0) {
    logger.info({ sourceId: source.id, fetchError }, "No items found");
    return 0;
  }

  // Normalize with AI
  let normalized: InsertOpportunity[];
  if (source.fetchMethod === "rss") {
    normalized = await normalizeWithAI(rawItems, source.areaHint ?? "", source.name);
  } else {
    // HTML AI already extracted structured data; just map to InsertOpportunity
    normalized = rawItems.map((r) => ({
      title: String(r.title ?? "").slice(0, 500),
      description: r.description ? String(r.description).slice(0, 1000) : null,
      area: AREAS.includes(r.area ?? "") ? r.area : "outro",
      targetAudience: r.targetAudience ? String(r.targetAudience).slice(0, 300) : null,
      link: r.link ? String(r.link).slice(0, 1000) : null,
      publishDate: r.publishDate ? new Date(r.publishDate) : null,
      deadline: r.deadline ? new Date(r.deadline) : null,
      maxValue: r.maxValue ? String(r.maxValue).slice(0, 100) : null,
      contentHash: makeContentHash(r.title ?? "", r.link ?? ""),
    }));
  }

  let inserted = 0;
  for (const opp of normalized) {
    if (!opp.title || opp.title.length < 5) continue;
    try {
      const result = await db
        .insert(opportunitiesTable)
        .values({
          ...opp,
          sourceId: source.id,
          sourceName: source.name,
          isNew: true,
        })
        .onConflictDoNothing();
      if ((result as any).rowCount > 0) inserted++;
    } catch (err) {
      logger.warn({ err, title: opp.title }, "Failed to insert opportunity");
    }
  }

  logger.info({ sourceId: source.id, normalized: normalized.length, inserted }, "Collection done");
  return inserted;
}

export async function runOpportunityCollection(): Promise<{ checked: number; inserted: number }> {
  await seedSourcesIfEmpty();

  const now = new Date();
  const sources = await db
    .select()
    .from(opportunitySourcesTable)
    .where(eq(opportunitySourcesTable.isActive, true));

  const due = sources.filter((s) => {
    if (!s.lastFetchedAt) return true;
    const nextFetch = new Date(s.lastFetchedAt.getTime() + s.fetchIntervalHours * 3600 * 1000);
    return now >= nextFetch;
  });

  let totalInserted = 0;
  for (const source of due) {
    try {
      const n = await collectFromSource(source);
      totalInserted += n;
    } catch (err) {
      logger.error({ sourceId: source.id, err }, "Unhandled error collecting from source");
    }
  }

  return { checked: due.length, inserted: totalInserted };
}
