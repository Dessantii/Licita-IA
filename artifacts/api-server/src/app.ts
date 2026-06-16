import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { startMonitorJob } from "./services/monitor-job";
import { startSessionAlertJob } from "./services/session-alert-job";
import { startProcessMonitor } from "./services/process-monitor";
import { startCertidaoExpiryJob } from "./services/certidao-expiry-job";
import { cleanupOrphanedJobs } from "./routes/companies/certidoes";
import { checkBrowserAvailable } from "./rpa/index";

process.env["PLAYWRIGHT_BROWSERS_PATH"] = path.join(process.cwd(), "../../../.cache/ms-playwright");

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

startMonitorJob();
startSessionAlertJob();
startProcessMonitor();
startCertidaoExpiryJob();
cleanupOrphanedJobs();

checkBrowserAvailable().then(available => {
  (global as any).PUPPETEER_AVAILABLE = available;
  logger.info({ available }, "[rpa] Browser availability check complete");
}).catch(err => {
  (global as any).PUPPETEER_AVAILABLE = false;
  logger.warn({ err }, "[rpa] Browser check failed");
});

export default app;
