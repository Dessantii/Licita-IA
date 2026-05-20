import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link, useRoute, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";
import { getToken } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, ChevronLeft, ChevronRight, Mail, Phone, MapPin, FileText, BookOpen,
  Pencil, Trash2, Loader2, Hash, Globe, User, ShieldCheck, Award, BarChart3,
  RefreshCw, AlertTriangle, CheckCircle2, Search, Save, X, Target, Scale,
} from "lucide-react";
import { CentralCertidoes } from "./CentralCertidoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const PROCESS_STATUS: Record<string, { label: string; color: string }> = {
  criado: { label: "Iniciado", color: "bg-slate-100 text-slate-600" },
  edital_enviado: { label: "Edital recebido", color: "bg-blue-100 text-blue-700" },
  edital_processando: { label: "Lendo o edital...", color: "bg-blue-100 text-blue-700" },
  exigencias_extraidas: { label: "Documentos identificados", color: "bg-indigo-100 text-indigo-700" },
  aguardando_documentos: { label: "Aguardando documentos", color: "bg-yellow-100 text-yellow-700" },
  documentos_enviados: { label: "Documentos enviados", color: "bg-orange-100 text-orange-700" },
  em_conferencia: { label: "Verificando documentos", color: "bg-purple-100 text-purple-700" },
  pendencias_encontradas: { label: "Tem algo para resolver", color: "bg-red-100 text-red-700" },
  pronto_para_revisao: { label: "Pronto para revisar", color: "bg-emerald-100 text-emerald-700" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-700" },
};

const CALL_STATUS: Record<string, { label: string; color: string }> = {
  criado: { label: "Iniciado", color: "bg-slate-100 text-slate-600" },
  edital_enviado: { label: "Edital recebido", color: "bg-blue-100 text-blue-700" },
  edital_processando: { label: "Lendo o edital...", color: "bg-blue-100 text-blue-700" },
  requisitos_extraidos: { label: "Documentos identificados", color: "bg-indigo-100 text-indigo-700" },
  aguardando_documentos: { label: "Aguardando documentos", color: "bg-yellow-100 text-yellow-700" },
  documentos_enviados: { label: "Documentos enviados", color: "bg-orange-100 text-orange-700" },
  em_conferencia: { label: "Verificando documentos", color: "bg-purple-100 text-purple-700" },
  pendencias_encontradas: { label: "Tem algo para resolver", color: "bg-red-100 text-red-700" },
  pronto_para_submissao: { label: "Pronto para enviar", color: "bg-emerald-100 text-emerald-700" },
  concluido: { label: "Concluído", color: "bg-green-100 text-green-700" },
};

type TabId = "dados" | "regularidade" | "certificado" | "financeiro" | "processos" | "chamamentos" | "perfil";

interface Certidao { validade?: string; url?: string }
interface Certidoes {
  federal?: Certidao; estadual?: Certidao; municipal?: Certidao;
  fgts?: Certidao; trabalhista?: Certidao; falencia?: Certidao;
}

interface CompanyFull {
  id: number; name?: string;
  razaoSocial: string; nomeFantasia?: string; cnpj: string;
  naturezaJuridica?: string; porte?: string; dataAbertura?: string; situacaoCadastralReceita?: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; municipio?: string; uf?: string; endereco?: string;
  email?: string; telefone?: string; site?: string;
  nomeResponsavel?: string; cpfResponsavel?: string; emailResponsavel?: string;
  inscricaoEstadual?: string; inscricaoMunicipal?: string; representanteLegal?: string; observacoes?: string;
  nivelSicaf?: number; dataValidadeSicaf?: string; certidoes?: Certidoes; ultimaVerificacaoSicaf?: string;
  certificadoValidade?: string; certificadoTipo?: string; usarCertificadoParaSubmissao?: boolean;
  capitalSocial?: string; balancoPatrimonialAno?: number;
  indicesLiquidezCorrente?: string; indicesLiquidezGeral?: string; indicesSolvenciaGeral?: string;
  processes: any[]; callNotices: any[];
}

function certidaoStatus(validade?: string): "valida" | "vencendo" | "vencida" | "sem_data" {
  if (!validade) return "sem_data";
  const d = new Date(validade + "T12:00:00");
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencida";
  if (diff <= 30) return "vencendo";
  return "valida";
}

