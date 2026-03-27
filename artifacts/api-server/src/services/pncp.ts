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

export async function buscarPublicacoesPncp(params: {
  dataInicial: Date;
  dataFinal: Date;
  uf?: string;
  municipio?: string;
  modalidadeId?: number;
  pagina?: number;
  tamanhoPagina?: number;
}): Promise<PncpResponse> {
  const query = new URLSearchParams({
    dataInicial: formatDate(params.dataInicial),
    dataFinal: formatDate(params.dataFinal),
    pagina: String(params.pagina ?? 1),
    tamanhoPagina: String(params.tamanhoPagina ?? 100),
  });

  if (params.uf) query.set("uf", params.uf);
  if (params.modalidadeId) query.set("modalidadeId", String(params.modalidadeId));
  if (params.municipio) query.set("municipio", params.municipio);

  const url = `https://pncp.gov.br/api/pncp/v1/contratacoes/publicacoes?${query}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "LicitaIA/1.0 (sistema de monitoramento de licitacoes)",
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 404) return { data: [], totalRegistros: 0, totalPaginas: 0 };
    throw new Error(`PNCP API error ${res.status}`);
  }

  return res.json() as Promise<PncpResponse>;
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
