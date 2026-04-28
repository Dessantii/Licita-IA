import cron from "node-cron";
import { db } from "@workspace/db";
import { monitorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkMonitor } from "../routes/licitaia/monitors";
import { runOpportunityCollection } from "./opportunity-collector";
import { logger } from "../lib/logger";

export function startMonitorJob() {
  // PNCP licitações monitor — every 2 hours
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
      logger.info({ totalNovos, checked: monitors.length }, "Monitor job: PNCP cycle complete");
    } catch (err) {
      logger.error({ err }, "Monitor job: PNCP cycle failed");
    }
  });

  // Captação de recursos opportunity collector — every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    logger.info("Opportunity collector: starting collection cycle");
    try {
      const result = await runOpportunityCollection();
      logger.info(result, "Opportunity collector: cycle complete");
    } catch (err) {
      logger.error({ err }, "Opportunity collector: cycle failed");
    }
  });

  // Seed sources and run initial collection on startup (after 10s delay)
  setTimeout(async () => {
    logger.info("Opportunity collector: running initial collection on startup");
    try {
      const result = await runOpportunityCollection();
      logger.info(result, "Opportunity collector: startup collection complete");
    } catch (err) {
      logger.error({ err }, "Opportunity collector: startup collection failed");
    }
  }, 10000);

  logger.info("Monitor job: scheduled (PNCP every 2h, opportunities every 6h)");
}
