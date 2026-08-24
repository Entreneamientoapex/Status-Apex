import React, { useState } from "react";
import { Lock, User, Key, Eye, EyeOff, ShieldCheck, ShieldAlert, X, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { EDITOR_CREDENTIALS, UserRole } from "../utils/googleDriveConfig";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, username: string) => void;
  currentRole: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentRole,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMessage("Por favor, ingresá tu usuario y contraseña.");
      return;
    }

    // Validate credentials against fixed config
    if (
      cleanUser.toLowerCase() === EDITOR_CREDENTIALS.username.toLowerCase() &&
      cleanPass === EDITOR_CREDENTIALS.password
    ) {
      onLoginSuccess("Editor", cleanUser);
      onClose();
    } else {
      setErrorMessage("Credenciales incorrectas. Verificá tu usuario y contraseña de Editor.");
    }
  };

  const handleQuickFill = () => {
    setUsername(EDITOR_CREDENTIALS.username);
    setPassword(EDITOR_CREDENTIALS.password);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-[#D9DED4] rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#6B7366] hover:text-[#2D332A] p-1.5 rounded-lg hover:bg-[#F1F3EE] transition-colors cursor-pointer"
          title="Cerrar (continuar en Modo Lector)"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#E8EAE3]">
          <div className="h-10 w-10 rounded-xl bg-[#E6F3E6] border border-[#C6DEC6] flex items-center justify-center text-[#4F7A4F] shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#2D332A]">
              Acceso al Sistema
            </h2>
            <p className="text-xs text-[#6B7366]">
              Autenticación para activar el <span className="font-semibold text-[#4F7A4F]">Modo Editor</span>
            </p>
          </div>
        </div>

        {/* Current Role Banner */}
        <div className="mb-4 p-3 rounded-xl bg-[#F9FAF8] border border-[#D9DED4] flex items-center justify-between text-xs">
          <span className="text-[#6B7366]">Estado de acceso actual:</span>
          <span
            className={`font-bold px-2.5 py-0.5 rounded-full border ${
              currentRole === "Editor"
                ? "bg-[#E6F3E6] text-[#4F7A4F] border-[#C6DEC6]"
                : "bg-[#FAF5E6] text-[#8C733E] border-[#EBDDBF]"
            }`}
          >
            Modo {currentRole}
          </span>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#FDF1F1] border border-[#F0D5D5] flex items-center gap-2 text-xs text-[#9E4A4A]">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#2D332A] mb-1.5">
              Usuario de Editor
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8DA189]">
                <User className="h-4 w-4" />
              </div>
              <input
                id="input-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. admin"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#D9DED4] focus:outline-none focus:ring-2 focus:ring-[#8DA189] text-[#2D332A]"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#2D332A] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8DA189]">
                <Key className="h-4 w-4" />
              </div>
              <input
                id="input-login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-9 py-2 text-xs rounded-xl bg-white border border-[#D9DED4] focus:outline-none focus:ring-2 focus:ring-[#8DA189] text-[#2D332A]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7366] hover:text-[#2D332A] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Quick Fill Credentials Helper */}
          <div className="p-2.5 rounded-xl bg-[#F1F3EE]/80 border border-[#D9DED4] flex items-center justify-between text-[11px] text-[#6B7366]">
            <div>
              <span className="font-semibold text-[#2D332A]">Credenciales configuradas:</span>{" "}
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#D9DED4] text-[#4F7A4F]">
                {EDITOR_CREDENTIALS.username}
              </code>{" "}
              /{" "}
              <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#D9DED4] text-[#4F7A4F]">
                {EDITOR_CREDENTIALS.password}
              </code>
            </div>
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-[10px] font-bold text-[#4F7A4F] hover:underline cursor-pointer ml-2 shrink-0"
            >
              Completar
            </button>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              id="btn-submit-login"
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-[#4F7A4F] hover:bg-[#3D633D] text-white rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Acceder como Editor</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-semibold bg-white hover:bg-[#F1F3EE] text-[#6B7366] border border-[#D9DED4] rounded-xl transition-colors cursor-pointer"
            >
              <span>Continuar como Lector</span>
            </button>
          </div>
        </form>

        <p className="text-[10px] text-[#6B7366] text-center mt-4">
          💡 En <strong>Modo Lector</strong> podés consultar y explorar todos los análisis del historial sin necesidad de iniciar sesión.
        </p>
      </div>
    </div>
  );
};
