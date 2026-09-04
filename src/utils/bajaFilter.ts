/**
 * Utilidad centralizada para filtrado estricto de asesores dados de baja
 * o identificados con color de fondo rojo/rosado en la base de datos de origen.
 */

/**
 * Detecta si un color en cualquier formato (hexadecimal, rgb, hsl o nombre)
 * corresponde a tonalidades de rojo o rosado (por ejemplo, filas de bajas en planillas).
 */
export function isRedOrPinkColor(color: unknown): boolean {
  if (!color) return false;

  // Si es un objeto de color (ej. Google Sheets API v4: { red: 0.9, green: 0.4, blue: 0.4 })
  if (typeof color === "object" && color !== null) {
    const obj = color as Record<string, any>;
    if ("red" in obj || "r" in obj) {
      const rawR = obj.red ?? obj.r ?? 0;
      const rawG = obj.green ?? obj.g ?? 0;
      const rawB = obj.blue ?? obj.b ?? 0;
      const r = rawR <= 1 && rawR > 0 ? rawR * 255 : rawR;
      const g = rawG <= 1 && rawG > 0 ? rawG * 255 : rawG;
      const b = rawB <= 1 && rawB > 0 ? rawB * 255 : rawB;

      // Predominancia roja o tonalidad rosada
      if (r >= 150 && r > g * 1.15 && (r > b * 1.15 || (b >= 100 && r > g * 1.15))) {
        return true;
      }
    }
    // Si viene como { rgb: "FFFF0000" } de Excel SheetJS
    if ("rgb" in obj && typeof obj.rgb === "string") {
      return isRedOrPinkColor(obj.rgb);
    }
    if ("fgColor" in obj) return isRedOrPinkColor(obj.fgColor);
    if ("bgColor" in obj) return isRedOrPinkColor(obj.bgColor);
  }

  const str = String(color).trim().toLowerCase();
  if (!str) return false;

  // Nombres comunes de color rojo / rosado (comparación exacta para evitar falsos positivos)
  const RED_PINK_NAMES = [
    "red", "rojo", "pink", "rosado", "rosa", "lightcoral", "crimson",
    "salmon", "darksalmon", "lightpink", "hotpink", "deeppink",
    "palevioletred", "coral", "indianred", "firebrick", "rose",
    "danger", "danger-red", "soft-red", "light-red", "pastel-red"
  ];
  if (RED_PINK_NAMES.includes(str)) {
    return true;
  }

  // Hexadecimal (#RRGGBB, #RGB, #AARRGGBB) - REQUIERE que comience con '#'
  if (str.startsWith("#")) {
    const hexMatch = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      // Si es ARGB de 8 caracteres (ej. FFF87171), descartar canal alfa inicial si no es relevante
      if (hex.length === 8) {
        hex = hex.slice(2);
      }
      let r = 0;
      let g = 0;
      let b = 0;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }

      // 1. Rojo intenso o estándar (ej. #ea4335, #ef4444, #dc2626, #b91c1c, #d32f2f)
      if (r >= 150 && r > g * 1.25 && r > b * 1.25) {
        return true;
      }
      // 2. Rosado / pastel suave (ej. #fca5a5, #fecaca, #fee2e2, #fda4af, #fb7185, #f8d7da, #f4c7c3, #ffcdd2, #ffebee)
      if (r >= 180 && r >= g + 15 && (r >= b + 15 || (b >= 130 && r >= g + 18))) {
        return true;
      }
    }
  }

  // Formato rgb(r, g, b) o rgba(r, g, b, a)
  const rgbMatch = str.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (r >= 150 && r > g * 1.25 && r > b * 1.25) return true;
    if (r >= 180 && r >= g + 15 && (r >= b + 15 || (b >= 130 && r >= g + 18))) return true;
  }

  return false;
}

/**
 * Detecta si una cadena o valor representa un error de fórmula Excel/Google Sheets,
 * valor no disponible (#N/A, #N/D), nulo, indefinido, vacío o no válido.
 */
export function isInvalidOrBrokenValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  const str = String(val).trim();
  if (str === "") return true;
  const lower = str.toLowerCase();

  // Detección estricta de #N/A y variantes de error de búsqueda no disponible
  if (
    lower.includes("#n/a") ||
    lower.includes("#n/d") ||
    lower === "#n/a" ||
    lower === "n/a" ||
    lower === "#n/d" ||
    lower === "n/d"
  ) {
    return true;
  }

  // Detección de errores típicos de fórmulas rotas en Excel y Google Sheets
  if (
    lower.includes("#ref!") ||
    lower.includes("#value!") ||
    lower.includes("#valor!") ||
    lower.includes("#name?") ||
    lower.includes("#nombre?") ||
    lower.includes("#div/0!") ||
    lower.includes("#null!") ||
    lower.includes("#num!") ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "nan"
  ) {
    return true;
  }

  return false;
}

