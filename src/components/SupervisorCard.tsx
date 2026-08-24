import React, { useState, useMemo } from "react";
import { UserCheck, ChevronRight, Check, Search, X } from "lucide-react";
import { AgentRecord } from "../types";
import { SheetAnalysisRecord } from "../utils/googleSheetsService";

interface SupervisorCardProps {
  records: AgentRecord[];
  history?: SheetAnalysisRecord[];
  selectedTestIds?: string[];
  selectedSupervisor?: string | null;
  onSelectSupervisor?: (supervisorName: string | null) => void;
}

export const SupervisorCard: React.FC<SupervisorCardProps> = ({
  records,
  history = [],
  selectedTestIds = [],
  selectedSupervisor = null,
  onSelectSupervisor,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Determine active evaluations selected in history
  const activeEvaluations = useMemo(() => {
    if (selectedTestIds.length === 0) return [];
    return history.filter((h) => selectedTestIds.includes(h.id));
  }, [history, selectedTestIds]);

  // Group agents by supervisor and calculate metrics
  const supervisorStats = useMemo(() => {
    const map = new Map<
      string,
      {
        supervisor: string;
        agents: AgentRecord[];
        total: number;
        approved: number;
        failed: number;
        pending: number;
        scoreSum: number;
        scoredCount: number;
        testStats: Map<string, { total: number; approved: number; evaluated: number }>;
      }
    >();

    records.forEach((r) => {
      const rawSup = r.supervisor?.trim();
      const supName = rawSup && rawSup.length > 0 ? rawSup : "Sin Supervisor Asignado";

      if (!map.has(supName)) {
        map.set(supName, {
          supervisor: supName,
          agents: [],
          total: 0,
          approved: 0,
          failed: 0,
          pending: 0,
          scoreSum: 0,
          scoredCount: 0,
          testStats: new Map(),
        });
      }
      const data = map.get(supName)!;
      data.agents.push(r);
      data.total++;

      const isAppr = r.status === "Aprobado" || (typeof r.score === "number" && r.score >= 80);
      const isFail = r.status === "No Aprobado" || (typeof r.score === "number" && r.score < 80 && r.score >= 0);

      if (isAppr) data.approved++;
      else if (isFail) data.failed++;
      else data.pending++;

      if (typeof r.score === "number" && !isNaN(r.score)) {
        data.scoreSum += r.score;
        data.scoredCount++;
      }
    });

    // If multiple tests are selected, calculate each individual test's approved/evaluated percentage for each Supervisor
    if (activeEvaluations.length > 1) {
      activeEvaluations.forEach((evalItem) => {
        const evalRecords = evalItem.records || [];
        evalRecords.forEach((r) => {
          const rawSup = r.supervisor?.trim();
          const supName = rawSup && rawSup.length > 0 ? rawSup : "Sin Supervisor Asignado";
          const data = map.get(supName);
          if (data) {
            if (!data.testStats.has(evalItem.id)) {
              data.testStats.set(evalItem.id, { total: 0, approved: 0, evaluated: 0 });
            }
            const tStat = data.testStats.get(evalItem.id)!;
            tStat.total++;
            const isAppr = r.status === "Aprobado" || (typeof r.score === "number" && r.score >= 80);
            const isFail = r.status === "No Aprobado" || (typeof r.score === "number" && r.score < 80 && r.score >= 0);
            if (isAppr) {
              tStat.approved++;
              tStat.evaluated++;
            } else if (isFail) {
              tStat.evaluated++;
            }
          }
        });
      });
    }

    return Array.from(map.values())
      .map((data) => {
        const evalTotal = data.approved + data.failed;
        // Porcentaje de avance: asesores que rindieron sobre el total asignado
        const porcentajeAvance =
          data.total > 0 ? Math.round((evalTotal / data.total) * 100) : 0;

        // Formulate multi-test text: "T1: 85% | T2: 90%"
        let multiTestBadge = "";
        if (activeEvaluations.length > 1) {
          multiTestBadge = activeEvaluations
            .map((evalItem, index) => {
              const tStat = data.testStats.get(evalItem.id);
              let tRate = porcentajeAvance;
              if (tStat && tStat.evaluated > 0) {
                tRate = Math.round((tStat.approved / tStat.evaluated) * 100);
              } else if (tStat && tStat.total > 0) {
                tRate = Math.round((tStat.approved / tStat.total) * 100);
              }
              return `T${index + 1}: ${tRate}%`;
            })
            .join(" | ");
        }

        return {
          supervisor: data.supervisor,
          agents: data.agents,
          total: data.total,
          approved: data.approved,
          failed: data.failed,
          pending: data.pending,
          porcentajeAvance,
          multiTestBadge,
          avgScore: data.scoredCount > 0 ? Math.round(data.scoreSum / data.scoredCount) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [records, activeEvaluations]);

  // Filter supervisors in real-time by search query
  const filteredSupervisors = useMemo(() => {
    if (!searchTerm.trim()) return supervisorStats;
    const query = searchTerm.toLowerCase().trim();
    return supervisorStats.filter((item) =>
      item.supervisor.toLowerCase().includes(query)
    );
  }, [supervisorStats, searchTerm]);

  const handleSupervisorClick = (supName: string) => {
    if (!onSelectSupervisor) return;
    if (selectedSupervisor === supName) {
      onSelectSupervisor(null);
    } else {
      onSelectSupervisor(supName);
    }
  };

  const isMultiTest = activeEvaluations.length > 1;

  return (
    <div className="bg-white border border-[#D9DED4] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs h-full min-h-[360px]">
      <div>
        {/* Header: Título "Supervisor", Botón Quitar Filtro y Contador */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E8EAE3]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#EAF5EC] text-[#1E7E34] flex items-center justify-center shrink-0 border border-[#CCE8D1]">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#2D332A]">
                Supervisor
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedSupervisor ? (
              <button
                type="button"
                onClick={() => onSelectSupervisor && onSelectSupervisor(null)}
                className="text-[10px] text-[#1E7E34] font-medium px-2 py-0.5 rounded-full bg-[#EAF5EC] hover:bg-[#D5ECD8] border border-[#CCE8D1] transition-colors cursor-pointer flex items-center gap-1"
                title="Quitar filtro de supervisor"
              >
                <span>👥 Mostrar Todos</span>
                <X className="h-2.5 w-2.5" />
              </button>
            ) : (
              <span className="text-[10px] text-[#6B7366] font-medium px-2 py-0.5 rounded-full bg-[#F1F3EE] border border-[#D9DED4]">
                {supervisorStats.length} {supervisorStats.length === 1 ? "Coordinador" : "Coordinadores"}
              </span>
            )}
          </div>
        </div>

        {/* Buscador en tiempo real */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#8DA189]">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar supervisor..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F9FAF8] hover:bg-white focus:bg-white border border-[#D9DED4] focus:border-[#1E7E34] rounded-xl outline-none transition-all placeholder-[#8DA189] text-[#2D332A]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8DA189] hover:text-[#2D332A] cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* List of Supervisors with dynamic pass rate badge */}
        <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1 divide-y divide-[#F1F3EE]">
          {filteredSupervisors.map((item, idx) => {
            const isSelected = selectedSupervisor === item.supervisor;

            return (
              <div
                key={`sup-row-${idx}`}
                id={`supervisor-card-${idx}`}
                onClick={() => handleSupervisorClick(item.supervisor)}
                className={`w-full text-left pt-2 first:pt-0 group relative p-2.5 rounded-xl transition-all duration-150 border flex items-center justify-between gap-2 select-none ${
                  onSelectSupervisor ? "cursor-pointer" : "cursor-default"
                } ${
                  isSelected
                    ? "bg-[#EAF5EC] border-[#A8D5B0] shadow-2xs ring-1 ring-[#1E7E34]/30"
                    : "bg-[#F9FAF8] hover:bg-[#F1F3EE] border-transparent hover:border-[#D9DED4]"
                }`}
                title={isSelected ? `Filtro activo: ${item.supervisor} (Clic para desmarcar)` : `Filtrar por supervisor: ${item.supervisor}`}
              >
                <div className="truncate pr-2 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-[#1E7E34] text-white flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                    <p
                      className={`text-xs font-semibold truncate transition-colors ${
                        isSelected ? "text-[#1E7E34]" : "text-[#2D332A] group-hover:text-[#1E7E34]"
                      }`}
                    >
                      {item.supervisor}
                    </p>
                  </div>
                  <p className="text-[10px] text-[#6B7366] flex items-center gap-1.5 mt-0.5">
                    <span className="font-medium">
                      {item.total} {item.total === 1 ? "asesor" : "asesores"}
                    </span>
                    <span>•</span>
                    <span>Media: {item.avgScore > 0 ? `${item.avgScore} pts` : "Sin notas"}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                      item.porcentajeAvance >= 80
                        ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                        : item.porcentajeAvance >= 60
                        ? "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                        : "bg-[#FDF1F1] text-[#9E4A4A] border-[#F0D5D5]"
                    }`}
                  >
                    {isMultiTest && item.multiTestBadge
                      ? item.multiTestBadge
                      : `${item.porcentajeAvance}% rendido`}
                  </span>
                  {onSelectSupervisor && (
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${
                        isSelected
                          ? "text-[#1E7E34] translate-x-0.5"
                          : "text-[#8DA189] group-hover:translate-x-0.5"
                      }`}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {filteredSupervisors.length === 0 && (
            <div className="text-center py-6 text-xs text-[#6B7366]">
              {searchTerm ? (
                <p>No se encontraron supervisores que coincidan con "{searchTerm}".</p>
              ) : (
                <p>No hay supervisores registrados en los datos cargados.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
