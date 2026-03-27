import cron from "node-cron";
import { db } from "@workspace/db";
import { monitorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkMonitor } from "../routes/licitaia/monitors";
import { logger } from "../lib/logger";

export function startMonitorJob() {
  cron.schedule("0 */2 * * *", async () => {
    logger.info("Monitor job: starting PNCP check cycle");
    try {
      const monitors = await db
        .select()
        .from(monitorsTable)
        .where(eq(monitorsTable.isActive, true));

      let totalNovos = 0;
      for (const monitor of monitors) {
        try {
          const novos = await checkMonitor(monitor, monitor.userId);
          if (novos > 0) {
            logger.info({ monitorId: monitor.id, novos }, "Monitor job: new alerts found");
            totalNovos += novos;
          }
        } catch (err) {
          logger.error({ monitorId: monitor.id, err }, "Monitor job: error checking monitor");
        }
      }
      logger.info({ totalNovos, checked: monitors.length }, "Monitor job: cycle complete");
    } catch (err) {
      logger.error({ err }, "Monitor job: failed to run");
    }
  });

  logger.info("Monitor job: scheduled (every 2 hours)");
}
