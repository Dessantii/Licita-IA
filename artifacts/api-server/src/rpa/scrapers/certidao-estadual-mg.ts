import type { Browser } from "playwright";
import path from "path";
import fs from "fs";
import { newPage, hasCaptcha } from "../browser";

const PORTAL_URL = "https://sistemas.fazenda.mg.gov.br/certidaodebito/";
const TIMEOUT_MS = 30_000;

export interface ScraperResult {
  success: boolean;
  pdfPath?: string;
  captchaDetected?: boolean;
  error?: string;
}

export async function emitirCertidaoEstadualMG(
  browser: Browser,
  cnpj: string,
  downloadDir: string
): Promise<ScraperResult> {
  const { context, page } = await newPage(browser, downloadDir);

  try {
    await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

    const html = await page.content();
    if (hasCaptcha(html)) {
      return { success: false, captchaDetected: true, error: "CAPTCHA detectado no portal SEFAZ MG" };
    }

    const cnpjClean = cnpj.replace(/\D/g, "");

    const cnpjInput = page.locator(
      'input[id*="cnpj" i], input[name*="cnpj" i], input[placeholder*="CNPJ" i], input[id*="documento" i]'
    ).first();
    await cnpjInput.waitFor({ timeout: TIMEOUT_MS });
    await cnpjInput.fill(cnpjClean);

    const submitBtn = page.locator(
      'button[type="submit"], input[type="submit"], button:has-text("Consultar"), button:has-text("Emitir"), button:has-text("Pesquisar")'
    ).first();
    await submitBtn.click();

    await page.waitForTimeout(4000);

    const htmlAfter = await page.content();
    if (hasCaptcha(htmlAfter)) {
      return { success: false, captchaDetected: true, error: "CAPTCHA detectado após envio no portal SEFAZ MG" };
    }

    const downloadPromise = context.waitForEvent("download", { timeout: TIMEOUT_MS });
    const pdfLink = page.locator(
      'a[href*=".pdf" i], a:has-text("PDF"), a:has-text("Baixar"), a:has-text("Certidão"), button:has-text("PDF")'
    ).first();

    if (await pdfLink.count() > 0) {
      await pdfLink.click();
    } else {
      const printBtn = page.locator('button:has-text("Imprimir"), a:has-text("Imprimir")').first();
      if (await printBtn.count() > 0) {
        await printBtn.click();
      } else {
        return { success: false, error: "Link de download não encontrado no portal SEFAZ MG" };
      }
    }

    const download = await downloadPromise;
    const savePath = path.join(downloadDir, `certidao_estadual_mg_${Date.now()}.pdf`);
    await download.saveAs(savePath);

    if (!fs.existsSync(savePath)) {
      return { success: false, error: "Arquivo PDF não encontrado após download (SEFAZ MG)" };
    }

    return { success: true, pdfPath: savePath };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    if (hasCaptcha(msg)) {
      return { success: false, captchaDetected: true, error: msg };
    }
    return { success: false, error: msg.slice(0, 500) };
  } finally {
    await context.close();
  }
}
