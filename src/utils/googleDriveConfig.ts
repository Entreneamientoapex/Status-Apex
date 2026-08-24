/**
 * ============================================================================
 * 📁 CONFIGURACIÓN DE GOOGLE DRIVE Y AUTENTICACIÓN
 * ============================================================================
 *
 * 1. GOOGLE_DRIVE_FOLDER_ID:
 *    Pegá aquí el ID de la carpeta de Google Drive donde se guardarán y leerán
 *    todos los archivos JSON de análisis.
 *    (Cómo obtenerlo: Abrí tu carpeta en drive.google.com y copiá el código largo
 *    al final de la URL: https://drive.google.com/drive/folders/ESTE_ES_EL_ID)
 *
 * 2. EDITOR_CREDENTIALS:
 *    Usuario y contraseña fijos para habilitar el Modo Editor en el frontend.
 * ============================================================================
 */

// 👇 1. PEGA AQUÍ EL ID DE TU CARPETA DE GOOGLE DRIVE
export const GOOGLE_DRIVE_FOLDER_ID = "13kwDxxVhHSO-j_yKaKy-6YyvitoAd-XK";

// Nombre por defecto de la carpeta en Google Drive
export const GOOGLE_DRIVE_FOLDER_NAME = "Historial_Dashboard_Agentes";

// 👇 2. CREDENCIALES FIJAS PARA MODO EDITOR EN EL FRONTEND
export const EDITOR_CREDENTIALS = {
  username: "admin",      // Usuario para iniciar sesión como Editor
  password: "apex2026",   // Contraseña para iniciar sesión como Editor
};

// Roles disponibles en la aplicación
export type UserRole = "Editor" | "Lector";

export interface UserSession {
  username: string;
  role: UserRole;
  displayName: string;
  loggedAt: string;
}
