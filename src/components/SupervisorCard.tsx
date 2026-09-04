import React, { useState, useMemo } from "react";
import { UserCheck, ChevronRight, Check, Search, X } from "lucide-react";
import { AgentRecord } from "../types";
import { SheetAnalysisRecord } from "../utils/googleSheetsService";
import {
  isBajaRecord,
  isValidEntityName,
} from "../utils/bajaFilter";

interface SupervisorCardProps {
  records: AgentRecord[];
  history?: SheetAnalysisRecord[];
  selectedTestIds?: string[];
  selectedSupervisor?: string | null;
  onSelectSupervisor?: (supervisorName: string | null) => void;
}

/**
 * Valida de forma estricta si un agente tiene nota numérica real cargada en el examen
 * (descarta guiones '-', 'PENDIENTE', 'Ausente', cadenas vacías y valores no numéricos)
 */
export function isAgentEvaluated(agent: AgentRecord): boolean {
  if (!agent) return false;
  if (agent.status === "Pendiente" || (agent.status as string) === "Ausente") {
    if (agent.score === null || agent.score === undefined || isNaN(agent.score)) {
      return false;
    }
  }

  const hasValidScore =
    (typeof agent.score === "number" && !isNaN(agent.score) && agent.score !== null && agent.score >= 0) ||
    (typeof agent.phoneScore === "number" && !isNaN(agent.phoneScore) && agent.phoneScore !== null && agent.phoneScore >= 0) ||
    (typeof agent.digitalScore === "number" && !isNaN(agent.digitalScore) && agent.digitalScore !== null && agent.digitalScore >= 0) ||
    (typeof agent.retakeScore === "number" && !isNaN(agent.retakeScore) && agent.retakeScore !== null && agent.retakeScore >= 0);

  if (!hasValidScore) return false;
  if (agent.status === "Pendiente") return false;

  return true;
}

/**
 * Genera dinámicamente las siglas o iniciales representativas de cada pestaña del Excel
 */
export function getDynamicTabAcronym(name: string | undefined | null, index: number): string {
  if (!name) return `T${index + 1}`;
  const trimmed = name.trim();

  // 1. Código de proyecto explícito tipo CD2633, CD5562
  const cdMatch = trimmed.match(/\b(CD[-_]?\d{3,6})\b/i);
  if (cdMatch) {
    return cdMatch[1].toUpperCase().replace(/[-_]/g, "");
  }

  // 2. Palabras clave de módulos de evaluación
  const lower = trimmed.toLowerCase();
  if (lower.includes("fcr")) return "FCR";
  if (lower.includes("tel") || lower.includes("voz")) return "TT";
  if (lower.includes("dig") || lower.includes("chat")) return "TD";
  if (lower.includes("recup")) return "REC";
  if (lower.includes("calidad")) return "CAL";
  if (lower.includes("onboard")) return "ONB";
  if (lower.includes("genesys")) return "GEN";

  // 3. Test 1, Test 2, etc.
  const testNum = trimmed.match(/^Test\s*(\d+|[A-Za-z])/i);
  if (testNum) {
    return `T${testNum[1].toUpperCase()}`;
  }

  // 4. Siglas extraídas de las palabras principales
  const cleanWords = trimmed
    .split(/[\s\-_:/]+/)
    .filter((w) => !/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(w) && !/^\d{4}$/.test(w))
    .filter((w) => !["de", "del", "la", "el", "en", "y", "a", "al", "los", "las", "para", "por"].includes(w.toLowerCase()));

  if (cleanWords.length >= 2) {
    const initials = cleanWords.slice(0, 3).map((w) => w[0]?.toUpperCase()).join("");
    if (initials.length >= 2 && initials.length <= 4) {
      return initials;
    }
  }

  return `T${index + 1}`;
}

interface SupervisorCardProps {
  records: AgentRecord[];
  history?: SheetAnalysisRecord[];
  selectedTestIds?: string[];
  activeAnalysisId?: string | null;
  selectedSupervisor?: string | null;
  onSelectSupervisor?: (supervisorName: string | null) => void;
}

