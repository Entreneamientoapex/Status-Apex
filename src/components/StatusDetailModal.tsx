import React, { useState, useMemo } from "react";
import {
  X,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Copy,
  Check,
  Download,
  Eye,
  Filter,
  Sparkles,
  RefreshCw,
  Award,
} from "lucide-react";
import { AgentRecord, ApprovalStatus } from "../types";
import { exportAgentsToExcel } from "../utils/excelParser";

interface StatusDetailModalProps {
  status: ApprovalStatus | "ALL" | null;
  records: AgentRecord[];
  onClose: () => void;
  onSelectAgent: (agent: AgentRecord) => void;
  onApplyTableFilter: (status: string) => void;
}

export const StatusDetailModal: React.FC<StatusDetailModalProps> = ({
  status,
  records,
  onClose,
  onSelectAgent,
  onApplyTableFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [instanceFilter, setInstanceFilter] = useState<"ALL" | "FIRST" | "RETAKE">("ALL");

  // Filter records by selected status (unconditional hook)
  const statusRecords = useMemo(() => {
    if (!status || status === "ALL") return records;
    if (status === "Aprobado") {
      return records.filter((r) => r.status === "Aprobado" || (typeof r.score === "number" && !isNaN(r.score) && r.score >= 80));
    }
    if (status === "No Aprobado") {
      return records.filter((r) => r.status === "No Aprobado" || (typeof r.score === "number" && !isNaN(r.score) && r.score < 80 && r.score >= 0));
    }
    if (status === "Pendiente") {
      return records.filter((r) => {
        const hasScore = typeof r.score === "number" && !isNaN(r.score);
        if (r.status === "Pendiente") return true;
        if (!hasScore && r.status !== "Aprobado" && r.status !== "No Aprobado") return true;
        return false;
      });
    }
    return records.filter((r) => r.status === status);
  }, [records, status]);

  // Sub-counts for Aprobados
  const retakeCount = useMemo(() => {
    return statusRecords.filter((r) => r.passedInRetake).length;
  }, [statusRecords]);

  const firstInstanceCount = useMemo(() => {
    return statusRecords.filter((r) => !r.passedInRetake).length;
  }, [statusRecords]);

  // Search and subfilter within status records (unconditional hook)
  const filteredList = useMemo(() => {
    let list = statusRecords;

    // Apply instance filter if in Aprobado view
    if (status === "Aprobado" && instanceFilter !== "ALL") {
      if (instanceFilter === "RETAKE") {
        list = list.filter((r) => r.passedInRetake);
      } else if (instanceFilter === "FIRST") {
        list = list.filter((r) => !r.passedInRetake);
      }
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (r) =>
        (r.agentId && r.agentId.toLowerCase().includes(q)) ||
        r.agentName.toLowerCase().includes(q) ||
        (r.campaign && r.campaign.toLowerCase().includes(q)) ||
        (r.trainerName && r.trainerName.toLowerCase().includes(q)) ||
        (r.feedback && r.feedback.toLowerCase().includes(q)) ||
        (r.retakeDetails && r.retakeDetails.toLowerCase().includes(q))
    );
  }, [statusRecords, searchQuery, status, instanceFilter]);

  if (!status) return null;

  // Copy IDs to clipboard
  const handleCopyIds = () => {
    const ids = filteredList.map((r) => r.agentId).filter(Boolean).join(", ");
    navigator.clipboard.writeText(ids);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Export filtered subset
  const handleExportSubset = () => {
    exportAgentsToExcel(filteredList, {
      topic: `Agentes ${status}${instanceFilter === "RETAKE" ? " (Recuperatorios)" : ""}`,
      trainer: statusRecords[0]?.trainerName || "Apex America",
    });
  };

  // Status configuration details
  const config = {
    Aprobado: {
      title: "Agentes Aprobados",
      subtitle: "Asesores que alcanzaron o superaron los 80 pts en la evaluación principal o en recuperatorio (Col. V/W)",
      badgeBg: "bg-[#E6F3E6]",
      badgeText: "text-[#4F7A4F]",
      badgeBorder: "border-[#C6DEC6]",
      icon: CheckCircle2,
      accentColor: "#4F7A4F",
      cardBorder: "border-[#C6DEC6]",
    },
    "No Aprobado": {
      title: "Agentes No Aprobados",
      subtitle: "Asesores con calificación menor a 80 pts en todas las instancias evaluadas que requieren refuerzo",
      badgeBg: "bg-[#FDF1F1]",
      badgeText: "text-[#9E4A4A]",
      badgeBorder: "border-[#F0D5D5]",
      icon: XCircle,
      accentColor: "#9E4A4A",
      cardBorder: "border-[#F0D5D5]",
    },
    Pendiente: {
      title: "Agentes Pendientes de Evaluación",
      subtitle: "Asesores de la nómina que aún no cuentan con registro de examen en la planilla del curso",
      badgeBg: "bg-[#FAF5E6]",
      badgeText: "text-[#8C733E]",
      badgeBorder: "border-[#EBDDBF]",
      icon: Clock,
      accentColor: "#8C733E",
      cardBorder: "border-[#EBDDBF]",
    },
    ALL: {
      title: "Total de Agentes Coincidentes",
      subtitle: "Nómina completa de agentes que forman parte del subconjunto de IDs filtrado",
      badgeBg: "bg-[#F1F3EE]",
      badgeText: "text-[#2D332A]",
      badgeBorder: "border-[#D9DED4]",
      icon: Users,
      accentColor: "#2D332A",
      cardBorder: "border-[#D9DED4]",
    },
  }[status] || {
    title: `Agentes (${status})`,
    subtitle: "Lista filtrada por estado",
    badgeBg: "bg-[#F1F3EE]",
    badgeText: "text-[#2D332A]",
    badgeBorder: "border-[#D9DED4]",
    icon: Users,
    accentColor: "#2D332A",
    cardBorder: "border-[#D9DED4]",
  };

  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white border border-[#D9DED4] rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#D9DED4] bg-[#F9F9F7] flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center border shadow-xs shrink-0 ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
            >
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-[#2D332A] tracking-tight">
                  {config.title}
                </h2>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
                >
                  {statusRecords.length} {statusRecords.length === 1 ? "agente" : "agentes"}
                </span>
                {status === "Aprobado" && retakeCount > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF5EE] text-[#3D704D] border border-[#BDE0C7] flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {retakeCount} en recuperatorio
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#6B7366] mt-1 leading-relaxed">
                {config.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#6B7366] hover:text-[#2D332A] hover:bg-black/5 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Cerrar ventana"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Subfilter Pills (only for Aprobado status) */}
        {status === "Aprobado" && retakeCount > 0 && (
          <div className="px-5 sm:px-6 py-2.5 bg-[#F9F9F7] border-b border-[#E8EAE3] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#6B7366] font-medium mr-1">Instancia:</span>
              <button
                onClick={() => setInstanceFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  instanceFilter === "ALL"
                    ? "bg-white text-[#2D332A] border border-[#D9DED4] shadow-2xs font-semibold"
                    : "text-[#6B7366] hover:text-[#2D332A]"
                }`}
              >
                Todos ({statusRecords.length})
              </button>
              <button
                onClick={() => setInstanceFilter("FIRST")}
                className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  instanceFilter === "FIRST"
                    ? "bg-white text-[#4F7A4F] border border-[#C6DEC6] shadow-2xs font-semibold"
                    : "text-[#6B7366] hover:text-[#4F7A4F]"
                }`}
              >
                1ra Instancia ({firstInstanceCount})
              </button>
              <button
                onClick={() => setInstanceFilter("RETAKE")}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  instanceFilter === "RETAKE"
                    ? "bg-[#EBF5EE] text-[#3D704D] border border-[#BDE0C7] shadow-2xs font-semibold"
                    : "text-[#6B7366] hover:text-[#3D704D]"
                }`}
              >
                <Sparkles className="h-3 w-3 text-[#3D704D]" />
                <span>Recuperatorio ({retakeCount})</span>
              </button>
            </div>

            <div className="text-[11px] text-[#6B7366] italic">
              Columnas V y W revisadas automáticamente
            </div>
          </div>
        )}

        {/* Toolbar (Search & Quick Action Buttons) */}
        <div className="p-4 sm:px-6 bg-white border-b border-[#D9DED4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7366]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nombre, ID, Campaña o Recuperatorio..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[#F9F9F7] border border-[#D9DED4] rounded-xl text-[#2D332A] placeholder-[#6B7366] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 focus:border-[#8DA189] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7366] hover:text-[#2D332A]"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyIds}
              disabled={filteredList.length === 0}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs ${
                copied
                  ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                  : "bg-white text-[#2D332A] border-[#D9DED4] hover:bg-[#F1F3EE]"
              }`}
              title="Copiar todos los IDs de esta lista al portapapeles"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "¡IDs Copiados!" : "Copiar IDs"}</span>
            </button>

            <button
              onClick={handleExportSubset}
              disabled={filteredList.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white text-[#2D332A] border border-[#D9DED4] hover:bg-[#F1F3EE] rounded-xl transition-all cursor-pointer shadow-xs"
              title="Descargar este grupo en Excel"
            >
              <Download className="h-3.5 w-3.5 text-[#6B7366]" />
              <span>Exportar</span>
            </button>

            <button
              onClick={() => {
                onApplyTableFilter(status === "ALL" ? "ALL" : status);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#8DA189] hover:bg-[#7D9179] text-white rounded-xl transition-all cursor-pointer shadow-xs"
              title="Aplicar filtro en la tabla principal"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filtrar en Tabla</span>
            </button>
          </div>
        </div>

        {/* Agent List / Table View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F9F9F7]/50 space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-[#D9DED4] rounded-2xl p-6">
              <Users className="h-10 w-10 text-[#6B7366] mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold text-[#2D332A]">
                {searchQuery ? "No se encontraron agentes para esta búsqueda" : "No hay agentes en esta selección"}
              </h3>
              <p className="text-xs text-[#6B7366] mt-1">
                {searchQuery
                  ? "Prueba modificando el término de búsqueda o limpia el filtro."
                  : "Cambia la instancia o el filtro seleccionado para visualizar registros."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredList.map((agent, index) => {
                const score = agent.score;
                const isApproved = agent.status === "Aprobado";
                const isFailed = agent.status === "No Aprobado";
                const isPending = !isApproved && !isFailed;
                const isRetake = !!agent.passedInRetake;

                return (
                  <div
                    key={agent.id || agent.agentId || index}
                    className={`bg-white border rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 shadow-xs hover:shadow-sm ${
                      isRetake ? "border-[#BDE0C7] hover:border-[#8DA189] bg-[#FCFDFB]" : "border-[#D9DED4] hover:border-[#8DA189]"
                    }`}
                  >
                    {/* Left: ID, Name, Campaign, Trainer & Retake Tag */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-xl border flex items-center justify-center text-xs font-bold shrink-0 font-mono ${
                          isRetake
                            ? "bg-[#EBF5EE] text-[#3D704D] border-[#BDE0C7]"
                            : "bg-[#F1F3EE] text-[#2D332A] border-[#D9DED4]"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        {/* Name + ID + Visual Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#2D332A] truncate">
                            {agent.agentName}
                          </h4>

                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4]">
                            ID: {agent.agentId}
                          </span>

                          {/* Distinctive Tag for Agents Approved in Retake */}
                          {isRetake && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EBF5EE] text-[#2D6A4F] border border-[#B7E4C7] shadow-2xs">
                              <Sparkles className="h-3 w-3 text-[#2D6A4F]" />
                              <span>Aprobado en Recuperatorio</span>
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6B7366] mt-1">
                          <span>
                            Campaña: <strong className="text-[#2D332A] font-medium">{agent.campaign || "General"}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Trainer: <strong className="text-[#2D332A] font-medium">{agent.trainerName || "No asignado"}</strong>
                          </span>
                          {isRetake && agent.initialScore !== undefined && agent.initialScore !== null && (
                            <>
                              <span>•</span>
                              <span className="text-[#6B7366]">
                                Nota 1ra instancia: <strong className="text-[#9E4A4A] font-medium">{agent.initialScore} pts</strong>
                              </span>
                            </>
                          )}
                          {agent.attendancePercentage !== undefined && (
                            <>
                              <span>•</span>
                              <span>
                                Asistencia: <strong className="text-[#2D332A] font-medium">{agent.attendancePercentage}%</strong>
                              </span>
                            </>
                          )}
                        </div>

                        {/* Optional Retake Details */}
                        {isRetake && agent.retakeDetails && (
                          <div className="mt-1 text-[11px] text-[#2D6A4F] flex items-center gap-1 font-medium">
                            <span>↳ {agent.retakeDetails}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Score, Status Badge & View Detail Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8EAE3]">
                      {/* Score Badge */}
                      <div className="text-left sm:text-right">
                        <div className="text-xs">
                          {score !== null && !isNaN(score) ? (
                            <span
                              className={`font-bold font-mono text-sm ${
                                isApproved
                                  ? "text-[#4F7A4F]"
                                  : isFailed
                                  ? "text-[#9E4A4A]"
                                  : "text-[#8C733E]"
                              }`}
                            >
                              {score} pts
                            </span>
                          ) : (
                            <span className="text-xs text-[#8C733E] font-medium italic">
                              Sin nota
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${
                            isApproved
                              ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                              : isFailed
                              ? "bg-[#FDF1F1] text-[#9E4A4A] border-[#F0D5D5]"
                              : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                          }`}
                        >
                          {agent.status}
                        </span>
                      </div>

                      {/* Detail Trigger */}
                      <button
                        onClick={() => {
                          onSelectAgent(agent);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#6B7366] hover:text-[#2D332A] hover:bg-[#F1F3EE] border border-[#D9DED4] rounded-lg transition-colors cursor-pointer"
                        title="Ver ficha completa"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Detalle</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-4 sm:px-6 border-t border-[#D9DED4] bg-[#F9F9F7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7366]">
          <p>
            Mostrando <strong className="text-[#2D332A]">{filteredList.length}</strong> de{" "}
            <strong className="text-[#2D332A]">{statusRecords.length}</strong> agentes en este estado.
            {status === "Aprobado" && retakeCount > 0 && (
              <span className="ml-1 text-[#3D704D] font-medium">
                ({retakeCount} aprobados en recuperatorio V/W)
              </span>
            )}
          </p>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-xs font-semibold bg-[#2D332A] hover:bg-[#1F241D] text-white rounded-xl transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
