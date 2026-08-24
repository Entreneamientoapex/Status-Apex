export type ApprovalStatus = 'Aprobado' | 'No Aprobado' | 'En Curso' | 'Pendiente' | 'Condicional';

export interface AgentTestDetail {
  testId: string;
  testName: string; // e.g. "CD2633", "CD2552"
  trainingTopic?: string;
  trainerName?: string;
  score: number | null;
  minPassingScore: number;
  status: ApprovalStatus;
  passedInRetake?: boolean;
  retakeScore?: number | null;
}

export interface AgentRecord {
  id: string;
  agentName: string;
  agentId?: string; // DNI, legajo, email o código de empleado
  campaign?: string; // Campaña o departamento
  supervisor?: string; // Nombre del supervisor o Team Leader a cargo
  jcc?: string; // Nombre del JCC / Jefe de Centro de Contactos a cargo
  trainingName: string; // Nombre del curso o trainer
  trainerName: string; // Nombre del capacitador/trainer
  completionDate: string; // YYYY-MM-DD
  score: number | null; // 0 - 100
  minPassingScore: number; // e.g. 70 o 7
  status: ApprovalStatus;
  attendancePercentage?: number | null; // 0 - 100
  feedback?: string; // Observaciones del trainer
  skillsAcquired?: string[]; // Habilidades validadas
  needsRetraining: boolean; // Si requiere refuerzo
  passedInRetake?: boolean; // Aprobado en instancia de recuperatorio (Columna V o W)
  initialScore?: number | null; // Nota inicial antes del recuperatorio (<80)
  retakeScore?: number | null; // Nota obtenida en el recuperatorio (≥80)
  phoneScore?: number | null; // Cuestionario:Test (atención telefónica) (Real)
  digitalScore?: number | null; // Cuestionario:Test (atención digital) (Real)
  retakeDetails?: string; // Detalle del recuperatorio (ej. 'Recuperatorio Columna V: 85 pts')
  batchId?: string;
  sourceFileName?: string;
  testBreakdown?: AgentTestDetail[]; // Desglose individual cuando hay 1 o más tests seleccionados
}

export interface TrainingBatch {
  id: string;
  fileName: string;
  fileType: 'excel' | 'document' | 'image' | 'text' | 'demo';
  uploadDate: string;
  totalAgents: number;
  approvedCount: number;
  failedCount: number;
  averageScore: number;
  trainingTopic?: string;
  trainer?: string;
  aiSummary?: string;
  aiRecommendations?: string[];
  records: AgentRecord[];
}

export interface FilterState {
  searchQuery: string;
  status: string; // 'ALL' | ApprovalStatus
  trainingName: string; // 'ALL' | specific
  trainerName: string; // 'ALL' | specific
  campaign: string; // 'ALL' | specific
  sortBy: 'agentName' | 'score' | 'completionDate' | 'status';
  sortOrder: 'asc' | 'desc';
  onlyNeedsRetraining: boolean;
}

export interface AIAnalysisResponse {
  success: boolean;
  batchId: string;
  trainingTopic: string;
  trainer: string;
  defaultPassingScore: number;
  records: AgentRecord[];
  aiSummary: string;
  aiRecommendations: string[];
  strengths: string[];
  improvementAreas: string[];
  message?: string;
}

export interface ConfigUser {
  username: string;
  passwordHash: string; // Hash criptográfico SHA-256 (64 caracteres hexadecimales)
  email?: string;
  name?: string;
  role?: string;
  requiresPasswordChange?: boolean;
  isActive?: boolean;
}

