import { GoogleGenAI, Type } from '@google/genai';
import {
  ImageAnalysisComponent,
  ImageAnalysisHotspot,
  ImageAnalysisNet,
  ImageAnalysisProvider,
  ImageAnalysisResult,
  PcbNormalizedBox,
} from './imageAnalysisTypes';
import { createManualImageAnalysisProvider } from './manualImageAnalysisProvider';

function normalizeBox(box?: Partial<PcbNormalizedBox>): PcbNormalizedBox {
  let ymin = Number(box?.ymin ?? 100);
  let xmin = Number(box?.xmin ?? 100);
  let ymax = Number(box?.ymax ?? 250);
  let xmax = Number(box?.xmax ?? 250);

  // Guard against models returning 0..1 floats instead of 0..1000 integers
  const maxCoord = Math.max(ymin, xmin, ymax, xmax);
  if (maxCoord > 0 && maxCoord <= 1.05) {
    ymin *= 1000;
    xmin *= 1000;
    ymax *= 1000;
    xmax *= 1000;
  }

  ymin = Math.max(0, Math.min(980, Math.round(ymin)));
  xmin = Math.max(0, Math.min(980, Math.round(xmin)));
  ymax = Math.max(ymin + 20, Math.min(1000, Math.round(ymax)));
  xmax = Math.max(xmin + 20, Math.min(1000, Math.round(xmax)));

  return { ymin, xmin, ymax, xmax };
}

