import React from "react";
import {
  X,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  Check,
  UserCheck,
  FileSpreadsheet,
  Briefcase,
} from "lucide-react";
import { AgentRecord, ApprovalStatus } from "../types";

interface AgentDetailModalProps {
  agent: AgentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCertificate: (agent: AgentRecord) => void;
  onToggleStatus: (agentId: string, currentStatus: ApprovalStatus) => void;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  agent,
  isOpen,
  onClose,
  onOpenCertificate,
  onToggleStatus,
}) => {
  if (!isOpen || !agent) return null;

  const isApproved = agent.status === "Aprobado";
  const isFailed = agent.status === "No Aprobado";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-[#D9DED4] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col text-[#2D332A] animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EAE3] flex items-center justify-between bg-[#F9F9F7]">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center border font-semibold text-lg ${
                isApproved
                  ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                  : isFailed
                  ? "bg-[#FDF1F1] text-[#9E4A4A] border-[#F0D5D5]"
                  : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
              }`}
            >
              {agent.agentName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold text-[#2D332A] leading-snug">{agent.agentName}</h2>
                {agent.passedInRetake && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF5EE] text-[#2D6A4F] border border-[#B7E4C7]">
                    <Sparkles className="h-3 w-3 text-[#2D6A4F]" />
                    <span>Aprobado en Recuperatorio</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6B7366]">
                <span>ID: {agent.agentId || "Sin asignar"}</span>
                {agent.campaign && <span>• Campaña: {agent.campaign}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7366] hover:text-[#2D332A] p-1.5 rounded-lg hover:bg-[#F1F3EE] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 max-h-[80vh]">
          {/* Main Status & Score Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
              isApproved
                ? "bg-[#E6F3E6]/50 border-[#C6DEC6]"
                : isFailed
                ? "bg-[#FDF1F1]/50 border-[#F0D5D5]"
                : "bg-[#FAF5E6]/50 border-[#EBDDBF]"
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-[#6B7366] block mb-1">Estado del Trainer:</span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-sans font-black uppercase tracking-wider shadow-sm text-white ${
                    isApproved
                      ? "bg-[#16a34a]"
                      : isFailed
                      ? "bg-[#dc2626]"
                      : "bg-[#d97706]"
                  }`}
                >
                  {isApproved ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : isFailed ? (
                    <XCircle className="h-4 w-4 text-white" />
                  ) : (
                    <Clock className="h-4 w-4 text-white" />
                  )}
                  <span>{agent.status}</span>
                </span>
                <button
                  onClick={() => onToggleStatus(agent.id, agent.status)}
                  className="text-xs text-[#6B7366] hover:text-[#2D332A] underline cursor-pointer"
                >
                  Cambiar estado
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-medium text-[#6B7366] block">Calificación</span>
                <span
                  className={`text-2xl font-bold font-mono ${
                    agent.score !== null && agent.score >= (agent.minPassingScore || 80)
                      ? "text-[#4F7A4F]"
                      : "text-[#9E4A4A]"
                  }`}
                >
                  {agent.score !== null ? agent.score : "N/D"}
                </span>
                <span className="text-[10px] text-[#6B7366] block">/{agent.minPassingScore || 80} min</span>
              </div>

              <div className="text-right border-l border-[#D9DED4] pl-4">
                <span className="text-xs font-medium text-[#6B7366] block">Asistencia</span>
                <span className="text-2xl font-bold font-mono text-[#2D332A]">
                  {agent.attendancePercentage !== undefined && agent.attendancePercentage !== null
                    ? `${agent.attendancePercentage}%`
                    : "100%"}
                </span>
              </div>
            </div>
          </div>

          {/* Individual Questionnaire Scores Breakdown */}
          {(agent.phoneScore !== undefined || agent.digitalScore !== undefined || agent.retakeScore !== undefined) && (
            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EBDDBF] space-y-2">
              <span className="text-xs font-semibold text-[#8C733E] flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Desglose de Cuestionarios Evaluados:</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-white p-2.5 rounded-lg border border-[#E8EAE3] flex items-center justify-between">
                  <span className="text-xs text-[#6B7366]">Test Telefónico:</span>
                  <span className={`text-xs font-bold font-mono ${agent.phoneScore !== null && agent.phoneScore !== undefined ? (agent.phoneScore >= 80 ? 'text-[#4F7A4F]' : 'text-[#9E4A4A]') : 'text-[#8DA189]'}`}>
                    {agent.phoneScore !== null && agent.phoneScore !== undefined ? `${agent.phoneScore} pts` : 'Sin rendir'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E8EAE3] flex items-center justify-between">
                  <span className="text-xs text-[#6B7366]">Test Digital:</span>
                  <span className={`text-xs font-bold font-mono ${agent.digitalScore !== null && agent.digitalScore !== undefined ? (agent.digitalScore >= 80 ? 'text-[#4F7A4F]' : 'text-[#9E4A4A]') : 'text-[#8DA189]'}`}>
                    {agent.digitalScore !== null && agent.digitalScore !== undefined ? `${agent.digitalScore} pts` : 'Sin rendir'}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E8EAE3] flex items-center justify-between">
                  <span className="text-xs text-[#6B7366]">Recuperatorio:</span>
                  <span className={`text-xs font-bold font-mono ${agent.retakeScore !== null && agent.retakeScore !== undefined ? (agent.retakeScore >= 80 ? 'text-[#4F7A4F]' : 'text-[#9E4A4A]') : 'text-[#8DA189]'}`}>
                    {agent.retakeScore !== null && agent.retakeScore !== undefined ? `${agent.retakeScore} pts` : 'No realizado'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F9F9F7] p-4 rounded-xl border border-[#D9DED4] space-y-1">
              <span className="text-[11px] font-semibold text-[#6B7366] flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 text-[#8DA189]" />
                <span>Capacitación / Trainer</span>
              </span>
              <p className="font-semibold text-sm text-[#2D332A]">{agent.trainingName}</p>
              <p className="text-xs text-[#6B7366]">Instructor: Sin Trainer</p>
            </div>

            <div className="bg-[#F9F9F7] p-4 rounded-xl border border-[#D9DED4] space-y-1">
              <span className="text-[11px] font-semibold text-[#6B7366] flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-[#8DA189]" />
                <span>Supervisor & JCC</span>
              </span>
              <p className="font-semibold text-sm text-[#2D332A]">
                {agent.supervisor &&
                agent.supervisor !== "-" &&
                agent.supervisor.toLowerCase() !== "sin supervisor asignado" &&
                agent.supervisor.toLowerCase() !== "sin supervisor" &&
                agent.supervisor.toLowerCase() !== "sin asignar"
                  ? agent.supervisor
                  : "Staff"}
              </p>
              <div className="text-xs text-[#6B7366] space-y-0.5 mt-1">
                <p>Campaña: <span className="text-[#2D332A] font-medium">{agent.campaign || "General"}</span></p>
                {agent.jcc && agent.jcc !== "-" && (
                  <p className="flex items-center gap-1 text-[#2B579A] font-medium">
                    <Briefcase className="h-3 w-3" />
                    <span>
                      {agent.jcc.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "diaz, matias gabriel"
                        ? "CC&T: "
                        : "JCC: "}
                      {agent.jcc}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="bg-[#F9F9F7] p-4 rounded-xl border border-[#D9DED4] space-y-1">
              <span className="text-[11px] font-semibold text-[#6B7366] flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#8DA189]" />
                <span>Fecha de Finalización</span>
              </span>
              <p className="font-semibold text-sm text-[#2D332A]">{agent.completionDate || "No registrada"}</p>
              <p className="text-xs text-[#6B7366]">Archivo: {agent.sourceFileName || "Planilla actual"}</p>
            </div>
          </div>

          {/* Trainer Feedback & Observations */}
          <div className="bg-[#F9F9F7] p-4 rounded-xl border border-[#D9DED4] space-y-2">
            <span className="text-xs font-semibold text-[#2D332A] flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#8DA189]" />
              <span>Observaciones y Feedback del Trainer</span>
            </span>
            <p className="text-xs sm:text-sm text-[#2D332A] leading-relaxed bg-white p-3 rounded-lg border border-[#E8EAE3]">
              {agent.feedback || "Sin comentarios adicionales registrados por el instructor."}
            </p>
          </div>

          {/* Skills Acquired */}
          {agent.skillsAcquired && agent.skillsAcquired.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#6B7366] block">
                Habilidades y Competencias Validadas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {agent.skillsAcquired.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] flex items-center gap-1"
                  >
                    <Check className="h-3.5 w-3.5 text-[#4F7A4F]" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Retraining Alert */}
          {agent.needsRetraining && (
            <div className="p-3.5 bg-[#FAF5E6] border border-[#EBDDBF] rounded-xl flex items-center gap-3 text-xs text-[#8C733E]">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#8C733E]" />
              <div>
                <strong className="block text-[#8C733E]">Re-entrenamiento Recomendado</strong>
                Este agente no superó el puntaje objetivo o tuvo inasistencias. Se aconseja programar una sesión de refuerzo.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F9F9F7] border-t border-[#E8EAE3] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-[#6B7366] hover:text-[#2D332A] rounded-xl hover:bg-[#E8EAE3] transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {isApproved && (
            <button
              onClick={() => {
                onClose();
                onOpenCertificate(agent);
              }}
              className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#8DA189] hover:bg-[#7D9179] text-white shadow-xs transition-all cursor-pointer"
            >
              <Award className="h-4 w-4" />
              <span>Ver Certificado de Aprobación</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
