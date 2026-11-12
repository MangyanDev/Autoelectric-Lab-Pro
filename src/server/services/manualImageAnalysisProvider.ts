import { ImageAnalysisProvider, ImageAnalysisResult } from './imageAnalysisTypes';

export function createManualImageAnalysisProvider(): ImageAnalysisProvider {
  return {
    async analyzeImage(input: {
      imageBase64: string;
      documentName: string;
      documentType: string;
      regionBox?: { ymin?: number; xmin?: number; ymax?: number; xmax?: number; } | null;
    }): Promise<ImageAnalysisResult> {
      return {
        documentType: input.documentType,
        confidenceScore: 0,
        detectionMethod: "MANUAL_ONLY",
        analysisSummary: "Manual review mode active.",
        components: [],
        terminals: [],
        nets: [],
        warnings: ["AI analysis unavailable. Manual review required."],
        model: "manual",
        provider: "manual"
      };
    }
  };
}
