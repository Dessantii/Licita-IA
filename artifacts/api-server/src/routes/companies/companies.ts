import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  companyDocumentsTable,
  processesTable,
  callNoticesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const createCompanySchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().nullish(),
  cnpj: z.string().min(1),
  email: z.string().nullish(),
  telefone: z.string().nullish(),
  endereco: z.string().nullish(),
  inscricaoEstadual: z.string().nullish(),
  inscricaoMunicipal: z.string().nullish(),
  representanteLegal: z.string().nullish(),
  observacoes: z.string().nullish(),
});

const updateCompanySchema = createCompanySchema.partial();

function formatCompany(c: typeof companiesTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function formatDocument(d: typeof companyDocumentsTable.$inferSelect) {
  return {
    ...d,
    uploadedAt: d.uploadedAt.toISOString(),
  };
}

function getDocumentStatus(docs: typeof companyDocumentsTable.$inferSelect[]) {
  if (docs.length === 0) return "sem_documentos";
  const now = new Date();
  const today = now.toISOString().split("T")[0]!;
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  let hasExpired = false;
  let hasExpiringSoon = false;

  for (const doc of docs) {
    if (!doc.dataValidade) continue;
    if (doc.dataValidade < today) {
      hasExpired = true;
      break;
    }
    if (doc.dataValidade <= in30Days) {
      hasExpiringSoon = true;
    }
  }

  if (hasExpired) return "vencido";
  if (hasExpiringSoon) return "vencendo";
  return "regular";
}

router.get("/", async (_req, res) => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.razaoSocial);
  const documents = await db.select().from(companyDocumentsTable);

  const result = companies.map(c => {
    const companyDocs = documents.filter(d => d.companyId === c.id);
    return {
      ...formatCompany(c),
      documentStatus: getDocumentStatus(companyDocs),
      documentCount: companyDocs.length,
    };
  });

  res.json(result);
});

router.post("/", async (req, res) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [company] = await db.insert(companiesTable).values(parsed.data).returning();
  res.status(201).json(formatCompany(company!));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const documents = await db.select().from(companyDocumentsTable).where(eq(companyDocumentsTable.companyId, id));
  const processes = await db.select().from(processesTable).where(eq(processesTable.companyId, id));
  const callNotices = await db.select().from(callNoticesTable).where(eq(callNoticesTable.companyId, id));

  res.json({
    ...formatCompany(company),
    documents: documents.map(formatDocument),
    documentStatus: getDocumentStatus(documents),
    processes: processes.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    callNotices: callNotices.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
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

  res.json(formatCompany(company));
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  await db.delete(companiesTable).where(eq(companiesTable.id, id));
  res.status(204).send();
});

export default router;
