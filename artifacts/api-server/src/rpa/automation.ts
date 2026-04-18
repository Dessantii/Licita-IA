import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, "../../storage/screenshots");

const PLAYWRIGHT_BROWSERS_PATH = process.env["PLAYWRIGHT_BROWSERS_PATH"] ?? "/home/runner/playwright-browsers";
process.env["PLAYWRIGHT_BROWSERS_PATH"] = PLAYWRIGHT_BROWSERS_PATH;

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

export interface AutomacaoStatus {
  autenticado: boolean;
  empresaId: number | null;
  iniciadaEm: Date | null;
}

export class ComprasGovAutomation {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private empresaId: number | null = null;
  private iniciadaEm: Date | null = null;
  private playwright: any = null;

  async iniciar(empresaId: number, _certificadoPath?: string, _certificadoSenha?: string): Promise<void> {
    const { chromium } = await import("playwright");
    this.playwright = { chromium };

    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });

    this.context.setDefaultTimeout(60000);
    this.page = await this.context.newPage();
    this.empresaId = empresaId;
    this.iniciadaEm = new Date();

    logger.info({ empresaId }, "RPA: browser iniciado");
  }

  async autenticar(): Promise<boolean> {
    if (!this.page) throw new Error("Browser não iniciado. Chame iniciar() primeiro.");
    try {
      await this.page.goto("https://www.gov.br/compras", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await this.tirarScreenshot(`auth_${Date.now()}`);

      const title = await this.page.title();
      const url = this.page.url();
      logger.info({ title, url }, "RPA: navegou para Compras.gov.br");

      return true;
    } catch (err: any) {
      logger.error({ err: err.message }, "RPA: erro na autenticação");
      await this.tirarScreenshot(`auth_erro_${Date.now()}`).catch(() => null);
      return false;
    }
  }

  async verificarAutenticacao(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const url = this.page.url();
      const isAuthenticated = url.includes("compras.gov.br") && !url.includes("login");
      return isAuthenticated;
    } catch {
      return false;
    }
  }

  async tirarScreenshot(nomeArquivo: string): Promise<string | null> {
    if (!this.page) return null;
    try {
      const fileName = `${nomeArquivo.replace(/[^a-z0-9_-]/gi, "_")}.png`;
      const filePath = path.join(SCREENSHOTS_DIR, fileName);
      await this.page.screenshot({ path: filePath, fullPage: false });
      logger.info({ filePath }, "RPA: screenshot salvo");
      return filePath;
    } catch (err: any) {
      logger.warn({ err: err.message }, "RPA: falha ao tirar screenshot");
      return null;
    }
  }

  async encerrar(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info({ empresaId: this.empresaId }, "RPA: browser encerrado");
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "RPA: erro ao encerrar browser");
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  getStatus(): AutomacaoStatus {
    return {
      autenticado: !!this.browser,
      empresaId: this.empresaId,
      iniciadaEm: this.iniciadaEm,
    };
  }
}

export function classifyError(err: any): {
  type: "certificado_invalido" | "timeout_portal" | "sessao_expirada" | "portal_fora_do_ar" | "proposta_ja_enviada" | "erro_generico";
  retentar: boolean;
  esperaMinutos: number;
} {
  const msg = (err?.message ?? "").toLowerCase();

  if (msg.includes("certificado") || msg.includes("certificate") || msg.includes("pfx")) {
    return { type: "certificado_invalido", retentar: false, esperaMinutos: 0 };
  }
  if (msg.includes("timeout") || msg.includes("time out")) {
    return { type: "timeout_portal", retentar: true, esperaMinutos: 5 };
  }
  if (msg.includes("sessão") || msg.includes("session") || msg.includes("logout") || msg.includes("expirada")) {
    return { type: "sessao_expirada", retentar: true, esperaMinutos: 0 };
  }
  if (msg.includes("502") || msg.includes("503") || msg.includes("fora do ar") || msg.includes("unavailable")) {
    return { type: "portal_fora_do_ar", retentar: true, esperaMinutos: 30 };
  }
  if (msg.includes("já enviada") || msg.includes("already submitted") || msg.includes("proposta ja")) {
    return { type: "proposta_ja_enviada", retentar: false, esperaMinutos: 0 };
  }
  return { type: "erro_generico", retentar: true, esperaMinutos: 5 };
}
