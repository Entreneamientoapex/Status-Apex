import React, { useState } from "react";
import {
  X,
  MessageSquare,
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Award,
} from "lucide-react";
import { NotificationItem } from "./NotificationsModal";

interface GuestFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNotification: (newNotif: NotificationItem) => void;
}

export const GuestFeedbackModal: React.FC<GuestFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmitNotification,
}) => {
  const [remitente, setRemitente] = useState("");
  const [comentario, setComentario] = useState("");
  const [colaborador, setColaborador] = useState("Gómez, Facundo (U616446)");
  const [notaDesempeno, setNotaDesempeno] = useState("95 / 100 (Excelente)");
  const [archivoAdjunto, setArchivoAdjunto] = useState<{ nombre: string; tamano: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const sizeKb = Math.round(file.size / 1024);
      setArchivoAdjunto({
        nombre: file.name,
        tamano: `${sizeKb} KB`,
      });
    }
  };

  const handleSimulateFile = () => {
    setArchivoAdjunto({
      nombre: "auditoria_calidad.png",
      tamano: "390 KB",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitente.trim() || !comentario.trim()) {
      setError("Por favor completa el remitente y el comentario de auditoría.");
      return;
    }

    const newNotification: NotificationItem = {
      id: `notif-fb-${Date.now()}`,
      type: "feedback",
      title: "Nuevo Feedback de Desempeño",
      shortDescription: `${remitente.trim()} ha cargado una nueva devolución de auditoría para revisión.`,
      timestamp: "Hace un momento",
      isRead: false,
      informacionDetallada: {
        categoria: "FEEDBACK",
        origen: "Módulo de Auditoría y Coaching Pedagógico",
        motivo: "Revisión mensual de calidad en atención y soporte.",
        resumenImpacto: "El colaborador requiere feedback firmado para habilitar su paso a operaciones avanzadas.",
        feedbackData: {
          evaluadorTrainer: remitente.trim(),
          fechaDevolucion: "21/08/2026 - Reciente",
          notaDesempeno: notaDesempeno.trim(),
          colaborador: colaborador.trim(),
          areaServicio: "Soporte Nivel 2 • Operaciones",
          observacionesClave: comentario.trim(),
        },
        recomendacionAccion: "Revisar los puntos clave observados y coordinar sesión de coaching uno a uno.",
      },
    };

    onSubmitNotification(newNotification);
    onClose();
    // Reset fields
    setRemitente("");
    setComentario("");
    setArchivoAdjunto(null);
    setError(null);
  };

  return (
    <div
      id="modal-guest-feedback-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-guest-feedback-container"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#D9DED4] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E6DC] bg-[#FAFBF9]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB]">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-sans font-extrabold text-slate-800 text-lg tracking-tight">
                Enviar Feedback de <span className="text-[#0083a4]">Auditoría</span>
              </h2>
              <p className="font-medium text-slate-400 text-xs mt-0.5">
                Carga una devolución con captura adjunta para el panel Admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B7366] hover:text-[#1E241B] hover:bg-[#F1F3EE] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Campo 1: Remitente / Quien envía */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1">
              Nombre de quien envía (Remitente / Trainer) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
              placeholder="Ej: Lucía Romero (Trainer Senior)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DED4] bg-white text-xs text-[#1E241B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
            />
          </div>

          {/* Campo 2: Comentario de la Devolución */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1">
              Comentario de la Devolución / Auditoría Realizada <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder='Ej: "Excelente manejo de objeciones y dicción clara. Optimizar tiempo de tipificación."'
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DED4] bg-white text-xs text-[#1E241B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all resize-none"
            />
          </div>

          {/* Apartado: Adjuntar Captura de Auditoría */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1.5">
              Adjuntar Captura de Auditoría / Evidencia
            </label>
            <div className="border-2 border-dashed border-[#D9DED4] hover:border-[#2563EB] rounded-xl p-4 bg-[#FAFBF9] text-center transition-colors">
              {archivoAdjunto ? (
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-[#E1E6DC]">
                  <div className="flex items-center gap-2 truncate">
                    <FileImage className="h-5 w-5 text-[#2563EB] shrink-0" />
                    <div className="text-left truncate">
                      <p className="text-xs font-bold text-[#1E241B] truncate">{archivoAdjunto.nombre}</p>
                      <p className="text-[10px] text-[#6B7366]">{archivoAdjunto.tamano}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArchivoAdjunto(null)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded-md transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <UploadCloud className="h-7 w-7 text-[#8C9487]" />
                  <div>
                    <p className="text-xs font-semibold text-[#2D332A]">
                      Arrastra tu captura aquí o{" "}
                      <label className="text-[#2563EB] hover:underline cursor-pointer font-bold">
                        explora
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </p>
                    <p className="text-[10px] text-[#6B7366] mt-0.5">PNG o JPG de la auditoría</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateFile}
                    className="mt-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] px-2.5 py-1 rounded-md transition"
                  >
                    Usar auditoria_calidad.png de ejemplo
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-3 border-t border-[#E1E6DC] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Enviar Feedback</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
