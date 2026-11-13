import {
  DiagnosticTroubleCode,
  EcuPin,
  InjectedFault,
  MultimeterState,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';
import { CircuitSolution } from '../utils/circuitSolver';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DOCS_API_BASE = 'https://docs.googleapis.com/v1';

export class GoogleWorkspaceAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'GoogleWorkspaceAuthError';
    this.status = status;
  }
}

export interface GoogleDriveDocItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

export interface DocBlock {
  type: 'HEADING' | 'PARAGRAPH' | 'BULLET' | 'TABLE';
  level?: number;
  text?: string;
  rows?: string[][];
}

export interface ParsedGoogleDoc {
  documentId: string;
  title: string;
  revisionId?: string;
  endIndex: number;
  plainText: string;
  blocks: DocBlock[];
}

export interface BenchDocTelemetryPayload {
  ecuProfileLabel: string;
  powerSupply: PowerSupplyState;
  pins: EcuPin[];
  wires: WireConnection[];
  faults: InjectedFault[];
  multimeter: MultimeterState;
  circuitSolution: CircuitSolution;
  technicianNotes?: string;
}

async function workspaceFetch<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new GoogleWorkspaceAuthError(
      'Your Google Workspace session expired. Please sign in with Google again.',
      401
    );
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
  }

  if (!res.ok) {
    const apiErr = (json.error as { message?: string } | undefined)?.message;
    if (res.status === 403) {
      throw new GoogleWorkspaceAuthError(
        apiErr || 'Google Docs/Drive permission missing or denied. Re-authorize with Google.',
        403
      );
    }
    throw new Error(apiErr || `Google API request failed (${res.status})`);
  }

  return json as T;
}

/**
 * List the user's Google Docs via Drive API v3.
 */
export async function listGoogleDocs(
  accessToken: string,
  searchQuery = ''
): Promise<GoogleDriveDocItem[]> {
  const escaped = searchQuery.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const qParts = [
    "mimeType='application/vnd.google-apps.document'",
    'trashed=false',
  ];
  if (escaped) {
    qParts.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: qParts.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: '25',
    fields: 'files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))',
  });

  const data = await workspaceFetch<{ files?: GoogleDriveDocItem[] }>(
    `${DRIVE_API_BASE}/files?${params.toString()}`,
    accessToken
  );

  return data.files || [];
}

interface DocsParagraphElement {
  textRun?: { content?: string };
}

interface DocsStructuralElement {
  endIndex?: number;
  paragraph?: {
    bullet?: unknown;
    paragraphStyle?: { namedStyleType?: string };
    elements?: DocsParagraphElement[];
  };
  table?: {
    tableRows?: {
      tableCells?: {
        content?: DocsStructuralElement[];
      }[];
    }[];
  };
}

interface RawGoogleDocument {
  documentId: string;
  title?: string;
  revisionId?: string;
  body?: {
    content?: DocsStructuralElement[];
  };
}

function readParagraphText(elements?: DocsParagraphElement[]): string {
  if (!elements) return '';
  return elements.map((el) => el.textRun?.content || '').join('');
}

function parseDocStructure(raw: RawGoogleDocument): ParsedGoogleDoc {
  const content = raw.body?.content || [];
  const blocks: DocBlock[] = [];
  const plainLines: string[] = [];
  let maxEndIndex = 1;

  for (const el of content) {
    if (typeof el.endIndex === 'number' && el.endIndex > maxEndIndex) {
      maxEndIndex = el.endIndex;
    }

    if (el.paragraph) {
      const text = readParagraphText(el.paragraph.elements).replace(/\n+$/, '');
      if (text.trim().length > 0) {
        plainLines.push(text);
        const namedStyle = el.paragraph.paragraphStyle?.namedStyleType || '';
        if (el.paragraph.bullet) {
          blocks.push({ type: 'BULLET', text });
        } else if (namedStyle === 'TITLE' || namedStyle === 'HEADING_1') {
          blocks.push({ type: 'HEADING', level: 1, text });
        } else if (namedStyle === 'HEADING_2' || namedStyle === 'SUBTITLE') {
          blocks.push({ type: 'HEADING', level: 2, text });
        } else if (namedStyle.startsWith('HEADING_')) {
          blocks.push({ type: 'HEADING', level: 3, text });
        } else {
          blocks.push({ type: 'PARAGRAPH', text });
        }
      }
    } else if (el.table) {
      const rows: string[][] = [];
      for (const row of el.table.tableRows || []) {
        const rowCells: string[] = [];
        for (const cell of row.tableCells || []) {
          const cellText = (cell.content || [])
            .map((c) => readParagraphText(c.paragraph?.elements))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          rowCells.push(cellText);
        }
        rows.push(rowCells);
        if (rowCells.some(Boolean)) {
          plainLines.push(rowCells.join(' | '));
        }
      }
      if (rows.length > 0) {
        blocks.push({ type: 'TABLE', rows });
      }
    }
  }

  return {
    documentId: raw.documentId,
    title: raw.title || 'Untitled Document',
    revisionId: raw.revisionId,
    endIndex: maxEndIndex,
    plainText: plainLines.join('\n'),
    blocks,
  };
}

