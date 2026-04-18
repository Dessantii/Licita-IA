import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useParams, Link } from "wouter";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ShieldCheck,
  FileText,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  ListX,
  Download,
  Wand2,
  Lightbulb,
} from "lucide-react";

interface Section {
  id: number;
  type: string;
  content: string | null;
  aiGenerated: boolean;
  updatedAt: string;
}

interface Project {
  id: number;
  title: string;
  status: string;
  fundingNoticeId: number | null;
  noticeTitle?: string | null;
}

interface ValidationResult {
  projectTitle: string;
  sectionsAnalyzed: number;
  nivel_aderencia: number;
  pontos_fortes: string[];
  pontos_fracos: string[];
  itens_faltantes: string[];
  recomendacoes: string[];
  resumo: string;
  validatedAt: string;
}

const SECTION_TYPES = [
  { key: "problema", label: "Problema" },
  { key: "justificativa", label: "Justificativa" },
  { key: "objetivo_geral", label: "Objetivo Geral" },
  { key: "objetivos_especificos", label: "Objetivos Específicos" },
  { key: "metodologia", label: "Metodologia" },
  { key: "impacto", label: "Impacto Esperado" },
  { key: "cronograma", label: "Cronograma" },
  { key: "orcamento", label: "Orçamento" },
];

function AdherenceMeter({ value }: { value: number }) {
  const color =
    value >= 75 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-2xl font-bold text-slate-900 w-14 text-right">{value}%</span>
    </div>
  );
}

