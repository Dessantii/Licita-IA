import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { guideArticlesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// Simple in-memory rate limiter: userId → { count, resetAt }
const askRateLimiter = new Map<number, { count: number; resetAt: number }>();

function checkAskRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = askRateLimiter.get(userId);
  if (!entry || now > entry.resetAt) {
    askRateLimiter.set(userId, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// Columns returned in list endpoints (no content)
const listColumns = {
  id: guideArticlesTable.id,
  slug: guideArticlesTable.slug,
  title: guideArticlesTable.title,
  description: guideArticlesTable.description,
  category: guideArticlesTable.category,
  readingTime: guideArticlesTable.readingTime,
  icon: guideArticlesTable.icon,
  orderInCategory: guideArticlesTable.orderInCategory,
  helpfulYes: guideArticlesTable.helpfulYes,
  helpfulNo: guideArticlesTable.helpfulNo,
};

// GET /api/guides — all published articles (list only, no content)
router.get("/guides", async (_req, res) => {
  const articles = await db
    .select(listColumns)
    .from(guideArticlesTable)
    .where(eq(guideArticlesTable.published, true))
    .orderBy(guideArticlesTable.category, guideArticlesTable.orderInCategory);
  res.json(articles);
});

// GET /api/guides/search?q=termo — search in title, description, content
router.get("/guides/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }

  const pattern = `%${q}%`;
  const articles = await db
    .select({
      ...listColumns,
      excerpt: sql<string>`
        CASE
          WHEN ${guideArticlesTable.content} ILIKE ${pattern}
          THEN substring(${guideArticlesTable.content} FROM greatest(1, position(lower(${q}) IN lower(${guideArticlesTable.content})) - 80) FOR 200)
          ELSE LEFT(${guideArticlesTable.description}, 200)
        END
      `,
    })
    .from(guideArticlesTable)
    .where(
      or(
        ilike(guideArticlesTable.title, pattern),
        ilike(guideArticlesTable.description, pattern),
        ilike(guideArticlesTable.content, pattern),
      )
    )
    .limit(6);

  res.json(articles);
});

// GET /api/guides/:slug — full article
router.get("/guides/:slug", async (req, res) => {
  const { slug } = req.params;
  const [article] = await db
    .select()
    .from(guideArticlesTable)
    .where(eq(guideArticlesTable.slug, slug));

  if (!article || !article.published) {
    res.status(404).json({ error: "Artigo não encontrado" });
    return;
  }
  res.json(article);
});

// POST /api/guides/:slug/feedback — { helpful: boolean }
router.post("/guides/:slug/feedback", async (req, res) => {
  const { slug } = req.params;
  const { helpful } = req.body as { helpful: boolean };

  if (typeof helpful !== "boolean") {
    res.status(400).json({ error: "Campo 'helpful' é obrigatório" });
    return;
  }

  const [updated] = await db
    .update(guideArticlesTable)
    .set(
      helpful
        ? { helpfulYes: sql`${guideArticlesTable.helpfulYes} + 1` }
        : { helpfulNo: sql`${guideArticlesTable.helpfulNo} + 1` }
    )
    .where(eq(guideArticlesTable.slug, slug))
    .returning({ helpfulYes: guideArticlesTable.helpfulYes, helpfulNo: guideArticlesTable.helpfulNo });

  if (!updated) { res.status(404).json({ error: "Artigo não encontrado" }); return; }
  res.json({ ok: true, ...updated });
});

// POST /api/guides/ask — { question: string } — AI assistant with rate limit
router.post("/guides/ask", async (req, res) => {
  const userId = (req as any).userId as number;
  if (!checkAskRateLimit(userId)) {
    res.status(429).json({ error: "Limite de 10 perguntas por hora atingido. Tente novamente mais tarde." });
    return;
  }

  const { question, history } = req.body as { question: string; history?: { role: string; content: string }[] };
  if (!question?.trim()) { res.status(400).json({ error: "Pergunta inválida" }); return; }

  // Find related articles to suggest
  const q = question.split(" ").filter(w => w.length > 3).slice(0, 5).join(" ");
  let relatedArticles: { slug: string; title: string; category: string }[] = [];
  if (q.length > 3) {
    const pattern = `%${q.split(" ")[0]}%`;
    relatedArticles = await db
      .select({ slug: guideArticlesTable.slug, title: guideArticlesTable.title, category: guideArticlesTable.category })
      .from(guideArticlesTable)
      .where(
        or(
          ilike(guideArticlesTable.title, `%${q}%`),
          ilike(guideArticlesTable.content, pattern),
        )
      )
      .limit(2);
  }

  const SYSTEM_PROMPT = `Você é um assistente especializado em licitações públicas brasileiras, focado em ajudar MEI, microempresas e pequenas empresas. Responda de forma clara, em linguagem simples, sem juridiquês. Suas respostas devem ser práticas e diretas. Sempre mencione quando um direito vem da LC 123/2006 ou da Lei 14.133/2021. Máximo de 3 parágrafos por resposta.`;

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...((history ?? []).filter(m => m.role === "user" || m.role === "assistant").slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content }))),
    { role: "user" as const, content: question },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 450,
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content ?? "Desculpe, não consegui responder. Tente novamente.";
    res.json({ reply, relatedArticles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("API key")) {
      res.status(503).json({ error: "IA temporariamente indisponível." });
    } else {
      res.status(500).json({ error: "Erro ao processar. Tente novamente." });
    }
  }
});

export default router;