/**
 * Valida si un nombre de entidad (JCC, Supervisor, Agente) es válido y no roto.
 */
export function isValidEntityName(name: unknown): boolean {
  if (name === null || name === undefined) return false;
  const str = String(name).trim();
  if (str === "" || str === "-" || str === "--") return false;
  return !isInvalidOrBrokenValue(str);
}

/**
 * Expresión regular para detectar términos de baja, desvinculación o inactividad
 */
export const BAJA_KEYWORDS_REGEX = /\b(baja|de\s*baja|baja\s*laboral|desvinculad[oa]s?|inactiv[oa]s?|egresad[oa]s?|dado\s*de\s*baja|baja\s*definitiva|baja\s*medica)\b/i;

/**
 * Valida de forma estricta si un registro, objeto o fila de datos corresponde
 * a un asesor dado de baja confirmada o pintado de rojo/rosado.
 */
export function isBajaRecord(recordOrRow: any): boolean {
  if (!recordOrRow) return false;

  // 1. Validación de array crudo de celdas (filas de CSV o matriz Excel)
  if (Array.isArray(recordOrRow)) {
    for (const cell of recordOrRow) {
      if (cell === null || cell === undefined) continue;

      // Si la celda contiene un objeto con estilo/color de fondo
      if (typeof cell === "object") {
        const bg = cell.backgroundColor || cell.bgColor || cell.color || cell.fillColor || cell.s?.fill?.fgColor;
        if (isRedOrPinkColor(bg)) return true;
        if (cell.isBaja === true || cell.baja === true) return true;
      }

      // Si es un valor de texto explícito de estado de baja
      if (typeof cell === "string") {
        const str = cell.trim();
        if (str && str.length <= 35 && BAJA_KEYWORDS_REGEX.test(str)) {
          return true;
        }
      }
    }
    return false;
  }

  // 2. Validación de propiedades directas booleanas o flags de baja
  if (
    recordOrRow.isBaja === true ||
    recordOrRow.baja === true ||
    recordOrRow.esBaja === true ||
    recordOrRow.estadoBaja === true ||
    recordOrRow.isInactive === true ||
    recordOrRow.active === false ||
    recordOrRow.activo === false
  ) {
    return true;
  }

  // 3. Validación de color de fondo del registro
  const recordBg =
    recordOrRow.backgroundColor ||
    recordOrRow.bgColor ||
    recordOrRow.color ||
    recordOrRow.background ||
    recordOrRow.fillColor ||
    recordOrRow.rowColor ||
    recordOrRow.cellColor ||
    recordOrRow.colorFondo ||
    recordOrRow.fondo ||
    recordOrRow.style?.backgroundColor ||
    recordOrRow.style?.background ||
    recordOrRow.style?.fill;

  if (isRedOrPinkColor(recordBg)) {
    return true;
  }

  // 4. Validación de campos de situación laboral/baja (NO validar campos de texto general como nombres, notas o campañas)
  const fieldsToCheck = [
    recordOrRow.estadoLaboral,
    recordOrRow.situacionLaboral,
    recordOrRow.situacion,
    recordOrRow.condicionLaboral,
    recordOrRow.motivoBaja,
  ];

  for (const field of fieldsToCheck) {
    if (typeof field === "string" && field.trim()) {
      if (BAJA_KEYWORDS_REGEX.test(field.trim())) {
        return true;
      }
    }
  }

  // Si el campo status explícitamente dice 'Baja' o 'Inactivo' (no confundir con Aprobado, No Aprobado o Pendiente)
  if (typeof recordOrRow.status === "string") {
    const s = recordOrRow.status.trim().toLowerCase();
    if (s === "baja" || s === "inactivo" || s === "desvinculado") {
      return true;
    }
  }

  // 5. Si tiene celdas crudas asociadas con estilos de color
  if (recordOrRow._rawCells && Array.isArray(recordOrRow._rawCells)) {
    if (isBajaRecord(recordOrRow._rawCells)) return true;
  }

  return false;
}

/**
 * Valida si un registro corresponde a una baja confirmada.
 */
export function isBrokenOrBajaRecord(recordOrRow: any): boolean {
  if (!recordOrRow) return true;
  return isBajaRecord(recordOrRow);
}

/**
 * Filtra de forma estricta un arreglo de agentes u objetos, omitiendo
 * a todos aquellos identificados como bajas o con fondo rojo/rosado.
 */
export function filterActiveAgentsOnly<T>(records: T[]): T[] {
  if (!Array.isArray(records)) return [];
  return records.filter((r) => !isBajaRecord(r));
}
