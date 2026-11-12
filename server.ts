import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { getImageAnalysisProvider } from './src/server/services/imageAnalysisProvider';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const rootDir = process.cwd();

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post('/api/autoelectric/analyze-schematic', async (req, res) => {
    try {
      const { imageBase64, documentName, documentType, regionBox } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid imageBase64 payload' });
      }
      if (!documentName || typeof documentName !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid documentName' });
      }
      if (!documentType || typeof documentType !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid documentType' });
      }

      // Check decoded size limit (max 8MB)
      const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
      if (approxBytes > 8 * 1024 * 1024) {
        return res.status(413).json({ error: 'Payload exceeds maximum 8MB size limit' });
      }

      const provider = getImageAnalysisProvider();
      const result = await provider.analyzeImage({
        imageBase64,
        documentName,
        documentType,
        regionBox,
      });

      res.json({
        status: 'SUCCESS',
        analysis: result,
        model: result.model,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      console.error('Schematic analysis error:', msg);
      res.status(500).json({ error: 'Image analysis service failure. Manual review remains available.' });
    }
  });

  // Google Search Grounding for Live OEM Bulletins, ECU Pinouts, & Diagnostic Procedures
  app.post('/api/autoelectric/grounded-search', async (req, res) => {
    try {
      const { query, ecuModel, dtcCode, contextType, customPrompt } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid search query' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'Gemini API Key is not configured. Please check Settings > Secrets.',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Use gemini-4-hydrogen with Google Search tool as required
      const modelName = process.env.GEMINI_SEARCH_MODEL || 'gemini-4-hydrogen';

      const systemInstruction = `You are an elite Master Automotive Electronics Engineer, ECU Benchmark Specialist, and TSB Diagnostic Authority.
Your mission is to provide rigorous, factory-grade diagnostic procedures, verified ECU bench pinouts (KL30 +12V battery, KL15 ignition switch, KL31 chassis/sensor ground, K-Line Pin 7, CAN-H Pin 6, CAN-L Pin 14, 5V reference, actuator drivers), known hardware failure root-causes (e.g., burnt 0.028Ω or 1Ω current-sense shunts, shorted TVS diodes, cracked PCB traces, driver IC breakdowns like TLE9135PD or MC33186DH), and step-by-step bench testing instructions.
Always specify physical test parameters: DC Volts, Resistance in Ohms, current draw in Amps, and oscilloscope waveform characteristics.
Structure your findings clearly with:
- Diagnostic Summary & Known OEM Issues / TSBs
- Verified Bench Wiring & Pinout Guide
- Step-by-Step Bench Testing & Voltage/Ohmic Specifications
- Component-Level PCB Repair / Hotspot Guidance
Maintain professional, high-fidelity engineering terminology.`;

      const prompt = `Vehicle / ECU Diagnostic Inquiry:
Target Issue / Query: "${query}"
${ecuModel ? `ECU Model / Hardware: ${ecuModel}` : ''}
${dtcCode ? `Diagnostic Trouble Code (DTC): ${dtcCode}` : ''}
${contextType ? `Operational Context: ${contextType}` : ''}
${customPrompt ? `Additional Field Observations: ${customPrompt}` : ''}

Execute Google Search Grounding to retrieve up-to-date OEM technical service bulletins, factory service manual wiring pinouts, verified fix patterns, and technician bench experiences. Provide an in-depth, authoritative report.`;

      const candidateModels = [
        process.env.GEMINI_SEARCH_MODEL || 'gemini-4-hydrogen',
        'gemini-3.8-flash',
      ];

      let response = null;
      let usedModel = candidateModels[0];
      let lastError: unknown = null;

      for (const m of candidateModels) {
        try {
          usedModel = m;
          response = await ai.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
            },
          });
          if (response) break;
        } catch (err) {
          lastError = err;
          console.warn(`Model ${m} search failed, trying next candidate...`);
        }
      }

      if (!response) {
        throw lastError || new Error('All model candidates failed to retrieve search results');
      }

      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const rawChunks = (groundingMetadata as { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> })?.groundingChunks || [];
      const searchQueries = (groundingMetadata as { webSearchQueries?: string[] })?.webSearchQueries || [];

      // Extract verified web sources with titles and URIs
      const webSources = rawChunks
        .map((chunk) => {
          if (chunk.web && chunk.web.uri) {
            let domain = '';
            try {
              domain = new URL(chunk.web.uri).hostname.replace('www.', '');
            } catch {
              domain = 'web';
            }
            return {
              title: chunk.web.title || domain,
              uri: chunk.web.uri,
              domain,
            };
          }
          return null;
        })
        .filter((s): s is { title: string; uri: string; domain: string } => s !== null);

      res.json({
        status: 'SUCCESS',
        answer: response.text || 'No diagnostic response generated.',
        sources: webSources,
        searchQueries,
        model: usedModel,
        timestamp: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Grounding search failed';
      console.error('Grounding search error:', msg);
      res.status(500).json({
        error: 'Google Search Grounding service failed to retrieve results.',
        details: msg,
      });
    }
  });

  app.get('/api/autoelectric/health', (_req, res) => {
    const provider = process.env.IMAGE_ANALYSIS_PROVIDER || 'manual';
    const hasKey = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
    res.json({
      status: 'ONLINE',
      serviceMode: provider === 'manual' ? 'MANUAL_REVIEW' : 'AI_IMAGE_ANALYSIS',
      hasApiKey: hasKey,
      imageAnalysisProvider: provider,
      timestamp: new Date().toISOString(),
    });
  });

  if (!isProduction) {
    // Development mode with Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    // Serve HTML with Vite dev transform for HMR & script loading
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(rootDir, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));

    app.use('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Autoelectric Lab server listening on http://0.0.0.0:${port} [${isProduction ? 'PROD' : 'DEV'}]`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
