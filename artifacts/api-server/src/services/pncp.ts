export const MODALIDADES: Record<number, string> = {
  1: "Leilão Eletrônico",
  2: "Diálogo Competitivo",
  3: "Concurso",
  4: "Concorrência Eletrônica",
  5: "Concorrência Presencial",
  6: "Pregão Eletrônico",
  7: "Pregão Presencial",
  8: "Dispensa de Licitação",
  9: "Inexigibilidade",
  10: "Manifestação de Interesse",
  11: "Pré-qualificação",
  12: "Credenciamento",
  13: "Leilão Presencial",
};

const ALL_MODALIDADE_IDS = [6, 7, 4, 5, 8, 9, 1, 3, 2, 10, 11, 12, 13];

export interface PncpContratacao {
  sequencialCompra: number;
  anoCompra: number;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: { municipioNome: string; ufNome: string; ufSigla: string };
  modalidadeId: number;
  modalidadeNome: string;
  objetoCompra: string;
  dataPublicacaoPncp: string;
  linkSistemaOrigem?: string;
  informacaoComplementar?: string;
}

export interface PncpResponse {
  data: PncpContratacao[];
  totalRegistros: number;
  totalPaginas: number;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";

async function buscarPorModalidade(params: {
  dataInicial: Date;
  dataFinal: Date;
  uf?: string;
  municipio?: string;
  modalidadeId: number;
  pagina?: number;
  tamanhoPagina?: number;
}): Promise<PncpResponse> {
  const query = new URLSearchParams({
    dataInicial: formatDate(params.dataInicial),
    dataFinal: formatDate(params.dataFinal),
    pagina: String(params.pagina ?? 1),
    tamanhoPagina: String(Math.min(50, Math.max(10, params.tamanhoPagina ?? 50))),
    codigoModalidadeContratacao: String(params.modalidadeId),
  });

  if (params.uf) query.set("uf", params.uf);

  const url = `${PNCP_BASE}?${query}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "LicitaIA/1.0 (sistema de monitoramento de licitacoes)",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 204 || res.status === 204) {
      return { data: [], totalRegistros: 0, totalPaginas: 0 };
    }
    const body = await res.text().catch(() => "");
    throw new Error(`PNCP API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = await res.text();
  if (!raw || !raw.trim()) return { data: [], totalRegistros: 0, totalPaginas: 0 };

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return { data: [], totalRegistros: 0, totalPaginas: 0 };
  }

  if (Array.isArray(json)) {
    return { data: json as PncpContratacao[], totalRegistros: json.length, totalPaginas: 1 };
  }
  if (json.data && Array.isArray(json.data)) {
    return json as PncpResponse;
  }
  return { data: [], totalRegistros: 0, totalPaginas: 0 };
}

export async function buscarPublicacoesPncp(params: {
  dataInicial: Date;
  dataFinal: Date;
  uf?: string;
  municipio?: string;
  modalidadeId?: number;
  pagina?: number;
  tamanhoPagina?: number;
}): Promise<PncpResponse> {
  if (params.modalidadeId) {
    return buscarPorModalidade({ ...params, modalidadeId: params.modalidadeId });
  }

  const ids = ALL_MODALIDADE_IDS;
  const allData: PncpContratacao[] = [];
  let totalRegistros = 0;

  for (const id of ids) {
    try {
      const result = await buscarPorModalidade({ ...params, modalidadeId: id, tamanhoPagina: 50 });
      allData.push(...result.data);
      totalRegistros += result.totalRegistros;
    } catch {}
  }

  return { data: allData, totalRegistros, totalPaginas: 1 };
}

export function filtragemPorPalavras(
  contratacao: PncpContratacao,
  palavras: string[],
): boolean {
  if (!palavras.length) return true;
  const texto = `${contratacao.objetoCompra} ${contratacao.informacaoComplementar ?? ""}`.toLowerCase();
  return palavras.some((p) => texto.includes(p.toLowerCase()));
}

export function pncpUrl(cnpj: string, ano: number, seq: number): string {
  return `https://pncp.gov.br/app/editais/${cnpj.replace(/\D/g, "")}/${ano}/${String(seq).padStart(8, "0")}`;
}
