import { ImageAnalysisResult } from '../server/services/imageAnalysisTypes';

export async function analyzePcbImage(input: {
  imageBase64: string;
  mimeType?: string;
  documentName: string;
  documentType: string;
  regionBox?: {
    ymin?: number;
    xmin?: number;
    ymax?: number;
    xmax?: number;
  } | null;
}): Promise<ImageAnalysisResult> {
  const response = await fetch('/api/autoelectric/analyze-schematic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  const data = await response.json();
  return data.analysis;
}
