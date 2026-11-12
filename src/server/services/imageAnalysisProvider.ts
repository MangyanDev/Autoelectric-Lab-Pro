import { ImageAnalysisProvider } from './imageAnalysisTypes';
import { createGeminiImageAnalysisProvider } from './geminiImageAnalysisProvider';
import { createManualImageAnalysisProvider } from './manualImageAnalysisProvider';

export function getImageAnalysisProvider(): ImageAnalysisProvider {
  const provider = process.env.IMAGE_ANALYSIS_PROVIDER?.trim().toLowerCase();
  if (provider === 'manual') {
    return createManualImageAnalysisProvider();
  }
  if (process.env.GEMINI_API_KEY || provider === 'gemini') {
    return createGeminiImageAnalysisProvider();
  }
  return createManualImageAnalysisProvider();
}
