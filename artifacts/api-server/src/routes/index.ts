import { Router, type IRouter } from "express";
import healthRouter from "./health";
import processesRouter from "./licitaia/processes";
import filesRouter from "./licitaia/files";
import aiRouter from "./licitaia/ai";
import authRouter, { requireAuth, requireAdmin } from "./auth";
import monitorsRouter from "./licitaia/monitors";
import adminRouter from "./admin";
import chamamentosRouter from "./chamamentos/notices";
import chamamentosFilesRouter from "./chamamentos/files";
import chamamentosAiRouter from "./chamamentos/ai";
import companiesRouter from "./companies/companies";
import companyDocumentsRouter from "./companies/documents";
import fundingNoticesRouter from "./funding/notices";
import fundingProjectsRouter from "./funding/projects";
import opportunitiesRouter from "./captacao/opportunities";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

router.use(requireAuth);

router.use("/processes", processesRouter);
router.use(filesRouter);
router.use(aiRouter);
router.use("/monitors", monitorsRouter);
router.use("/admin", requireAdmin, adminRouter);

router.use("/chamamentos", chamamentosRouter);
router.use("/chamamentos", chamamentosFilesRouter);
router.use("/chamamentos/ai", chamamentosAiRouter);

router.use("/companies", companiesRouter);
router.use("/companies", companyDocumentsRouter);

router.use("/funding-notices", fundingNoticesRouter);
router.use("/projects", fundingProjectsRouter);
router.use("/opportunities", opportunitiesRouter);

export default router;
