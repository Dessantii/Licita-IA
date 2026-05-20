import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import path from "path";
import fs from "fs";

const BROWSERS_CACHE = path.join(process.cwd(), "../../../.cache/ms-playwright");

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: resolveChromiumPath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--mute-audio",
      "--no-zygote",
    ],
  });
}

function resolveChromiumPath(): string | undefined {
  const customPath = process.env["PLAYWRIGHT_BROWSERS_PATH"] ?? BROWSERS_CACHE;
  const candidates = [
    path.join(customPath, "chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell"),
    path.join(customPath, "chromium-1169/chrome-linux/chrome"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

export async function checkBrowserAvailable(): Promise<boolean> {
  try {
    process.env["PLAYWRIGHT_BROWSERS_PATH"] = BROWSERS_CACHE;
    const browser = await launchBrowser();
    await browser.close();
    return true;
  } catch (err) {
    console.warn("[rpa] Browser not available:", (err as Error).message?.slice(0, 200));
    return false;
  }
}

export async function newPage(browser: Browser, downloadDir: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  return { context, page };
}

export function hasCaptcha(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("captcha") ||
    lower.includes("recaptcha") ||
    lower.includes("hcaptcha") ||
    lower.includes("challenge") ||
    lower.includes("cf-challenge") ||
    lower.includes("robot") ||
    lower.includes("humano")
  );
}
