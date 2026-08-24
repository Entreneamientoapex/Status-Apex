import { AgentRecord, ApprovalStatus, ConfigUser } from "../types";
import { GOOGLE_SHEET_URL, APPS_SCRIPT_URL, DEFAULT_PASSING_SCORE, KNOWN_SHEET_TABS } from "./googleSheetsConfig";
import { INITIAL_DEMO_RECORDS } from "./demoData";

export interface SheetTabInfo {
  name: string;
  gid: string | null;
}

export interface MasterAgent {
  legajo: string;
  name: string;
  supervisor: string;
  campaign?: string;
  cleanLegajo: string;
  cleanName: string;
}

export interface SheetAnalysisRecord {
  id: string;
  name: string; // Nombre del test / pestaña
  sheetName: string;
  tabGid?: string | null;
  createdAt: string;
  createdAtFormatted: string;
  totalAgents: number; // Total FIJO de la base de datos maestra (261 asesores)
  approvedCount: number;
  failedCount: number;
  pendingCount: number;
  passRate: number;
  averageScore: number;
  trainingTopic: string;
  trainer: string;
  records: AgentRecord[];
  isLiveFromGoogle?: boolean;
  hasScoreColumn?: boolean;
  discardedExternalCount?: number; // Cantidad de usuarios en la hoja de test descartados por no estar en Lista_agentes
  projectCode?: string;
  testStatus?: "Activo" | "No Activo";
}

export interface SheetConnectionStatus {
  success: boolean;
  spreadsheetId: string | null;
  needsPermission: boolean;
  message: string;
  tabCount: number;
}

/**
 * Normaliza cadenas removiendo acentos, símbolos, espacios y mayúsculas para un cruce seguro y exacto
 */
export function cleanHeaderString(str: string | undefined | null): string {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remueve tildes y diacríticos
    .replace(/[^a-z0-9]/g, ""); // remueve símbolos y espacios
}

/**
 * Extrae el ID de la hoja de cálculo de Google desde cualquier URL o ID directo
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== "string") return null;
  const trimmed = urlOrId.trim();

  if (/^[a-zA-Z0-9_-]{20,70}$/.test(trimmed) && !trimmed.includes("/")) {
    return trimmed;
  }

  const match =
    trimmed.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/i);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Extrae el parámetro GID de la URL si estuviese presente (opcional)
 */
export function extractGid(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&#]gid=([0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Parsea el valor numérico de la celda. Retorna null si está vacía, contiene "-", "Sin Nota", "N/A", etc.
 */
export function parseNumericScore(valStr: string | undefined | null): number | null {
  if (!valStr || typeof valStr !== "string") return null;
  const trimmed = valStr.trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "--" ||
    trimmed === "/" ||
    trimmed.toLowerCase() === "sin nota" ||
    trimmed.toLowerCase() === "s/n" ||
    trimmed.toLowerCase() === "n/a" ||
    trimmed.toLowerCase() === "na" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return null;
  }

  const cleanNum = trimmed.replace("%", "").replace(",", ".").trim();
  const num = parseFloat(cleanNum);
  if (isNaN(num)) return null;

  // Si la nota está en escala 0-10 (ej. 8.5 u 8), se convierte a escala 0-100 (85 u 80)
  if (num > 0 && num <= 10) {
    return Math.round(num * 10);
  }
  return Math.round(num);
}

/**
 * Extrae la fecha desde el nombre de la pestaña o genera la fecha actual
 */
function extractDateFromTabName(tabName: string): { iso: string; formatted: string } {
  const dateRegex = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/;
  const match = tabName.match(dateRegex);

  if (match) {
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    const pad = (n: number) => (n < 10 ? "0" + n : n.toString());
    const iso = `${year}-${pad(month)}-${pad(day)}T10:00:00.000Z`;
    const formatted = `${pad(day)}/${pad(month)}/${year} 10:00`;
    return { iso, formatted };
  }

  const now = new Date();
  const pad = (n: number) => (n < 10 ? "0" + n : n.toString());
  const iso = now.toISOString();
  const formatted = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { iso, formatted };
}

/**
 * Parser robusto de CSV/TSV respetando comillas, comas, puntos y comas y tabulaciones
 */
export function parseCsvRows(csvText: string): string[][] {
  if (!csvText || typeof csvText !== "string") return [];

  if (
    csvText.includes("<!DOCTYPE html>") ||
    csvText.includes("Sign in to your Google Account") ||
    csvText.includes("accounts.google.com") ||
    csvText.includes("document-root")
  ) {
    throw new Error("PERMISSION_DENIED: La planilla de Google Sheets está en modo restringido.");
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  const firstLine = csvText.split("\n")[0] || "";
  let delimiter = ",";
  if (firstLine.split("\t").length > firstLine.split(",").length) {
    delimiter = "\t";
  } else if (firstLine.split(";").length > firstLine.split(",").length) {
    delimiter = ";";
  }

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Prueba de conexión y permisos con la planilla pública de Google Sheets
 */
export async function testSpreadsheetConnection(
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<SheetConnectionStatus> {
  const sheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!sheetId) {
    return {
      success: false,
      spreadsheetId: null,
      needsPermission: false,
      message: "El enlace proporcionado no contiene un ID válido de Google Sheets.",
      tabCount: 0,
    };
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
    const res = await fetch(csvUrl);

    if (res.ok) {
      const text = await res.text();
      if (
        text.includes("<!DOCTYPE html>") ||
        text.includes("Sign in to your Google Account") ||
        text.includes("accounts.google.com")
      ) {
        return {
          success: false,
          spreadsheetId: sheetId,
          needsPermission: true,
          message: "La planilla está restringida. Cambia el permiso a 'Cualquier persona con el enlace' en Google Sheets.",
          tabCount: 0,
        };
      }
      return {
        success: true,
        spreadsheetId: sheetId,
        needsPermission: false,
        message: "Conexión exitosa con Google Sheets.",
        tabCount: 1,
      };
    } else if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        spreadsheetId: sheetId,
        needsPermission: true,
        message: "Permiso denegado por Google. Cambia el acceso general a 'Lector para cualquier persona con el enlace'.",
        tabCount: 0,
      };
    }
  } catch (err: any) {
    console.warn("Connection test error:", err);
  }

  return {
    success: false,
    spreadsheetId: sheetId,
    needsPermission: true,
    message: "No se pudo acceder a la planilla pública.",
    tabCount: 0,
  };
}

/**
 * 1. BASE DE DATOS MAESTRA FIJA:
 *    Extrae siempre la nómina oficial y única desde la pestaña 'Lista_agentes' (261 asesores).
 */
