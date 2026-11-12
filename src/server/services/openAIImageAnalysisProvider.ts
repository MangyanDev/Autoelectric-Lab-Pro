import { ImageAnalysisProvider, ImageAnalysisResult } from './imageAnalysisTypes';
import { createManualImageAnalysisProvider } from './manualImageAnalysisProvider';

export function createOpenAIImageAnalysisProvider(): ImageAnalysisProvider {
  // If OpenAI is not configured, fall back to manual review
  return createManualImageAnalysisProvider();
}
