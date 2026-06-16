import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const router: IRouter = Router();

const USER_FIELDS = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  role: usersTable.role,
  modules: usersTable.modules,
  createdAt: usersTable.createdAt,
};

function formatUser(u: { id: number; name: string; email: string; role: string; modules: string[] | null; createdAt: Date }) {
  return { ...u, modules: u.modules ?? ["licitacoes", "chamamentos", "captacao"], createdAt: u.createdAt.toISOString() };
}

router.get("/users", async (_req, res) => {
  const users = await db.select(USER_FIELDS).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(formatUser));
});

router.post("/users", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2, "Nome muito curto"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha mínima de 6 caracteres"),
    role: z.enum(["admin", "user"]).default("user"),
    modules: z.array(z.enum(["licitacoes", "chamamentos", "captacao"])).default(["licitacoes", "chamamentos", "captacao"]),
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
    modules: parsed.data.modules,
  }).returning(USER_FIELDS);

  res.status(201).json(formatUser(user!));
});

router.patch("/users/:id/role", async (req, res) => {
  const id = parseInt(req.params.id!);
  const selfId = (req as any).userId as number;
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  if (id === selfId) { res.status(400).json({ error: "Você não pode alterar sua própria função." }); return; }

  const schema = z.object({ role: z.enum(["admin", "user"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Função inválida." }); return; }

  const [user] = await db.update(usersTable).set({ role: parsed.data.role }).where(eq(usersTable.id, id)).returning(USER_FIELDS);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id/modules", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const schema = z.object({
    modules: z.array(z.enum(["licitacoes", "chamamentos", "captacao"])),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Módulos inválidos." }); return; }

  const [user] = await db.update(usersTable).set({ modules: parsed.data.modules }).where(eq(usersTable.id, id)).returning(USER_FIELDS);
  if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id/password", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const schema = z.object({ password: z.string().min(6, "Senha mínima de 6 caracteres") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }); return; }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, id)).returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email });
  if (!user) { res.status(404).json({ error: "Usuário não encontrado." }); return; }
  res.json({ message: "Senha redefinida com sucesso.", user });
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  const selfId = (req as any).userId as number;
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  if (id === selfId) { res.status(400).json({ error: "Você não pode excluir sua própria conta aqui." }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
