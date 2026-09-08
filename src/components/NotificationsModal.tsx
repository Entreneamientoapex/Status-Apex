import React, { useState } from "react";
import {
  Bell,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Inbox,
  ArrowLeft,
  UserCheck,
  MessageSquare,
  FileText,
  Award,
  Layers,
  Check,
  Download,
  Image as ImageIcon,
  Send,
  ExternalLink,
  User,
  ClipboardCheck,
  Trash2,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  type: "matriculacion" | "feedback" | "system";
  title: string;
  shortDescription: string;
  timestamp: string;
  isRead: boolean;
  evidenciaUrl?: string;
  evidenciaNombre?: string;
  informacionDetallada: {
    categoria: string;
    origen: string;
    agenteReferencia?: string;
    cursoReferencia?: string;
    motivo: string;
    resumenImpacto: string;
    datosTecnicos?: Record<string, string | number>;
    recomendacionAccion?: string;
    matriculacionData?: {
      nombreCompleto: string;
      legajoUsuario: string;
      nombreCursoTest: string;
      evidenciaUrl?: string;
      evidenciaNombre?: string;
      adjunto?: {
        nombreArchivo: string;
        tamano?: string;
        url?: string;
      };
    };
    feedbackData?: {
      evaluadorTrainer: string;
      fechaDevolucion: string;
      notaDesempeno?: string;
      colaborador?: string;
      areaServicio?: string;
      observacionesClave: string;
      evidenciaUrl?: string;
      evidenciaNombre?: string;
      adjunto?: {
        nombreArchivo: string;
        tamano?: string;
        url?: string;
      };
    };
  };
}

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: NotificationItem[];
  setNotifications?: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications: externalNotifications,
  setNotifications: externalSetNotifications,
}) => {
  const [internalNotifications, setInternalNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const notifications = externalNotifications !== undefined ? externalNotifications : internalNotifications;
  const setNotifications = externalSetNotifications || setInternalNotifications;
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeNotification = notifications.find((n) => n.id === activeNotificationId);

  const handleSelectNotification = (id: string) => {
    setActiveNotificationId(id);
    // Marcar como leída
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  // Función para Eliminar / Completar Notificación
  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (activeNotificationId === id) {
      setActiveNotificationId(null);
    }
    showToast("Notificación eliminada de la bandeja");
  };

  // Acción: Matricular (Copia al portapapeles y abre Gmail con Asunto)
  const handleMatricularAction = async (notif: NotificationItem) => {
    const matData = notif.informacionDetallada.matriculacionData || {
      nombreCompleto: "Juan Pérez",
      legajoUsuario: "U616446",
      nombreCursoTest: "CD2633",
    };

    const plantillaTexto = 
`Buenos días estimado, solicito por favor que se realice la matriculación del/los colaborador/es indicado/s en el/los siguiente/s curso/s detallado/s a continuación:

Nombre Completo: ${matData.nombreCompleto}
Legajo / Usuario: ${matData.legajoUsuario}
Nombre del Curso / Test: ${matData.nombreCursoTest}

Agradezco de antemano tu gestión y apoyo con este requerimiento para poder avanzar con la formación del equipo.`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(plantillaTexto);
      }
      showToast("¡Plantilla copiada al portapapeles! Redirigiendo a Gmail...");

      const toRecipients = "EstrategiadelEntrenamiento@teco.com.ar,EntrenamientoPresencial@personal.com.ar";
      const ccRecipients = "Ar_Teco_JCC_Soporte@apexamerica.com,matiasgabriel.diaz@apexamerica.com,jose.perini@apexamerica.com,vanesacarolina.alegre@apexamerica.com";
      const courseName = matData.nombreCursoTest?.trim() || "[Nombre del Curso / Test]";
      const subjectEncoded = encodeURIComponent(`Solicitud de Matriculación - ${courseName}`);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(toRecipients)}&cc=${encodeURIComponent(ccRecipients)}&su=${subjectEncoded}`;
      window.open(gmailUrl, "_blank");
    } catch (e) {
      console.error(e);
      showToast("No se pudo copiar automáticamente. Abre Gmail manualmente.");
    }
  };

  // Descarga de archivo adjunto (soporta URL real o genera canvas de respaldo)
  const handleDownloadAttachment = (filename: string, fileUrl?: string) => {
    if (fileUrl) {
      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        window.open(fileUrl, "_blank");
        showToast(`Abriendo evidencia: ${filename}`);
        return;
      }
      if (fileUrl.startsWith("data:") || fileUrl.startsWith("blob:")) {
        const link = document.createElement("a");
        link.download = filename;
        link.href = fileUrl;
        link.click();
        showToast(`Descargando captura: ${filename}`);
        return;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 350;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#F8FAF7";
      ctx.fillRect(0, 0, 600, 350);
      ctx.fillStyle = "#2D5A27";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("Apex Training Analytics - Evidencia", 40, 60);
      ctx.fillStyle = "#4B5246";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Archivo: ${filename}`, 40, 100);
      ctx.fillText("Fecha de Validación: " + new Date().toLocaleDateString(), 40, 130);
      ctx.strokeStyle = "#4F7A4F";
      ctx.lineWidth = 3;
      ctx.strokeRect(30, 30, 540, 290);
      
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
    showToast(`Descargando captura: ${filename}`);
  };

  const getNotificationBadge = (type: NotificationItem["type"]) => {
    switch (type) {
      case "matriculacion":
        return {
          icon: <UserCheck className="h-4 w-4 text-[#4F7A4F]" />,
          bg: "bg-[#E6F3E6]",
          label: "Matriculación",
        };
      case "feedback":
        return {
          icon: <MessageSquare className="h-4 w-4 text-[#2563EB]" />,
          bg: "bg-[#EFF6FF]",
          label: "FEEDBACK",
          badgeColor: "text-[#1D4ED8]",
          categoryBg: "bg-[#EFF6FF]",
          categoryBorder: "border-[#BFDBFE]",
        };
      default:
        return {
          icon: <Bell className="h-4 w-4 text-[#5A6355]" />,
          bg: "bg-[#F1F3EE]",
          label: "Sistema",
        };
    }
  };

  return (
    <div
      id="modal-notifications-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="modal-notifications-container"
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-[#D9DED4] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast interno de notificación */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-60 bg-[#1E293B] text-white text-xs px-4 py-2 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <CheckCircle2 className="h-4 w-4 text-[#8DA189]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E6DC] bg-[#FAFBF9]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#E6F3E6] border border-[#C5DAC5] text-[#4F7A4F]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-extrabold text-slate-800 text-lg tracking-tight">
                  Bandeja de <span className="text-[#0083a4]">Notificaciones</span>
                </h2>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#EBF3E8] text-[#2D5A27] border border-[#C5DAC5]">
                    {unreadCount} no leída{unreadCount > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#F1F3EE] text-[#6B7366] border border-[#D9DED4]">
                    Al día
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7366]">
                Alertas operativas, solicitudes y sincronizaciones del sistema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                id="btn-mark-all-read"
                onClick={handleMarkAllAsRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4F7A4F] hover:bg-[#E6F3E6] rounded-lg transition-colors cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Marcar todas como leídas</span>
              </button>
            )}
            <button
              id="btn-close-notifications-modal"
              onClick={onClose}
              className="p-2 rounded-xl text-[#6B7366] hover:text-[#1E241B] hover:bg-[#F1F3EE] transition-colors cursor-pointer"
              aria-label="Cerrar bandeja"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo Principal del Modal: Dos Columnas o Vista Detallada */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[440px]">
          {/* Columna Izquierda: Listado de Alertas (5 columnas en desktop) */}
          <div
            className={`md:col-span-5 border-r border-[#E1E6DC] overflow-y-auto p-3 space-y-2 bg-[#FAFBF9] ${
              activeNotificationId ? "hidden md:block" : "block"
            }`}
          >
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-[#8C9487] uppercase tracking-wider">
              <span>Recientes ({notifications.length})</span>
              {unreadCount > 0 && (
                <span className="sm:hidden text-emerald-700 cursor-pointer" onClick={handleMarkAllAsRead}>
                  Leídas
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-20 px-4 flex flex-col items-center justify-center text-center text-[#6B7366] space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#F1F3EE] flex items-center justify-center text-[#8C9487]">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="text-xs text-[#8C9487] font-medium">
                  No tienes notificaciones pendientes
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const badge = getNotificationBadge(item.type);
                const isSelected = activeNotificationId === item.id;

                return (
                  <div
                    key={item.id}
                    id={`notification-card-${item.id}`}
                    onClick={() => handleSelectNotification(item.id)}
                    className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "bg-white border-[#4F7A4F] shadow-sm ring-1 ring-[#4F7A4F]/20"
                        : item.isRead
                        ? "bg-white/70 hover:bg-white border-[#E5EAE0] text-[#6B7366]"
                        : "bg-white hover:bg-white border-[#C5DAC5] shadow-2xs text-[#1E241B]"
                    }`}
                  >
                    {/* Punto Azul de No Leída */}
                    {!item.isRead && (
                      <span className="absolute top-3.5 right-3.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${badge.bg}`}>
                        {badge.icon}
                      </div>

                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            item.type === "feedback" ? "text-blue-600" : "text-[#4F7A4F]"
                          }`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-[#8C9487]"> • {item.timestamp}</span>
                        </div>
                        <h3
                          className={`font-sans font-extrabold text-sm tracking-tight truncate mt-0.5 ${
                            !item.isRead ? "text-slate-800" : "text-slate-600"
                          }`}
                        >
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-[#6B7366] line-clamp-2 mt-1 leading-relaxed">
                          {item.shortDescription}
                        </p>
                      </div>

                      <div className="flex flex-col items-center justify-between gap-2 shrink-0 self-stretch">
                        <button
                          id={`btn-delete-item-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title="Eliminar notificación"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isSelected ? "text-[#4F7A4F] translate-x-0.5" : "text-[#A8B0A2]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Columna Derecha: Detalle de Información Complementaria (7 columnas en desktop) */}
          <div
            className={`md:col-span-7 overflow-y-auto p-6 bg-white flex flex-col justify-between ${
              activeNotificationId ? "block" : "hidden md:flex"
            }`}
          >
            {activeNotification ? (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Botón Volver para Mobile */}
                <div className="md:hidden">
                  <button
                    onClick={() => setActiveNotificationId(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#4F7A4F] hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Volver a la lista</span>
                  </button>
                </div>

                {/* Encabezado del Detalle */}
                <div className="pb-4 border-b border-[#E1E6DC]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${
                      activeNotification.type === "feedback"
                        ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]"
                        : "bg-[#E6F3E6] text-[#2D5A27] border-[#C5DAC5]"
                    }`}>
                      {activeNotification.informacionDetallada.categoria}
                    </span>
                    <span className="text-xs text-[#8C9487]">
                      {activeNotification.timestamp}
                    </span>
                  </div>
                  <h3 className="font-sans font-extrabold text-slate-800 text-lg sm:text-xl tracking-tight">
                    {activeNotification.type === "matriculacion" ? (
                      <>
                        Nueva Solicitud de <span className="text-[#0083a4]">Matriculación</span>
                      </>
                    ) : activeNotification.type === "feedback" ? (
                      <>
                        Nuevo Feedback de <span className="text-[#0083a4]">Desempeño</span>
                      </>
                    ) : (
                      activeNotification.title
                    )}
                  </h3>
                  <p className="text-xs text-[#6B7366] mt-1">
                    Origen: <span className="font-semibold text-[#2D332A]">{activeNotification.informacionDetallada.origen}</span>
                  </p>
                </div>

                {/* Bloques de Contexto para Matriculación */}
                {activeNotification.type === "matriculacion" && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-[#FAFBF9] border border-[#E5EAE0]">
                      <h5 className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5 mb-1">
                        <AlertCircle className="h-4 w-4 text-[#4F7A4F]" />
                        <span>Motivo del Registro</span>
                      </h5>
                      <p className="text-xs text-[#4B5246] leading-relaxed">
                        {activeNotification.informacionDetallada.motivo}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#FAFBF9] border border-[#E5EAE0]">
                      <h5 className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5 mb-1">
                        <Layers className="h-4 w-4 text-[#3B6EA8]" />
                        <span>Resumen de Impacto</span>
                      </h5>
                      <p className="text-xs text-[#4B5246] leading-relaxed">
                        {activeNotification.informacionDetallada.resumenImpacto}
                      </p>
                    </div>
                  </div>
                )}

                {/* PARÁMETROS CLAVE SEGÚN TIPO */}
                {activeNotification.type === "matriculacion" && activeNotification.informacionDetallada.matriculacionData ? (
                  <div>
                    <h5 className="text-xs font-bold text-[#2D332A] mb-2 uppercase tracking-wider text-[11px]">
                      Parámetros Clave
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-3 rounded-xl bg-[#F5F7F3] border border-[#E1E6DC]">
                        <span className="block text-[10px] text-[#6B7366] font-medium mb-0.5">
                          Nombre Completo
                        </span>
                        <span className="block text-xs font-bold text-[#1E241B] truncate">
                          {activeNotification.informacionDetallada.matriculacionData.nombreCompleto}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F5F7F3] border border-[#E1E6DC]">
                        <span className="block text-[10px] text-[#6B7366] font-medium mb-0.5">
                          Legajo / Usuario
                        </span>
                        <span className="block text-xs font-bold text-[#1E241B] truncate font-mono">
                          {activeNotification.informacionDetallada.matriculacionData.legajoUsuario}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#F5F7F3] border border-[#E1E6DC]">
                        <span className="block text-[10px] text-[#6B7366] font-medium mb-0.5">
                          Nombre del Curso / Test
                        </span>
                        <span className="block text-xs font-bold text-[#1E241B] truncate">
                          {activeNotification.informacionDetallada.matriculacionData.nombreCursoTest}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (activeNotification.type === "feedback" || activeNotification.type === "system") ? (
                  (() => {
                    // Mapeo dinámico de evidencia o captura adjunta desde la planilla o formulario
                    const evidenciaUrl =
                      activeNotification.evidenciaUrl ||
                      activeNotification.informacionDetallada.feedbackData?.evidenciaUrl ||
                      activeNotification.informacionDetallada.feedbackData?.adjunto?.url ||
                      (activeNotification.informacionDetallada.datosTecnicos?.evidenciaUrl as string) ||
                      (activeNotification.informacionDetallada.datosTecnicos?.["URL Evidencia"] as string) ||
                      (activeNotification.informacionDetallada.datosTecnicos?.url as string) ||
                      null;

                    const evidenciaNombre =
                      activeNotification.informacionDetallada.feedbackData?.adjunto?.nombreArchivo ||
                      activeNotification.informacionDetallada.feedbackData?.evidenciaNombre ||
                      activeNotification.evidenciaNombre ||
                      (evidenciaUrl
                        ? (() => {
                            try {
                              const parsed = new URL(evidenciaUrl);
                              const parts = parsed.pathname.split("/").filter(Boolean);
                              const lastPart = parts[parts.length - 1];
                              return lastPart ? decodeURIComponent(lastPart) : "captura_evidencia.png";
                            } catch {
                              const parts = evidenciaUrl.split("/").filter(Boolean);
                              const last = parts[parts.length - 1];
                              return last || "captura_evidencia.png";
                            }
                          })()
                        : null);

                    // Si no cuenta con ninguna captura en la planilla de origen, se oculta por completo la tarjeta
                    const tieneEvidencia = Boolean(evidenciaUrl || evidenciaNombre);

                    return (
                      <div className="space-y-4 pt-1">
                        {/* Remitente / Quien Envió */}
                        <div>
                          <p className="text-sm font-bold text-[#1E241B]">Remitente / Quien Envió:</p>
                          <p className="text-sm text-slate-600 mb-3">
                            {activeNotification.informacionDetallada.feedbackData?.evaluadorTrainer ||
                              activeNotification.informacionDetallada.origen ||
                              "Evaluador"}
                          </p>
                        </div>

                        {/* Comentario / Devolución Realizada */}
                        <div>
                          <p className="text-sm font-bold text-[#1E241B]">Comentario / Devolución Realizada:</p>
                          <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap leading-relaxed">
                            {activeNotification.informacionDetallada.feedbackData?.observacionesClave ||
                              activeNotification.informacionDetallada.motivo ||
                              activeNotification.shortDescription}
                          </p>
                        </div>

                        {/* EVIDENCIA / CAPTURA ADJUNTA (Renderizada dinámicamente; oculta si no existe archivo) */}
                        {tieneEvidencia && (
                          <div className="border border-dashed border-slate-200 p-4 rounded-xl mb-4 bg-[#FAFBF9]">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Evidencia / Captura Adjunta
                            </p>
                            <div className="flex items-center justify-between mt-2 gap-3">
                              <span
                                className="text-xs text-slate-600 font-medium truncate max-w-[200px] sm:max-w-xs"
                                title={evidenciaNombre || evidenciaUrl || "Captura de evidencia"}
                              >
                                {evidenciaNombre || "captura_evidencia.png"}
                              </span>

                              {evidenciaUrl ? (
                                <a
                                  id="btn-download-feedback-evidence"
                                  href={evidenciaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={evidenciaNombre || "captura_evidencia.png"}
                                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Descargar Imagen</span>
                                </a>
                              ) : (
                                <button
                                  id="btn-download-feedback-evidence"
                                  type="button"
                                  onClick={() => handleDownloadAttachment(evidenciaNombre || "captura_evidencia.png")}
                                  className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Descargar Imagen</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : null}

                {/* SECCIÓN DE IMAGEN ADJUNTA (DESCARGABLE) - Solo para Matriculación */}
                {activeNotification.type === "matriculacion" && (() => {
                  const matEvidenciaUrl =
                    activeNotification.evidenciaUrl ||
                    activeNotification.informacionDetallada.matriculacionData?.evidenciaUrl ||
                    activeNotification.informacionDetallada.matriculacionData?.adjunto?.url ||
                    (activeNotification.informacionDetallada.datosTecnicos?.evidenciaUrl as string) ||
                    (activeNotification.informacionDetallada.datosTecnicos?.["URL Evidencia"] as string) ||
                    (activeNotification.informacionDetallada.datosTecnicos?.["Evidencia"] as string) ||
                    (activeNotification.informacionDetallada.datosTecnicos?.url as string) ||
                    null;

                  const rawNombre =
                    activeNotification.informacionDetallada.matriculacionData?.adjunto?.nombreArchivo ||
                    activeNotification.informacionDetallada.matriculacionData?.evidenciaNombre ||
                    activeNotification.evidenciaNombre;

                  const isDummy =
                    rawNombre === "auditoria_calidad.png" ||
                    rawNombre === "evidencia_matriculacion.png";

                  const matEvidenciaNombre = matEvidenciaUrl
                    ? (() => {
                        try {
                          const parsed = new URL(matEvidenciaUrl);
                          const parts = parsed.pathname.split("/").filter(Boolean);
                          const lastPart = parts[parts.length - 1];
                          return lastPart
                            ? decodeURIComponent(lastPart)
                            : (!isDummy && rawNombre ? rawNombre : "evidencia_matriculacion.png");
                        } catch {
                          const parts = matEvidenciaUrl.split("/").filter(Boolean);
                          const last = parts[parts.length - 1];
                          return last || (!isDummy && rawNombre ? rawNombre : "evidencia_matriculacion.png");
                        }
                      })()
                    : (!isDummy && rawNombre ? rawNombre : null);

                  // Si la fila específica del Sheet no contiene ningún enlace o archivo adjunto, se oculta por completo
                  const tieneEvidencia = Boolean(matEvidenciaUrl || matEvidenciaNombre);
                  if (!tieneEvidencia) return null;

                  const tamano = activeNotification.informacionDetallada.matriculacionData?.adjunto?.tamano;

                  return (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-[#2D332A] uppercase tracking-wider text-[11px]">
                        Evidencia / Captura Adjunta
                      </h5>
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D9DED4] bg-[#FAFBF9] hover:bg-[#F5F7F3] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#E6F3E6] border border-[#C5DAC5] flex items-center justify-center text-[#4F7A4F] shrink-0">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-xs font-bold text-[#1E241B] truncate max-w-[200px] sm:max-w-xs"
                              title={matEvidenciaNombre || matEvidenciaUrl || "Captura de pantalla"}
                            >
                              {matEvidenciaNombre || "evidencia_matriculacion.png"}
                            </p>
                            <p className="text-[11px] text-[#6B7366]">
                              Captura de pantalla{tamano ? ` • ${tamano}` : ""}
                            </p>
                          </div>
                        </div>

                        {matEvidenciaUrl ? (
                          <a
                            id="btn-download-evidence"
                            href={matEvidenciaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={matEvidenciaNombre || "evidencia_matriculacion.png"}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                            title="Descargar captura de pantalla"
                          >
                            <Download className="h-3.5 w-3.5 text-[#4F7A4F]" />
                            <span className="hidden sm:inline">Descargar Imagen</span>
                            <span className="sm:hidden">Descargar</span>
                          </a>
                        ) : (
                          <button
                            id="btn-download-evidence"
                            type="button"
                            onClick={() =>
                              handleDownloadAttachment(
                                matEvidenciaNombre || "evidencia_matriculacion.png"
                              )
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                            title="Descargar captura de pantalla"
                          >
                            <Download className="h-3.5 w-3.5 text-[#4F7A4F]" />
                            <span className="hidden sm:inline">Descargar Imagen</span>
                            <span className="sm:hidden">Descargar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Recomendación / Acción Sugerida para Matriculación */}
                {activeNotification.type === "matriculacion" && activeNotification.informacionDetallada.recomendacionAccion && (
                  <div className="p-3 rounded-xl border text-xs bg-[#E6F3E6]/60 border-[#C5DAC5] text-[#2D5A27]">
                    <span className="font-bold block mb-0.5">Acción Recomendada:</span>
                    {activeNotification.informacionDetallada.recomendacionAccion}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6B7366] space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#F1F3EE] flex items-center justify-center text-[#8C9487]">
                  <Inbox className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#2D332A]">
                    {notifications.length === 0 ? "No tienes notificaciones pendientes" : "Selecciona una notificación"}
                  </h4>
                  <p className="text-xs text-[#6B7366] max-w-xs mt-1">
                    {notifications.length === 0
                      ? "Tu bandeja está al día. Las solicitudes reales de matriculación y feedbacks de auditoría aparecerán aquí."
                      : "Haz clic sobre cualquier alerta de la columna izquierda para desplegar su información detallada."}
                  </p>
                </div>
              </div>
            )}

            {/* Pie de detalle con BOTÓN AUTOMATIZADO "MATRICULAR" Y BOTÓN "ELIMINAR PEDIDO" */}
            {activeNotification && (
              <div className="pt-4 border-t border-[#E1E6DC] flex items-center justify-between gap-3 text-xs text-[#6B7366] flex-wrap">
                <span className="flex items-center gap-1 text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#4F7A4F]" /> Notificación verificada
                </span>

                <div className="flex items-center gap-2">
                  {/* Botón Destacado: Matricular (para alertas de tipo matriculacion) */}
                  {activeNotification.type === "matriculacion" && (
                    <button
                      id="btn-action-matricular-modal"
                      onClick={() => handleMatricularAction(activeNotification)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-[#0F172A] active:scale-[0.98] text-white shadow-xs transition-all cursor-pointer"
                      title="Copiar plantilla limpia al portapapeles y abrir Gmail con asunto preconfigurado"
                    >
                      <Send className="h-3.5 w-3.5 text-[#8DA189]" />
                      <span>Matricular</span>
                    </button>
                  )}

                  {/* Botón Visible para Eliminar / Completar Tarea */}
                  <button
                    id={`btn-delete-notification-${activeNotification.id}`}
                    onClick={() => handleDeleteNotification(activeNotification.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
                    title="Descartar o eliminar esta notificación una vez completada la tarea"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    <span>Eliminar Pedido</span>
                  </button>

                  <button
                    id="btn-close-detail"
                    onClick={() => setActiveNotificationId(null)}
                    className="hidden md:inline text-xs font-semibold text-[#4F7A4F] hover:underline cursor-pointer px-2 py-1"
                  >
                    Cerrar detalle
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-3 border-t border-[#E1E6DC] bg-[#FAFBF9] flex items-center justify-between text-xs text-[#6B7366]">
          <span>Módulo de Notificaciones v1.0 • Apex Training Analytics</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4] font-semibold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
