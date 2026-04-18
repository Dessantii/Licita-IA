import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router: IRouter = Router();

export const JWT_SECRET = process.env.JWT_SECRET ?? "licitaia-dev-secret-change-in-production";
const TOKEN_TTL = "30d";

function signToken(userId: number) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

router.get("/status", async (_req, res) => {
  const [{ value }] = await db.select({ value: count() }).from(usersTable);
  res.json({ hasUsers: Number(value) > 0 });
});

router.post("/setup", async (req, res) => {
  const [{ value }] = await db.select({ value: count() }).from(usersTable);
  if (Number(value) > 0) {
    res.status(403).json({ error: "Sistema já configurado. Use o login." });
    return;
  }

  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos. Nome, e-mail e senha (mín. 6 chars) são obrigatórios." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(usersTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
    role: "admin",
  }).returning();

  const token = signToken(user!.id);
  res.status(201).json({ token, user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role } });
});

router.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user) {
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post("/change-password", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  let userId: number;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: number };
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos. A nova senha deve ter pelo menos 6 caracteres." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Senha atual incorreta." });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.sub));
    if (!user) {
      res.status(401).json({ error: "Usuário não encontrado" });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

router.patch("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  let userId: number;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: number };
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: "Token inválido" });
    return;
  }

  const schema = z.object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Dados inválidos." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ name: parsed.data.name })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Não autenticado. Faça login para continuar." });
    return;
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: number };
    (req as any).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Não autenticado." });
    return;
  }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores." });
    return;
  }
  next();
}

export default router;
