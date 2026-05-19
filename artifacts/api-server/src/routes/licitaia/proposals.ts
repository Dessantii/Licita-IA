import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  processesTable,
  companiesTable,
  processProposalsTable,
  marketPriceResearchTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
} from "docx";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const signedUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) =>
      cb(null, `signed-proposal-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// ── Tax calculation ──────────────────────────────────────────────────────────

function calculateTaxRate(porte: string | null | undefined): number {
  if (!porte) return 0.06;
  const p = porte.toLowerCase();
  if (p.includes("mei")) return 0.05;
  if (p.includes("simples") || p.includes("me") || p.includes("epp")) return 0.06;
  if (p.includes("presumido")) return 0.1175;
  if (p.includes("real")) return 0.135;
  return 0.06;
}

// ── PNCP price search ────────────────────────────────────────────────────────

async function searchPNCPContracts(keywords: string[], _uf?: string | null) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const baseUrl = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
  // codigoModalidadeContratacao: 6=Pregão Eletrônico, 8=Dispensa, 5=Concorrência, 4=RDC
  const modalities = ["6", "8", "5"];
  const kw = keywords.map(k => k.toLowerCase());
  let allItems: unknown[] = [];

  for (const mod of modalities) {
    if (allItems.length >= 20) break;
    const params = new URLSearchParams({
      dataInicial: fmtDate(startDate),
      dataFinal: fmtDate(endDate),
      pagina: "1",
      tamanhoPagina: "20",
      codigoModalidadeContratacao: mod,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${baseUrl}?${params}`, {
        signal: controller.signal,
        headers: { "Accept": "application/json", "User-Agent": "LicitaIA/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json() as { data?: unknown[] };
      const items: unknown[] = Array.isArray(data?.data) ? data.data : [];
      const filtered = items.filter((item: unknown) => {
        const i = item as Record<string, unknown>;
        const desc = String(i.objetoCompra ?? "").toLowerCase();
        return kw.some(k => desc.includes(k));
      });
      allItems = allItems.concat(filtered.slice(0, 10));
    } catch {
      clearTimeout(timeout);
    }
  }

  return allItems.slice(0, 10);
}

// ── GET /processes/:id/proposal ──────────────────────────────────────────────

router.get("/processes/:id/proposal", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [proposal] = await db
    .select()
    .from(processProposalsTable)
    .where(eq(processProposalsTable.processId, id))
    .orderBy(desc(processProposalsTable.updatedAt))
    .limit(1);

  const [research] = await db
    .select()
    .from(marketPriceResearchTable)
    .where(eq(marketPriceResearchTable.processId, id))
    .orderBy(desc(marketPriceResearchTable.fetchedAt))
    .limit(1);

  res.json({
    proposal: proposal ?? null,
    research: research ?? null,
  });
});

// ── POST /processes/:id/proposal (save draft) ────────────────────────────────

router.post("/processes/:id/proposal", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const {
    items,
    totalValue,
    validityDays,
    deliveryTerm,
    brandManufacturer,
    observations,
    declaredCost,
  } = req.body as {
    items?: unknown[];
    totalValue?: number;
    validityDays?: number;
    deliveryTerm?: string;
    brandManufacturer?: string;
    observations?: string;
    declaredCost?: number;
  };

  const [process] = await db.select().from(processesTable).where(eq(processesTable.id, id));
  if (!process) { res.status(404).json({ error: "Process not found" }); return; }

  let company: typeof companiesTable.$inferSelect | null = null;
  if (process.companyId) {
    const [c] = await db.select().from(companiesTable).where(eq(companiesTable.id, process.companyId));
    company = c ?? null;
  }

  const taxRate = calculateTaxRate(company?.porte);
  const total = totalValue ?? 0;
  const taxes = total * taxRate;
  const cost = declaredCost ?? null;
  const margin = cost != null && total > 0 ? ((total - taxes - cost) / total) * 100 : null;

  const [existing] = await db
    .select()
    .from(processProposalsTable)
    .where(eq(processProposalsTable.processId, id))
    .limit(1);

  let proposal;
  if (existing) {
    [proposal] = await db
      .update(processProposalsTable)
      .set({
        items: items ?? existing.items,
        totalValue: String(totalValue ?? existing.totalValue ?? 0),
        validityDays: validityDays ?? existing.validityDays,
        deliveryTerm: deliveryTerm ?? existing.deliveryTerm,
        brandManufacturer: brandManufacturer ?? existing.brandManufacturer,
        observations: observations ?? existing.observations,
        declaredCost: cost != null ? String(cost) : existing.declaredCost,
        estimatedTaxesPercent: String(Math.round(taxRate * 10000) / 100),
        calculatedMargin: margin != null ? String(Math.round(margin * 100) / 100) : existing.calculatedMargin,
        updatedAt: new Date(),
      })
      .where(eq(processProposalsTable.id, existing.id))
      .returning();
  } else {
    [proposal] = await db
      .insert(processProposalsTable)
      .values({
        processId: id,
        companyId: process.companyId,
        items: items ?? [],
        totalValue: String(totalValue ?? 0),
        validityDays: validityDays ?? 60,
        deliveryTerm,
        brandManufacturer,
        observations,
        declaredCost: cost != null ? String(cost) : null,
        estimatedTaxesPercent: String(Math.round(taxRate * 10000) / 100),
        calculatedMargin: margin != null ? String(Math.round(margin * 100) / 100) : null,
        status: "draft",
      })
      .returning();
  }

  res.json({ proposal, taxRate, taxesEstimated: taxes });
});

