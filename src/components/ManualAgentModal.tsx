import React, { useState, useEffect } from "react";
import { X, UserPlus, Edit, Save } from "lucide-react";
import { AgentRecord, ApprovalStatus } from "../types";

interface ManualAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Partial<AgentRecord>) => void;
  initialAgent?: AgentRecord | null;
}

export const ManualAgentModal: React.FC<ManualAgentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAgent,
}) => {
  const [formData, setFormData] = useState({
    agentName: "",
    agentId: "",
    campaign: "",
    supervisor: "",
    trainingName: "",
    trainerName: "",
    completionDate: new Date().toISOString().split("T")[0],
    score: 80,
    minPassingScore: 70,
    status: "Aprobado" as ApprovalStatus,
    attendancePercentage: 100,
    feedback: "",
    skillsString: "",
  });

  useEffect(() => {
    if (initialAgent) {
      setFormData({
        agentName: initialAgent.agentName,
        agentId: initialAgent.agentId || "",
        campaign: initialAgent.campaign || "",
        supervisor: initialAgent.supervisor || "",
        trainingName: initialAgent.trainingName,
        trainerName: initialAgent.trainerName,
        completionDate: initialAgent.completionDate || new Date().toISOString().split("T")[0],
        score: initialAgent.score ?? 70,
        minPassingScore: initialAgent.minPassingScore || 70,
        status: initialAgent.status,
        attendancePercentage: initialAgent.attendancePercentage ?? 100,
        feedback: initialAgent.feedback || "",
        skillsString: (initialAgent.skillsAcquired || []).join(", "),
      });
    } else {
      setFormData({
        agentName: "",
        agentId: "",
        campaign: "Atención al Cliente",
        supervisor: "",
        trainingName: "Capacitación de Calidad y Procesos",
        trainerName: "Trainer Asignado",
        completionDate: new Date().toISOString().split("T")[0],
        score: 85,
        minPassingScore: 70,
        status: "Aprobado",
        attendancePercentage: 100,
        feedback: "Desempeño satisfactorio durante la sesión y evaluación.",
        skillsString: "Calidad, Procesos, CRM",
      });
    }
  }, [initialAgent, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agentName.trim() || !formData.trainingName.trim()) {
      alert("Por favor completa al menos el nombre del agente y el curso.");
      return;
    }

    const skills = formData.skillsString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    onSave({
      id: initialAgent?.id,
      agentName: formData.agentName.trim(),
      agentId: formData.agentId.trim(),
      campaign: formData.campaign.trim(),
      supervisor: formData.supervisor.trim() || undefined,
      trainingName: formData.trainingName.trim(),
      trainerName: formData.trainerName.trim(),
      completionDate: formData.completionDate,
      score: Number(formData.score),
      minPassingScore: Number(formData.minPassingScore),
      status: formData.status,
      attendancePercentage: Number(formData.attendancePercentage),
      feedback: formData.feedback.trim(),
      skillsAcquired: skills,
      needsRetraining: formData.status !== "Aprobado" || Number(formData.score) < Number(formData.minPassingScore),
    });

    onClose();
  };

  const handleScoreChange = (newScore: number) => {
    setFormData((prev) => ({
      ...prev,
      score: newScore,
      status: newScore >= prev.minPassingScore ? "Aprobado" : "No Aprobado",
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-[#D9DED4] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col text-[#2D332A] animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E8EAE3] flex items-center justify-between bg-[#F9F9F7]">
          <div className="flex items-center gap-2 text-[#4F7A4F]">
            {initialAgent ? <Edit className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            <h2 className="text-base sm:text-lg font-semibold text-[#2D332A]">
              {initialAgent ? "Editar Registro de Agente" : "Registrar Agente en Capacitación"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#6B7366] hover:text-[#2D332A] p-1.5 rounded-lg hover:bg-[#F1F3EE] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 max-h-[80vh]">
          {/* Agent Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Nombre y Apellido del Agente *
              </label>
              <input
                type="text"
                required
                value={formData.agentName}
                onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                placeholder="Ej. Lucas Silva"
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                ID / DNI / Legajo
              </label>
              <input
                type="text"
                value={formData.agentId}
                onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                placeholder="Ej. AG-2041"
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 font-mono"
              />
            </div>
          </div>

          {/* Campaign & Supervisor & Trainer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Campaña / Área Operativa
              </label>
              <input
                type="text"
                value={formData.campaign}
                onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                placeholder="Ej. Atención al Cliente"
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Supervisor / Team Leader
              </label>
              <input
                type="text"
                value={formData.supervisor}
                onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                placeholder="Ej. Mariana Gómez"
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Instructor / Trainer
              </label>
              <input
                type="text"
                value={formData.trainerName}
                onChange={(e) => setFormData({ ...formData, trainerName: e.target.value })}
                placeholder="Ej. Carlos Benítez"
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
              />
            </div>
          </div>

          {/* Training Course */}
          <div>
            <label className="block text-xs font-semibold text-[#2D332A] mb-1">
              Nombre de la Capacitación / Trainer *
            </label>
            <input
              type="text"
              required
              value={formData.trainingName}
              onChange={(e) => setFormData({ ...formData, trainingName: e.target.value })}
              placeholder="Ej. Trainer: Manejo de Clientes Críticos y Desescalamiento"
              className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
            />
          </div>

          {/* Score, Passing Score, Attendance & Date */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Calificación (0-100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.score}
                onChange={(e) => handleScoreChange(Number(e.target.value))}
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#4F7A4F] font-bold focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Mínimo Aprobatorio
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.minPassingScore}
                onChange={(e) => setFormData({ ...formData, minPassingScore: Number(e.target.value) })}
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">
                Asistencia (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.attendancePercentage}
                onChange={(e) => setFormData({ ...formData, attendancePercentage: Number(e.target.value) })}
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2D332A] mb-1">Fecha</label>
              <input
                type="date"
                value={formData.completionDate}
                onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-2 py-2 text-xs text-[#2D332A] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#2D332A] mb-1">
              Estado de Aprobación
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["Aprobado", "No Aprobado", "Pendiente"] as ApprovalStatus[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setFormData({ ...formData, status: st })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    formData.status === st
                      ? st === "Aprobado"
                        ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                        : st === "No Aprobado"
                        ? "bg-[#FDF1F1] text-[#9E4A4A] border-[#F0D5D5]"
                        : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
                      : "bg-[#F9F9F7] text-[#6B7366] border-[#D9DED4] hover:text-[#2D332A]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs font-semibold text-[#2D332A] mb-1">
              Habilidades Adquiridas (separadas por coma)
            </label>
            <input
              type="text"
              value={formData.skillsString}
              onChange={(e) => setFormData({ ...formData, skillsString: e.target.value })}
              placeholder="Ej. Escucha Activa, Manejo de Objeciones, CRM"
              className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
            />
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-xs font-semibold text-[#2D332A] mb-1">
              Comentarios / Feedback del Trainer
            </label>
            <textarea
              rows={3}
              value={formData.feedback}
              onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
              placeholder="Observaciones de desempeño en el roleplay o examen..."
              className="w-full bg-[#F9F9F7] border border-[#D9DED4] rounded-xl p-3 text-xs sm:text-sm text-[#2D332A] placeholder-[#8DA189] focus:outline-none focus:ring-2 focus:ring-[#8DA189]/40"
            ></textarea>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E8EAE3]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#6B7366] hover:text-[#2D332A] rounded-xl hover:bg-[#E8EAE3] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#8DA189] hover:bg-[#7D9179] text-white shadow-xs transition-all cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{initialAgent ? "Guardar Cambios" : "Crear Registro"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
