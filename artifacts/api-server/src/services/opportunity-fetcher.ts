import { logger } from "../lib/logger";

export interface RawOpportunityData {
  title: string;
  description?: string;
  link?: string;
  publishDate?: string;
  deadline?: string;
  maxValue?: string;
  targetAudience?: string;
  area?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseRssXml(xml: string): RawOpportunityData[] {
  const items: RawOpportunityData[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const get = (tag: string) => {
      const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(itemXml);
      return m ? (m[1] ?? m[2] ?? "").trim() : "";
    };

    const title = get("title");
    const link = get("link") || get("guid");
    const description = stripHtml(get("description")).slice(0, 500);
    const publishDate = get("pubDate") || get("dc:date");

    if (title) {
      items.push({ title, link: link || undefined, description: description || undefined, publishDate: publishDate || undefined });
    }
  }

  return items;
}

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": "LicitaIA/1.0 (monitoramento-captacao; https://licitaia.com.br)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function fetchRssSource(url: string): Promise<{ items: RawOpportunityData[]; error?: string }> {
  try {
    const res = await fetchWithTimeout(url, 15000);
    if (!res.ok) {
      return { items: [], error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    const items = parseRssXml(text);
    return { items };
  } catch (err: any) {
    logger.warn({ url, err: err?.message }, "RSS fetch error");
    return { items: [], error: err?.message ?? "fetch error" };
  }
}

export async function fetchHtmlSource(url: string): Promise<{ text: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(url, 20000);
    if (!res.ok) {
      return { text: "", error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const text = stripHtml(html).slice(0, 6000);
    return { text };
  } catch (err: any) {
    logger.warn({ url, err: err?.message }, "HTML fetch error");
    return { text: "", error: err?.message ?? "fetch error" };
  }
}