function CertidaoStatusBadge({ validade }: { validade?: string }) {
  const s = certidaoStatus(validade);
  if (s === "sem_data") return <span className="text-xs text-slate-400">Sem data</span>;
  const map = {
    valida: { label: "Válida", cls: "bg-green-50 text-green-700", icon: CheckCircle2 },
    vencendo: { label: "Vencendo", cls: "bg-amber-50 text-amber-700", icon: AlertTriangle },
    vencida: { label: "Vencida", cls: "bg-red-50 text-red-700", icon: AlertTriangle },
  };
  const { label, cls, icon: Icon } = map[s];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full", cls)}>
      <Icon className="w-3 h-3" />{label}
    </span>
  );
}

function calcCompleteness(c: Partial<CompanyFull>): number {
  const cert = c.certidoes ?? {};
  const checks = [
    !!c.razaoSocial, !!c.cnpj, !!c.nomeFantasia, !!c.naturezaJuridica,
    !!c.porte, !!(c.logradouro || c.endereco), !!c.municipio, !!c.uf,
    !!c.email, !!c.telefone, !!c.nomeResponsavel,
    !!(cert as any).federal?.validade, !!(cert as any).estadual?.validade,
    !!(cert as any).municipal?.validade, !!(cert as any).fgts?.validade,
    !!(cert as any).trabalhista?.validade, !!(cert as any).falencia?.validade,
    !!c.nivelSicaf, !!c.capitalSocial,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white";

export function EmpresaDetailPage() {
  const [, params] = useRoute("/companies/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const id = Number(params?.id);

  const [company, setCompany] = useState<CompanyFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("dados");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [verifyingSicaf, setVerifyingSicaf] = useState(false);
  const [form, setForm] = useState<Partial<CompanyFull>>({});
  const [certidoes, setCertidoes] = useState<Certidoes>({});
  const [biddingProfile, setBiddingProfile] = useState<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const token = getToken();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/companies/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCompany(data);
      setForm(data);
      setCertidoes((data.certidoes as Certidoes) ?? {});
      setBiddingProfile((data.biddingProfile as Record<string, any>) ?? {});
    } catch {
      notify(toast, "load_error");
    } finally {
      setIsLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  function setF(field: keyof CompanyFull, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function setCert(type: keyof Certidoes, field: keyof Certidao, value: string) {
    setCertidoes(c => ({ ...c, [type]: { ...(c[type] ?? {}), [field]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form, certidoes };
      delete (body as any).processes;
      delete (body as any).callNotices;
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setCompany(c => ({ ...c!, ...updated }));
      setEditing(false);
      notify(toast, "company_updated");
    } catch {
      notify(toast, "company_update_error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/companies/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      notify(toast, "company_deleted");
      navigate("/empresas");
    } catch {
      notify(toast, "company_delete_error");
    }
  }

  async function lookupCnpj() {
    const cnpj = (form.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) { notify(toast, "cnpj_invalid"); return; }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/companies/cnpj-lookup/${cnpj}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { notify(toast, "cnpj_not_found"); return; }
      const data = await res.json();
      setForm(f => ({ ...f, ...data }));
      notify(toast, "cnpj_loaded");
    } catch {
      notify(toast, "cnpj_not_found");
    } finally {
      setLookingUp(false);
    }
  }

  async function verificarSicaf() {
    setVerifyingSicaf(true);
    try {
      const res = await fetch(`/api/companies/${id}/verificar-sicaf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.encontrado) {
        notify(toast, "sicaf_found");
        load();
      } else {
        notify(toast, "sicaf_not_found", data.mensagem ? { title: data.mensagem } : undefined);
      }
    } catch {
      notify(toast, "sicaf_error");
    } finally {
      setVerifyingSicaf(false);
    }
  }

  const completeness = company ? calcCompleteness({ ...form, certidoes }) : 0;

  const hasExpiring = Object.values(certidoes).some(c => {
    const s = certidaoStatus(c?.validade);
    return s === "vencendo" || s === "vencida";
  });

  if (isLoading) {
    return <AppLayout><div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></AppLayout>;
  }
  if (!company) {
    return <AppLayout><div className="text-center py-16 text-slate-500">Empresa não encontrada</div></AppLayout>;
  }

  const displayName = company.nomeFantasia || company.razaoSocial;

  const tabs: { id: TabId; label: string; icon: any; badge?: number | string }[] = [
    { id: "dados", label: "Dados", icon: Building2 },
    { id: "regularidade", label: "Certidões & Regularidade", icon: ShieldCheck, badge: hasExpiring ? "!" : undefined },
    { id: "certificado", label: "Certificado Digital", icon: Award },
    { id: "financeiro", label: "Financeiro", icon: BarChart3 },
    { id: "processos", label: "Licitações", icon: FileText, badge: company.processes.length },
    { id: "chamamentos", label: "Chamamentos", icon: BookOpen, badge: company.callNotices.length },
    { id: "perfil", label: "Perfil Licitatório", icon: Target },
  ];

  async function handleSaveBiddingProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ biddingProfile }),
      });
      if (!res.ok) throw new Error();
      notify(toast, "company_updated");
      load();
    } catch {
      notify(toast, "company_update_error");
    } finally {
      setSavingProfile(false);
    }
  }

  const SUPPLY_CATEGORIES = [
    { value: "ti", label: "Tecnologia (TI)" },
    { value: "alimentacao", label: "Alimentação" },
    { value: "limpeza", label: "Limpeza e Conservação" },
    { value: "saude", label: "Saúde" },
    { value: "construcao", label: "Construção e Obras" },
    { value: "transporte", label: "Transporte" },
    { value: "educacao", label: "Educação e Treinamento" },
    { value: "escritorio", label: "Material de Escritório" },
    { value: "seguranca", label: "Segurança" },
    { value: "outros", label: "Outros" },
  ];

  function toggleCategory(value: string) {
    const current: string[] = biddingProfile.categories ?? [];
    const updated = current.includes(value)
      ? current.filter(c => c !== value)
      : [...current, value];
    setBiddingProfile(p => ({ ...p, categories: updated }));
  }

  const certidaoTypes: { key: keyof Certidoes; label: string }[] = [
    { key: "federal", label: "Certidão Federal (Receita / PGFN)" },
    { key: "estadual", label: "Certidão Estadual" },
    { key: "municipal", label: "Certidão Municipal" },
    { key: "fgts", label: "Certidão FGTS (CEF)" },
    { key: "trabalhista", label: "Certidão Trabalhista (TST)" },
    { key: "falencia", label: "Certidão de Falência/Recuperação" },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4 font-medium">
        <Link href="/companies" className="hover:text-primary transition-colors flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Empresas
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 truncate max-w-xs">{displayName}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-slate-900 mb-0.5 truncate">
              {displayName}
            </h1>
            {company.razaoSocial !== displayName && (
              <p className="text-sm text-slate-400 mb-1">{company.razaoSocial}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              {company.cnpj && <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{company.cnpj}</span>}
              {company.municipio && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.municipio}/{company.uf}</span>}
              {company.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{company.email}</span>}
              {company.telefone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{company.telefone}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm(company); setCertidoes((company.certidoes as Certidoes) ?? {}); }}>
                <X className="w-4 h-4 mr-1.5" />Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-1.5" />Editar
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Completeness bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Completude do cadastro</span>
          <span className={cn("text-sm font-bold", completeness >= 80 ? "text-green-600" : completeness >= 50 ? "text-amber-600" : "text-red-500")}>
            {completeness}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", completeness >= 80 ? "bg-green-500" : completeness >= 50 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${completeness}%` }}
          />
        </div>
        {completeness < 100 && (
          <p className="text-xs text-slate-400 mt-1.5">Complete o endereço, as certidões e os dados financeiros para estar pronto para participar de editais.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-slate-200 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3.5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge !== undefined && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                t.badge === "!" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
              )}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: DADOS ──────────────────────────────────────────── */}
      {tab === "dados" && (
        <div className="space-y-6">
          {/* CNPJ Lookup */}
          {editing && (
            <Card className="p-4 bg-blue-50 border-blue-100">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800">Consulta automática na Receita Federal</p>
                  <p className="text-xs text-blue-600">Preencha o CNPJ e clique em Consultar para preencher os dados automaticamente.</p>
                </div>
                <Button size="sm" variant="outline" onClick={lookupCnpj} disabled={lookingUp} className="shrink-0 bg-white border-blue-200 text-blue-700 hover:bg-blue-50">
                  {lookingUp ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Search className="w-4 h-4 mr-1.5" />}
                  Consultar
                </Button>
              </div>
            </Card>
          )}

          {/* Dados jurídicos */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-400" />Dados da empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Razão Social *" className="md:col-span-2">
                {editing ? <input className={inputCls} value={form.razaoSocial ?? ""} onChange={e => setF("razaoSocial", e.target.value)} /> : <p className="text-sm text-slate-800 font-medium">{company.razaoSocial || "—"}</p>}
              </Field>
              <Field label="Nome Fantasia">
                {editing ? <input className={inputCls} value={form.nomeFantasia ?? ""} onChange={e => setF("nomeFantasia", e.target.value)} /> : <p className="text-sm text-slate-800">{company.nomeFantasia || "—"}</p>}
              </Field>
              <Field label="CNPJ">
                {editing ? <input className={inputCls} value={form.cnpj ?? ""} onChange={e => setF("cnpj", e.target.value)} placeholder="00.000.000/0001-00" /> : <p className="text-sm font-mono text-slate-800">{company.cnpj || "—"}</p>}
              </Field>
              <Field label="Natureza Jurídica">
                {editing ? <input className={inputCls} value={form.naturezaJuridica ?? ""} onChange={e => setF("naturezaJuridica", e.target.value)} /> : <p className="text-sm text-slate-800">{company.naturezaJuridica || "—"}</p>}
              </Field>
              <Field label="Porte">
                {editing ? (
                  <select className={inputCls} value={form.porte ?? ""} onChange={e => setF("porte", e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="ME">ME — Microempresa</option>
                    <option value="EPP">EPP — Empresa de Pequeno Porte</option>
                    <option value="Médio">Médio Porte</option>
                    <option value="Grande">Grande Porte</option>
                  </select>
                ) : <p className="text-sm text-slate-800">{company.porte || "—"}</p>}
              </Field>
              <Field label="Data de Abertura">
                {editing ? <input type="date" className={inputCls} value={form.dataAbertura ?? ""} onChange={e => setF("dataAbertura", e.target.value)} /> : <p className="text-sm text-slate-800">{company.dataAbertura ? format(new Date(company.dataAbertura + "T12:00:00"), "dd/MM/yyyy") : "—"}</p>}
              </Field>
              <Field label="Situação na Receita Federal">
                {editing ? <input className={inputCls} value={form.situacaoCadastralReceita ?? ""} onChange={e => setF("situacaoCadastralReceita", e.target.value)} /> : <p className="text-sm text-slate-800">{company.situacaoCadastralReceita || "—"}</p>}
              </Field>
              <Field label="Inscrição Estadual">
                {editing ? <input className={inputCls} value={form.inscricaoEstadual ?? ""} onChange={e => setF("inscricaoEstadual", e.target.value)} /> : <p className="text-sm text-slate-800">{company.inscricaoEstadual || "—"}</p>}
              </Field>
              <Field label="Inscrição Municipal">
                {editing ? <input className={inputCls} value={form.inscricaoMunicipal ?? ""} onChange={e => setF("inscricaoMunicipal", e.target.value)} /> : <p className="text-sm text-slate-800">{company.inscricaoMunicipal || "—"}</p>}
              </Field>
            </div>
          </Card>

          {/* Endereço */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" />Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="CEP">
                {editing ? <input className={inputCls} value={form.cep ?? ""} onChange={e => setF("cep", e.target.value)} placeholder="00000-000" /> : <p className="text-sm text-slate-800">{company.cep || "—"}</p>}
              </Field>
              <Field label="Logradouro" className="md:col-span-2">
                {editing ? <input className={inputCls} value={form.logradouro ?? ""} onChange={e => setF("logradouro", e.target.value)} /> : <p className="text-sm text-slate-800">{company.logradouro || "—"}</p>}
              </Field>
              <Field label="Número">
                {editing ? <input className={inputCls} value={form.numero ?? ""} onChange={e => setF("numero", e.target.value)} /> : <p className="text-sm text-slate-800">{company.numero || "—"}</p>}
              </Field>
              <Field label="Complemento">
                {editing ? <input className={inputCls} value={form.complemento ?? ""} onChange={e => setF("complemento", e.target.value)} /> : <p className="text-sm text-slate-800">{company.complemento || "—"}</p>}
              </Field>
              <Field label="Bairro">
                {editing ? <input className={inputCls} value={form.bairro ?? ""} onChange={e => setF("bairro", e.target.value)} /> : <p className="text-sm text-slate-800">{company.bairro || "—"}</p>}
              </Field>
              <Field label="Município" className="md:col-span-2">
                {editing ? <input className={inputCls} value={form.municipio ?? ""} onChange={e => setF("municipio", e.target.value)} /> : <p className="text-sm text-slate-800">{company.municipio || "—"}</p>}
              </Field>
              <Field label="UF">
                {editing ? <input className={inputCls} maxLength={2} value={form.uf ?? ""} onChange={e => setF("uf", e.target.value.toUpperCase())} /> : <p className="text-sm text-slate-800">{company.uf || "—"}</p>}
              </Field>
            </div>
          </Card>

          {/* Contato */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />Contato</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="E-mail da Empresa">
                {editing ? <input type="email" className={inputCls} value={form.email ?? ""} onChange={e => setF("email", e.target.value)} /> : <p className="text-sm text-slate-800">{company.email || "—"}</p>}
              </Field>
              <Field label="Telefone">
                {editing ? <input className={inputCls} value={form.telefone ?? ""} onChange={e => setF("telefone", e.target.value)} /> : <p className="text-sm text-slate-800">{company.telefone || "—"}</p>}
              </Field>
              <Field label="Site" className="md:col-span-2">
                {editing ? <input className={inputCls} value={form.site ?? ""} onChange={e => setF("site", e.target.value)} placeholder="https://" /> : (
                  company.site ? <a href={company.site} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{company.site}</a> : <p className="text-sm text-slate-800">—</p>
                )}
              </Field>
            </div>
          </Card>

          {/* Responsável */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />Responsável Legal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome do Responsável" className="md:col-span-2">
                {editing ? <input className={inputCls} value={form.nomeResponsavel ?? ""} onChange={e => setF("nomeResponsavel", e.target.value)} /> : <p className="text-sm text-slate-800">{company.nomeResponsavel || "—"}</p>}
              </Field>
              <Field label="CPF do Responsável">
                {editing ? <input className={inputCls} value={form.cpfResponsavel ?? ""} onChange={e => setF("cpfResponsavel", e.target.value)} placeholder="000.000.000-00" /> : <p className="text-sm font-mono text-slate-800">{company.cpfResponsavel || "—"}</p>}
              </Field>
              <Field label="E-mail do Responsável">
                {editing ? <input type="email" className={inputCls} value={form.emailResponsavel ?? ""} onChange={e => setF("emailResponsavel", e.target.value)} /> : <p className="text-sm text-slate-800">{company.emailResponsavel || "—"}</p>}
              </Field>
              <Field label="Representante Legal" className="md:col-span-2">
                {editing ? <input className={inputCls} value={form.representanteLegal ?? ""} onChange={e => setF("representanteLegal", e.target.value)} /> : <p className="text-sm text-slate-800">{company.representanteLegal || "—"}</p>}
              </Field>
            </div>
          </Card>

          {/* Observações */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4">Observações</h3>
            {editing ? (
              <textarea className={cn(inputCls, "resize-none")} rows={3} value={form.observacoes ?? ""} onChange={e => setF("observacoes", e.target.value)} />
            ) : <p className="text-sm text-slate-600 italic">{company.observacoes || "Nenhuma observação cadastrada."}</p>}
          </Card>
        </div>
      )}

      {/* ── TAB: REGULARIDADE ───────────────────────────────────── */}
      {tab === "regularidade" && (
        <div className="space-y-6">
          {/* Central de Certidões — seção principal antes do cofre */}
          <CentralCertidoes
            companyId={id}
            company={{ id, cnpj: company.cnpj ?? "", razaoSocial: company.razaoSocial }}
          />

          {/* Divisor */}
          <div className="border-t border-slate-200 pt-2" />

          {/* SICAF */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-slate-400" />SICAF</h3>
              <Button size="sm" variant="outline" onClick={verificarSicaf} disabled={verifyingSicaf}>
                {verifyingSicaf ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                Verificar no SICAF
              </Button>
            </div>
            {company.ultimaVerificacaoSicaf && (
              <p className="text-xs text-slate-400 mb-4">
                Última verificação: {format(new Date(company.ultimaVerificacaoSicaf), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nível SICAF (1–5)">
                {editing ? (
                  <select className={inputCls} value={form.nivelSicaf ?? ""} onChange={e => setF("nivelSicaf", e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Não informado</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>Nível {n}</option>)}
                  </select>
                ) : <p className="text-sm text-slate-800">{company.nivelSicaf ? `Nível ${company.nivelSicaf}` : "—"}</p>}
              </Field>
              <Field label="Validade do SICAF">
                {editing ? <input type="date" className={inputCls} value={form.dataValidadeSicaf ?? ""} onChange={e => setF("dataValidadeSicaf", e.target.value)} /> : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-800">{company.dataValidadeSicaf ? format(new Date(company.dataValidadeSicaf + "T12:00:00"), "dd/MM/yyyy") : "—"}</p>
                    {company.dataValidadeSicaf && <CertidaoStatusBadge validade={company.dataValidadeSicaf} />}
                  </div>
                )}
              </Field>
            </div>
          </Card>

          {/* Certidões */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-slate-400" />Certidões de Regularidade</h3>
            <div className="space-y-4">
              {certidaoTypes.map(({ key, label }) => {
                const cert = (editing ? certidoes[key] : (company.certidoes as Certidoes)?.[key]) ?? {};
                return (
                  <div key={key} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-sm text-slate-800">{label}</p>
                      <CertidaoStatusBadge validade={cert.validade} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Validade">
                        {editing ? (
                          <input type="date" className={inputCls} value={certidoes[key]?.validade ?? ""} onChange={e => setCert(key, "validade", e.target.value)} />
                        ) : <p className="text-sm text-slate-700">{cert.validade ? format(new Date(cert.validade + "T12:00:00"), "dd/MM/yyyy") : "—"}</p>}
                      </Field>
                      <Field label="URL / Número">
                        {editing ? (
                          <input className={inputCls} placeholder="https://..." value={certidoes[key]?.url ?? ""} onChange={e => setCert(key, "url", e.target.value)} />
                        ) : cert.url ? (
                          cert.url.startsWith("http") ? <a href={cert.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline truncate block">{cert.url}</a> : <p className="text-sm text-slate-700">{cert.url}</p>
                        ) : <p className="text-sm text-slate-400">—</p>}
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: CERTIFICADO DIGITAL ────────────────────────────── */}
      {tab === "certificado" && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-slate-400" />Certificado Digital</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tipo de Certificado">
                {editing ? (
                  <select className={inputCls} value={form.certificadoTipo ?? ""} onChange={e => setF("certificadoTipo", e.target.value)}>
                    <option value="">Não informado</option>
                    <option value="e-CNPJ A1">e-CNPJ A1 (arquivo .pfx)</option>
                    <option value="e-CNPJ A3">e-CNPJ A3 (token/smartcard)</option>
                  </select>
                ) : <p className="text-sm text-slate-800">{company.certificadoTipo || "—"}</p>}
              </Field>
              <Field label="Validade do Certificado">
                {editing ? <input type="date" className={inputCls} value={form.certificadoValidade ?? ""} onChange={e => setF("certificadoValidade", e.target.value)} /> : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-800">{company.certificadoValidade ? format(new Date(company.certificadoValidade + "T12:00:00"), "dd/MM/yyyy") : "—"}</p>
                    {company.certificadoValidade && <CertidaoStatusBadge validade={company.certificadoValidade} />}
                  </div>
                )}
              </Field>
              <Field label="Usar para submissão automática" className="md:col-span-2">
                {editing ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form.usarCertificadoParaSubmissao} onChange={e => setF("usarCertificadoParaSubmissao", e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-700">Habilitar uso do certificado para assinar e submeter propostas automaticamente</span>
                  </label>
                ) : <p className="text-sm text-slate-800">{company.usarCertificadoParaSubmissao ? "Sim, habilitado" : "Não habilitado"}</p>}
              </Field>
            </div>
          </Card>
          <Card className="p-5 bg-blue-50 border-blue-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-1">Segurança do arquivo .pfx</p>
                <p className="text-sm text-blue-700">O arquivo do certificado digital (.pfx) deve ser carregado pela aba de <strong>Documentos da Empresa</strong>. Os arquivos são armazenados de forma segura, fora do diretório público, com acesso restrito por token de autenticação.</p>
                <Link href={`/companies/${company.id}`} className="mt-2 inline-block text-sm text-blue-600 font-semibold hover:underline">Ir para Documentos da Empresa →</Link>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: FINANCEIRO ─────────────────────────────────────── */}
      {tab === "financeiro" && (
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-slate-400" />Dados Financeiros para Habilitação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Capital Social (R$)">
                {editing ? <input className={inputCls} value={form.capitalSocial ?? ""} onChange={e => setF("capitalSocial", e.target.value)} placeholder="0,00" /> : <p className="text-sm text-slate-800">{company.capitalSocial ? `R$ ${company.capitalSocial}` : "—"}</p>}
              </Field>
              <Field label="Ano do Balanço Patrimonial">
                {editing ? <input type="number" className={inputCls} value={form.balancoPatrimonialAno ?? ""} onChange={e => setF("balancoPatrimonialAno", e.target.value ? Number(e.target.value) : null)} placeholder="2024" /> : <p className="text-sm text-slate-800">{company.balancoPatrimonialAno || "—"}</p>}
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-2">Índices de Habilitação</h3>
            <p className="text-xs text-slate-400 mb-4">Calculados a partir do Balanço Patrimonial. Exigidos em processos com maior valor estimado.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Liquidez Corrente (≥ 1,0)">
                {editing ? <input className={inputCls} value={form.indicesLiquidezCorrente ?? ""} onChange={e => setF("indicesLiquidezCorrente", e.target.value)} placeholder="1,00" /> : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-800">{company.indicesLiquidezCorrente || "—"}</p>
                    {company.indicesLiquidezCorrente && Number(company.indicesLiquidezCorrente.replace(",",".")) >= 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : company.indicesLiquidezCorrente ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                )}
              </Field>
              <Field label="Liquidez Geral (≥ 1,0)">
                {editing ? <input className={inputCls} value={form.indicesLiquidezGeral ?? ""} onChange={e => setF("indicesLiquidezGeral", e.target.value)} placeholder="1,00" /> : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-800">{company.indicesLiquidezGeral || "—"}</p>
                    {company.indicesLiquidezGeral && Number(company.indicesLiquidezGeral.replace(",",".")) >= 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : company.indicesLiquidezGeral ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                )}
              </Field>
              <Field label="Solvência Geral (≥ 1,0)">
                {editing ? <input className={inputCls} value={form.indicesSolvenciaGeral ?? ""} onChange={e => setF("indicesSolvenciaGeral", e.target.value)} placeholder="1,00" /> : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-800">{company.indicesSolvenciaGeral || "—"}</p>
                    {company.indicesSolvenciaGeral && Number(company.indicesSolvenciaGeral.replace(",",".")) >= 1 ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : company.indicesSolvenciaGeral ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                )}
              </Field>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: LICITAÇÕES ─────────────────────────────────────── */}
      {tab === "processos" && (
        company.processes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Nenhuma licitação vinculada</p>
            <p className="text-sm text-slate-500 mt-1">Vincule esta empresa ao criar ou editar um processo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {company.processes.map((p: any) => {
              const si = PROCESS_STATUS[p.status] ?? { label: p.status, color: "bg-slate-100 text-slate-600" };
              return (
                <Link key={p.id} href={`/processes/${p.id}`}>
                  <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-slate-500" /></div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary">{p.title}</p>
                          <p className="text-xs text-slate-500 truncate">{p.agency} • {p.modality}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", si.color)}>{si.label}</span>
                        <span className="text-xs text-slate-400">{format(new Date(p.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* ── TAB: CHAMAMENTOS ────────────────────────────────────── */}
      {tab === "chamamentos" && (
        company.callNotices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Nenhum chamamento vinculado</p>
            <p className="text-sm text-slate-500 mt-1">Vincule esta empresa ao criar ou editar um chamamento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {company.callNotices.map((n: any) => {
              const si = CALL_STATUS[n.status] ?? { label: n.status, color: "bg-slate-100 text-slate-600" };
              return (
                <Link key={n.id} href={`/chamamentos/${n.id}`}>
                  <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all group cursor-pointer">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4 text-indigo-500" /></div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary">{n.title}</p>
                          <p className="text-xs text-slate-500 truncate">{n.agency}{n.referenceNumber ? ` • ${n.referenceNumber}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", si.color)}>{si.label}</span>
                        <span className="text-xs text-slate-400">{format(new Date(n.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* ── TAB: PERFIL LICITATÓRIO ──────────────────────────────── */}
      {tab === "perfil" && (
        <div className="space-y-6">
          {/* Intro card */}
          <div className="rounded-2xl p-5 flex items-start gap-4" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0F4FF 100%)', border: '1px solid #DBEAFE' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#E5F0FF' }}>
              <Target className="w-5 h-5" style={{ color: '#0066FF' }} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm mb-1">Perfil de oportunidades ideal</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Configure quais segmentos e características de licitações combinam com sua empresa. O LicitaIA usa esses dados para rankear automaticamente as oportunidades na aba Oportunidades.
              </p>
            </div>
          </div>

          {/* Categorias */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Target className="w-4 h-4 text-slate-400" />
              Categorias que você fornece
            </h3>
            <p className="text-xs text-slate-500 mb-4">Marque todos os segmentos em que sua empresa tem experiência ou interesse.</p>
            <div className="flex flex-wrap gap-2">
              {SUPPLY_CATEGORIES.map(cat => {
                const selected = (biddingProfile.categories ?? []).includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggleCategory(cat.value)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                      selected
                        ? "text-white shadow-sm"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-400"
                    )}
                    style={selected ? { background: '#0066FF' } : {}}
                  >
                    {cat.label}
                    {selected && <span className="ml-1.5">✓</span>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Raio de atuação */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-1">Raio de atuação</h3>
            <p className="text-xs text-slate-500 mb-4">Onde você pode prestar serviços ou entregar produtos?</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: "municipio", label: "Só no meu município", description: "Atendo apenas localmente" },
                { value: "estado", label: "No meu estado", description: "Atendo no estado inteiro" },
                { value: "nacional", label: "Nacional", description: "Atendo em qualquer lugar do Brasil" },
              ].map(opt => {
                const selected = (biddingProfile.operationRadius ?? "nacional") === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setBiddingProfile(p => ({ ...p, operationRadius: opt.value }))}
                    className={cn(
                      "p-4 rounded-xl text-left transition-all",
                      selected ? "text-white shadow-sm" : "bg-slate-50 border border-slate-200 hover:border-slate-400"
                    )}
                    style={selected ? { background: '#0066FF' } : {}}
                  >
                    <p className={cn("font-semibold text-sm", selected ? "text-white" : "text-slate-800")}>{opt.label}</p>
                    <p className={cn("text-xs mt-0.5", selected ? "text-blue-100" : "text-slate-500")}>{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Valor máximo */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 mb-1">Valor máximo por contrato</h3>
            <p className="text-xs text-slate-500 mb-4">Qual o maior contrato que sua empresa consegue executar? Deixe em branco para não filtrar por valor.</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 shrink-0">R$</span>
              <input
                type="number"
                value={biddingProfile.maxContractValue ?? ""}
                onChange={e => setBiddingProfile(p => ({ ...p, maxContractValue: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="Ex: 500000"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 max-w-xs w-full"
              />
            </div>
          </Card>

          {/* Experiência prévia */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 mb-0.5">Experiência prévia em licitações</h3>
                <p className="text-xs text-slate-500">Sua empresa já ganhou algum processo licitatório antes?</p>
              </div>
              <button
                onClick={() => setBiddingProfile(p => ({ ...p, hasPriorExperience: !p.hasPriorExperience }))}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  biddingProfile.hasPriorExperience ? "" : "bg-slate-200"
                )}
                style={biddingProfile.hasPriorExperience ? { background: '#0066FF' } : {}}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                    biddingProfile.hasPriorExperience ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </Card>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveBiddingProfile}
              disabled={savingProfile}
              style={{ background: '#0066FF' }}
              className="text-white hover:opacity-90 gap-2"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Perfil Licitatório
            </Button>
          </div>
        </div>
      )}

      {/* Save bar when editing and in regulatory/cert/financial tabs */}
      {editing && ["regularidade", "certificado", "financeiro"].includes(tab) && (
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setEditing(false); setForm(company); setCertidoes((company.certidoes as Certidoes) ?? {}); }}>
            <X className="w-4 h-4 mr-1.5" />Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salvar Alterações
          </Button>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa "{displayName}" será excluída permanentemente. Os processos e chamamentos vinculados perderão o vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
