import { Router, type IRouter } from "express";
import healthRouter from "./health";
import processesRouter from "./licitaia/processes";
import filesRouter from "./licitaia/files";
import aiRouter from "./licitaia/ai";
import authRouter, { requireAuth, requireAdmin } from "./auth";
import monitorsRouter from "./licitaia/monitors";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

router.use(requireAuth);

router.use("/processes", processesRouter);
router.use(filesRouter);
router.use(aiRouter);
router.use("/monitors", monitorsRouter);
router.use("/admin", requireAdmin, adminRouter);

export default router;
