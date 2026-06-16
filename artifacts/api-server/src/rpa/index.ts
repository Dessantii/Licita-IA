import type { Browser } from "playwright";
import path from "path";
import fs from "fs";
import { launchBrowser, checkBrowserAvailable } from "./browser";
import { emitirCndFederal } from "./scrapers/cnd-federal";
import { emitirCrfFgts } from "./scrapers/crf-fgts";
import { emitirCndt } from "./scrapers/cndt";

export { checkBrowserAvailable };

const DOWNLOADS_DIR = path.join(process.cwd(), "uploads", "rpa-downloads");

export interface EmitirResult {
  success: boolean;
  pdfPath?: string;
  captchaDetected?: boolean;
  error?: string;
}

export type StepCallback = (msg: string) => void;

async function runWithRetry(
  fn: (browser: Browser, cnpj: string, dir: string) => Promise<EmitirResult>,
  cnpj: string,
  onStep: StepCallback,
  maxAttempts = 2
): Promise<EmitirResult> {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  let lastResult: EmitirResult = { success: false, error: "Nenhuma tentativa realizada" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let browser: Browser | null = null;
    try {
      onStep("Abrindo portal...");
      browser = await launchBrowser();
      onStep("Preenchendo CNPJ...");
      lastResult = await Promise.race([
        fn(browser, cnpj, DOWNLOADS_DIR),
        new Promise<EmitirResult>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout de 30s atingido")), 30_000)
        ),
      ]);
      if (lastResult.success) {
        onStep("Baixando PDF...");
      }
      if (lastResult.success || lastResult.captchaDetected) break;
      if (attempt < maxAttempts) {
        console.warn(`[rpa] Tentativa ${attempt} falhou, tentando novamente...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      lastResult = { success: false, error: (err as Error).message?.slice(0, 500) };
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } finally {
      if (browser) {
        try { await browser.close(); } catch { }
      }
    }
  }

  return lastResult;
}

export async function emitirCertidao(
  tipo: string,
  cnpj: string,
  onStep: StepCallback = () => {}
): Promise<EmitirResult> {
  switch (tipo) {
    case "cnd_federal":
      return runWithRetry(emitirCndFederal, cnpj, onStep);
    case "crf_fgts":
      return runWithRetry(emitirCrfFgts, cnpj, onStep);
    case "cndt":
      return runWithRetry(emitirCndt, cnpj, onStep);
    default:
      return { success: false, error: `Emissão automática não disponível para o tipo: ${tipo}` };
  }
}
