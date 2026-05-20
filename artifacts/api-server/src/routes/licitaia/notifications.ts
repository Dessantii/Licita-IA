import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function userId(req: any): number | null {
  return req.user?.id ?? req.user?.sub ?? null;
}

// ── GET /notifications ────────────────────────────────────────────────────────

router.get("/notifications", async (req, res) => {
  const uid = userId(req);
  if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }

  const notifs = await db.select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, uid))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(notifs.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  })));
});

// ── PATCH /notifications/:id/read ─────────────────────────────────────────────

router.patch("/notifications/:id/read", async (req, res) => {
  const uid = userId(req);
  if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, uid)));
  res.json({ ok: true });
});

// ── PATCH /notifications/read-all ─────────────────────────────────────────────

router.patch("/notifications/read-all", async (req, res) => {
  const uid = userId(req);
  if (!uid) { res.status(401).json({ error: "Unauthorized" }); return; }

  await db.update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, uid));
  res.json({ ok: true });
});

export default router;
export { router as notificationsRouter };
