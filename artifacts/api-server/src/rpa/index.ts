import type { Browser } from "playwright";
import path from "path";
import fs from "fs";
import { launchBrowser, checkBrowserAvailable } from "./browser";
import { emitirCndFederal } from "./scrapers/cnd-federal";
import { emitirCrfFgts } from "./scrapers/crf-fgts";
import { emitirCndt } from "./scrapers/cndt";
import { emitirCertidaoEstadualSP } from "./scrapers/certidao-estadual-sp";
import { emitirCertidaoEstadualRJ } from "./scrapers/certidao-estadual-rj";
import { emitirCertidaoEstadualMG } from "./scrapers/certidao-estadual-mg";
import { emitirCertidaoEstadualRS } from "./scrapers/certidao-estadual-rs";
import { emitirCertidaoEstadualPR } from "./scrapers/certidao-estadual-pr";
import { emitirCertidaoMunicipalSaoPaulo } from "./scrapers/certidao-municipal-sao-paulo";
import { emitirCertidaoMunicipalRioDeJaneiro } from "./scrapers/certidao-municipal-rio-de-janeiro";
import { emitirCertidaoMunicipalBeloHorizonte } from "./scrapers/certidao-municipal-belo-horizonte";
import { emitirCertidaoMunicipalCuritiba } from "./scrapers/certidao-municipal-curitiba";
import { emitirCertidaoMunicipalPortoAlegre } from "./scrapers/certidao-municipal-porto-alegre";

export { checkBrowserAvailable };

const DOWNLOADS_DIR = path.join(process.cwd(), "uploads", "rpa-downloads");

export interface EmitirResult {
  success: boolean;
  pdfPath?: string;
  captchaDetected?: boolean;
  error?: string;
}

export type StepCallback = (msg: string) => void;

type ScraperFn = (browser: Browser, cnpj: string, dir: string) => Promise<EmitirResult>;

// ── State scraper registry (by UF code, uppercase) ───────────────────────────

const ESTADO_SCRAPERS: Record<string, ScraperFn> = {
  SP: emitirCertidaoEstadualSP,
  RJ: emitirCertidaoEstadualRJ,
  MG: emitirCertidaoEstadualMG,
  RS: emitirCertidaoEstadualRS,
  PR: emitirCertidaoEstadualPR,
};

// ── Municipal scraper registry (by normalized city name + UF) ────────────────

const MUNICIPAL_SCRAPERS: Record<string, ScraperFn> = {
  "SAO PAULO_SP": emitirCertidaoMunicipalSaoPaulo,
  "RIO DE JANEIRO_RJ": emitirCertidaoMunicipalRioDeJaneiro,
  "BELO HORIZONTE_MG": emitirCertidaoMunicipalBeloHorizonte,
  "CURITIBA_PR": emitirCertidaoMunicipalCuritiba,
  "PORTO ALEGRE_RS": emitirCertidaoMunicipalPortoAlegre,
};

/**
 * Returns the UF codes that have state (SEFAZ) automation.
 */
export function getSupportedEstados(): string[] {
  return Object.keys(ESTADO_SCRAPERS);
}

/**
 * Returns the city_UF keys that have municipal (ISS) automation.
 */
export function getSupportedMunicipios(): string[] {
  return Object.keys(MUNICIPAL_SCRAPERS);
}

/**
 * Checks whether the given UF has an automated state scraper.
 */
export function isEstadoSupported(uf: string | null | undefined): boolean {
  if (!uf) return false;
  return uf.toUpperCase() in ESTADO_SCRAPERS;
}

/**
 * Checks whether the given city+UF combination has an automated municipal scraper.
 */
export function isMunicipioSupported(municipio: string | null | undefined, uf: string | null | undefined): boolean {
  if (!municipio || !uf) return false;
  const key = normalizeMunicipioKey(municipio, uf);
  return key in MUNICIPAL_SCRAPERS;
}

function normalizeMunicipioKey(municipio: string, uf: string): string {
  const city = municipio
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return `${city}_${uf.toUpperCase()}`;
}

async function runWithRetry(
  fn: ScraperFn,
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

export interface EmitirOptions {
  uf?: string | null;
  municipio?: string | null;
}

export async function emitirCertidao(
  tipo: string,
  cnpj: string,
  onStep: StepCallback = () => {},
  options: EmitirOptions = {}
): Promise<EmitirResult> {
  switch (tipo) {
    case "cnd_federal":
      return runWithRetry(emitirCndFederal, cnpj, onStep);

    case "crf_fgts":
      return runWithRetry(emitirCrfFgts, cnpj, onStep);

    case "cndt":
      return runWithRetry(emitirCndt, cnpj, onStep);

    case "certidao_estadual": {
      const uf = options.uf?.toUpperCase();
      const scraper = uf ? ESTADO_SCRAPERS[uf] : undefined;
      if (!scraper) {
        const supported = getSupportedEstados().join(", ");
        return {
          success: false,
          error: `Emissão automática não disponível para o estado "${options.uf ?? "não informado"}". Estados suportados: ${supported}.`,
        };
      }
      onStep(`Conectando ao portal SEFAZ-${uf}...`);
      return runWithRetry(scraper, cnpj, onStep);
    }

    case "certidao_municipal": {
      const { municipio, uf } = options;
      const key = municipio && uf ? normalizeMunicipioKey(municipio, uf) : null;
      const scraper = key ? MUNICIPAL_SCRAPERS[key] : undefined;
      if (!scraper) {
        return {
          success: false,
          error: `Emissão automática não disponível para o município "${municipio ?? "não informado"} - ${uf ?? ""}". Emita manualmente e faça o upload do PDF.`,
        };
      }
      onStep(`Conectando ao portal ISS de ${municipio}...`);
      return runWithRetry(scraper, cnpj, onStep);
    }

    default:
      return { success: false, error: `Emissão automática não disponível para o tipo: ${tipo}` };
  }
}
