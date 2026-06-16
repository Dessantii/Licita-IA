import cron from "node-cron";
import { db } from "@workspace/db";
import {
  certidaoHistoryTable,
  companyDocumentsTable,
  companiesTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, lte, gte, gt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const THRESHOLDS_DAYS = [15, 5] as const;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function certidaoLabel(certidaoType: string): string {
  const labels: Record<string, string> = {
    federal: "Certidão Negativa Federal (RFB/PGFN)",
    trabalhista: "Certidão Negativa Trabalhista (TST)",
    fgts: "Certificado de Regularidade do FGTS (CEF)",
    estadual: "Certidão Negativa Estadual",
    municipal: "Certidão Negativa Municipal",
    certidao_federal: "Certidão Federal",
    certidao_estadual: "Certidão Estadual",
    certidao_municipal: "Certidão Municipal",
    certidao_trabalhista: "Certidão Trabalhista",
    certidao_fgts: "Certidão FGTS",
  };
  return labels[certidaoType] ?? certidaoType;
}

async function alreadyNotifiedToday(
  userId: number,
  dedupeKey: string,
): Promise<boolean> {
  const today = startOfToday();
  const rows = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.type, dedupeKey),
        gte(notificationsTable.createdAt, today),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function createExpiryNotification(
  userId: number,
  dedupeKey: string,
  message: string,
) {
  if (await alreadyNotifiedToday(userId, dedupeKey)) return false;
  await db.insert(notificationsTable).values({
    userId,
    type: dedupeKey,
    message,
    read: false,
  });
  return true;
}

async function checkCertidaoHistory(now: Date): Promise<number> {
  let created = 0;
  for (const days of THRESHOLDS_DAYS) {
    const cutoff = addDays(now, days);

    const rows = await db
      .select({
        userId: companiesTable.userId,
        companyId: certidaoHistoryTable.companyId,
        certidaoType: certidaoHistoryTable.certidaoType,
        expiresAt: certidaoHistoryTable.expiresAt,
        razaoSocial: companiesTable.razaoSocial,
      })
      .from(certidaoHistoryTable)
      .innerJoin(
        companiesTable,
        eq(certidaoHistoryTable.companyId, companiesTable.id),
      )
      .where(
        and(
          gt(certidaoHistoryTable.expiresAt, now),
          lte(certidaoHistoryTable.expiresAt, cutoff),
        ),
      );

    for (const row of rows) {
      if (!row.userId) continue;
      const label = certidaoLabel(row.certidaoType);
      const dedupeKey = `certidao_expiry_${days}d:history:${row.certidaoType}:${row.companyId}`;
      const daysLeft = Math.ceil(
        (new Date(row.expiresAt!).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const message =
        days === 5
          ? `⚠️ URGENTE: ${label} da empresa "${row.razaoSocial}" vence em ${daysLeft} dia(s). Renove imediatamente para não perder habilitações em licitações.`
          : `🔔 ${label} da empresa "${row.razaoSocial}" vence em ${daysLeft} dia(s). Providencie a renovação com antecedência.`;
      const inserted = await createExpiryNotification(row.userId, dedupeKey, message);
      if (inserted) created++;
    }
  }
  return created;
}

async function checkCompanyDocuments(now: Date): Promise<number> {
  let created = 0;
  const certTipos = [
    "certidao_federal",
    "certidao_estadual",
    "certidao_municipal",
    "certidao_trabalhista",
    "certidao_fgts",
  ];

  for (const days of THRESHOLDS_DAYS) {
    const cutoff = addDays(now, days);
    const nowIso = now.toISOString().slice(0, 10);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const rows = await db
      .select({
        userId: companiesTable.userId,
        companyId: companyDocumentsTable.companyId,
        tipo: companyDocumentsTable.tipo,
        titulo: companyDocumentsTable.titulo,
        dataValidade: companyDocumentsTable.dataValidade,
        razaoSocial: companiesTable.razaoSocial,
        docId: companyDocumentsTable.id,
      })
      .from(companyDocumentsTable)
      .innerJoin(
        companiesTable,
        eq(companyDocumentsTable.companyId, companiesTable.id),
      )
      .where(
        and(
          sql`${companyDocumentsTable.tipo} = ANY(${certTipos})`,
          gt(companyDocumentsTable.dataValidade, nowIso),
          lte(companyDocumentsTable.dataValidade, cutoffIso),
        ),
      );

    for (const row of rows) {
      if (!row.userId || !row.dataValidade) continue;
      const expiryDate = new Date(row.dataValidade);
      const daysLeft = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const label = row.titulo || certidaoLabel(row.tipo ?? "");
      const dedupeKey = `certidao_expiry_${days}d:doc:${row.tipo}:${row.docId}`;
      const message =
        days === 5
          ? `⚠️ URGENTE: "${label}" da empresa "${row.razaoSocial}" vence em ${daysLeft} dia(s). Renove imediatamente para não perder habilitações em licitações.`
          : `🔔 "${label}" da empresa "${row.razaoSocial}" vence em ${daysLeft} dia(s). Providencie a renovação com antecedência.`;
      const inserted = await createExpiryNotification(row.userId, dedupeKey, message);
      if (inserted) created++;
    }
  }
  return created;
}

async function runCertidaoExpiryAlerts() {
  const now = new Date();
  logger.info("Certidão expiry job: starting daily check");

  try {
    const fromHistory = await checkCertidaoHistory(now);
    const fromDocs = await checkCompanyDocuments(now);
    const total = fromHistory + fromDocs;
    logger.info(
      { fromHistory, fromDocs, total },
      "Certidão expiry job: cycle complete",
    );
  } catch (err) {
    logger.error({ err }, "Certidão expiry job: error");
  }
}

export function startCertidaoExpiryJob() {
  // Run daily at 08:00
  cron.schedule("0 8 * * *", runCertidaoExpiryAlerts);
  logger.info("Certidão expiry job: scheduled (daily at 08:00)");
}
