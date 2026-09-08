import React, { useState, useEffect } from "react";
import {
  History,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Users,
  CheckSquare,
  Square,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  SheetAnalysisRecord,
  formatTabTimestamp,
  extractProjectCode,
} from "../utils/googleSheetsService";

/**
 * Obtiene la fecha de modificación guardada en LocalStorage para un curso dado.
 * Clave: 'lastMod_<codigo_curso>' (ej: 'lastMod_CD2641')
 */
export function getStoredCourseModificationTime(courseCode: string): string | null {
  if (!courseCode) return null;
  try {
    const key = `lastMod_${courseCode.trim().toUpperCase()}`;
    const val = localStorage.getItem(key);
    return val && val.trim() !== "" ? val.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Guarda inmediatamente la fecha y hora de modificación en LocalStorage para un curso.
 */
export function setStoredCourseModificationTime(
  courseCode: string,
  formattedDate: string,
  isoDate?: string
): void {
  if (!courseCode || !formattedDate) return;
  try {
    const key = `lastMod_${courseCode.trim().toUpperCase()}`;
    localStorage.setItem(key, formattedDate.trim());
    if (isoDate) {
      localStorage.setItem(`lastModISO_${courseCode.trim().toUpperCase()}`, isoDate.trim());
    }
  } catch {}
}

// 1. FUNCIÓN PARA FORMATEAR LA FECHA (Formato idéntico a tu imagen: DD/MM/AAAA HH:MM)
export const formatTimestamp = (date: any): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "08/09/2026 09:31";
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 2. COMPONENTE DE LA TARJETA DEL CURSO (Ejemplo con CD2641 o CD2633)
export interface TarjetaCursoProps {
  cursoId: string;
  titulo: string;
  totalAgentes: number;
  aprobados: number;
}

export const TarjetaCurso: React.FC<TarjetaCursoProps> = ({ cursoId, titulo, totalAgentes, aprobados }) => {
  // Inicializa el estado leyendo DIRECTAMENTE de LocalStorage para que no cambie al recargar
  const [lastModified, setLastModified] = useState(() => {
    const savedDate = localStorage.getItem(`lastMod_${cursoId}`);
    return savedDate ? savedDate : "08/09/2026 09:31"; // Tu hora base por si no hay registro
  });

  // 3. FUNCIÓN QUE LLAMA TU CENTINELA CADA 10 SEGUNDOS
  const verificarCambiosSheet = async () => {
    try {
      // Llamada simulada a tu API del Sheet o Drive
      const response = await fetch(`/api/sheet-metadata?id=${cursoId}`);
      if (!response.ok) return;
      const data = await response.json(); 
      
      // 'data.modifiedTime' es la fecha real de edición del archivo en Google Drive
      if (data && data.modifiedTime) {
        const nuevaFechaFormateada = formatTimestamp(data.modifiedTime);
        const fechaGuardada = localStorage.getItem(`lastMod_${cursoId}`);

        // SOLO si la fecha de modificación del archivo cambió en Google, actualizamos la pantalla y el storage
        if (nuevaFechaFormateada !== fechaGuardada) {
          localStorage.setItem(`lastMod_${cursoId}`, nuevaFechaFormateada);
          setLastModified(nuevaFechaFormateada);
        }
      }
    } catch (error) {
      console.error("Error al consultar el centinela:", error);
    }
  };

  // Activa el intervalo del centinela de 10 segundos
  useEffect(() => {
    verificarCambiosSheet(); // Consulta inicial
    const interval = setInterval(verificarCambiosSheet, 10000); // Cada 10s
    return () => clearInterval(interval);
  }, [cursoId]);

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm space-y-3">
      {/* Encabezado del curso */}
      <div className="flex items-center space-x-2">
        <input type="checkbox" className="rounded text-emerald-600" />
        <span className="font-bold text-slate-800 text-sm">{cursoId} | {titulo}</span>
      </div>
      
      {/* Icono de reloj e indicador de fecha FIJA */}
      <div className="flex items-center space-x-1.5 text-xs text-slate-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{lastModified}</span> 
      </div>

      {/* Contadores inferiores */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="border p-1 px-2 rounded bg-slate-50 text-slate-600 font-medium">👥 {totalAgentes} staff</span>
        <span className="bg-emerald-600 text-white font-bold p-1 px-3 rounded-full">APROBADOS ({aprobados})</span>
      </div>
    </div>
  );
};

interface CourseHistoryCardItemProps {
  item: SheetAnalysisRecord;
  isActive: boolean;
  isChecked: boolean;
  isTestInactive: boolean;
  isTogglingCurrent: boolean;
  isAdmin: boolean;
  onSelectAnalysis: (analysis: SheetAnalysisRecord) => void;
  onToggleSelectTest?: (id: string, e?: React.MouseEvent) => void;
  onToggleTestStatus?: (analysis: SheetAnalysisRecord) => void;
}

export const CourseHistoryCardItem: React.FC<CourseHistoryCardItemProps> = ({
  item,
  isActive,
  isChecked,
  isTestInactive,
  isTogglingCurrent,
  isAdmin,
  onSelectAnalysis,
  onToggleSelectTest,
  onToggleTestStatus,
}) => {
  // 1. Identificador único para LocalStorage basado en el código del curso (ej: CD2641, CD2633)
  const cursoId = (
    item.projectCode ||
    extractProjectCode(item.name || item.sheetName) ||
    "DEFAULT"
  ).trim().toUpperCase();

  // 2. Inicializa el estado leyendo DIRECTAMENTE de LocalStorage para que no cambie al recargar
  const [lastModified, setLastModified] = useState(() => {
    const savedDate = localStorage.getItem(`lastMod_${cursoId}`);
    return savedDate ? savedDate : "08/09/2026 09:31"; // Tu hora base por si no hay registro
  });

  // 3. FUNCIÓN QUE LLAMA TU CENTINELA CADA 10 SEGUNDOS
  const verificarCambiosSheet = async () => {
    try {
      // Llamada a tu API del Sheet o Drive
      const response = await fetch(`/api/sheet-metadata?id=${cursoId}`);
      if (!response.ok) return;
      const data = await response.json(); 
      
      // 'data.modifiedTime' es la fecha real de edición del archivo en Google Drive
      if (data && data.modifiedTime) {
        const nuevaFechaFormateada = formatTimestamp(data.modifiedTime);
        const fechaGuardada = localStorage.getItem(`lastMod_${cursoId}`);

        // SOLO si la fecha de modificación del archivo cambió en Google, actualizamos la pantalla y el storage
        if (nuevaFechaFormateada !== fechaGuardada) {
          localStorage.setItem(`lastMod_${cursoId}`, nuevaFechaFormateada);
          setLastModified(nuevaFechaFormateada);
        }
      }
    } catch (error) {
      console.error("Error al consultar el centinela:", error);
    }
  };

  // Activa el intervalo del centinela de 10 segundos
  useEffect(() => {
    verificarCambiosSheet(); // Consulta inicial
    const interval = setInterval(verificarCambiosSheet, 10000); // Cada 10s
    return () => clearInterval(interval);
  }, [cursoId]);

  // Sincronización secundaria en caso de recibir actualización desde props o eventos globales
  useEffect(() => {
    if (item.lastModifiedInSheet && item.lastModifiedInSheet.trim() !== "") {
      const fechaGuardada = localStorage.getItem(`lastMod_${cursoId}`);
      if (!fechaGuardada) {
        localStorage.setItem(`lastMod_${cursoId}`, item.lastModifiedInSheet);
        setLastModified(item.lastModifiedInSheet);
      } else if (item.lastModifiedInSheet !== fechaGuardada && item.lastModifiedInSheetISO) {
        const storedISO = localStorage.getItem(`lastModISO_${cursoId}`);
        if (item.lastModifiedInSheetISO !== storedISO) {
          localStorage.setItem(`lastMod_${cursoId}`, item.lastModifiedInSheet);
          localStorage.setItem(`lastModISO_${cursoId}`, item.lastModifiedInSheetISO);
          setLastModified(item.lastModifiedInSheet);
        }
      }
    }
  }, [item.lastModifiedInSheet, item.lastModifiedInSheetISO, cursoId]);

  useEffect(() => {
    const handleSyncEvent = (e: Event) => {
      const customEv = e as CustomEvent<{ courseCode?: string; formattedDate?: string }>;
      if (
        customEv.detail &&
        customEv.detail.courseCode === cursoId &&
        customEv.detail.formattedDate
      ) {
        setLastModified(customEv.detail.formattedDate);
      } else {
        const savedDate = localStorage.getItem(`lastMod_${cursoId}`);
        if (savedDate && savedDate !== lastModified) {
          setLastModified(savedDate);
        }
      }
    };

    window.addEventListener("apex_course_date_updated", handleSyncEvent);
    return () => {
      window.removeEventListener("apex_course_date_updated", handleSyncEvent);
    };
  }, [cursoId, lastModified]);

  return (
    <div
      onClick={() => onSelectAnalysis(item)}
      className={`pt-2 first:pt-0 group relative p-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
        isActive
          ? "bg-[#E6F3E6]/70 border-[#4F7A4F] shadow-2xs"
          : isChecked
          ? "bg-[#F0F5F0] border-[#A8C6A8]"
          : "bg-[#F9FAF8] hover:bg-[#F1F3EE] border-transparent hover:border-[#D9DED4]"
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        {/* Checkbox Selector for multi-test consolidated metrics */}
        {onToggleSelectTest && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelectTest(item.id, e);
            }}
            className="pt-0.5 shrink-0 cursor-pointer"
            title={
              isChecked
                ? "Deseleccionar evaluación de métricas"
                : "Marcar para consolidar en métricas"
            }
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelectTest(item.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-[#B3C2AF] text-[#4F7A4F] focus:ring-[#4F7A4F] cursor-pointer accent-[#4F7A4F]"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`font-sans font-bold text-sm tracking-normal transition-colors truncate ${
                isActive
                  ? "text-[#244624]"
                  : isChecked
                  ? "text-[#1E4D1E]"
                  : "text-slate-900 group-hover:text-[#4F7A4F]"
              }`}
            >
              {item.name}
            </span>

            {/* Estado Centralizado en Google Sheets (Activo / No Activo) */}
            {isTestInactive ? (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FCE8E6] text-[#A52A2A] border border-[#F5C2BE]"
                title="Evaluación No Activa (Centralizada en Config_Usuarios)"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#C53030]" /> No Activo
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E6F3E6] text-[#2E6B2E] border border-[#C6DEC6]"
                title="Evaluación Activa (Centralizada en Config_Usuarios)"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B7A3B]" /> Activo
              </span>
            )}

            {/* Indicador de selección activa en pantalla */}
            {isActive && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#2D332A] text-white">
                <CheckCircle2 className="h-2.5 w-2.5" /> En Pantalla
              </span>
            )}

            {isChecked && !isActive && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#3B6E3B] text-white">
                ✓ Marcado
              </span>
            )}

            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-medium text-[#1E7E34] bg-[#EAF5EC] px-1.5 py-0.2 rounded border border-[#CCE8D1]"
              title="Pestaña de Google Sheets"
            >
              <FileSpreadsheet className="h-2.5 w-2.5" /> Sheet
            </span>
          </div>

          {/* Date and Time extracted or fetched - 100% FIJA Y PERSISTENTE EN LOCALSTORAGE */}
          <div className="text-slate-400 text-xs font-sans flex items-center gap-1.5 mt-1">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span title={`Última modificación persistente de ${cursoId}`}>
              {lastModified}
            </span>
          </div>

          {/* Metric Badges & Admin Status Switch */}
          <div className="flex items-center gap-2 text-xs text-slate-700 mt-1.5 flex-wrap font-sans">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#D9DED4] font-bold text-slate-800">
              <Users className="h-3 w-3 text-slate-500" />
              {item.totalAgents}{" "}
              {(item.name || "").toLowerCase().includes("(para supervisor)") ||
              (item.name || "").toLowerCase().includes("para supervisor") ||
              (item.sheetName || "").toLowerCase().includes("(para supervisor)") ||
              (item.trainingTopic || "").toLowerCase().includes("(para supervisor)")
                ? "staff"
                : "agentes"}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-sans font-black uppercase text-[11px] shadow-sm text-white ${
                item.passRate >= 80
                  ? "bg-[#16a34a]"
                  : item.passRate >= 40
                  ? "bg-[#d97706]"
                  : "bg-[#dc2626]"
              }`}
            >
              aprobados ({item.approvedCount})
            </span>

            {/* Interruptor discreto de Estado en Modo Administrador */}
            {isAdmin && onToggleTestStatus && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTestStatus(item);
                }}
                disabled={isTogglingCurrent}
                className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer shadow-2xs ${
                  isTestInactive
                    ? "bg-white hover:bg-[#E6F3E6] text-[#2E6B2E] border-[#C6DEC6]"
                    : "bg-white hover:bg-[#FCE8E6] text-[#A52A2A] border-[#F5C2BE]"
                } disabled:opacity-50`}
                title={`Hacé clic para cambiar el estado de "${item.name}" en Google Sheets`}
              >
                {isTogglingCurrent ? (
                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                ) : isTestInactive ? (
                  <ToggleLeft className="h-3 w-3 text-[#C53030]" />
                ) : (
                  <ToggleRight className="h-3 w-3 text-[#2E6B2E]" />
                )}
                <span>{isTogglingCurrent ? "Guardando..." : "Alternar Estado"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Actions & Chevron */}
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              isActive
                ? "text-[#4F7A4F] translate-x-0.5"
                : "text-[#6B7366] group-hover:translate-x-0.5"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

interface AnalysisHistoryCardProps {
  history: SheetAnalysisRecord[];
  activeAnalysisId: string | null;
  isLoading: boolean;
  onSelectAnalysis: (analysis: SheetAnalysisRecord) => void;
  onRefreshSheets: () => void;
  isAdmin?: boolean;
  selectedTestIds?: string[];
  onToggleSelectTest?: (id: string, e?: React.MouseEvent) => void;
  onSelectAllTests?: () => void;
  onToggleTestStatus?: (analysis: SheetAnalysisRecord) => void;
  togglingTestId?: string | null;
}

export const AnalysisHistoryCard: React.FC<AnalysisHistoryCardProps> = ({
  history,
  activeAnalysisId,
  isLoading,
  onSelectAnalysis,
  onRefreshSheets,
  isAdmin = false,
  selectedTestIds = [],
  onToggleSelectTest,
  onSelectAllTests,
  onToggleTestStatus,
  togglingTestId = null,
}) => {
  const allSelected = history.length > 0 && selectedTestIds.length === history.length;
  const someSelected = selectedTestIds.length > 0;

  return (
    <div
      style={{ boxShadow: '0 25px 60px rgba(0, 0, 0, 0.22)', border: 'none', background: '#ffffff' }}
      className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#E6F3E6] border border-[#C6DEC6] flex items-center justify-center text-[#4F7A4F]">
              <History className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-['Montserrat'] font-sans font-extrabold text-[#334155] text-base tracking-tight">
                Cursos Pendientes
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F3EE] text-slate-600 border border-[#D9DED4]">
                {history.length} {history.length === 1 ? "test" : "tests / hojas"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefreshSheets}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#4F7A4F] bg-[#E6F3E6] hover:bg-[#D2EBD2] rounded-lg border border-[#C6DEC6] transition-colors cursor-pointer disabled:opacity-50"
              title="Sincronizar pestañas desde Google Sheets"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Subheader with Multi-Select Controls */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <p className="text-[11px] font-medium text-slate-600 leading-tight flex-1">
            {someSelected
              ? `Consolidando ${selectedTestIds.length} de ${history.length} evaluaciones:`
              : "Marca casilleros para consolidar tests o haz clic en uno:"}
          </p>

          {history.length > 0 && onSelectAllTests && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAllTests();
              }}
              className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F1F3EE] hover:bg-[#E5E9E2] text-[#2D332A] border border-[#D9DED4] transition-colors flex items-center gap-1 cursor-pointer"
              title={allSelected ? "Deseleccionar todas las evaluaciones" : "Seleccionar todas las evaluaciones"}
            >
              {allSelected ? (
                <>
                  <Square className="h-3 w-3 text-[#6B7366]" />
                  <span>Deseleccionar</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3 w-3 text-[#4F7A4F]" />
                  <span>Todos ({selectedTestIds.length > 0 ? selectedTestIds.length : history.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* List of Analyses (Tabs from Google Sheet) */}
        <div className="space-y-2 overflow-y-auto max-h-56 pr-1 divide-y divide-[#F1F3EE]">
          {history.map((item) => {
            const isActive = activeAnalysisId === item.id || activeAnalysisId === item.sheetName;
            const isChecked = selectedTestIds.includes(item.id);
            const isTestInactive = item.testStatus === "No Activo";
            const isTogglingCurrent = togglingTestId === item.id;

            return (
              <CourseHistoryCardItem
                key={item.id}
                item={item}
                isActive={isActive}
                isChecked={isChecked}
                isTestInactive={isTestInactive}
                isTogglingCurrent={isTogglingCurrent}
                isAdmin={isAdmin}
                onSelectAnalysis={onSelectAnalysis}
                onToggleSelectTest={onToggleSelectTest}
                onToggleTestStatus={onToggleTestStatus}
              />
            );
          })}

          {history.length === 0 && (
            <div className="text-center py-6 px-2 bg-[#F9FAF8] rounded-xl border border-dashed border-[#D9DED4]">
              <Calendar className="h-7 w-7 text-[#8DA189] mx-auto mb-1.5 opacity-60" />
              <p className="text-xs font-semibold text-[#2D332A]">Conectando con Google Sheets...</p>
              <p className="text-[11px] text-[#6B7366] mt-0.5">
                Cargando las pestañas disponibles del documento centralizado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

