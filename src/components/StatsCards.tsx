import React from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { AgentRecord, ApprovalStatus } from "../types";

interface StatsCardsProps {
  records: AgentRecord[];
  activeFilter?: string;
  onFilterStatus?: (status: string) => void;
  onOpenStatusModal?: (status: ApprovalStatus | "ALL") => void;
  onFilterRetraining?: () => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  records,
  activeFilter = "ALL",
  onFilterStatus,
  onOpenStatusModal,
}) => {
  // Dynamic calculations based exclusively on the current filtered subset of matched agents
  const total = records.length;
  const approved = records.filter((r) => r.status === "Aprobado").length;
  const retakeApproved = records.filter((r) => r.status === "Aprobado" && r.passedInRetake).length;
  const failed = records.filter((r) => r.status === "No Aprobado").length;
  const pending = records.filter(
    (r) => r.status === "Pendiente" || (r.status !== "Aprobado" && r.status !== "No Aprobado")
  ).length;
  const needsRetrainingCount = records.filter((r) => r.needsRetraining).length;

  const totalEvaluated = approved + failed;
  const effectivePassRate = totalEvaluated > 0 ? Math.round((approved / totalEvaluated) * 100) : 0;
  const cohortPassRate = total > 0 ? Math.round((approved / total) * 100) : 0;
  const approvalRate = totalEvaluated > 0 ? effectivePassRate : cohortPassRate;

  const failedRate = totalEvaluated > 0 ? Math.round((failed / totalEvaluated) * 100) : 0;
  const pendingRate = total > 0 ? Math.round((pending / total) * 100) : 0;

  const handleCardClick = (status: ApprovalStatus | "ALL") => {
    if (onOpenStatusModal) {
      onOpenStatusModal(status);
    } else if (onFilterStatus) {
      onFilterStatus(status);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-6">
      {/* 1. Total Agentes (Dinámico por Campaña / Proyecto) */}
      <div
        id="card-total-agents"
        onClick={() => handleCardClick("ALL")}
        className={`group bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
          activeFilter === "ALL"
            ? "border-[#8DA189] ring-2 ring-[#8DA189]/20 bg-[#FBFDFB]"
            : "border-[#D9DED4] hover:border-[#8DA189]"
        }`}
        title="Clic para ver la lista completa de asesores asignados a este proyecto"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#2D332A] flex items-center gap-1.5">
            <span>Total Agentes</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F1F3EE] text-[#4F7A4F] border border-[#C6DEC6]">
              Trainer Seleccionado
            </span>
          </span>
          <div className="h-8 w-8 rounded-xl bg-[#F1F3EE] group-hover:bg-[#E8EDE5] text-[#2D332A] flex items-center justify-center border border-[#D9DED4] transition-colors">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-light text-[#2D332A] tracking-tight">
            {total}
          </span>
          <span className="text-xs text-[#6B7366]">asesores asignados</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#6B7366]">
          <span className="flex items-center gap-1 truncate">
            <Filter className="h-3 w-3 text-[#8DA189] shrink-0" />
            <span>Filtro dinámico (Lista_agentes)</span>
          </span>
          <span className="text-[10px] font-medium text-[#8DA189] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
            Ver <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      {/* 2. Aprobados */}
      <div
        id="card-approved-agents"
        onClick={() => handleCardClick("Aprobado")}
        className={`group bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
          activeFilter === "Aprobado"
            ? "border-[#4F7A4F] ring-2 ring-[#4F7A4F]/20 bg-[#F4F9F4]"
            : "border-[#C6DEC6] hover:border-[#4F7A4F] hover:bg-[#FAFDF9]"
        }`}
        title="Clic para abrir el modal con el listado de agentes Aprobados (≥80 pts)"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#4F7A4F] flex items-center gap-1.5">
            <span>Aprobados</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6]">
              ≥80 pts
            </span>
          </span>
          <div className="h-8 w-8 rounded-xl bg-[#E6F3E6] group-hover:bg-[#DCEDDC] text-[#4F7A4F] flex items-center justify-center border border-[#C6DEC6] transition-colors">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-light text-[#4F7A4F] tracking-tight">
              {approved}
            </span>
            <span className="text-xs font-semibold text-[#4F7A4F]">
              ({approvalRate}%)
            </span>
          </div>
          <span className="text-[10px] font-bold text-[#4F7A4F] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#E6F3E6] px-1.5 py-0.5 rounded border border-[#C6DEC6]">
            Ver lista <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="mt-2.5 w-full bg-[#E8EAE3] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[#4F7A4F] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${approvalRate}%` }}
          ></div>
        </div>
      </div>

      {/* 3. No Aprobados */}
      <div
        id="card-failed-agents"
        onClick={() => handleCardClick("No Aprobado")}
        className={`group bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
          activeFilter === "No Aprobado"
            ? "border-[#9E4A4A] ring-2 ring-[#9E4A4A]/20 bg-[#FDF7F7]"
            : "border-[#F0D5D5] hover:border-[#9E4A4A] hover:bg-[#FDF9F9]"
        }`}
        title="Clic para abrir el modal con el listado de agentes No Aprobados (<80 pts)"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#9E4A4A] flex items-center gap-1.5">
            <span>No Aprobados</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5]">
              &lt;80 pts
            </span>
          </span>
          <div className="h-8 w-8 rounded-xl bg-[#FDF1F1] group-hover:bg-[#FAE8E8] text-[#9E4A4A] flex items-center justify-center border border-[#F0D5D5] transition-colors">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-light text-[#9E4A4A] tracking-tight">
              {failed}
            </span>
            <span className="text-xs font-semibold text-[#9E4A4A]">
              ({failedRate}%)
            </span>
          </div>
          <span className="text-[10px] font-bold text-[#9E4A4A] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#FDF1F1] px-1.5 py-0.5 rounded border border-[#F0D5D5]">
            Ver lista <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] text-[#8C733E]">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{needsRetrainingCount} requieren refuerzo</span>
        </div>
      </div>

      {/* 4. Pendientes (Agentes de la lista sin examen o pendientes de rendir) */}
      <div
        id="card-pending-agents"
        onClick={() => handleCardClick("Pendiente")}
        className={`group bg-white border rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
          activeFilter === "Pendiente"
            ? "border-[#8C733E] ring-2 ring-[#8C733E]/20 bg-[#FDFBF7]"
            : "border-[#EBDDBF] hover:border-[#8C733E] hover:bg-[#FDFCF9]"
        }`}
        title="Clic para abrir el modal con el listado de agentes Pendientes de evaluación"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#8C733E] flex items-center gap-1.5">
            <span>Pendientes</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF]">
              Sin Nota
            </span>
          </span>
          <div className="h-8 w-8 rounded-xl bg-[#FAF5E6] group-hover:bg-[#F5EDD5] text-[#8C733E] flex items-center justify-center border border-[#EBDDBF] transition-colors">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-light text-[#8C733E] tracking-tight">
              {pending}
            </span>
            <span className="text-xs font-semibold text-[#8C733E]">
              ({pendingRate}%)
            </span>
          </div>
          <span className="text-[10px] font-bold text-[#8C733E] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#FAF5E6] px-1.5 py-0.5 rounded border border-[#EBDDBF]">
            Ver lista <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
        <p className="mt-2 text-[11px] text-[#6B7366] truncate">
          {pending > 0 ? `${pending} sin evaluación en planilla` : "Todos evaluados"}
        </p>
      </div>

      {/* 5. Porcentaje de Éxito (Efectividad de la cohorte) */}
      <div
        id="card-success-rate"
        className="bg-white border border-[#D9DED4] rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-xs"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#2D332A] flex items-center gap-1.5">
            <span>Porcentaje de Éxito</span>
          </span>
          <div className="h-8 w-8 rounded-xl bg-[#E6F3E6] text-[#4F7A4F] flex items-center justify-center border border-[#C6DEC6]">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className={`text-2xl sm:text-3xl font-light tracking-tight ${
              approvalRate >= 80
                ? "text-[#4F7A4F]"
                : approvalRate >= 60
                ? "text-[#2D332A]"
                : "text-[#9E4A4A]"
            }`}
          >
            {approvalRate}%
          </span>
          <span className="text-xs text-[#6B7366]">
            ({approved}/{totalEvaluated > 0 ? totalEvaluated : total} {totalEvaluated > 0 && pending > 0 ? "evaluados" : "total"})
          </span>
        </div>
        <div className="mt-2.5 w-full bg-[#E8EAE3] rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              approvalRate >= 80
                ? "bg-[#4F7A4F]"
                : approvalRate >= 60
                ? "bg-[#8DA189]"
                : "bg-[#9E4A4A]"
            }`}
            style={{ width: `${Math.min(100, approvalRate)}%` }}
          ></div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B7366]">
          <span className="truncate">{pending > 0 && totalEvaluated > 0 ? "Sobre evaluados reales" : "Efectividad de la cohorte"}</span>
          {retakeApproved > 0 && (
            <span className="text-[10px] font-semibold text-[#3D704D] bg-[#EBF5EE] px-1.5 py-0.5 rounded border border-[#BDE0C7]">
              +{retakeApproved} recup.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};


