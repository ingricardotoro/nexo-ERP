'use client';

import { useCallback, useRef, useState } from 'react';
import { Download, Upload, X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

interface ImportDuplicate {
  row: number;
  rtn: string;
  legalName: string;
}

interface ContactImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errors: ImportRowError[];
  duplicates: ImportDuplicate[];
  importedIds: string[];
}

interface ImportApiResponse {
  success: boolean;
  data?: ContactImportResult;
  error?: string;
}

type DialogState = 'upload' | 'processing' | 'result';

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContactImportDialog({
  open,
  onOpenChange,
  onImportSuccess,
}: ContactImportDialogProps) {
  const [state, setState] = useState<DialogState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetDialog = () => {
    setState('upload');
    setSelectedFile(null);
    setResult(null);
    setIsDragging(false);
  };

  const handleClose = () => {
    if (state === 'processing') return; // Bloquear cierre durante procesamiento
    resetDialog();
    onOpenChange(false);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Formato inválido', { description: 'Solo se aceptan archivos .xlsx' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Archivo muy grande', { description: 'El archivo supera el límite de 5 MB' });
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []); // handleFileSelect uses only stable setters — safe to omit

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleImport = async () => {
    if (!selectedFile) return;

    setState('processing');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/v1/contacts/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const payload = (await response.json()) as ImportApiResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? 'Error al procesar el archivo');
      }

      setResult(payload.data);
      setState('result');

      if (payload.data.successCount > 0) {
        onImportSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error('Error de importación', { description: message });
      setState('upload');
    }
  };

  const handleImportAnother = () => {
    resetDialog();
  };

  // ── Render: Upload ──────────────────────────────────────────────────────────

  const renderUpload = () => (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivo. Haz clic o arrastra un archivo .xlsx"
        className={[
          'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/30',
        ].join(' ')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <Upload className="text-muted-foreground mx-auto mb-3 h-10 w-10" aria-hidden="true" />
        {selectedFile ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-muted-foreground text-xs">
              {(selectedFile.size / 1024).toFixed(1)} KB — Haz clic para cambiar
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Arrastra un archivo o haz clic para seleccionar</p>
            <p className="text-muted-foreground text-xs">
              Solo archivos .xlsx — máx 5 MB y 500 filas
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Template download */}
      <div className="bg-muted/40 flex items-center justify-between rounded-md px-4 py-3">
        <div>
          <p className="text-sm font-medium">¿No tienes el template?</p>
          <p className="text-muted-foreground text-xs">
            Descarga el archivo con las columnas correctas
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/v1/contacts/import/template" download>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Template
          </a>
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        <Button onClick={handleImport} disabled={!selectedFile}>
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          Importar
        </Button>
      </div>
    </div>
  );

  // ── Render: Processing ──────────────────────────────────────────────────────

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center space-y-4 py-10">
      <div
        className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
        role="status"
        aria-label="Procesando archivo"
      />
      <p className="text-sm font-medium">Importando contactos...</p>
      <p className="text-muted-foreground text-xs">Esto puede tardar unos segundos</p>
    </div>
  );

  // ── Render: Result ──────────────────────────────────────────────────────────

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border bg-green-50 p-3 text-center dark:bg-green-950/20">
            <CheckCircle className="mx-auto mb-1 h-5 w-5 text-green-600" aria-hidden="true" />
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {result.successCount}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">Importados</p>
          </div>
          <div className="rounded-md border bg-red-50 p-3 text-center dark:bg-red-950/20">
            <AlertCircle className="mx-auto mb-1 h-5 w-5 text-red-600" aria-hidden="true" />
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{result.errorCount}</p>
            <p className="text-xs text-red-600 dark:text-red-500">Con errores</p>
          </div>
          <div className="rounded-md border bg-yellow-50 p-3 text-center dark:bg-yellow-950/20">
            <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-yellow-600" aria-hidden="true" />
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {result.duplicateCount}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">Duplicados</p>
          </div>
        </div>

        <p className="text-muted-foreground text-center text-sm">
          {result.totalRows} filas procesadas en total
        </p>

        {/* Error details */}
        {result.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-600">
              Filas con errores ({result.errors.length})
            </p>
            <div className="max-h-36 overflow-y-auto rounded-md border bg-red-50/50 dark:bg-red-950/10">
              <table className="w-full text-xs">
                <thead className="border-b bg-red-100/60 dark:bg-red-900/20">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fila</th>
                    <th className="px-3 py-2 text-left font-medium">Campo</th>
                    <th className="px-3 py-2 text-left font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-xs">
                          {err.row}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{err.field}</td>
                      <td className="text-muted-foreground px-3 py-1.5">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Duplicate details */}
        {result.duplicates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-yellow-600">
              Duplicados omitidos ({result.duplicates.length})
            </p>
            <div className="max-h-28 overflow-y-auto rounded-md border bg-yellow-50/50 dark:bg-yellow-950/10">
              <table className="w-full text-xs">
                <thead className="border-b bg-yellow-100/60 dark:bg-yellow-900/20">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fila</th>
                    <th className="px-3 py-2 text-left font-medium">RTN</th>
                    <th className="px-3 py-2 text-left font-medium">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {result.duplicates.map((dup, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-xs">
                          {dup.row}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 font-mono">{dup.rtn}</td>
                      <td className="text-muted-foreground px-3 py-1.5">{dup.legalName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleImportAnother}>
            Importar otro archivo
          </Button>
          <Button onClick={handleClose}>
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Cerrar
          </Button>
        </div>
      </div>
    );
  };

  // ── Dialog ──────────────────────────────────────────────────────────────────

  const titleMap: Record<DialogState, string> = {
    upload: 'Importar Contactos desde Excel',
    processing: 'Procesando archivo...',
    result: 'Resultado de la importación',
  };

  const descriptionMap: Record<DialogState, string> = {
    upload: 'Carga un archivo .xlsx con tus contactos. Máximo 500 registros por importación.',
    processing: 'Por favor espera mientras procesamos tu archivo.',
    result: 'Resumen de los contactos procesados.',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titleMap[state]}</DialogTitle>
          <DialogDescription>{descriptionMap[state]}</DialogDescription>
        </DialogHeader>

        {state === 'upload' && renderUpload()}
        {state === 'processing' && renderProcessing()}
        {state === 'result' && renderResult()}
      </DialogContent>
    </Dialog>
  );
}
