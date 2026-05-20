import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProcessQueryKey } from "@workspace/api-client-react";
import { getToken } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Timer, Bell, Calculator, TrendingDown, Trophy, AlertCircle, CheckCircle2,
  Loader2, Plus, X, Check, Sparkles, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionBid {
  id: number;
  bidTime: string;
  bidValue: string;
  bidType: "own" | "competitor";
  notes?: string | null;
}

interface SessionResult {
  resultado: string;
  valorAdjudicado?: string;
  posicaoFinal?: string;
  observacoes?: string;
}

export interface SessionProcess {
  id: number;
  title: string;
  modality: string;
  agency?: string;
  sessionDate?: string | null;
  sessionAlertsEnabled?: boolean | null;
  sessionResult?: SessionResult | null;
  sessionChecklist?: Record<string, boolean> | null;
}

type SessionState = "no_date" | "pre" | "live" | "post";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAX_RATES: Record<string, number> = {
  "MEI": 5,
  "Simples Nacional": 8,
  "Lucro Presumido": 14.25,
  "Lucro Real": 20,
};

const DEFAULT_CHECKLIST: Record<string, boolean> = {
  proposta_gerada: false,
  proposta_submetida: false,
  certificado_digital: false,
  acesso_testado: false,
  calculadora_configurada: false,
  notificacao_ativada: false,
};

const CHECKLIST_LABELS: Record<string, string> = {
  proposta_gerada: "Proposta gerada e assinada",
  proposta_submetida: "Proposta submetida na plataforma",
  certificado_digital: "Certificado digital funcionando e dentro da validade",
  acesso_testado: "Acesso à plataforma testado",
  calculadora_configurada: "Calculadora de lance configurada",
  notificacao_ativada: "Notificação de início ativada",
};

function getSessionState(sessionDate: string | null | undefined): SessionState {
  if (!sessionDate) return "no_date";
  const session = new Date(sessionDate).getTime();
  const now = Date.now();
  const diff = session - now;
  const fourHours = 4 * 60 * 60 * 1000;
  if (diff > fourHours) return "pre";
  if (diff > -fourHours) return "live";
  return "post";
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function msToCountdown(ms: number) {
  const total = Math.max(0, ms);
  return {
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000),
  };
}

// ── Bid Calculator ────────────────────────────────────────────────────────────

