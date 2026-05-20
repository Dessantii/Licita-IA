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
import certidoesRouter from "./companies/certidoes";
import fundingNoticesRouter from "./funding/notices";
import fundingProjectsRouter from "./funding/projects";
import opportunitiesRouter from "./captacao/opportunities";
import ajudaChatRouter from "./ajuda/chat";
import proposalsRouter from "./licitaia/proposals";
import sessionRouter from "./licitaia/session";
import postSessionRouter from "./licitaia/post-session";
import notificationsRouter from "./licitaia/notifications";

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
router.use("/companies", certidoesRouter);

router.use("/funding-notices", fundingNoticesRouter);
router.use("/projects", fundingProjectsRouter);
router.use("/opportunities", opportunitiesRouter);
router.use(ajudaChatRouter);
router.use(proposalsRouter);
router.use(sessionRouter);
router.use(postSessionRouter);
router.use(notificationsRouter);

export default router;
