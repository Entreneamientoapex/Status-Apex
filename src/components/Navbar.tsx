import React from "react";
import {
  Download,
  Brain,
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
import { ApexMonogram } from "./ApexMonogram";

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
  const rawApprovalRate = totalAgents > 0 ? (approvedCount / totalAgents) * 100 : 0;
  const approvalRate = rawApprovalRate % 1 === 0 ? rawApprovalRate.toString() : rawApprovalRate.toFixed(1);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-white/20 text-[#1e293b] shadow-md">
      <div className="w-full max-w-[1550px] mx-auto px-5">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Brand & Admin Toggle Button */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <ApexMonogram className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0" />
                  <h1 className="text-sm sm:text-lg lg:text-xl font-sans font-extrabold tracking-tight bg-gradient-to-r from-[#f97316] via-[#84cc16]/70 to-[#06b6d4] bg-clip-text text-transparent truncate">
                    Status Apex Soporte
                  </h1>
                </div>

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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            {/* Quick Approval Pill (Visible para todos los usuarios) */}
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-full text-xs shadow-xs font-['Montserrat']">
              <div>
                <span className="text-slate-500 font-medium">Total:</span>{" "}
                <span className="font-bold text-slate-800">{totalAgents}</span>
              </div>
              <div className="h-3.5 w-px bg-slate-300"></div>
              <div>
                <span className="text-slate-500 font-medium">Aprobados:</span>{" "}
                <span className="font-bold text-[#0083a4]">
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
                  className="rounded-full bg-[#0083a4] text-white font-sans font-bold text-sm px-6 py-2.5 flex items-center gap-2 hover:bg-[#006b85] transition-colors border-none shadow-sm cursor-pointer active:scale-95"
                  title="Enviar una nueva solicitud de matriculación para revisión"
                >
                  <UserPlus className="h-4 w-4 text-white shrink-0" />
                  <span className="hidden sm:inline">Enviar Solicitud de Matriculación</span>
                  <span className="sm:hidden">Matriculación</span>
                </button>

                {/* Botón 2: Enviar Feedback de Auditoría */}
                <button
                  id="btn-guest-enviar-feedback"
                  onClick={onOpenGuestFeedback}
                  className="rounded-full bg-[#ea580c] text-white font-sans font-bold text-sm px-6 py-2.5 flex items-center gap-2 hover:bg-[#c2410c] transition-colors border-none shadow-sm cursor-pointer active:scale-95"
                  title="Enviar una nueva devolución o feedback de auditoría"
                >
                  <MessageSquare className="h-4 w-4 text-white shrink-0" />
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
                  className="rounded-full bg-[#0083a4] text-white font-sans font-bold text-sm px-6 py-2.5 flex items-center gap-2 hover:bg-[#006b85] transition-colors border-none shadow-sm cursor-pointer active:scale-95 shrink-0"
                  title="Notificaciones"
                >
                  <span className="text-base leading-none">🔔</span>
                  <span>Notificaciones</span>
                </button>

                {/* Informe IA */}
                <button
                  id="btn-open-ai-report"
                  onClick={onOpenAIReport}
                  className="rounded-full bg-[#16a34a] text-white font-sans font-bold text-sm px-6 py-2.5 flex items-center gap-2 hover:bg-[#115e59] transition-colors border-none shadow-sm cursor-pointer active:scale-95 shrink-0"
                  title="Ver análisis y recomendaciones de IA"
                >
                  <Brain className="h-4 w-4 text-white shrink-0" />
                  <span>Informe IA</span>
                </button>

                {/* Exportar a Excel */}
                <button
                  id="btn-export-excel"
                  onClick={onExportExcel}
                  className="rounded-full bg-[#ea580c] text-white font-sans font-bold text-sm px-6 py-2.5 flex items-center gap-2 hover:bg-[#c2410c] transition-colors border-none shadow-sm cursor-pointer active:scale-95 shrink-0"
                  title="Descargar copia en Excel (.xlsx)"
                >
                  <Download className="h-4 w-4 text-white shrink-0" />
                  <span>Descargar Excel</span>
                </button>

                {/* Enlace directo para abrir la planilla de origen */}
                {GOOGLE_SHEET_URL && (
                  <a
                    id="btn-open-google-sheet"
                    href={GOOGLE_SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-full bg-[#334155] hover:bg-[#1e293b] text-white shadow-sm transition-all cursor-pointer shrink-0"
                    title="Abrir el Google Sheet de origen para editar notas o agregar pestañas"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-white" />
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

