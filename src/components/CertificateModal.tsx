import React, { useEffect, useRef, useState } from "react";
import { X, Printer, Award, ShieldCheck } from "lucide-react";
import confetti from "canvas-confetti";
import { AgentRecord } from "../types";

interface CertificateModalProps {
  agent: AgentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  agent,
  isOpen,
  onClose,
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [institutionName, setInstitutionName] = useState("Centro de Formación y Calidad Operativa");
  const [customTrainer, setCustomTrainer] = useState("");

  useEffect(() => {
    if (isOpen && agent && agent.status === "Aprobado") {
      setCustomTrainer(agent.trainerName || "Director de Capacitación");
      // Trigger celebratory confetti with natural palette
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#8DA189", "#4F7A4F", "#D9E2D5", "#8C733E", "#2D332A"],
      });
    }
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(agent.completionDate || Date.now()).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white border border-[#D9DED4] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none">
        {/* Top Control Bar (Hidden on print) */}
        <div className="px-6 py-4 border-b border-[#E8EAE3] flex items-center justify-between bg-[#F9F9F7] print:hidden">
          <div className="flex items-center gap-2 text-[#4F7A4F]">
            <Award className="h-5 w-5" />
            <span className="font-semibold text-[#2D332A] text-sm sm:text-base">
              Certificado Oficial de Aprobación
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#8DA189] hover:bg-[#7D9179] text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-[#6B7366] hover:text-[#2D332A] p-2 rounded-xl hover:bg-[#E8EAE3] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Certificate Canvas Area */}
        <div className="p-4 sm:p-8 bg-[#F1F3EE] flex items-center justify-center overflow-x-auto print:p-0 print:bg-white">
          <div
            ref={certificateRef}
            id="printable-certificate"
            className="w-full max-w-[800px] min-h-[520px] bg-[#FCFCFA] text-[#2D332A] p-8 sm:p-12 rounded-2xl border-8 border-[#C2CEC0] shadow-md relative flex flex-col justify-between print:rounded-none print:border-8 print:border-[#8DA189] print:shadow-none"
          >
            {/* Elegant Corner Ornaments */}
            <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-[#8DA189]"></div>
            <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-[#8DA189]"></div>
            <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-[#8DA189]"></div>
            <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-[#8DA189]"></div>

            {/* Header / Seal */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-[#E6F3E6] border-2 border-[#8DA189] text-[#4F7A4F] mb-1">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <p className="text-[11px] sm:text-xs tracking-[0.25em] uppercase font-bold text-[#4F7A4F]">
                {institutionName}
              </p>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#2D332A] tracking-tight">
                CERTIFICADO DE APROBACIÓN
              </h1>
              <p className="text-xs text-[#6B7366]">
                Se otorga la presente distinción a:
              </p>
            </div>

            {/* Recipient Name */}
            <div className="my-6 text-center">
              <div className="text-2xl sm:text-4xl font-bold font-serif text-[#2D332A] border-b-2 border-[#8DA189] pb-2 inline-block px-8">
                {agent.agentName}
              </div>
              {agent.agentId && (
                <p className="text-xs text-[#6B7366] font-mono mt-1">
                  Documento / Identificación: {agent.agentId} {agent.campaign ? `• ${agent.campaign}` : ""}
                </p>
              )}
            </div>

            {/* Training Description */}
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <p className="text-xs sm:text-sm text-[#6B7366] leading-relaxed">
                Por haber completado satisfactoriamente y con mérito sobresaliente la capacitación oficial:
              </p>
              <h2 className="text-base sm:text-xl font-bold text-[#2D332A] font-serif bg-[#E6F3E6] py-1.5 px-4 rounded-xl border border-[#C6DEC6] inline-block">
                {agent.trainingName}
              </h2>
              {agent.score !== null && (
                <p className="text-xs font-semibold text-[#2D332A]">
                  Calificación Obtenida:{" "}
                  <span className="text-[#4F7A4F] font-bold font-mono text-sm sm:text-base">
                    {agent.score} / 100 Puntos
                  </span>{" "}
                  • Asistencia: {agent.attendancePercentage || 100}%
                </p>
              )}
            </div>

            {/* Skills Badges */}
            {agent.skillsAcquired && agent.skillsAcquired.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 my-3">
                {agent.skillsAcquired.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F3EE] text-[#2D332A] border border-[#D9DED4]"
                  >
                    ✓ {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Signatures & Footer */}
            <div className="mt-8 pt-4 grid grid-cols-2 gap-8 text-center text-xs text-[#6B7366] border-t border-[#D9DED4]">
              <div>
                <div className="h-10 flex items-end justify-center">
                  <span className="font-serif italic text-base text-[#2D332A] font-semibold">
                    {customTrainer || agent.trainerName}
                  </span>
                </div>
                <div className="w-36 h-px bg-[#D9DED4] mx-auto my-1"></div>
                <p className="font-semibold text-[#2D332A]">{customTrainer || agent.trainerName}</p>
                <p className="text-[10px] text-[#6B7366]">Trainer & Instructor Responsable</p>
              </div>

              <div>
                <div className="h-10 flex items-end justify-center font-mono text-xs text-[#2D332A]">
                  {formattedDate}
                </div>
                <div className="w-36 h-px bg-[#D9DED4] mx-auto my-1"></div>
                <p className="font-semibold text-[#2D332A]">Fecha de Expedición</p>
                <p className="text-[10px] text-[#6B7366]">Folio: CERT-{agent.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
