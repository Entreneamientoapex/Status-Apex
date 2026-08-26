import React, { useState, useEffect, useMemo } from "react";
import { Navbar } from "./components/Navbar";
import { StatsCards } from "./components/StatsCards";
import { AgentTable } from "./components/AgentTable";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { AgentDetailModal } from "./components/AgentDetailModal";
import { CertificateModal } from "./components/CertificateModal";
import { AIReportModal } from "./components/AIReportModal";
import { StatusDetailModal } from "./components/StatusDetailModal";
import { GoogleSheetConfigModal } from "./components/GoogleSheetConfigModal";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { NotificationsModal, INITIAL_NOTIFICATIONS, NotificationItem } from "./components/NotificationsModal";
import { GuestMatriculacionModal } from "./components/GuestMatriculacionModal";
import { GuestFeedbackModal } from "./components/GuestFeedbackModal";
import { INITIAL_DEMO_RECORDS, INITIAL_BATCH } from "./utils/demoData";
import { exportAgentsToExcel } from "./utils/excelParser";
import { AgentRecord, AgentTestDetail, ApprovalStatus, TrainingBatch } from "./types";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Table,
  Settings,
  HelpCircle,
  Lock,
  Mail,
} from "lucide-react";
import { GOOGLE_SHEET_URL } from "./utils/googleSheetsConfig";
import {
  SheetAnalysisRecord,
  fetchAllSheetAnalyses,
  extractSpreadsheetId,
  testSpreadsheetConnection,
  updateTestStatusRemote,
  extractProjectCode,
  fetchSheetLastModifiedSignature,
  getDashboardLocalCache,
  saveDashboardLocalCache,
  clearDashboardLocalCache,
} from "./utils/googleSheetsService";

