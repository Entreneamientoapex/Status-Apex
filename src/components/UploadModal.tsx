import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sliders,
  ClipboardList,
  Users,
  GraduationCap,
  ArrowRightLeft,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { AgentRecord, AIAnalysisResponse } from "../types";
import { parseExcelOrCsvFile, fileToBase64, mergeExcelRosterAndTestResults } from "../utils/excelParser";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateTargetName?: string | null;
  onImportComplete: (data: {
    records: AgentRecord[];
    batchName: string;
    mode: "replace" | "append";
    aiSummary?: string;
    aiRecommendations?: string[];
    trainingTopic?: string;
    trainer?: string;
    matchedInCourseCount?: number;
    discardedFromCourseCount?: number;
    noMatchesWarning?: boolean;
  }) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  updateTargetName,
  onImportComplete,
}) => {
  // Upload Mode: "dual" (2 files: Roster + Test Results), "single" (1 file), "paste" (Text)
  const [uploadMode, setUploadMode] = useState<"dual" | "single" | "paste">("dual");

  // File 1: Lista de Asesores
  const [agentsFile, setAgentsFile] = useState<File | null>(null);
  // File 2: Resultados del Test
  const [testFile, setTestFile] = useState<File | null>(null);

  // Single file fallback
  const [singleFile, setSingleFile] = useState<File | null>(null);

  // Text inputs for paste mode
  const [agentsText, setAgentsText] = useState("");
  const [testText, setTestText] = useState("");

  // Settings
  const [passingThreshold, setPassingThreshold] = useState<number>(80);
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview state
  const [previewResult, setPreviewResult] = useState<{
    records: AgentRecord[];
    summary?: string;
    topic?: string;
    trainer?: string;
    recommendations?: string[];
    isAiExtracted: boolean;
    matchedInfo?: string;
    matchedCount?: number;
    discardedCount?: number;
    noMatchesWarning?: boolean;
  } | null>(null);

  // File input refs
  const agentsInputRef = useRef<HTMLInputElement>(null);
  const testInputRef = useRef<HTMLInputElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isExcelOrCsv = (filename?: string) => {
    if (!filename) return false;
    const ext = filename.toLowerCase().split(".").pop();
    return ext === "xlsx" || ext === "xls" || ext === "csv";
  };

  const handleAgentsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAgentsFile(e.target.files[0]);
      setErrorMessage(null);
      setPreviewResult(null);
    }
  };

  const handleTestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTestFile(e.target.files[0]);
      setErrorMessage(null);
      setPreviewResult(null);
    }
  };

  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSingleFile(e.target.files[0]);
      setErrorMessage(null);
      setPreviewResult(null);
    }
  };

  // Main processing function
  const processFiles = async (useAI: boolean = true) => {
    setErrorMessage(null);

    // Validation
    if (uploadMode === "dual") {
      if (!agentsFile && !testFile) {
        setErrorMessage("Por favor selecciona al menos la lista de asesores o los resultados del test.");
        return;
      }
    } else if (uploadMode === "single") {
      if (!singleFile) {
        setErrorMessage("Por favor selecciona el archivo consolidado.");
        return;
      }
    } else if (uploadMode === "paste") {
      if (!agentsText.trim() && !testText.trim()) {
        setErrorMessage("Por favor ingresa la lista de asesores o los resultados del test en el cuadro de texto.");
        return;
      }
    }

    setIsProcessing(true);

    try {
      // 1. DUAL FILES MODE
      if (uploadMode === "dual") {
        const bothExcel = agentsFile && testFile && isExcelOrCsv(agentsFile.name) && isExcelOrCsv(testFile.name);

        // If user explicitly chose backend direct processing without AI
        if (!useAI) {
          setProcessingStep("Enviando archivos al backend para filtrado por 'Usuario'...");
          let agentsPayload = null;
          if (agentsFile) {
            const { base64, mimeType } = await fileToBase64(agentsFile);
            agentsPayload = { data: base64, mimeType, fileName: agentsFile.name };
          }
          let testPayload = null;
          if (testFile) {
            const { base64, mimeType } = await fileToBase64(testFile);
            testPayload = { data: base64, mimeType, fileName: testFile.name };
          }

          const backendRes = await fetch("/api/cross-reference-course", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentsFile: agentsPayload,
              courseFile: testPayload,
              passingScoreThreshold: passingThreshold,
            }),
          });

          if (backendRes.ok) {
            const backendData = await backendRes.json();
            const matched = backendData.matchedInCourseCount ?? 0;
            setPreviewResult({
              records: backendData.records,
              topic: backendData.trainingTopic || "Capacitación Operativa",
              trainer: backendData.trainer || "Trainer Responsable",
              summary: backendData.aiSummary,
              recommendations: backendData.aiRecommendations || [],
              isAiExtracted: false,
              matchedInfo: `Filtrado Backend: ${matched} emparejados de ${backendData.totalAgentsInList} asesores (${backendData.discardedFromCourseCount} registros ajenos descartados).`,
              matchedCount: matched,
              discardedCount: backendData.discardedFromCourseCount ?? 0,
              noMatchesWarning: matched === 0,
            });
            return;
          } else if (bothExcel) {
            // Client-side fallback
            setProcessingStep("Procesando directamente planillas de Asesores y Curso...");
            const parsedRoster = await parseExcelOrCsvFile(agentsFile!);
            const parsedTest = await parseExcelOrCsvFile(testFile!);
            const merged = mergeExcelRosterAndTestResults(parsedRoster, parsedTest, passingThreshold);
            setPreviewResult({
              records: merged.records,
              topic: merged.topic || "Capacitación Operativa",
              trainer: merged.trainer || "Trainer Responsable",
              summary: merged.summary,
              recommendations: [
                "Realizar sesión de refuerzo para los agentes con calificación menor a " + passingThreshold + " puntos.",
                "Verificar con los " + merged.unmatchedInTestCount + " asesores que no registran presentación en el test.",
              ],
              isAiExtracted: false,
              matchedInfo: `Cruce: ${merged.matchedCount} emparejados de ${parsedRoster.detectedAgents.length} asesores.`,
              matchedCount: merged.matchedCount,
              noMatchesWarning: merged.matchedCount === 0,
            });
            return;
          }
        }

        // AI MULTIMODAL CROSS-REFERENCING (Gemini 3.7 Flash)
        setProcessingStep("Preparando archivos para cruce con IA...");

        let agentsPayload = null;
        if (agentsFile) {
          const { base64, mimeType } = await fileToBase64(agentsFile);
          agentsPayload = { data: base64, mimeType, fileName: agentsFile.name };
        }

        let testPayload = null;
        if (testFile) {
          const { base64, mimeType } = await fileToBase64(testFile);
          testPayload = { data: base64, mimeType, fileName: testFile.name };
        }

        setProcessingStep("Gemini 3.7 Flash cruzando Lista de Asesores con Resultados del Test...");
        const response = await fetch("/api/analyze-training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentsFile: agentsPayload,
            testResultsFile: testPayload,
            passingScoreThreshold: passingThreshold,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          // Fallback if both are spreadsheets
          if (bothExcel) {
            setProcessingStep("Intentando cruce directo mediante parser Excel...");
            const parsedRoster = await parseExcelOrCsvFile(agentsFile!);
            const parsedTest = await parseExcelOrCsvFile(testFile!);
            const merged = mergeExcelRosterAndTestResults(parsedRoster, parsedTest, passingThreshold);
            setPreviewResult({
              records: merged.records,
              topic: merged.topic || "Capacitación Operativa",
              trainer: merged.trainer || "Trainer Responsable",
              summary: merged.summary,
              isAiExtracted: false,
              matchedCount: merged.matchedCount,
              noMatchesWarning: merged.matchedCount === 0,
            });
            return;
          }
          throw new Error(errData.error || "No se pudo realizar el cruce con IA.");
        }

        const data: AIAnalysisResponse = await response.json();
        const matchedAgents = data.records.filter((r) => r.score !== null).length;
        setPreviewResult({
          records: data.records,
          summary: data.aiSummary,
          topic: data.trainingTopic,
          trainer: data.trainer,
          recommendations: data.aiRecommendations,
          isAiExtracted: true,
          matchedInfo: `Cruce con IA: ${data.records.length} registros consolidados (${matchedAgents} con calificación evaluada).`,
          matchedCount: matchedAgents,
          noMatchesWarning: matchedAgents === 0,
        });
      }

      // 2. PASTE TEXT MODE
      else if (uploadMode === "paste") {
        setProcessingStep("Cruzando y analizando texto con IA...");
        const response = await fetch("/api/analyze-training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentsText: agentsText.trim() || undefined,
            testResultsText: testText.trim() || undefined,
            fileName: "Cruce_Texto_Asesores_y_Test.txt",
            passingScoreThreshold: passingThreshold,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "Error al procesar el texto con IA.");
        }

        const data: AIAnalysisResponse = await response.json();
        setPreviewResult({
          records: data.records,
          summary: data.aiSummary,
          topic: data.trainingTopic,
          trainer: data.trainer,
          recommendations: data.aiRecommendations,
          isAiExtracted: true,
        });
      }

      // 3. SINGLE CONSOLIDATED FILE MODE
      else if (uploadMode === "single" && singleFile) {
        setProcessingStep("Analizando archivo consolidado con IA...");
        const { base64, mimeType } = await fileToBase64(singleFile);

        const response = await fetch("/api/analyze-training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData: base64,
            mimeType,
            fileName: singleFile.name,
            passingScoreThreshold: passingThreshold,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || "No se pudo analizar el archivo.");
        }

        const data: AIAnalysisResponse = await response.json();
        setPreviewResult({
          records: data.records,
          summary: data.aiSummary,
          topic: data.trainingTopic,
          trainer: data.trainer,
          recommendations: data.aiRecommendations,
          isAiExtracted: true,
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Ocurrió un error al procesar y cruzar los archivos.");
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const handleConfirmImport = () => {
    if (!previewResult || previewResult.records.length === 0) return;

    let batchName = "Capacitación Operativa";
    if (uploadMode === "dual") {
      // IGNORE the first file (agents list). Use strictly the second file name (test/course evaluation file)
      if (testFile?.name) {
        batchName = testFile.name;
      } else if (agentsFile?.name) {
        batchName = agentsFile.name;
      } else {
        batchName = "Resultados del Test";
      }
    } else if (uploadMode === "single") {
      batchName = singleFile?.name || "Archivo Consolidado";
    } else {
      batchName = "Resultados del Test";
    }

    const isNoMatches =
      uploadMode === "dual" &&
      (previewResult.matchedCount === 0 ||
        previewResult.records.every((r) => r.score === null));

    onImportComplete({
      records: previewResult.records,
      batchName,
      mode: importMode,
      aiSummary: previewResult.summary,
      aiRecommendations: previewResult.recommendations,
      trainingTopic: previewResult.topic,
      trainer: previewResult.trainer,
      matchedInCourseCount: previewResult.matchedCount,
      discardedFromCourseCount: previewResult.discardedCount,
      noMatchesWarning: isNoMatches,
    });

    onClose();
  };

  const approvedInPreview = previewResult?.records.filter((r) => r.status === "Aprobado").length || 0;
  const totalInPreview = previewResult?.records.length || 0;
  const bothExcel = agentsFile && testFile && isExcelOrCsv(agentsFile.name) && isExcelOrCsv(testFile.name);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-[#D9DED4] rounded-2xl w-full max-w-4xl shadow-xl text-[#2D332A] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E8EAE3] flex items-center justify-between bg-[#F9F9F7]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#E6F3E6] border border-[#C6DEC6] text-[#4F7A4F] flex items-center justify-center">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#2D332A] flex items-center gap-2">
                <span>{updateTargetName ? "Actualizar Análisis en Drive" : "Cruce y Análisis de 2 Archivos"}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#D9E2D5] text-[#2D332A] border border-[#C2CEC0]">
                  {updateTargetName ? "Sobreescritura" : "Asesores + Resultados Test"}
                </span>
              </h2>
              <p className="text-xs text-[#6B7366]">
                {updateTargetName
                  ? `Subí los nuevos archivos para recalcular y sobreescribir "${updateTargetName}"`
                  : "Sube la nómina de asesores y los resultados del test para unificar notas, asistencia y estado de aprobación"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7366] hover:text-[#2D332A] p-1.5 rounded-lg hover:bg-[#F1F3EE] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Navigation Tabs */}
          {!previewResult && (
            <div className="flex flex-wrap gap-2 border-b border-[#E8EAE3] pb-3">
              <button
                type="button"
                id="tab-mode-dual"
                onClick={() => setUploadMode("dual")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  uploadMode === "dual"
                    ? "bg-[#8DA189] text-white shadow-xs"
                    : "bg-[#F1F3EE] text-[#6B7366] hover:text-[#2D332A] hover:bg-[#E8EAE3]"
                }`}
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>2 Archivos: Asesores + Resultados Test</span>
              </button>

              <button
                type="button"
                id="tab-mode-single"
                onClick={() => setUploadMode("single")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  uploadMode === "single"
                    ? "bg-[#8DA189] text-white shadow-xs font-semibold"
                    : "bg-[#F1F3EE] text-[#6B7366] hover:text-[#2D332A] hover:bg-[#E8EAE3]"
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>1 Archivo Consolidado</span>
              </button>

              <button
                type="button"
                id="tab-mode-paste"
                onClick={() => setUploadMode("paste")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  uploadMode === "paste"
                    ? "bg-[#8DA189] text-white shadow-xs font-semibold"
                    : "bg-[#F1F3EE] text-[#6B7366] hover:text-[#2D332A] hover:bg-[#E8EAE3]"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                <span>Pegar Texto / Tablas</span>
              </button>
            </div>
          )}

          {/* DUAL UPLOAD MODE: 2 DISTINCT BUTTONS AND DROPZONES */}
          {uploadMode === "dual" && !previewResult && !isProcessing && (
            <div className="space-y-4">
              <div className="bg-[#E6F3E6]/60 border border-[#C6DEC6] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#2D332A]">
                <Sparkles className="h-4 w-4 text-[#4F7A4F] shrink-0 mt-0.5" />
                <p>
                  <strong>Procesamiento y Filtro Automático por 'Usuario':</strong> El backend compara la columna <strong>'Usuario'</strong> de la planilla del curso con el <strong>Listado de IDs de Agentes</strong>. Se <em>descartan automáticamente todos los registros ajenos</em> que no figuren en la lista, extrayendo las notas de las <strong>columnas R a la U</strong> (80, 90 o 100 aprobados).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BUTTON & DROPZONE 1: LISTADO DE IDS DE AGENTES */}
                <div
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    agentsFile
                      ? "border-[#8DA189] bg-[#E6F3E6]/30"
                      : "border-[#D9DED4] hover:border-[#8DA189] bg-[#F9F9F7] hover:bg-[#F1F3EE]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-white border border-[#D9DED4] text-[#8DA189] flex items-center justify-center shadow-2xs">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#2D332A]">1. Listado de IDs de Agentes</h3>
                          <span className="text-[11px] text-[#6B7366]">Nómina oficial (columna Usuario / ID)</span>
                        </div>
                      </div>
                      {agentsFile && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Cargado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#6B7366] mb-4">
                      Sube el listado con los IDs / Usuarios de los agentes seleccionados para filtrar (Excel, CSV, PDF, TXT).
                    </p>

                    {agentsFile ? (
                      <div className="bg-white border border-[#D9DED4] rounded-xl p-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="h-9 w-9 rounded-lg bg-[#E6F3E6] text-[#4F7A4F] flex items-center justify-center shrink-0">
                            {isExcelOrCsv(agentsFile.name) ? (
                              <FileSpreadsheet className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-[#2D332A] truncate" title={agentsFile.name}>
                              {agentsFile.name}
                            </p>
                            <p className="text-[10px] text-[#6B7366]">
                              {(agentsFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAgentsFile(null)}
                          className="text-[#9E4A4A] hover:text-[#7A3636] p-1 rounded-md hover:bg-[#FDF1F1] transition-colors cursor-pointer"
                          title="Quitar archivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E8EAE3]/80">
                    <input
                      ref={agentsInputRef}
                      type="file"
                      id="input-agents-file"
                      accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={handleAgentsFileChange}
                    />
                    <button
                      type="button"
                      id="btn-upload-agents-list"
                      onClick={() => agentsInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-all shadow-2xs cursor-pointer active:scale-98"
                    >
                      <Users className="h-3.5 w-3.5 text-[#8DA189]" />
                      <span>{agentsFile ? "Cambiar Listado de IDs" : "Subir Listado de IDs"}</span>
                    </button>
                  </div>
                </div>

                {/* BUTTON & DROPZONE 2: PLANILLA COMPLETA DEL CURSO */}
                <div
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col justify-between transition-all ${
                    testFile
                      ? "border-[#8DA189] bg-[#E6F3E6]/30"
                      : "border-[#D9DED4] hover:border-[#8DA189] bg-[#F9F9F7] hover:bg-[#F1F3EE]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-white border border-[#D9DED4] text-[#8DA189] flex items-center justify-center shadow-2xs">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-[#2D332A]">2. Planilla Completa del Curso</h3>
                          <span className="text-[11px] text-[#6B7366]">Columna 'Usuario' y notas en cols R a U</span>
                        </div>
                      </div>
                      {testFile && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Cargado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#6B7366] mb-4">
                      Sube la planilla general del curso. Se comparará la columna 'Usuario' y se filtrarán solo los agentes del listado.
                    </p>

                    {testFile ? (
                      <div className="bg-white border border-[#D9DED4] rounded-xl p-3 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="h-9 w-9 rounded-lg bg-[#E6F3E6] text-[#4F7A4F] flex items-center justify-center shrink-0">
                            {isExcelOrCsv(testFile.name) ? (
                              <FileSpreadsheet className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-[#2D332A] truncate" title={testFile.name}>
                              {testFile.name}
                            </p>
                            <p className="text-[10px] text-[#6B7366]">
                              {(testFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTestFile(null)}
                          className="text-[#9E4A4A] hover:text-[#7A3636] p-1 rounded-md hover:bg-[#FDF1F1] transition-colors cursor-pointer"
                          title="Quitar archivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E8EAE3]/80">
                    <input
                      ref={testInputRef}
                      type="file"
                      id="input-test-file"
                      accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={handleTestFileChange}
                    />
                    <button
                      type="button"
                      id="btn-upload-test-results"
                      onClick={() => testInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-all shadow-2xs cursor-pointer active:scale-98"
                    >
                      <GraduationCap className="h-3.5 w-3.5 text-[#8DA189]" />
                      <span>{testFile ? "Cambiar Planilla del Curso" : "Subir Planilla del Curso"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SINGLE CONSOLIDATED FILE MODE */}
          {uploadMode === "single" && !previewResult && !isProcessing && (
            <div
              onClick={() => singleInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                singleFile
                  ? "border-[#8DA189] bg-[#E6F3E6]/30"
                  : "border-[#D9DED4] hover:border-[#8DA189] bg-[#F9F9F7] hover:bg-[#F1F3EE]"
              }`}
            >
              <input
                ref={singleInputRef}
                type="file"
                id="input-single-file"
                accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={handleSingleFileChange}
              />
              {singleFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-xl bg-[#E6F3E6] text-[#4F7A4F] flex items-center justify-center border border-[#C6DEC6]">
                    {isExcelOrCsv(singleFile.name) ? (
                      <FileSpreadsheet className="h-6 w-6" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                  <span className="font-semibold text-[#2D332A] text-base">{singleFile.name}</span>
                  <span className="text-xs text-[#6B7366]">
                    {(singleFile.size / 1024).toFixed(1)} KB • Archivo consolidado
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSingleFile(null);
                    }}
                    className="mt-2 text-xs text-[#9E4A4A] hover:underline cursor-pointer"
                  >
                    Cambiar archivo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-2xl bg-white text-[#8DA189] flex items-center justify-center border border-[#D9DED4] mb-1 shadow-xs">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-[#2D332A]">
                    Sube un único archivo con asesores y notas integradas
                  </p>
                  <p className="text-xs text-[#6B7366]">
                    Formatos: Excel (.xlsx, .csv), PDF, Word (.docx), TXT o imágenes
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PASTE TEXT MODE: 2 TEXTAREAS */}
          {uploadMode === "paste" && !previewResult && !isProcessing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#2D332A] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-[#8DA189]" />
                    <span>1. Lista de Asesores (Nombres, DNI, Campaña):</span>
                  </label>
                  <textarea
                    rows={6}
                    value={agentsText}
                    onChange={(e) => setAgentsText(e.target.value)}
                    placeholder="Ejemplo:&#10;Juan Pérez | DNI 34567890 | Campaña Ventas&#10;María López | DNI 38990112 | Campaña Atención"
                    className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl p-3 text-xs text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 font-mono"
                  ></textarea>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#2D332A] flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-[#8DA189]" />
                    <span>2. Resultados del Test (Notas, Respuestas):</span>
                  </label>
                  <textarea
                    rows={6}
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Ejemplo:&#10;Juan Pérez | Nota: 85 | Aprobado | Excelente en CRM&#10;María López | Nota: 60 | No Aprobado | Repasar objeciones"
                    className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl p-3 text-xs text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 font-mono"
                  ></textarea>
                </div>
              </div>
            </div>
          )}

          {/* PARAMETERS CONFIGURATION */}
          {!previewResult && !isProcessing && (
            <div className="bg-[#F9F9F7] border border-[#D9DED4] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2D332A]">
                <Sliders className="h-4 w-4 text-[#8DA189]" />
                <span>Criterios de Evaluación y Aprobación</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#6B7366] mb-1">
                    Nota mínima para aprobar el test (Escala 0-100):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="input-passing-threshold"
                      min="0"
                      max="100"
                      value={passingThreshold}
                      onChange={(e) => setPassingThreshold(Number(e.target.value))}
                      className="bg-white border border-[#D9DED4] rounded-lg px-3 py-1.5 text-sm font-bold text-[#4F7A4F] w-24 focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
                    />
                    <span className="text-xs text-[#6B7366]">puntos (80 por defecto: 80, 90 y 100 aprueban)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#6B7366] mb-1">Modo de incorporación en la app:</label>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                        className="text-[#8DA189] focus:ring-[#8DA189]"
                      />
                      <span className="text-[#2D332A]">Reemplazar lista actual</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === "append"}
                        onChange={() => setImportMode("append")}
                        className="text-[#8DA189] focus:ring-[#8DA189]"
                      />
                      <span className="text-[#2D332A]">Anexar a existentes</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROCESSING STATE */}
          {isProcessing && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-[#E8EAE3] border-t-[#8DA189] animate-spin"></div>
                <ArrowRightLeft className="h-6 w-6 text-[#8DA189] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-[#2D332A]">Cruzando y Analizando Archivos con IA...</h4>
                <p className="text-xs text-[#4F7A4F] mt-1 font-medium">{processingStep}</p>
                <p className="text-xs text-[#6B7366] mt-2 max-w-md">
                  Gemini está cruzando la lista de asesores con las notas del examen, evaluando quiénes aprobaron y generando el informe consolidado.
                </p>
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-4 bg-[#FDF1F1] border border-[#F0D5D5] rounded-xl flex items-start gap-3 text-[#9E4A4A] text-xs">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-[#9E4A4A]">Error durante el procesamiento:</span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* PREVIEW RESULT */}
          {previewResult && !isProcessing && (
            <div className="space-y-4">
              {previewResult.noMatchesWarning || previewResult.matchedCount === 0 ? (
                <div className="p-4 bg-[#FAF5E6] border border-[#EBDDBF] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white text-[#8C733E] flex items-center justify-center border border-[#EBDDBF] shadow-xs shrink-0">
                      <AlertTriangle className="h-6 w-6 text-[#8C733E]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#8C733E] text-sm sm:text-base flex items-center gap-1.5">
                        <span>Atención: Sin coincidencias con la Planilla del Curso</span>
                      </h3>
                      <p className="text-xs text-[#2D332A] mt-0.5">
                        Ningún ID de la lista de agentes seleccionados coincidió con la columna 'Usuario' de la planilla del curso. Se descartaron todos los registros ajenos ({previewResult.discardedCount ?? 0} filas) y los {totalInPreview} agentes figuran como pendientes.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewResult(null)}
                    className="text-xs text-[#8C733E] hover:text-[#705B2F] underline cursor-pointer shrink-0 font-medium"
                  >
                    Revisar Archivos
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-[#E6F3E6] border border-[#C6DEC6] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white text-[#4F7A4F] flex items-center justify-center border border-[#C6DEC6] shadow-xs">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#4F7A4F] text-sm sm:text-base">
                        ¡Cruce y Análisis Finalizado con Éxito!
                      </h3>
                      <p className="text-xs text-[#2D332A]">
                        Total: <strong className="text-[#2D332A]">{totalInPreview} agentes consolidados</strong> (
                        <span className="text-[#4F7A4F] font-semibold">{approvedInPreview} Aprobados</span>,{" "}
                        <span className="text-[#9E4A4A] font-semibold">{totalInPreview - approvedInPreview} No Aprobados / Pendientes</span>).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewResult(null)}
                    className="text-xs text-[#6B7366] hover:text-[#2D332A] underline cursor-pointer"
                  >
                    Volver a cargar
                  </button>
                </div>
              )}

              {/* AI Summary snippet */}
              {previewResult.summary && (
                <div className="bg-[#F9F9F7] border border-[#D9DED4] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#4F7A4F] mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#8DA189]" />
                    <span>Diagnóstico del Cruce de Datos (IA)</span>
                  </div>
                  <p className="text-xs text-[#2D332A] leading-relaxed">{previewResult.summary}</p>
                </div>
              )}

              {/* Consolidated Table Preview */}
              <div className="border border-[#D9DED4] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9F9F7] sticky top-0 text-[#6B7366] font-semibold border-b border-[#E8EAE3]">
                    <tr>
                      <th className="p-2.5">Asesor / Agente</th>
                      <th className="p-2.5">Campaña / Área</th>
                      <th className="p-2.5">Capacitación</th>
                      <th className="p-2.5 text-center">Nota Test</th>
                      <th className="p-2.5 text-center">Estado</th>
                      <th className="p-2.5">Observación / Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3EE] text-[#2D332A]">
                    {previewResult.records.map((r, idx) => (
                      <tr key={idx} className="hover:bg-[#F9F9F7]">
                        <td className="p-2.5 font-medium text-[#2D332A]">
                          {r.agentName}
                          <span className="block text-[10px] text-[#6B7366]">{r.agentId || "-"}</span>
                        </td>
                        <td className="p-2.5 text-[#6B7366]">{r.campaign || "General"}</td>
                        <td className="p-2.5 text-[#2D332A] max-w-[140px] truncate">{r.trainingName}</td>
                        <td className="p-2.5 text-center font-bold">
                          {r.score !== null ? (
                            <span className={r.score >= passingThreshold ? "text-[#4F7A4F]" : "text-[#9E4A4A]"}>
                              {r.score}
                            </span>
                          ) : (
                            <span className="text-[#6B7366]">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              r.status === "Aprobado"
                                ? "bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6]"
                                : r.status === "No Aprobado"
                                ? "bg-[#FDF1F1] text-[#9E4A4A] border border-[#F0D5D5]"
                                : "bg-[#FFF8E6] text-[#B27B10] border border-[#F5E2B3]"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-[#6B7366] max-w-[200px] truncate" title={r.feedback}>
                          {r.feedback}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-[#F9F9F7] border-t border-[#E8EAE3] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-[#6B7366] hover:text-[#2D332A] rounded-xl hover:bg-[#E8EAE3] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {!previewResult ? (
            <div className="flex items-center gap-2">
              {/* Optional Fast Excel Merge Button when both are Excel */}
              {bothExcel && (
                <button
                  type="button"
                  onClick={() => processFiles(false)}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-medium text-[#2D332A] bg-white hover:bg-[#F1F3EE] border border-[#D9DED4] rounded-xl transition-all cursor-pointer shadow-xs"
                  title="Cruce rápido mediante coincidencia local de columnas Excel"
                >
                  Cruce Rápido Excel
                </button>
              )}

              <button
                type="button"
                id="btn-start-cross-analysis"
                onClick={() => processFiles(true)}
                disabled={
                  isProcessing ||
                  (uploadMode === "dual" && !agentsFile && !testFile) ||
                  (uploadMode === "single" && !singleFile) ||
                  (uploadMode === "paste" && !agentsText && !testText)
                }
                className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#8DA189] hover:bg-[#7D9179] text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-98"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Cruzando Datos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Cruzar y Analizar con IA (Gemini)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="btn-confirm-import"
              onClick={handleConfirmImport}
              className="flex items-center gap-2 px-6 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#8DA189] hover:bg-[#7D9179] text-white shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirmar e Importar {totalInPreview} Asesores</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
