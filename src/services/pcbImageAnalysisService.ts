import { ImageAnalysisResult } from '../server/services/imageAnalysisTypes';

export async function analyzePcbImage(input: {
  imageBase64: string;
  documentName: string;
  documentType: string;
}): Promise<ImageAnalysisResult> {
  const response = await fetch('/api/autoelectric/analyze-schematic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  const data = await response.json();
  return data.analysis;
}
