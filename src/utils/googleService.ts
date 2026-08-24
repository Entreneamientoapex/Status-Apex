import { AgentRecord, TrainingBatch } from "../types";
import {
  GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_DRIVE_FOLDER_NAME,
  EDITOR_CREDENTIALS,
  UserRole,
} from "./googleDriveConfig";

export { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_FOLDER_NAME, EDITOR_CREDENTIALS, type UserRole };

/**
 * ============================================================================
 * CREDENCIALES Y ROLES DE LA APLICACIÓN
 * ============================================================================
 */
export const DEFAULT_EDITOR_USER: GoogleUserProfile = {
  email: "admin@apexamerica.com",
  name: "Editor Apex",
  picture: "https://ui-avatars.com/api/?name=Editor+Apex&background=4F7A4F&color=fff&bold=true",
  sub: "editor_apex_admin",
};

export const DEFAULT_LECTOR_USER: GoogleUserProfile = {
  email: "lector@apexamerica.com",
  name: "Modo Lector",
  picture: "https://ui-avatars.com/api/?name=Lector&background=8DA189&color=fff&bold=true",
  sub: "lector_apex_guest",
};

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
}

export interface SavedAnalysisRecord {
  id: string; // Google Drive File ID or Local ID
  driveFileId?: string; // If synced with Google Drive
  name: string;
  createdAt: string; // ISO 8601
  createdAtFormatted: string; // e.g. "19 ago 2026 • 09:12 hs"
  updatedAt: string;
  updatedAtFormatted: string;
  authorEmail?: string;
  authorName?: string;
  totalAgents: number;
  approvedCount: number;
  failedCount: number;
  passRate: number;
  averageScore: number;
  trainingTopic: string;
  trainer: string;
  aiSummary?: string;
  aiRecommendations?: string[];
  records: AgentRecord[];
}

const LOCAL_STORAGE_HISTORY_KEY = "trainer_analysis_history_v2";
const LOCAL_STORAGE_ROLE_KEY = "trainer_app_user_role_v3";
const LOCAL_STORAGE_USER_KEY = "trainer_app_user_profile_v3";

/**
 * Format Date & Time cleanly
 */
export function formatDateTime(dateInput: string | number | Date): { iso: string; formatted: string } {
  const d = new Date(dateInput);
  const isValid = !isNaN(d.getTime());
  const dateObj = isValid ? d : new Date();

  const day = String(dateObj.getDate()).padStart(2, "0");
  const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const monthStr = monthNames[dateObj.getMonth()] || "mes";
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");

  return {
    iso: dateObj.toISOString(),
    formatted: `${day} ${monthStr} ${year} • ${hours}:${minutes} hs`,
  };
}

/**
 * Filter and extract ONLY the second file name (test/evaluation file),
 * completely ignoring any agent roster file prefix (e.g. "Lista_agentes.xlsx + ...")
 */
export function sanitizeEvaluationFileName(name: string): string {
  if (!name) return "Evaluación";
  const trimmed = name.trim();
  // If it contains compound joined file names with " + ", take only the second / last part
  if (trimmed.includes(" + ")) {
    const parts = trimmed.split(" + ");
    return parts[parts.length - 1].trim();
  }
  return trimmed;
}

// In-Memory Token Cache
let cachedAccessToken: string | null = null;

/**
 * Validate credentials against fixed config
 */
