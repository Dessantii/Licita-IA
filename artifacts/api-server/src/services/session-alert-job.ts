import { db } from "@workspace/db";
import { sessionAlertsTable, processesTable, usersTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "../lib/logger";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runSessionAlerts() {
  const now = new Date();

  try {
    const alerts = await db
      .select({
        id: sessionAlertsTable.id,
        alertType: sessionAlertsTable.alertType,
        processTitle: processesTable.title,
        userEmail: usersTable.email,
      })
      .from(sessionAlertsTable)
      .leftJoin(processesTable, eq(sessionAlertsTable.processId, processesTable.id))
      .leftJoin(usersTable, eq(sessionAlertsTable.userId, usersTable.id))
      .where(and(eq(sessionAlertsTable.sent, false), lte(sessionAlertsTable.alertTime, now)));

    if (alerts.length === 0) return;

    const templates: Record<string, (t: string) => string> = {
      "1h_before": (t) => `Sua sessão de disputa para "${t}" começa em 1 hora. Acesse a plataforma e fique atento.`,
      "15min_before": (t) => `ATENÇÃO: sessão de "${t}" começa em 15 minutos.`,
      "session_start": (t) => `Sua sessão para "${t}" está iniciando agora. Boa sorte!`,
    };

    for (const row of alerts) {
      const fn = templates[row.alertType];
      const msg = fn ? fn(row.processTitle ?? "processo") : "Lembrete de sessão de disputa.";
      logger.info({ to: row.userEmail, alertType: row.alertType, msg }, "Session alert: dispatched");
      await db.update(sessionAlertsTable).set({ sent: true }).where(eq(sessionAlertsTable.id, row.id));
    }

    logger.info({ sent: alerts.length }, "Session alert job: cycle complete");
  } catch (err) {
    logger.error({ err }, "Session alert job: error");
  }
}

export function startSessionAlertJob() {
  logger.info("Session alert job: scheduled (every 5min)");
  setInterval(runSessionAlerts, INTERVAL_MS);
  runSessionAlerts();
}
