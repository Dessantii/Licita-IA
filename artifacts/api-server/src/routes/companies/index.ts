import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { companiesTable, companyDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import documentsRouter from "./documents";

const COMPANY_DOCS_DIR = path.join(process.cwd(), "uploads", "company-documents");

const router: IRouter = Router();

const createCompanySchema = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  legalRepresentative: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

const updateCompanySchema = z.object({
  legalName: z.string().min(1).optional(),
  tradeName: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  stateRegistration: z.string().nullable().optional(),
  municipalRegistration: z.string().nullable().optional(),
  legalRepresentative: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
});

function computeDocumentStatus(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "sem_validade";
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "vencido";
  if (diffDays <= 30) return "vencendo";
  return "valido";
}

async function computeCompanyDocumentStatus(companyId: number): Promise<string> {
  const docs = await db
    .select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.companyId, companyId));

  if (docs.length === 0) return "sem_docs";

  const statuses = docs.map((d) => computeDocumentStatus(d.expiryDate));

  if (statuses.some((s) => s === "vencido")) return "pendencias";
  if (statuses.some((s) => s === "vencendo")) return "atencao";
  return "pronta";
}

function formatCompany(company: typeof companiesTable.$inferSelect, documentStatus: string) {
  return {
    ...company,
    documentStatus,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const userId = (req as any).userId as number;
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId));

  const result = await Promise.all(
    companies.map(async (c) => {
      const documentStatus = await computeCompanyDocumentStatus(c.id);
      return formatCompany(c, documentStatus);
    })
  );

  res.json(result);
});

router.post("/", async (req, res) => {
  const userId = (req as any).userId as number;

  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [company] = await db
    .insert(companiesTable)
    .values({ ...parsed.data, userId })
    .returning();

  res.status(201).json(formatCompany(company!, "sem_docs"));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!company || company.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const documentStatus = await computeCompanyDocumentStatus(id);
  res.json(formatCompany(company, documentStatus));
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [existing] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const parsed = updateCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [company] = await db
    .update(companiesTable)
    .set(parsed.data)
    .where(eq(companiesTable.id, id))
    .returning();

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const documentStatus = await computeCompanyDocumentStatus(id);
  res.json(formatCompany(company, documentStatus));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const userId = (req as any).userId as number;
  const [existing] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, id));

  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const docs = await db
    .select()
    .from(companyDocumentsTable)
    .where(eq(companyDocumentsTable.companyId, id));

  for (const doc of docs) {
    const filePath = path.join(COMPANY_DOCS_DIR, doc.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  await db.delete(companyDocumentsTable).where(eq(companyDocumentsTable.companyId, id));

  const [deleted] = await db
    .delete(companiesTable)
    .where(eq(companiesTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.status(204).send();
});

router.use("/:id/documents", documentsRouter);

export default router;
