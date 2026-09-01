import React, { useState } from "react";
import {
  X,
  UserPlus,
  UploadCloud,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { NotificationItem } from "./NotificationsModal";

interface GuestMatriculacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitNotification: (newNotif: NotificationItem) => void;
}

export const GuestMatriculacionModal: React.FC<GuestMatriculacionModalProps> = ({
  isOpen,
  onClose,
  onSubmitNotification,
}) => {
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [legajoUsuario, setLegajoUsuario] = useState("");
  const [nombreCursoTest, setNombreCursoTest] = useState("");
  const [motivo, setMotivo] = useState("Ingreso de nuevo colaborador a la operación.");
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
      nombre: "evidencia_matriculacion.png",
      tamano: "480 KB",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCompleto.trim() || !legajoUsuario.trim() || !nombreCursoTest.trim()) {
      setError("Por favor completa los 3 campos obligatorios.");
      return;
    }

    const newNotification: NotificationItem = {
      id: `notif-mat-${Date.now()}`,
      type: "matriculacion",
      title: "Nueva Solicitud de Matriculación",
      shortDescription: `Agente ${legajoUsuario.trim()} (${nombreCompleto.trim()}) pendiente de alta en ${nombreCursoTest.trim()}.`,
      timestamp: "Hace un momento",
      isRead: false,
      informacionDetallada: {
        categoria: "Matriculación y Usuarios",
        origen: "Formulario de Invitado / Operaciones",
        agenteReferencia: `${legajoUsuario.trim()} (${nombreCompleto.trim()})`,
        cursoReferencia: nombreCursoTest.trim(),
        motivo: motivo.trim() || "Solicitud de alta de usuario remitida por el equipo.",
        resumenImpacto: "El colaborador requiere acceso habilitado en el campus para rendir la evaluación programada.",
        matriculacionData: {
          nombreCompleto: nombreCompleto.trim(),
          legajoUsuario: legajoUsuario.trim(),
          nombreCursoTest: nombreCursoTest.trim(),
          adjunto: {
            nombreArchivo: archivoAdjunto ? archivoAdjunto.nombre : "evidencia_matriculacion.png",
            tamano: archivoAdjunto ? archivoAdjunto.tamano : "480 KB",
          },
        },
        recomendacionAccion: "Verificar registro en la pestaña Lista_agentes y copiar plantilla de matriculación hacia soporte.",
      },
    };

    onSubmitNotification(newNotification);
    onClose();
    // Reset fields
    setNombreCompleto("");
    setLegajoUsuario("");
    setNombreCursoTest("");
    setArchivoAdjunto(null);
    setError(null);
  };

  return (
    <div
      id="modal-guest-matriculacion-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-guest-matriculacion-container"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#D9DED4] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E6DC] bg-[#FAFBF9]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E6F3E6] border border-[#C5DAC5] text-[#4F7A4F]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-['Montserrat'] font-sans font-extrabold text-[#334155] text-lg tracking-tight">
                Enviar Solicitud de <span className="text-[#0083a4]">Matriculación</span>
              </h2>
              <p className="font-medium text-slate-400 text-xs mt-0.5">
                Crea una alerta directa para el Administrador del sistema
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

          {/* Campo 1: Nombre Completo */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1">
              Nombre Completo del Agente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DED4] bg-white text-xs text-[#1E241B] focus:outline-none focus:ring-2 focus:ring-[#4F7A4F]/20 focus:border-[#4F7A4F] transition-all"
            />
          </div>

          {/* Campo 2: Legajo / Usuario */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1">
              Legajo / Usuario <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={legajoUsuario}
              onChange={(e) => setLegajoUsuario(e.target.value)}
              placeholder="Ej: U616446"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DED4] bg-white text-xs font-mono text-[#1E241B] focus:outline-none focus:ring-2 focus:ring-[#4F7A4F]/20 focus:border-[#4F7A4F] transition-all uppercase"
            />
          </div>

          {/* Campo 3: Nombre del Curso / Test */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1">
              Nombre del Curso / Test <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nombreCursoTest}
              onChange={(e) => setNombreCursoTest(e.target.value)}
              placeholder="Ej: CD2633 - Procesos de Cobranzas"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DED4] bg-white text-xs text-[#1E241B] focus:outline-none focus:ring-2 focus:ring-[#4F7A4F]/20 focus:border-[#4F7A4F] transition-all"
            />
          </div>

          {/* Campo 4: Motivo Opcional */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1">
              Motivo o Justificación del Alta
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Ingreso de nuevo colaborador al equipo."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DED4] bg-white text-xs text-[#1E241B] focus:outline-none focus:ring-2 focus:ring-[#4F7A4F]/20 focus:border-[#4F7A4F] transition-all"
            />
          </div>

          {/* Apartado: Adjuntar Evidencia / Captura */}
          <div>
            <label className="block text-xs font-bold text-[#2D332A] mb-1.5">
              Adjuntar Evidencia / Captura
            </label>
            <div className="border-2 border-dashed border-[#D9DED4] hover:border-[#4F7A4F] rounded-xl p-4 bg-[#FAFBF9] text-center transition-colors">
              {archivoAdjunto ? (
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-[#E1E6DC]">
                  <div className="flex items-center gap-2 truncate">
                    <FileImage className="h-5 w-5 text-[#4F7A4F] shrink-0" />
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
                      Arrastra tu archivo aquí o{" "}
                      <label className="text-[#4F7A4F] hover:underline cursor-pointer font-bold">
                        explora
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    </p>
                    <p className="text-[10px] text-[#6B7366] mt-0.5">PNG, JPG o PDF hasta 5MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateFile}
                    className="mt-1 text-[11px] font-semibold text-[#4F7A4F] hover:bg-[#E6F3E6] px-2.5 py-1 rounded-md transition"
                  >
                    Usar evidencia_matriculacion.png de ejemplo
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
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#4F7A4F] hover:bg-[#3D633D] text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Enviar Solicitud</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