function BidCalculator({ proposalValue, compact }: { proposalValue: number | null; compact?: boolean }) {
  const [custo, setCusto] = useState(() => proposalValue ? String(Math.round(proposalValue * 0.82)) : "");
  const [margem, setMargem] = useState("5");
  const [regime, setRegime] = useState("Simples Nacional");
  const [impostos, setImpostos] = useState(String(TAX_RATES["Simples Nacional"]));
  const [lanceSimulado, setLanceSimulado] = useState("");

  useEffect(() => { setImpostos(String(TAX_RATES[regime] ?? 8)); }, [regime]);

  const custoNum = parseFloat(custo) || 0;
  const margemNum = parseFloat(margem) || 0;
  const impostosNum = parseFloat(impostos) || 0;
  const propNum = proposalValue ?? 0;
  const divisor = 1 - (impostosNum / 100) - (margemNum / 100);
  const lanceMinimo = divisor > 0 ? custoNum / divisor : 0;
  const margemAtual = propNum > 0 ? ((propNum - custoNum) / propNum) * 100 : 0;
  const economiaPossivel = propNum > 0 ? propNum - lanceMinimo : 0;

  const lanceSimNum = parseFloat(lanceSimulado) || 0;
  const margemSim = lanceSimNum > 0 ? ((lanceSimNum - custoNum) / lanceSimNum) * 100 : null;
  const lucroSim = lanceSimNum > 0 ? lanceSimNum - custoNum - lanceSimNum * impostosNum / 100 : null;
  const simStatus = lanceSimNum === 0 ? null : lanceSimNum < lanceMinimo ? "prejuizo" : (margemSim ?? 0) < 3 ? "baixa" : "ok";

  const maxVal = Math.max(propNum, lanceMinimo, 1);
  const minPct = Math.min(99, (lanceMinimo / maxVal) * 100);
  const propPct = Math.min(100, (propNum / maxVal) * 100);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
      <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
        <Calculator className="w-4 h-4 text-blue-500" />
        <h4 className="font-semibold text-slate-800 text-sm">Calculadora de lance mínimo viável</h4>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Custo total (R$)</span>
            <input type="number" value={custo} onChange={e => setCusto(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{ borderColor: '#E2E8F0' }} placeholder="0,00" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Margem mínima (%)</span>
            <input type="number" value={margem} onChange={e => setMargem(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{ borderColor: '#E2E8F0' }} placeholder="5" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Regime tributário</span>
            <select value={regime} onChange={e => setRegime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: '#E2E8F0', background: 'white' }}>
              {Object.keys(TAX_RATES).map(r => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Impostos (%)</span>
            <input type="number" value={impostos} onChange={e => setImpostos(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{ borderColor: '#E2E8F0' }} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-xs text-red-600 font-medium mb-1">Lance mínimo viável</p>
            <p className="text-sm font-bold text-red-700">{custoNum > 0 ? formatBRL(lanceMinimo) : "—"}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
            <p className="text-xs text-blue-600 font-medium mb-1">Lance da proposta</p>
            <p className="text-sm font-bold text-blue-700">{propNum > 0 ? formatBRL(propNum) : "—"}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p className="text-xs text-green-600 font-medium mb-1">Margem atual</p>
            <p className="text-sm font-bold text-green-700">{propNum > 0 ? `${margemAtual.toFixed(1)}%` : "—"}</p>
          </div>
        </div>

        {propNum > 0 && custoNum > 0 && lanceMinimo > 0 && (
          <div>
            <div className="relative h-7 rounded-lg overflow-hidden" style={{ background: '#FEF2F2' }}>
              <div className="absolute top-0 bottom-0 rounded-lg" style={{ left: `${minPct}%`, width: `${Math.max(0, propPct - minPct)}%`, background: '#BBF7D0' }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${minPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500" style={{ left: `${propPct}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              <span className="text-red-600">Mínimo: {formatBRL(lanceMinimo)}</span>
              {economiaPossivel > 0 && <span className="text-green-600 font-semibold">↓ Pode reduzir até {formatBRL(economiaPossivel)}</span>}
              <span className="text-blue-600">Proposta: {formatBRL(propNum)}</span>
            </div>
          </div>
        )}

        <div className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #E8EFF6' }}>
          <p className="text-xs font-semibold text-slate-600 mb-2">Simular lance</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">R$</span>
            <input type="number" placeholder="Digite um valor..." value={lanceSimulado}
              onChange={e => setLanceSimulado(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              style={{ borderColor: '#E2E8F0', background: 'white' }} />
            {lanceSimNum > 0 && (
              <button onClick={() => setLanceSimulado("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {simStatus && (
            <div className="mt-2.5 flex items-center gap-3 flex-wrap">
              <span className={cn("text-sm font-semibold flex items-center gap-1",
                simStatus === "ok" && "text-green-600",
                simStatus === "baixa" && "text-amber-600",
                simStatus === "prejuizo" && "text-red-600",
              )}>
                {simStatus === "ok" && <><CheckCircle2 className="w-4 h-4" /> ✅ Viável</>}
                {simStatus === "baixa" && <><AlertCircle className="w-4 h-4" /> ⚠️ Margem baixa</>}
                {simStatus === "prejuizo" && <><X className="w-4 h-4" /> ❌ Prejuízo</>}
              </span>
              {margemSim !== null && <span className="text-xs text-slate-500">Margem: {margemSim.toFixed(1)}%</span>}
              {lucroSim !== null && <span className="text-xs text-slate-500">Lucro est.: {formatBRL(Math.max(0, lucroSim))}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Notification Toggle ───────────────────────────────────────────────────────

function NotificationToggle({ processId, sessionDate, enabled, token, onToggle }: {
  processId: number; sessionDate: string | null; enabled: boolean; token: string | null; onToggle: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scheduleNotifs = useCallback(() => {
    if (!sessionDate || !("Notification" in window)) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const session = new Date(sessionDate).getTime();
    const now = Date.now();
    [
      { offset: -3600000, title: "Sessão em 1 hora", body: "Prepare-se para a sessão de disputa." },
      { offset: -900000, title: "Sessão em 15 minutos!", body: "Acesse a plataforma agora." },
      { offset: 0, title: "Sessão iniciando agora!", body: "Boa sorte na sua disputa!" },
    ].forEach(({ offset, title, body }) => {
      const delay = session + offset - now;
      if (delay > 0) {
        timersRef.current.push(setTimeout(() => {
          if (Notification.permission === "granted") new Notification(title, { body });
        }, delay));
      }
    });
  }, [sessionDate]);

  const handleToggle = async () => {
    setLoading(true);
    if (!enabled && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setLoading(false); return; }
    }
    await fetch(`${API}/api/processes/${processId}/session-alerts`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    onToggle(!enabled);
    if (!enabled) scheduleNotifs();
    else timersRef.current.forEach(clearTimeout);
    setLoading(false);
  };

  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#F8FAFC', border: '1px solid #E8EFF6' }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: enabled ? '#EFF6FF' : '#F1F5F9' }}>
          <Bell className="w-4 h-4" style={{ color: enabled ? '#0066FF' : '#94a3b8' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Alertas de início de sessão</p>
          <p className="text-xs text-slate-500">
            {enabled ? "Mantenha esta aba aberta para receber os alertas" : "Receber alertas 1h e 15min antes da sessão"}
          </p>
        </div>
      </div>
      <button onClick={handleToggle} disabled={loading}
        className={cn("relative w-12 h-6 rounded-full transition-colors flex-shrink-0", enabled ? "bg-blue-500" : "bg-slate-200")}>
        <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
          enabled ? "translate-x-7" : "translate-x-1")} />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SessionTab({ processId, process, companyData }: {
  processId: number;
  process: SessionProcess;
  companyData?: any;
}) {
  const token = getToken();
  const queryClient = useQueryClient();
  const [sessionDate, setSessionDate] = useState<string | null>(process.sessionDate ?? null);
  const [alertsEnabled, setAlertsEnabled] = useState(process.sessionAlertsEnabled ?? false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    (process.sessionChecklist as Record<string, boolean>) ?? { ...DEFAULT_CHECKLIST }
  );
  const [result, setResult] = useState<SessionResult>(
    (process.sessionResult as SessionResult) ?? { resultado: "" }
  );
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [bids, setBids] = useState<SessionBid[]>([]);
  const [showBidForm, setShowBidForm] = useState(false);
  const [newBid, setNewBid] = useState({ bidValue: "", bidType: "competitor" as "own" | "competitor", notes: "" });
  const [savingResult, setSavingResult] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);
  const [suggestion, setSuggestion] = useState<string[] | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [proposal, setProposal] = useState<{ totalValue?: number } | null>(null);
  const [, setTick] = useState(0);

  // Ticker (1s) for countdown
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch bids
  useEffect(() => {
    fetch(`${API}/api/processes/${processId}/session-bids`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : []).then(setBids).catch(() => {});
  }, [processId, token]);

  // Fetch proposal value
  useEffect(() => {
    fetch(`${API}/api/processes/${processId}/proposal`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data?.totalValue) setProposal({ totalValue: parseFloat(data.totalValue) });
    }).catch(() => {});
  }, [processId, token]);

  const sessionState = getSessionState(sessionDate);
  const countdown = sessionDate ? msToCountdown(new Date(sessionDate).getTime() - Date.now()) : null;
  const elapsed = sessionDate ? msToCountdown(Math.max(0, Date.now() - new Date(sessionDate).getTime())) : null;

  const handleSaveDate = async () => {
    if (!dateInput) return;
    const iso = new Date(dateInput).toISOString();
    await fetch(`${API}/api/processes/${processId}/session-date`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionDate: iso }),
    });
    setSessionDate(iso);
    setEditingDate(false);
    queryClient.invalidateQueries({ queryKey: getGetProcessQueryKey(processId) });
  };

  const handleChecklistChange = async (key: string, value: boolean) => {
    const updated = { ...checklist, [key]: value };
    setChecklist(updated);
    fetch(`${API}/api/processes/${processId}/session-checklist`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: updated }),
    }).catch(() => {});
  };

  const handleAddBid = async () => {
    if (!newBid.bidValue) return;
    const res = await fetch(`${API}/api/processes/${processId}/session-bids`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(newBid),
    });
    if (res.ok) {
      const bid = await res.json();
      setBids(prev => [...prev, bid]);
      setNewBid({ bidValue: "", bidType: "competitor", notes: "" });
      setShowBidForm(false);
    }
  };

  const handleSaveResult = async () => {
    setSavingResult(true);
    await fetch(`${API}/api/processes/${processId}/session-result`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    setSavingResult(false);
    setResultSaved(true);
    setTimeout(() => setResultSaved(false), 3000);
  };

  const handleGetSuggestion = async () => {
    setLoadingSuggestion(true);
    const res = await fetch(`${API}/api/processes/${processId}/session-result-suggestion`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ valorVencedor: result.valorAdjudicado, valorProposta: proposal?.totalValue }),
    });
    if (res.ok) { const d = await res.json(); setSuggestion(d.sugestoes ?? []); }
    setLoadingSuggestion(false);
  };

  const sortedBids = [...bids].sort((a, b) => new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime());
  const lowestBid = bids.length > 0 ? Math.min(...bids.map(b => parseFloat(b.bidValue))) : null;
  const myLastBid = sortedBids.find(b => b.bidType === "own");

  const chartData = [...bids]
    .sort((a, b) => new Date(a.bidTime).getTime() - new Date(b.bidTime).getTime())
    .map(b => ({
      time: new Date(b.bidTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      proprio: b.bidType === "own" ? parseFloat(b.bidValue) : undefined,
      concorrente: b.bidType === "competitor" ? parseFloat(b.bidValue) : undefined,
    }));

  // ── No date ────────────────────────────────────────────────────────────────

  if (sessionState === "no_date") {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#EFF6FF' }}>
            <Calendar className="w-6 h-6" style={{ color: '#0066FF' }} />
          </div>
          <div>
            <p className="font-bold text-slate-800 mb-1">Data da sessão não cadastrada</p>
            <p className="text-sm text-slate-500">Informe quando ocorrerá a sessão de disputa para ativar todos os recursos.</p>
          </div>
          {editingDate ? (
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <input type="datetime-local" value={dateInput} onChange={e => setDateInput(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} />
              <Button onClick={handleSaveDate} size="sm" style={{ background: '#0066FF' }} className="text-white">Salvar</Button>
              <Button variant="outline" size="sm" onClick={() => setEditingDate(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button onClick={() => setEditingDate(true)} style={{ background: '#0066FF' }} className="text-white gap-2">
              <Calendar className="w-4 h-4" /> Informar data da sessão
            </Button>
          )}
        </div>
        <BidCalculator proposalValue={proposal?.totalValue ?? null} />
      </div>
    );
  }

  // ── Pre-session ────────────────────────────────────────────────────────────

  if (sessionState === "pre") {
    const sessionFormatted = sessionDate
      ? format(new Date(sessionDate), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH'h'mm", { locale: ptBR })
      : "";
    const doneCount = Object.values(checklist).filter(Boolean).length;

    return (
      <div className="space-y-6">
        {/* Countdown */}
        <div className="rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)', border: '1px solid #DBEAFE' }}>
          <p className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-widest">Sessão de disputa em</p>
          <div className="flex items-center justify-center gap-3 mb-4">
            {([
              { value: countdown!.days, label: "dias" },
              { value: countdown!.hours, label: "horas" },
              { value: countdown!.minutes, label: "min" },
              { value: countdown!.seconds, label: "seg" },
            ] as const).map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-blue-800 bg-white shadow-sm" style={{ border: '1px solid #DBEAFE' }}>
                  {String(value).padStart(2, "0")}
                </div>
                <span className="text-xs text-slate-400 mt-1.5 font-medium">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 capitalize">{sessionFormatted}</p>
          <button onClick={() => {
            setEditingDate(true);
            setDateInput(sessionDate ? format(new Date(sessionDate), "yyyy-MM-dd'T'HH:mm") : "");
          }} className="text-xs text-blue-500 hover:text-blue-700 mt-2 transition-colors">
            Editar data
          </button>
          {editingDate && (
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <input type="datetime-local" value={dateInput} onChange={e => setDateInput(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0' }} />
              <Button onClick={handleSaveDate} size="sm" style={{ background: '#0066FF' }} className="text-white">Salvar</Button>
              <Button variant="outline" size="sm" onClick={() => setEditingDate(false)}>Cancelar</Button>
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h4 className="font-semibold text-slate-800 text-sm">Checklist de preparação</h4>
            <span className="ml-auto text-xs text-slate-500">{doneCount}/{Object.keys(checklist).length} concluídos</span>
          </div>
          <div>
            {Object.entries(CHECKLIST_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
                <input type="checkbox" checked={!!checklist[key]} onChange={e => handleChecklistChange(key, e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500 flex-shrink-0" />
                <span className={cn("text-sm", checklist[key] ? "text-slate-400 line-through" : "text-slate-700")}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Proposal summary */}
        {proposal?.totalValue && (
          <div className="rounded-2xl p-5 flex items-center justify-between" style={{ border: '1px solid #E8EFF6', background: '#FAFBFC' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                <TrendingDown className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Valor da proposta enviada</p>
                <p className="text-xl font-bold text-slate-900">{formatBRL(proposal.totalValue)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notification toggle */}
        <NotificationToggle processId={processId} sessionDate={sessionDate} enabled={alertsEnabled} token={token} onToggle={setAlertsEnabled} />

        {/* Calculator */}
        <BidCalculator proposalValue={proposal?.totalValue ?? null} />
      </div>
    );
  }

  // ── Live session ────────────────────────────────────────────────────────────

  if (sessionState === "live") {
    return (
      <div className="space-y-6">
        {/* Live banner */}
        <div className="rounded-2xl p-5" style={{ background: '#F0FDF4', border: '2px solid #86EFAC' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex h-3 w-3 relative flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="font-bold text-green-900 text-lg">Sessão em andamento</span>
            {elapsed && (
              <span className="text-sm text-green-700">
                Há {elapsed.hours > 0 ? `${elapsed.hours}h ` : ""}{String(elapsed.minutes).padStart(2, "0")}min {String(elapsed.seconds).padStart(2, "0")}s
              </span>
            )}
          </div>
        </div>

        {/* Calculator highlighted */}
        <BidCalculator proposalValue={proposal?.totalValue ?? null} />

        {/* Bid log */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold text-slate-800 text-sm">Registro de lances</h4>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {lowestBid !== null && <span className="text-xs text-slate-500">Menor: <strong className="text-slate-800">{formatBRL(lowestBid)}</strong></span>}
              {myLastBid && <span className="text-xs text-slate-500">Meu último: <strong className="text-blue-600">{formatBRL(parseFloat(myLastBid.bidValue))}</strong></span>}
              <Button size="sm" onClick={() => setShowBidForm(p => !p)} style={{ background: '#0066FF' }} className="text-white gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" /> Registrar lance
              </Button>
            </div>
          </div>

          {showBidForm && (
            <div className="px-5 py-4 flex flex-wrap items-end gap-3" style={{ background: '#EFF6FF', borderBottom: '1px solid #E8EFF6' }}>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Valor (R$)</label>
                <input type="number" value={newBid.bidValue} onChange={e => setNewBid(p => ({ ...p, bidValue: e.target.value }))}
                  className="px-3 py-2 rounded-lg border text-sm w-36" style={{ borderColor: '#E2E8F0' }} placeholder="0,00" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Tipo</label>
                <select value={newBid.bidType} onChange={e => setNewBid(p => ({ ...p, bidType: e.target.value as "own" | "competitor" }))}
                  className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0', background: 'white' }}>
                  <option value="competitor">Concorrente</option>
                  <option value="own">Meu lance</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Observação</label>
                <input type="text" value={newBid.notes} onChange={e => setNewBid(p => ({ ...p, notes: e.target.value }))}
                  className="px-3 py-2 rounded-lg border text-sm w-44" style={{ borderColor: '#E2E8F0' }} placeholder="Opcional..." />
              </div>
              <Button onClick={handleAddBid} size="sm" style={{ background: '#0066FF' }} className="text-white">Salvar</Button>
              <Button variant="outline" size="sm" onClick={() => setShowBidForm(false)}>Cancelar</Button>
            </div>
          )}

          <div>
            {sortedBids.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">Nenhum lance registrado. Clique em "Registrar lance" para começar.</p>
            ) : (
              sortedBids.map(bid => (
                <div key={bid.id} className="px-5 py-3.5 flex items-center gap-4 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
                  <span className="text-xs text-slate-400 w-12 flex-shrink-0">
                    {new Date(bid.bidTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={cn("text-sm font-bold", bid.bidType === "own" ? "text-blue-600" : "text-slate-800")}>
                    {formatBRL(parseFloat(bid.bidValue))}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold",
                    bid.bidType === "own" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500")}>
                    {bid.bidType === "own" ? "Meu lance" : "Concorrente"}
                  </span>
                  {bid.notes && <span className="text-xs text-slate-400 flex-1 truncate">{bid.notes}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Post-session ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Result form */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
          <Trophy className="w-4 h-4 text-amber-500" />
          <h4 className="font-semibold text-slate-800 text-sm">Resultado da sessão</h4>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Resultado</label>
            <select value={result.resultado} onChange={e => setResult(p => ({ ...p, resultado: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0', background: 'white' }}>
              <option value="">Selecione...</option>
              <option value="vencedor">Vencedor</option>
              <option value="nao_vencedor">Não vencedor</option>
              <option value="suspenso">Sessão suspensa</option>
              <option value="deserta">Licitação deserta</option>
              <option value="aguardando">Aguardando homologação</option>
            </select>
          </div>

          {(result.resultado === "vencedor" || result.resultado === "nao_vencedor") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  {result.resultado === "vencedor" ? "Valor adjudicado (R$)" : "Valor do vencedor (R$)"}
                </label>
                <input type="number" value={result.valorAdjudicado ?? ""} onChange={e => setResult(p => ({ ...p, valorAdjudicado: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0', background: 'white' }} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Posição final</label>
                <input type="number" value={result.posicaoFinal ?? ""} onChange={e => setResult(p => ({ ...p, posicaoFinal: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E2E8F0', background: 'white' }} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Observações</label>
            <textarea value={result.observacoes ?? ""} onChange={e => setResult(p => ({ ...p, observacoes: e.target.value }))}
              rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              style={{ borderColor: '#E2E8F0', background: 'white' }} placeholder="Anotações sobre a sessão..." />
          </div>

          <Button onClick={handleSaveResult} disabled={savingResult || !result.resultado}
            style={{ background: '#0066FF' }} className="text-white gap-2">
            {savingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : resultSaved ? <Check className="w-4 h-4" /> : null}
            {resultSaved ? "Salvo!" : "Salvar resultado"}
          </Button>
        </div>
      </div>

      {/* Winner banner */}
      {result.resultado === "vencedor" && (
        <div className="rounded-2xl p-6 text-center" style={{ background: '#F0FDF4', border: '1px solid #86EFAC' }}>
          <div className="text-4xl mb-2">🏆</div>
          <h3 className="text-xl font-bold text-green-900 mb-1">Parabéns! Você venceu!</h3>
          {result.valorAdjudicado && (
            <p className="text-sm text-green-700 mb-4">Valor adjudicado: {formatBRL(parseFloat(result.valorAdjudicado))}</p>
          )}
          <div className="text-left max-w-sm mx-auto space-y-2 mt-4">
            {["Aguardar homologação oficial", "Verificar prazo para assinatura do contrato", "Providenciar garantia contratual (se exigida)", "Verificar pendências fiscais (prazo LC 123 se aplicável)"].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-winner */}
      {result.resultado === "nao_vencedor" && (
        <div className="rounded-2xl p-5" style={{ border: '1px solid #E8EFF6', background: '#FAFBFC' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold text-slate-800 text-sm">Sugestões para a próxima licitação</h4>
            </div>
            {!suggestion && (
              <Button size="sm" variant="outline" onClick={handleGetSuggestion} disabled={loadingSuggestion} className="gap-1.5 text-xs">
                {loadingSuggestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Gerar com IA
              </Button>
            )}
          </div>
          {suggestion ? (
            <ul className="space-y-2">
              {suggestion.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-blue-500 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span> {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Clique em "Gerar com IA" para obter sugestões personalizadas.</p>
          )}
        </div>
      )}

      {/* Bid history */}
      {bids.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8EFF6' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EFF6' }}>
            <Timer className="w-4 h-4 text-blue-500" />
            <h4 className="font-semibold text-slate-800 text-sm">Histórico de lances da sessão</h4>
          </div>
          {chartData.length > 1 && (
            <div className="p-5 pb-2">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Line type="monotone" dataKey="proprio" stroke="#0066FF" dot={{ r: 3 }} name="Meus lances" connectNulls />
                  <Line type="monotone" dataKey="concorrente" stroke="#EF4444" dot={{ r: 3 }} name="Concorrentes" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div>
            {sortedBids.map(bid => (
              <div key={bid.id} className="px-5 py-3.5 flex items-center gap-4 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}>
                <span className="text-xs text-slate-400 w-12 flex-shrink-0">
                  {new Date(bid.bidTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className={cn("text-sm font-bold", bid.bidType === "own" ? "text-blue-600" : "text-slate-800")}>
                  {formatBRL(parseFloat(bid.bidValue))}
                </span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold",
                  bid.bidType === "own" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500")}>
                  {bid.bidType === "own" ? "Meu lance" : "Concorrente"}
                </span>
                {bid.notes && <span className="text-xs text-slate-400 flex-1 truncate">{bid.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculator still available */}
      <BidCalculator proposalValue={proposal?.totalValue ?? null} />
    </div>
  );
}
