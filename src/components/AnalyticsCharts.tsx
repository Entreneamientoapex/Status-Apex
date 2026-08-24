import React, { useState } from "react";
import { AgentRecord } from "../types";
import { AnalysisHistoryCard } from "./AnalysisHistoryCard";
import { SupervisorCard } from "./SupervisorCard";
import { SupervisorAgentsCard } from "./SupervisorAgentsCard";
import { SheetAnalysisRecord } from "../utils/googleSheetsService";

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
}) => {
  // Estado interactivo compartido: Supervisor actualmente seleccionado en el Cuadro Central
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);

  const handleSelectSupervisor = (supervisorName: string) => {
    // Si se hace clic en el mismo supervisor, se mantiene o se puede alternar; aquí seleccionamos el nuevo
    setSelectedSupervisor(supervisorName);
  };

  const handleClearSupervisor = () => {
    setSelectedSupervisor(null);
  };

  if (records.length === 0 && history.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* CUADRO 1 (Izquierda): Desempeño de Trainers (Pestañas de Google Sheets) */}
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

      {/* CUADRO 2 (Centro): Supervisor (Lista de coordinadores con cantidad de asesores y media de puntos) */}
      <SupervisorCard
        records={records}
        selectedSupervisor={selectedSupervisor}
        onSelectSupervisor={handleSelectSupervisor}
      />

      {/* CUADRO 3 (Derecha): Agentes (Desglose interactivo con notas telefónica, digital, recuperatorio y estado) */}
      <SupervisorAgentsCard
        records={records}
        selectedSupervisor={selectedSupervisor}
        onClearSupervisor={handleClearSupervisor}
      />
    </div>
  );
};
