import * as XLSX from "xlsx";
import { AgentRecord } from "../types";

export interface ParsedExcelResult {
  fileName: string;
  rowCount: number;
  headers: string[];
  rawRows: Record<string, any>[];
  detectedAgents: Partial<AgentRecord>[];
  suggestedTopic?: string;
  suggestedTrainer?: string;
}

/**
 * Normalizes text to help fuzzy find headers
 */
function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file from an ArrayBuffer or binary string
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParsedExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Use the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 1. Check raw matrix of rows (array of arrays) to detect headerless files
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!matrix || matrix.length === 0) {
          throw new Error("El archivo Excel/CSV está vacío o no contiene filas con datos.");
        }

        const firstRow = matrix[0] || [];
        const n0 = normalizeHeader(String(firstRow[0] || ""));
        const n1 = normalizeHeader(String(firstRow[1] || ""));

        const isHeaderRow =
          (n0 === "usuario" ||
            n0 === "user" ||
            n0 === "username" ||
            n0 === "id" ||
            n0 === "id_usuario" ||
            n0 === "id usuario" ||
            n0 === "dni" ||
            n0 === "legajo" ||
            n0 === "codigo" ||
            n0 === "asesor" ||
            n0 === "colaborador" ||
            n0 === "agente") &&
          (n1.includes("supervisor") ||
            n1.includes("superv") ||
            n1.includes("nombre") ||
            n1.includes("team leader") ||
            n1.includes("tl") ||
            n1.includes("lider") ||
            n1.includes("coordinador") ||
            n1.includes("jefe") ||
            n0 === "id_usuario");

        // Convert sheet to JSON rows if headers exist
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });

        // Special Case: Headerless 2-column or multi-column Agent List (e.g. U616446,"Aguirre, Maria José")
        if (!isHeaderRow && matrix.length > 0 && matrix[0].length >= 2 && matrix[0].length <= 5) {
          const detectedAgents: Partial<AgentRecord>[] = [];

          for (let i = 0; i < matrix.length; i++) {
            const row = matrix[i];
            if (!row || row.length === 0) continue;

            const rawId = String(row[0] || "").replace(/^["']|["']$/g, "").trim();
            if (!rawId) continue;

            const rawSupervisor = row[1] !== undefined ? String(row[1]).replace(/^["']|["']$/g, "").trim() : "";
            const rawName = row.length > 2 && row[2] ? String(row[2]).trim() : rawId;
            const campaign = row.length > 3 && row[3] ? String(row[3]).trim() : "Operaciones";

            detectedAgents.push({
              agentName: rawName,
              agentId: rawId,
              supervisor: rawSupervisor || undefined,
              campaign,
              trainingName: "Capacitación Operativa",
              trainerName: "Trainer Asignado",
              completionDate: new Date().toISOString().split("T")[0],
              score: null,
              minPassingScore: 80,
              status: "Pendiente",
              attendancePercentage: 100,
              feedback: "Registro importado desde nómina de asesores.",
              needsRetraining: false,
            });
          }

          if (detectedAgents.length > 0) {
            return resolve({
              fileName: file.name,
              rowCount: detectedAgents.length,
              headers: ["ID_USUARIO", "Supervisor"],
              rawRows,
              detectedAgents,
              suggestedTopic: "Capacitación Operativa",
              suggestedTrainer: "Trainer Asignado",
            });
          }
        }

        const headers = Object.keys(rawRows[0] || {});

        // Heuristic detection of columns
        let nameKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            (n.includes("nombre") && !n.includes("supervisor")) ||
            n.includes("usuario") ||
            n.includes("user") ||
            n.includes("username") ||
            n.includes("agente") ||
            n.includes("colaborador") ||
            n.includes("empleado") ||
            n.includes("participante") ||
            n.includes("alumno") ||
            n.includes("estudiante")
          );
        });

        let idKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("dni") ||
            n.includes("legajo") ||
            n.includes("rut") ||
            n.includes("cedula") ||
            n.includes("documento") ||
            n.includes("codigo") ||
            n.includes("id") ||
            n.includes("usuario") ||
            n.includes("user") ||
            n.includes("username") ||
            n.includes("email") ||
            n.includes("correo")
          );
        });

        // Check if there are columns in range R to U (index 17, 18, 19, 20) and V & W (index 21, 22)
        const colR = headers[17]; // Column R (18th column)
        const colS = headers[18]; // Column S (19th column)
        const colT = headers[19]; // Column T (20th column)
        const colU = headers[20]; // Column U (21st column)
        const colV = headers[21]; // Column V (22nd column - Recuperatorio 1)
        const colW = headers[22]; // Column W (23rd column - Recuperatorio 2)

        let scoreKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("nota") ||
            n.includes("calificacion") ||
            n.includes("puntaje") ||
            n.includes("score") ||
            n.includes("evaluacion") ||
            n.includes("resultado numerico") ||
            n.includes("puntos") ||
            n.includes("porcentaje")
          );
        }) || colR || colS;

        let retakeKey1 = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("recuperatorio 1") ||
            n.includes("recup 1") ||
            n.includes("recuperatorio") ||
            n.includes("recuperacion") ||
            n.includes("columna v") ||
            n.includes("col v") ||
            n === "v"
          );
        }) || colV;

        let retakeKey2 = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("recuperatorio 2") ||
            n.includes("recup 2") ||
            n.includes("recuperacion 2") ||
            n.includes("columna w") ||
            n.includes("col w") ||
            n === "w"
          );
        }) || colW;

        let statusKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("estado") ||
            n.includes("aprob") ||
            n.includes("condicion") ||
            n.includes("estatus") ||
            n.includes("status") ||
            n.includes("resultado")
          );
        }) || colS || colR;

        let trainerKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("trainer") ||
            n.includes("capacitador") ||
            n.includes("instructor") ||
            n.includes("formador") ||
            n.includes("docente") ||
            n.includes("profesor")
          );
        });

        let trainingKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("curso") ||
            n.includes("capacitacion") ||
            n.includes("modulo") ||
            n.includes("tema") ||
            n.includes("entrenamiento") ||
            n.includes("taller")
          );
        });

        let campaignKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("campana") ||
            n.includes("area") ||
            n.includes("servicio") ||
            n.includes("departamento") ||
            n.includes("cuenta") ||
            n.includes("operacion")
          );
        });

        let supervisorKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("supervisor") ||
            n.includes("superv") ||
            n.includes("sup") ||
            n.includes("lider") ||
            n.includes("team leader") ||
            n.includes("team lead") ||
            n.includes("coordinador") ||
            n.includes("jefe")
          );
        });

        let attendanceKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("asistencia") ||
            n.includes("presente") ||
            n.includes("asist") ||
            n.includes("% asist")
          );
        });

        let dateKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("fecha") ||
            n.includes("date") ||
            n.includes("dia") ||
            n.includes("finalizacion")
          );
        }) || colU;

        let feedbackKey = headers.find((h) => {
          const n = normalizeHeader(h);
          return (
            n.includes("observacion") ||
            n.includes("comentario") ||
            n.includes("feedback") ||
            n.includes("detalle") ||
            n.includes("nota trainer") ||
            n.includes("respuestas")
          );
        }) || colT || colU;

        // Fallback for nameKey if not found: use first column
        if (!nameKey && headers.length > 0) {
          nameKey = headers[0];
        }

        const detectedAgents: Partial<AgentRecord>[] = rawRows.map((row, index) => {
          const rawName = nameKey ? String(row[nameKey] || "").trim() : `Agente ${index + 1}`;
          const rawScore = scoreKey ? row[scoreKey] : null;
          let numScore: number | null = null;

          if (rawScore !== null && rawScore !== undefined && rawScore !== "") {
            const parsed = parseFloat(String(rawScore).replace(/,/g, ".").replace(/%/g, ""));
            if (!isNaN(parsed)) {
              // Normalize score if on scale 1-10 or 1-5
              if (parsed <= 10 && parsed > 0) {
                numScore = Math.round(parsed * 10);
              } else if (parsed <= 5 && parsed > 0) {
                numScore = Math.round(parsed * 20);
              } else {
                numScore = Math.round(parsed);
              }
            }
          }

          const initialScore = numScore;
          let passedInRetake = false;
          let retakeScore: number | null = null;
          let retakeDetails: string | undefined = undefined;

          // Check Columns V & W (Recuperatorios)
          const rawScoreV = retakeKey1 && row[retakeKey1] !== undefined ? row[retakeKey1] : (colV && row[colV] !== undefined ? row[colV] : null);
          const rawScoreW = retakeKey2 && row[retakeKey2] !== undefined ? row[retakeKey2] : (colW && row[colW] !== undefined ? row[colW] : null);

          let parsedScoreV: number | null = null;
          let parsedScoreW: number | null = null;

          if (rawScoreV !== null && rawScoreV !== undefined && rawScoreV !== "") {
            const p = parseFloat(String(rawScoreV).replace(/,/g, ".").replace(/%/g, ""));
            if (!isNaN(p)) parsedScoreV = p <= 10 && p > 0 ? Math.round(p * 10) : Math.round(p);
          }
          if (rawScoreW !== null && rawScoreW !== undefined && rawScoreW !== "") {
            const p = parseFloat(String(rawScoreW).replace(/,/g, ".").replace(/%/g, ""));
            if (!isNaN(p)) parsedScoreW = p <= 10 && p > 0 ? Math.round(p * 10) : Math.round(p);
          }

          const passedV = parsedScoreV !== null && parsedScoreV >= 80;
          const passedW = parsedScoreW !== null && parsedScoreW >= 80;

          if (numScore === null || numScore < 80) {
            if (passedV || passedW) {
              passedInRetake = true;
              retakeScore = Math.max(passedV ? parsedScoreV! : 0, passedW ? parsedScoreW! : 0);
              numScore = retakeScore;
              if (passedV && passedW) {
                retakeDetails = `Aprobado en Recuperatorio (Col. V: ${parsedScoreV} pts, Col. W: ${parsedScoreW} pts)`;
              } else if (passedV) {
                retakeDetails = `Aprobado en Recuperatorio (Columna V: ${parsedScoreV} pts)`;
              } else {
                retakeDetails = `Aprobado en Recuperatorio (Columna W: ${parsedScoreW} pts)`;
              }
            }
          }

          let rawStatus = statusKey ? String(row[statusKey] || "").trim() : "";
          let status: AgentRecord["status"] = "Pendiente";

          const normStatus = normalizeHeader(rawStatus);
          if (
            normStatus.includes("aprob") ||
            normStatus.includes("apto") ||
            normStatus.includes("pass") ||
            normStatus.includes("si") ||
            normStatus.includes("ok")
          ) {
            status = "Aprobado";
          } else if (
            normStatus.includes("no") ||
            normStatus.includes("reprob") ||
            normStatus.includes("desaprob") ||
            normStatus.includes("fail") ||
            normStatus.includes("rechaz")
          ) {
            status = "No Aprobado";
          } else if (numScore !== null) {
            status = numScore >= 80 ? "Aprobado" : "No Aprobado";
          }

          let attendance: number | null = 100;
          if (attendanceKey && row[attendanceKey]) {
            const parsedAtt = parseFloat(String(row[attendanceKey]).replace(/%/g, "").replace(/,/g, "."));
            if (!isNaN(parsedAtt)) {
              attendance = Math.min(100, Math.max(0, parsedAtt <= 1 ? parsedAtt * 100 : parsedAtt));
            }
          }

          let feedback = feedbackKey && row[feedbackKey] ? String(row[feedbackKey]).trim() : "";
          if (!feedback) {
            if (passedInRetake) {
              feedback = `Aprobó en instancia de recuperatorio (${retakeDetails}) con ${retakeScore} pts (Nota inicial: ${initialScore !== null ? `${initialScore} pts` : "N/E"}).`;
            } else if (status === "Aprobado") {
              feedback = `Aprobó la evaluación con calificación ${numScore !== null ? `${numScore}/100` : "satisfactoria"}.`;
            } else if (numScore !== null) {
              feedback = `Calificación obtenida: ${numScore}/100. Requiere refuerzo.`;
            } else {
              feedback = "Registro importado desde planilla.";
            }
          }

          return {
            agentName: rawName || `Agente ${index + 1}`,
            agentId: idKey && row[idKey] ? String(row[idKey]).trim() : `AG-${1000 + index + 1}`,
            campaign: campaignKey && row[campaignKey] ? String(row[campaignKey]).trim() : "Operaciones",
            supervisor: supervisorKey && row[supervisorKey] ? String(row[supervisorKey]).trim() : undefined,
            trainingName: trainingKey && row[trainingKey] ? String(row[trainingKey]).trim() : "Capacitación de Trainer",
            trainerName: trainerKey && row[trainerKey] ? String(row[trainerKey]).trim() : "Trainer Principal",
            completionDate: dateKey && row[dateKey] ? String(row[dateKey]).trim() : new Date().toISOString().split("T")[0],
            score: numScore,
            minPassingScore: 80,
            status,
            passedInRetake,
            initialScore,
            retakeScore,
            retakeDetails,
            attendancePercentage: attendance,
            feedback,
            needsRetraining: status !== "Aprobado",
          };
        });

        resolve({
          fileName: file.name,
          rowCount: rawRows.length,
          headers,
          rawRows,
          detectedAgents,
          suggestedTopic: detectedAgents[0]?.trainingName,
          suggestedTrainer: detectedAgents[0]?.trainerName,
        });
      } catch (err: any) {
        reject(new Error("Error al leer el archivo Excel/CSV: " + err.message));
      }
    };

    reader.onerror = () => {
      reject(new Error("Error al abrir el archivo."));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Merges two parsed datasets: 1. Asesores/Agentes Roster and 2. Test Results
 */
export function mergeExcelRosterAndTestResults(
  rosterResult: ParsedExcelResult,
  testResult: ParsedExcelResult,
  passingScore: number = 80
): {
  records: AgentRecord[];
  summary: string;
  matchedCount: number;
  unmatchedInTestCount: number;
  topic?: string;
  trainer?: string;
} {
  const rosterAgents = rosterResult.detectedAgents;
  const testAgents = testResult.detectedAgents;
  const matchedTestIndices = new Set<number>();

  const records: AgentRecord[] = [];

  // Match roster agents against test results
  rosterAgents.forEach((rAgent, rIdx) => {
    const rNameNorm = normalizeHeader(rAgent.agentName || "").toLowerCase();
    const rIdNorm = normalizeHeader(rAgent.agentId || "").toLowerCase();
    const rIdWithoutU = rIdNorm.replace(/^u/, "");

    // Find in test results by ID or Name (case-insensitive)
    let matchedTestIdx = testAgents.findIndex((tAgent, tIdx) => {
      if (matchedTestIndices.has(tIdx)) return false;
      const tIdNorm = normalizeHeader(tAgent.agentId || "").toLowerCase();
      const tIdWithoutU = tIdNorm.replace(/^u/, "");

      if (rIdNorm && tIdNorm) {
        if (rIdNorm === tIdNorm || (rIdWithoutU.length > 3 && rIdWithoutU === tIdWithoutU)) {
          return true;
        }
      }

      const tNameNorm = normalizeHeader(tAgent.agentName || "").toLowerCase();
      if (rIdNorm && tNameNorm && (rIdNorm === tNameNorm || (rIdWithoutU.length > 3 && tNameNorm.includes(rIdWithoutU)))) {
        return true;
      }

      if (!rNameNorm || !tNameNorm) return false;

      // Exact or inclusion match
      if (rNameNorm === tNameNorm) return true;
      if (rNameNorm.length > 5 && tNameNorm.includes(rNameNorm)) return true;
      if (tNameNorm.length > 5 && rNameNorm.includes(tNameNorm)) return true;

      // Split name parts
      const rParts = rNameNorm.split(" ").filter((p) => p.length > 2);
      const tParts = tNameNorm.split(" ").filter((p) => p.length > 2);
      const commonParts = rParts.filter((p) => tParts.includes(p));
      return commonParts.length >= 2;
    });

    const testMatch = matchedTestIdx !== -1 ? testAgents[matchedTestIdx] : null;
    if (matchedTestIdx !== -1) {
      matchedTestIndices.add(matchedTestIdx);
    }

    const finalScore = testMatch?.score ?? rAgent.score ?? null;
    const finalStatus: AgentRecord["status"] =
      finalScore !== null
        ? finalScore >= passingScore
          ? "Aprobado"
          : "No Aprobado"
        : testMatch
        ? testMatch.status || "Pendiente"
        : "Pendiente";

    const feedback = testMatch
      ? testMatch.feedback || (finalScore !== null && finalScore >= passingScore ? "Aprobó el examen satisfactoriamente." : "Requiere refuerzo en los temas del examen.")
      : "Agente registrado en nómina pero sin registro en la planilla de resultados del test.";

    records.push({
      id: `agent_merged_${Date.now()}_${rIdx + 1}`,
      agentName: rAgent.agentName || `Asesor ${rIdx + 1}`,
      agentId: rAgent.agentId || testMatch?.agentId || `AG-${1000 + rIdx + 1}`,
      supervisor: rAgent.supervisor || testMatch?.supervisor || undefined,
      campaign: rAgent.campaign || testMatch?.campaign || "Operaciones",
      trainingName: testMatch?.trainingName || rAgent.trainingName || testResult.suggestedTopic || rosterResult.suggestedTopic || "Capacitación Operativa",
      trainerName: rAgent.trainerName || testMatch?.trainerName || rosterResult.suggestedTrainer || "Trainer Asignado",
      completionDate: testMatch?.completionDate || rAgent.completionDate || new Date().toISOString().split("T")[0],
      score: finalScore,
      minPassingScore: passingScore,
      status: finalStatus,
      passedInRetake: testMatch?.passedInRetake || rAgent.passedInRetake,
      initialScore: testMatch?.initialScore ?? rAgent.initialScore,
      retakeScore: testMatch?.retakeScore ?? rAgent.retakeScore,
      retakeDetails: testMatch?.retakeDetails ?? rAgent.retakeDetails,
      attendancePercentage: rAgent.attendancePercentage ?? testMatch?.attendancePercentage ?? 100,
      feedback,
      skillsAcquired: ["Procesos", "Evaluación de Capacitación"],
      needsRetraining: finalStatus !== "Aprobado",
      sourceFileName: `${rosterResult.fileName} + ${testResult.fileName}`,
    });
  });

  // Strict filtering: We ONLY keep roster agents. Any test taker not in the roster is dismissed/desestimado.
  const matchedCount = matchedTestIndices.size;
  const unmatchedInTestCount = rosterAgents.length - matchedCount;
  const dismissedExtraTestCount = testAgents.length - matchedCount;

  const topic = testResult.suggestedTopic || rosterResult.suggestedTopic || "Capacitación Evaluada";
  const trainer = rosterResult.suggestedTrainer || testResult.suggestedTrainer || "Trainer Asignado";
  
  let summary = `Se cruzaron los datos filtrando únicamente los ${rosterAgents.length} asesores de la lista oficial (${rosterResult.fileName}). Se emparejaron ${matchedCount} notas del test.`;
  if (dismissedExtraTestCount > 0) {
    summary += ` Se desestimaron ${dismissedExtraTestCount} registros de la planilla de exámenes por no pertenecer a la nómina oficial.`;
  }
  if (unmatchedInTestCount > 0) {
    summary += ` ${unmatchedInTestCount} asesores de la nómina figuran como pendientes por no rendir el test.`;
  }

  return {
    records,
    summary,
    matchedCount,
    unmatchedInTestCount,
    topic,
    trainer,
  };
}

/**
 * Converts File to base64 string for Gemini API
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({
        base64,
        mimeType: file.type || "application/octet-stream",
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Exports agent records and training summary into an Excel (.xlsx) file
 */
export function exportAgentsToExcel(records: AgentRecord[], batchInfo?: { topic?: string; trainer?: string }) {
  const wb = XLSX.utils.book_new();

  // 1. Detailed Agent Sheet
  const agentsData = records.map((r, index) => ({
    "N°": index + 1,
    "Nombre del Agente": r.agentName,
    "ID / Legajo": r.agentId || "-",
    "Supervisor / TL": r.supervisor || "Sin Asignar",
    "Campaña / Área": r.campaign || "-",
    "Capacitación / Trainer": r.trainingName,
    "Trainer / Instructor": r.trainerName,
    "Fecha de Finalización": r.completionDate,
    "Calificación (0-100)": r.score !== null ? r.score : "N/E",
    "Nota Mínima Aprobación": r.minPassingScore,
    "Estado de Aprobación": r.status,
    "Instancia de Aprobación": r.passedInRetake ? "Aprobado en Recuperatorio" : (r.status === "Aprobado" ? "Aprobado (1ra Instancia)" : r.status),
    "Nota Inicial / Previa": r.initialScore !== undefined && r.initialScore !== null ? r.initialScore : "-",
    "Asistencia %": r.attendancePercentage !== undefined && r.attendancePercentage !== null ? `${r.attendancePercentage}%` : "100%",
    "Requiere Refuerzo": r.needsRetraining ? "SÍ" : "NO",
    "Observaciones / Feedback": r.feedback || "-",
    "Habilidades Validadas": (r.skillsAcquired || []).join(", "),
  }));

  const wsAgents = XLSX.utils.json_to_sheet(agentsData);
  XLSX.utils.book_append_sheet(wb, wsAgents, "Control de Agentes");

  // 2. Executive Summary Sheet
  const total = records.length;
  const approved = records.filter((r) => r.status === "Aprobado").length;
  const failed = records.filter((r) => r.status === "No Aprobado").length;
  const pending = records.filter((r) => r.status !== "Aprobado" && r.status !== "No Aprobado").length;
  const scores = records.map((r) => r.score).filter((s): s is number => typeof s === "number");
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "N/D";
  const passRate = total > 0 ? ((approved / total) * 100).toFixed(1) + "%" : "0%";

  const summaryData = [
    { Métrica: "Tema / Capacitación", Valor: batchInfo?.topic || records[0]?.trainingName || "Capacitación General" },
    { Métrica: "Trainer Responsable", Valor: batchInfo?.trainer || records[0]?.trainerName || "Varios" },
    { Métrica: "Fecha de Reporte", Valor: new Date().toLocaleDateString("es-ES") },
    { Métrica: "Total Agentes Evaluados", Valor: total },
    { Métrica: "Agentes Aprobados", Valor: approved },
    { Métrica: "Agentes No Aprobados", Valor: failed },
    { Métrica: "Agentes Pendientes / En Curso", Valor: pending },
    { Métrica: "Tasa de Aprobación", Valor: passRate },
    { Métrica: "Calificación Promedio", Valor: avgScore + " / 100" },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Ejecutivo");

  const fileName = `Control_Agentes_Trainer_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
