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
  FileSpreadsheet,
  X,
} from "lucide-react";
import { AgentRecord, ApprovalStatus, FilterState } from "../types";
import { UserRole } from "../utils/googleService";
import { SheetAnalysisRecord } from "../utils/googleSheetsService";

interface AgentTableProps {
  records: AgentRecord[];
  history?: SheetAnalysisRecord[];
  selectedTestIds?: string[];
  activeAnalysisId?: string | null;
  selectedSupervisor?: string | null;
  selectedJCC?: string | null;
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
  onClearSupervisor?: () => void;
  onClearJCC?: () => void;
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
  history = [],
  selectedTestIds = [],
  activeAnalysisId = null,
  selectedSupervisor = null,
  selectedJCC = null,
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
  onClearSupervisor,
  onClearJCC,
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
      if (onStatusFilterChange) onStatusFilterChange("Supervisores");
    } else {
      setFilters((f) => ({ ...f, status: tab }));
      if (onStatusFilterChange) onStatusFilterChange(tab);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 1. Determine active test sheets / campaigns to display
  const activeTests = useMemo<SheetAnalysisRecord[]>(() => {
    if (history && history.length > 0) {
      if (selectedTestIds && selectedTestIds.length > 0) {
        const selected = history.filter((h) => selectedTestIds.includes(h.id));
        if (selected.length > 0) return selected;
      }
      if (activeAnalysisId) {
        const active = history.find((h) => h.id === activeAnalysisId);
        if (active) return [active];
      }
      return [history[0]];
    }

    // Fallback single virtual test if history is empty
    return [
      {
        id: "virtual-main",
        name: records[0]?.trainingName || "Evaluación Principal",
        sheetName: records[0]?.trainingName || "Evaluación Principal",
        createdAt: new Date().toISOString(),
        createdAtFormatted: records[0]?.completionDate || new Date().toLocaleDateString(),
        totalAgents: records.length,
        approvedCount: records.filter((r) => r.status === "Aprobado").length,
        failedCount: records.filter((r) => r.status === "No Aprobado").length,
        pendingCount: records.filter((r) => r.status !== "Aprobado" && r.status !== "No Aprobado").length,
        passRate: records.length > 0 ? Math.round((records.filter((r) => r.status === "Aprobado").length / records.length) * 100) : 0,
        averageScore: 0,
        trainingTopic: records[0]?.trainingName || "Evaluación Principal",
        trainer: records[0]?.trainerName || "Apex Trainer",
        records: records,
      },
    ];
  }, [history, selectedTestIds, activeAnalysisId, records]);

  // 2. Strict Cross Filtering logic per test
  const filterAndSortTestRecords = (testItem: SheetAnalysisRecord) => {
    const rawList = testItem.records && testItem.records.length > 0 ? testItem.records : records;

    return rawList
      .filter((r) => {
        // Strict Supervisor Cross-Filter (from selected supervisor filter)
        if (selectedSupervisor) {
          const supLower = selectedSupervisor.trim().toLowerCase();
          const rawSup = r.supervisor?.trim();
          const supName = rawSup && rawSup.length > 0 ? rawSup : "Sin Supervisor Asignado";
          if (supName.toLowerCase() !== supLower) return false;
        }

        // Strict JCC Cross-Filter
        if (selectedJCC) {
          const jccLower = selectedJCC.trim().toLowerCase();
          const rawJcc = r.jcc?.trim();
          const jccName = rawJcc && rawJcc.length > 0 && rawJcc !== "-" ? rawJcc : "Sin JCC Asignado";
          if (jccName.toLowerCase() !== jccLower) return false;
        }

        // Strict Search Query Cross-Filter
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchName = (r.agentName || "").toLowerCase().includes(q);
          const matchId = (r.agentId || "").toLowerCase().includes(q);
          const matchTraining = (r.trainingName || testItem.trainingTopic || testItem.name || "").toLowerCase().includes(q);
          const matchTrainer = (r.trainerName || testItem.trainer || "").toLowerCase().includes(q);
          const matchSupervisor = (r.supervisor || "").toLowerCase().includes(q);
          const matchCampaign = (r.campaign || "").toLowerCase().includes(q);
          const matchJcc = (r.jcc || "").toLowerCase().includes(q);
          if (!matchName && !matchId && !matchTraining && !matchTrainer && !matchSupervisor && !matchCampaign && !matchJcc) {
            return false;
          }
        }

        // Status Tab Filter evaluated specifically for this test's score:
        if (filters.status !== "ALL") {
          const minScore = r.minPassingScore || 80;
          const hasScore = r.score !== null && !isNaN(r.score as any);
          const isScoreApproved = hasScore ? (r.score as number) >= minScore : r.status === "Aprobado";
          const isScoreFailed = hasScore ? (r.score as number) < minScore : r.status === "No Aprobado";
          const isScorePending = !hasScore || r.status === "Pendiente" || r.status === "Ausente";

          if (filters.status === "Aprobado" && !isScoreApproved) {
            return false;
          }
          if (filters.status === "No Aprobado" && !isScoreFailed) {
            return false;
          }
          if (filters.status === "Pendiente" && !isScorePending) {
            return false;
          }
        }

        // Training Dropdown Filter
        if (
          filters.trainingName !== "ALL" &&
          r.trainingName !== filters.trainingName &&
          testItem.name !== filters.trainingName
        ) {
          return false;
        }

        // Trainer Dropdown Filter
        if (
          filters.trainerName !== "ALL" &&
          r.trainerName !== filters.trainerName &&
          testItem.trainer !== filters.trainerName
        ) {
          return false;
        }

        // Campaign Dropdown Filter
        if (filters.campaign !== "ALL" && r.campaign !== filters.campaign) {
          return false;
        }

        // Only Retraining Filter
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
  };

  // 3. Process records for all active tests
  const testSubTablesData = useMemo(() => {
    return activeTests.map((testItem) => {
      const rawList = testItem.records && testItem.records.length > 0 ? testItem.records : records;

      // Base matching agents for this test under current Supervisor / JCC & Search criteria (before status tab)
      const baseSupervisorAgents = rawList.filter((r) => {
        if (selectedSupervisor) {
          const supLower = selectedSupervisor.trim().toLowerCase();
          const rawSup = r.supervisor?.trim();
          const supName = rawSup && rawSup.length > 0 ? rawSup : "Sin Supervisor Asignado";
          if (supName.toLowerCase() !== supLower) return false;
        }

        if (selectedJCC) {
          const jccLower = selectedJCC.trim().toLowerCase();
          const rawJcc = r.jcc?.trim();
          const jccName = rawJcc && rawJcc.length > 0 && rawJcc !== "-" ? rawJcc : "Sin JCC Asignado";
          if (jccName.toLowerCase() !== jccLower) return false;
        }

        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const matchName = (r.agentName || "").toLowerCase().includes(q);
          const matchId = (r.agentId || "").toLowerCase().includes(q);
          const matchTraining = (r.trainingName || testItem.trainingTopic || testItem.name || "").toLowerCase().includes(q);
          const matchTrainer = (r.trainerName || testItem.trainer || "").toLowerCase().includes(q);
          const matchSupervisor = (r.supervisor || "").toLowerCase().includes(q);
          const matchCampaign = (r.campaign || "").toLowerCase().includes(q);
          const matchJcc = (r.jcc || "").toLowerCase().includes(q);
          if (!matchName && !matchId && !matchTraining && !matchTrainer && !matchSupervisor && !matchCampaign && !matchJcc) {
            return false;
          }
        }

        return true;
      });

      const filteredAgents = filterAndSortTestRecords(testItem);
      const totalInTest = baseSupervisorAgents.length;
      const total = filteredAgents.length;

      // Calculate stats based on test scores
      const approved = baseSupervisorAgents.filter((a) => {
        const minScore = a.minPassingScore || 80;
        const hasScore = a.score !== null && !isNaN(a.score as any);
        return hasScore ? (a.score as number) >= minScore : a.status === "Aprobado";
      }).length;

      const failed = baseSupervisorAgents.filter((a) => {
        const minScore = a.minPassingScore || 80;
        const hasScore = a.score !== null && !isNaN(a.score as any);
        return hasScore ? (a.score as number) < minScore : a.status === "No Aprobado";
      }).length;

      const pending = baseSupervisorAgents.filter((a) => {
        const hasScore = a.score !== null && !isNaN(a.score as any);
        return !hasScore || a.status === "Pendiente" || a.status === "Ausente";
      }).length;

      const retakeApproved = baseSupervisorAgents.filter((a) => a.passedInRetake).length;
      const passRate = totalInTest > 0 ? Math.round((approved / totalInTest) * 100) : 0;
      const scores = baseSupervisorAgents
        .map((a) => a.score)
        .filter((s): s is number => typeof s === "number" && !isNaN(s));
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

      return {
        testItem,
        agents: filteredAgents,
        stats: {
          totalInTest,
          total,
          approved,
          failed,
          pending,
          retakeApproved,
          passRate,
          avgScore,
        },
      };
    });
  }, [activeTests, selectedSupervisor, selectedJCC, filters, records]);

  // Overall totals across all sub-tables
  const overallTotals = useMemo(() => {
    let totalAgents = 0;
    let totalApproved = 0;
    let totalFailed = 0;
    let totalPending = 0;

    testSubTablesData.forEach((sub) => {
      totalAgents += sub.stats.total;
      totalApproved += sub.stats.approved;
      totalFailed += sub.stats.failed;
      totalPending += sub.stats.pending;
    });

    return {
      totalAgents,
      totalApproved,
      totalFailed,
      totalPending,
    };
  }, [testSubTablesData]);

  // Unique dropdown options collected across active tests
  const uniqueTrainings = useMemo(() => {
    const set = new Set<string>();
    activeTests.forEach((t) => {
      if (t.name) set.add(t.name);
      if (t.trainingTopic) set.add(t.trainingTopic);
      (t.records || []).forEach((r) => {
        if (r.trainingName) set.add(r.trainingName);
      });
    });
    return Array.from(set).filter(Boolean);
  }, [activeTests]);

  const uniqueTrainers = useMemo(() => {
    const set = new Set<string>();
    activeTests.forEach((t) => {
      if (t.trainer) set.add(t.trainer);
      (t.records || []).forEach((r) => {
        if (r.trainerName) set.add(r.trainerName);
      });
    });
    return Array.from(set).filter(Boolean);
  }, [activeTests]);

  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    activeTests.forEach((t) => {
      (t.records || []).forEach((r) => {
        if (r.campaign) set.add(r.campaign);
      });
    });
    return Array.from(set).filter(Boolean);
  }, [activeTests]);

  // Supervisors Grouping View
  const supervisorGroups: SupervisorGroup[] = useMemo(() => {
    const map = new Map<string, AgentRecord[]>();

    testSubTablesData.forEach((sub) => {
      sub.agents.forEach((r) => {
        const supKey = r.supervisor?.trim() || "Sin Supervisor Asignado";
        if (!map.has(supKey)) {
          map.set(supKey, []);
        }
        map.get(supKey)!.push(r);
      });
    });

    const groups: SupervisorGroup[] = [];

    map.forEach((agentsList, supName) => {
      const total = agentsList.length;
      const approved = agentsList.filter((a) => a.status === "Aprobado").length;
      const failed = agentsList.filter((a) => a.status === "No Aprobado").length;
      const pending = agentsList.filter(
        (a) => a.status !== "Aprobado" && a.status !== "No Aprobado"
      ).length;
      const retakeApproved = agentsList.filter((a) => a.passedInRetake).length;
      const passRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      const scores = agentsList
        .map((a) => a.score)
        .filter((s): s is number => typeof s === "number");
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

      groups.push({
        name: supName,
        agents: agentsList,
        total,
        approved,
        failed,
        pending,
        retakeApproved,
        passRate,
        avgScore,
      });
    });

    return groups.sort((a, b) => {
      if (a.name === "Sin Supervisor Asignado") return 1;
      if (b.name === "Sin Supervisor Asignado") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [testSubTablesData]);

  const uniqueSupervisorsCount = supervisorGroups.length;

  // Selection handlers
  const allCurrentAgentIds = useMemo(() => {
    const ids: string[] = [];
    testSubTablesData.forEach((sub) => {
      sub.agents.forEach((a) => ids.push(a.id));
    });
    return ids;
  }, [testSubTablesData]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(allCurrentAgentIds);
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

  return (
    <div id="agent-table-section" className="space-y-6">
      {/* Control Bar: Tabs, Active Filters & Search */}
      <div className="bg-white border border-[#D9DED4] rounded-2xl shadow-xs p-4 space-y-4">
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
              Todos ({overallTotals.totalAgents})
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
              <span>Aprobados ({overallTotals.totalApproved})</span>
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
              <span>No Aprobados ({overallTotals.totalFailed})</span>
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
              <span>Pendientes ({overallTotals.totalPending})</span>
            </button>

            {/* Supervisores Tab */}
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
          <div className="flex items-center gap-2 flex-wrap">
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

        {/* Active Filters Pill Bar (Supervisor, JCC, Active Tests) */}
        {(selectedSupervisor || selectedJCC || activeTests.length > 1) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F3EE] text-xs">
            <span className="text-[#6B7366] font-medium flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-[#8DA189]" /> Filtros activos:
            </span>

            {/* Test count pill */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EBF2FA] text-[#1E4B8A] border border-[#C5DAF5] font-semibold">
              <Layers className="h-3.5 w-3.5 text-[#1E4B8A]" />
              <span>
                {activeTests.length}{" "}
                {activeTests.length === 1 ? "Campaña / Test Activo" : "Sub-tablas de Campañas Activas"}
              </span>
            </span>

            {/* Supervisor pill */}
            {selectedSupervisor && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EBF5EE] text-[#2D6A4F] border border-[#B7E4C7] font-semibold">
                <UserCheck className="h-3.5 w-3.5 text-[#2D6A4F]" />
                <span>Supervisor: {selectedSupervisor}</span>
                {onClearSupervisor && (
                  <button
                    onClick={onClearSupervisor}
                    className="p-0.5 hover:bg-[#D8F3DC] rounded-full text-[#2D6A4F] cursor-pointer"
                    title="Quitar filtro de supervisor"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}

            {/* JCC pill */}
            {selectedJCC && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F5F0FF] text-[#5B21B6] border border-[#DDD6FE] font-semibold">
                <Users className="h-3.5 w-3.5 text-[#5B21B6]" />
                <span>JCC: {selectedJCC}</span>
                {onClearJCC && (
                  <button
                    onClick={onClearJCC}
                    className="p-0.5 hover:bg-[#EDE9FE] rounded-full text-[#5B21B6] cursor-pointer"
                    title="Quitar filtro de JCC"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
          </div>
        )}

        {/* Search and Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8DA189]" />
            <input
              type="text"
              placeholder={
                selectedSupervisor
                  ? `Buscar en ${selectedSupervisor}...`
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
            <option value="ALL">Todas las Capacitaciones</option>
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
            <option value="ALL">Todos los Trainers</option>
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
            <option value="ALL">Todas las Campañas</option>
            {uniqueCampaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* RENDER BODY: SEGMENTED SUB-TABLES PER TEST OR SUPERVISOR VIEW */}
      {activeTab === "Supervisores" ? (
        /* ========================================================================= */
        /* VIEW MODE 1: SUPERVISOR ACCORDION GROUPS */
        /* ========================================================================= */
        <div className="bg-white border border-[#D9DED4] rounded-2xl shadow-xs p-4 space-y-3">
          {supervisorGroups.length === 0 ? (
            <div className="p-12 text-center text-[#6B7366]">
              <Users className="h-8 w-8 text-[#8DA189] mx-auto mb-2" />
              <p className="font-semibold text-[#2D332A]">No se encontraron supervisores</p>
              <p className="text-xs text-[#6B7366]">Intenta modificar los filtros de búsqueda.</p>
            </div>
          ) : (
            supervisorGroups.map((group) => {
              const isExpanded = expandedSupervisors[group.name] !== false; // Default expanded
              return (
                <div
                  key={group.name}
                  className="border border-[#E8EAE3] rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                >
                  {/* Supervisor Header Banner */}
                  <div
                    onClick={() => toggleSupervisorAccordion(group.name)}
                    className="p-3.5 bg-[#F9F9F7] hover:bg-[#F1F3EE] cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EAE3] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2D332A] text-white flex items-center justify-center font-bold text-xs">
                        {group.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#2D332A]">{group.name}</span>
                          <span className="text-[11px] font-medium text-[#6B7366] bg-white px-2 py-0.5 rounded-full border border-[#D9DED4]">
                            {group.total} {group.total === 1 ? "agente" : "agentes"}
                          </span>
                        </div>
                        {group.avgScore !== null && (
                          <span className="text-[11px] text-[#6B7366]">
                            Promedio: <strong>{group.avgScore} pts</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Badges */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E6F3E6] text-[#2D6A4F] font-bold border border-[#B7E4C7]">
                        <CheckCircle2 className="h-3 w-3" />
                        {group.approved} ({group.passRate}%)
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FDF1F1] text-[#9E4A4A] font-bold border border-[#F0D5D5]">
                        <XCircle className="h-3 w-3" />
                        {group.failed}
                      </span>
                      {group.pending > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF5E6] text-[#8C733E] font-bold border border-[#EBDDBF]">
                          <Clock className="h-3 w-3" />
                          {group.pending}
                        </span>
                      )}
                      <div className="text-[#8DA189] ml-1">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Supervisor Agent Cards */}
                  {isExpanded && (
                    <div className="p-3 divide-y divide-[#F1F3EE]">
                      {group.agents.map((agent) => {
                        const isApproved = agent.status === "Aprobado";
                        const isFailed = agent.status === "No Aprobado";
                        return (
                          <div
                            key={agent.id}
                            className="py-2.5 px-2 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F9F9F7] rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#E8EAE3] text-[#2D332A] text-[10px] font-bold flex items-center justify-center">
                                {agent.agentName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-xs text-[#2D332A]">{agent.agentName}</span>
                                <div className="flex items-center gap-2 text-[10px] text-[#6B7366]">
                                  {agent.agentId && <span className="font-mono">{agent.agentId}</span>}
                                  <span>•</span>
                                  <span>{agent.trainingName}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right text-xs">
                                <span className="font-bold text-[#2D332A]">
                                  {agent.score !== null ? `${agent.score}/80` : "Sin nota"}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isApproved
                                    ? "bg-[#E6F3E6] text-[#2D6A4F]"
                                    : isFailed
                                    ? "bg-[#FDF1F1] text-[#9E4A4A]"
                                    : "bg-[#FAF5E6] text-[#8C733E]"
                                }`}
                              >
                                {agent.status}
                              </span>
                              <button
                                onClick={() => onSelectAgent(agent)}
                                className="p-1 text-[#6B7366] hover:text-[#2D332A] hover:bg-[#F1F3EE] rounded cursor-pointer"
                                title="Ver Ficha"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
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
        /* VIEW MODE 2: DYNAMIC SEGMENTED SUB-TABLES PER ACTIVE TEST / CAMPAIGN      */
        /* ========================================================================= */
        <div className="space-y-6">
          {testSubTablesData.map(({ testItem, agents, stats }, testIdx) => {
            const testName = testItem.name || testItem.trainingTopic || testItem.sheetName || `Test ${testIdx + 1}`;
            const trainerName = testItem.trainer || "Apex Trainer";

            return (
              <div
                key={testItem.id || testIdx}
                className="bg-white border border-[#D9DED4] rounded-2xl shadow-xs overflow-hidden transition-all"
              >
                {/* SUB-TABLE HEADER BANNER */}
                <div className="p-4 bg-[#F9F9F7] border-b border-[#E8EAE3] flex flex-wrap items-center justify-between gap-3">
                  {/* Left: Test Identification */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white text-[#2D332A] border border-[#D9DED4] flex items-center justify-center font-bold text-sm shadow-2xs">
                      <FileSpreadsheet className="h-5 w-5 text-[#4F7A4F]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-[#2D332A] bg-white px-3 py-1 rounded-lg border border-[#D9DED4] shadow-2xs">
                          📋 Cuestionario Activo: {testName}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8EAE3] text-[#2D332A] border border-[#D9DED4] shadow-2xs">
                          <Users className="h-3.5 w-3.5 text-[#4F7A4F]" />
                          <span>
                            {stats.totalInTest} {stats.totalInTest === 1 ? "agente" : "agentes"} en esta capacitación
                            {selectedSupervisor ? ` (${selectedSupervisor})` : ""}
                          </span>
                        </span>
                        {testItem.createdAtFormatted && (
                          <span className="text-[11px] text-[#6B7366] font-mono">
                            ({testItem.createdAtFormatted})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B7366] mt-1 flex-wrap">
                        <span>Tema: <strong className="text-[#2D332A]">{testItem.trainingTopic || testName}</strong></span>
                        <span>•</span>
                        <span>Trainer: <strong className="text-[#2D332A]">{trainerName}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Sub-Table Performance Metrics */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-[#2D332A] border border-[#D9DED4] font-semibold shadow-2xs">
                      <Users className="h-3.5 w-3.5 text-[#8DA189]" />
                      <span>{stats.total} {stats.total === 1 ? "agente" : "agentes"}</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E6F3E6] text-[#2D6A4F] border border-[#B7E4C7] font-bold shadow-2xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{stats.approved} APROBADOS ({stats.passRate}%)</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5] font-bold shadow-2xs">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{stats.failed} NO APROBADOS</span>
                    </span>

                    {stats.pending > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF] font-semibold shadow-2xs">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{stats.pending} PENDIENTES</span>
                      </span>
                    )}

                    {stats.avgScore !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] font-mono text-xs font-semibold">
                        Prom: {stats.avgScore} pts
                      </span>
                    )}
                  </div>
                </div>

                {/* PHYSICAL SUB-TABLE FOR THIS TEST */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#F9F9F7] text-[#6B7366] font-semibold border-b border-[#E8EAE3]">
                      <tr>
                        <th className="p-3.5 sm:p-4 w-10">
                          <input
                            type="checkbox"
                            onChange={handleSelectAll}
                            checked={
                              agents.length > 0 &&
                              agents.every((a) => selectedIds.includes(a.id))
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
                      {agents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-10 text-center text-[#6B7366]">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Filter className="h-7 w-7 text-[#8DA189]" />
                              <p className="font-semibold text-[#2D332A]">
                                No se encontraron agentes en {testName}
                              </p>
                              <p className="text-xs text-[#6B7366]">
                                {selectedSupervisor
                                  ? `No hay registros que coincidan para el supervisor "${selectedSupervisor}" con los filtros actuales.`
                                  : "Intenta modificar los términos de búsqueda o los filtros seleccionados."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        agents.map((agent) => {
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

                              {/* Supervisor & Campaña / JCC */}
                              <td className="p-3.5 sm:p-4">
                                <div className="font-medium text-[#2D332A] flex items-center gap-1.5">
                                  <UserCheck className="h-3.5 w-3.5 text-[#8DA189]" />
                                  <span className="truncate max-w-[170px]" title={agent.supervisor || "Sin Supervisor"}>
                                    {agent.supervisor || "Sin asignar"}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#6B7366] mt-0.5 truncate max-w-[170px] flex items-center gap-1 flex-wrap">
                                  <span>{agent.campaign || "General"}</span>
                                  {agent.jcc && agent.jcc !== "-" && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[#2B579A] font-medium" title={`JCC: ${agent.jcc}`}>
                                        {agent.jcc}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* Training & Trainer */}
                              <td className="p-3.5 sm:p-4">
                                <div className="font-medium text-[#2D332A] line-clamp-1 max-w-[220px]" title={agent.trainingName || testName}>
                                  {agent.trainingName || testName}
                                </div>
                                <div className="text-[11px] text-[#6B7366] flex items-center gap-1 mt-0.5">
                                  <span className="text-[#8DA189]">Trainer:</span>
                                  <span className="truncate max-w-[160px]">{agent.trainerName || trainerName}</span>
                                </div>
                              </td>

                              {/* Date */}
                              <td className="p-3.5 sm:p-4 text-xs font-mono text-[#6B7366] whitespace-nowrap">
                                {agent.completionDate || testItem.createdAtFormatted || "N/D"}
                              </td>

                              {/* Score */}
                              <td className="p-3.5 sm:p-4">
                                {agent.score !== null && !isNaN(agent.score) ? (
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

                              {/* Approval Status Badge */}
                              <td className="p-3.5 sm:p-4">
                                {(() => {
                                  const minScore = agent.minPassingScore || 80;
                                  const hasScore = agent.score !== null && !isNaN(agent.score);
                                  const isScoreApproved = hasScore && (agent.score as number) >= minScore;
                                  const isScoreFailed = hasScore && (agent.score as number) < minScore;
                                  const isPending = !hasScore || agent.status === "Pendiente" || agent.status === "Ausente";

                                  if (isEditor) {
                                    return (
                                      <button
                                        onClick={() => onToggleStatus(agent.id, agent.status)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs ${
                                          isScoreApproved
                                            ? "bg-[#E6F3E6] text-[#2D6A4F] border border-[#B7E4C7] hover:bg-[#D4EDDA]"
                                            : isScoreFailed
                                            ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5] hover:bg-[#F8D7DA]"
                                            : "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF] hover:bg-[#FFF3CD]"
                                        }`}
                                        title="Haz clic para cambiar estado de aprobación"
                                      >
                                        {isScoreApproved ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F]" />
                                        ) : isScoreFailed ? (
                                          <XCircle className="h-3.5 w-3.5 text-[#9E4A4A]" />
                                        ) : (
                                          <Clock className="h-3.5 w-3.5 text-[#8C733E]" />
                                        )}
                                        <span>
                                          {isScoreApproved
                                            ? `APROBADO (${agent.score}/${minScore})`
                                            : isScoreFailed
                                            ? `NO APROBADO (${agent.score}/${minScore})`
                                            : "PENDIENTE"}
                                        </span>
                                      </button>
                                    );
                                  }

                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-2xs ${
                                        isScoreApproved
                                          ? "bg-[#E6F3E6] text-[#2D6A4F] border border-[#B7E4C7]"
                                          : isScoreFailed
                                          ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5]"
                                          : "bg-[#FAF5E6] text-[#8C733E] border border-[#EBDDBF]"
                                      }`}
                                    >
                                      {isScoreApproved ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F]" />
                                      ) : isScoreFailed ? (
                                        <XCircle className="h-3.5 w-3.5 text-[#9E4A4A]" />
                                      ) : (
                                        <Clock className="h-3.5 w-3.5 text-[#8C733E]" />
                                      )}
                                      <span>
                                        {isScoreApproved
                                          ? `APROBADO (${agent.score}/${minScore})`
                                          : isScoreFailed
                                          ? `NO APROBADO (${agent.score}/${minScore})`
                                          : "PENDIENTE"}
                                      </span>
                                    </span>
                                  );
                                })()}
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

                {/* Sub-Table Footer */}
                <div className="p-3.5 bg-[#F9F9F7] border-t border-[#E8EAE3] flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7366]">
                  <div>
                    <span>
                      Mostrando <strong className="text-[#2D332A]">{agents.length}</strong> asesores para <strong>{testName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-[#4F7A4F] font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      {stats.approved} aprobados
                    </span>
                    <span className="flex items-center gap-1 text-[#9E4A4A] font-semibold">
                      <XCircle className="h-3 w-3" />
                      {stats.failed} no aprobados
                    </span>
                    {stats.pending > 0 && (
                      <span className="flex items-center gap-1 text-[#8C733E] font-semibold">
                        <Clock className="h-3 w-3" />
                        {stats.pending} pendientes
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
