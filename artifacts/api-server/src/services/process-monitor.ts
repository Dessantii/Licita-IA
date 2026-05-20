import { db } from "@workspace/db";
import { processesTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, lt } from "drizzle-orm";
import { logger } from "../lib/logger";

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchPncpStatus(pncpId: string): Promise<string | null> {
  // pncpId format: {cnpj}/{ano}/{sequencial}
  const parts = pncpId.split("/");
  if (parts.length !== 3) return null;
  const [cnpj, ano, sequencial] = parts;
  const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const data = await res.json() as Record<string, any>;
  return data?.situacaoCompraId ?? data?.situacao ?? null;
}

async function runProcessMonitor() {
  try {
    const now = new Date();

    // Find processes with pncp_id set, session in past, not yet homologated
    const processes = await db.select({
      id: processesTable.id,
      title: processesTable.title,
      pncpId: processesTable.pncpId,
      currentPhase: processesTable.currentPhase,
      companyId: processesTable.companyId,
      sessionDate: processesTable.sessionDate,
    })
      .from(processesTable)
      .where(and(
        isNotNull(processesTable.pncpId),
        isNull(processesTable.homologatedAt),
        isNotNull(processesTable.sessionDate),
        lt(processesTable.sessionDate, now),
      ));

    if (processes.length === 0) return;
    logger.info({ count: processes.length }, "Process monitor: checking PNCP statuses");

    for (const process of processes) {
      if (!process.pncpId) continue;
      try {
        const pncpStatus = await fetchPncpStatus(process.pncpId);
        if (!pncpStatus) continue;

        const savedPhase = process.currentPhase;
        if (savedPhase === pncpStatus) continue;

        // Status changed — update and notify
        await db.update(processesTable)
          .set({ currentPhase: pncpStatus })
          .where(eq(processesTable.id, process.id));

        // Find company owner to notify (users linked to company)
        if (process.companyId) {
          const users = await db.select({ id: usersTable.id })
            .from(usersTable)
            .limit(1); // TODO: filter by company when user-company link exists

          for (const user of users) {
            await db.insert(notificationsTable).values({
              userId: user.id,
              processId: process.id,
              type: "pncp_status_change",
              message: `Status do processo "${process.title}" atualizado no PNCP: ${pncpStatus}`,
            });
          }
        }

        logger.info({ processId: process.id, from: savedPhase, to: pncpStatus }, "Process monitor: status change detected");
      } catch (err) {
        logger.warn({ err, processId: process.id }, "Process monitor: failed to check PNCP for process");
      }
    }
  } catch (err) {
    logger.error({ err }, "Process monitor: job error");
  }
}

export function startProcessMonitor() {
  logger.info("Process monitor: scheduled (every 6h)");
  setInterval(runProcessMonitor, INTERVAL_MS);
  // Don't run immediately on startup to avoid startup delays
  setTimeout(runProcessMonitor, 30_000);
}
