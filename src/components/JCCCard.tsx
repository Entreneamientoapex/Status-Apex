import React, { useState, useMemo } from "react";
import { Briefcase, ChevronRight, Check, Search, X, Users } from "lucide-react";
import { AgentRecord } from "../types";
import { SheetAnalysisRecord } from "../utils/googleSheetsService";

interface JCCCardProps {
  records: AgentRecord[];
  history?: SheetAnalysisRecord[];
  selectedTestIds?: string[];
  selectedJCC?: string | null;
  onSelectJCC?: (jccName: string | null) => void;
}

export const JCCCard: React.FC<JCCCardProps> = ({
  records,
  history = [],
  selectedTestIds = [],
  selectedJCC = null,
  onSelectJCC,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Determine active evaluations selected in history
  const activeEvaluations = useMemo(() => {
    if (selectedTestIds.length === 0) return [];
    return history.filter((h) => selectedTestIds.includes(h.id));
  }, [history, selectedTestIds]);

  // Group agents by JCC and calculate metrics
  const jccStats = useMemo(() => {
    const map = new Map<
      string,
      {
        jcc: string;
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
      const rawJcc = r.jcc?.trim();
      const jccName = rawJcc && rawJcc.length > 0 && rawJcc !== "-" ? rawJcc : "Sin JCC Asignado";

      if (!map.has(jccName)) {
        map.set(jccName, {
          jcc: jccName,
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
      const data = map.get(jccName)!;
      data.agents.push(r);
      data.total++;

      const isAppr = r.status === "Aprobado" || (typeof r.score === "number" && r.score >= 80);
      const isFail = r.status === "No Aprobado" || (typeof r.score === "number" && r.score < 80 && r.score >= 0);

      if (isAppr) {
        data.approved++;
      } else if (isFail) {
        data.failed++;
      } else {
        data.pending++;
      }

      if (typeof r.score === "number" && !isNaN(r.score)) {
        data.scoreSum += r.score;
        data.scoredCount++;
      }
    });

    // If multiple tests are selected, calculate each individual test's approved/evaluated percentage for each JCC
    if (activeEvaluations.length > 1) {
      activeEvaluations.forEach((evalItem) => {
        const evalRecords = evalItem.records || [];
        evalRecords.forEach((r) => {
          const rawJcc = r.jcc?.trim();
          const jccName = rawJcc && rawJcc.length > 0 && rawJcc !== "-" ? rawJcc : "Sin JCC Asignado";
          const data = map.get(jccName);
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
          jcc: data.jcc,
          agents: data.agents,
          total: data.total,
          approved: data.approved,
          failed: data.failed,
          pending: data.pending,
          porcentajeAvance,
          multiTestBadge,
          avgScore:
            data.scoredCount > 0 ? Math.round(data.scoreSum / data.scoredCount) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [records, activeEvaluations]);

  // Filter JCCs in real-time by search query
  const filteredJCCs = useMemo(() => {
    if (!searchTerm.trim()) return jccStats;
    const query = searchTerm.toLowerCase().trim();
    return jccStats.filter((item) => item.jcc.toLowerCase().includes(query));
  }, [jccStats, searchTerm]);

  const handleJCCClick = (jccName: string) => {
    if (!onSelectJCC) return;
    if (selectedJCC === jccName) {
      onSelectJCC(null);
    } else {
      onSelectJCC(jccName);
    }
  };

  const isMultiTest = activeEvaluations.length > 1;

  return (
    <div className="bg-white border border-[#D9DED4] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs h-full min-h-[360px]">
      <div>
        {/* Header: Título "JCC", Botón Mostrar Todos los JCC y Contador */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E8EAE3]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#EAEFF8] text-[#2B579A] flex items-center justify-center shrink-0 border border-[#D0DDF0]">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#2D332A]">
                JCC
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedJCC ? (
              <button
                type="button"
                onClick={() => onSelectJCC && onSelectJCC(null)}
                className="text-[10px] text-[#2B579A] font-medium px-2 py-0.5 rounded-full bg-[#EAEFF8] hover:bg-[#D8E4F5] border border-[#C5D7F0] transition-colors cursor-pointer flex items-center gap-1"
                title="Quitar filtro y ver todos los JCC"
              >
                <span>👥 Mostrar Todos los JCC</span>
                <X className="h-2.5 w-2.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectJCC && onSelectJCC(null)}
                className="text-[10px] text-[#6B7366] font-medium px-2 py-0.5 rounded-full bg-[#F1F3EE] hover:bg-[#E8EAE3] border border-[#D9DED4] transition-colors cursor-pointer flex items-center gap-1"
                title="Lista completa de JCC"
              >
                <Users className="h-2.5 w-2.5 text-[#4F7A4F]" />
                <span>Mostrar Todos ({jccStats.length})</span>
              </button>
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
            placeholder="Buscar JCC..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F9FAF8] hover:bg-white focus:bg-white border border-[#D9DED4] focus:border-[#2B579A] rounded-xl outline-none transition-all placeholder-[#8DA189] text-[#2D332A]"
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

        {/* List of JCCs with dynamic pass rate badge */}
        <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1 divide-y divide-[#F1F3EE]">
          {filteredJCCs.length === 0 ? (
            <div className="text-center py-6 text-[11px] text-[#6B7366]">
              No se encontraron registros de JCC para los filtros activos.
            </div>
          ) : (
            filteredJCCs.map((item, idx) => {
              const isSelected = selectedJCC === item.jcc;

              return (
                <div
                  key={`jcc-row-${idx}`}
                  id={`jcc-card-${idx}`}
                  onClick={() => handleJCCClick(item.jcc)}
                  className={`w-full text-left pt-2 first:pt-0 group relative p-2.5 rounded-xl transition-all duration-150 border flex items-center justify-between gap-2 select-none ${
                    onSelectJCC ? "cursor-pointer" : "cursor-default"
                  } ${
                    isSelected
                      ? "bg-[#EAEFF8] border-[#9DBFE6] shadow-2xs ring-1 ring-[#2B579A]/30"
                      : "bg-[#F9FAF8] hover:bg-[#F1F3EE] border-transparent hover:border-[#D9DED4]"
                  }`}
                  title={
                    isSelected
                      ? `Filtro activo: ${item.jcc} (Clic para desmarcar)`
                      : `Filtrar por JCC: ${item.jcc}`
                  }
                >
                  <div className="truncate pr-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isSelected && (
                        <div className="h-4 w-4 rounded-full bg-[#2B579A] text-white flex items-center justify-center shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                      <p
                        className={`text-xs font-semibold truncate transition-colors ${
                          isSelected
                            ? "text-[#2B579A]"
                            : "text-[#2D332A] group-hover:text-[#2B579A]"
                        }`}
                      >
                        {item.jcc}
                      </p>
                    </div>
                    <p className="text-[10px] text-[#6B7366] flex items-center gap-1.5 mt-0.5">
                      <span className="font-medium">
                        {item.total} {item.total === 1 ? "asesor asignado" : "asesores asignados"}
                      </span>
                      <span>•</span>
                      <span>
                        Media: {item.avgScore > 0 ? `${item.avgScore} pts` : "Sin notas"}
                      </span>
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
                    {onSelectJCC && (
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${
                          isSelected
                            ? "text-[#2B579A] translate-x-0.5"
                            : "text-[#8DA189] group-hover:translate-x-0.5"
                        }`}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