/**
 * Fetch and parse a Google Doc's content using Docs API v1.
 */
export async function getGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<ParsedGoogleDoc> {
  const raw = await workspaceFetch<RawGoogleDocument>(
    `${DOCS_API_BASE}/documents/${encodeURIComponent(documentId)}`,
    accessToken
  );
  return parseDocStructure(raw);
}

/**
 * Build a deterministic, 100% MNA-derived ECU Bench Diagnostic Report text body.
 */
export function buildBenchReportText(payload: BenchDocTelemetryPayload): string {
  const {
    ecuProfileLabel,
    powerSupply,
    pins,
    wires,
    faults,
    multimeter,
    circuitSolution,
    technicianNotes,
  } = payload;

  const timestamp = new Date().toISOString();
  const activeWires = wires.filter((w) => !w.isCut).length;
  const cutWires = wires.filter((w) => w.isCut);

  const pinRows = pins.map((pin) => {
    const v = circuitSolution.nodeVoltages[pin.id];
    const vStr = typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(3)} V` : 'N/A';
    const fault = faults.find((f) => f.pinId === pin.id);
    const faultStr = fault ? ` [FAULT: ${fault.faultType}]` : '';
    return `Pin ${String(pin.pinNumber).padStart(2, '0')} (${pin.label} - ${pin.name}): ${vStr} (Nom: ${pin.nominalVoltage.toFixed(2)} V)${faultStr}`;
  });

  const dtcLines =
    circuitSolution.activeDTCs.length > 0
      ? circuitSolution.activeDTCs.map(
          (dtc: DiagnosticTroubleCode) =>
            `- ${dtc.code} [${dtc.severity} / ${dtc.system}]: ${dtc.description}`
        )
      : ['- None (0 Active DTCs)'];

  const faultLines =
    faults.length > 0
      ? faults.map((f) => `- ${f.pinId}: ${f.faultType} (${f.description})`)
      : ['- None injected'];

  const sections = [
    `ECU BENCH DIAGNOSTIC REPORT — ${ecuProfileLabel}`,
    `Generated: ${timestamp}`,
    '',
    '1. POWER SUPPLY & MNA BUS TELEMETRY',
    `- Output State: ${powerSupply.isOutputEnabled ? 'ENABLED' : 'DISABLED'} (${powerSupply.preset})`,
    `- Voltage Setting: ${powerSupply.voltageSetting.toFixed(2)} V | Current Limit: ${powerSupply.currentLimit.toFixed(2)} A`,
    `- Measured Bus Draw (MNA): ${circuitSolution.supplyCurrentDrawAmps.toFixed(3)} A${circuitSolution.isSupplyCurrentTripped ? ' [OVER-CURRENT TRIP]' : ''}`,
    '',
    '2. DIGITAL MULTIMETER (DMM) PROBE MEASUREMENT',
    `- Mode: ${multimeter.isPowered ? multimeter.mode : 'POWERED OFF'}`,
    `- Red Probe (+): ${multimeter.redProbe.attachedLabel}`,
    `- Black COM (-): ${multimeter.blackProbe.attachedLabel}`,
    `- Live Reading: ${circuitSolution.multimeterReading.display} ${circuitSolution.multimeterReading.unit}${circuitSolution.multimeterReading.warningMessage ? ` (${circuitSolution.multimeterReading.warningMessage})` : ''}`,
    '',
    '3. ACTIVE OBD-II DIAGNOSTIC TROUBLE CODES (DTCs)',
    ...dtcLines,
    '',
    '4. INJECTED FAULTS & HARNESS CONTINUITY',
    `- Harness Wires: ${activeWires} Active / ${wires.length} Total (${cutWires.length} Open/Cut)`,
    ...faultLines,
    ...(cutWires.length > 0
      ? cutWires.map((w) => `- Open Harness Lead: ${w.label} (${w.sourcePinId} <-> ${w.targetPinId})`)
      : []),
    '',
    '5. LIVE MNA ECU PIN NODE VOLTAGES',
    ...pinRows,
  ];

  if (technicianNotes && technicianNotes.trim()) {
    sections.push('', '6. TECHNICIAN REPAIR & BENCH NOTES', technicianNotes.trim());
  }

  return sections.join('\n') + '\n';
}

/**
 * Create a new Google Doc and populate it with the MNA Bench Diagnostic Report.
 */
export async function createBenchReportDoc(
  accessToken: string,
  title: string,
  bodyText: string
): Promise<{ documentId: string; title: string; webViewLink: string }> {
  const cleanTitle = title.trim() || `ECU Bench Diagnostic Report (${new Date().toLocaleDateString()})`;
  const created = await workspaceFetch<{ documentId: string; title: string }>(
    `${DOCS_API_BASE}/documents`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ title: cleanTitle }),
    }
  );

  const normalizedBody = bodyText.endsWith('\n') ? bodyText : `${bodyText}\n`;
  const firstNewline = normalizedBody.indexOf('\n');
  const titleLength = firstNewline > 0 ? firstNewline : normalizedBody.length;

  const requests: Record<string, unknown>[] = [
    {
      insertText: {
        location: { index: 1 },
        text: normalizedBody,
      },
    },
  ];

  if (titleLength > 0) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: 1 + titleLength },
        paragraphStyle: { namedStyleType: 'HEADING_1' },
        fields: 'namedStyleType',
      },
    });
  }

  await workspaceFetch(
    `${DOCS_API_BASE}/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    }
  );

  return {
    documentId: created.documentId,
    title: created.title || cleanTitle,
    webViewLink: `https://docs.google.com/document/d/${created.documentId}/edit`,
  };
}

