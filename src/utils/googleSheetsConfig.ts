// =========================================================================
// 📊 CONFIGURACIÓN DE GOOGLE SHEETS (BASE DE DATOS CENTRALIZADA)
// =========================================================================
// Pega aquí el enlace público de tu Google Sheet (compartido como "Cualquier persona con el enlace puede ver"):
// Ejemplo: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing
// o simplemente el ID largo del documento.
// =========================================================================

// 👇 1. PEGA AQUÍ EL ENLACE DE TU PLANILLA DE GOOGLE SHEETS
export const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1fseOST7N6hEgdBA2PGkSekoCuang7ERhI-HLs4u-hbg/edit";

// 👇 WEBHOOK GOOGLE APPS SCRIPT PARA ESCRITURA/ACTUALIZACIÓN DE CONTRASEÑAS (SHA-256)
export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyW1JMj29FRObZFPORlSbbfSAOT-IPDxFuCHXEucEJ0ubUpGz7GKpD-fwQRecvRLN8a/exec";

// 👇 2. NOTA MÍNIMA DE APROBACIÓN POR DEFECTO (80 puntos o 80%)
export const DEFAULT_PASSING_SCORE = 80;

// 👇 3. PESTAÑAS / HOJAS DE EJEMPLO O CONOCIDAS
// Si la planilla tiene pestañas con nombres de tests, la app las detectará automáticamente.
// Puedes agregar aquí los nombres de tus hojas como referencia inicial:
export const KNOWN_SHEET_TABS = [
  "CD2633 Genesys Cloud - 19/08/2026",
  "Capacitación Calidad Ventas - 18/08/2026",
  "Onboarding Atención al Cliente - 15/08/2026",
  "Resolución en Primer Contacto (FCR) - 10/08/2026"
];
