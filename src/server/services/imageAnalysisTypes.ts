export interface ImageAnalysisResult {
  documentType: string;
  confidenceScore: number;
  detectionMethod: "AI_ANALYZED" | "MANUAL_ONLY";
  analysisSummary: string;
  components: ImageAnalysisComponent[];
  terminals: ImageAnalysisTerminal[];
  nets: ImageAnalysisNet[];
  warnings: string[];
  model: string;
  provider: string;
}

export interface ImageAnalysisComponent {
  refDes: string;
  category: string;
  marking: string;
  decodedValue: string;
  packageType: string;
  bbox: { ymin: number; xmin: number; ymax: number; xmax: number; };
  confidenceScore: number;
  verificationStatus: "VERIFIED" | "CROSS_REFERENCED" | "UNVERIFIED" | "UNKNOWN";
  circuitFunction: string;
  terminalIds: string[];
  notes?: string;
}

export interface ImageAnalysisTerminal {
  id: string;
  componentRefDes: string;
  terminalName: string;
  bbox: { ymin: number; xmin: number; ymax: number; xmax: number; };
  confidenceScore: number;
}

export interface ImageAnalysisNet {
  name: string;
  signalType: string;
  connectedComponentRefs: string[];
  connectedTerminalIds: string[];
  tracePoints: { x: number; y: number; }[];
  confidenceScore: number;
  verificationStatus: "VERIFIED" | "CROSS_REFERENCED" | "UNVERIFIED" | "UNKNOWN";
  isComplete: boolean;
  incompleteNotes?: string;
}

export interface ImageAnalysisProvider {
  analyzeImage(input: {
    imageBase64: string;
    documentName: string;
    documentType: string;
    regionBox?: {
      ymin?: number;
      xmin?: number;
      ymax?: number;
      xmax?: number;
    } | null;
  }): Promise<ImageAnalysisResult>;
}