function normalizePoints(pts?: Array<{ x?: number; y?: number }>): { x: number; y: number }[] {
  if (!Array.isArray(pts) || pts.length === 0) return [];
  const maxVal = Math.max(
    ...pts.map((p) => Math.max(Number(p.x ?? 0), Number(p.y ?? 0)))
  );
  const scale = maxVal > 0 && maxVal <= 1.05 ? 1000 : 1;
  return pts.map((p) => ({
    x: Math.max(0, Math.min(1000, Math.round(Number(p.x ?? 0) * scale))),
    y: Math.max(0, Math.min(1000, Math.round(Number(p.y ?? 0) * scale))),
  }));
}

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

  // Free-tier Gemini 4 Hydrogen model
  const modelName = 'gemini-4-hydrogen';

  return {
    async analyzeImage(input: {
      imageBase64: string;
      mimeType?: string;
      documentName: string;
      documentType: string;
      regionBox?: { ymin?: number; xmin?: number; ymax?: number; xmax?: number } | null;
    }): Promise<ImageAnalysisResult> {
      try {
        const mimeType =
          input.mimeType && input.mimeType.startsWith('image/')
            ? input.mimeType
            : 'image/jpeg';

        const isMacroCrop = Boolean(
          input.regionBox &&
            (input.regionBox.xmin !== undefined || input.regionBox.ymin !== undefined)
        );

        const promptText = `You are a Master Automotive ECU Electronics & PCB Reverse-Engineering Specialist.
Analyze this ${isMacroCrop ? 'HIGH-MAGNIFICATION MACRO CROP of an ECU PCB' : 'automotive ECU PCB photograph'} (${input.documentName}).

INSTRUCTIONS:
1. Detect all visible automotive PCB components (MCU, MOSFET drivers, voltage regulators, CAN transceivers, Schottky/TVS diodes, current-sense shunts, electrolytic/tantalum capacitors, inductors, connectors, test pads).
2. Output EVERY bounding box and trace point in a STRICT 0 to 1000 normalized coordinate space where (0,0) is top-left and (1000,1000) is bottom-right of THIS image.
3. Read visible laser/silkscreen SMD markings accurately (e.g., TLE4275, TLE9135, TJA1050, B540C, 0R05, 470uF). Infer realistic automotive packageType, operatingVoltageRange, maxCurrentRating, and per-pin breakout (pinSpecs) with matching connectedNetId names.
4. Trace visible copper pours and PCB signal tracks between detected components into "nets" with polyline tracePoints (0..1000) connecting those component centers/pads.
5. Inspect closely for physical PCB fault hotspots: charred/burnt areas, cracked solder joints, green/white pad oxidation/corrosion, lifted copper traces, or overheated MOSFET tabs. Report any suspicious zones in "hotspots".`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: input.imageBase64,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                confidenceScore: { type: Type.NUMBER },
                analysisSummary: { type: Type.STRING },
                components: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      refDes: { type: Type.STRING },
                      category: { type: Type.STRING },
                      marking: { type: Type.STRING },
                      decodedValue: { type: Type.STRING },
                      packageType: { type: Type.STRING },
                      bbox: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER },
                        },
                        required: ['ymin', 'xmin', 'ymax', 'xmax'],
                      },
                      confidenceScore: { type: Type.NUMBER },
                      circuitFunction: { type: Type.STRING },
                      operatingVoltageRange: { type: Type.STRING },
                      maxCurrentRating: { type: Type.STRING },
                      datasheetSummary: { type: Type.STRING },
                      terminalIds: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      pinSpecs: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            pinNumber: { type: Type.INTEGER },
                            pinName: { type: Type.STRING },
                            category: { type: Type.STRING },
                            nominalVoltage: { type: Type.NUMBER },
                            connectedNetId: { type: Type.STRING },
                            notes: { type: Type.STRING },
                          },
                          required: ['pinNumber', 'pinName', 'connectedNetId'],
                        },
                      },
                    },
                    required: ['refDes', 'category', 'marking', 'bbox', 'circuitFunction'],
                  },
                },
                nets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      signalType: { type: Type.STRING },
                      connectedComponentRefs: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      connectedTerminalIds: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      tracePoints: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER },
                          },
                          required: ['x', 'y'],
                        },
                      },
                      confidenceScore: { type: Type.NUMBER },
                    },
                    required: ['name', 'connectedComponentRefs', 'tracePoints'],
                  },
                },
                hotspots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      severity: { type: Type.STRING },
                      suspectComponentRef: { type: Type.STRING },
                      notes: { type: Type.STRING },
                      bbox: {
                        type: Type.OBJECT,
                        properties: {
                          ymin: { type: Type.NUMBER },
                          xmin: { type: Type.NUMBER },
                          ymax: { type: Type.NUMBER },
                          xmax: { type: Type.NUMBER },
                        },
                        required: ['ymin', 'xmin', 'ymax', 'xmax'],
                      },
                    },
                    required: ['label', 'severity', 'bbox', 'notes'],
                  },
                },
                warnings: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['analysisSummary', 'components', 'nets'],
            },
          },
        });

        const rawText = (response.text ?? '{}').trim();
        const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        let parsed: Partial<ImageAnalysisResult> = {};
        try {
          parsed = JSON.parse(cleanedText);
        } catch {
          parsed = { analysisSummary: rawText || 'Parsed vision response' };
        }

        const components: ImageAnalysisComponent[] = (parsed.components || []).map((c, idx) => {
          const safeRef = (c.refDes || `U${idx + 1}`).trim();
          const pinSpecs = Array.isArray(c.pinSpecs)
            ? c.pinSpecs.map((p, pIdx) => ({
                pinNumber: Number(p.pinNumber || pIdx + 1),
                pinName: p.pinName || `PIN_${pIdx + 1}`,
                category: (['power', 'ground', 'signal_in', 'driver_out', 'bus'].includes(
                  p.category
                )
                  ? p.category
                  : 'signal_in') as 'power' | 'ground' | 'signal_in' | 'driver_out' | 'bus',
                nominalVoltage: Number.isFinite(Number(p.nominalVoltage))
                  ? Number(p.nominalVoltage)
                  : 5.0,
                connectedNetId: p.connectedNetId || 'NET_SIGNAL',
                notes: p.notes || 'Extracted by Gemini-4-Hydrogen vision',
              }))
            : undefined;

          return {
            refDes: safeRef,
            category: c.category || 'IC',
            marking: c.marking || safeRef,
            decodedValue: c.decodedValue || c.marking || 'Auto-detected component',
            packageType: c.packageType || 'SMD',
            bbox: normalizeBox(c.bbox),
            confidenceScore: Math.max(0.1, Math.min(1, Number(c.confidenceScore ?? 0.88))),
            verificationStatus: 'UNVERIFIED',
            circuitFunction: c.circuitFunction || 'Detected ECU circuit element',
            terminalIds:
              Array.isArray(c.terminalIds) && c.terminalIds.length > 0
                ? c.terminalIds
                : pinSpecs?.map((p) => `${safeRef}-${p.pinName}`) || [`${safeRef}-1`, `${safeRef}-2`],
            operatingVoltageRange: c.operatingVoltageRange || '5V / 12V DC',
            maxCurrentRating: c.maxCurrentRating || 'N/A',
            datasheetSummary: c.datasheetSummary || c.notes || '',
            pinSpecs,
            source: 'AI',
          };
        });

        const nets: ImageAnalysisNet[] = (parsed.nets || [])
          .map((n, idx) => ({
            name: (n.name || `NET_AUTO_${idx + 1}`).toUpperCase().replace(/\s+/g, '_'),
            signalType: n.signalType || 'SIGNAL',
            connectedComponentRefs: Array.isArray(n.connectedComponentRefs)
              ? n.connectedComponentRefs
              : [],
            connectedTerminalIds: Array.isArray(n.connectedTerminalIds)
              ? n.connectedTerminalIds
              : [],
            tracePoints: normalizePoints(n.tracePoints),
            confidenceScore: Math.max(0.1, Math.min(1, Number(n.confidenceScore ?? 0.84))),
            verificationStatus: 'UNVERIFIED' as const,
            isComplete: (n.tracePoints?.length ?? 0) >= 2,
          }))
          .filter((n) => n.tracePoints.length >= 2 || n.connectedComponentRefs.length >= 2);

        const hotspots: ImageAnalysisHotspot[] = (parsed.hotspots || []).map((h, idx) => ({
          id: h.id || `ai-hotspot-${idx + 1}`,
          label: h.label || 'Suspect Thermal / Solder Anomaly',
          severity: (['CRITICAL', 'WARNING', 'INFO'].includes(h.severity)
            ? h.severity
            : 'WARNING') as 'CRITICAL' | 'WARNING' | 'INFO',
          bbox: normalizeBox(h.bbox),
          suspectComponentRef: h.suspectComponentRef,
          notes: h.notes || 'Flagged for continuity and thermal inspection.',
          source: 'AI',
        }));

        return {
          documentType: input.documentType,
          confidenceScore: Math.max(0.1, Math.min(1, Number(parsed.confidenceScore ?? 0.88))),
          detectionMethod: 'AI_ANALYZED',
          analysisSummary:
            parsed.analysisSummary ||
            `Gemini-4-Hydrogen mapped ${components.length} components and ${nets.length} copper nets.`,
          components,
          terminals: [],
          nets,
          hotspots,
          warnings: parsed.warnings || [],
          model: modelName,
          provider: 'gemini',
        };
      } catch (e) {
        console.error('Gemini PCB analysis failed, falling back to manual/local analysis:', e);
        const manual = createManualImageAnalysisProvider();
        return manual.analyzeImage(input);
      }
    },
  };
}