// ── POST /processes/:id/proposal/search-prices ───────────────────────────────

router.post("/processes/:id/proposal/search-prices", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [process] = await db.select().from(processesTable).where(eq(processesTable.id, id));
  if (!process) { res.status(404).json({ error: "Process not found" }); return; }

  let company: typeof companiesTable.$inferSelect | null = null;
  if (process.companyId) {
    const [c] = await db.select().from(companiesTable).where(eq(companiesTable.id, process.companyId));
    company = c ?? null;
  }

  const title = process.title ?? "";
  const estimatedValue = (process as Record<string, unknown>).estimatedValue as string | null ?? null;

  // 1. Extract keywords via AI
  let keywords: string[] = [];
  try {
    const kwCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Extraia 2-3 palavras-chave principais do objeto de licitação abaixo para busca de preços de mercado. Retorne APENAS um array JSON de strings, sem texto adicional.\nObjeto: "${title}"`,
      }],
      temperature: 0.1,
      max_tokens: 100,
    });
    const raw = kwCompletion.choices[0]?.message?.content?.trim() ?? "[]";
    const match = raw.match(/\[.*?\]/s);
    keywords = match ? JSON.parse(match[0]) : [title.split(" ").slice(0, 3).join(" ")];
  } catch {
    keywords = [title.split(" ").slice(0, 3).join(" ")];
  }

  // 2. Search PNCP
  const pncpResults = await searchPNCPContracts(keywords, company?.uf);

  // 3. Analyze with AI
  let insight = "";
  let suggestedMin = null as number | null;
  let suggestedMax = null as number | null;
  let avgPrice = null as number | null;
  let minPrice = null as number | null;
  let maxPrice = null as number | null;

  if (pncpResults.length > 0) {
    try {
      const analysisCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Analise estes contratos públicos similares e forneça insights de preço.
Retorne JSON com exatamente estas chaves: { "insight": "texto em 1-2 frases", "suggested_min": número, "suggested_max": número, "avg_price": número, "min_price": número, "max_price": número }
Se não conseguir calcular um valor, use null.
Contratos encontrados: ${JSON.stringify(pncpResults.slice(0, 5))}
Estimativa do órgão: R$ ${estimatedValue ?? "não informada"}
Palavras-chave usadas: ${keywords.join(", ")}`,
        }],
        temperature: 0.2,
        max_tokens: 400,
      });
      const raw = analysisCompletion.choices[0]?.message?.content?.trim() ?? "{}";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as {
          insight?: string;
          suggested_min?: number | null;
          suggested_max?: number | null;
          avg_price?: number | null;
          min_price?: number | null;
          max_price?: number | null;
        };
        insight = parsed.insight ?? "";
        suggestedMin = parsed.suggested_min ?? null;
        suggestedMax = parsed.suggested_max ?? null;
        avgPrice = parsed.avg_price ?? null;
        minPrice = parsed.min_price ?? null;
        maxPrice = parsed.max_price ?? null;
      }
    } catch {
      insight = `Encontrados ${pncpResults.length} contratos similares. Analise os valores para definir seu lance.`;
    }
  } else {
    insight = "Nenhum contrato similar encontrado no PNCP para os termos pesquisados. Consulte o Painel de Preços do governo federal para referências de mercado.";
  }

  // 4. Save research
  const [research] = await db
    .insert(marketPriceResearchTable)
    .values({
      processId: id,
      searchTerms: keywords,
      results: pncpResults,
      avgPrice: avgPrice != null ? String(avgPrice) : null,
      minPrice: minPrice != null ? String(minPrice) : null,
      maxPrice: maxPrice != null ? String(maxPrice) : null,
      priceInsight: insight,
      suggestedBidMin: suggestedMin != null ? String(suggestedMin) : null,
      suggestedBidMax: suggestedMax != null ? String(suggestedMax) : null,
    })
    .returning();

  res.json({
    keywords,
    results: pncpResults,
    insight,
    avgPrice,
    minPrice,
    maxPrice,
    suggestedMin,
    suggestedMax,
    research,
  });
});

