import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  processCourseAndAgentIdsBackend,
  BackendProcessRequest,
  BackendProcessResponse,
} from "./src/server/courseProcessor";

dotenv.config();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set. AI extraction will fallback to heuristic parsing.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with generous limit for base64 documents/images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Dedicated Backend Function / Endpoint:
  // Receives the two files (Course Sheet + Agent IDs List), compares 'Usuario' vs Agent IDs,
  // discards non-matching rows, extracts scores from columns R to U (80, 90, 100 approved),
  // and returns the clean filtered data for the dashboard.
  app.post("/api/cross-reference-course", (req: Request, res: Response) => {
    try {
      const {
        agentsFile,
        testResultsFile,
        courseFile,
        agentsText,
        testResultsText,
        courseText,
        passingScoreThreshold = 80,
        trainingTopic,
        trainer,
      } = req.body;

      const result: BackendProcessResponse = processCourseAndAgentIdsBackend({
        agentsFile,
        testResultsFile,
        courseFile,
        agentsText,
        testResultsText,
        courseText,
        passingScoreThreshold,
        trainingTopic,
        trainer,
      });

      return res.json(result);
    } catch (error: any) {
      console.error("Error in /api/cross-reference-course:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Error al procesar y comparar la planilla del curso con los IDs de agentes.",
      });
    }
  });

  // API Endpoint: Analyze Training Document / Excel / Image / Text with Gemini & Backend Verification
  app.post("/api/analyze-training", async (req: Request, res: Response) => {
    let backendProcessedResult: BackendProcessResponse | null = null;
    try {
      const {
        // Multi-file support: File 1 (Lista de Asesores) and File 2 (Resultados del Test)
        agentsFile,
        testResultsFile,
        courseFile,
        // Legacy single-file or text fields
        fileData,
        mimeType,
        fileName,
        rawText,
        agentsText,
        testResultsText,
        courseText,
        passingScoreThreshold = 80,
        customPromptContext = "",
        trainingTopic,
        trainer,
      } = req.body;

      // First run deterministic backend filtering if files or text are available
      const coursePayload = courseFile || testResultsFile;
      const agentsPayload = agentsFile;

      if (agentsPayload || agentsText || coursePayload || courseText || testResultsText) {
        try {
          backendProcessedResult = processCourseAndAgentIdsBackend({
            agentsFile: agentsPayload,
            testResultsFile: coursePayload,
            agentsText,
            testResultsText: courseText || testResultsText,
            passingScoreThreshold,
            trainingTopic,
            trainer,
          });
        } catch (procErr) {
          console.warn("Backend processor warning:", procErr);
        }
      }

      const ai = getGeminiClient();
      const batchId = "batch_" + Date.now();

      // If AI client is not available, return the deterministic filtered results directly
      if (!ai) {
        if (backendProcessedResult && backendProcessedResult.records.length > 0) {
          return res.json(backendProcessedResult);
        }
        return res.status(500).json({
          success: false,
          error: "GEMINI_API_KEY is not configured and no tabular data could be extracted.",
        });
      }

      const systemInstruction = `
Eres un analista experto en Capacitación, Recursos Humanos, Control de Calidad y Cruce de Datos para Contact Centers y Empresas Operativas.
Tu tarea principal es cruzar y analizar la información proveniente de dos fuentes:
1. "LISTA DE ASESORES / NÓMINA DE AGENTES" (identificada como "lista_agente", "nomina", "asesores", "usuarios", etc.): Fuente maestra oficial que contiene la totalidad de asesores a evaluar.
   - ESTRUCTURA DE LA LISTA DE AGENTES / ARCHIVO CSV (sin encabezados): Cada fila tiene la estructura 'ID_USUARIO,Nombre del Supervisor' (por ejemplo: U616446,"Aguirre, Maria José").
   - La primera columna es el ID del usuario (ej: U616446) y la segunda columna es el NOMBRE DEL SUPERVISOR asignado (ej: "Aguirre, Maria José").
   - DEBES ASIGNAR SIEMPRE el nombre del supervisor al campo 'supervisor' de cada agente.
   - Normaliza el ID de usuario a minúsculas en el cruce para asociar correctamente cada agente con su supervisor y con la planilla de resultados.
2. "RESULTADOS DEL TEST / EVALUACIONES": Planilla o documento con los resultados de las evaluaciones y exámenes.

REGLAS CRÍTICAS DE FILTRADO Y CRUCE (MANDATORIO):
- FILTRADO EXCLUSIVO POR NOMBRES DE USUARIO DE LA LISTA: Debes tomar ÚNICAMENTE en cuenta los nombres de usuario / asesores que te fueron pasados en la lista de agentes ("lista_agente").
- DESESTIMAR Y DESCARTAR TODO LO DEMÁS: Si en el archivo de "Resultados del Test" aparecen personas, nombres de usuario o exámenes de agentes que NO están en la lista de agentes, DEBES DESESTIMARLOS Y DESCARTARLOS POR COMPLETO. NO incluyas a nadie ajeno a la lista.
- UBICACIÓN DE RESULTADOS EN COLUMNAS "R" A LA "U": En el archivo/planilla de "Resultados del Test", las calificaciones, notas, respuestas, puntajes, estados y feedback de evaluación principal se encuentran ubicados en las COLUMNAS "R" a la "U" (columnas R, S, T, U / columnas 18 a 21 en Excel). Extrae de allí las notas (score), aprobación y observaciones para cada usuario de la lista.
- REGLA DE RECUPERATORIOS (COLUMNAS "V" Y "W"): Si un agente tiene una nota menor a 80 en la evaluación principal (o no aprobó), DEBES REVISAR LAS COLUMNAS "V" Y "W" (instancias de recuperatorio / segunda y tercera oportunidad). Si el agente alcanzó o superó los 80 puntos (80, 90 o 100) en la columna V o en la columna W, su estado DEBE PASAR A 'Aprobado', con 'passedInRetake': true, 'retakeScore': nota_obtenida, 'initialScore': nota_inicial_menor_a_80, y feedback indicando "Aprobado en Recuperatorio (Columna V/W)".
- REGLA DE APROBACIÓN (80, 90 o 100): Los usuarios que tengan un resultado de 80, 90 o 100 en las columnas R a la U (o que hayan aprobado en los recuperatorios de las columnas V o W) están clasificados como 'Aprobado'. Si el puntaje final es menor a 80 en todas las instancias, se clasifica como 'No Aprobado'.
- TOTALIDAD DE LA LISTA DE AGENTES: El array 'records' debe contener a TODOS los agentes de la lista. Si un asesor de la lista no rindió el test (no tiene datos en las columnas R-U ni V-W), manténlo con score null o 0, status 'Pendiente', y en feedback: "No registra presentación en el test / examen".

REGLAS DE CRUCE Y ASIGNACIÓN:
- Realiza un cruce inteligente entre cada asesor/nombre de usuario de la lista completa ("lista_agente") y los resultados de las columnas R a U (y recuperatorios V, W) del test normalizando los IDs a minúsculas.
- Para cada asesor de la lista completa, unifica sus datos demográficos con su nota de evaluación, feedback y supervisor asignado.
- Calcula con exactitud para cada asesor de la lista:
  1. 'agentName': Nombre completo / nombre de usuario normalizado del asesor tal como figura en la lista.
  2. 'agentId': DNI / Legajo / Código / Username de empleado.
  3. 'supervisor': Nombre del supervisor obtenido de la segunda columna del archivo de agentes.
  4. 'campaign': Campaña, servicio o área operativa.
  5. 'trainingName': Nombre del curso / módulo / evaluación analizada.
  6. 'trainerName': Instructor / Capacitador a cargo.
  7. 'completionDate': Fecha de finalización (formato YYYY-MM-DD).
  8. 'score': Calificación numérica final (escala 0 a 100). Si aprobó en recuperatorio, colocar la nota del recuperatorio (≥80).
  9. 'minPassingScore': 80 (o ${passingScoreThreshold}).
  10. 'status': 'Aprobado', 'No Aprobado', 'Pendiente', 'En Curso' o 'Condicional'.
      - Es 'Aprobado' si el resultado en las columnas R-U es >= 80, O si obtuvo >= 80 en los recuperatorios de las columnas V o W.
      - Es 'No Aprobado' si no alcanzó 80 en ninguna instancia.
      - Es 'Pendiente' si el asesor de la lista no rindió el test.
  11. 'passedInRetake': true si aprobó gracias a la columna V o W (recuperatorio).
  12. 'initialScore': Nota inicial de la evaluación principal antes de recuperatorio (si aplica).
  13. 'retakeScore': Nota obtenida en el recuperatorio (si aplica).
  14. 'retakeDetails': Texto explicativo, ej. 'Aprobado en Recuperatorio (Columna V: 85 pts)'.
  15. 'attendancePercentage': Porcentaje de asistencia (0-100).
  16. 'feedback': Comentario integrador del desempeño. Si aprobó en recuperatorio, especificarlo explícitamente.
  17. 'skillsAcquired': Lista de competencias validadas.
  18. 'needsRetraining': true si el agente no aprobó (score final < 80).

Además, genera:
- 'trainingTopic': El tema central del test y la capacitación.
- 'trainer': El nombre principal del instructor o área capacitadora.
- 'aiSummary': Resumen ejecutivo en español detallando: total de asesores de la lista oficial evaluados ('lista_agente'), cuántos obtuvieron 80, 90 o 100 (aprobados), cuántos no aprobaron (< 80), cuántos están pendientes, nota promedio y confirmación de que se descartaron los registros externos ajenos a la lista.
- 'aiRecommendations': 3 a 5 recomendaciones puntuales y accionables para el trainer (planes de refuerzo para no aprobados con notas menores a 80, preguntas críticas del test a repasar, etc.).
- 'strengths': 2 a 4 fortalezas observadas en las respuestas del grupo evaluado.
- 'improvementAreas': 2 a 4 temas débiles o preguntas con mayor índice de error en el test.
`;

      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      // 1. If agents file is provided
      if (agentsFile && agentsFile.data) {
        parts.push({
          inlineData: {
            data: agentsFile.data,
            mimeType: agentsFile.mimeType || "application/octet-stream",
          },
        });
      }

      // 2. If test results file is provided
      if (testResultsFile && testResultsFile.data) {
        parts.push({
          inlineData: {
            data: testResultsFile.data,
            mimeType: testResultsFile.mimeType || "application/octet-stream",
          },
        });
      }

      // 3. Fallback for single file upload
      if (!agentsFile && !testResultsFile && fileData && mimeType) {
        parts.push({
          inlineData: {
            data: fileData,
            mimeType: mimeType,
          },
        });
      }

      let promptText = `ANÁLISIS Y CRUCE DE CAPACITACIÓN:\n`;

      if (agentsFile?.fileName) {
        promptText += `- Archivo 1 (Lista de Asesores / Nómina): "${agentsFile.fileName}"\n`;
      }
      if (testResultsFile?.fileName) {
        promptText += `- Archivo 2 (Resultados del Test / Examen): "${testResultsFile.fileName}"\n`;
      }
      if (fileName && !agentsFile && !testResultsFile) {
        promptText += `- Archivo consolidado: "${fileName}"\n`;
      }

      if (agentsText) {
        promptText += `\n[LISTA DE ASESORES / NÓMINA (TEXTO)]:\n${agentsText}\n`;
      }
      if (testResultsText) {
        promptText += `\n[RESULTADOS DEL TEST / EXAMEN (TEXTO)]:\n${testResultsText}\n`;
      }
      if (rawText && !agentsText && !testResultsText) {
        promptText += `\n[DATOS BRUTOS]:\n${rawText}\n`;
      }

      if (customPromptContext) {
        promptText += `\nInstrucciones adicionales del usuario: ${customPromptContext}\n`;
      }

      promptText += `\nNota mínima requerida para aprobar el test: ${passingScoreThreshold}/100.
REGLA MANDATORIA DE SALIDA Y FILTRADO:
1. Toma ÚNICAMENTE en cuenta los nombres de usuario / asesores que están en la lista de agentes ("lista_agente" / Archivo 1).
2. En el archivo/datos de "Resultados del Test", las calificaciones, notas, respuestas y resultados se encuentran en las columnas "R" a la "U" (columnas R, S, T, U / 18 a 21). Extrae las notas y feedbacks de esas columnas para cada usuario de la lista.
3. REGLA DE APROBACIÓN: Los usuarios que tengan un resultado de 80, 90 o 100 en las columnas R a la U están APROBADOS (status: 'Aprobado'). Si su nota es menor a 80 (e.g. 70, 60, etc.) su status es 'No Aprobado'. Si no rindieron el test, status: 'Pendiente'.
4. Descarta y desestima por completo cualquier usuario o fila del test que no pertenezca a la lista de agentes.
5. Devuelve en 'records' exactamente a todos los agentes de la lista oficial (con sus datos emparejados de las columnas R-U o como pendientes si no tienen test). Devuelve el JSON estructurado.`;

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              trainingTopic: { type: Type.STRING },
              trainer: { type: Type.STRING },
              defaultPassingScore: { type: Type.NUMBER },
              aiSummary: { type: Type.STRING },
              aiRecommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              improvementAreas: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              records: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agentName: { type: Type.STRING },
                    agentId: { type: Type.STRING },
                    campaign: { type: Type.STRING },
                    supervisor: { type: Type.STRING },
                    trainingName: { type: Type.STRING },
                    trainerName: { type: Type.STRING },
                    completionDate: { type: Type.STRING },
                    score: { type: Type.NUMBER },
                    minPassingScore: { type: Type.NUMBER },
                    status: {
                      type: Type.STRING,
                      enum: ["Aprobado", "No Aprobado", "En Curso", "Pendiente", "Condicional"],
                    },
                    attendancePercentage: { type: Type.NUMBER },
                    feedback: { type: Type.STRING },
                    passedInRetake: { type: Type.BOOLEAN },
                    initialScore: { type: Type.NUMBER },
                    retakeScore: { type: Type.NUMBER },
                    retakeDetails: { type: Type.STRING },
                    skillsAcquired: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    needsRetraining: { type: Type.BOOLEAN },
                  },
                  required: ["agentName", "trainingName", "trainerName", "status"],
                },
              },
            },
            required: ["trainingTopic", "records", "aiSummary", "aiRecommendations"],
          },
        },
      });

      const responseText = response.text?.trim();
      if (!responseText) {
        throw new Error("No se recibió respuesta estructurada del modelo.");
      }

      const parsedData = JSON.parse(responseText);
      const combinedSource = [agentsFile?.fileName, testResultsFile?.fileName].filter(Boolean).join(" + ") || fileName || "Cruce de 2 Archivos";

      // Hydrate records with unique IDs and batch metadata
      const recordsWithIds = (parsedData.records || []).map((rec: any, idx: number) => {
        const rIdLower = String(rec.agentId || rec.agentName || "").toLowerCase().trim();
        const rIdWithoutU = rIdLower.replace(/^u/, "");

        // Find corresponding backend match to ensure supervisor is never lost
        const backendMatch = backendProcessedResult?.records.find((b: any) => {
          const bId = String(b.agentId || "").toLowerCase().trim();
          const bIdWithoutU = bId.replace(/^u/, "");
          const bName = String(b.agentName || "").toLowerCase().trim();
          return (
            bId === rIdLower ||
            (bIdWithoutU.length > 3 && bIdWithoutU === rIdWithoutU) ||
            bName === rIdLower ||
            (rIdLower.length > 4 && bName.includes(rIdLower))
          );
        });

        const supervisor = rec.supervisor || backendMatch?.supervisor || undefined;

        return {
          id: `agent_${batchId}_${idx + 1}`,
          agentName: rec.agentName || backendMatch?.agentName || `Agente ${idx + 1}`,
          agentId: rec.agentId || backendMatch?.agentId || `AG-${1000 + idx}`,
          campaign: rec.campaign || backendMatch?.campaign || "General",
          supervisor,
          trainingName: rec.trainingName || parsedData.trainingTopic || "Capacitación Operativa",
          trainerName: rec.trainerName || parsedData.trainer || "Instructor Asignado",
          completionDate: rec.completionDate || new Date().toISOString().split("T")[0],
          score: typeof rec.score === "number" ? Math.round(rec.score) : (backendMatch?.score ?? null),
          minPassingScore: rec.minPassingScore || passingScoreThreshold,
          status: rec.status || (rec.score && rec.score >= passingScoreThreshold ? "Aprobado" : (backendMatch?.status || "No Aprobado")),
          passedInRetake: !!rec.passedInRetake || !!backendMatch?.passedInRetake,
          initialScore: typeof rec.initialScore === "number" ? rec.initialScore : backendMatch?.initialScore,
          retakeScore: typeof rec.retakeScore === "number" ? rec.retakeScore : backendMatch?.retakeScore,
          retakeDetails: rec.retakeDetails || (rec.passedInRetake ? "Aprobado en Recuperatorio" : backendMatch?.retakeDetails),
          attendancePercentage: typeof rec.attendancePercentage === "number" ? Math.min(100, Math.max(0, rec.attendancePercentage)) : 100,
          feedback: rec.feedback || backendMatch?.feedback || "Evaluación y cruce de notas registrado.",
          skillsAcquired: rec.skillsAcquired || ["Conocimientos Básicos"],
          needsRetraining: rec.needsRetraining !== undefined ? rec.needsRetraining : rec.status !== "Aprobado",
          batchId,
          sourceFileName: combinedSource,
        };
      });

      return res.json({
        success: true,
        batchId,
        trainingTopic: parsedData.trainingTopic || "Capacitación General",
        trainer: parsedData.trainer || "Instructor",
        defaultPassingScore: parsedData.defaultPassingScore || passingScoreThreshold,
        aiSummary: parsedData.aiSummary || "Análisis y cruce de archivos completado exitosamente.",
        aiRecommendations: parsedData.aiRecommendations || [],
        strengths: parsedData.strengths || [],
        improvementAreas: parsedData.improvementAreas || [],
        records: recordsWithIds,
      });
    } catch (error: any) {
      console.error("Error analyzing training files:", error);
      if (backendProcessedResult && backendProcessedResult.records.length > 0) {
        return res.json(backendProcessedResult);
      }
      return res.status(500).json({
        success: false,
        error: error.message || "Error al procesar y cruzar los archivos con IA.",
      });
    }
  });

  // API Endpoint: Generate Custom AI Action Plan & Retraining Strategy
  app.post("/api/generate-insights", async (req: Request, res: Response) => {
    try {
      const { records, trainingTopic } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.status(500).json({ success: false, error: "GEMINI_API_KEY no configurado" });
      }

      const total = records.length;
      const approved = records.filter((r: any) => r.status === "Aprobado").length;
      const failed = total - approved;
      const avgScore = Math.round(records.reduce((acc: number, r: any) => acc + (r.score || 0), 0) / (total || 1));

      const prompt = `
Analiza la siguiente cohorte de agentes para la capacitación "${trainingTopic || "Trainer General"}":
- Total de agentes evaluados: ${total}
- Aprobados: ${approved} (${Math.round((approved / (total || 1)) * 100)}%)
- No aprobados / En riesgo: ${failed}
- Calificación promedio: ${avgScore}/100

Detalle de agentes no aprobados o con observaciones:
${JSON.stringify(records.filter((r: any) => r.status !== "Aprobado" || (r.score && r.score < 75)).slice(0, 20), null, 2)}

Por favor genera:
1. Plan de acción de re-entrenamiento paso a paso para los agentes que no aprobaron.
2. Recomendaciones pedagógicas para los Trainers para mejorar la retención de conceptos.
3. Indicadores de alerta temprana para futuras capacitaciones.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction: "Eres un consultor líder en formación corporativa, QA y Trainers para Contact Centers.",
        },
      });

      res.json({
        success: true,
        insights: response.text,
      });
    } catch (err: any) {
      console.error("Error generating insights:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
