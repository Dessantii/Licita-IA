import { useState, useRef } from "react";
import { UploadCloud, File, X, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileUploadZoneProps {
  onUpload: (file: Blob) => Promise<void>;
  accept?: string;
  isUploading?: boolean;
  label?: string;
}

export function FileUploadZone({ onUpload, accept = ".pdf", isUploading, label = "Clique ou arraste um arquivo" }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onUpload(e.target.files[0]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[160px]",
        isDragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
        isUploading && "opacity-50 pointer-events-none"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={accept}
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center text-primary">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm font-medium">Enviando arquivo...</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-500">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-500 mt-1">PDF até 50MB</p>
        </>
      )}
    </div>
  );
}

export function FileListItem({ file, onDelete }: { file: { id: number, name: string, size: number }, onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-md shrink-0">
          <File className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onDelete(file.id)} className="shrink-0 text-slate-400 hover:text-destructive">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