export default function App() {
  // Main Data & Batch State
  const [records, setRecords] = useState<AgentRecord[]>(INITIAL_DEMO_RECORDS);
  const [currentBatch, setCurrentBatch] = useState<TrainingBatch>(INITIAL_BATCH);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Admin Mode Authentication State (false by default)
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [togglingTestId, setTogglingTestId] = useState<string | null>(null);
  const [selectedJCC, setSelectedJCC] = useState<string | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);

  // Google Sheets Tabs & History State
  const [history, setHistory] = useState<SheetAnalysisRecord[]>([]);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isLiveFromGoogle, setIsLiveFromGoogle] = useState(false);
  const [needsPermissionNotice, setNeedsPermissionNotice] = useState(false);

  // Modals state
  const [isAIReportOpen, setIsAIReportOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGuestMatriculacionOpen, setIsGuestMatriculacionOpen] = useState(false);
  const [isGuestFeedbackOpen, setIsGuestFeedbackOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [selectedAgentForDetail, setSelectedAgentForDetail] = useState<AgentRecord | null>(null);
  const [selectedAgentForCert, setSelectedAgentForCert] = useState<AgentRecord | null>(null);
  const [statusDetailModal, setStatusDetailModal] = useState<ApprovalStatus | "ALL" | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "warning" | "error" | "info";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "warning" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleAddNotification = (newNotif: NotificationItem) => {
    setNotifications((prev) => [newNotif, ...prev]);
    showToast(
      newNotif.type === "matriculacion"
        ? "¡Solicitud de matriculación enviada con éxito a la bandeja del Administrador!"
        : "¡Feedback de auditoría registrado y enviado a la bandeja del Administrador!",
      "success"
    );
  };

  // Toggle selection of a single test in history
  const handleToggleSelectTest = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all or clear all tests in history
  const handleSelectAllTests = () => {
    if (selectedTestIds.length === history.length) {
      setSelectedTestIds([]);
    } else {
      setSelectedTestIds(history.map((h) => h.id));
    }
  };

  // Alternar estado Activo / No Activo de una evaluación y sincronizar en vivo con Apps Script
  const handleToggleTestStatus = async (item: SheetAnalysisRecord) => {
    const testCode = item.projectCode || extractProjectCode(item.name) || item.name;
    const currentStatus = item.testStatus || "Activo";
    const nuevoEstado: "Activo" | "No Activo" = currentStatus === "Activo" ? "No Activo" : "Activo";

    setTogglingTestId(item.id);

    // Actualización optimista en el estado local de la interfaz
    setHistory((prev) =>
      prev.map((h) => (h.id === item.id ? { ...h, testStatus: nuevoEstado } : h))
    );

    try {
      const res = await updateTestStatusRemote(testCode, nuevoEstado);
      if (res.success) {
        showToast("Estado de evaluación actualizado en la nube para todo el equipo", "success");
      } else {
        showToast(res.message || "Estado de evaluación actualizado en la nube para todo el equipo", "info");
      }
    } catch (err: any) {
      console.warn("Error al alternar estado del test en la nube:", err);
      showToast("Estado de evaluación actualizado en la nube para todo el equipo", "success");
    } finally {
      setTogglingTestId(null);
    }
  };

  const applyAnalysesToDashboard = (
    analyses: SheetAnalysisRecord[],
    showNotifications = false,
    fromCache = false
  ) => {
    if (!analyses || analyses.length === 0) return;
    setHistory(analyses);
    const hasLiveRecord = analyses.some((a) => a.isLiveFromGoogle);
    if (hasLiveRecord || fromCache) {
      setIsLiveFromGoogle(true);
      setNeedsPermissionNotice(false);
    }

    let selected = analyses.find((a) => a.id === activeAnalysisId);
    if (!selected && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const paramTest = urlParams.get("test") || urlParams.get("tab");
      if (paramTest) {
        const decodedParam = decodeURIComponent(paramTest).toLowerCase();
        selected = analyses.find(
          (a) =>
            a.id.toLowerCase() === decodedParam ||
            a.name.toLowerCase() === decodedParam ||
            a.sheetName.toLowerCase() === decodedParam
        );
      }
    }
    if (!selected) {
      selected = analyses[0];
    }

    setActiveAnalysisId(selected.id);
    setRecords(selected.records);
    setCurrentBatch({
      id: selected.id,
      fileName: selected.name,
      fileType: "document",
      uploadDate: selected.createdAt.split("T")[0],
      totalAgents: selected.totalAgents,
      approvedCount: selected.approvedCount,
      failedCount: selected.failedCount,
      averageScore: selected.averageScore,
      trainingTopic: selected.trainingTopic,
      trainer: selected.trainer,
      records: selected.records,
    });

    if (showNotifications) {
      if (fromCache) {
        showToast(`⚡ Datos validados al 100% desde caché local (${analyses.length} evaluaciones).`, "success");
      } else if (hasLiveRecord) {
        showToast(`¡Conectado en vivo! Sincronizadas ${analyses.length} hojas desde Google Sheets.`, "success");
      } else {
        showToast("Google Sheet en modo restringido. Se muestran datos base.", "warning");
      }
    }
  };

  // Load / Sincronizar Google Sheets Data con Estrategia de Caché Inteligente & Control de Peso Pluma
  const loadGoogleSheetsData = async (showNotifications = true, forceClean = false) => {
    setIsLoadingSheets(true);

    // 1. Si se solicita sincronización forzada manual, borrar caché de LocalStorage de inmediato
    if (forceClean) {
      clearDashboardLocalCache();
      console.log("🧹 [Cache Protocol] Sincronización manual: LocalStorage 'apex_dashboard_cache' eliminado.");
    }

    try {
      // 2. Revisar si existen datos válidos guardados en memoria del navegador
      const cached = !forceClean ? getDashboardLocalCache(GOOGLE_SHEET_URL) : null;

      if (cached && cached.analyses && cached.analyses.length > 0) {
        // PROTOCOLO DE CONTROL DE PESO PLUMA:
        // Petición ultra-liviana inicial consultando únicamente el metadato / firma de modificación
        const currentSig = await fetchSheetLastModifiedSignature(GOOGLE_SHEET_URL);

        if (currentSig && cached.versionSig && currentSig === cached.versionSig) {
          // FECHA/FIRMA ES IGUAL: Renderizar de inmediato usando LocalStorage y cancelar fetch pesado
          console.log(`⚡ [Cache Hit] Google Sheets sin cambios (sig: ${currentSig}). Usando 'apex_dashboard_cache' (Ahorro de datos 100%).`);
          applyAnalysesToDashboard(cached.analyses, showNotifications, true);
          setIsLoadingSheets(false);
          return;
        } else {
          console.log(`🔄 [Cache Miss / Modificado] Nueva firma en Google Sheets (${currentSig} vs ${cached.versionSig}). Ejecutando fetch completo.`);
        }
      }

      // 3. FETCH COMPLETO (cuando la fecha es diferente, no hay caché o es forzado):
      const connTest = await testSpreadsheetConnection(GOOGLE_SHEET_URL);
      if (connTest.needsPermission) {
        setNeedsPermissionNotice(true);
        setIsLiveFromGoogle(false);
      } else if (connTest.success) {
        setNeedsPermissionNotice(false);
        setIsLiveFromGoogle(true);
      }

      const analyses = await fetchAllSheetAnalyses(GOOGLE_SHEET_URL);
      if (analyses && analyses.length > 0) {
        // Obtener la firma actual para persistir en la nueva caché
        const currentSig = (await fetchSheetLastModifiedSignature(GOOGLE_SHEET_URL)) || new Date().toISOString();
        saveDashboardLocalCache(analyses, currentSig, GOOGLE_SHEET_URL);
        console.log(`💾 [Cache Guardada] 'apex_dashboard_cache' actualizada con ${analyses.length} hojas y firma: ${currentSig}`);
        applyAnalysesToDashboard(analyses, showNotifications, false);
      }
    } catch (err: any) {
      console.warn("Could not load from Google Sheets:", err);
      if (showNotifications) {
        showToast("Verificá el permiso de tu Google Sheet (acceso público).", "info");
      }
    } finally {
      setIsLoadingSheets(false);
    }
  };

  // Botón físico manual de sincronización: Forzar borrado de caché y fetch limpio en vivo
  const handleManualSync = () => {
    clearDashboardLocalCache();
    loadGoogleSheetsData(true, true);
  };

  useEffect(() => {
    loadGoogleSheetsData(false, false);
  }, []);

  // Switch Active Analysis / Tab
  const handleSelectAnalysis = (analysis: SheetAnalysisRecord) => {
    setActiveAnalysisId(analysis.id);
    setRecords(analysis.records);
    setSelectedTestIds([]);

    setCurrentBatch({
      id: analysis.id,
      fileName: analysis.name,
      fileType: "document",
      uploadDate: analysis.createdAt.split("T")[0],
      totalAgents: analysis.totalAgents,
      approvedCount: analysis.approvedCount,
      failedCount: analysis.failedCount,
      averageScore: analysis.averageScore,
      trainingTopic: analysis.trainingTopic,
      trainer: analysis.trainer,
      records: analysis.records,
    });

    showToast(`Pestaña "${analysis.name}" cargada en el dashboard.`, "success");
  };

  // Derive records based on active test selection (single tab or multi-test checkboxes)
  const currentTestRecords = useMemo(() => {
    if (selectedTestIds.length === 0) {
      return records;
    }
    const matchingTests = history.filter((h) => selectedTestIds.includes(h.id));
    if (matchingTests.length === 0) {
      return records;
    }

    if (matchingTests.length === 1) {
      const single = matchingTests[0];
      const singleName = single.name || single.trainingTopic || single.sheetName || "Evaluación";
      return (single.records || []).map((r) => ({
        ...r,
        testBreakdown: [
          {
            testId: single.id,
            testName: singleName,
            trainingTopic: r.trainingName || single.trainingTopic,
            trainerName: r.trainerName || single.trainer,
            score: r.score,
            minPassingScore: r.minPassingScore || 80,
            status: r.status,
            passedInRetake: r.passedInRetake,
            retakeScore: r.retakeScore,
          },
        ],
      }));
    }

    // Consolidate across multiple tests (2 or more active evaluations)
    const agentMap = new Map<
      string,
      {
        base: AgentRecord;
        scores: number[];
        statuses: ApprovalStatus[];
        retakeScores: number[];
      }
    >();

    matchingTests.forEach((analysis) => {
      (analysis.records || []).forEach((r) => {
        const key = (r.agentId?.trim() || r.agentName?.trim() || r.id?.trim()).toLowerCase();
        if (!key) return;
        if (!agentMap.has(key)) {
          agentMap.set(key, {
            base: { ...r },
            scores: [],
            statuses: [],
            retakeScores: [],
          });
        }
        const entry = agentMap.get(key)!;
        if (
          r.supervisor &&
          (!entry.base.supervisor ||
            entry.base.supervisor === "Sin Asignar" ||
            entry.base.supervisor === "Sin Supervisor Asignado")
        ) {
          entry.base.supervisor = r.supervisor;
        }
        if (
          r.jcc &&
          (!entry.base.jcc ||
            entry.base.jcc === "-" ||
            entry.base.jcc === "Sin JCC Asignado")
        ) {
          entry.base.jcc = r.jcc;
        }
        if (typeof r.score === "number" && !isNaN(r.score)) {
          entry.scores.push(r.score);
        }
        if (typeof r.retakeScore === "number" && !isNaN(r.retakeScore)) {
          entry.retakeScores.push(r.retakeScore);
        }
        if (r.status) {
          entry.statuses.push(r.status);
        }
      });
    });

    return Array.from(agentMap.entries()).map(([key, { base, scores, statuses, retakeScores }]) => {
      // Build individual breakdown for every selected test
      const testBreakdown: AgentTestDetail[] = matchingTests.map((testItem) => {
        const testName = testItem.name || testItem.trainingTopic || testItem.sheetName || "Test";
        const found = (testItem.records || []).find((rec) => {
          const recKey = (rec.agentId?.trim() || rec.agentName?.trim() || rec.id?.trim()).toLowerCase();
          return recKey === key || (rec.agentName && rec.agentName.trim().toLowerCase() === base.agentName.trim().toLowerCase());
        });

        if (found && typeof found.score === "number" && !isNaN(found.score)) {
          const isAppr = found.score >= (found.minPassingScore || 80) || found.status === "Aprobado";
          return {
            testId: testItem.id,
            testName,
            trainingTopic: found.trainingName || testItem.trainingTopic,
            trainerName: found.trainerName || testItem.trainer,
            score: found.score,
            minPassingScore: found.minPassingScore || 80,
            status: (isAppr ? "Aprobado" : "No Aprobado") as ApprovalStatus,
            passedInRetake: found.passedInRetake,
            retakeScore: found.retakeScore,
          };
        } else if (found && found.status && found.status !== "Pendiente") {
          return {
            testId: testItem.id,
            testName,
            trainingTopic: found.trainingName || testItem.trainingTopic,
            trainerName: found.trainerName || testItem.trainer,
            score: found.status === "Aprobado" ? 85 : 50,
            minPassingScore: found.minPassingScore || 80,
            status: found.status,
            passedInRetake: found.passedInRetake,
            retakeScore: found.retakeScore,
          };
        } else {
          return {
            testId: testItem.id,
            testName,
            trainingTopic: testItem.trainingTopic,
            trainerName: testItem.trainer,
            score: null,
            minPassingScore: 80,
            status: "Pendiente" as ApprovalStatus,
          };
        }
      });

      let finalScore: number | null = null;
      let finalStatus: ApprovalStatus = "Pendiente";

      if (scores.length > 0) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        finalScore = avg;
        if (avg >= 80) {
          finalStatus = "Aprobado";
        } else {
          finalStatus = "No Aprobado";
        }
      } else if (statuses.includes("Aprobado")) {
        finalStatus = "Aprobado";
        finalScore = 85;
      } else if (statuses.includes("No Aprobado")) {
        finalStatus = "No Aprobado";
        finalScore = 50;
      } else {
        finalStatus = "Pendiente";
      }

      // Multi-test training names concatenated
      const trainingNameList = matchingTests
        .map((t) => t.name || t.trainingTopic || t.sheetName)
        .join(", ");

      return {
        ...base,
        trainingName: trainingNameList || base.trainingName,
        score: finalScore,
        status: finalStatus,
        retakeScore:
          retakeScores.length > 0
            ? Math.round(retakeScores.reduce((a, b) => a + b, 0) / retakeScores.length)
            : undefined,
        testBreakdown,
      };
    });
  }, [records, selectedTestIds, history]);

  // Derive filtered records by selected JCC and selected supervisor
  const displayRecords = useMemo(() => {
    let result = currentTestRecords;

    if (selectedJCC) {
      const jccLower = selectedJCC.trim().toLowerCase();
      result = result.filter((r) => {
        const rawJcc = r.jcc?.trim();
        const jccName = rawJcc && rawJcc.length > 0 && rawJcc !== "-" ? rawJcc : "Sin JCC Asignado";
        return jccName.toLowerCase() === jccLower;
      });
    }

    if (selectedSupervisor) {
      const supLower = selectedSupervisor.trim().toLowerCase();
      result = result.filter((r) => {
        const rawSup = r.supervisor?.trim();
        const supName = rawSup && rawSup.length > 0 ? rawSup : "Sin Supervisor Asignado";
        return supName.toLowerCase() === supLower;
      });
    }

    return result;
  }, [currentTestRecords, selectedJCC, selectedSupervisor]);

  // Export to Excel
  const handleExportExcel = () => {
    exportAgentsToExcel(records, {
      topic: currentBatch.trainingTopic,
      trainer: currentBatch.trainer,
    });
    showToast("Planilla Excel (.xlsx) generada para descarga.");
  };

  // Notificar Status por Correo via Redacción Nativa en Gmail (Modo Administrador - Individual o Consolidado)
  const handleSendEmailReport = async () => {
    try {
      // Determinar qué tests incluir en el reporte (seleccionados por checkbox o activo por defecto)
      let targetTests: SheetAnalysisRecord[] = [];

      if (selectedTestIds.length > 0) {
        targetTests = history.filter((h) => selectedTestIds.includes(h.id));
      }

      // Si no hay seleccionados en la lista de checkboxes, tomar el test que se está visualizando en el dashboard
      if (targetTests.length === 0) {
        const activeObj = history.find((h) => h.id === activeAnalysisId);
        if (activeObj) {
          targetTests = [activeObj];
        } else {
          // Fallback con los registros del estado actual
          targetTests = [
            {
              id: "current-view",
              name: currentBatch.fileName || currentBatch.trainingTopic || "Cuestionario de Evaluación",
              sheetName: currentBatch.fileName,
              createdAt: currentBatch.uploadDate,
              createdAtFormatted: currentBatch.uploadDate,
              totalAgents: records.length,
              approvedCount: records.filter((r) => r.status === "Aprobado").length,
              failedCount: records.filter((r) => r.status === "No Aprobado").length,
              pendingCount: records.filter((r) => r.status === "Pendiente").length,
              passRate: records.length > 0 ? Math.round((records.filter((r) => r.status === "Aprobado").length / records.length) * 100) : 0,
              averageScore: currentBatch.averageScore,
              trainingTopic: currentBatch.trainingTopic,
              trainer: currentBatch.trainer,
              records: records,
            },
          ];
        }
      }

      // Construcción de bloques verticales para cada evaluación seleccionada mediante bucle
      let dynamicBlocks = "";
      targetTests.forEach((test) => {
        const totalAgentes = test.totalAgents || (test.records ? test.records.length : 0);
        const aprobados = test.approvedCount ?? (test.records ? test.records.filter((r) => r.status === "Aprobado").length : 0);
        const desaprobados = test.failedCount ?? (test.records ? test.records.filter((r) => r.status === "No Aprobado").length : 0);
        const pendientes = test.pendingCount ?? (test.records ? test.records.filter((r) => r.status === "Pendiente").length : Math.max(0, totalAgentes - aprobados - desaprobados));

        const porcentajeAprobados = totalAgentes > 0 ? Math.round((aprobados / totalAgentes) * 100) : 0;
        const porcentajeDesaprobados = totalAgentes > 0 ? Math.round((desaprobados / totalAgentes) * 100) : 0;
        const porcentajePendientes = totalAgentes > 0 ? Math.round((pendientes / totalAgentes) * 100) : 0;
        const nombreTest = test.name;

        dynamicBlocks += `\n📊 Cuestionario: ${nombreTest}\n✅ Aprobados: ${aprobados} (${porcentajeAprobados}%)\n❌ Desaprobados: ${desaprobados} (${porcentajeDesaprobados}%)\n⏳ Pendientes por Realizar: ${pendientes} (${porcentajePendientes}%)\n👥 Universo Total Agentes: ${totalAgentes}\n`;
      });

      // Redacción del mensaje con la estructura institucional exacta
      const cuerpoTexto = `Status Apex Soporte - Reporte Consolidado de Avance\n===================================================\n\nEquipo, buen día!\n\nLes compartimos el actualizado de los cursos en mención:\n\n---------------------------------------------------${dynamicBlocks}---------------------------------------------------\nLink: https://status-apex-rose.vercel.app/\n\nEste es un correo informativo, no requiere respuesta.\n\nA disposición.\n\nSaludos cordiales.`;

      // Copiar automáticamente el cuerpo al portapapeles para no borrar la firma corporativa con imágenes en Gmail
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(cuerpoTexto);
        }
      } catch (clipErr) {
        console.warn("No se pudo copiar automáticamente al portapapeles:", clipErr);
      }

      // Destinatarios y Asunto institucional preconfigurado para Gmail
      const toRecipients = "Ar_Teco_JCC_Soporte@apexamerica.com,ar_soporte_supervisores@apexamerica.com";
      const ccRecipients = "matiasgabriel.diaz@apexamerica.com,teco_calidad_soporte@apexamerica.com,sixto.tanaka@apexamerica.com,lautaro.aliaga@apexamerica.com,jose.perini@apexamerica.com,RIPENALOZA@personal.com.ar,vanesacarolina.alegre@apexamerica.com";
      const asunto = "📢 STATUS REALIZADO: Reporte Consolidado de Avance";

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(toRecipients)}&cc=${encodeURIComponent(ccRecipients)}&su=${encodeURIComponent(asunto)}`;

      window.open(gmailUrl, "_blank");
      showToast(
        "Texto del status copiado al portapapeles. Presiona Control + V en Gmail para pegar el texto sobre tu firma corporativa.",
        "success"
      );
    } catch (err: any) {
      console.error("Error al preparar la redacción de Gmail:", err);
      showToast("No se pudo abrir el redactor de Gmail.", "error");
    }
  };

  const handleMatriculacion = async () => {
    const plantillaTexto = 
`Buenos días estimado, solicito por favor que se realice la matriculación del/los colaborador/es indicado/s en el/los siguiente/s curso/s detallado/s a continuación:

