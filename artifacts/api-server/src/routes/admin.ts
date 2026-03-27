import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.post("/users", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2, "Nome muito curto"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha mínima de 6 caracteres"),
    role: z.enum(["admin", "user"]).default("user"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing.length > 0) {
    res.status(409).json({ error: "E-mail já cadastrado." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(usersTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
  }).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt });

  res.status(201).json({ ...user!, createdAt: user!.createdAt.toISOString() });
});

router.patch("/users/:id/role", async (req, res) => {
  const id = parseInt(req.params.id!);
  const selfId = (req as any).userId as number;
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  if (id === selfId) {
    res.status(400).json({ error: "Você não pode alterar sua própria função." });
    return;
  }
  const schema = z.object({ role: z.enum(["admin", "user"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Função inválida." });
    return;
  }
  const [user] = await db.update(usersTable).set({ role: parsed.data.role }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt });
  if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
  res.json({ ...user, createdAt: user.createdAt.toISOString() });
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  const selfId = (req as any).userId as number;
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }
  if (id === selfId) {
    res.status(400).json({ error: "Você não pode excluir sua própria conta aqui." });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