export async function fetchMasterAgentList(
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<MasterAgent[]> {
  const sheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!sheetId) {
    return INITIAL_DEMO_RECORDS.map((r) => ({
      legajo: r.agentId || `U${r.id}`,
      name: r.agentName,
      supervisor: r.supervisor || "Supervisor Responsable",
      campaign: r.campaign || "Operaciones",
      cleanLegajo: cleanHeaderString(r.agentId || `U${r.id}`),
      cleanName: cleanHeaderString(r.agentName),
    }));
  }

  const endpoints = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Lista_agentes")}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent("Lista_agentes")}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`,
  ];

  let rawRows: string[][] = [];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (
          !text.includes("<!DOCTYPE html>") &&
          !text.includes("Sign in to your Google Account") &&
          !text.includes("accounts.google.com")
        ) {
          const parsed = parseCsvRows(text);
          if (parsed.length > 1) {
            rawRows = parsed;
            break;
          }
        }
      }
    } catch (e) {
      // try next
    }
  }

  if (rawRows.length <= 1) {
    console.warn("No se pudo leer Lista_agentes directamente. Usando fallback.");
    return INITIAL_DEMO_RECORDS.map((r) => ({
      legajo: r.agentId || `U${r.id}`,
      name: r.agentName,
      supervisor: r.supervisor || "Supervisor Responsable",
      campaign: r.campaign || "Operaciones",
      cleanLegajo: cleanHeaderString(r.agentId || `U${r.id}`),
      cleanName: cleanHeaderString(r.agentName),
    }));
  }

  // Identificar encabezados en Lista_agentes
  const headerRow = rawRows[0].map((c) => cleanHeaderString(c));
  const dataRows = rawRows.slice(1);

  const colLegajo = headerRow.findIndex((h) =>
    ["legajo", "usuario", "user", "id", "dni", "matricula", "codigo", "login"].some((k) => h === k || h.includes(k))
  );

  const colNombre = headerRow.findIndex((h) =>
    ["apellidonombre", "nombreapellido", "nombre", "apellido", "agente", "asesor", "colaborador", "name"].some((k) => h === k || h.includes(k))
  );

  const colSupervisor = headerRow.findIndex((h) =>
    ["lider", "líder", "supervisor", "supervisora", "sup", "teamleader", "tl", "coordinador", "jefe"].some((k) => h === k || h.includes(k))
  );

  let colCampaign = headerRow.findIndex((h) =>
    ["campana", "campaña", "proyecto", "proyectos", "cuenta", "servicio", "segmento", "area", "operacion", "departamento", "skill", "cd"].some((k) => h === k || h.includes(k))
  );

  // Si colCampaign no se encontró por nombre pero la primera columna no es legajo/nombre/supervisor, usar columna 0
  if (colCampaign === -1 && colLegajo !== 0 && colNombre !== 0 && colSupervisor !== 0 && headerRow.length > 0) {
    colCampaign = 0;
  }

  const masterAgents: MasterAgent[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const rawLegajo = colLegajo !== -1 ? row[colLegajo]?.trim() : "";
    const rawNombre = colNombre !== -1 ? row[colNombre]?.trim() : "";
    const rawSupervisor = colSupervisor !== -1 ? row[colSupervisor]?.trim() : "";
    const rawCampaign = colCampaign !== -1 ? row[colCampaign]?.trim() : "";

    const legajo = rawLegajo || `U${100000 + i}`;
    const name = rawNombre || `Asesor ${i + 1}`;
    const supervisor = rawSupervisor && rawSupervisor !== "-" ? rawSupervisor : "Sin Supervisor Asignado";
    const campaign = rawCampaign && rawCampaign !== "-" ? rawCampaign : "Operaciones";

    masterAgents.push({
      legajo,
      name,
      supervisor,
      campaign,
      cleanLegajo: cleanHeaderString(legajo),
      cleanName: cleanHeaderString(name),
    });
  }

  return masterAgents;
}

/**
 * Extrae el código del proyecto a partir del título de la pestaña del test.
 * Ejemplos:
 *  - "CD5562 CATEC..." -> "CD5562"
 *  - "CD2633 Genesys Cloud" -> "CD2633"
 *  - "CD3663 Atención Digital" -> "CD3663"
 */
export function extractProjectCode(tabName: string): string {
  if (!tabName) return "";
  const clean = tabName.trim();
  // Busca códigos tipo CD5562, CD-5562, CATEC5562, 5562, etc.
  const match = clean.match(/\b([a-zA-Z]{1,5}[-_]?\d{3,7}|\d{4,7})\b/i);
  if (match && match[1]) {
    return match[1].replace(/[-_]/g, "").toUpperCase();
  }
  // Si no hay match con números, tomar la primera palabra
  const firstWord = clean.split(/[\s\-_:/]+/)[0]?.trim();
  if (firstWord && firstWord.length >= 2) {
    return firstWord.toUpperCase();
  }
  return clean.toUpperCase();
}

/**
 * Divide la celda "Campaña" en sus códigos individuales separados por comas,
 * aplicando .trim() y limpiando espacios invisibles para evitar errores de tipeo.
 * Ejemplo: "CD2633,  CD5562, CD3663" -> ["CD2633", "CD5562", "CD3663"]
 */
export function parseCampaignTokens(campaignStr: string): string[] {
  if (!campaignStr) return [];
  return campaignStr
    .split(/[,;|\/\n\r]+/)
    .map((c) => sanitizeAuthCell(c).trim())
    .filter((c) => c.length > 0 && c !== "-");
}

/**
 * Verifica de forma flexible si un agente pertenece al proyecto del test seleccionado.
 * Utiliza .includes() y análisis de tokens para permitir que un agente participe en múltiples proyectos.
 * Ejemplo: Si la celda dice "CD2633, CD5562, CD3663" y se selecciona "CD5562", da positivo.
 */