/**
 * Append text to the end of an existing Google Doc (MUST be user-confirmed before calling).
 */
export async function appendToGoogleDoc(
  accessToken: string,
  documentId: string,
  textToAppend: string
): Promise<ParsedGoogleDoc> {
  const current = await getGoogleDoc(accessToken, documentId);
  const insertIndex = Math.max(1, current.endIndex - 1);
  const prefix = current.plainText.length > 0 ? '\n\n' : '';
  const payloadText = `${prefix}${textToAppend.trim()}\n`;

  await workspaceFetch(
    `${DOCS_API_BASE}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: payloadText,
            },
          },
        ],
      }),
    }
  );

  return getGoogleDoc(accessToken, documentId);
}

/**
 * Overwrite an existing Google Doc body with updated text (MUST be user-confirmed before calling).
 */
export async function replaceGoogleDocBody(
  accessToken: string,
  documentId: string,
  newBodyText: string
): Promise<ParsedGoogleDoc> {
  const current = await getGoogleDoc(accessToken, documentId);
  const requests: Record<string, unknown>[] = [];

  if (current.endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: current.endIndex - 1,
        },
      },
    });
  }

  const normalized = newBodyText.endsWith('\n') ? newBodyText : `${newBodyText}\n`;
  requests.push({
    insertText: {
      location: { index: 1 },
      text: normalized,
    },
  });

  await workspaceFetch(
    `${DOCS_API_BASE}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ requests }),
    }
  );

  return getGoogleDoc(accessToken, documentId);
}

/**
 * Move a Google Doc to Drive Trash (MUST be user-confirmed before calling).
 */
export async function trashGoogleDoc(accessToken: string, documentId: string): Promise<void> {
  await workspaceFetch(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(documentId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ trashed: true }),
    }
  );
}
