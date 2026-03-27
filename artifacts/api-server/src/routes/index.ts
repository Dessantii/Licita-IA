import { Router, type IRouter } from "express";
import healthRouter from "./health";
import processesRouter from "./licitaia/processes";
import filesRouter from "./licitaia/files";
import aiRouter from "./licitaia/ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/processes", processesRouter);
router.use(filesRouter);
router.use(aiRouter);

export default router;