export function FundingProjectEditorPage() {
  const token = getToken();
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Record<string, Section>>({});
  const [loading, setLoading] = useState(true);

  // Per-section state
  const [activeSection, setActiveSection] = useState<string>("justificativa");
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [contexto, setContexto] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  // Validation
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  // Rewrite
  const [rewriting, setRewriting] = useState<string | null>(null);

  async function loadProject() {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/projects/${projectId}/sections`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (pRes.ok) {
        const list: Project[] = await pRes.json();
        const found = list.find((p) => String(p.id) === projectId);
        setProject(found ?? null);
      }

      if (sRes.ok) {
        const list: Section[] = await sRes.json();
        const map: Record<string, Section> = {};
        const editMap: Record<string, string> = {};
        for (const s of list) {
          map[s.type] = s;
          editMap[s.type] = s.content ?? "";
        }
        setSections(map);
        setEditContent(editMap);
      }
    } catch {
      toast({ title: "Erro ao carregar projeto", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProject(); }, [projectId]);

  async function handleGenerate(sectionType: string) {
    if (!contexto.trim()) {
      toast({ title: "Informe o contexto do projeto antes de gerar", variant: "destructive" });
      return;
    }
    setGenerating(sectionType);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-section`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ section_type: sectionType, contexto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar seção");
      setSections((prev) => ({ ...prev, [sectionType]: data }));
      setEditContent((prev) => ({ ...prev, [sectionType]: data.content ?? "" }));
      toast({ title: "Seção gerada com sucesso!" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao exportar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "projeto.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  async function handleRewrite(sectionType: string) {
    const currentText = editContent[sectionType] ?? "";
    if (currentText.trim().length < 10) {
      toast({ title: "Escreva pelo menos um parágrafo antes de melhorar", variant: "destructive" });
      return;
    }
    setRewriting(sectionType);
    try {
      const res = await fetch(`/api/projects/${projectId}/rewrite-section`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ section_type: sectionType, texto: currentText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao melhorar texto");
      setEditContent((prev) => ({ ...prev, [sectionType]: data.improved }));
      toast({ title: "Texto melhorado com sucesso!" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setRewriting(null);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao validar projeto");
      setValidation(data);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  }

  const currentSection = SECTION_TYPES.find((s) => s.key === activeSection)!;
  const currentSectionData = sections[activeSection];
  const filledCount = Object.keys(sections).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-slate-500">Projeto não encontrado.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <Link href="/funding-projects">
              <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
                <ChevronLeft className="w-4 h-4" />
                Projetos
              </button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>
            {project.noticeTitle && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {project.noticeTitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{filledCount}/{SECTION_TYPES.length} seções</span>
            <Button
              onClick={handleExport}
              disabled={exporting || filledCount === 0}
              variant="outline"
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? "Gerando PDF..." : "Exportar PDF"}
            </Button>
            <Button
              onClick={handleValidate}
              disabled={validating || filledCount === 0}
              variant="outline"
              className="gap-2 border-primary text-primary hover:bg-primary/5"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {validating ? "Validando..." : "Validar Projeto"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Sections list + context */}
          <div className="space-y-4">
            {/* Context box */}
            <Card className="p-4">
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Contexto do projeto
              </label>
              <p className="text-xs text-slate-400 mb-2">
                Descreva a empresa, experiência, capacidade, localização. A IA usa isso em todas as seções.
              </p>
              <textarea
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                rows={5}
                placeholder="Ex: Cooperativa de agricultores familiares de Palotina-PR com 5 anos de atuação, certificação orgânica, capacidade de 200kg/semana..."
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
              />
            </Card>

            {/* Sections nav */}
            <Card className="p-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2 py-1 mb-1">
                Seções do Projeto
              </p>
              {SECTION_TYPES.map((s) => {
                const filled = !!sections[s.key];
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{s.label}</span>
                    {filled && (
                      <CheckCircle2
                        className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-white/70" : "text-green-500"}`}
                      />
                    )}
                  </button>
                );
              })}
            </Card>
          </div>

          {/* Right: Editor */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900 text-lg">{currentSection.label}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {currentSectionData?.aiGenerated && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Gerado por IA
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRewrite(activeSection)}
                    disabled={rewriting === activeSection || !(editContent[activeSection] ?? "").trim()}
                    className="gap-1.5"
                  >
                    {rewriting === activeSection ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    {rewriting === activeSection ? "Melhorando..." : "Melhorar"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleGenerate(activeSection)}
                    disabled={generating === activeSection || !contexto.trim()}
                    className="gap-1.5"
                  >
                    {generating === activeSection ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {generating === activeSection ? "Gerando..." : "Gerar com IA"}
                  </Button>
                </div>
              </div>

              {!contexto.trim() && (
                <div className="mb-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Preencha o contexto à esquerda para habilitar a geração por IA.
                </div>
              )}

              <textarea
                className="w-full border border-slate-200 rounded-md px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
                rows={16}
                placeholder={`Escreva ou gere com IA o conteúdo de "${currentSection.label}"...`}
                value={editContent[activeSection] ?? ""}
                onChange={(e) =>
                  setEditContent((prev) => ({ ...prev, [activeSection]: e.target.value }))
                }
              />
              <p className="text-xs text-slate-400 mt-1 text-right">
                {(editContent[activeSection] ?? "").length} caracteres
              </p>
            </Card>

            {/* Validation result */}
            {validation && (
              <Card className="p-5 border-2 border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-slate-900">Resultado da Validação</h3>
                  <span className="text-xs text-slate-400 ml-auto">
                    {validation.sectionsAnalyzed} seção(ões) analisada(s)
                  </span>
                </div>

                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Nível de Aderência</span>
                  </div>
                  <AdherenceMeter value={validation.nivel_aderencia} />
                </div>

                <p className="text-sm text-slate-600 mb-5 leading-relaxed border-l-4 border-primary/30 pl-3">
                  {validation.resumo}
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ThumbsUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">Pontos Fortes</span>
                    </div>
                    <ul className="space-y-1">
                      {validation.pontos_fortes.map((p, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                          <span className="text-green-500 mt-0.5">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ThumbsDown className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm font-semibold text-yellow-700">Pontos Fracos</span>
                    </div>
                    <ul className="space-y-1">
                      {validation.pontos_fracos.map((p, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                          <span className="text-yellow-500 mt-0.5">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ListX className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-700">Itens Faltantes</span>
                    </div>
                    <ul className="space-y-1">
                      {validation.itens_faltantes.map((p, i) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                          <span className="text-red-500 mt-0.5">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {(validation.recomendacoes ?? []).length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-700">Recomendações</span>
                      </div>
                      <ul className="space-y-1">
                        {validation.recomendacoes.map((p, i) => (
                          <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                            <span className="text-blue-500 mt-0.5">•</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
