import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  processesTable,
  sessionAlertsTable,
  sessionBidsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

function userId(req: any): number | null {
  return req.user?.id ?? req.user?.sub ?? null;
}

// ── PATCH /processes/:id/session-date ─────────────────────────────────────────

router.patch("/processes/:id/session-date", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { sessionDate } = req.body as { sessionDate: string };
  if (!sessionDate) { res.status(400).json({ error: "sessionDate is required" }); return; }

  const date = new Date(sessionDate);
  if (isNaN(date.getTime())) { res.status(400).json({ error: "Invalid date" }); return; }

  await db.update(processesTable).set({ sessionDate: date }).where(eq(processesTable.id, id));

  const uid = userId(req);
  if (uid) {
    await db.delete(sessionAlertsTable).where(
      and(eq(sessionAlertsTable.processId, id), eq(sessionAlertsTable.userId, uid))
    );
    await db.insert(sessionAlertsTable).values([
      { processId: id, userId: uid, alertTime: new Date(date.getTime() - 60 * 60 * 1000), alertType: "1h_before" },
      { processId: id, userId: uid, alertTime: new Date(date.getTime() - 15 * 60 * 1000), alertType: "15min_before" },
      { processId: id, userId: uid, alertTime: date, alertType: "session_start" },
    ]);
  }

  res.json({ ok: true, sessionDate: date.toISOString() });
});

// ── PATCH /processes/:id/session-alerts ──────────────────────────────────────

router.patch("/processes/:id/session-alerts", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { enabled } = req.body as { enabled: boolean };
  await db.update(processesTable).set({ sessionAlertsEnabled: enabled }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── PATCH /processes/:id/session-checklist ───────────────────────────────────

router.patch("/processes/:id/session-checklist", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { checklist } = req.body;
  await db.update(processesTable).set({ sessionChecklist: checklist }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── POST /processes/:id/session-bids ─────────────────────────────────────────

const bidSchema = z.object({
  bidValue: z.union([z.string(), z.number()]),
  bidType: z.enum(["own", "competitor"]),
  notes: z.string().optional(),
  bidTime: z.string().optional(),
});

router.post("/processes/:id/session-bids", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { bidValue, bidType, notes, bidTime } = parsed.data;
  const [bid] = await db.insert(sessionBidsTable).values({
    processId: id,
    bidValue: String(bidValue),
    bidType,
    notes: notes ?? null,
    bidTime: bidTime ? new Date(bidTime) : new Date(),
  }).returning();

  res.status(201).json({ ...bid, bidTime: bid!.bidTime?.toISOString(), createdAt: bid!.createdAt.toISOString() });
});

// ── GET /processes/:id/session-bids ──────────────────────────────────────────

router.get("/processes/:id/session-bids", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const bids = await db.select().from(sessionBidsTable)
    .where(eq(sessionBidsTable.processId, id))
    .orderBy(sessionBidsTable.bidTime);

  res.json(bids.map(b => ({
    ...b,
    bidTime: b.bidTime?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  })));
});

// ── PATCH /processes/:id/session-result ──────────────────────────────────────

router.patch("/processes/:id/session-result", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.update(processesTable).set({ sessionResult: req.body }).where(eq(processesTable.id, id));
  res.json({ ok: true });
});

// ── POST /processes/:id/session-result-suggestion ────────────────────────────

router.post("/processes/:id/session-result-suggestion", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [process] = await db.select().from(processesTable).where(eq(processesTable.id, id));
  if (!process) { res.status(404).json({ error: "Not found" }); return; }

  const { valorVencedor, valorProposta } = req.body as { valorVencedor?: string; valorProposta?: string };

  const prompt = `Você é um consultor especialista em licitações públicas. Uma empresa MEI/microempresa não venceu uma licitação.
Objeto: ${process.title}
Órgão: ${process.agency}
Valor da proposta enviada: ${valorProposta ? `R$ ${valorProposta}` : "não informado"}
Valor do vencedor: ${valorVencedor ? `R$ ${valorVencedor}` : "não informado"}

Gere 3 sugestões curtas e práticas para melhorar o desempenho em licitações similares. Seja objetivo, prático e encorajador.

Retorne APENAS um JSON: { "sugestoes": ["sugestão 1", "sugestão 2", "sugestão 3"] }`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    logger.error({ err }, "Failed to generate session suggestion");
    res.status(500).json({ error: "Falha ao gerar sugestões" });
  }
});

// ── GET /cron/session-alerts ─────────────────────────────────────────────────

router.get("/cron/session-alerts", async (_req, res) => {
  const now = new Date();

  const alerts = await db.select({
    id: sessionAlertsTable.id,
    alertType: sessionAlertsTable.alertType,
    processTitle: processesTable.title,
    userEmail: usersTable.email,
  })
    .from(sessionAlertsTable)
    .leftJoin(processesTable, eq(sessionAlertsTable.processId, processesTable.id))
    .leftJoin(usersTable, eq(sessionAlertsTable.userId, usersTable.id))
    .where(and(eq(sessionAlertsTable.sent, false), lte(sessionAlertsTable.alertTime, now)));

  const templates: Record<string, string> = {
    "1h_before": (title: string) => `Sua sessão de disputa para "${title}" começa em 1 hora. Acesse a plataforma e fique atento.`,
    "15min_before": (title: string) => `ATENÇÃO: sessão de "${title}" começa em 15 minutos.`,
    "session_start": (title: string) => `Sua sessão para "${title}" está iniciando agora. Boa sorte!`,
  } as any;

  let sent = 0;
  for (const row of alerts) {
    const msg = typeof templates[row.alertType] === "function"
      ? templates[row.alertType](row.processTitle ?? "processo")
      : "Lembrete de sessão de disputa.";

    logger.info({ to: row.userEmail, alertType: row.alertType, msg }, "Session alert dispatched");

    await db.update(sessionAlertsTable).set({ sent: true }).where(eq(sessionAlertsTable.id, row.id));
    sent++;
  }

  res.json({ processed: alerts.length, sent });
});

export default router;
export { router as sessionRouter };
