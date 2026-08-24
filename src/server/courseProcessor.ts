import * as XLSX from "xlsx";
import { AgentRecord, ApprovalStatus } from "../types";

export interface FilePayload {
  data: string; // base64
  mimeType: string;
  fileName: string;
}

export interface BackendProcessRequest {
  agentsFile?: FilePayload | null;
  testResultsFile?: FilePayload | null;
  courseFile?: FilePayload | null;
  agentsText?: string;
  testResultsText?: string;
  courseText?: string;
  passingScoreThreshold?: number;
  customPromptContext?: string;
  trainingTopic?: string;
  trainer?: string;
}

export interface BackendProcessResponse {
  success: boolean;
  batchId: string;
  trainingTopic: string;
  trainer: string;
  defaultPassingScore: number;
  totalAgentsInList: number;
  matchedInCourseCount: number;
  discardedFromCourseCount: number;
  approvedCount: number;
  failedCount: number;
  pendingCount: number;
  averageScore: number;
  records: AgentRecord[];
  aiSummary: string;
  aiRecommendations: string[];
  strengths: string[];
  improvementAreas: string[];
}

/**
 * Normalizes strings for robust matching (lowercase, removes accents and extra whitespaces)
 */
export function normalizeStr(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Parses numeric score from varied representations (e.g. 80, "80%", "8,5", 90, 100)
 */
export function parseScoreValue(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).replace(/,/g, ".").replace(/%/g, "").trim();
  const num = parseFloat(str);
  if (isNaN(num)) return null;

  // Scale normalization: 1-10 scale -> 10-100, 1-5 scale -> 20-100
  if (num <= 10 && num > 0) {
    return Math.round(num * 10);
  } else if (num <= 5 && num > 0) {
    return Math.round(num * 20);
  }
  return Math.round(num);
}

/**
 * Robust CSV line splitter that respects quoted strings with internal commas (e.g. U616446,"Aguirre, Maria José")
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (inQuotes && i + 1 < line.length && line[i + 1] === char) {
        cur += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";" || char === "\t") && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result.map((s) => s.replace(/^["']|["']$/g, "").trim());
}

/**
 * Helper to determine if the first row of a file/table is a header row or actual agent data
 */
function isAgentListHeaderRow(cell0: any, cell1?: any, cell2?: any): boolean {
  const n0 = normalizeStr(cell0);
  const n1 = normalizeStr(cell1);
  const n2 = normalizeStr(cell2);

  const c0IsHeaderWord =
    n0 === "legajo" ||
    n0 === "leg" ||
    n0 === "usuario" ||
    n0 === "user" ||
    n0 === "username" ||
    n0 === "id" ||
    n0 === "id_usuario" ||
    n0 === "id usuario" ||
    n0 === "dni" ||
    n0 === "codigo" ||
    n0 === "asesor" ||
    n0 === "colaborador" ||
    n0 === "agente";

  const c1IsHeaderWord =
    n1.includes("apellidonombre") ||
    n1.includes("apellido") ||
    n1.includes("nombre") ||
    n1.includes("supervisor") ||
    n1.includes("superv") ||
    n1.includes("team leader") ||
    n1.includes("tl") ||
    n1.includes("lider") ||
    n1.includes("coordinador") ||
    n1.includes("jefe");

  const c2IsHeaderWord =
    n2.includes("lider") ||
    n2.includes("supervisor") ||
    n2.includes("superv") ||
    n2.includes("team leader") ||
    n2.includes("tl") ||
    n2.includes("campana");

  return c0IsHeaderWord && (c1IsHeaderWord || c2IsHeaderWord || n0 === "legajo" || n0 === "id_usuario");
}

/**
 * Extracts list of agent IDs and metadata (including Supervisor and Full Name) from an Excel buffer or text
 */
