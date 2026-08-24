import React from "react";
import {
  Download,
  Brain,
  GraduationCap,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  ExternalLink,
  Settings,
  ShieldCheck,
  UserPlus,
  MessageSquare,
} from "lucide-react";
import { GOOGLE_SHEET_URL } from "../utils/googleSheetsConfig";

interface NavbarProps {
  onOpenAIReport: () => void;
  onExportExcel: () => void;
  onRefreshSheets: () => void;
  onOpenConfigModal: () => void;
  onOpenAdminModal: () => void;
  onMatriculacion?: () => void;
  onOpenNotifications?: () => void;
  onOpenGuestMatriculacion?: () => void;
  onOpenGuestFeedback?: () => void;
  isAdmin: boolean;
  isLoading: boolean;
  totalAgents: number;
  approvedCount: number;
  activeSheetName?: string;
  isLiveConnection?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAIReport,
  onExportExcel,
  onRefreshSheets,
  onOpenConfigModal,
  onOpenAdminModal,
  onMatriculacion,
  onOpenNotifications,
  onOpenGuestMatriculacion,
  onOpenGuestFeedback,
  isAdmin,
  isLoading,
  totalAgents,
  approvedCount,
  activeSheetName,
  isLiveConnection = false,
}) => {
  const approvalRate = totalAgents > 0 ? Math.round((approvedCount / totalAgents) * 100) : 0;

  return (
    <header className="sticky top-0 z-30 bg-[#F9F9F7]/95 backdrop-blur border-b border-[#D9DED4] text-[#2D332A] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Brand, Logo & Admin Toggle Button */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-[#8DA189] flex items-center justify-center shadow-sm text-white shrink-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight text-[#2D332A] truncate">
                  Status Apex Soporte
                </h1>

                {/* BOTÓN EN EL NAVBAR: Ingresar Modo Admin / Indicador Admin */}
                <button
                  id="btn-navbar-admin-toggle"
                  onClick={onOpenAdminModal}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer border shrink-0 ${
                    isAdmin
                      ? "bg-[#EAF5EC] hover:bg-[#D5ECD9] text-[#1E7E34] border-[#CCE8D1]"
                      : "bg-[#2D332A] hover:bg-[#1F241D] text-white border-[#2D332A]"
                  }`}
                  title={
                    isAdmin
                      ? "Sesión de Administrador activa. Haz clic para ver opciones o cerrar sesión."
                      : "Ingresar como Trainer Administrador"
                  }
                >
                  <ShieldCheck className={`h-4 w-4 ${isAdmin ? "text-[#1E7E34]" : "text-[#8DA189]"}`} />
                  <span>{isAdmin ? "Modo Admin Activo" : "Ingresar Modo Admin"}</span>
                </button>

                <span
                  className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                    isLiveConnection
                      ? "bg-[#EAF5EC] text-[#1E7E34] border-[#CCE8D1]"
                      : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {isLiveConnection ? "Google Sheets Live" : "Google Sheets Sync"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#6B7366] truncate max-w-[200px] sm:max-w-md mt-0.5">
                {activeSheetName
                  ? `Calificaciones y Progreso del Equipo: ${activeSheetName} • Instructor: Sin Trainer`
                  : "Calificaciones y Progreso del Equipo: Google Sheets • Instructor: Sin Trainer"}
              </p>
            </div>
          </div>

          {/* Actions & Live Stats */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Quick Approval Pill (Visible para todos los usuarios) */}
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white border border-[#D9DED4] rounded-xl text-xs shadow-2xs">
              <div>
                <span className="text-[#6B7366]">Total:</span>{" "}
                <span className="font-semibold text-[#2D332A]">{totalAgents}</span>
              </div>
              <div className="h-3.5 w-px bg-[#D9DED4]"></div>
              <div>
                <span className="text-[#6B7366]">Aprobados:</span>{" "}
                <span className="font-semibold text-[#4F7A4F]">
                  {approvedCount} ({approvalRate}%)
                </span>
              </div>
            </div>

            {/* BOTONES EXCLUSIVOS DE MODO INVITADO (cuando isAdmin === false) */}
            {!isAdmin && (
              <>
                {/* Botón 1: Enviar Solicitud de Matriculación */}
                <button
                  id="btn-guest-solicitud-matriculacion"
                  onClick={onOpenGuestMatriculacion}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Enviar una nueva solicitud de matriculación para revisión"
                >
                  <UserPlus className="h-3.5 w-3.5 text-[#4F7A4F]" />
                  <span className="hidden sm:inline">Enviar Solicitud de Matriculación</span>
                  <span className="sm:hidden">Matriculación</span>
                </button>

                {/* Botón 2: Enviar Feedback de Auditoría */}
                <button
                  id="btn-guest-enviar-feedback"
                  onClick={onOpenGuestFeedback}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] transition-all shadow-2xs cursor-pointer active:scale-95"
                  title="Enviar una nueva devolución o feedback de auditoría"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#2563EB]" />
                  <span className="hidden sm:inline">Enviar Feedback de Auditoría</span>
                  <span className="sm:hidden">Feedback</span>
                </button>
              </>
            )}

            {/* BOTONES EXCLUSIVOS DE ADMINISTRADOR: Visibles ÚNICAMENTE si isAdmin === true */}
            {isAdmin && (
              <>
                {/* Botón de Notificaciones */}
                <button
                  id="btn-navbar-notificaciones"
                  onClick={onOpenNotifications}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                  title="Notificaciones"
                >
                  <span className="w-4 h-4 inline-block">🔔</span> Notificaciones
                </button>

                {/* Informe IA */}
                <button
                  id="btn-open-ai-report"
                  onClick={onOpenAIReport}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-xl bg-[#E8EAE3] text-[#2D332A] hover:bg-[#D9DED4] border border-[#D9DED4] transition-colors shadow-2xs cursor-pointer"
                  title="Ver análisis y recomendaciones de IA"
                >
                  <Brain className="h-3.5 w-3.5 text-[#4F7A4F]" />
                  <span className="hidden sm:inline">Informe IA</span>
                </button>

                {/* Exportar a Excel */}
                <button
                  id="btn-export-excel"
                  onClick={onExportExcel}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-colors shadow-2xs cursor-pointer"
                  title="Descargar copia en Excel (.xlsx)"
                >
                  <Download className="h-3.5 w-3.5 text-[#8DA189]" />
                  <span className="hidden md:inline">Descargar Excel</span>
                </button>

                {/* Enlace directo para abrir la planilla de origen */}
                {GOOGLE_SHEET_URL && (
                  <a
                    id="btn-open-google-sheet"
                    href={GOOGLE_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-[#4F7A4F] hover:bg-[#3D633D] text-white shadow-2xs transition-all cursor-pointer"
                    title="Abrir el Google Sheet de origen para editar notas o agregar pestañas"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Abrir Sheet</span>
                    <ExternalLink className="h-3 w-3 opacity-80" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