export function authenticateWithCredentials(
  username: string,
  password: string
): { success: boolean; role: UserRole; user: GoogleUserProfile | null } {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  if (
    cleanUser === EDITOR_CREDENTIALS.username.toLowerCase() &&
    cleanPass === EDITOR_CREDENTIALS.password
  ) {
    const user: GoogleUserProfile = {
      email: `${cleanUser}@apexamerica.com`,
      name: `Editor (${username.trim()})`,
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4F7A4F&color=fff&bold=true`,
      sub: `user_${cleanUser}`,
    };
    saveUserSession("Editor", user);
    return { success: true, role: "Editor", user };
  }

  return { success: false, role: "Lector", user: null };
}

/**
 * Retrieve saved session from localStorage (default: Lector)
 */
export function getSavedSession(): { role: UserRole; user: GoogleUserProfile } {
  try {
    const savedRole = localStorage.getItem(LOCAL_STORAGE_ROLE_KEY) as UserRole | null;
    const savedUserRaw = localStorage.getItem(LOCAL_STORAGE_USER_KEY);

    if (savedRole === "Editor") {
      const user = savedUserRaw ? JSON.parse(savedUserRaw) : DEFAULT_EDITOR_USER;
      return { role: "Editor", user };
    }
  } catch (e) {
    console.error("Error reading session:", e);
  }

  return { role: "Lector", user: DEFAULT_LECTOR_USER };
}

/**
 * Save user session to localStorage
 */
export function saveUserSession(role: UserRole, user: GoogleUserProfile) {
  try {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, role);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Error saving session:", e);
  }
}

/**
 * Clear session and revert to Lector mode
 */
export function clearSession(): { role: UserRole; user: GoogleUserProfile } {
  try {
    localStorage.setItem(LOCAL_STORAGE_ROLE_KEY, "Lector");
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(DEFAULT_LECTOR_USER));
  } catch (e) {
    console.error("Error clearing session:", e);
  }
  return { role: "Lector", user: DEFAULT_LECTOR_USER };
}

/**
 * Compatibility aliases for existing components
 */
export function getSavedGoogleUser(): { user: GoogleUserProfile | null; role: UserRole } {
  const session = getSavedSession();
  return { user: session.user, role: session.role };
}

export function forceEditorMode(): { user: GoogleUserProfile; role: UserRole } {
  saveUserSession("Editor", DEFAULT_EDITOR_USER);
  return { user: DEFAULT_EDITOR_USER, role: "Editor" };
}

export function persistGoogleUser(user: GoogleUserProfile | null) {
  if (user) {
    saveUserSession("Editor", user);
  } else {
    clearSession();
  }
}

export function clearGoogleSession() {
  clearSession();
}

export async function requestGoogleAccessToken(): Promise<{ token: string; profile: GoogleUserProfile }> {
  saveUserSession("Editor", DEFAULT_EDITOR_USER);
  return {
    token: "mock_drive_token_" + Date.now(),
    profile: DEFAULT_EDITOR_USER,
  };
}

/**
 * Determine Google Drive Folder ID to use
 */
export async function resolveGoogleDriveFolderId(token?: string): Promise<string | null> {
  // 1. Check if user configured a specific Folder ID in googleDriveConfig.ts
  if (
    GOOGLE_DRIVE_FOLDER_ID &&
    GOOGLE_DRIVE_FOLDER_ID.trim().length > 10 &&
    !GOOGLE_DRIVE_FOLDER_ID.includes("PEGA_AQUI") &&
    !GOOGLE_DRIVE_FOLDER_ID.includes("TU_CARPETA_AQUI") &&
    !GOOGLE_DRIVE_FOLDER_ID.includes("APEX_DRIVE")
  ) {
    return GOOGLE_DRIVE_FOLDER_ID.trim();
  }

  // 2. If token exists, search or create the default folder in Drive
  if (token && !token.startsWith("demo_") && !token.startsWith("mock_")) {
    try {
      const folderName = GOOGLE_DRIVE_FOLDER_NAME || "Historial_Dashboard_Agentes";
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`
        )}&fields=files(id,name)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }

      // Create folder if not found
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      const createData = await createRes.json();
      return createData.id || null;
    } catch (e) {
      console.warn("Could not resolve Google Drive folder:", e);
    }
  }

  return null;
}

/**
 * Retrieve local history from localStorage
 */
export function getLocalHistory(): SavedAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const list: SavedAnalysisRecord[] = JSON.parse(raw);
    return list.map((item) => ({
      ...item,
      name: sanitizeEvaluationFileName(item.name),
    }));
  } catch (e) {
    console.error("Error reading local history:", e);
    return [];
  }
}

export function saveLocalHistory(list: SavedAnalysisRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Error saving local history:", e);
  }
}

/**
 * Sync & Fetch all analysis JSON files from Google Drive
 */
export async function fetchAnalysesFromGoogleDrive(token?: string | null): Promise<SavedAnalysisRecord[]> {
  const activeToken = token || cachedAccessToken;

  if (activeToken && !activeToken.startsWith("demo_") && !activeToken.startsWith("mock_")) {
    try {
      const folderId = await resolveGoogleDriveFolderId(activeToken);

      const queryParts = ["trashed=false", "(mimeType='application/json' or name contains '.json')"];
      if (folderId) {
        queryParts.push(`'${folderId}' in parents`);
      }

      const query = encodeURIComponent(queryParts.join(" and "));
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,modifiedTime,properties,description)&orderBy=modifiedTime desc`,
        {
          headers: { Authorization: `Bearer ${activeToken}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const driveFiles = data.files || [];
        const results: SavedAnalysisRecord[] = [];

        for (const file of driveFiles) {
          try {
            const fileContentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
              headers: { Authorization: `Bearer ${activeToken}` },
            });
            if (fileContentRes.ok) {
              const jsonContent: SavedAnalysisRecord = await fileContentRes.json();
              if (jsonContent && Array.isArray(jsonContent.records)) {
                jsonContent.driveFileId = file.id;
                jsonContent.id = jsonContent.id || file.id;
                jsonContent.name = sanitizeEvaluationFileName(jsonContent.name);
                results.push(jsonContent);
              }
            }
          } catch (err) {
            console.warn(`Could not read Drive file ${file.name}:`, err);
          }
        }

        if (results.length > 0) {
          saveLocalHistory(results);
          return results;
        }
      }
    } catch (err) {
      console.error("Error fetching from Google Drive:", err);
    }
  }

  // Always return clean local history
  return getLocalHistory();
}

/**
 * Upload / Save a new Analysis file into Google Drive & Local Storage
 */
