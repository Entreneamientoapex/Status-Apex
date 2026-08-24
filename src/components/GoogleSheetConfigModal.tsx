import React, { useState } from "react";
import {
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Sparkles,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { GOOGLE_SHEET_URL } from "../utils/googleSheetsConfig";
import {
  testSpreadsheetConnection,
  extractSpreadsheetId,
  SheetConnectionStatus,
} from "../utils/googleSheetsService";

interface GoogleSheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export const GoogleSheetConfigModal: React.FC<GoogleSheetConfigModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [url, setUrl] = useState(GOOGLE_SHEET_URL);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<SheetConnectionStatus | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await testSpreadsheetConnection(url);
      setStatus(res);
    } catch (e: any) {
      setStatus({
        success: false,
        spreadsheetId: extractSpreadsheetId(url),
        needsPermission: true,
        message: e.message || "Error al conectar con Google Sheets.",
        tabCount: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const sheetId = extractSpreadsheetId(url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#D9DED4] overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E8EAE3]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#EAF5EC] border border-[#CCE8D1] text-[#1E7E34] flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2D332A]">Conexión con Google Sheets</h3>
              <p className="text-xs text-[#6B7366]">Base de datos centralizada de capacitaciones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#6B7366] hover:text-[#2D332A] hover:bg-[#F1F3EE] rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4">
          {/* Current URL Box */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1.5">
              Enlace de tu Planilla de Google Sheets:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="flex-1 px-3.5 py-2.5 bg-[#F9FAF8] border border-[#D9DED4] rounded-xl text-xs text-[#2D332A] font-mono focus:outline-none focus:border-[#4F7A4F] transition-colors"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2.5 bg-[#4F7A4F] hover:bg-[#3D633D] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                <span>{testing ? "Probando..." : "Probar"}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#6B7366] mt-1">
              ID extraído: <code className="font-mono text-[#2D332A] bg-[#F1F3EE] px-1.5 py-0.5 rounded">{sheetId || "No detectado"}</code>
            </p>
          </div>

          {/* Test Status Result */}
          {status && (
            <div
              className={`p-3.5 rounded-2xl border ${
                status.success
                  ? "bg-[#EAF5EC] border-[#CCE8D1] text-[#1E7E34]"
                  : "bg-[#FAF5E6] border-[#EBDDBF] text-[#8C733E]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {status.success ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold">
                    {status.success ? "¡Conexión Exitosa con Google Sheets!" : "Acceso Restringido por Google"}
                  </h4>
                  <p className="text-[11px] mt-0.5 leading-relaxed">{status.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions Box: How to make Google Sheet public */}
          <div className="bg-[#F9FAF8] border border-[#D9DED4] rounded-2xl p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-[#8DA189]" />
              <span>¿Cómo configurar los permisos en Google Sheets? (Paso a Paso)</span>
            </h4>
            <ol className="text-xs text-[#6B7366] space-y-2 list-decimal list-inside pl-1">
              <li>
                Abre tu planilla de Google Sheets:{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4F7A4F] font-semibold underline inline-flex items-center gap-0.5 ml-1"
                >
                  Abrir Planilla <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Haz clic en el botón verde <strong className="text-[#2D332A]">"Compartir"</strong> (esquina superior derecha).
              </li>
              <li>
                En la sección <strong className="text-[#2D332A]">"Acceso general"</strong>, cambia de <span className="text-[#9E4A4A]">"Restringido"</span> a <span className="text-[#1E7E34] font-semibold">"Cualquier persona que tenga el vínculo"</span> con rol de <strong className="text-[#2D332A]">"Lector"</strong>.
              </li>
              <li>
                Haz clic en <strong className="text-[#2D332A]">"Listo"</strong> y luego pulsa el botón <strong className="text-[#4F7A4F]">"Probar"</strong> arriba.
              </li>
            </ol>
          </div>

          {/* Column structure guidelines */}
          <div className="p-3 bg-[#EAF5EC]/40 border border-[#CCE8D1] rounded-2xl text-[11px] text-[#2D332A]">
            <p className="font-semibold text-[#1E7E34] mb-1">💡 Columnas admitidas automáticamente en tu hoja:</p>
            <p className="text-[#6B7366]">
              • <strong>ID / Usuario</strong> (ej: U616446) • <strong>Nombre</strong> • <strong>Supervisor</strong> • <strong>Puntaje / Nota</strong> (≥80 aprueba) • <strong>Recuperatorio</strong> • <strong>Asistencia</strong> • <strong>Estado</strong>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E8EAE3]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#6B7366] hover:bg-[#F1F3EE] rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              onRefreshData();
              onClose();
            }}
            className="px-5 py-2 bg-[#4F7A4F] hover:bg-[#3D633D] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sincronizar Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