// ── POST /processes/:id/proposal/generate-docx ──────────────────────────────

router.post("/processes/:id/proposal/generate-docx", async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [process] = await db.select().from(processesTable).where(eq(processesTable.id, id));
  if (!process) { res.status(404).json({ error: "Process not found" }); return; }

  let company: typeof companiesTable.$inferSelect | null = null;
  if (process.companyId) {
    const [c] = await db.select().from(companiesTable).where(eq(companiesTable.id, process.companyId));
    company = c ?? null;
  }

  const {
    items,
    totalValue,
    validityDays,
    deliveryTerm,
    observations,
    includeDeclaration,
  } = req.body as {
    items?: Array<{ itemNumber: number; description: string; quantity: number; unit: string; unitPrice: number; total: number }>;
    totalValue?: number;
    validityDays?: number;
    deliveryTerm?: string;
    observations?: string;
    includeDeclaration?: boolean;
  };

  const today = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const city = company?.municipio ?? "___________";
  const totalBRL = (totalValue ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Convert total to extenso (simple approach)
  function numberToExtenso(value: number): string {
    if (value <= 0) return "zero reais";
    const intPart = Math.floor(value);
    const cents = Math.round((value - intPart) * 100);
    const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
      "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
      "seiscentos", "setecentos", "oitocentos", "novecentos"];
    function convert(n: number): string {
      if (n === 0) return "";
      if (n === 100) return "cem";
      if (n < 20) return units[n]!;
      if (n < 100) return tens[Math.floor(n / 10)]! + (n % 10 ? " e " + units[n % 10]! : "");
      return hundreds[Math.floor(n / 100)]! + (n % 100 ? " e " + convert(n % 100) : "");
    }
    let result = "";
    if (intPart >= 1000000) {
      const m = Math.floor(intPart / 1000000);
      result += convert(m) + (m === 1 ? " milhão" : " milhões");
      if (intPart % 1000000) result += " e ";
    }
    if (intPart >= 1000 && intPart < 1000000) {
      const k = Math.floor(intPart / 1000);
      result += convert(k) + " mil";
      if (intPart % 1000) result += " e ";
    } else if (intPart >= 1000) {
      const k = Math.floor((intPart % 1000000) / 1000);
      if (k > 0) { result += convert(k) + " mil"; if (intPart % 1000) result += " e "; }
    }
    if (intPart % 1000 > 0 || intPart === 0) result += convert(intPart % 1000);
    result += intPart === 1 ? " real" : " reais";
    if (cents > 0) result += " e " + convert(cents) + (cents === 1 ? " centavo" : " centavos");
    return result;
  }

  const totalExtenso = numberToExtenso(totalValue ?? 0);

  // Build table rows (no shading/borders to ensure docx v9 compatibility)
  const colHeaders = ["Nº", "Descrição", "Qtd", "Unid.", "Preço Unit.", "Total"];
  const headerRow = new TableRow({
    children: colHeaders.map((text, ci) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
        width: { size: ci === 1 ? 35 : 13, type: WidthType.PERCENTAGE },
      })
    ),
  });

  const dataRows = (items ?? []).map(item =>
    new TableRow({
      children: [
        String(item.itemNumber),
        item.description,
        String(item.quantity),
        item.unit,
        `R$ ${item.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `R$ ${item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      ].map((text, ci) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
          width: { size: ci === 1 ? 35 : 13, type: WidthType.PERCENTAGE },
        })
      ),
    })
  );

  const totalRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "" })] })], columnSpan: 4 }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: "VALOR TOTAL GERAL", bold: true, size: 20 })] })],
      }),
      new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: totalBRL, bold: true, size: 20 })],
        })],
      }),
    ],
  });

  const tableRows: TableRow[] = [headerRow, ...dataRows, totalRow];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "PROPOSTA COMERCIAL", bold: true, size: 32, color: "0A2540" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: `${process.modality ?? "Pregão Eletrônico"}`, size: 24 }),
            process.editalNumber ? new TextRun({ text: ` nº ${process.editalNumber}`, size: 24 }) : new TextRun({ text: "" }),
            new TextRun({ text: `\n${process.agency ?? ""}`, size: 24, color: "64748B" }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: company?.razaoSocial ?? "___________", bold: true }),
            new TextRun({
              text: `, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${company?.cnpj ?? "___.___.___/____-__"}, com sede em ${company?.endereco ?? company?.logradouro ?? "___________"}${company?.municipio ? `, ${company.municipio}/${company.uf}` : ""}${company?.cep ? `, CEP ${company.cep}` : ""}, neste ato representada por ${company?.representanteLegal ?? company?.nomeResponsavel ?? "___________"}, portador do CPF nº ${company?.cpfResponsavel ?? "___.___.___-__"}, vem, por meio desta proposta, apresentar os seguintes preços para o objeto do pregão em referência:`,
            }),
          ],
        }),
        new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: "TABELA DE PREÇOS:", bold: true, size: 22 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({ text: "VALOR TOTAL DA PROPOSTA: ", bold: true }),
            new TextRun({ text: `${totalBRL} (${totalExtenso})`, bold: true, color: "0066FF" }),
          ],
        }),
        new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: "CONDIÇÕES:", bold: true })] }),
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `• Validade da proposta: ${validityDays ?? 60} dias corridos` })] }),
        ...(deliveryTerm ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `• Prazo de entrega/execução: ${deliveryTerm}` })] })] : []),
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "• Forma de pagamento: conforme edital" })] }),
        ...(observations ? [new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `• Observações: ${observations}` })] })] : []),
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Declaramos que os preços propostos incluem todos os custos diretos e indiretos, tributos, encargos sociais e trabalhistas, seguros e demais despesas necessárias à perfeita execução do objeto." })] }),
        new Paragraph({ spacing: { before: 240, after: 600 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${city}, ${today}.` })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "_________________________________" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: company?.representanteLegal ?? company?.nomeResponsavel ?? "Representante Legal", bold: true })] }),
        ...(company?.cpfResponsavel ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: `CPF: ${company.cpfResponsavel}` })] })] : []),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: company?.razaoSocial ?? "" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `CNPJ: ${company?.cnpj ?? ""}` })] }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = (process.title ?? "proposta").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  const filename = `proposta-${id}-${safeName}-${Date.now()}.docx`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  // Save to proposal record
  const [existing] = await db
    .select()
    .from(processProposalsTable)
    .where(eq(processProposalsTable.processId, id))
    .limit(1);

  if (existing) {
    await db
      .update(processProposalsTable)
      .set({ docxPath: filename, generatedAt: new Date(), status: "generated", updatedAt: new Date() })
      .where(eq(processProposalsTable.id, existing.id));
  } else {
    await db.insert(processProposalsTable).values({
      processId: id,
      companyId: process.companyId,
      items: items ?? [],
      totalValue: String(totalValue ?? 0),
      validityDays: validityDays ?? 60,
      deliveryTerm,
      docxPath: filename,
      generatedAt: new Date(),
      status: "generated",
    });
  }

  res.json({
    filename,
    downloadUrl: `/uploads/${filename}`,
    message: "Proposta gerada com sucesso",
  });
});

// ── POST /processes/:id/proposal/upload-signed ───────────────────────────────

router.post("/processes/:id/proposal/upload-signed", signedUpload.single("file"), async (req, res) => {
  const id = parseInt(req.params.id!);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const filename = req.file.filename;

  const [existing] = await db
    .select()
    .from(processProposalsTable)
    .where(eq(processProposalsTable.processId, id))
    .limit(1);

  if (existing) {
    await db
      .update(processProposalsTable)
      .set({ signedDocxPath: filename, signedUploadedAt: new Date(), status: "signed", updatedAt: new Date() })
      .where(eq(processProposalsTable.id, existing.id));
  }

  // Update process proposal_status
  await db
    .update(processesTable)
    .set({ proposalStatus: "signed" } as Record<string, unknown>)
    .where(eq(processesTable.id, id));

  res.json({ filename, downloadUrl: `/uploads/${filename}`, status: "signed" });
});

export default router;
