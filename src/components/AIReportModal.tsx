import React, { useState } from "react";
import {
  X,
  Brain,
  Sparkles,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { AgentRecord } from "../types";

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AgentRecord[];
  initialSummary?: string;
  initialRecommendations?: string[];
  topic?: string;
  trainer?: string;
}

export const AIReportModal: React.FC<AIReportModalProps> = ({
  isOpen,
  onClose,
  records,
  initialSummary,
  initialRecommendations,
  topic,
  trainer,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customInsights, setCustomInsights] = useState<string | null>(null);

  if (!isOpen) return null;

  const total = records.length;
  const approved = records.filter((r) => r.status === "Aprobado").length;
  const failed = records.filter((r) => r.status === "No Aprobado").length;
  const passRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const handleGenerateFreshPlan = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records,
          trainingTopic: topic || "Capacitación de Agentes",
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo generar el plan con IA");
      }

      const data = await response.json();
      setCustomInsights(data.insights);
    } catch (err: any) {
      alert("Error al conectar con IA: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-[#D9DED4] rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col text-[#2D332A] animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EAE3] flex items-center justify-between bg-[#F9F9F7]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#E6F3E6] text-[#4F7A4F] border border-[#C6DEC6] flex items-center justify-center">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[#2D332A] flex items-center gap-2">
                Informe Ejecutivo & Recomendaciones IA
              </h2>
              <p className="text-xs text-[#6B7366]">
                Análisis predictivo y plan de re-entrenamiento con Gemini
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 max-h-[78vh]">
          {/* Cohort Stats Banner */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-[#F9F9F7] rounded-xl border border-[#D9DED4] text-center">
            <div>
              <span className="text-[11px] text-[#6B7366] block">Agentes Evaluados</span>
              <span className="text-xl font-semibold text-[#2D332A]">{total}</span>
            </div>
            <div className="border-x border-[#D9DED4]">
              <span className="text-[11px] text-[#6B7366] block">Tasa de Aprobación</span>
              <span className="text-xl font-semibold text-[#4F7A4F]">{passRate}%</span>
            </div>
            <div>
              <span className="text-[11px] text-[#6B7366] block">Para Re-entrenamiento</span>
              <span className="text-xl font-semibold text-[#9E4A4A]">{failed}</span>
            </div>
          </div>

          {/* AI Executive Summary */}
          <div className="bg-[#E6F3E6]/40 border border-[#C6DEC6] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#4F7A4F] font-semibold text-sm">
              <Sparkles className="h-4 w-4 text-[#8DA189]" />
              <span>Diagnóstico General del Trainer</span>
            </div>
            <p className="text-xs sm:text-sm text-[#2D332A] leading-relaxed">
              {initialSummary ||
                `Se evaluó a un grupo de ${total} agentes en "${topic || "Capacitación Operativa"}" a cargo del trainer "${trainer || "Equipo de Formación"}". La tasa de éxito general se sitúa en ${passRate}%, con ${approved} agentes listos para la operación.`}
            </p>
          </div>

          {/* Recommendations List */}
          {initialRecommendations && initialRecommendations.length > 0 && (
            <div className="bg-[#F9F9F7] border border-[#D9DED4] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#2D332A] font-semibold text-sm">
                <Lightbulb className="h-4 w-4 text-[#8C733E]" />
                <span>Recomendaciones Estratégicas para el Trainer</span>
              </div>
              <ul className="space-y-2">
                {initialRecommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#2D332A]">
                    <span className="h-5 w-5 rounded-full bg-[#E6F3E6] text-[#4F7A4F] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-[#C6DEC6]">
                      {idx + 1}
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Plan for Non-Approved Agents */}
          {failed > 0 && (
            <div className="bg-[#FDF1F1]/50 border border-[#F0D5D5] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#9E4A4A] font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Hoja de Ruta para Agentes que No Aprobaron ({failed})</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-[#2D332A]">
                  Agentes a reprogramar:{" "}
                  <strong className="text-[#2D332A]">
                    {records
                      .filter((r) => r.status === "No Aprobado")
                      .map((r) => r.agentName)
                      .slice(0, 5)
                      .join(", ")}
                    {failed > 5 ? ` y ${failed - 5} más...` : ""}
                  </strong>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-[#F0D5D5] text-xs text-[#2D332A] space-y-1.5 shadow-xs">
                  <p>1. <strong>Taller de Nivelación:</strong> Sesión práctica de 2 horas con simulación en vivo.</p>
                  <p>2. <strong>Acompañamiento 1 a 1:</strong> Asignación de mentor o trainer senior.</p>
                  <p>3. <strong>Re-evaluación:</strong> Examen práctico de revalidación antes de salida a producción.</p>
                </div>
              </div>
            </div>
          )}

          {/* Custom Fresh AI Insights */}
          {customInsights && (
            <div className="bg-[#F9F9F7] border border-[#D9DED4] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#4F7A4F] font-semibold text-sm">
                <Sparkles className="h-4 w-4 text-[#8DA189]" />
                <span>Plan Personalizado Generado por Gemini</span>
              </div>
              <div className="text-xs sm:text-sm text-[#2D332A] whitespace-pre-line leading-relaxed">
                {customInsights}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F9F9F7] border-t border-[#E8EAE3] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-[#6B7366] hover:text-[#2D332A] rounded-xl hover:bg-[#E8EAE3] transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <button
            onClick={handleGenerateFreshPlan}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#8DA189] hover:bg-[#7D9179] text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando plan avanzado...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Profundizar Análisis con IA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
