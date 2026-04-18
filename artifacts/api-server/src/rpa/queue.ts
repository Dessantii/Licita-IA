import { db } from "@workspace/db";
import {
  rpaJobsTable, rpaLogsTable,
  type RpaJob,
  RPA_ERROR_TYPES,
} from "@workspace/db";
import { eq, and, or, lte, isNull, asc } from "drizzle-orm";
import { classifyError, ComprasGovAutomation } from "./automation.js";
import { logger } from "../lib/logger.js";

export type JobType = "submeter_proposta" | "verificar_status" | "enviar_habilitacao";
export type JobStatus = "pendente" | "em_execucao" | "concluido" | "erro" | "cancelado";

const POLL_INTERVAL_MS = 5_000;
const JOB_TIMEOUT_MS = (Number(process.env["RPA_JOB_TIMEOUT_MINUTES"] ?? 30)) * 60_000;

let isWorkerRunning = false;
let workerTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

export async function logRpa(params: {
  jobId?: number;
  processoId?: number;
  empresaId?: number;
  acao: string;
  status: "sucesso" | "erro" | "aviso";
  detalhe?: string;
  screenshotPath?: string;
}): Promise<void> {
  try {
    await db.insert(rpaLogsTable).values({
      jobId: params.jobId ?? null,
      processoId: params.processoId ?? null,
      empresaId: params.empresaId ?? null,
      acao: params.acao,
      status: params.status,
      detalhe: params.detalhe ?? null,
      screenshotPath: params.screenshotPath ?? null,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "RPA queue: falha ao salvar log");
  }
}

async function processSingleJob(job: RpaJob): Promise<void> {
  logger.info({ jobId: job.id, tipo: job.tipo, empresaId: job.empresaId }, "RPA: processando job");

  await db
    .update(rpaJobsTable)
    .set({ status: "em_execucao", iniciadoEm: new Date() })
    .where(eq(rpaJobsTable.id, job.id));

  await logRpa({
    jobId: job.id,
    processoId: job.processoId ?? undefined,
    empresaId: job.empresaId ?? undefined,
    acao: `${job.tipo}_iniciado`,
    status: "sucesso",
    detalhe: `Job ${job.id} iniciado — tipo: ${job.tipo}`,
  });

  const automation = new ComprasGovAutomation();
  let screenshotPath: string | null = null;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout_portal: job excedeu tempo máximo")), JOB_TIMEOUT_MS)
  );

  try {
    await Promise.race([
      (async () => {
        await automation.iniciar(job.empresaId ?? 0);
        const autenticado = await automation.autenticar();

        if (!autenticado) throw new Error("sessão não estabelecida após autenticação");

        screenshotPath = await automation.tirarScreenshot(`job_${job.id}_autenticado`);

        await logRpa({
          jobId: job.id,
          processoId: job.processoId ?? undefined,
          empresaId: job.empresaId ?? undefined,
          acao: "autenticacao",
          status: "sucesso",
          detalhe: "Autenticação no portal realizada com sucesso",
          screenshotPath: screenshotPath ?? undefined,
        });
      })(),
      timeout,
    ]);

    await db
      .update(rpaJobsTable)
      .set({ status: "concluido", finalizadoEm: new Date() })
      .where(eq(rpaJobsTable.id, job.id));

    await logRpa({
      jobId: job.id,
      processoId: job.processoId ?? undefined,
      empresaId: job.empresaId ?? undefined,
      acao: `${job.tipo}_concluido`,
      status: "sucesso",
      detalhe: `Job concluído com sucesso`,
    });

    logger.info({ jobId: job.id }, "RPA: job concluído");
  } catch (err: any) {
    const classified = classifyError(err);

    screenshotPath = await automation.tirarScreenshot(`job_${job.id}_erro`).catch(() => null);

    await logRpa({
      jobId: job.id,
      processoId: job.processoId ?? undefined,
      empresaId: job.empresaId ?? undefined,
      acao: `${job.tipo}_erro`,
      status: "erro",
      detalhe: err?.message ?? "Erro desconhecido",
      screenshotPath: screenshotPath ?? undefined,
    });

    const novasTentativas = (job.tentativasRealizadas ?? 0) + 1;
    const maxTentativas = job.maxTentativas ?? 3;
    const esgotou = novasTentativas >= maxTentativas || !classified.retentar;
    const proximaTentativa = classified.retentar && !esgotou
      ? new Date(Date.now() + classified.esperaMinutos * 60_000)
      : null;

    await db
      .update(rpaJobsTable)
      .set({
        status: esgotou ? "erro" : "pendente",
        tentativasRealizadas: novasTentativas,
        errorType: classified.type as typeof RPA_ERROR_TYPES[number],
        errorMessage: err?.message ?? null,
        finalizadoEm: esgotou ? new Date() : null,
        proximaTentativaEm: proximaTentativa,
      })
      .where(eq(rpaJobsTable.id, job.id));

    logger.error({ jobId: job.id, errorType: classified.type, retentar: classified.retentar }, "RPA: job falhou");
  } finally {
    await automation.encerrar();
  }
}

async function pollAndProcess(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const [job] = await db
      .select()
      .from(rpaJobsTable)
      .where(
        and(
          eq(rpaJobsTable.status, "pendente"),
          or(
            isNull(rpaJobsTable.proximaTentativaEm),
            lte(rpaJobsTable.proximaTentativaEm, now)
          )
        )
      )
      .orderBy(asc(rpaJobsTable.prioridade), asc(rpaJobsTable.criadoEm))
      .limit(1);

    if (job) {
      await processSingleJob(job);
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "RPA queue: erro no poll");
  } finally {
    isProcessing = false;
  }
}

export function startRpaWorker(): void {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  workerTimer = setInterval(pollAndProcess, POLL_INTERVAL_MS);
  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "RPA: worker iniciado (polling mode)");
}

export function stopRpaWorker(): void {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
  isWorkerRunning = false;
  logger.info("RPA: worker parado");
}

export async function enqueueJob(params: {
  processoId?: number;
  empresaId?: number;
  tipo: JobType;
  prioridade?: number;
  payload?: Record<string, unknown>;
}): Promise<RpaJob> {
  const [job] = await db
    .insert(rpaJobsTable)
    .values({
      processoId: params.processoId ?? null,
      empresaId: params.empresaId ?? null,
      tipo: params.tipo,
      prioridade: params.prioridade ?? 3,
      status: "pendente",
      tentativasRealizadas: 0,
      maxTentativas: 3,
      payload: params.payload ?? null,
    })
    .returning();

  logger.info({ jobId: job!.id, tipo: params.tipo }, "RPA: job enfileirado");
  return job!;
}
