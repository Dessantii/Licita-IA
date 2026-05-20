import { useState, useRef } from "react";
import { UploadCloud, File, X, Loader2, Calendar, AlertTriangle, Clock } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getToken } from "@/hooks/use-auth";

interface FileUploadZoneProps {
  onUpload: (file: Blob) => Promise<void>;
  accept?: string;
  isUploading?: boolean;
  label?: string;
  multiple?: boolean;
}

export function FileUploadZone({ onUpload, accept = ".pdf", isUploading, label = "Clique ou arraste arquivos", multiple = false }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploadingCount(arr.length);
    for (const file of arr) {
      await onUpload(file);
      setUploadingCount(c => Math.max(0, c - 1));
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      await uploadFiles(multiple ? e.dataTransfer.files : [e.dataTransfer.files[0]]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      await uploadFiles(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const busy = isUploading || uploadingCount > 0;

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[160px]",
        isDragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
        busy && "opacity-50 pointer-events-none"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !busy && fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={accept}
        multiple={multiple}
      />
      
      {busy ? (
        <div className="flex flex-col items-center text-primary">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm font-medium">
            {uploadingCount > 1 ? `Enviando ${uploadingCount} arquivo(s)...` : "Enviando arquivo..."}
          </p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-500">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-500 mt-1">
            {multiple ? "PDF até 50MB · vários arquivos de uma vez" : "PDF até 50MB"}
          </p>
        </>
      )}
    </div>
  );
}

function getValidityStatus(dataValidade: string | null | undefined): "expired" | "expiring" | "ok" | "none" {
  if (!dataValidade) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade + "T00:00:00");
  const daysLeft = Math.floor((validade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 30) return "expiring";
  return "ok";
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

interface FileListItemProps {
  file: { id: number; name: string; size: number; dataValidade?: string | null };
  onDelete: (id: number) => void;
  onValidityChange?: (id: number, date: string | null) => void;
}

export function FileListItem({ file, onDelete, onValidityChange }: FileListItemProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localDate, setLocalDate] = useState(file.dataValidade ?? "");
  const token = getToken();

  const status = getValidityStatus(localDate || null);

  async function saveValidity(date: string | null) {
    setSaving(true);
    try {
      await fetch(`/api/files/${file.id}/validity`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dataValidade: date }),
      });
      onValidityChange?.(file.id, date);
    } finally {
      setSaving(false);
      setShowDatePicker(false);
    }
  }

  return (
    <div className="flex flex-col p-3 bg-white border rounded-lg shadow-sm gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-md shrink-0">
            <File className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowDatePicker((v) => !v)}
            title="Definir data de validade"
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors",
              status === "expired"
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : status === "expiring"
                ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                : status === "ok"
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            {status === "expired" && <AlertTriangle className="w-3 h-3" />}
            {status === "expiring" && <Clock className="w-3 h-3" />}
            {status === "ok" && <Calendar className="w-3 h-3" />}
            {status === "none" && <Calendar className="w-3 h-3" />}
            {status === "expired"
              ? "Vencido"
              : status === "expiring"
              ? `Vence ${formatDate(localDate)}`
              : status === "ok"
              ? formatDate(localDate)
              : "Validade"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(file.id)}
            className="shrink-0 text-slate-400 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {showDatePicker && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <label className="text-xs text-slate-500 whitespace-nowrap">Data de validade:</label>
          <input
            type="date"
            value={localDate}
            onChange={(e) => setLocalDate(e.target.value)}
            className="flex-1 text-xs border border-input rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={() => saveValidity(localDate || null)}
            disabled={saving}
            className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
          </button>
          {localDate && (
            <button
              onClick={() => { setLocalDate(""); saveValidity(null); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition"
            >
              Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
