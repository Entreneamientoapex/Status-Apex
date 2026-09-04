import React from "react";
import { AgentRecord } from "../types";
import { AnalysisHistoryCard } from "./AnalysisHistoryCard";
import { JCCCard } from "./JCCCard";
import { SupervisorCard } from "./SupervisorCard";
import { SheetAnalysisRecord } from "../utils/googleSheetsService";
import { isBajaRecord } from "../utils/bajaFilter";

interface AnalyticsChartsProps {
  records: AgentRecord[];
  history: SheetAnalysisRecord[];
  activeAnalysisId: string | null;
  isLoadingHistory?: boolean;
  onSelectAnalysis: (analysis: SheetAnalysisRecord) => void;
  onRefreshSheets: () => void;
  isAdmin?: boolean;
  selectedTestIds?: string[];
  onToggleSelectTest?: (id: string, e?: React.MouseEvent) => void;
  onSelectAllTests?: () => void;
  onToggleTestStatus?: (analysis: SheetAnalysisRecord) => void;
  togglingTestId?: string | null;
  selectedJCC?: string | null;
  onSelectJCC?: (jccName: string | null) => void;
  selectedSupervisor?: string | null;
  onSelectSupervisor?: (supervisorName: string | null) => void;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  records,
  history,
  activeAnalysisId,
  isLoadingHistory = false,
  onSelectAnalysis,
  onRefreshSheets,
  isAdmin = false,
  selectedTestIds = [],
  onToggleSelectTest,
  onSelectAllTests,
  onToggleTestStatus,
  togglingTestId = null,
  selectedJCC = null,
  onSelectJCC,
  selectedSupervisor = null,
  onSelectSupervisor,
}) => {
  if (records.length === 0 && history.length === 0) return null;

  // Filtrar registros de baja
  const cleanValidRecords = React.useMemo(() => {
    return records.filter((r) => !isBajaRecord(r));
  }, [records]);

  // Si hay un JCC seleccionado, la columna de Supervisores debe recibir los asesores correspondientes a ese JCC
  const supervisorColumnRecords = React.useMemo(() => {
    if (!selectedJCC) return cleanValidRecords;
    const jccLower = selectedJCC.trim().toLowerCase();
    return cleanValidRecords.filter((r) => {
      const rawJcc = r.jcc?.trim();
      const jccName = rawJcc && rawJcc.length > 0 && rawJcc !== "-" ? rawJcc : "Sin JCC Asignado";
      return jccName.toLowerCase() === jccLower;
    });
  }, [cleanValidRecords, selectedJCC]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* COLUMNA 1 (Izquierda): Cursos Pendientes (Pestañas de Google Sheets) */}
      <AnalysisHistoryCard
        history={history}
        activeAnalysisId={activeAnalysisId}
        isLoading={isLoadingHistory}
        onSelectAnalysis={onSelectAnalysis}
        onRefreshSheets={onRefreshSheets}
        isAdmin={isAdmin}
        selectedTestIds={selectedTestIds}
        onToggleSelectTest={onToggleSelectTest}
        onSelectAllTests={onSelectAllTests}
        onToggleTestStatus={onToggleTestStatus}
        togglingTestId={togglingTestId}
      />

      {/* COLUMNA 2 (Central): JCC (Agrupación dinámica de asesores por JCC y % de avance/tests) */}
      <JCCCard
        records={cleanValidRecords}
        history={history}
        selectedTestIds={selectedTestIds}
        activeAnalysisId={activeAnalysisId}
        selectedJCC={selectedJCC}
        onSelectJCC={onSelectJCC}
      />

      {/* COLUMNA 3 (Derecha): Supervisor (Buscador en tiempo real, coordinadores dependientes del JCC y % de avance/tests) */}
      <SupervisorCard
        records={supervisorColumnRecords}
        history={history}
        selectedTestIds={selectedTestIds}
        activeAnalysisId={activeAnalysisId}
        selectedSupervisor={selectedSupervisor}
        onSelectSupervisor={onSelectSupervisor}
      />
    </div>
  );
};