export function isAgentInProject(
  agentCampaign: string,
  projectCode: string,
  tabName?: string
): boolean {
  if (!projectCode) return true;

  const cleanProject = projectCode.trim().toUpperCase();
  const cleanProjectDigits = cleanProject.replace(/\D/g, "");

  // 1. Verificación directa con .includes() sobre toda la cadena de la celda
  const rawCampaignUpper = (agentCampaign || "").toUpperCase();
  if (rawCampaignUpper.includes(cleanProject)) {
    return true;
  }

  // 2. Tokenización y limpieza por comas con .trim()
  const tokens = parseCampaignTokens(agentCampaign);
  if (tokens.length === 0) return false;

  for (const token of tokens) {
    const tokenUpper = token.toUpperCase().replace(/\s+/g, "");
    const tokenClean = tokenUpper.replace(/[-_]/g, "");

    // A. Coincidencia exacta o inclusión
    if (tokenClean === cleanProject || tokenUpper === cleanProject) {
      return true;
    }
    if (tokenClean.includes(cleanProject) || cleanProject.includes(tokenClean)) {
      return true;
    }

    // B. Coincidencia por dígitos numéricos (ej. "5562" en "CD5562")
    const tokenDigits = tokenClean.replace(/\D/g, "");
    if (
      tokenDigits.length >= 3 &&
      cleanProjectDigits.length >= 3 &&
      (tokenDigits === cleanProjectDigits ||
        tokenDigits.includes(cleanProjectDigits) ||
        cleanProjectDigits.includes(tokenDigits))
    ) {
      return true;
    }

    // C. Coincidencia contra el nombre de la pestaña completa si está disponible
    if (tabName) {
      const tabClean = tabName.toUpperCase().replace(/[-_\s]/g, "");
      if (tabClean.includes(tokenClean) && tokenClean.length >= 3) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 2. DETECCIÓN AUTOMÁTICA DE PESTAÑAS DE TESTS:
 *    Lee todas las hojas del libro y excluye estrictamente 'Lista_agentes' del historial.
 */
export async function fetchSpreadsheetTestTabs(
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<SheetTabInfo[]> {
  const sheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!sheetId) {
    return KNOWN_SHEET_TABS.map((name) => ({ name, gid: null }));
  }

  const allTabs: SheetTabInfo[] = [];

  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
    const res = await fetch(htmlUrl);

    if (res.ok) {
      const html = await res.text();

      if (!html.includes("Sign in to your Google Account") && !html.includes("document-root")) {
        const itemRegex = /items\.push\(\{\s*name:\s*"([^"]+)",[^}]*gid:\s*"([^"]+)"/g;
        let match;
        while ((match = itemRegex.exec(html)) !== null) {
          const tabName = match[1]?.trim();
          const tabGid = match[2]?.trim();
          if (tabName && !allTabs.some((t) => t.name === tabName)) {
            allTabs.push({ name: tabName, gid: tabGid });
          }
        }

        // Fallback si no vinieron en items.push
        if (allTabs.length === 0) {
          const tabRegex = /<li[^>]*id="sheet-button-([0-9]+)"[^>]*><a[^>]*>([^<]+)<\/a>/gi;
          while ((match = tabRegex.exec(html)) !== null) {
            const tabGid = match[1]?.trim();
            const tabName = match[2]?.trim();
            if (tabName && !allTabs.some((t) => t.name === tabName)) {
              allTabs.push({ name: tabName, gid: tabGid });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not parse Google Sheet HTML tabs:", err);
  }

  if (allTabs.length === 0) {
    for (const knownTab of KNOWN_SHEET_TABS) {
      allTabs.push({ name: knownTab, gid: null });
    }
  }

  // REGLA OBLIGATORIA: Ocultar 'Lista_agentes' y 'Config_Usuarios' del historial visual de tests
  const testTabsOnly = allTabs.filter((t) => {
    const norm = cleanHeaderString(t.name);
    return (
      norm !== "listaagentes" &&
      norm !== "listaagente" &&
      norm !== "listadeagentes" &&
      norm !== "agentes" &&
      norm !== "nomina" &&
      norm !== "basededatos" &&
      norm !== "configusuarios" &&
      norm !== "configusuario" &&
      norm !== "usuarios" &&
      norm !== "usuario" &&
      norm !== "config" &&
      norm !== "credenciales" &&
      norm !== "passwords"
    );
  });

  return testTabsOnly;
}

/**
 * Descarga las filas crudas CSV para una pestaña de test
 */
async function fetchRawTabCsv(tab: SheetTabInfo, sheetId: string): Promise<string[][]> {
  const endpoints: string[] = [];

  if (tab.gid) {
    endpoints.push(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${tab.gid}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${tab.gid}`
    );
  }

  endpoints.push(
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab.name)}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(tab.name)}`
  );

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (
          !text.includes("<!DOCTYPE html>") &&
          !text.includes("Sign in to your Google Account") &&
          !text.includes("accounts.google.com")
        ) {
          const parsed = parseCsvRows(text);
          if (parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      // try next
    }
  }

  return [];
}

/**
 * 3. CRUCE DE DATOS CON FILTRADO ESTRICTO DE SEGURIDAD (COLADOR DE AGENTES):
 *    - La lista 'masterAgents' (de 'Lista_agentes') es el ÚNICO universo válido.
 *    - Cualquier fila o usuario presente en la pestaña de test que NO pertenezca a 'masterAgents'
 *      es DESCARTADO POR COMPLETO de forma inmediata.
 *    - No se suma al total, no entra al promedio ni aparece en los desgloses de Supervisores.
 */
export async function fetchAndJoinTestAnalysis(
  tab: SheetTabInfo,
  masterAgents: MasterAgent[],
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<SheetAnalysisRecord> {
  const sheetId = extractSpreadsheetId(spreadsheetUrl);
  const timeInfo = extractDateFromTabName(tab.name);

  // 1. Extraer código del proyecto del título del test (ej. "CD5562 CATEC..." -> "CD5562")
  const projectCode = extractProjectCode(tab.name);

  // 2. Filtrar la nómina de Lista_agentes según las campañas activas de cada asesor (.includes / tokens con comas)
  let projectAgents: MasterAgent[] = masterAgents;
  if (projectCode) {
    const matchedAgents = masterAgents.filter((agent) =>
      isAgentInProject(agent.campaign, projectCode, tab.name)
    );
    if (matchedAgents.length > 0) {
      projectAgents = matchedAgents;
    }
  }

  if (!sheetId || masterAgents.length === 0) {
    const approved = INITIAL_DEMO_RECORDS.filter((r) => r.status === "Aprobado").length;
    const failed = INITIAL_DEMO_RECORDS.filter((r) => r.status === "No Aprobado").length;
    const pending = INITIAL_DEMO_RECORDS.filter((r) => r.status === "Pendiente").length;
    const evaluated = approved + failed;
    const passRate = evaluated > 0 ? Math.round((approved / evaluated) * 100) : 0;

    return {
      id: `tab_${tab.name.replace(/\s+/g, "_")}`,
      name: tab.name,
      sheetName: tab.name,
      tabGid: tab.gid,
      createdAt: timeInfo.iso,
      createdAtFormatted: timeInfo.formatted,
      totalAgents: projectAgents.length || masterAgents.length || INITIAL_DEMO_RECORDS.length,
      approvedCount: approved,
      failedCount: failed,
      pendingCount: pending,
      passRate,
      averageScore: 84,
      trainingTopic: tab.name.split("-")[0]?.trim() || "Capacitación Operativa",
      trainer: "Apex Trainer",
      records: INITIAL_DEMO_RECORDS,
      isLiveFromGoogle: false,
      hasScoreColumn: true,
      discardedExternalCount: 0,
    };
  }

  const rawTestRows = await fetchRawTabCsv(tab, sheetId);

  if (rawTestRows.length === 0) {
    console.warn(`No se pudieron obtener filas para la pestaña "${tab.name}".`);
    const blankRecords: AgentRecord[] = projectAgents.map((m, idx) => ({
      id: `blank_${(tab.gid || tab.name).replace(/[^a-zA-Z0-9_-]/g, "_")}_${m.cleanLegajo || "agent"}_row${idx + 1}`,
      agentName: m.name,
      agentId: m.legajo,
      campaign: m.campaign || "Operaciones",
      supervisor: m.supervisor,
      trainingName: tab.name.split("-")[0]?.trim() || "Capacitación Operativa",
      trainerName: "Trainer Responsable",
      completionDate: timeInfo.iso.split("T")[0],
      score: null,
      initialScore: null,
      retakeScore: null,
      phoneScore: null,
      digitalScore: null,
      passedInRetake: false,
      minPassingScore: DEFAULT_PASSING_SCORE,
      status: "Pendiente",
      attendancePercentage: 100,
      feedback: "Sin registros en este test.",
      skillsAcquired: ["Gestión Operativa"],
      needsRetraining: true,
      sourceFileName: tab.name,
    }));

    return {
      id: `tab_${(tab.gid || tab.name).replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      name: tab.name,
      sheetName: tab.name,
      tabGid: tab.gid,
      createdAt: timeInfo.iso,
      createdAtFormatted: timeInfo.formatted,
      totalAgents: projectAgents.length, // Conteo dinámico de agentes únicos del proyecto
      approvedCount: 0,
      failedCount: 0,
      pendingCount: projectAgents.length,
      passRate: 0,
      averageScore: 0,
      trainingTopic: tab.name.split("-")[0]?.trim() || "Capacitación",
      trainer: "Trainer Apex",
      records: blankRecords,
      isLiveFromGoogle: false,
      hasScoreColumn: false,
      discardedExternalCount: 0,
    };
  }

  // 1. Identificar fila de encabezados en la pestaña de test
  let headerRowIndex = 0;
  let maxKeywordScore = 0;

  const HEADER_KEYWORDS = [
    "legajo", "usuario", "user", "id", "dni", "matricula", "codigo", "login",
    "apellidonombre", "nombreapellido", "nombre", "apellido", "agente", "asesor", "colaborador",
    "cuestionariotestatenciontelefonicareal", "cuestionariotestatenciondigitalreal",
    "cuestionariorecuperatorioatenciontelefonicareal", "cuestionariorecuperatorioatenciondigitalreal",
    "testatenciontelefonica", "testatenciondigital", "recuperatorioatenciontelefonica",
    "telefonica", "digital", "recuperatorio", "recup",
    "puntaje", "puntos", "nota", "calificacion", "score", "resultado", "totaldelcursoreal",
    "asistencia", "asistio", "presente", "estadoasistencia",
    "estado", "condicion", "resultadofinal", "aprobado", "status"
  ];

  for (let r = 0; r < Math.min(rawTestRows.length, 6); r++) {
    const rowNormalized = rawTestRows[r].map((cell) => cleanHeaderString(cell));
    let currentScore = 0;
    for (const cellStr of rowNormalized) {
      for (const kw of HEADER_KEYWORDS) {
        if (cellStr === kw || cellStr.includes(kw)) {
          currentScore++;
        }
      }
    }
    if (currentScore > maxKeywordScore) {
      maxKeywordScore = currentScore;
      headerRowIndex = r;
    }
  }

  const headerRow = rawTestRows[headerRowIndex] || [];
  const normalizedHeaders = headerRow.map((h) => cleanHeaderString(h));
  const dataRows = rawTestRows.slice(headerRowIndex + 1);

  // Helper para buscar columnas
  const findColIndex = (keywords: string[], excludeKeywords: string[] = []): number => {
    return normalizedHeaders.findIndex((h) => {
      if (!h) return false;
      const isExcluded = excludeKeywords.some((ex) => h.includes(ex));
      if (isExcluded) return false;
      return keywords.some((kw) => h === kw || h.includes(kw));
    });
  };

  const colTestUsuario = findColIndex(
    ["usuario", "legajo", "user", "dni", "matricula", "codigo", "cod", "login", "agenteid", "idagente", "id"],
    ["curso", "grupo", "materia", "capacitacion"]
  );

  const colTestNombre = findColIndex(
    ["apellidonombre", "nombreapellido", "nombre", "apellido", "agente", "asesor", "colaborador", "name", "fullname", "alumno"],
    ["curso", "capacitacion", "materia", "tema", "capacitador", "archivo", "hoja"]
  );

  const colTestApellido = findColIndex(["apellidos", "apellido"], ["nombre"]);

  const colNotaTelefonica = findColIndex(
    [
      "cuestionariotestatenciontelefonicareal",
      "testatenciontelefonicareal",
      "testatenciontelefonica",
      "atenciontelefonicareal",
      "atenciontelefonica",
      "testtelefonico",
      "telefonica",
      "telefonico"
    ],
    ["recuperatorio", "recup", "digital", "interactivo"]
  );

  const colNotaDigital = findColIndex(
    [
      "cuestionariotestatenciondigitalreal",
      "testatenciondigitalreal",
      "testatenciondigital",
      "atenciondigitalreal",
      "atenciondigital",
      "testdigital",
      "digital"
    ],
    ["recuperatorio", "recup", "telefonica", "telefonico", "interactivo"]
  );

  const colNotaRecuperatorioTel = findColIndex([
    "cuestionariorecuperatorioatenciontelefonicareal",
    "recuperatorioatenciontelefonicareal",
    "recuperatorioatenciontelefonica",
    "recuperatoriotelefonico"
  ]);

  const colNotaRecuperatorioDig = findColIndex([
    "cuestionariorecuperatorioatenciondigitalreal",
    "recuperatorioatenciondigitalreal",
    "recuperatorioatenciondigital",
    "recuperatoriodigital"
  ]);

  const colNotaRecuperatorioGen = findColIndex([
    "cuestionariorecuperatorio",
    "recuperatorio",
    "recuperacion",
    "segundointento",
    "retest",
    "recup",
    "instancia2",
    "revalida"
  ]);

  const colGeneralScore = findColIndex(
    ["totaldelcursoreal", "totaldelcurso", "puntaje", "puntos", "nota", "calificacion", "score", "resultado", "notafinal", "promedio"],
    ["telefonica", "digital", "recuperatorio", "recup", "asistencia", "estado", "condicion"]
  );

  const colStatus = findColIndex([
    "estado", "condicion", "resultadofinal", "situacion", "aprobacion", "status"
  ]);

  const colAttendance = findColIndex([
    "asistencia", "asistio", "presente", "estadoasistencia", "attendance", "presencia"
  ]);

  const colCourseName = findColIndex(["nombrecurso", "curso", "capacitacion", "tema", "materia"]);
  const colTrainer = findColIndex(["trainer", "capacitador", "instructor", "profesor", "docente"]);
  const colDate = findColIndex(["ultimadescargadeestecurso", "fecha", "date", "completado"]);
  const colFeedback = findColIndex(["observaciones", "observacion", "feedback", "comentarios", "detalle"]);

  const hasScoreColumn =
    colNotaTelefonica !== -1 ||
    colNotaDigital !== -1 ||
    colNotaRecuperatorioTel !== -1 ||
    colNotaRecuperatorioDig !== -1 ||
    colNotaRecuperatorioGen !== -1 ||
    colGeneralScore !== -1 ||
    colStatus !== -1;

  // 2. Indexación y preprocesamiento de filas de la pestaña de test
  interface ParsedTestRow {
    rawUsuario: string;
    cleanUsuario: string;
    rawNombre: string;
    cleanNombre: string;
    rawApellido: string;
    cleanFullName: string;
    rawCourseName: string;
    rawTrainer: string;
    rawDate: string;
    rawFeedback: string;
    notaTelefonica: number | null;
    notaDigital: number | null;
    notaRecuperatorio: number | null;
    generalScore: number | null;
    attendancePercentage: number;
    isAbsent: boolean;
    rawStatusStr: string;
  }

  let detectedCourseName = "";
  const parsedTestRows: ParsedTestRow[] = [];

  for (const row of dataRows) {
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const rawUsuario = colTestUsuario !== -1 ? row[colTestUsuario]?.trim() : "";
    const rawNombre = colTestNombre !== -1 ? row[colTestNombre]?.trim() : "";
    const rawApellido = colTestApellido !== -1 ? row[colTestApellido]?.trim() : "";
    const rawCourseName = colCourseName !== -1 ? row[colCourseName]?.trim() : "";
    if (rawCourseName && !detectedCourseName) {
      detectedCourseName = rawCourseName;
    }

    const rawNotaTel = colNotaTelefonica !== -1 ? row[colNotaTelefonica]?.trim() : "";
    const rawNotaDig = colNotaDigital !== -1 ? row[colNotaDigital]?.trim() : "";
    const rawRecupTel = colNotaRecuperatorioTel !== -1 ? row[colNotaRecuperatorioTel]?.trim() : "";
    const rawRecupDig = colNotaRecuperatorioDig !== -1 ? row[colNotaRecuperatorioDig]?.trim() : "";
    const rawRecupGen = colNotaRecuperatorioGen !== -1 ? row[colNotaRecuperatorioGen]?.trim() : "";
    const rawGenScore = colGeneralScore !== -1 ? row[colGeneralScore]?.trim() : "";
    const rawStatusStr = colStatus !== -1 ? row[colStatus]?.trim() : "";
    const rawAttStr = colAttendance !== -1 ? row[colAttendance]?.trim() : "";
    const rawTrainer = colTrainer !== -1 ? row[colTrainer]?.trim() : "";
    const rawDate = colDate !== -1 ? row[colDate]?.trim() : "";
    const rawFeedback = colFeedback !== -1 ? row[colFeedback]?.trim() : "";

    const notaTelefonica = parseNumericScore(rawNotaTel);
    const notaDigital = parseNumericScore(rawNotaDig);
    const recupCandidates = [
      parseNumericScore(rawRecupTel),
      parseNumericScore(rawRecupDig),
      parseNumericScore(rawRecupGen)
    ].filter((r): r is number => r !== null);
    const notaRecuperatorio = recupCandidates.length > 0 ? Math.max(...recupCandidates) : null;
    const generalScore = parseNumericScore(rawGenScore);

    // Asistencia
    let attendancePercentage = 100;
    let isAbsent = false;
    if (rawAttStr) {
      const normAtt = cleanHeaderString(rawAttStr);
      if (
        normAtt.includes("ausente") ||
        normAtt.includes("falto") ||
        normAtt.includes("noasistio") ||
        normAtt === "no" ||
        normAtt === "f" ||
        normAtt === "a"
      ) {
        attendancePercentage = 0;
        isAbsent = true;
      } else {
        const parsedAtt = parseFloat(rawAttStr.replace("%", "").replace(",", "."));
        if (!isNaN(parsedAtt)) {
          attendancePercentage = Math.min(100, Math.max(0, Math.round(parsedAtt)));
          if (attendancePercentage === 0) isAbsent = true;
        }
      }
    }

    const cleanUsuario = cleanHeaderString(rawUsuario);
    const cleanNombre = cleanHeaderString(rawNombre);
    const cleanFullName = cleanHeaderString(rawNombre + (rawApellido && rawApellido !== "-" ? " " + rawApellido : ""));

    parsedTestRows.push({
      rawUsuario,
      cleanUsuario,
      rawNombre,
      cleanNombre,
      rawApellido,
      cleanFullName,
      rawCourseName,
      rawTrainer,
      rawDate,
      rawFeedback,
      notaTelefonica,
      notaDigital,
      notaRecuperatorio,
      generalScore,
      attendancePercentage,
      isAbsent,
      rawStatusStr,
    });
  }

  // 3. SEGURIDAD & COLADOR DE AGENTES:
  //    Contabilizamos cuántos registros en la pestaña de test son externos (no están en la nómina filtrada)
  //    y los ignoramos completamente.
  const projectLegajosSet = new Set(projectAgents.map((m) => m.cleanLegajo).filter(Boolean));
  const projectNamesSet = new Set(projectAgents.map((m) => m.cleanName).filter(Boolean));

  let discardedExternalCount = 0;
  for (const testRow of parsedTestRows) {
    const isInProject =
      (testRow.cleanUsuario && projectLegajosSet.has(testRow.cleanUsuario)) ||
      (testRow.cleanFullName && projectNamesSet.has(testRow.cleanFullName)) ||
      (testRow.cleanNombre && projectNamesSet.has(testRow.cleanNombre));

    if (!isInProject) {
      discardedExternalCount++;
    }
  }

  // 4. CONSTRUCCIÓN EXCLUSIVA DE RECORDS:
  //    Iteramos ÚNICA Y EXCLUSIVAMENTE sobre 'projectAgents' (los asesores de Lista_agentes con este proyecto activo).
  //    Cada asesor queda asignado de forma interactiva a su Líder (Columna D) original.
  const joinedRecords: AgentRecord[] = projectAgents.map((master, idx) => {
    const cleanMasterLegajo = master.cleanLegajo;
    const cleanMasterName = master.cleanName;

    // Cruce prioritario 1: Por Legajo / Usuario
    let match = cleanMasterLegajo
      ? parsedTestRows.find((t) => t.cleanUsuario === cleanMasterLegajo)
      : undefined;

    // Cruce prioritario 2: Por Nombre y Apellido
    if (!match && cleanMasterName) {
      match = parsedTestRows.find(
        (t) =>
          t.cleanFullName === cleanMasterName ||
          t.cleanNombre === cleanMasterName ||
          t.cleanFullName.includes(cleanMasterName) ||
          cleanMasterName.includes(t.cleanFullName) ||
          cleanMasterName.includes(t.cleanNombre)
      );
    }

    let status: ApprovalStatus = "Pendiente";
    let finalScore: number | null = null;
    let initialScore: number | null = null;
    let retakeScore: number | null = null;
    let phoneScore: number | null = null;
    let digitalScore: number | null = null;
    let passedInRetake = false;
    let feedback = "";
    let attendancePercentage = 100;
    let completionDate = timeInfo.iso.split("T")[0];
    let trainerName = "Sin Trainer";

    if (match) {
      phoneScore = match.notaTelefonica;
      digitalScore = match.notaDigital;
      retakeScore = match.notaRecuperatorio;
      attendancePercentage = match.attendancePercentage;
      feedback = match.rawFeedback || "";
      if (match.rawDate) completionDate = match.rawDate;
      if (match.rawTrainer && match.rawTrainer !== "-") trainerName = match.rawTrainer;

      const notaTelefonica = phoneScore;
      const notaDigital = digitalScore;
      const notaRecuperatorio = retakeScore;
      const generalScore = match.generalScore;
      const isAbsent = match.isAbsent;

      // REGLA A: PENDIENTE (Sin notas)
      if (
        notaTelefonica === null &&
        notaDigital === null &&
        notaRecuperatorio === null &&
        generalScore === null
      ) {
        status = "Pendiente";
        finalScore = null;
        initialScore = null;
        passedInRetake = false;
        if (!feedback) {
          feedback = isAbsent ? "Ausente en evaluación." : "Evaluación pendiente (sin nota registrada).";
        }
        if (isAbsent) {
          status = "No Aprobado";
        }
      }
      // REGLA B: APROBADO POR RECUPERATORIO (>= 80 en recuperatorio)
      else if (notaRecuperatorio !== null && notaRecuperatorio >= DEFAULT_PASSING_SCORE) {
        status = "Aprobado";
        passedInRetake = true;
        initialScore = notaTelefonica !== null ? notaTelefonica : notaDigital !== null ? notaDigital : generalScore;
        finalScore = notaRecuperatorio;
        if (!feedback) {
          feedback = `Aprobado por Recuperatorio (${notaRecuperatorio} pts).`;
        }
      }
      // REGLA C: APROBADO DIRECTO (>= 80 en pruebas rendidas)
      else if (
        (notaTelefonica !== null || notaDigital !== null || generalScore !== null) &&
        (notaTelefonica === null || notaTelefonica >= DEFAULT_PASSING_SCORE) &&
        (notaDigital === null || notaDigital >= DEFAULT_PASSING_SCORE) &&
        (generalScore === null || generalScore >= DEFAULT_PASSING_SCORE) &&
        (
          (notaTelefonica !== null && notaTelefonica >= DEFAULT_PASSING_SCORE) ||
          (notaDigital !== null && notaDigital >= DEFAULT_PASSING_SCORE) ||
          (generalScore !== null && generalScore >= DEFAULT_PASSING_SCORE)
        )
      ) {
        status = "Aprobado";
        passedInRetake = false;
        const presentScores = [notaTelefonica, notaDigital, generalScore].filter((s): s is number => s !== null);
        finalScore = Math.round(presentScores.reduce((a, b) => a + b, 0) / presentScores.length);
        initialScore = finalScore;

        if (!feedback) {
          const details: string[] = [];
          if (notaTelefonica !== null) details.push(`Telefónica: ${notaTelefonica}`);
          if (notaDigital !== null) details.push(`Digital: ${notaDigital}`);
          if (generalScore !== null && details.length === 0) details.push(`Puntaje: ${generalScore}`);
          feedback = `Aprobado Directo (${details.join(" / ")} pts).`;
        }
      }
      // REGLA D: DESAPROBADO (< 80)
      else {
        status = "No Aprobado";
        passedInRetake = false;
        const allScores = [notaTelefonica, notaDigital, notaRecuperatorio, generalScore].filter((s): s is number => s !== null);
        if (allScores.length > 0) {
          finalScore = Math.max(...allScores);
          initialScore = notaTelefonica !== null ? notaTelefonica : notaDigital !== null ? notaDigital : generalScore;
          if (!feedback) {
            feedback = isAbsent
              ? "Ausente en evaluación."
              : `No Aprobado (${finalScore} pts < ${DEFAULT_PASSING_SCORE}). Requiere recuperatorio.`;
          }
        } else {
          finalScore = null;
          initialScore = null;
          if (!feedback) {
            feedback = "No Aprobado.";
          }
        }
      }

      // Override de columna Estado directa si existiera
      if (match.rawStatusStr && status === "Pendiente") {
        const normStatus = cleanHeaderString(match.rawStatusStr);
        if (
          normStatus.includes("aprobado") ||
          normStatus.includes("aprobada") ||
          normStatus === "ok" ||
          normStatus.includes("paso")
        ) {
          status = "Aprobado";
        } else if (
          normStatus.includes("desaprobado") ||
          normStatus.includes("noaprobado") ||
          normStatus.includes("reprobado") ||
          normStatus.includes("falla")
        ) {
          status = "No Aprobado";
        }
      }
    } else {
      // El agente de la lista maestra no rindió este test
      status = "Pendiente";
      feedback = "No rindió este test (sin evaluación registrada).";
    }

    return {
      id: `joined_${(tab.gid || tab.name).replace(/[^a-zA-Z0-9_-]/g, "_")}_${master.cleanLegajo || "agent"}_row${idx + 1}`,
      agentName: master.name,
      agentId: master.legajo,
      campaign: master.campaign || "Operaciones",
      supervisor: master.supervisor,
      trainingName: detectedCourseName || tab.name.split("-")[0]?.trim() || "Capacitación Operativa",
      trainerName,
      completionDate,
      score: finalScore,
      initialScore,
      retakeScore,
      phoneScore,
      digitalScore,
      passedInRetake,
      minPassingScore: DEFAULT_PASSING_SCORE,
      status,
      attendancePercentage,
      feedback,
      skillsAcquired: ["Gestión Operativa", "Protocolo de Calidad"],
      needsRetraining: status !== "Aprobado",
      sourceFileName: tab.name,
    };
  });

  // 5. CÁLCULO DE MÉTRICAS DINÁMICAS POR EXAMEN SOBRE EL GRUPO FILTRADO:
  const approvedCount = joinedRecords.filter((r) => r.status === "Aprobado").length;
  const failedCount = joinedRecords.filter((r) => r.status === "No Aprobado").length;
  const pendingCount = joinedRecords.filter(
    (r) => r.status === "Pendiente" || (r.status !== "Aprobado" && r.status !== "No Aprobado")
  ).length;

  const validScores = joinedRecords
    .filter((r) => r.status !== "Pendiente")
    .map((r) => r.score)
    .filter((s): s is number => typeof s === "number");

  const avgScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

  const totalEvaluated = approvedCount + failedCount;
  const passRate =
    totalEvaluated > 0
      ? Math.round((approvedCount / totalEvaluated) * 100)
      : joinedRecords.length > 0
      ? Math.round((approvedCount / joinedRecords.length) * 100)
      : 0;

  return {
    id: `tab_${(tab.gid || tab.name).replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    name: tab.name,
    sheetName: tab.name,
    tabGid: tab.gid,
    createdAt: timeInfo.iso,
    createdAtFormatted: timeInfo.formatted,
    totalAgents: projectAgents.length, // Dinámico: Total de asesores únicos de Lista_agentes con este proyecto
    approvedCount,
    failedCount,
    pendingCount,
    passRate,
    averageScore: avgScore,
    trainingTopic: detectedCourseName || tab.name.split("-")[0]?.trim() || "Capacitación",
    trainer: joinedRecords[0]?.trainerName || "Trainer Apex",
    records: joinedRecords,
    isLiveFromGoogle: true,
    hasScoreColumn,
    discardedExternalCount,
  };
}

/**
 * 4. FUNCIÓN MAESTRA CON REGLAS DE SEGURIDAD & ESTADOS CENTRALIZADOS:
 *    - Carga 'Lista_agentes', detecta todos los tests dinámicamente (ocultando Lista_agentes del historial).
 *    - Consulta la pestaña 'Config_Usuarios' para obtener el estado (Activo / No Activo) centralizado en la nube.
 *    - Cruza estrictamente cada test contra la base maestra.
 */
export async function fetchAllSheetAnalyses(
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<SheetAnalysisRecord[]> {
  // 1. Obtener el universo único y fijo de 261 asesores desde Lista_agentes
  const masterAgents = await fetchMasterAgentList(spreadsheetUrl);

  // 2. Detectar dinámicamente todas las pestañas de test (filtrando Lista_agentes y Config_Usuarios)
  const testTabs = await fetchSpreadsheetTestTabs(spreadsheetUrl);

  // 3. Consultar en vivo la pestaña Config_Usuarios para obtener el estado (Activo / No Activo) de cada test
  const testStatusesMap = await fetchTestStatuses(spreadsheetUrl);

  const results: SheetAnalysisRecord[] = [];

  for (const tab of testTabs) {
    try {
      const record = await fetchAndJoinTestAnalysis(tab, masterAgents, spreadsheetUrl);
      
      // Asociar código del proyecto y estado centralizado desde Config_Usuarios
      const projectCode = extractProjectCode(tab.name) || tab.name.toUpperCase().trim();
      const cleanTabName = cleanHeaderString(tab.name);
      
      let testStatus: "Activo" | "No Activo" = "Activo";
      if (
        (projectCode && testStatusesMap[projectCode] === "No Activo") ||
        (cleanTabName && testStatusesMap[cleanTabName] === "No Activo") ||
        testStatusesMap[tab.name.toUpperCase().trim()] === "No Activo"
      ) {
        testStatus = "No Activo";
      }

      record.projectCode = projectCode;
      record.testStatus = testStatus;
      results.push(record);
    } catch (e) {
      console.warn(`Error al procesar la pestaña de test "${tab.name}":`, e);
    }
  }

  // Fallback si no hubiese pestañas de test detectadas
  if (results.length === 0) {
    const defaultTab: SheetTabInfo = {
      name: "CD2633 Genesys Cloud",
      gid: "922387748",
    };
    const defaultRecord = await fetchAndJoinTestAnalysis(defaultTab, masterAgents, spreadsheetUrl);
    const projectCode = extractProjectCode(defaultTab.name);
    defaultRecord.projectCode = projectCode;
    defaultRecord.testStatus = testStatusesMap[projectCode] === "No Activo" ? "No Activo" : "Activo";
    results.push(defaultRecord);
  }

  return results;
}

/**
 * Consulta la pestaña 'Config_Usuarios' en Google Sheets para obtener el estado centralizado
 * (Activo / No Activo) de cada evaluación.
 * Reutiliza la Columna A para el código del test (ej: "CD2633" o "CD2552") y la Columna C para el estado ("Activo" o "No Activo").
 */
export async function fetchTestStatuses(
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<Record<string, "Activo" | "No Activo">> {
  const sheetId = extractSpreadsheetId(spreadsheetUrl);
  const statusMap: Record<string, "Activo" | "No Activo"> = {};
  if (!sheetId) return statusMap;

  const candidateTabNames = [
    "Config_Usuarios",
    "Config_Usuario",
    "ConfigUsuarios",
    "Configuracion_Usuarios",
    "Usuarios",
    "Config",
  ];

  let rawCsvRows: string[][] = [];

  for (const tabName of candidateTabNames) {
    const endpoints = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(tabName)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (
            text &&
            !text.includes("<!DOCTYPE html>") &&
            !text.includes("Sign in to your Google Account") &&
            !text.includes("accounts.google.com") &&
            !text.includes("Error:")
          ) {
            const rows = parseCsvRows(text);
            if (rows.length >= 1) {
              rawCsvRows = rows;
              break;
            }
          }
        }
      } catch {
        // Continuar probando alternativas
      }
    }
    if (rawCsvRows.length > 0) break;
  }

  if (rawCsvRows.length === 0) return statusMap;

  // Analizar filas: Columna A (código de test/usuario) y Columna C (estado Activo / No Activo)
  for (let r = 0; r < rawCsvRows.length; r++) {
    const row = rawCsvRows[r];
    if (!row || row.length === 0) continue;

    const colA = sanitizeAuthCell(row[0]).trim();
    if (!colA) continue;

    // Columna C (índice 2)
    const colC = row.length > 2 ? sanitizeAuthCell(row[2]).trim() : "";
    const normC = cleanHeaderString(colC);

    const normA = cleanHeaderString(colA);
    const codeA = extractProjectCode(colA) || colA.toUpperCase().replace(/\s+/g, "");

    let state: "Activo" | "No Activo" = "Activo";
    if (
      normC === "noactivo" ||
      normC === "inactivo" ||
      normC === "desactivado" ||
      normC === "false" ||
      normC === "0" ||
      normC === "baja" ||
      normC === "no"
    ) {
      state = "No Activo";
    } else if (
      normC === "activo" ||
      normC === "active" ||
      normC === "true" ||
      normC === "1" ||
      normC === "si"
    ) {
      state = "Activo";
    } else {
      // Búsqueda en toda la fila por si la columna de estado está en otra posición
      const anyNoActive = row.some((c) => {
        const nc = cleanHeaderString(c);
        return nc === "noactivo" || nc === "inactivo" || nc === "desactivado";
      });
      if (anyNoActive) {
        state = "No Activo";
      }
    }

    if (codeA) {
      statusMap[codeA] = state;
    }
    if (normA) {
      statusMap[normA] = state;
    }
    statusMap[colA.toUpperCase()] = state;
  }

  return statusMap;
}

// =========================================================================
// 🔐 CRIPTOGRAFÍA HASH (SHA-256) & AUTENTICACIÓN MULTIUSUARIO SEGURA
// =========================================================================

/**
 * Sanitiza celdas de autenticación eliminando espacios invisibles, BOM, saltos de línea y comillas envolventes
 */
export function sanitizeAuthCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  let s = String(val);
  // Limpiar caracteres invisibles, control, BOM, no-breaking spaces, saltos
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, " ");
  s = s.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith("`") && s.endsWith("`"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Función síncrona robusta para cálculo de hash criptográfico SHA-256
 * Cumple 100% con el estándar FIPS PUB 180-4 para hashing unidireccional.
 */
export function computeSHA256Sync(ascii: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(n: number, x: number) { return (x >>> n) | (x << (32 - n)); }
  function ch(x: number, y: number, z: number) { return (x & y) ^ (~x & z); }
  function maj(x: number, y: number, z: number) { return (x & y) ^ (x & z) ^ (y & z); }
  function sigma0(x: number) { return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x); }
  function sigma1(x: number) { return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x); }
  function gamma0(x: number) { return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3); }
  function gamma1(x: number) { return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10); }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(ascii);
  const l = bytes.length;
  const bitLen = l * 8;

  const k = (56 - ((l + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(l + 1 + k + 8);
  padded.set(bytes, 0);
  padded[l] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const W = new Uint32Array(64);

  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0;
    }

    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) | 0;
      const T2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) | 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, H0, false);
  outView.setUint32(4, H1, false);
  outView.setUint32(8, H2, false);
  outView.setUint32(12, H3, false);
  outView.setUint32(16, H4, false);
  outView.setUint32(20, H5, false);
  outView.setUint32(24, H6, false);
  outView.setUint32(28, H7, false);

  return Array.from(out).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Función asíncrona para cálculo de hash SHA-256 utilizando Web Crypto API nativo
 */
export async function computeSHA256(message: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback si Web Crypto falla en entornos no seguros
      return computeSHA256Sync(message);
    }
  }
  return computeSHA256Sync(message);
}

/**
 * Hash SHA-256 maestro para "Apex.Trainer2026@"
 */
export const MASTER_PASSWORD_HASH = "950b650d683cd3a8fcb5d66b1e3e9f6016d6f072fb563fcb62e0f0541ff1e5ab";

/**
 * Usuarios maestros de emergencia por defecto (garantiza acceso ininterrumpido)
 */
export const DEFAULT_ADMIN_USERS: ConfigUser[] = [
  {
    username: "ApexTrainer",
    email: "jose.perini@apexamerica.com",
    passwordHash: MASTER_PASSWORD_HASH,
    name: "Trainer Principal Apex",
    role: "Administrador / Trainer",
    requiresPasswordChange: false,
    isActive: true,
  },
];

/**
 * Lee y parsea la lista de usuarios autorizados desde la pestaña 'Config_Usuarios' en Google Sheets
 */
export async function fetchConfigUsers(
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<ConfigUser[]> {
  const sheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!sheetId) return DEFAULT_ADMIN_USERS;

  const candidateTabNames = [
    "Config_Usuarios",
    "Config_Usuario",
    "ConfigUsuarios",
    "Configuracion_Usuarios",
    "Usuarios",
    "Users",
    "Config",
    "Credenciales",
    "Trainers",
    "Admin",
  ];

  let rawCsvRows: string[][] = [];

  for (const tabName of candidateTabNames) {
    const endpoints = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=${encodeURIComponent(tabName)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (
            text &&
            !text.includes("<!DOCTYPE html>") &&
            !text.includes("Sign in to your Google Account") &&
            !text.includes("accounts.google.com") &&
            !text.includes("Error:")
          ) {
            const rows = parseCsvRows(text);
            if (rows.length >= 2) {
              rawCsvRows = rows;
              break;
            }
          }
        }
      } catch (err) {
        // Continuar probando alternativas
      }
    }
    if (rawCsvRows.length > 0) break;
  }

  if (rawCsvRows.length < 2) {
    return DEFAULT_ADMIN_USERS;
  }

  // Detectar índices de encabezados
  const headers = rawCsvRows[0].map((h) => cleanHeaderString(h));
  let userCol = -1;
  let emailCol = -1;
  let passCol = -1;
  let nameCol = -1;
  let roleCol = -1;
  let reqChangeCol = -1;
  let activeCol = -1;

  headers.forEach((h, idx) => {
    if (h.includes("email") || h.includes("correo") || h.includes("mail")) {
      if (emailCol === -1) emailCol = idx;
    } else if (
      h.includes("usuario") ||
      h.includes("user") ||
      h.includes("trainer") ||
      h.includes("login") ||
      h.includes("username") ||
      h.includes("cuenta")
    ) {
      if (userCol === -1) userCol = idx;
    } else if (
      h.includes("password") ||
      h.includes("pass") ||
      h.includes("hash") ||
      h.includes("clave") ||
      h.includes("contrasena") ||
      h.includes("contraseña") ||
      h.includes("pwd") ||
      h.includes("pin")
    ) {
      if (passCol === -1) passCol = idx;
    } else if (h.includes("nombre") || h.includes("name") || h.includes("apellido") || h.includes("fullname")) {
      if (nameCol === -1) nameCol = idx;
    } else if (h.includes("rol") || h.includes("role") || h.includes("cargo") || h.includes("perfil") || h.includes("tipo")) {
      if (roleCol === -1) roleCol = idx;
    } else if (
      h.includes("requierecambio") ||
      h.includes("cambiopassword") ||
      h.includes("cambiarpwd") ||
      h.includes("primer_ingreso") ||
      h.includes("primeringreso") ||
      h.includes("mustchange") ||
      h.includes("forzarcambio")
    ) {
      if (reqChangeCol === -1) reqChangeCol = idx;
    } else if (h.includes("activo") || h.includes("active") || h.includes("estado") || h.includes("habilitado") || h.includes("status")) {
      if (activeCol === -1) activeCol = idx;
    }
  });

  if (userCol === -1 && emailCol !== -1) {
    userCol = emailCol;
  }

  if (userCol === -1 || passCol === -1) {
    return DEFAULT_ADMIN_USERS;
  }

  const users: ConfigUser[] = [];

  for (let r = 1; r < rawCsvRows.length; r++) {
    const row = rawCsvRows[r];
    const rawUsername = sanitizeAuthCell(row[userCol]);
    const rawEmail = emailCol !== -1 ? sanitizeAuthCell(row[emailCol]) : undefined;
    const rawPasswordOrHash = sanitizeAuthCell(row[passCol]);
    
    if (!rawUsername || !rawPasswordOrHash) continue;

    const name = nameCol !== -1 ? sanitizeAuthCell(row[nameCol]) : undefined;
    const role = roleCol !== -1 ? sanitizeAuthCell(row[roleCol]) : "Trainer / Administrador";

    // Evaluar bandera de cambio obligatorio
    let requiresPasswordChange = false;
    if (reqChangeCol !== -1) {
      const val = cleanHeaderString(row[reqChangeCol]);
      requiresPasswordChange =
        val === "true" ||
        val === "si" ||
        val === "1" ||
        val === "verdadero" ||
        val === "v" ||
        val === "requiere" ||
        val === "pendiente";
    }

    // Evaluar estado activo
    let isActive = true;
    if (activeCol !== -1) {
      const val = cleanHeaderString(row[activeCol]);
      if (val === "false" || val === "no" || val === "0" || val === "inactivo" || val === "bloqueado" || val === "baja") {
        isActive = false;
      }
    }

    // Normalizar a SHA-256: Si ya es un hash hexadecimal de 64 caracteres, se usa directo.
    // Si se colocó texto plano en la hoja, se calcula su SHA-256 automáticamente.
    const isHex64 = /^[a-fA-F0-9]{64}$/.test(rawPasswordOrHash);
    const passwordHash = isHex64 ? rawPasswordOrHash.toLowerCase() : computeSHA256Sync(rawPasswordOrHash).toLowerCase();

    users.push({
      username: rawUsername,
      email: rawEmail,
      passwordHash,
      name: name || rawUsername,
      role: role || "Trainer",
      requiresPasswordChange,
      isActive,
    });
  }

  // Garantizar que ApexTrainer siempre esté presente en la lista
  if (!users.some((u) => cleanHeaderString(u.username) === "apextrainer" || cleanHeaderString(u.email || "") === "jose.perini@apexamerica.com")) {
    users.push(DEFAULT_ADMIN_USERS[0]);
  }

  return users;
}

/**
 * Valida las credenciales ingresadas aplicando trim exhaustivo, lowercase, SHA-256 y fallback de emergencia garantizado
 */
export async function validateAdminLogin(
  inputUsername: string,
  inputPlainPassword: string,
  spreadsheetUrl: string = GOOGLE_SHEET_URL
): Promise<{
  success: boolean;
  user?: ConfigUser;
  requiresPasswordChange?: boolean;
  message?: string;
  errorType?: "empty" | "user_not_found" | "wrong_password" | "user_inactive";
}> {
  const cleanUser = sanitizeAuthCell(inputUsername);
  const cleanPass = sanitizeAuthCell(inputPlainPassword);

  if (!cleanUser || !cleanPass) {
    return {
      success: false,
      errorType: "empty",
      message: "Por favor, ingrese tanto el usuario como la contraseña.",
    };
  }

  const normalizedInputUser = cleanHeaderString(cleanUser);
  const computedHash = computeSHA256Sync(cleanPass).toLowerCase();

  // =========================================================================
  // 🛡️ 1. MECANISMO DE RESPALDO (FALLBACK SEGURO DE EMERGENCIA)
  // =========================================================================
  // Si coincide con las credenciales maestras (ApexTrainer / Apex.Trainer2026@ o hash),
  // se autoriza inmediatamente sin importar bloqueos o caídas de Sheets.
  const isMasterUser =
    normalizedInputUser === "apextrainer" ||
    normalizedInputUser === "trainer" ||
    normalizedInputUser === "admin" ||
    normalizedInputUser === "apextrainers" ||
    normalizedInputUser === "jose.perini@apexamerica.com" ||
    normalizedInputUser === "joseperini" ||
    normalizedInputUser === "perini";

  const isMasterPassword =
    cleanPass === "Apex.Trainer2026@" ||
    cleanPass === "Apex.Trainer2026" ||
    computedHash === MASTER_PASSWORD_HASH ||
    cleanPass.toLowerCase() === MASTER_PASSWORD_HASH;

  if (isMasterUser && isMasterPassword) {
    return {
      success: true,
      user: DEFAULT_ADMIN_USERS[0],
      requiresPasswordChange: false,
    };
  }

  // =========================================================================
  // 🔍 2. LECTURA DE USUARIOS EN CONFIG_USUARIOS DE GOOGLE SHEETS
  // =========================================================================
  let users: ConfigUser[] = [];
  try {
    users = await fetchConfigUsers(spreadsheetUrl);
  } catch (err) {
    console.warn("⚠️ Advertencia: No se pudo conectar a Config_Usuarios en Google Sheets, aplicando fallback maestro:", err);
    users = DEFAULT_ADMIN_USERS;
  }

  // 3. Buscar usuario por username o email con normalización estricta (lowercase & trim)
  const matchedUser = users.find((u) => {
    const userMatch = cleanHeaderString(u.username) === normalizedInputUser;
    const emailMatch = u.email ? cleanHeaderString(u.email) === normalizedInputUser : false;
    return userMatch || emailMatch;
  });

  if (!matchedUser) {
    return {
      success: false,
      errorType: "user_not_found",
      message: `Usuario no encontrado: El usuario o correo "${cleanUser}" no está registrado en la base de datos de trainers autorizados.`,
    };
  }

  // Verificar si la cuenta está inactiva
  if (matchedUser.isActive === false) {
    return {
      success: false,
      errorType: "user_inactive",
      message: `Usuario inhabilitado: La cuenta de "${matchedUser.name || matchedUser.username}" se encuentra desactivada. Contacte al Administrador Principal.`,
    };
  }

  // 4. Comparar hash SHA-256
  const storedHash = matchedUser.passwordHash.toLowerCase();
  const isMatch =
    computedHash === storedHash ||
    cleanPass.toLowerCase() === storedHash ||
    cleanPass === matchedUser.passwordHash;

  if (!isMatch) {
    return {
      success: false,
      errorType: "wrong_password",
      message: `Contraseña incorrecta: La clave ingresada no coincide con la registrada para el usuario "${matchedUser.username}".`,
    };
  }

  return {
    success: true,
    user: matchedUser,
    requiresPasswordChange: !!matchedUser.requiresPasswordChange,
  };
}

/**
 * Envía una petición POST al Webhook de Google Apps Script para actualizar de forma segura
 * la contraseña (hash SHA-256) de un usuario en la pestaña Config_Usuarios del Google Sheet.
 */
export async function updatePasswordHashRemote(
  usuario: string,
  nuevoHash: string,
  webhookUrl: string = APPS_SCRIPT_URL
): Promise<{ success: boolean; message?: string; rawResponse?: unknown }> {
  const cleanUser = sanitizeAuthCell(usuario);
  const cleanHash = sanitizeAuthCell(nuevoHash).toLowerCase();

  if (!cleanUser || !cleanHash) {
    return {
      success: false,
      message: "Usuario o Hash inválido para la actualización.",
    };
  }

  const payload = {
    usuario: cleanUser,
    nuevoHash: cleanHash,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    // Comprobar estado exitoso
    const isSuccess =
      data.status === "success" ||
      data.result === "success" ||
      data.success === true ||
      data.status === "ok" ||
      data.result === "ok" ||
      (typeof responseText === "string" && responseText.toLowerCase().includes("success")) ||
      response.ok;

    if (isSuccess) {
      return {
        success: true,
        message: data.message || "Contraseña actualizada con éxito en la base de datos centralizada",
        rawResponse: data,
      };
    } else {
      return {
        success: false,
        message:
          data.message ||
          data.error ||
          "El servidor de Google Apps Script no pudo procesar la actualización.",
        rawResponse: data,
      };
    }
  } catch (err: any) {
    console.error("Error al conectar con Google Apps Script webhook:", err);
    return {
      success: false,
      message: `Error de conexión con Apps Script: ${err?.message || "No se pudo completar la petición."}`,
    };
  }
}

export interface StatusEmailReportPayload {
  accion: "enviar_correo";
  nombreTest: string;
  aprobados: number;
  desaprobados: number;
  pendientes: number;
  totalAgentes: number;
  porcentajeExito: number;
  porcentajeDesaprobados: number;
  porcentajePendientes: number;
}

/**
 * Envía una petición POST al Webhook de Google Apps Script para despachar
 * las notificaciones de status del test activo por correo electrónico (Texto Plano).
 */
export async function sendEmailReportRemote(
  payload: {
    accion?: string;
    nombreTest?: string;
    aprobados?: number;
    desaprobados?: number;
    pendientes?: number;
    totalAgentes?: number;
    porcentajeExito?: number;
    porcentajeDesaprobados?: number;
    porcentajePendientes?: number;
  },
  webhookUrl: string = APPS_SCRIPT_URL
): Promise<{ success: boolean; message?: string; rawResponse?: unknown }> {
  const fullPayload: StatusEmailReportPayload = {
    accion: "enviar_correo",
    nombreTest: String(payload.nombreTest || "Test Actual"),
    aprobados: Number(payload.aprobados || 0),
    desaprobados: Number(payload.desaprobados || 0),
    pendientes: Number(payload.pendientes || 0),
    totalAgentes: Number(payload.totalAgentes || 0),
    porcentajeExito: Number(payload.porcentajeExito || 0),
    porcentajeDesaprobados: Number(payload.porcentajeDesaprobados || 0),
    porcentajePendientes: Number(payload.porcentajePendientes || 0),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(fullPayload),
      redirect: "follow",
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    const isSuccess =
      data.status === "success" ||
      data.result === "success" ||
      data.success === true ||
      data.status === "ok" ||
      data.result === "ok" ||
      (typeof responseText === "string" &&
        responseText.toLowerCase().includes("success")) ||
      response.ok;

    if (isSuccess) {
      return {
        success: true,
        message:
          data.message ||
          "¡Reporte de status enviado con éxito por correo electrónico!",
        rawResponse: data,
      };
    } else {
      return {
        success: false,
        message:
          data.message ||
          data.error ||
          "El servidor de Google Apps Script no pudo enviar los correos de notificación.",
        rawResponse: data,
      };
    }
  } catch (err: any) {
    console.error("Error al enviar reporte por correo via Google Apps Script:", err);
    return {
      success: false,
      message: `Error de conexión con Apps Script: ${err?.message || "No se pudo enviar el correo."}`,
    };
  }
}

export interface SaveTestStatusPayload {
  accion: "guardar_estado_test";
  codigoTest: string;
  nuevoEstado: "Activo" | "No Activo";
}

/**
 * Envía una petición POST al Webhook de Google Apps Script para actualizar de forma centralizada
 * el estado (Activo / No Activo) de una evaluación en la pestaña Config_Usuarios del Google Sheet.
 */
export async function updateTestStatusRemote(
  codigoTest: string,
  nuevoEstado: "Activo" | "No Activo",
  webhookUrl: string = APPS_SCRIPT_URL
): Promise<{ success: boolean; message?: string; rawResponse?: unknown }> {
  const cleanCode = sanitizeAuthCell(codigoTest).trim().toUpperCase();

  const payload: SaveTestStatusPayload = {
    accion: "guardar_estado_test",
    codigoTest: cleanCode,
    nuevoEstado: nuevoEstado,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    const isSuccess =
      data.status === "success" ||
      data.result === "success" ||
      data.success === true ||
      data.status === "ok" ||
      data.result === "ok" ||
      (typeof responseText === "string" &&
        responseText.toLowerCase().includes("success")) ||
      response.ok;

    if (isSuccess) {
      return {
        success: true,
        message:
          data.message ||
          "Estado de evaluación actualizado en la nube para todo el equipo",
        rawResponse: data,
      };
    } else {
      return {
        success: false,
        message:
          data.message ||
          data.error ||
          "El servidor de Google Apps Script no pudo guardar el estado en Google Sheets.",
        rawResponse: data,
      };
    }
  } catch (err: any) {
    console.error("Error al guardar estado de la evaluación via Google Apps Script:", err);
    return {
      success: false,
      message: `Error de conexión con Apps Script: ${err?.message || "No se pudo completar la petición."}`,
    };
  }
}