export function extractAgentIdsFromPayload(
  file?: FilePayload | null,
  text?: string
): {
  agentMap: Map<string, { id: string; name: string; supervisor?: string; campaign?: string; trainer?: string; originalRow?: any }>;
  orderedKeys: string[];
  rawCount: number;
} {
  const agentMap = new Map<string, { id: string; name: string; supervisor?: string; campaign?: string; trainer?: string; originalRow?: any }>();
  const orderedKeys: string[] = [];

  // Case 1: Excel / CSV File payload (base64)
  if (file && file.data) {
    try {
      const buffer = Buffer.from(file.data, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];

      // Read as raw matrix of rows (array of arrays)
      const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

      if (matrix && matrix.length > 0) {
        const firstRow = matrix[0] || [];
        const hasHeader = isAgentListHeaderRow(firstRow[0], firstRow[1], firstRow[2]);
        const startRowIdx = hasHeader ? 1 : 0;

        // Also check if structured headers are present
        const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0] || {}) : [];

        // 1. Column A / Legajo: Agent ID
        const idCol = headers.find((h) => {
          const norm = normalizeStr(h);
          return (
            norm === "legajo" ||
            norm.includes("legajo") ||
            norm === "id" ||
            norm === "id_usuario" ||
            norm.includes("usuario") ||
            norm.includes("user") ||
            norm.includes("dni") ||
            norm.includes("codigo") ||
            norm.includes("rut") ||
            norm.includes("cedula")
          );
        }) || (headers.length > 0 ? headers[0] : undefined);

        // 2. Column B / ApellidoNombre: Full Name of Agent
        const nameCol = headers.find((h) => {
          const norm = normalizeStr(h);
          return (
            norm === "apellidonombre" ||
            norm.includes("apellidonombre") ||
            norm.includes("apellido y nombre") ||
            norm.includes("apellido nombre") ||
            norm.includes("apellido") ||
            ((norm.includes("nombre") || norm.includes("agente") || norm.includes("colaborador") || norm.includes("asesor")) &&
              !norm.includes("lider") &&
              !norm.includes("supervisor"))
          );
        }) || (headers.length > 1 ? headers[1] : undefined);

        // 3. Column C / Lider: Supervisor / Team Leader
        const supervisorCol = headers.find((h) => {
          const norm = normalizeStr(h);
          return (
            norm === "lider" ||
            norm.includes("lider") ||
            norm.includes("líder") ||
            norm.includes("supervisor") ||
            norm.includes("superv") ||
            norm.includes("team leader") ||
            norm.includes("tl") ||
            norm.includes("coordinador") ||
            norm.includes("jefe")
          );
        }) || (headers.length > 2 ? headers[2] : undefined);

        const campaignCol = headers.find((h) => {
          const norm = normalizeStr(h);
          return norm.includes("campana") || norm.includes("area") || norm.includes("servicio") || norm.includes("cuenta");
        });

        const trainerCol = headers.find((h) => {
          const norm = normalizeStr(h);
          return norm.includes("trainer") || norm.includes("capacitador") || norm.includes("instructor") || norm.includes("formador");
        });

        for (let i = startRowIdx; i < matrix.length; i++) {
          const row = matrix[i];
          if (!row || row.length === 0) continue;

          // Check if row is a repeated header
          if (isAgentListHeaderRow(row[0], row[1], row[2])) continue;

          let rawId = "";
          let rawName = "";
          let rawSupervisor = "";
          let campaign = "Operaciones";
          let trainer: string | undefined = undefined;

          // If JSON rows with headers are mapped
          if (hasHeader && jsonRows[i - 1]) {
            const jRow = jsonRows[i - 1];
            if (idCol && jRow[idCol] !== undefined) rawId = String(jRow[idCol]).trim();
            if (nameCol && jRow[nameCol] !== undefined) rawName = String(jRow[nameCol]).trim();
            if (supervisorCol && jRow[supervisorCol] !== undefined) rawSupervisor = String(jRow[supervisorCol]).trim();
            if (campaignCol && jRow[campaignCol]) campaign = String(jRow[campaignCol]).trim();
            if (trainerCol && jRow[trainerCol]) trainer = String(jRow[trainerCol]).trim();
          }

          // Fallbacks based on matrix columns:
          // Col 0: Legajo, Col 1: ApellidoNombre, Col 2: Lider
          if (!rawId) {
            rawId = String(row[0] || "").replace(/^["']|["']$/g, "").trim();
          }
          if (!rawId) continue;

          if (!rawName) {
            if (row.length >= 3 && row[1]) {
              // 3+ columns: col 0 = Legajo, col 1 = ApellidoNombre, col 2 = Lider
              rawName = String(row[1]).replace(/^["']|["']$/g, "").trim();
            } else if (row.length === 2 && row[1]) {
              // 2 columns: if row[1] is name or supervisor
              rawName = String(row[1]).replace(/^["']|["']$/g, "").trim();
            } else {
              rawName = rawId;
            }
          }

          if (!rawSupervisor) {
            if (row.length >= 3 && row[2]) {
              rawSupervisor = String(row[2]).replace(/^["']|["']$/g, "").trim();
            } else if (row.length === 2 && row[1]) {
              // 2-column format fallback
              rawSupervisor = String(row[1]).replace(/^["']|["']$/g, "").trim();
            }
          }

          if (row.length >= 4 && row[3]) {
            campaign = String(row[3]).trim();
          }

          // CRITICAL: Normalize the Legajo / ID key to lowercase for exact case-insensitive matching
          const normKey = normalizeStr(rawId).toLowerCase();
          if (normKey && !agentMap.has(normKey)) {
            agentMap.set(normKey, {
              id: rawId,
              name: rawName || rawId,
              supervisor: rawSupervisor || undefined,
              campaign,
              trainer,
              originalRow: row,
            });
            orderedKeys.push(normKey);
          }
        }

        if (orderedKeys.length > 0) {
          return { agentMap, orderedKeys, rawCount: orderedKeys.length };
        }
      }
    } catch (e) {
      console.warn("Could not parse agent IDs from Excel file buffer, attempting text fallback", e);
    }
  }

  // Case 2: Plain text or raw CSV string list of IDs / names / supervisors
  const rawText =
    text ||
    (file?.data && file.mimeType.includes("text")
      ? Buffer.from(file.data, "base64").toString("utf-8")
      : "");

  if (rawText) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, idx) => {
      // Robust CSV parsing respecting quotes
      const parts = parseCsvLine(line);
      if (!parts || parts.length === 0) return;

      // Skip header row
      if (isAgentListHeaderRow(parts[0], parts[1], parts[2])) {
        return;
      }

      const rawId = parts[0];
      if (!rawId) return;

      let rawName = rawId;
      let rawSupervisor = "";
      let campaign = "Operaciones";

      if (parts.length >= 3) {
        // Col A: Legajo, Col B: ApellidoNombre, Col C: Lider
        rawName = parts[1] || rawId;
        rawSupervisor = parts[2] || "";
        if (parts.length >= 4) campaign = parts[3] || "Operaciones";
      } else if (parts.length === 2) {
        // 2 columns
        rawSupervisor = parts[1] || "";
        rawName = rawId;
      }

      // CRITICAL: Normalize the Legajo / ID key to lowercase
      const normKey = normalizeStr(rawId).toLowerCase();
      if (normKey && !agentMap.has(normKey)) {
        agentMap.set(normKey, {
          id: rawId,
          name: rawName || rawId,
          supervisor: rawSupervisor || undefined,
          campaign,
        });
        orderedKeys.push(normKey);
      }
    });
  }

  return { agentMap, orderedKeys, rawCount: orderedKeys.length };
}

/**
 * Backend Course Processor & Filtering Function:
 * Compares the 'Usuario' column of the course spreadsheet with the list of agent IDs.
 * Automatically discards any record whose 'Usuario' does NOT appear in the agent ID list.
 */
export function processCourseAndAgentIdsBackend(
  params: BackendProcessRequest
): BackendProcessResponse {
  const {
    agentsFile,
    testResultsFile,
    courseFile,
    agentsText,
    testResultsText,
    courseText,
    passingScoreThreshold = 80,
  } = params;

  const batchId = "batch_" + Date.now();

  // 1. Extract the universe of Target Agent IDs
  const targetAgentsData = extractAgentIdsFromPayload(agentsFile, agentsText);
  const { agentMap, orderedKeys } = targetAgentsData;

  // 2. Parse the Course / Test Spreadsheet
  const coursePayload = courseFile || testResultsFile;
  const courseRawText = courseText || testResultsText;

  let courseRows: Record<string, any>[] = [];
  let courseHeaders: string[] = [];
  let detectedTopic = params.trainingTopic || "Capacitación Operativa";
  let detectedTrainer = params.trainer || "Instructor Asignado";

  if (coursePayload && coursePayload.data) {
    try {
      const buffer = Buffer.from(coursePayload.data, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      courseRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (courseRows.length > 0) {
        courseHeaders = Object.keys(courseRows[0] || {});
      }
    } catch (err) {
      console.warn("Could not read course spreadsheet buffer directly:", err);
    }
  }

  // Fallback to text parsing if courseRows is empty
  if (courseRows.length === 0 && courseRawText) {
    const lines = courseRawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
      courseHeaders = lines[0].split(delimiter).map((h) => h.trim());
      courseRows = lines.slice(1).map((line) => {
        const parts = line.split(delimiter).map((p) => p.trim());
        const rowObj: Record<string, any> = {};
        courseHeaders.forEach((h, idx) => {
          rowObj[h] = parts[idx] || "";
        });
        return rowObj;
      });
    }
  }

  // 3. Find the 'Usuario' column in the Course Spreadsheet
  let usuarioKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return (
      norm === "usuario" ||
      norm === "user" ||
      norm === "username" ||
      norm.includes("usuario") ||
      norm.includes("user")
    );
  });

  if (!usuarioKey) {
    usuarioKey = courseHeaders.find((h) => {
      const norm = normalizeStr(h);
      return (
        norm.includes("dni") ||
        norm.includes("legajo") ||
        norm.includes("id") ||
        norm.includes("codigo") ||
        norm.includes("agente") ||
        norm.includes("colaborador") ||
        norm.includes("email")
      );
    }) || courseHeaders[0];
  }

  // 4. Identify Columns R to U (index 17, 18, 19, 20), and Columns V & W (index 21, 22 - Recuperatorios)
  const colR = courseHeaders[17]; // Column R (18th column)
  const colS = courseHeaders[18]; // Column S (19th column)
  const colT = courseHeaders[19]; // Column T (20th column)
  const colU = courseHeaders[20]; // Column U (21st column)
  const colV = courseHeaders[21]; // Column V (22nd column - Recuperatorio 1)
  const colW = courseHeaders[22]; // Column W (23rd column - Recuperatorio 2)

  const scoreKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return (
      norm.includes("score") ||
      norm.includes("calificacion") ||
      norm.includes("nota") ||
      norm.includes("puntaje") ||
      norm.includes("evaluacion") ||
      norm.includes("puntos") ||
      norm.includes("porcentaje")
    );
  }) || colR || colS;

  const retakeCol1 = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return (
      norm.includes("recuperatorio 1") ||
      norm.includes("recup 1") ||
      norm.includes("recuperatorio") ||
      norm.includes("recuperacion") ||
      norm.includes("columna v") ||
      norm.includes("col v") ||
      norm === "v"
    );
  }) || colV;

  const retakeCol2 = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return (
      norm.includes("recuperatorio 2") ||
      norm.includes("recup 2") ||
      norm.includes("recuperacion 2") ||
      norm.includes("columna w") ||
      norm.includes("col w") ||
      norm === "w"
    );
  }) || colW;

  const statusKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return (
      norm.includes("estado") ||
      norm.includes("status") ||
      norm.includes("aprob") ||
      norm.includes("condicion") ||
      norm.includes("resultado")
    );
  }) || colS || colR;

  const feedbackKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return (
      norm.includes("observacion") ||
      norm.includes("feedback") ||
      norm.includes("comentario") ||
      norm.includes("detalle") ||
      norm.includes("respuestas") ||
      norm.includes("nota trainer")
    );
  }) || colT || colU;

  const dateKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return norm.includes("fecha") || norm.includes("date") || norm.includes("dia") || norm.includes("finalizacion");
  }) || colU;

  const topicKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return norm.includes("curso") || norm.includes("capacitacion") || norm.includes("modulo") || norm.includes("tema");
  });

  const trainerKey = courseHeaders.find((h) => {
    const norm = normalizeStr(h);
    return norm.includes("trainer") || norm.includes("capacitador") || norm.includes("instructor") || norm.includes("formador");
  });

  // 5. COMPARE 'Usuario' AND FILTER:
  // Discard any row whose 'Usuario' does NOT exist in the list of agent IDs.
  const matchedDataMap = new Map<string, {
    score: number | null;
    status: ApprovalStatus;
    passedInRetake?: boolean;
    initialScore?: number | null;
    retakeScore?: number | null;
    retakeDetails?: string;
    feedback?: string;
    completionDate?: string;
    topic?: string;
    trainer?: string;
    attendance?: number;
  }>();

  let discardedFromCourseCount = 0;
  let matchedInCourseCount = 0;

  for (const row of courseRows) {
    const rawUser = usuarioKey && row[usuarioKey] !== undefined ? String(row[usuarioKey]).trim() : "";
    const normUser = normalizeStr(rawUser).toLowerCase();

    if (!normUser) {
      continue;
    }

    // Direct check: does this user exist in the selected agent IDs list (case-insensitive)?
    let targetKey: string | undefined = undefined;
    if (agentMap.has(normUser)) {
      targetKey = normUser;
    } else {
      // Check with / without 'u' prefix variants
      const userWithoutU = normUser.replace(/^u/, "");
      const userWithU = "u" + userWithoutU;
      if (agentMap.has(userWithU)) {
        targetKey = userWithU;
      } else if (agentMap.has(userWithoutU)) {
        targetKey = userWithoutU;
      } else {
        // Fuzzy check across orderedKeys
        for (const key of orderedKeys) {
          const agentObj = agentMap.get(key);
          if (!agentObj) continue;
          const normAgentName = normalizeStr(agentObj.name).toLowerCase();
          const normAgentId = normalizeStr(agentObj.id).toLowerCase();

          if (
            normUser === normAgentId ||
            normUser === normAgentName ||
            (normUser.length > 4 && normAgentId.includes(normUser)) ||
            (normUser.length > 4 && normAgentName.includes(normUser))
          ) {
            targetKey = key;
            break;
          }
        }
      }
    }

    // DISCARD AUTOMATICALLY if not in the target agent ID list!
    if (!targetKey) {
      discardedFromCourseCount++;
      continue;
    }

    // Row belongs to a target agent! Extract results from columns R-U or identified keys
    matchedInCourseCount++;

    // Extract score from R-U or scoreKey
    let rawScore = scoreKey ? row[scoreKey] : null;
    let score = parseScoreValue(rawScore);

    // If score not in scoreKey, check colR, colS, colT, colU
    if (score === null && colR && row[colR] !== undefined) {
      score = parseScoreValue(row[colR]);
    }
    if (score === null && colS && row[colS] !== undefined) {
      score = parseScoreValue(row[colS]);
    }

    const initialScore = score;
    let passedInRetake = false;
    let retakeScore: number | null = null;
    let retakeDetails: string | undefined = undefined;

    // RECUPERATORIOS (Columnas V y W):
    // Si la nota principal es menor a 80 (o null), se revisan las columnas V y W.
    // Si alcanzó o superó los 80 puntos en cualquiera de ellas, su estado pasa a 'Aprobado'.
    const rawScoreV = retakeCol1 && row[retakeCol1] !== undefined ? row[retakeCol1] : (colV && row[colV] !== undefined ? row[colV] : null);
    const rawScoreW = retakeCol2 && row[retakeCol2] !== undefined ? row[retakeCol2] : (colW && row[colW] !== undefined ? row[colW] : null);

    const scoreV = parseScoreValue(rawScoreV);
    const scoreW = parseScoreValue(rawScoreW);

    const passedInV = scoreV !== null && scoreV >= passingScoreThreshold;
    const passedInW = scoreW !== null && scoreW >= passingScoreThreshold;

    if (score === null || score < passingScoreThreshold) {
      if (passedInV || passedInW) {
        passedInRetake = true;
        retakeScore = Math.max(passedInV ? scoreV! : 0, passedInW ? scoreW! : 0);
        score = retakeScore;

        if (passedInV && passedInW) {
          retakeDetails = `Aprobado en Recuperatorio (Col. V: ${scoreV} pts, Col. W: ${scoreW} pts)`;
        } else if (passedInV) {
          retakeDetails = `Aprobado en Recuperatorio (Columna V: ${scoreV} pts)`;
        } else {
          retakeDetails = `Aprobado en Recuperatorio (Columna W: ${scoreW} pts)`;
        }
      }
    }

    // Status: 80, 90, 100 -> 'Aprobado'
    let status: ApprovalStatus = "Pendiente";
    if (score !== null) {
      status = score >= passingScoreThreshold ? "Aprobado" : "No Aprobado";
    } else if (statusKey && row[statusKey]) {
      const normStatus = normalizeStr(row[statusKey]);
      if (normStatus.includes("aprob") || normStatus.includes("pass") || normStatus.includes("ok") || normStatus.includes("si")) {
        status = "Aprobado";
      } else if (normStatus.includes("no") || normStatus.includes("reprob") || normStatus.includes("fail") || normStatus.includes("desaprob")) {
        status = "No Aprobado";
      }
    }

    // Feedback
    let feedback = feedbackKey && row[feedbackKey] ? String(row[feedbackKey]).trim() : "";
    if (!feedback) {
      if (passedInRetake) {
        feedback = `Aprobó en instancia de recuperatorio (${retakeDetails}) con ${retakeScore} pts (Nota inicial previa: ${initialScore !== null ? `${initialScore} pts` : "N/E"}).`;
      } else if (status === "Aprobado") {
        feedback = `Aprobó la evaluación del curso con puntaje ${score !== null ? `${score}/100` : "satisfactorio"}.`;
      } else if (score !== null) {
        feedback = `Calificación obtenida: ${score}/100. Requiere refuerzo en temas críticos del curso.`;
      } else {
        feedback = "Registro evaluado en la planilla del curso.";
      }
    }

    // Date
    const completionDate = dateKey && row[dateKey] ? String(row[dateKey]).trim() : new Date().toISOString().split("T")[0];

    // Topic & Trainer detection
    if (topicKey && row[topicKey]) {
      detectedTopic = String(row[topicKey]).trim();
    }
    if (trainerKey && row[trainerKey]) {
      detectedTrainer = String(row[trainerKey]).trim();
    }

    matchedDataMap.set(targetKey, {
      score,
      status,
      passedInRetake,
      initialScore,
      retakeScore,
      retakeDetails,
      feedback,
      completionDate,
      topic: detectedTopic,
      trainer: detectedTrainer,
    });
  }

  // 6. BUILD FINAL RECORDS FOR THE ENTIRE AGENT LIST (Totalidad de la lista)
  const finalRecords: AgentRecord[] = orderedKeys.map((key, idx) => {
    const agent = agentMap.get(key)!;
    const match = matchedDataMap.get(key);

    const score = match ? match.score : null;
    const status: ApprovalStatus = match ? match.status : "Pendiente";
    const passedInRetake = match ? !!match.passedInRetake : false;
    const initialScore = match ? match.initialScore : undefined;
    const retakeScore = match ? match.retakeScore : undefined;
    const retakeDetails = match ? match.retakeDetails : undefined;

    const feedback = match
      ? match.feedback || "Cruce de datos completado exitosamente."
      : "Agente de la lista de IDs que no registra presentación en la planilla del curso.";

    const completionDate = match?.completionDate || new Date().toISOString().split("T")[0];
    const trainingName = match?.topic || detectedTopic;
    const trainerName = agent.trainer || match?.trainer || detectedTrainer;

    return {
      id: `agent_${batchId}_${idx + 1}`,
      agentName: agent.name || `Asesor ${idx + 1}`,
      agentId: agent.id,
      supervisor: agent.supervisor || undefined,
      campaign: agent.campaign || "Operaciones",
      trainingName,
      trainerName,
      completionDate,
      score,
      minPassingScore: passingScoreThreshold,
      status,
      attendancePercentage: 100,
      feedback,
      skillsAcquired: status === "Aprobado"
        ? (passedInRetake ? ["Procesos Operativos", "Herramientas de Campaña", "Recuperatorio Aprobado"] : ["Procesos Operativos", "Herramientas de Campaña", "Resolución"])
        : ["En Nivelación"],
      needsRetraining: status !== "Aprobado",
      passedInRetake,
      initialScore,
      retakeScore,
      retakeDetails,
      batchId,
      sourceFileName: [agentsFile?.fileName, coursePayload?.fileName].filter(Boolean).join(" + ") || "Planilla de Curso y Lista de IDs",
    };
  });

  // Calculate statistics
  const totalAgentsInList = finalRecords.length;
  const approvedCount = finalRecords.filter((r) => r.status === "Aprobado").length;
  const failedCount = finalRecords.filter((r) => r.status === "No Aprobado").length;
  const pendingCount = finalRecords.filter((r) => r.status === "Pendiente").length;
  const validScores = finalRecords.map((r) => r.score).filter((s): s is number => typeof s === "number");
  const averageScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;

  // Build AI / Executive Summary
  let aiSummary = `Se cruzaron los datos comparando la columna 'Usuario' de la planilla del curso con el listado oficial de ${totalAgentsInList} IDs de agentes.`;
  if (discardedFromCourseCount > 0) {
    aiSummary += ` Se descartaron automáticamente ${discardedFromCourseCount} registros ajenos que no figuraban en la lista de agentes seleccionados.`;
  }
  aiSummary += ` Resultados del grupo evaluado: ${approvedCount} aprobados (con 80, 90 o 100 puntos), ${failedCount} no aprobados (< 80) y ${pendingCount} pendientes. Calificación promedio: ${averageScore}/100.`;

  const aiRecommendations: string[] = [
    `Programar sesión de refuerzo y re-evaluación para los ${failedCount} agentes con puntaje menor a ${passingScoreThreshold} puntos.`,
    `Verificar la situación de los ${pendingCount} agentes de la nómina que figuran como pendientes por no haber rendido en la planilla del curso.`,
    `Reforzar las preguntas y conceptos correspondientes a las columnas R-U que presentaron mayor dispersión de notas.`,
  ];

  const strengths: string[] = [
    `${approvedCount} agentes alcanzaron el umbral de excelencia (80 a 100 puntos).`,
    "Correcta trazabilidad de usuarios y validación de nómina depurada.",
  ];

  const improvementAreas: string[] = [
    `${failedCount} agentes requieren nivelación en los procedimientos clave del curso.`,
    `${pendingCount} agentes pendientes de evaluación en la planilla.`,
  ];

  return {
    success: true,
    batchId,
    trainingTopic: detectedTopic,
    trainer: detectedTrainer,
    defaultPassingScore: passingScoreThreshold,
    totalAgentsInList,
    matchedInCourseCount,
    discardedFromCourseCount,
    approvedCount,
    failedCount,
    pendingCount,
    averageScore,
    records: finalRecords,
    aiSummary,
    aiRecommendations,
    strengths,
    improvementAreas,
  };
}
