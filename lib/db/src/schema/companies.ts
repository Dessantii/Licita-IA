import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),

  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnpj: text("cnpj").notNull(),

  naturezaJuridica: text("natureza_juridica"),
  porte: text("porte"),
  dataAbertura: text("data_abertura"),
  situacaoCadastralReceita: text("situacao_cadastral_receita"),

  cep: text("cep"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  municipio: text("municipio"),
  uf: text("uf"),

  email: text("email"),
  telefone: text("telefone"),
  site: text("site"),
  endereco: text("endereco"),

  nomeResponsavel: text("nome_responsavel"),
  cpfResponsavel: text("cpf_responsavel"),
  emailResponsavel: text("email_responsavel"),

  inscricaoEstadual: text("inscricao_estadual"),
  inscricaoMunicipal: text("inscricao_municipal"),
  representanteLegal: text("representante_legal"),
  observacoes: text("observacoes"),

  nivelSicaf: integer("nivel_sicaf"),
  dataValidadeSicaf: text("data_validade_sicaf"),
  certidoes: jsonb("certidoes"),
  ultimaVerificacaoSicaf: timestamp("ultima_verificacao_sicaf", { withTimezone: true }),

  certificadoValidade: text("certificado_validade"),
  certificadoTipo: text("certificado_tipo"),
  usarCertificadoParaSubmissao: boolean("usar_certificado_para_submissao").default(false),

  capitalSocial: text("capital_social"),
  balancoPatrimonialAno: integer("balanco_patrimonial_ano"),
  indicesLiquidezCorrente: text("indices_liquidez_corrente"),
  indicesLiquidezGeral: text("indices_liquidez_geral"),
  indicesSolvenciaGeral: text("indices_solvencia_geral"),

  biddingProfile: jsonb("bidding_profile").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
