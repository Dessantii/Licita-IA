import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { notify } from "@/lib/feedback";
import {
  Building2,
  User,
  Save,
  CheckCircle2,
  Info,
  Lock,
  Loader2,
} from "lucide-react";
import { getToken } from "@/hooks/use-auth";

const STORAGE_KEY = "licitaia_settings";

interface Settings {
  companyName: string;
  companyCnpj: string;
  companyAddress: string;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  notes: string;
}

const defaultSettings: Settings = {
  companyName: "",
  companyCnpj: "",
  companyAddress: "",
  responsibleName: "",
  responsibleEmail: "",
  responsiblePhone: "",
  notes: "",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return defaultSettings;
}

export function ConfiguraçõesPage() {
  const { toast } = useToast();
  const token = getToken();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pwForm.next !== pwForm.confirm) {
      setPwError("As senhas não coincidem.");
      return;
    }
    if (pwForm.next.length < 6) {
      setPwError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao alterar senha.");
      setPwSuccess(true);
      setPwForm({ current: "", next: "", confirm: "" });
      notify(toast, "password_changed");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleChange = (field: keyof Settings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setSettings((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSaved(true);
      notify(toast, "settings_saved");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      notify(toast, "settings_save_error");
    }
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 mt-1">Informações da empresa e preferências do sistema.</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Company info */}
        <Card className="overflow-hidden">
          <div className="bg-slate-50 border-b p-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-900">Dados da Empresa</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Razão Social / Nome da Empresa</Label>
              <Input
                id="companyName"
                placeholder="Ex: Construtora ABC Ltda."
                value={settings.companyName}
                onChange={handleChange("companyName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCnpj">CNPJ</Label>
              <Input
                id="companyCnpj"
                placeholder="00.000.000/0000-00"
                value={settings.companyCnpj}
                onChange={handleChange("companyCnpj")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Endereço Completo</Label>
              <Input
                id="companyAddress"
                placeholder="Rua, número, bairro, cidade – UF"
                value={settings.companyAddress}
                onChange={handleChange("companyAddress")}
              />
            </div>
          </div>
        </Card>

        {/* Responsible person */}
        <Card className="overflow-hidden">
          <div className="bg-slate-50 border-b p-4 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-900">Responsável Licitações</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="responsibleName">Nome Completo</Label>
              <Input
                id="responsibleName"
                placeholder="Nome do responsável"
                value={settings.responsibleName}
                onChange={handleChange("responsibleName")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="responsibleEmail">E-mail</Label>
                <Input
                  id="responsibleEmail"
                  type="email"
                  placeholder="email@empresa.com"
                  value={settings.responsibleEmail}
                  onChange={handleChange("responsibleEmail")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsiblePhone">Telefone</Label>
                <Input
                  id="responsiblePhone"
                  placeholder="(00) 00000-0000"
                  value={settings.responsiblePhone}
                  onChange={handleChange("responsiblePhone")}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card className="overflow-hidden">
          <div className="bg-slate-50 border-b p-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-900">Observações Gerais</h3>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (aparecem nos relatórios)</Label>
              <Textarea
                id="notes"
                placeholder="Informações adicionais que devem constar nos relatórios gerados..."
                rows={3}
                value={settings.notes}
                onChange={handleChange("notes")}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="gap-2" size="lg">
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvo
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>

        {/* Change password */}
        <Card className="overflow-hidden">
          <div className="bg-slate-50 border-b p-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            <h3 className="font-bold text-slate-900">Alterar Senha</h3>
          </div>
          <div className="p-5">
            {pwError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Senha alterada com sucesso!
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPw">Senha Atual</Label>
                <Input
                  id="currentPw"
                  type="password"
                  placeholder="••••••••"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPw">Nova Senha</Label>
                  <Input
                    id="newPw"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={pwForm.next}
                    onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPw">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    placeholder="Repita a nova senha"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={pwLoading} className="gap-2">
                  {pwLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Alterar Senha
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
