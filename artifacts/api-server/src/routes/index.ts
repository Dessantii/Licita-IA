import { Router, type IRouter } from "express";
import healthRouter from "./health";
import processesRouter from "./licitaia/processes";
import filesRouter from "./licitaia/files";
import aiRouter from "./licitaia/ai";
import authRouter, { requireAuth } from "./auth";
import monitorsRouter from "./licitaia/monitors";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

router.use(requireAuth);

router.use("/processes", processesRouter);
router.use(filesRouter);
router.use(aiRouter);
router.use("/monitors", monitorsRouter);

export default router;
