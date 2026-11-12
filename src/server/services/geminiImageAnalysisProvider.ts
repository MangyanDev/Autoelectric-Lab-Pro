import { GoogleGenAI } from '@google/genai';
import { ImageAnalysisProvider, ImageAnalysisResult } from './imageAnalysisTypes';
import { createManualImageAnalysisProvider } from './manualImageAnalysisProvider';

export function createGeminiImageAnalysisProvider(): ImageAnalysisProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return createManualImageAnalysisProvider();

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const modelName = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

  return {
    async analyzeImage(input: {
      imageBase64: string;
      documentName: string;
      documentType: string;
      regionBox?: { ymin?: number; xmin?: number; ymax?: number; xmax?: number } | null;
    }): Promise<ImageAnalysisResult> {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: input.imageBase64,
                  },
                },
                {
                  text: `You are an expert automotive electronics and ECU PCB diagnostics engineer.
Analyze this PCB or wiring schematic image (${input.documentName}, type: ${input.documentType}).
Identify components, markings, circuit nets, and diagnostic notes. Return JSON with this structure:
{
  "documentType": "${input.documentType}",
  "confidenceScore": 0.95,
  "analysisSummary": "Summary of detected circuitry and components",
  "components": [
    {
      "refDes": "U1",
      "category": "DRIVER_IC",
      "marking": "TLE9135PD",
      "decodedValue": "Quad Low-Side Driver",
      "packageType": "PowerSO-36",
      "bbox": { "ymin": 0.2, "xmin": 0.3, "ymax": 0.4, "xmax": 0.5 },
      "confidenceScore": 0.92,
      "verificationStatus": "VERIFIED",
      "circuitFunction": "Injector / Coil low-side driver stage",
      "terminalIds": ["T1", "T2"]
    }
  ],
  "terminals": [],
  "nets": [],
  "warnings": []
}`,
                },
              ],
            },
          ],
        });

        const rawText = response.text || '{}';
        const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let parsed: Partial<ImageAnalysisResult> = {};
        try {
          parsed = JSON.parse(cleanedText);
        } catch {
          parsed = { analysisSummary: rawText };
        }

        return {
          documentType: input.documentType,
          confidenceScore: parsed.confidenceScore ?? 0.9,
          detectionMethod: 'AI_ANALYZED',
          analysisSummary: parsed.analysisSummary || 'ECU hardware inspection completed.',
          components: parsed.components || [],
          terminals: parsed.terminals || [],
          nets: parsed.nets || [],
          warnings: parsed.warnings || [],
          model: modelName,
          provider: 'gemini',
        };
      } catch (e) {
        console.error('Gemini PCB analysis failed, falling back to manual analysis:', e);
        const manual = createManualImageAnalysisProvider();
        return manual.analyzeImage(input);
      }
    },
  };
}
