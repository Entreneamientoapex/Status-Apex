import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  UserCheck,
  UserX,
  ExternalLink,
  Users,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Sparkles,
  Shield,
  Layers,
} from "lucide-react";
import { AgentRecord, ApprovalStatus, FilterState } from "../types";
import { UserRole } from "../utils/googleService";

interface AgentTableProps {
  records: AgentRecord[];
  userRole?: UserRole;
  onSelectAgent: (agent: AgentRecord) => void;
  onOpenCertificate: (agent: AgentRecord) => void;
  onEditAgent: (agent: AgentRecord) => void;
  onDeleteAgent: (agentId: string) => void;
  onToggleStatus: (agentId: string, currentStatus: ApprovalStatus) => void;
  onBulkUpdateStatus: (agentIds: string[], status: ApprovalStatus) => void;
  onBulkDelete: (agentIds: string[]) => void;
  externalStatusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
}

type TabType = "ALL" | "Aprobado" | "No Aprobado" | "Pendiente" | "Supervisores";

interface SupervisorGroup {
  name: string;
  agents: AgentRecord[];
  total: number;
  approved: number;
  failed: number;
  pending: number;
  retakeApproved: number;
  passRate: number;
  avgScore: number | null;
}

export const AgentTable: React.FC<AgentTableProps> = ({
  records,
  userRole = "Lector",
  onSelectAgent,
  onOpenCertificate,
  onEditAgent,
  onDeleteAgent,
  onToggleStatus,
  onBulkUpdateStatus,
  onBulkDelete,
  externalStatusFilter,
  onStatusFilterChange,
}) => {
  const isEditor = userRole === "Editor";
  const [activeTab, setActiveTab] = useState<TabType>(
    (externalStatusFilter as TabType) || "ALL"
  );

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    status: (externalStatusFilter as any) || "ALL",
    trainingName: "ALL",
    trainerName: "ALL",
    campaign: "ALL",
    sortBy: "completionDate",
    sortOrder: "desc",
    onlyNeedsRetraining: false,
  });

  // Track expanded supervisors for accordion
  const [expandedSupervisors, setExpandedSupervisors] = useState<Record<string, boolean>>({});

  // Sync external status filter if provided
  React.useEffect(() => {
    if (externalStatusFilter !== undefined && externalStatusFilter !== activeTab) {
      if (externalStatusFilter === "Supervisores") {
        setActiveTab("Supervisores");
      } else {
        setActiveTab(externalStatusFilter as TabType);
        setFilters((prev) => ({ ...prev, status: externalStatusFilter as any }));
      }
    }
  }, [externalStatusFilter]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "Supervisores") {
      // Keep search and other filters active, but status filter is not restricting the supervisor groups
      if (onStatusFilterChange) onStatusFilterChange("Supervisores");
    } else {
      setFilters((f) => ({ ...f, status: tab }));
      if (onStatusFilterChange) onStatusFilterChange(tab);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Unique dropdown options
  const uniqueTrainings = useMemo(() => {
    const set = new Set(records.map((r) => r.trainingName).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const uniqueTrainers = useMemo(() => {
    const set = new Set(records.map((r) => r.trainerName).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const uniqueCampaigns = useMemo(() => {
    const set = new Set(records.map((r) => r.campaign).filter(Boolean));
    return Array.from(set as Set<string>);
  }, [records]);

  // Unique Supervisors count
  const supervisorGroups: SupervisorGroup[] = useMemo(() => {
    const map = new Map<string, AgentRecord[]>();

    records.forEach((r) => {
      const supKey = r.supervisor?.trim() || "Sin Supervisor Asignado";
      if (!map.has(supKey)) {
        map.set(supKey, []);
      }
      map.get(supKey)!.push(r);
    });

    const groups: SupervisorGroup[] = [];

    map.forEach((agentsList, supName) => {
      // Apply filters to agents within supervisor if search query or filters are active
      const filteredAgents = agentsList.filter((r) => {
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchSup = supName.toLowerCase().includes(q);
          const matchName = r.agentName.toLowerCase().includes(q);
          const matchId = (r.agentId || "").toLowerCase().includes(q);
          const matchTraining = r.trainingName.toLowerCase().includes(q);
          const matchTrainer = r.trainerName.toLowerCase().includes(q);
          const matchCampaign = (r.campaign || "").toLowerCase().includes(q);
          if (!matchSup && !matchName && !matchId && !matchTraining && !matchTrainer && !matchCampaign) {
            return false;
          }
        }

        if (filters.trainingName !== "ALL" && r.trainingName !== filters.trainingName) {
          return false;
        }
        if (filters.trainerName !== "ALL" && r.trainerName !== filters.trainerName) {
          return false;
        }
        if (filters.campaign !== "ALL" && r.campaign !== filters.campaign) {
          return false;
        }
        if (filters.onlyNeedsRetraining && !r.needsRetraining) {
          return false;
        }
        return true;
      });

      if (filteredAgents.length > 0) {
        const total = filteredAgents.length;
        const approved = filteredAgents.filter((a) => a.status === "Aprobado").length;
        const failed = filteredAgents.filter((a) => a.status === "No Aprobado").length;
        const pending = filteredAgents.filter((a) => a.status !== "Aprobado" && a.status !== "No Aprobado").length;
        const retakeApproved = filteredAgents.filter((a) => a.passedInRetake).length;
        const passRate = total > 0 ? Math.round((approved / total) * 100) : 0;
        const scores = filteredAgents.map((a) => a.score).filter((s): s is number => typeof s === "number");
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

        groups.push({
          name: supName,
          agents: filteredAgents,
          total,
          approved,
          failed,
          pending,
          retakeApproved,
          passRate,
          avgScore,
        });
      }
    });

    // Sort supervisor groups alphabetically (putting "Sin Supervisor" last)
    return groups.sort((a, b) => {
      if (a.name === "Sin Supervisor Asignado") return 1;
      if (b.name === "Sin Supervisor Asignado") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [records, filters]);

  const uniqueSupervisorsCount = useMemo(() => {
    const set = new Set(records.map((r) => r.supervisor?.trim() || "Sin Supervisor Asignado"));
    return set.size;
  }, [records]);

  // Filtered and Sorted Records for Standard Table View
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Search query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchName = r.agentName.toLowerCase().includes(q);
          const matchId = (r.agentId || "").toLowerCase().includes(q);
          const matchTraining = r.trainingName.toLowerCase().includes(q);
          const matchTrainer = r.trainerName.toLowerCase().includes(q);
          const matchSupervisor = (r.supervisor || "").toLowerCase().includes(q);
          const matchCampaign = (r.campaign || "").toLowerCase().includes(q);
          if (!matchName && !matchId && !matchTraining && !matchTrainer && !matchSupervisor && !matchCampaign) {
            return false;
          }
        }

        // Status
        if (filters.status !== "ALL" && r.status !== filters.status) {
          return false;
        }

        // Training
        if (filters.trainingName !== "ALL" && r.trainingName !== filters.trainingName) {
          return false;
        }

        // Trainer
        if (filters.trainerName !== "ALL" && r.trainerName !== filters.trainerName) {
          return false;
        }

        // Campaign
        if (filters.campaign !== "ALL" && r.campaign !== filters.campaign) {
          return false;
        }

        // Only Retraining
        if (filters.onlyNeedsRetraining && !r.needsRetraining) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[filters.sortBy];
        let valB: any = b[filters.sortBy];

        if (filters.sortBy === "score") {
          valA = a.score ?? -1;
          valB = b.score ?? -1;
        }

        if (valA < valB) return filters.sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return filters.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [records, filters]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSort = (field: FilterState["sortBy"]) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === "asc" ? "desc" : "asc",
    }));
  };

  const toggleSupervisorAccordion = (supName: string) => {
    setExpandedSupervisors((prev) => ({
      ...prev,
      [supName]: !prev[supName],
    }));
  };

  const expandAllSupervisors = () => {
    const all: Record<string, boolean> = {};
    supervisorGroups.forEach((g) => {
      all[g.name] = true;
    });
    setExpandedSupervisors(all);
  };

  const collapseAllSupervisors = () => {
    setExpandedSupervisors({});
  };

  const totalApproved = records.filter((r) => r.status === "Aprobado").length;
  const totalFailed = records.filter((r) => r.status === "No Aprobado").length;
  const totalPending = records.filter((r) => r.status === "Pendiente").length;

  return (
    <div id="agent-table-section" className="bg-white border border-[#D9DED4] rounded-2xl shadow-xs overflow-hidden">
      {/* Control Bar: Tabs & Search */}
      <div className="p-4 border-b border-[#F1F3EE] space-y-4">
        {/* Status & View Mode Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F1F3EE] rounded-xl border border-[#D9DED4] text-xs">
            {/* Todos */}
            <button
              onClick={() => handleTabChange("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-white text-[#2D332A] shadow-xs font-semibold"
                  : "text-[#6B7366] hover:text-[#2D332A]"
              }`}
            >
              Todos ({records.length})
            </button>

            {/* Aprobados */}
            <button
              onClick={() => handleTabChange("Aprobado")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "Aprobado"
                  ? "bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6] font-semibold shadow-xs"
                  : "text-[#6B7366] hover:text-[#4F7A4F]"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#4F7A4F]" />
              <span>Aprobados ({totalApproved})</span>
            </button>

            {/* No Aprobados */}
            <button
              onClick={() => handleTabChange("No Aprobado")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "No Aprobado"
                  ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5] font-semibold shadow-xs"
                  : "text-[#6B7366] hover:text-[#9E4A4A]"
              }`}
            >
              <XCircle className="h-3.5 w-3.5 text-[#9E4A4A]" />
              <span>No Aprobados ({totalFailed})</span>
            </button>

            {/* Pendientes */}
            <button
              onClick={() => handleTabChange("Pendiente")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "Pendiente"
                  ? "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF] font-semibold shadow-xs"
                  : "text-[#6B7366] hover:text-[#8C733E]"
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-[#8C733E]" />
              <span>Pendientes ({totalPending})</span>
            </button>

            {/* NEW: Supervisores Tab */}
            <button
              onClick={() => handleTabChange("Supervisores")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "Supervisores"
                  ? "bg-[#2D332A] text-white shadow-xs font-semibold"
                  : "text-[#2D332A] hover:bg-[#E8EAE3] font-medium"
              }`}
              title="Ver datos agrupados por Supervisor / Team Leader"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Supervisores ({uniqueSupervisorsCount})</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {activeTab === "Supervisores" && (
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={expandAllSupervisors}
                  className="px-2.5 py-1.5 bg-[#F9F9F7] hover:bg-[#F1F3EE] border border-[#D9DED4] text-[#2D332A] rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Expandir Todos
                </button>
                <button
                  onClick={collapseAllSupervisors}
                  className="px-2.5 py-1.5 bg-[#F9F9F7] hover:bg-[#F1F3EE] border border-[#D9DED4] text-[#6B7366] hover:text-[#2D332A] rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Colapsar Todos
                </button>
              </div>
            )}

            {/* Retraining Toggle */}
            <button
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  onlyNeedsRetraining: !f.onlyNeedsRetraining,
                }))
              }
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                filters.onlyNeedsRetraining
                  ? "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                  : "bg-[#F9F9F7] text-[#6B7366] border-[#D9DED4] hover:text-[#2D332A]"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-[#8C733E]" />
              <span>Requieren Refuerzo</span>
            </button>
          </div>
        </div>

        {/* Search and Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8DA189]" />
            <input
              type="text"
              placeholder={
                activeTab === "Supervisores"
                  ? "Buscar supervisor, agente, DNI..."
                  : "Buscar por agente, supervisor, DNI..."
              }
              value={filters.searchQuery}
              onChange={(e) => setFilters((f) => ({ ...f, searchQuery: e.target.value }))}
              className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
            />
          </div>

          {/* Training Course Filter */}
          <select
            value={filters.trainingName}
            onChange={(e) => setFilters((f) => ({ ...f, trainingName: e.target.value }))}
            className="bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 cursor-pointer truncate"
          >
            <option value="ALL">Todos los Cursos / Trainers</option>
            {uniqueTrainings.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Trainer Filter */}
          <select
            value={filters.trainerName}
            onChange={(e) => setFilters((f) => ({ ...f, trainerName: e.target.value }))}
            className="bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 cursor-pointer truncate"
          >
            <option value="ALL">Todos los Instructores / Trainers</option>
            {uniqueTrainers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Campaign Filter */}
          <select
            value={filters.campaign}
            onChange={(e) => setFilters((f) => ({ ...f, campaign: e.target.value }))}
            className="bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 cursor-pointer truncate"
          >
            <option value="ALL">Todas las Campañas / Áreas</option>
            {uniqueCampaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Action Bar (when rows are selected in standard view and isEditor) */}
        {activeTab !== "Supervisores" && selectedIds.length > 0 && isEditor && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#E6F3E6] border border-[#C6DEC6] rounded-xl text-xs">
            <span className="text-[#4F7A4F] font-semibold">
              {selectedIds.length} agente(s) seleccionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onBulkUpdateStatus(selectedIds, "Aprobado");
                  setSelectedIds([]);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#4F7A4F] hover:bg-[#3F633F] text-white font-medium rounded-lg transition-colors cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Marcar Aprobados</span>
              </button>
              <button
                onClick={() => {
                  onBulkUpdateStatus(selectedIds, "No Aprobado");
                  setSelectedIds([]);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#9E4A4A] hover:bg-[#853D3D] text-white font-medium rounded-lg transition-colors cursor-pointer"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Marcar No Aprobados</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar los ${selectedIds.length} agentes seleccionados?`)) {
                    onBulkDelete(selectedIds);
                    setSelectedIds([]);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5] font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: SUPERVISORES ACCORDION GROUPED VIEW */}
      {/* ========================================================================= */}
      {activeTab === "Supervisores" ? (
        <div className="p-4 sm:p-6 space-y-4 bg-[#FAFBF9]">
          {supervisorGroups.length === 0 ? (
            <div className="p-12 text-center text-[#6B7366] bg-white rounded-xl border border-[#D9DED4]">
              <div className="flex flex-col items-center justify-center gap-2">
                <Users className="h-8 w-8 text-[#8DA189]" />
                <p className="font-semibold text-[#2D332A]">No se encontraron supervisores coincidentes</p>
                <p className="text-xs text-[#6B7366]">Modifica los filtros de búsqueda o importa una lista con supervisores.</p>
              </div>
            </div>
          ) : (
            supervisorGroups.map((group) => {
              const isExpanded = !!expandedSupervisors[group.name];
              const isUnassigned = group.name === "Sin Supervisor Asignado";

              return (
                <div
                  key={group.name}
                  className="bg-white border border-[#D9DED4] rounded-xl shadow-2xs overflow-hidden transition-all duration-200"
                >
                  {/* Supervisor Main Card / Header Row (Clickable Accordion) */}
                  <div
                    onClick={() => toggleSupervisorAccordion(group.name)}
                    className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                      isExpanded ? "bg-[#F9FAF8] border-b border-[#E8EAE3]" : "hover:bg-[#F9FAF8]"
                    }`}
                  >
                    {/* Left: Supervisor Identity & Agent Count */}
                    <div className="flex items-center gap-3.5 min-w-[260px]">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          isUnassigned
                            ? "bg-[#F1F3EE] text-[#6B7366] border-[#D9DED4]"
                            : "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                        }`}
                      >
                        {isUnassigned ? (
                          <Users className="h-5 w-5 text-[#8DA189]" />
                        ) : (
                          group.name.substring(0, 2).toUpperCase()
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-[#2D332A] hover:text-[#4F7A4F] transition-colors">
                            {group.name}
                          </h3>
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4]">
                            {group.total} {group.total === 1 ? "agente" : "agentes"}
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7366] mt-0.5">
                          {group.agents[0]?.campaign ? `Campaña: ${group.agents[0].campaign}` : "Equipo Operativo"}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Metrics & Performance Bar */}
                    <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                      {/* Pass Rate Bar */}
                      <div className="w-36 sm:w-44 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#6B7366] font-medium">Completado</span>
                          <span className="font-bold text-[#2D332A] font-mono">{group.passRate}%</span>
                        </div>
                        <div className="w-full bg-[#E8EAE3] h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              group.passRate >= 80
                                ? "bg-[#4F7A4F]"
                                : group.passRate >= 60
                                ? "bg-[#8C733E]"
                                : "bg-[#9E4A4A]"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, group.passRate))}%` }}
                          />
                        </div>
                      </div>

                      {/* Stat Pills */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E6F3E6] text-[#4F7A4F] font-semibold border border-[#C6DEC6]"
                          title="Agentes aprobados"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{group.approved}</span>
                          {group.retakeApproved > 0 && (
                            <span className="text-[10px] opacity-75">({group.retakeApproved} recup.)</span>
                          )}
                        </span>

                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FDF1F1] text-[#9E4A4A] font-semibold border border-[#F0D5D5]"
                          title="Agentes no aprobados"
                        >
                          <XCircle className="h-3 w-3" />
                          <span>{group.failed}</span>
                        </span>

                        {group.pending > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF5E6] text-[#8C733E] font-semibold border border-[#EBDDBF]"
                            title="Agentes pendientes"
                          >
                            <Clock className="h-3 w-3" />
                            <span>{group.pending}</span>
                          </span>
                        )}
                      </div>

                      {/* Accordion Chevron Trigger */}
                      <div className="flex items-center gap-1 text-xs text-[#6B7366] font-medium bg-[#F1F3EE] hover:bg-[#E8EAE3] px-2.5 py-1.5 rounded-lg transition-colors">
                        <span>{isExpanded ? "Ocultar" : "Ver agentes"}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-[#2D332A]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[#2D332A]" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Accordion Sub-list Body (Agents belonging exclusively to this supervisor) */}
                  {isExpanded && (
                    <div className="divide-y divide-[#F1F3EE] bg-white">
                      {group.agents.map((agent, idx) => {
                        const isApproved = agent.status === "Aprobado";
                        const isFailed = agent.status === "No Aprobado";

                        return (
                          <div
                            key={agent.id}
                            className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F9FAF8] transition-colors"
                          >
                            {/* Left: Agent Info */}
                            <div className="flex items-center gap-3 min-w-[220px]">
                              <div className="w-7 h-7 rounded-full bg-[#D9E2D5] text-[#2D332A] text-[10px] flex items-center justify-center font-bold shrink-0">
                                {agent.agentName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    onClick={() => onSelectAgent(agent)}
                                    className="font-medium text-xs sm:text-sm text-[#2D332A] hover:text-[#4F7A4F] cursor-pointer transition-colors"
                                  >
                                    {agent.agentName}
                                  </span>
                                  {agent.passedInRetake && (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF5EE] text-[#2D6A4F] border border-[#B7E4C7]"
                                      title={agent.retakeDetails || "Aprobó en instancia de recuperatorio"}
                                    >
                                      <Sparkles className="h-2.5 w-2.5 text-[#2D6A4F]" />
                                      <span>Recuperatorio</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[#6B7366] mt-0.5">
                                  {agent.agentId && (
                                    <span className="font-mono bg-[#F1F3EE] px-1.5 py-0.2 rounded text-[#2D332A]">
                                      {agent.agentId}
                                    </span>
                                  )}
                                  <span className="truncate max-w-[200px]">{agent.trainingName}</span>
                                </div>
                              </div>
                            </div>

                            {/* Center: Score & Attendance */}
                            <div className="flex items-center gap-4 text-xs font-mono">
                              <div>
                                <span className="text-[#6B7366] text-[10px] block font-sans">Nota:</span>
                                {agent.score !== null ? (
                                  <span
                                    className={`font-bold ${
                                      agent.score >= (agent.minPassingScore || 80)
                                        ? "text-[#4F7A4F]"
                                        : "text-[#9E4A4A]"
                                    }`}
                                  >
                                    {agent.score} pts
                                  </span>
                                ) : (
                                  <span className="text-[#8DA189] italic">S/N</span>
                                )}
                              </div>

                              <div>
                                <span className="text-[#6B7366] text-[10px] block font-sans">Asistencia:</span>
                                <span className="font-semibold text-[#2D332A]">
                                  {agent.attendancePercentage !== undefined && agent.attendancePercentage !== null
                                    ? `${agent.attendancePercentage}%`
                                    : "100%"}
                                </span>
                              </div>
                            </div>

                            {/* Right: Status Badge & Quick Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onToggleStatus(agent.id, agent.status)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                  isApproved
                                    ? "bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6] hover:bg-[#D9E2D5]"
                                    : isFailed
                                    ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5] hover:bg-[#F3E6E6]"
                                    : "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF] hover:bg-[#F5ECCE]"
                                }`}
                                title="Clic para alternar estado"
                              >
                                {isApproved ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-[#4F7A4F]" />
                                ) : isFailed ? (
                                  <XCircle className="h-3.5 w-3.5 text-[#9E4A4A]" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-[#8C733E]" />
                                )}
                                <span>{agent.status}</span>
                              </button>

                              <button
                                onClick={() => onSelectAgent(agent)}
                                className="p-1.5 text-[#6B7366] hover:text-[#2D332A] hover:bg-[#F1F3EE] rounded-lg transition-colors cursor-pointer"
                                title="Ver Ficha Completa"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => onEditAgent(agent)}
                                className="p-1.5 text-[#6B7366] hover:text-[#8DA189] hover:bg-[#F1F3EE] rounded-lg transition-colors cursor-pointer"
                                title="Editar Agente"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW MODE 2: STANDARD DETAILED TABLE VIEW */
        /* ========================================================================= */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#F9F9F7] text-[#6B7366] font-semibold border-b border-[#E8EAE3]">
              <tr>
                <th className="p-3.5 sm:p-4 w-10">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      filteredRecords.length > 0 &&
                      selectedIds.length === filteredRecords.length
                    }
                    className="rounded border-[#D9DED4] text-[#8DA189] focus:ring-[#8DA189] cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSort("agentName")}
                  className="p-3.5 sm:p-4 cursor-pointer hover:text-[#2D332A] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Agente & Identificación</span>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60 text-[#8DA189]" />
                  </div>
                </th>
                <th className="p-3.5 sm:p-4">Supervisor & Campaña</th>
                <th className="p-3.5 sm:p-4">Capacitación / Trainer</th>
                <th
                  onClick={() => handleSort("completionDate")}
                  className="p-3.5 sm:p-4 cursor-pointer hover:text-[#2D332A] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Fecha</span>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60 text-[#8DA189]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("score")}
                  className="p-3.5 sm:p-4 cursor-pointer hover:text-[#2D332A] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Calificación</span>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60 text-[#8DA189]" />
                  </div>
                </th>
                <th className="p-3.5 sm:p-4 text-center">Asistencia</th>
                <th
                  onClick={() => handleSort("status")}
                  className="p-3.5 sm:p-4 cursor-pointer hover:text-[#2D332A] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Estado Aprobación</span>
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60 text-[#8DA189]" />
                  </div>
                </th>
                <th className="p-3.5 sm:p-4 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F3EE] text-[#2D332A]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-[#6B7366]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Filter className="h-8 w-8 text-[#8DA189]" />
                      <p className="font-semibold text-[#2D332A]">No se encontraron agentes con los filtros actuales</p>
                      <p className="text-xs text-[#6B7366]">Intenta modificar los términos de búsqueda o los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((agent) => {
                  const isSelected = selectedIds.includes(agent.id);
                  const isApproved = agent.status === "Aprobado";
                  const isFailed = agent.status === "No Aprobado";

                  return (
                    <tr
                      key={agent.id}
                      className={`hover:bg-[#F9F9F7] transition-colors group ${
                        isSelected ? "bg-[#E6F3E6]/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 sm:p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(agent.id)}
                          className="rounded border-[#D9DED4] text-[#8DA189] focus:ring-[#8DA189] cursor-pointer"
                        />
                      </td>

                      {/* Agent Name & ID */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#D9E2D5] text-[#2D332A] text-[11px] flex items-center justify-center font-bold shrink-0">
                            {agent.agentName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div
                                onClick={() => onSelectAgent(agent)}
                                className="font-medium text-[#2D332A] hover:text-[#4F7A4F] cursor-pointer transition-colors"
                              >
                                {agent.agentName}
                              </div>
                              {agent.passedInRetake && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF5EE] text-[#2D6A4F] border border-[#B7E4C7]"
                                  title={agent.retakeDetails || "Aprobó en instancia de recuperatorio"}
                                >
                                  <Sparkles className="h-2.5 w-2.5 text-[#2D6A4F]" />
                                  <span>Recuperatorio</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#6B7366]">
                              {agent.agentId && (
                                <span className="font-mono bg-[#F1F3EE] px-1.5 py-0.5 rounded text-[#2D332A]">
                                  {agent.agentId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Supervisor & Campaign */}
                      <td className="p-3.5 sm:p-4">
                        <div className="font-medium text-[#2D332A] flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-[#8DA189]" />
                          <span className="truncate max-w-[170px]" title={agent.supervisor || "Sin Supervisor"}>
                            {agent.supervisor || "Sin asignar"}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6B7366] mt-0.5 truncate max-w-[170px]">
                          {agent.campaign || "General"}
                        </div>
                      </td>

                      {/* Training & Trainer */}
                      <td className="p-3.5 sm:p-4">
                        <div className="font-medium text-[#2D332A] line-clamp-1 max-w-[220px]" title={agent.trainingName}>
                          {agent.trainingName}
                        </div>
                        <div className="text-[11px] text-[#6B7366] flex items-center gap-1 mt-0.5">
                          <span className="text-[#8DA189]">Trainer:</span>
                          <span className="truncate max-w-[160px]">{agent.trainerName}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 sm:p-4 text-xs font-mono text-[#6B7366] whitespace-nowrap">
                        {agent.completionDate || "N/D"}
                      </td>

                      {/* Score */}
                      <td className="p-3.5 sm:p-4">
                        {agent.score !== null ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-semibold text-sm sm:text-base font-mono ${
                                  agent.score >= (agent.minPassingScore || 80)
                                    ? "text-[#4F7A4F]"
                                    : "text-[#9E4A4A]"
                                }`}
                              >
                                {agent.score}
                              </span>
                              <span className="text-[11px] text-[#6B7366]">
                                /{agent.minPassingScore || 80}
                              </span>
                            </div>
                            {agent.passedInRetake && (
                              <div className="text-[10px] text-[#3D704D] font-medium bg-[#EBF5EE] px-1 py-0.5 rounded border border-[#BDE0C7] mt-0.5 inline-block">
                                Recup: {agent.retakeScore} pts
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#8DA189] italic text-xs">Sin nota</span>
                        )}
                      </td>

                      {/* Attendance */}
                      <td className="p-3.5 sm:p-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (agent.attendancePercentage || 100) >= 80
                              ? "bg-[#F1F3EE] text-[#2D332A]"
                              : "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF]"
                          }`}
                        >
                          {agent.attendancePercentage !== undefined && agent.attendancePercentage !== null
                            ? `${agent.attendancePercentage}%`
                            : "100%"}
                        </span>
                      </td>

                      {/* Approval Status Badge with toggle (if editor) */}
                      <td className="p-3.5 sm:p-4">
                        {isEditor ? (
                          <button
                            onClick={() => onToggleStatus(agent.id, agent.status)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              isApproved
                                ? "bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6] hover:bg-[#D9E2D5]"
                                : isFailed
                                ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5] hover:bg-[#F3E6E6]"
                                : "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF] hover:bg-[#F5ECCE]"
                            }`}
                            title="Haz clic para cambiar estado de aprobación"
                          >
                            {isApproved ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#4F7A4F]" />
                            ) : isFailed ? (
                              <XCircle className="h-3.5 w-3.5 text-[#9E4A4A]" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-[#8C733E]" />
                            )}
                            <span>{agent.status}</span>
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              isApproved
                                ? "bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6]"
                                : isFailed
                                ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5]"
                                : "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF]"
                            }`}
                          >
                            {isApproved ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#4F7A4F]" />
                            ) : isFailed ? (
                              <XCircle className="h-3.5 w-3.5 text-[#9E4A4A]" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-[#8C733E]" />
                            )}
                            <span>{agent.status}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 sm:p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details */}
                          <button
                            onClick={() => onSelectAgent(agent)}
                            className="p-1.5 text-[#6B7366] hover:text-[#2D332A] hover:bg-[#F1F3EE] rounded-lg transition-colors cursor-pointer"
                            title="Ver ficha completa y feedback"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>

                          {/* Edit Agent (Editor only) */}
                          {isEditor && (
                            <button
                              onClick={() => onEditAgent(agent)}
                              className="p-1.5 text-[#6B7366] hover:text-[#8DA189] hover:bg-[#F1F3EE] rounded-lg transition-colors cursor-pointer"
                              title="Editar registro"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete Agent (Editor only) */}
                          {isEditor && (
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar el registro de ${agent.agentName}?`)) {
                                  onDeleteAgent(agent.id);
                                }
                              }}
                              className="p-1.5 text-[#6B7366] hover:text-[#9E4A4A] hover:bg-[#FDF1F1] rounded-lg transition-colors cursor-pointer"
                              title="Eliminar de la lista"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Footer */}
      <div className="p-4 bg-[#F9F9F7] border-t border-[#E8EAE3] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7366]">
        <div>
          {activeTab === "Supervisores" ? (
            <span>
              Mostrando <strong className="text-[#2D332A]">{supervisorGroups.length}</strong> supervisores con{" "}
              <strong className="text-[#2D332A]">{records.length}</strong> agentes en total
            </span>
          ) : (
            <span>
              Mostrando <strong className="text-[#2D332A]">{filteredRecords.length}</strong> de{" "}
              <strong className="text-[#2D332A]">{records.length}</strong> agentes en total
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#4F7A4F] font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {totalApproved} aprobados
          </span>
          <span className="flex items-center gap-1.5 text-[#9E4A4A] font-medium">
            <XCircle className="h-3.5 w-3.5" />
            {totalFailed} no aprobados
          </span>
          {totalPending > 0 && (
            <span className="flex items-center gap-1.5 text-[#8C733E] font-medium">
              <Clock className="h-3.5 w-3.5" />
              {totalPending} pendientes
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