export async function saveAnalysisToGoogleDrive(
  analysisData: Omit<SavedAnalysisRecord, "id" | "createdAt" | "createdAtFormatted" | "updatedAt" | "updatedAtFormatted"> & {
    id?: string;
  },
  token?: string | null
): Promise<SavedAnalysisRecord> {
  const timeInfo = formatDateTime(new Date());
  const newId = analysisData.id || "analysis_" + Date.now();

  const cleanName = sanitizeEvaluationFileName(analysisData.name);

  const recordToSave: SavedAnalysisRecord = {
    ...analysisData,
    name: cleanName,
    id: newId,
    createdAt: timeInfo.iso,
    createdAtFormatted: timeInfo.formatted,
    updatedAt: timeInfo.iso,
    updatedAtFormatted: timeInfo.formatted,
  };

  const activeToken = token || cachedAccessToken;

  if (activeToken && !activeToken.startsWith("demo_") && !activeToken.startsWith("mock_")) {
    try {
      const folderId = await resolveGoogleDriveFolderId(activeToken);
      const fileName = `analisis_${recordToSave.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.json`;

      const metadata = {
        name: fileName,
        mimeType: "application/json",
        parents: folderId ? [folderId] : undefined,
        description: `Reporte de Capacitación: ${recordToSave.name} (${recordToSave.totalAgents} agentes, ${recordToSave.passRate}% aprobados)`,
      };

      const multipartRequestBody =
        `--boundary_trainer\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--boundary_trainer\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${JSON.stringify(recordToSave, null, 2)}\r\n` +
        `--boundary_trainer--`;

      const driveRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "multipart/related; boundary=boundary_trainer",
        },
        body: multipartRequestBody,
      });

      if (driveRes.ok) {
        const driveFileData = await driveRes.json();
        recordToSave.driveFileId = driveFileData.id;
      }
    } catch (driveErr) {
      console.warn("Could not save to Google Drive, saved to local store:", driveErr);
    }
  }

  // Always update local history
  const currentList = getLocalHistory();
  const updatedList = [recordToSave, ...currentList.filter((item) => item.id !== recordToSave.id)];
  saveLocalHistory(updatedList);

  return recordToSave;
}

/**
 * Replace / Overwrite an existing Analysis in Google Drive & Local Storage
 */
export async function updateAnalysisInGoogleDrive(
  existingId: string,
  updatedData: Partial<SavedAnalysisRecord>,
  token?: string | null
): Promise<SavedAnalysisRecord> {
  const currentList = getLocalHistory();
  const existing = currentList.find((item) => item.id === existingId || item.driveFileId === existingId);

  const timeInfo = formatDateTime(new Date());

  const mergedRecord: SavedAnalysisRecord = {
    ...(existing || {
      id: existingId,
      name: "Análisis Actualizado",
      createdAt: timeInfo.iso,
      createdAtFormatted: timeInfo.formatted,
      totalAgents: 0,
      approvedCount: 0,
      failedCount: 0,
      passRate: 0,
      averageScore: 0,
      trainingTopic: "Capacitación",
      trainer: "Trainer",
      records: [],
    }),
    ...updatedData,
    name: sanitizeEvaluationFileName(updatedData.name || existing?.name || "Análisis Actualizado"),
    updatedAt: timeInfo.iso,
    updatedAtFormatted: timeInfo.formatted,
  };

  const activeToken = token || cachedAccessToken;
  const driveFileId = mergedRecord.driveFileId || (existing && existing.driveFileId);

  if (activeToken && driveFileId && !activeToken.startsWith("demo_")) {
    try {
      // Overwrite file content via PATCH
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mergedRecord, null, 2),
      });
    } catch (e) {
      console.warn("Error overwriting in Google Drive, updated locally:", e);
    }
  }

  // Update local storage
  const updatedList = currentList.map((item) =>
    item.id === existingId || (driveFileId && item.driveFileId === driveFileId) ? mergedRecord : item
  );
  saveLocalHistory(updatedList);

  return mergedRecord;
}

/**
 * Delete an analysis record permanently from Google Drive & Local Storage
 */
export async function deleteAnalysis(id: string, token?: string | null): Promise<SavedAnalysisRecord[]> {
  const currentList = getLocalHistory();
  const target = currentList.find((item) => item.id === id || item.driveFileId === id);

  const activeToken = token || cachedAccessToken;
  const targetDriveFileId = target?.driveFileId || (id && id.length > 20 && !id.startsWith("analysis_") && !id.startsWith("demo_") ? id : null);

  if (activeToken && targetDriveFileId && !activeToken.startsWith("demo_") && !activeToken.startsWith("mock_")) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${targetDriveFileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok && res.status !== 404) {
        console.warn(`Drive delete response: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      console.warn("Could not delete file from Google Drive:", e);
    }
  }

  const updatedList = currentList.filter(
    (item) => item.id !== id && item.driveFileId !== id && (!targetDriveFileId || item.driveFileId !== targetDriveFileId)
  );
  saveLocalHistory(updatedList);
  return updatedList;
}
