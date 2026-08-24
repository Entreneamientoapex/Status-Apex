import React, { useMemo } from "react";
import { UserCheck, ChevronRight, Check } from "lucide-react";
import { AgentRecord } from "../types";

interface SupervisorCardProps {
  records: AgentRecord[];
  selectedSupervisor: string | null;
  onSelectSupervisor: (supervisorName: string) => void;
}

export const SupervisorCard: React.FC<SupervisorCardProps> = ({
  records,
  selectedSupervisor,
  onSelectSupervisor,
}) => {
  // Group agents by supervisor
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
        });
      }
      const data = map.get(supName)!;
      data.agents.push(r);
      data.total++;
      if (r.status === "Aprobado") data.approved++;
      else if (r.status === "No Aprobado") data.failed++;
      else data.pending++;

      if (typeof r.score === "number" && !isNaN(r.score)) {
        data.scoreSum += r.score;
        data.scoredCount++;
      }
    });

    return Array.from(map.values())
      .map((data) => ({
        supervisor: data.supervisor,
        agents: data.agents,
        total: data.total,
        approved: data.approved,
        failed: data.failed,
        pending: data.pending,
        rate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
        avgScore: data.scoredCount > 0 ? Math.round(data.scoreSum / data.scoredCount) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [records]);

  return (
    <div className="bg-white border border-[#D9DED4] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs h-full min-h-[360px]">
      <div>
        {/* Header: Título "Supervisor" */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E8EAE3]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#EAF5EC] text-[#1E7E34] flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#2D332A]">
                Supervisor
              </h2>
            </div>
          </div>
          <span className="text-[10px] text-[#6B7366] font-medium px-2 py-0.5 rounded-full bg-[#F1F3EE] border border-[#D9DED4]">
            {supervisorStats.length} {supervisorStats.length === 1 ? "coordinador" : "coordinadores"}
          </span>
        </div>

        <p className="text-[11px] text-[#6B7366] mb-3 leading-tight">
          Hacé clic en un supervisor para filtrar sus asesores en el panel de la derecha:
        </p>

        {/* List of Clickable Supervisors */}
        <div className="space-y-2 overflow-y-auto max-h-[290px] pr-1 divide-y divide-[#F1F3EE]">
          {supervisorStats.map((item, idx) => {
            const isSelected = selectedSupervisor === item.supervisor;

            return (
              <button
                key={`sup-row-${idx}`}
                type="button"
                id={`btn-supervisor-${idx}`}
                onClick={() => onSelectSupervisor(item.supervisor)}
                className={`w-full text-left pt-2 first:pt-0 group relative p-2.5 rounded-xl cursor-pointer transition-all duration-150 border flex items-center justify-between gap-2 select-none ${
                  isSelected
                    ? "bg-[#EAF5EC] border-[#A8D5B0] shadow-2xs ring-1 ring-[#1E7E34]/30"
                    : "bg-[#F9FAF8] hover:bg-[#F1F3EE] border-transparent hover:border-[#D9DED4]"
                }`}
                title={`Seleccionar a ${item.supervisor} para ver sus asesores`}
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
                    <span className="font-medium">{item.total} {item.total === 1 ? "asesor" : "asesores"}</span>
                    <span>•</span>
                    <span>Media: {item.avgScore > 0 ? `${item.avgScore} pts` : "Sin notas"}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      item.rate >= 80
                        ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                        : item.rate >= 60
                        ? "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                        : "bg-[#FDF1F1] text-[#9E4A4A] border-[#F0D5D5]"
                    }`}
                  >
                    {item.rate}% aprob.
                  </span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 transition-transform ${
                      isSelected
                        ? "text-[#1E7E34] translate-x-0.5"
                        : "text-[#8DA189] group-hover:translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
            );
          })}

          {supervisorStats.length === 0 && (
            <p className="text-xs text-[#6B7366] text-center py-6">
              No hay supervisores registrados en los datos cargados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