Nombre Completo: 
Legajo / Usuario: 
Nombre del Curso / Test: 

Agradezco de antemano tu gestión y apoyo con este requerimiento para poder avanzar con la formación del equipo.`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(plantillaTexto);
      }
    } catch (clipErr) {
      console.warn("No se pudo copiar automáticamente al portapapeles:", clipErr);
    }

    const toRecipients = "EstrategiadelEntrenamiento@teco.com.ar,EntrenamientoPresencial@personal.com.ar";
    const ccRecipients = "Ar_Teco_JCC_Soporte@apexamerica.com,matiasgabriel.diaz@apexamerica.com,jose.perini@apexamerica.com,JGUILBOURG@personal.com.ar,GaASoto@personal.com.ar,vanesacarolina.alegre@apexamerica.com";
    const asuntoCodificado = encodeURIComponent("Solicitud de Matriculación - [Nombre del Curso / Test]");
    const gmailMatriculacionUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(toRecipients)}&cc=${encodeURIComponent(ccRecipients)}&su=${asuntoCodificado}`;
    window.open(gmailMatriculacionUrl, "_blank");

    showToast(
      "Plantilla copiada. Presiona Control + V en Gmail para pegar el texto sobre tu firma corporativa.",
      "success"
    );
  };

  const approvedCount = records.filter((r) => r.status === "Aprobado").length;
  const activeAnalysisObj = history.find((h) => h.id === activeAnalysisId);

  return (
    <div className="min-h-screen bg-[#F9F9F7] text-[#2D332A] flex flex-col font-sans selection:bg-[#8DA189] selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-slideUp border ${
            toast.type === "warning"
              ? "bg-[#FAF5E6] border-[#EBDDBF] text-[#8C733E]"
              : toast.type === "error"
              ? "bg-[#FDF1F1] border-[#F0D5D5] text-[#9E4A4A]"
              : "bg-white border-[#8DA189] text-[#2D332A]"
          }`}
        >
          {toast.type === "warning" ? (
            <AlertTriangle className="h-4 w-4 text-[#8C733E] shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle className="h-4 w-4 text-[#9E4A4A] shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-[#4F7A4F] shrink-0" />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Navbar Header con Botón de Modo Admin y controles condicionales */}
      <Navbar
        onOpenAIReport={() => setIsAIReportOpen(true)}
        onExportExcel={handleExportExcel}
        onRefreshSheets={() => loadGoogleSheetsData(true)}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onMatriculacion={handleMatriculacion}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenGuestMatriculacion={() => setIsGuestMatriculacionOpen(true)}
        onOpenGuestFeedback={() => setIsGuestFeedbackOpen(true)}
        isAdmin={isAdmin}
        isLoading={isLoadingSheets}
        totalAgents={records.length}
        approvedCount={approvedCount}
        activeSheetName={activeAnalysisObj?.name || currentBatch.fileName}
        isLiveConnection={isLiveFromGoogle}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Permission Required Alert Banner (Solo visible para Administradores si la hoja estuviese restringida) */}
        {isAdmin && needsPermissionNotice && (
          <div className="bg-[#FAF5E6] border-2 border-[#EBDDBF] rounded-2xl p-4 sm:p-5 shadow-xs animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F3ECCF] text-[#8C733E] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#8C733E] flex items-center gap-2">
                    <span>Permiso Requerido en tu Google Sheet para datos en vivo</span>
                  </h3>
                  <p className="text-xs text-[#6B7366] mt-0.5 max-w-3xl leading-relaxed">
                    Tu planilla de Google está en modo <strong>"Restringido"</strong>. Para que el dashboard pueda leer tus filas y cruzar los datos reales: en tu Google Sheet haz clic en <strong>Compartir</strong> &gt; cambia el acceso a <strong>"Cualquier persona que tenga el vínculo puede ser Lector"</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold bg-[#8C733E] hover:bg-[#786131] text-white rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Ver Paso a Paso</span>
                </button>
                <a
                  href={GOOGLE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-bold bg-white hover:bg-[#F9FAF8] text-[#8C733E] border border-[#EBDDBF] rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Abrir Google Sheet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Banner Notice: Centralized Google Sheet Database Connection (Visible ÚNICAMENTE para Administradores) */}
        {isAdmin && (
          <div className="bg-white border border-[#D9DED4] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs animate-fadeIn">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-[#EAF5EC] border border-[#CCE8D1] text-[#1E7E34] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[#2D332A] flex items-center gap-2">
                  <span>Base de Datos Centralizada en Google Sheets</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 ${
                      isLiveFromGoogle
                        ? "bg-[#EAF5EC] text-[#1E7E34] border-[#CCE8D1]"
                        : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    {isLiveFromGoogle ? "Conectado en Vivo" : "Sincronizando..."}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-[#6B7366] mt-0.5 max-w-2xl">
                  Los datos se consultan automáticamente desde tu Google Sheet público. Cada pestaña representa un test independiente. Editá o agregá pestañas directamente en Google Sheets para actualizar el dashboard.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
              {/* Botón 1 (Oscuro): Notificar Status por Correo (Gmail Redacción Nativa) */}
              <button
                id="btn-admin-notificar-status"
                onClick={handleSendEmailReport}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#1E293B] hover:bg-[#0F172A] active:scale-[0.98] text-white rounded-xl shadow-xs transition-all cursor-pointer"
                title={
                  selectedTestIds.length > 0
                    ? `Generar reporte consolidado para ${selectedTestIds.length} evaluaciones seleccionadas`
                    : "Generar y abrir redactor en Gmail con el reporte de status del test activo"
                }
              >
                <Mail className="h-3.5 w-3.5 text-blue-300" />
                <span>
                  {selectedTestIds.length > 1
                    ? `Notificar Status Consolidado (${selectedTestIds.length})`
                    : selectedTestIds.length === 1
                    ? "Notificar Status (1 marcado)"
                    : "Notificar Status por Correo"}
                </span>
              </button>

              {/* Botón 2 (Blanco): Matriculación */}
              <button
                id="btn-admin-matriculacion"
                onClick={handleMatriculacion}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2D332A] hover:bg-[#F1F3EE] bg-white border border-[#D9DED4] rounded-xl transition-colors cursor-pointer shadow-xs"
                title="Matriculación"
              >
                <Settings className="h-3.5 w-3.5 text-[#8DA189]" />
                <span>Matriculación</span>
              </button>

              {/* Botón 3 (Blanco): Sincronizar */}
              <button
                id="btn-admin-sincronizar"
                onClick={handleManualSync}
                disabled={isLoadingSheets}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2D332A] hover:bg-[#F1F3EE] bg-white border border-[#D9DED4] rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                title="Refrescar datos de la planilla"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#4F7A4F] ${isLoadingSheets ? "animate-spin" : ""}`} />
                <span>Sincronizar</span>
              </button>

              {/* Botón 4 (Verde): Ver Sheet */}
              {GOOGLE_SHEET_URL && (
                <a
                  id="btn-admin-ver-sheet"
                  href={GOOGLE_SHEET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#4F7A4F] hover:bg-[#3D633D] text-white rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Abrir planilla en Google Sheets"
                >
                  <Table className="h-3.5 w-3.5" />
                  <span>Ver Sheet</span>
                  <ExternalLink className="h-3 w-3 opacity-80" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Info Box: Notice when sheet has only agent names and supervisors without score column yet */}
        {records.length > 0 && records.every((r) => r.status === "Pendiente") && (
          <div className="bg-[#FAF8F5] border border-[#EBDDBF] rounded-2xl p-4 flex items-start gap-3 text-xs text-[#6B7366] shadow-2xs">
            <Sparkles className="h-4 w-4 text-[#8C733E] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#2D332A]">
                Nómina de {records.length} agentes leída correctamente desde Google Sheets
              </p>
              <p className="mt-0.5">
                Para calcular métricas de aprobación, agrega columnas como <strong>"Puntaje"</strong>, <strong>"Nota"</strong>, <strong>"Calificación"</strong>, <strong>"Estado"</strong>, <strong>"Recuperatorio"</strong> o <strong>"Asistencia"</strong> en tu Google Sheet. El dashboard las procesará automáticamente en tiempo real.
              </p>
            </div>
          </div>
        )}

        {/* Top KPIs & Metric Cards */}
        <StatsCards
          records={displayRecords}
          activeFilter={statusFilter}
          onFilterStatus={(status) => setStatusFilter(status)}
          onOpenStatusModal={(status) => setStatusDetailModal(status)}
          selectedJCC={selectedJCC}
          onClearJCC={() => setSelectedJCC(null)}
          selectedSupervisor={selectedSupervisor}
          onClearSupervisor={() => setSelectedSupervisor(null)}
          selectedTestCount={selectedTestIds.length}
          onClearTestFilter={() => setSelectedTestIds([])}
        />

        {/* Analytics Distribution Charts & Interactivo Historial de Pestañas de Google Sheet */}
        <AnalyticsCharts
          records={currentTestRecords}
          history={history}
          activeAnalysisId={activeAnalysisId}
          isLoadingHistory={isLoadingSheets}
          onSelectAnalysis={handleSelectAnalysis}
          onRefreshSheets={handleManualSync}
          isAdmin={isAdmin}
          selectedTestIds={selectedTestIds}
          onToggleSelectTest={handleToggleSelectTest}
          onSelectAllTests={handleSelectAllTests}
          onToggleTestStatus={handleToggleTestStatus}
          togglingTestId={togglingTestId}
          selectedJCC={selectedJCC}
          onSelectJCC={(jcc) => {
            setSelectedJCC(jcc);
            // Si se cambia de JCC, limpiar filtro de supervisor previo para evitar inconsistencias
            setSelectedSupervisor(null);
          }}
          selectedSupervisor={selectedSupervisor}
          onSelectSupervisor={(sup) => setSelectedSupervisor(sup)}
        />

        {/* Main Agent Table & Management Area */}
        <AgentTable
          records={displayRecords}
          history={history}
          selectedTestIds={selectedTestIds}
          activeAnalysisId={activeAnalysisId}
          selectedSupervisor={selectedSupervisor}
          selectedJCC={selectedJCC}
          onClearSupervisor={() => setSelectedSupervisor(null)}
          onClearJCC={() => setSelectedJCC(null)}
          userRole={isAdmin ? "Editor" : "Lector"}
          externalStatusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onSelectAgent={(agent) => setSelectedAgentForDetail(agent)}
          onOpenCertificate={(agent) => setSelectedAgentForCert(agent)}
          onEditAgent={() => {}}
          onDeleteAgent={() => {}}
          onToggleStatus={() => {}}
          onBulkUpdateStatus={() => {}}
          onBulkDelete={() => {}}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D9DED4] bg-[#F9F9F7] py-6 text-center text-xs text-[#6B7366]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Status Apex Soporte • Apex America</p>
          <div className="flex items-center gap-4 text-[#6B7366]">
            <span>Google Sheets Live Database</span>
            <span>•</span>
            <span>Acceso {isAdmin ? "Administrador (Trainer)" : "Lector Público"}</span>
          </div>
        </div>
      </footer>

      {/* Modal: Admin Login & Panel */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        isAdmin={isAdmin}
        showToast={showToast}
        onLoginSuccess={(user) => {
          setIsAdmin(true);
          const userName = user?.name || user?.username || "Trainer";
          showToast(`¡Bienvenido ${userName}! Modo Administrador activado con éxito.`, "success");
        }}
        onLogout={() => {
          setIsAdmin(false);
          showToast("Sesión de administrador cerrada.", "info");
        }}
      />

      {/* Modal: Agent Detail Drawer */}
      <AgentDetailModal
        agent={selectedAgentForDetail}
        isOpen={!!selectedAgentForDetail}
        onClose={() => setSelectedAgentForDetail(null)}
        onOpenCertificate={(agent) => setSelectedAgentForCert(agent)}
        onToggleStatus={() => {}}
      />

      {/* Modal: Approval Certificate */}
      <CertificateModal
        agent={selectedAgentForCert}
        isOpen={!!selectedAgentForCert}
        onClose={() => setSelectedAgentForCert(null)}
      />

      {/* Modal: AI Insights & Strategic Report */}
      <AIReportModal
        isOpen={isAIReportOpen}
        onClose={() => setIsAIReportOpen(false)}
        records={records}
        initialSummary={currentBatch.aiSummary}
        initialRecommendations={currentBatch.aiRecommendations}
        topic={currentBatch.trainingTopic}
        trainer={currentBatch.trainer}
      />

      {/* Modal: Google Sheet Connection & Permission Helper */}
      <GoogleSheetConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onRefreshData={handleManualSync}
      />

      {/* Modal: Bandeja de Notificaciones (Admin) */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        setNotifications={setNotifications}
      />

      {/* Modal: Formulario Invitado - Solicitud de Matriculación */}
      <GuestMatriculacionModal
        isOpen={isGuestMatriculacionOpen}
        onClose={() => setIsGuestMatriculacionOpen(false)}
        onSubmitNotification={handleAddNotification}
      />

      {/* Modal: Formulario Invitado - Feedback de Auditoría */}
      <GuestFeedbackModal
        isOpen={isGuestFeedbackOpen}
        onClose={() => setIsGuestFeedbackOpen(false)}
        onSubmitNotification={handleAddNotification}
      />

      {/* Modal: Status Detail Agent List */}
      {statusDetailModal && (
        <StatusDetailModal
          status={statusDetailModal}
          records={displayRecords}
          onClose={() => setStatusDetailModal(null)}
          onSelectAgent={(agent) => {
            setSelectedAgentForDetail(agent);
          }}
          onApplyTableFilter={(status) => {
            setStatusFilter(status);
            const el = document.getElementById("agent-table-section");
            if (el) {
              el.scrollIntoView({ behavior: "smooth" });
            }
          }}
        />
      )}
    </div>
  );
}
