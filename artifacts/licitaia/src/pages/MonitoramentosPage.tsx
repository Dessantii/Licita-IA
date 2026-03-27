import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, Trash2, PlayCircle, PauseCircle, RefreshCw, Activity, MapPin, Tag, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { getToken } from "@/hooks/use-auth";

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

const MODALIDADES: Record<number, string> = {
  6: "Pregão Eletrônico",
  7: "Pregão Presencial",
  4: "Concorrência Eletrônica",
  5: "Concorrência Presencial",
  8: "Dispensa de Licitação",
  9: "Inexigibilidade",
  1: "Leilão Eletrônico",
  3: "Concurso",
};

interface Monitor {
  id: number;
  name: string;
  uf: string | null;
  municipio: string | null;
  modalidadeId: number | null;
  palavrasChave: string[] | null;
  isActive: boolean;
  lastCheckedAt: string | null;
}

function useApi() {
  const token = getToken();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  return { headers };
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
      {active ? "Ativo" : "Pausado"}
    </span>
  );
}

export function MonitoramentosPage() {
  const { headers } = useApi();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<Record<number, number>>({});

  const [form, setForm] = useState({ name: "", uf: "", municipio: "", modalidadeId: "", palavrasChave: "" });

  async function load() {
    try {
      const res = await fetch("/api/monitors", { headers });
      const data = await res.json();
      setMonitors(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useState(() => { load(); });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const palavras = form.palavrasChave
      ? form.palavrasChave.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    await fetch("/api/monitors", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: form.name,
        uf: form.uf || undefined,
        municipio: form.municipio || undefined,
        modalidadeId: form.modalidadeId ? Number(form.modalidadeId) : undefined,
        palavrasChave: palavras.length > 0 ? palavras : undefined,
      }),
    });
    setForm({ name: "", uf: "", municipio: "", modalidadeId: "", palavrasChave: "" });
    setShowForm(false);
    load();
  }

  async function handleToggle(id: number) {
    await fetch(`/api/monitors/${id}/toggle`, { method: "POST", headers });
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este monitoramento?")) return;
    await fetch(`/api/monitors/${id}`, { method: "DELETE", headers });
    load();
  }

  async function handleCheck(id: number) {
    setChecking(id);
    setCheckResult((prev) => ({ ...prev, [id]: -1 }));
    try {
      const res = await fetch(`/api/monitors/${id}/check`, { method: "POST", headers });
      const data = await res.json();
      setCheckResult((prev) => ({ ...prev, [id]: data.novosAlertas ?? 0 }));
      load();
    } catch {
      setCheckResult((prev) => ({ ...prev, [id]: -2 }));
    } finally {
      setChecking(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monitoramentos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              O sistema verifica o PNCP a cada 2 horas e notifica você sobre novos editais.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Novo monitoramento
          </button>
        </div>

        {showForm && (
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-foreground mb-4">Configurar monitoramento</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome do monitoramento *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Pregões SP - Tecnologia"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Estado (UF)</label>
                  <select
                    value={form.uf}
                    onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Todos os estados</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Cidade</label>
                  <input
                    value={form.municipio}
                    onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
                    placeholder="Ex: São Paulo, Campinas..."
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Modalidade</label>
                  <select
                    value={form.modalidadeId}
                    onChange={(e) => setForm((f) => ({ ...f, modalidadeId: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Todas as modalidades</option>
                    {Object.entries(MODALIDADES).map(([id, nome]) => (
                      <option key={id} value={id}>{nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Palavras-chave (separadas por vírgula)</label>
                  <input
                    value={form.palavrasChave}
                    onChange={(e) => setForm((f) => ({ ...f, palavrasChave: e.target.value }))}
                    placeholder="Ex: construção, reforma, pavimentação"
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
                  Criar monitoramento
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-slate-50 transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-border rounded-xl">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="font-semibold text-foreground">Nenhum monitoramento configurado</p>
            <p className="text-muted-foreground text-sm mt-1">
              Crie um monitoramento para ser notificado sobre novos editais no PNCP.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {monitors.map((m) => (
              <div
                key={m.id}
                className="bg-white border border-border rounded-xl p-5 flex items-start justify-between gap-4 hover:border-primary/30 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground truncate">{m.name}</h3>
                    <StatusBadge active={m.isActive} />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {(m.municipio || m.uf) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {[m.municipio, m.uf].filter(Boolean).join(" — ")}
                      </span>
                    )}
                    {m.modalidadeId && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        {MODALIDADES[m.modalidadeId] ?? `Modalidade ${m.modalidadeId}`}
                      </span>
                    )}
                    {m.palavrasChave && m.palavrasChave.length > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {m.palavrasChave.join(", ")}
                      </span>
                    )}
                  </div>
                  {m.lastCheckedAt && (
                    <p className="text-xs text-slate-400 mt-2">
                      Última verificação: {new Date(m.lastCheckedAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {checkResult[m.id] !== undefined && checkResult[m.id] !== -1 && (
                    <p className={`text-xs mt-1 font-medium ${checkResult[m.id] === -2 ? "text-red-500" : checkResult[m.id] > 0 ? "text-green-600" : "text-slate-400"}`}>
                      {checkResult[m.id] === -2
                        ? "Erro ao verificar o PNCP."
                        : checkResult[m.id] > 0
                        ? `✓ ${checkResult[m.id]} novo(s) edital(is) encontrado(s)!`
                        : "✓ Nenhum edital novo."}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCheck(m.id)}
                    disabled={checking === m.id}
                    title="Verificar agora"
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition disabled:opacity-40"
                  >
                    {checking === m.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggle(m.id)}
                    title={m.isActive ? "Pausar" : "Ativar"}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-primary transition"
                  >
                    {m.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    title="Excluir"
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <strong>Como funciona:</strong> O sistema consulta o{" "}
            <a href="https://pncp.gov.br" target="_blank" rel="noopener" className="underline">
              PNCP (Portal Nacional de Contratações Públicas)
            </a>
            {" "}a cada 2 horas. Você também pode clicar no botão de atualizar para verificar imediatamente.
            Quando aparecer um edital novo, você será notificado pelo sino no topo da página.
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
