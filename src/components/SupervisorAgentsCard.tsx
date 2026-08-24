import React, { useMemo } from "react";
import { Users, CheckCircle2, XCircle, Clock, Phone, Monitor, RefreshCw, X, AlertCircle } from "lucide-react";
import { AgentRecord } from "../types";

interface SupervisorAgentsCardProps {
  records: AgentRecord[];
  selectedSupervisor: string | null;
  onClearSupervisor?: () => void;
}

export const SupervisorAgentsCard: React.FC<SupervisorAgentsCardProps> = ({
  records,
  selectedSupervisor,
  onClearSupervisor,
}) => {
  // Filtrar únicamente los asesores del supervisor seleccionado
  const filteredAgents = useMemo(() => {
    if (!selectedSupervisor) return [];
    return records.filter((r) => {
      const sup = r.supervisor?.trim() || "Sin Supervisor Asignado";
      return sup === selectedSupervisor;
    });
  }, [records, selectedSupervisor]);

  // Estadísticas rápidas del supervisor seleccionado
  const supStats = useMemo(() => {
    if (filteredAgents.length === 0) {
      return { total: 0, approved: 0, failed: 0, pending: 0, rate: 0 };
    }
    const total = filteredAgents.length;
    const approved = filteredAgents.filter((a) => a.status === "Aprobado").length;
    const failed = filteredAgents.filter((a) => a.status === "No Aprobado").length;
    const pending = filteredAgents.filter(
      (a) => a.status === "Pendiente" || (a.status !== "Aprobado" && a.status !== "No Aprobado")
    ).length;
    const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { total, approved, failed, pending, rate };
  }, [filteredAgents]);

  return (
    <div className="bg-white border border-[#D9DED4] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs h-full min-h-[360px]">
      <div className="flex flex-col h-full">
        {/* Header del Cuadro de la Derecha: Título "Agentes" */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E8EAE3]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-[#EAF5EC] text-[#1E7E34] flex items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-[#2D332A] truncate">
                Agentes
              </h2>
              {selectedSupervisor && (
                <p className="text-[10px] text-[#6B7366] truncate">
                  Supervisor: <span className="font-semibold text-[#2D332A]">{selectedSupervisor}</span>
                </p>
              )}
            </div>
          </div>

          {selectedSupervisor && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold text-[#1E7E34] bg-[#EAF5EC] border border-[#CCE8D1] px-2 py-0.5 rounded-full">
                {supStats.total} {supStats.total === 1 ? "asesor" : "asesores"} • {supStats.rate}% aprob.
              </span>
              {onClearSupervisor && (
                <button
                  onClick={onClearSupervisor}
                  className="p-1 text-[#6B7366] hover:text-[#2D332A] hover:bg-[#F1F3EE] rounded-lg transition-colors cursor-pointer"
                  title="Limpiar filtro de supervisor"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* CONTENIDO CONDICIONAL: */}
        {!selectedSupervisor ? (
          /* ESTADO POR DEFECTO: Cuando no hay supervisor seleccionado */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#FAF9F6] border border-dashed border-[#D9DED4] rounded-xl my-auto">
            <div className="h-12 w-12 rounded-2xl bg-[#E8EAE3] text-[#6B7366] flex items-center justify-center mb-3">
              <Users className="h-6 w-6 text-[#8DA189]" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-[#2D332A] max-w-xs leading-snug">
              Selecciona un supervisor en el panel central para ver el desglose de sus asesores a cargo
            </p>
            <p className="text-[11px] text-[#6B7366] mt-1.5 max-w-xs leading-relaxed">
              Podrás consultar las notas de test telefónico, test digital, recuperatorio y el estado final de cada asesor.
            </p>
          </div>
        ) : filteredAgents.length === 0 ? (
          /* ESTADO CUANDO EL SUPERVISOR NO TIENE ASESORES EN ESTA HOJA */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#FAF9F6] border border-dashed border-[#D9DED4] rounded-xl my-auto">
            <AlertCircle className="h-8 w-8 text-[#8C733E] mb-2" />
            <p className="text-xs font-semibold text-[#2D332A]">
              No se encontraron asesores registrados
            </p>
            <p className="text-[10px] text-[#6B7366] mt-1">
              No hay asesores asignados a {selectedSupervisor} en esta pestaña.
            </p>
          </div>
        ) : (
          /* ESTADO CON ASESORES DEL SUPERVISOR SELECCIONADO */
          <div className="space-y-2.5 overflow-y-auto max-h-[320px] pr-1 divide-y divide-[#F1F3EE]">
            {filteredAgents.map((agent, idx) => {
              const isApproved = agent.status === "Aprobado";
              const isFailed = agent.status === "No Aprobado";
              const isPending = !isApproved && !isFailed;

              return (
                <div
                  key={agent.id || `sup-agent-${idx}`}
                  className="pt-2.5 first:pt-0 bg-[#F9FAF8] hover:bg-[#F3F5F0] border border-[#E8EAE3] hover:border-[#D9DED4] rounded-xl p-3 transition-all duration-150 shadow-2xs"
                >
                  {/* Fila Superior: Nombre del Asesor y Badge de Estado */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[#2D332A] truncate">
                          {agent.agentName}
                        </span>
                        {agent.agentId && (
                          <span className="text-[10px] font-mono text-[#6B7366] bg-white border border-[#D9DED4] px-1.5 py-0.2 rounded">
                            {agent.agentId}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#6B7366] truncate mt-0.5">
                        {agent.campaign || "Operaciones"}
                      </p>
                    </div>

                    {/* Etiqueta visual con su Estado Final */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isApproved
                          ? "bg-[#EAF5EC] text-[#1E7E34] border-[#CCE8D1]"
                          : isFailed
                          ? "bg-[#FDF1F1] text-[#9E4A4A] border-[#F0D5D5]"
                          : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : isFailed ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      <span>{agent.status}</span>
                    </span>
                  </div>

                  {/* Fila Inferior: Desglose de Notas Reales Cruzadas */}
                  <div className="grid grid-cols-3 gap-1.5 bg-white border border-[#E8EAE3] rounded-lg p-2 text-[10px]">
                    {/* 1. Nota Test Telefónico */}
                    <div className="flex flex-col">
                      <span className="text-[#6B7366] truncate flex items-center gap-1" title="Cuestionario: Test (atención telefónica) (Real)">
                        <Phone className="h-2.5 w-2.5 text-[#8DA189]" />
                        <span>Telefónico</span>
                      </span>
                      <span
                        className={`font-semibold font-mono mt-0.5 ${
                          agent.phoneScore !== null && agent.phoneScore !== undefined
                            ? agent.phoneScore >= 80
                              ? "text-[#1E7E34]"
                              : "text-[#9E4A4A]"
                            : "text-[#8C733E] italic"
                        }`}
                      >
                        {agent.phoneScore !== null && agent.phoneScore !== undefined
                          ? `${agent.phoneScore} pts`
                          : "Sin Nota"}
                      </span>
                    </div>

                    {/* 2. Nota Test Digital */}
                    <div className="flex flex-col border-l border-[#F1F3EE] pl-2">
                      <span className="text-[#6B7366] truncate flex items-center gap-1" title="Cuestionario: Test (atención digital) (Real)">
                        <Monitor className="h-2.5 w-2.5 text-[#8DA189]" />
                        <span>Digital</span>
                      </span>
                      <span
                        className={`font-semibold font-mono mt-0.5 ${
                          agent.digitalScore !== null && agent.digitalScore !== undefined
                            ? agent.digitalScore >= 80
                              ? "text-[#1E7E34]"
                              : "text-[#9E4A4A]"
                            : "text-[#8C733E] italic"
                        }`}
                      >
                        {agent.digitalScore !== null && agent.digitalScore !== undefined
                          ? `${agent.digitalScore} pts`
                          : "Sin Nota"}
                      </span>
                    </div>

                    {/* 3. Nota Recuperatorio */}
                    <div className="flex flex-col border-l border-[#F1F3EE] pl-2">
                      <span className="text-[#6B7366] truncate flex items-center gap-1" title="Cuestionario: Recuperatorio (atención telefónica) (Real)">
                        <RefreshCw className="h-2.5 w-2.5 text-[#8DA189]" />
                        <span>Recup.</span>
                      </span>
                      <span
                        className={`font-semibold font-mono mt-0.5 ${
                          agent.retakeScore !== null && agent.retakeScore !== undefined
                            ? agent.retakeScore >= 80
                              ? "text-[#1E7E34]"
                              : "text-[#9E4A4A]"
                            : "text-[#6B7366]"
                        }`}
                      >
                        {agent.retakeScore !== null && agent.retakeScore !== undefined
                          ? `${agent.retakeScore} pts`
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