export const SupervisorCard: React.FC<SupervisorCardProps> = ({
  records,
  history = [],
  selectedTestIds = [],
  activeAnalysisId = null,
  selectedSupervisor = null,
  onSelectSupervisor,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Limpiar texto de búsqueda al cambiar de curso o evaluaciones
  React.useEffect(() => {
    setSearchTerm("");
  }, [activeAnalysisId, selectedTestIds]);

  // Determine active evaluations selected in history
  const activeEvaluations = useMemo(() => {
    if (selectedTestIds.length === 0) return [];
    return history.filter((h) => selectedTestIds.includes(h.id));
  }, [history, selectedTestIds]);

  const hasSupervisorTestSelected = useMemo(() => {
    const checkString = (str?: string) => {
      if (!str) return false;
      const lower = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return lower.includes("(para supervisor)") || lower.includes("para supervisor");
    };

    // ESCENARIO 1: Exámenes marcados con el casillero (checkbox)
    if (selectedTestIds && selectedTestIds.length > 0) {
      const selectedAnalyses = history.filter((h) => selectedTestIds.includes(h.id));
      if (
        selectedAnalyses.some(
          (h) => checkString(h.name) || checkString(h.sheetName) || checkString(h.trainingTopic)
        )
      ) {
        return true;
      }
    }

    // ESCENARIO 2: Curso seleccionado actualmente como activo en pantalla (activeAnalysisId)
    if (activeAnalysisId) {
      const activeTest = history.find((h) => h.id === activeAnalysisId);
      if (
        activeTest &&
        (checkString(activeTest.name) || checkString(activeTest.sheetName) || checkString(activeTest.trainingTopic))
      ) {
        return true;
      }
    }

    // ESCENARIO 3: Registros actuales cargados en pantalla
    if (records && records.length > 0) {
      if (
        records.some(
          (r) =>
            checkString(r.trainingName) ||
            checkString(r.testName) ||
            checkString(r.examen) ||
            checkString(r.sourceFileName)
        )
      ) {
        return true;
      }
    }

    // ESCENARIO 4: Evaluaciones marcadas como activas en el historial
    if (activeEvaluations && activeEvaluations.length > 0) {
      if (
        activeEvaluations.some(
          (h) => checkString(h.name) || checkString(h.sheetName) || checkString(h.trainingTopic)
        )
      ) {
        return true;
      }
    }

    return false;
  }, [history, selectedTestIds, activeAnalysisId, records, activeEvaluations]);

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
      }
    >();

    records.forEach((r) => {
      // Filtrar bajas
      if (isBajaRecord(r)) return;

      const rawSup = r.supervisor?.trim();
      const supName =
        !rawSup ||
        rawSup === "" ||
        rawSup === "-" ||
        rawSup.toLowerCase() === "sin supervisor asignado" ||
        rawSup.toLowerCase() === "sin supervisor" ||
        rawSup.toLowerCase() === "sin asignar" ||
        rawSup.toLowerCase().includes("#n/a")
          ? "Staff"
          : rawSup;

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

      const isEvaluated = isAgentEvaluated(r);
      const isAppr = r.status === "Aprobado" || (typeof r.score === "number" && r.score >= 80);
      const isFail = r.status === "No Aprobado" || (typeof r.score === "number" && r.score < 80 && r.score >= 0);

      if (isAppr) data.approved++;
      else if (isFail) data.failed++;
      else data.pending++;

      if (typeof r.score === "number" && !isNaN(r.score) && isEvaluated) {
        data.scoreSum += r.score;
        data.scoredCount++;
      }
    });

    return Array.from(map.values())
      .filter((data) => data.total > 0)
      .map((data) => {
        const uniqueAgents = new Set<string>();
        data.agents.forEach((r) => {
          if (isBajaRecord(r)) return;
          const agentKey = (r.agentId?.trim() || r.agentName?.trim() || r.id?.trim() || "").toLowerCase();
          if (agentKey) {
            uniqueAgents.add(agentKey);
          }
        });
        const teamTotal = uniqueAgents.size > 0 ? uniqueAgents.size : data.total;

        // Rendidos reales en la vista actual (excluyendo notas vacías o pendientes)
        const rendidosActuales = data.agents.filter(isAgentEvaluated).length;
        // Porcentaje de avance: asesores con nota real sobre el universo total de su equipo
        const porcentajeAvance =
          teamTotal > 0 ? Math.round((rendidosActuales / teamTotal) * 100) : 0;

        // Formulate multi-test badge dinámico: "TT: 85% | TD: 90%"
        let multiTestBadge = "";
        if (activeEvaluations.length > 1) {
          multiTestBadge = activeEvaluations
            .map((evalItem, index) => {
              const acronym = getDynamicTabAcronym(evalItem.name || evalItem.sheetName, index);
              const evalRecords = evalItem.records || [];

              // Asesores válidos que pertenecen a este supervisor en el examen puntual
              const supervisorTestAgents = evalRecords.filter((r) => {
                if (isBajaRecord(r)) return false;
                const rawSup = r.supervisor?.trim();
                const supName =
                  !rawSup ||
                  rawSup === "-" ||
                  rawSup.toLowerCase() === "sin supervisor asignado" ||
                  rawSup.toLowerCase() === "sin supervisor" ||
                  rawSup.toLowerCase() === "sin asignar" ||
                  rawSup.toLowerCase().includes("#n/a")
                    ? "Staff"
                    : rawSup;
                return supName.toLowerCase() === data.supervisor.toLowerCase();
              });

              // Asesores de su equipo que tienen nota numérica real en este test
              const testRendidos = supervisorTestAgents.filter(isAgentEvaluated).length;
              // Universo total de su equipo
              const teamUniverse = teamTotal > 0 ? teamTotal : supervisorTestAgents.length;
              const testRate = teamUniverse > 0 ? Math.round((testRendidos / teamUniverse) * 100) : 0;

              return `${acronym}: ${testRate}%`;
            })
            .join(" | ");
        }

        return {
          supervisor: data.supervisor,
          agents: data.agents,
          total: teamTotal,
          approved: data.approved,
          failed: data.failed,
          pending: data.pending,
          porcentajeAvance,
          multiTestBadge,
          avgScore: data.scoredCount > 0 ? Math.round(data.scoreSum / data.scoredCount) : 0,
        };
      })
      .sort((a, b) => a.supervisor.localeCompare(b.supervisor, "es", { sensitivity: "base" }));
  }, [records, activeEvaluations]);

  // Filter supervisors in real-time by search query, descartando de forma absoluta cualquier entrada #N/A o rota
  const filteredSupervisors = useMemo(() => {
    const validSupervisors = supervisorStats.filter(
      (item) =>
        isValidEntityName(item.supervisor) &&
        !item.supervisor.toLowerCase().includes("#n/a") &&
        !item.supervisor.toLowerCase().includes("#n/d") &&
        item.total > 0
    );
    if (!searchTerm.trim()) return validSupervisors;
    const query = searchTerm.toLowerCase().trim();
    return validSupervisors.filter((item) => {
      const isStaff = item.supervisor.toLowerCase() === "staff";
      const displayName = isStaff ? "Supervisor" : item.supervisor;
      return (
        item.supervisor.toLowerCase().includes(query) ||
        displayName.toLowerCase().includes(query)
      );
    });
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

  // Lógica condicional del badge de cabecera: Grupo de Staff vs Coordinadores
  const isOnlyStaff =
    supervisorStats.length > 0 &&
    supervisorStats.every((s) => s.supervisor.toLowerCase() === "staff");

  return (
    <div
      style={{ boxShadow: '0 25px 60px rgba(0, 0, 0, 0.22)', border: 'none', background: '#ffffff' }}
      className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between h-full min-h-[360px]"
    >
      <div>
        {/* Header: Título "Supervisor", Botón Quitar Filtro y Contador */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E8EAE3]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#EAF5EC] text-[#1E7E34] flex items-center justify-center shrink-0 border border-[#CCE8D1]">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-['Montserrat'] font-sans font-extrabold text-[#334155] text-base tracking-tight">
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
                {isOnlyStaff
                  ? `${supervisorStats.length} Grupo de Staff`
                  : `${supervisorStats.length} ${supervisorStats.length === 1 ? "Coordinador" : "Coordinadores"}`}
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
            const isStaff = item.supervisor.toLowerCase() === "staff";
            const displayName = isStaff ? "Supervisor" : item.supervisor;

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
                title={isSelected ? `Filtro activo: ${displayName} (Clic para desmarcar)` : `Filtrar por supervisor: ${displayName}`}
              >
                <div className="truncate pr-2 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-[#1E7E34] text-white flex items-center justify-center shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                    <p
                      className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                        isSelected ? "text-[#1E7E34]" : "text-[#2D332A] group-hover:text-[#1E7E34]"
                      }`}
                    >
                      {displayName}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#6B7366] mt-0.5">
                    {item.total} {hasSupervisorTestSelected ? "staff" : item.total === 1 ? "asesor" : "asesores"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      item.porcentajeAvance >= 80
                        ? "bg-[#EAF5EC] text-[#1E7E34] border border-[#CCE8D1]"
                        : item.porcentajeAvance >= 40
                        ? "bg-[#FEF6E7] text-[#B76E00] border border-[#F6DCAC]"
                        : "bg-[#FDECEB] text-[#C5221F] border border-[#F8C8C6]"
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
