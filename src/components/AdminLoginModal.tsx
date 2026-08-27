import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Sparkles,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  CloudUpload,
} from "lucide-react";
import {
  validateAdminLogin,
  computeSHA256Sync,
  computeSHA256,
  updatePasswordHashRemote,
} from "../utils/googleSheetsService";
import { ConfigUser } from "../types";

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLoginSuccess: (user?: ConfigUser) => void;
  onLogout: () => void;
  showToast?: (message: string, type: "success" | "error" | "info" | "warning") => void;
}

type ModalView = "login" | "logged_in" | "change_password" | "hash_generated";

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  onLoginSuccess,
  onLogout,
  showToast,
}) => {
  // Current user state (restored from sessionStorage if active)
  const [currentAdminUser, setCurrentAdminUser] = useState<ConfigUser | null>(() => {
    try {
      const stored = sessionStorage.getItem("apex_admin_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // View state
  const [view, setView] = useState<ModalView>(isAdmin ? "logged_in" : "login");

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorType, setErrorType] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Change Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changeErrorMessage, setChangeErrorMessage] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);
  const [isSavingRemote, setIsSavingRemote] = useState(false);

  // Reset fields when opening/closing
  useEffect(() => {
    if (isOpen) {
      setView(isAdmin ? "logged_in" : "login");
      setUsername("");
      setPassword("");
      setErrorMessage("");
      setErrorType("");
      setShowPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      setChangeErrorMessage("");
      setGeneratedHash("");
      setCopiedHash(false);
      setIsSavingRemote(false);
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  // 1. MANEJO DE LOGIN CON HASH SHA-256
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setErrorType("");
    setIsSubmitting(true);

    const cleanUser = username.trim();
    const cleanPass = password;

    if (!cleanUser || !cleanPass) {
      const msg = "Por favor, ingrese el usuario y la contraseña.";
      setErrorMessage(msg);
      setErrorType("empty");
      if (showToast) showToast(msg, "warning");
      setIsSubmitting(false);
      return;
    }

    try {
      // Valida credenciales calculando SHA-256 en tiempo real y comparando con Config_Usuarios
      const result = await validateAdminLogin(cleanUser, cleanPass);

      if (result.success && result.user) {
        setCurrentAdminUser(result.user);

        // Si el usuario requiere cambio obligatorio de contraseña (primer ingreso)
        if (result.requiresPasswordChange) {
          setView("change_password");
          if (showToast) {
            showToast("Primer ingreso detectado: Configure su contraseña definitiva.", "info");
          }
        } else {
          onLoginSuccess(result.user);
          setView("logged_in");
        }
      } else {
        const failureMsg =
          result.message || "Credenciales incorrectas. Verifique usuario y contraseña.";
        setErrorMessage(failureMsg);
        setErrorType(result.errorType || "generic");
        if (showToast) {
          showToast(failureMsg, "error");
        }
      }
    } catch (err) {
      const errMsg = "Error al validar credenciales con el servidor de Google Sheets.";
      setErrorMessage(errMsg);
      setErrorType("network");
      if (showToast) showToast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. AUTOMATIZACIÓN DEL CAMBIO DE CONTRASEÑA CON GOOGLE APPS SCRIPT
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeErrorMessage("");
    setIsSavingRemote(true);

    if (!newPassword) {
      setChangeErrorMessage("Por favor, ingrese la nueva contraseña.");
      setIsSavingRemote(false);
      return;
    }

    if (newPassword.length < 6) {
      setChangeErrorMessage("La nueva contraseña debe tener al menos 6 caracteres.");
      setIsSavingRemote(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangeErrorMessage("Las contraseñas no coinciden. Verifique ambas claves.");
      setIsSavingRemote(false);
      return;
    }

    const targetUser = currentAdminUser?.username || username.trim() || "ApexTrainer";

    try {
      // 1. Cálculo inmediato del hash SHA-256 en el cliente
      let hash = "";
      try {
        hash = await computeSHA256(newPassword);
      } catch {
        hash = computeSHA256Sync(newPassword);
      }
      setGeneratedHash(hash);

      // 2. Enviar petición HTTP POST al Webhook de Google Apps Script
      const result = await updatePasswordHashRemote(targetUser, hash);

      if (result.success) {
        const updatedUser: ConfigUser = currentAdminUser
          ? { ...currentAdminUser, passwordHash: hash, requiresPasswordChange: false }
          : {
              username: targetUser,
              passwordHash: hash,
              name: targetUser,
              role: "Trainer / Administrador",
              requiresPasswordChange: false,
              isActive: true,
            };

        setCurrentAdminUser(updatedUser);
        onLoginSuccess(updatedUser);

        if (showToast) {
          showToast("Contraseña actualizada con éxito en la base de datos centralizada", "success");
        }

        // Cierre automático del modal
        onClose();
      } else {
        const err = result.message || "No se pudo actualizar la contraseña en el servidor.";
        setChangeErrorMessage(err);
        if (showToast) {
          showToast(err, "error");
        }
      }
    } catch (err: any) {
      const errorMsg = `Error inesperado al conectar con el servidor: ${err?.message || "Revise su conexión a Internet."}`;
      setChangeErrorMessage(errorMsg);
      if (showToast) {
        showToast(errorMsg, "error");
      }
    } finally {
      setIsSavingRemote(false);
    }
  };

  // Copiar código hash al portapapeles si fuera necesario
  const handleCopyHash = () => {
    if (!generatedHash) return;
    navigator.clipboard.writeText(generatedHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 3000);
  };

  return (
    <div
      id="admin-login-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSavingRemote && !isSubmitting) onClose();
      }}
    >
      <div
        id="admin-login-modal-container"
        className="bg-white border border-[#D9DED4] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="bg-[#F9FAF8] border-b border-[#E8EAE3] p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center text-white shadow-xs ${
                isAdmin || view === "logged_in"
                  ? "bg-[#4F7A4F]"
                  : view === "change_password" || view === "hash_generated"
                  ? "bg-[#3D633D]"
                  : "bg-[#8DA189]"
              }`}
            >
              {view === "change_password" || view === "hash_generated" ? (
                <KeyRound className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2D332A]">
                {view === "change_password"
                  ? "Actualizar Contraseña en la Nube"
                  : view === "hash_generated"
                  ? "Asistente de Contraseña (SHA-256)"
                  : isAdmin || view === "logged_in"
                  ? "Panel de Administrador"
                  : "Acceso Seguro de Trainer"}
              </h2>
              <p className="text-xs text-[#6B7366]">
                {view === "change_password"
                  ? "Sincronización directa y cifrado SHA-256 en Google Sheets"
                  : view === "hash_generated"
                  ? "Blindaje criptográfico unidireccional SHA-256"
                  : isAdmin || view === "logged_in"
                  ? "Sesión de Trainer activa con privilegios de edición"
                  : "Validación de credenciales con hash SHA-256"}
              </p>
            </div>
          </div>
          <button
            id="btn-close-admin-modal"
            onClick={onClose}
            disabled={isSavingRemote || isSubmitting}
            className="text-[#6B7366] hover:text-[#2D332A] p-2 rounded-xl hover:bg-[#E8EAE3] transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Views */}
        <div className="p-5 sm:p-6">
          {/* ========================================================================= */}
          {/* VISTA 1: USUARIO LOGUEADO / PANEL ADMINISTRADOR                           */}
          {/* ========================================================================= */}
          {view === "logged_in" && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#EAF5EC] border border-[#CCE8D1] flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#1E7E34] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#1E7E34]">
                    Modo Administrador Habilitado
                  </p>
                  <p className="text-xs text-[#2D332A]/80 leading-relaxed">
                    Posees permisos para editar estados de agentes, realizar modificaciones operativas, generar certificados de aprobación y emitir reportes de IA.
                  </p>
                </div>
              </div>

              <div className="bg-[#F9FAF8] border border-[#E8EAE3] rounded-xl p-3.5 space-y-2 text-xs text-[#6B7366]">
                <div className="flex justify-between items-center py-1 border-b border-[#E8EAE3]">
                  <span>Usuario Activo:</span>
                  <span className="font-semibold text-[#2D332A]">
                    {currentAdminUser?.username || username || "ApexTrainer"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8EAE3]">
                  <span>Nombre / Identificación:</span>
                  <span className="font-semibold text-[#2D332A]">
                    {currentAdminUser?.name || "Trainer Apex"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E8EAE3]">
                  <span>Rol del Sistema:</span>
                  <span className="font-semibold text-[#4F7A4F]">
                    {currentAdminUser?.role || "Editor / Trainer Apex"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span>Seguridad de Clave:</span>
                  <span className="font-mono text-[10px] text-[#4F7A4F] bg-[#EAF5EC] px-2 py-0.5 rounded border border-[#CCE8D1]">
                    Cifrado SHA-256 Sincronizado
                  </span>
                </div>
              </div>

              {/* Botones de acción del panel */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  id="btn-admin-change-password-prompt"
                  type="button"
                  onClick={() => {
                    setView("change_password");
                    setNewPassword("");
                    setConfirmPassword("");
                    setChangeErrorMessage("");
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#D9DED4] text-xs font-semibold text-[#2D332A] bg-[#F9FAF8] hover:bg-[#E8EAE3] transition-colors cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-[#4F7A4F]" />
                  Modificar Contraseña
                </button>

                <div className="w-full sm:w-auto flex items-center justify-end gap-2">
                  <button
                    id="btn-admin-logout"
                    type="button"
                    onClick={() => {
                      setCurrentAdminUser(null);
                      onLogout();
                      onClose();
                    }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#D9DED4] text-xs font-bold text-[#A84242] bg-white hover:bg-[#FDF2F2] hover:border-[#E8B4B4] transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </button>
                  <button
                    id="btn-admin-keep-active"
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#4F7A4F] hover:bg-[#3D633D] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VISTA 2: FORMULARIO DE LOGIN (CON HASH SHA-256 AUTOMÁTICO)                */}
          {/* ========================================================================= */}
          {view === "login" && (
            <form onSubmit={handleSubmitLogin} className="space-y-4">
              {errorMessage && (
                <div
                  id="admin-login-error"
                  className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F5C2C2] flex items-start gap-2.5 text-xs text-[#A84242]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="font-medium">{errorMessage}</p>
                </div>
              )}

              {/* Input Usuario */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-username-input"
                  className="block text-xs font-bold text-[#2D332A]"
                >
                  Usuario de Trainer / Administrador
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8DA189]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="admin-username-input"
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej: ApexTrainer"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F9FAF8] border border-[#D9DED4] focus:border-[#4F7A4F] focus:bg-white focus:ring-1 focus:ring-[#4F7A4F] rounded-xl text-xs text-[#2D332A] outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* Input Contraseña */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-bold text-[#2D332A]"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8DA189]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="admin-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña de autorización"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F9FAF8] border border-[#D9DED4] focus:border-[#4F7A4F] focus:bg-white focus:ring-1 focus:ring-[#4F7A4F] rounded-xl text-xs text-[#2D332A] outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7366] hover:text-[#2D332A] cursor-pointer"
                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Banner informativo de seguridad */}
              <div className="p-3 rounded-xl bg-[#F4F6F2] border border-[#D9DED4] flex items-start gap-2.5 text-[11px] text-[#6B7366]">
                <ShieldCheck className="h-4 w-4 text-[#4F7A4F] shrink-0 mt-0.5" />
                <p>
                  <strong className="text-[#2D332A]">Blindaje Criptográfico:</strong> La contraseña nunca se envía ni almacena en texto plano. Se procesa mediante hash unidireccional SHA-256 contrastado con la base centralizada <code className="text-[#4F7A4F] font-semibold">Config_Usuarios</code>.
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setView("change_password");
                    setUsername(username || "ApexTrainer");
                    setNewPassword("");
                    setConfirmPassword("");
                    setChangeErrorMessage("");
                  }}
                  className="text-xs text-[#4F7A4F] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Cambiar Contraseña
                </button>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-cancel-admin-login"
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-[#D9DED4] text-xs font-bold text-[#6B7366] hover:text-[#2D332A] bg-white hover:bg-[#F1F3EE] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-submit-admin-login"
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4F7A4F] hover:bg-[#3D633D] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Verificando SHA-256...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Ingresar como Admin
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* VISTA 3: ASISTENTE AUTOMATIZADO PARA CAMBIO DE CONTRASEÑA EN LA NUBE        */}
          {/* ========================================================================= */}
          {view === "change_password" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#F4F6F2] border border-[#D9DED4] space-y-1 text-xs text-[#2D332A]">
                <div className="flex items-center justify-between">
                  <p className="font-bold flex items-center gap-1.5 text-[#4F7A4F]">
                    <CloudUpload className="h-4 w-4" />
                    Actualización Segura en Google Sheets
                  </p>
                  <span className="font-mono text-[10px] bg-[#EAF5EC] text-[#1E7E34] px-2 py-0.5 rounded border border-[#CCE8D1] font-semibold">
                    Webhook Activo
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7366] leading-relaxed">
                  Usuario a actualizar: <strong className="text-[#2D332A]">{currentAdminUser?.username || username || "ApexTrainer"}</strong>. Tu nueva clave se cifrará en SHA-256 y se sincronizará automáticamente en la base de datos centralizada.
                </p>
              </div>

              {/* SPINNER / MENSAJE DE GUARDADO EN LA NUBE */}
              {isSavingRemote && (
                <div
                  id="saving-password-cloud-banner"
                  className="p-4 rounded-xl bg-[#EAF5EC] border-2 border-[#8DA189] flex items-center gap-3 animate-pulse shadow-xs"
                >
                  <RefreshCw className="h-5 w-5 text-[#1E7E34] animate-spin shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#1E7E34]">
                      Guardando nueva contraseña de forma segura en la nube...
                    </p>
                    <p className="text-[10px] text-[#2D332A]/70">
                      Calculando hash SHA-256 y sincronizando con Google Apps Script.
                    </p>
                  </div>
                </div>
              )}

              {changeErrorMessage && !isSavingRemote && (
                <div className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F5C2C2] flex items-start gap-2.5 text-xs text-[#A84242]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">No se pudo completar la actualización</p>
                    <p className="font-normal text-[11px]">{changeErrorMessage}</p>
                  </div>
                </div>
              )}

              {/* Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2D332A]">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8DA189]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    autoFocus
                    disabled={isSavingRemote}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F9FAF8] border border-[#D9DED4] focus:border-[#4F7A4F] focus:bg-white focus:ring-1 focus:ring-[#4F7A4F] rounded-xl text-xs text-[#2D332A] outline-hidden transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={isSavingRemote}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7366] hover:text-[#2D332A] cursor-pointer disabled:opacity-60"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Nueva Contraseña */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2D332A]">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8DA189]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    disabled={isSavingRemote}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F9FAF8] border border-[#D9DED4] focus:border-[#4F7A4F] focus:bg-white focus:ring-1 focus:ring-[#4F7A4F] rounded-xl text-xs text-[#2D332A] outline-hidden transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={isSavingRemote}
                  onClick={() => setView(isAdmin ? "logged_in" : "login")}
                  className="px-4 py-2.5 rounded-xl border border-[#D9DED4] text-xs font-bold text-[#6B7366] hover:text-[#2D332A] bg-white hover:bg-[#F1F3EE] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  id="btn-submit-change-password"
                  type="submit"
                  disabled={isSavingRemote}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4F7A4F] hover:bg-[#3D633D] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSavingRemote ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Guardando en la Nube...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4" />
                      Guardar y Sincronizar
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* VISTA 4: RESPALDO DE CÓDIGO GENERADO (OPCIONAL/MANUAL)                    */}
          {/* ========================================================================= */}
          {view === "hash_generated" && (
            <div className="space-y-4">
              <div
                id="sha256-success-highlight-box"
                className="p-4 rounded-xl bg-[#EAF5EC] border-2 border-[#8DA189] shadow-xs space-y-2"
              >
                <div className="flex items-center gap-2 text-[#1E7E34]">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-extrabold tracking-tight">
                    Código de seguridad generado con éxito
                  </h3>
                </div>
                <p className="text-[11px] text-[#2D332A]/80 leading-relaxed pl-7">
                  Hash SHA-256 para el usuario <span className="font-bold text-[#1E7E34]">{currentAdminUser?.username || username || "ApexTrainer"}</span>.
                </p>
              </div>

              {/* Monospace Code Display */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2D332A] flex items-center justify-between">
                  <span>Hash Criptográfico SHA-256</span>
                  {copiedHash && (
                    <span className="text-[#1E7E34] text-[11px] font-semibold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> ¡Copiado!
                    </span>
                  )}
                </label>
                <div className="p-3 bg-[#1E241C] text-[#A3E635] rounded-xl font-mono text-xs break-all border border-[#2D332A] shadow-inner select-all">
                  {generatedHash}
                </div>
              </div>

              {/* Botón de copia */}
              <button
                id="btn-copy-sha256-hash"
                type="button"
                onClick={handleCopyHash}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                  copiedHash
                    ? "bg-[#1E7E34] text-white"
                    : "bg-[#4F7A4F] hover:bg-[#3D633D] text-white"
                }`}
              >
                {copiedHash ? (
                  <>
                    <Check className="h-4 w-4" />
                    ¡Código Copiado Exitosamente!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar Código Hash (SHA-256)
                  </>
                )}
              </button>

              {/* Botones de navegación */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setView("change_password")}
                  className="px-4 py-2.5 rounded-xl border border-[#D9DED4] text-xs font-bold text-[#6B7366] hover:text-[#2D332A] bg-white hover:bg-[#F1F3EE] transition-colors cursor-pointer"
                >
                  Volver
                </button>
                <button
                  id="btn-finish-hash-modal"
                  type="button"
                  onClick={() => {
                    if (!isAdmin) {
                      onLoginSuccess();
                    }
                    onClose();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2D332A] hover:bg-[#1E241C] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Entrar a la App</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

