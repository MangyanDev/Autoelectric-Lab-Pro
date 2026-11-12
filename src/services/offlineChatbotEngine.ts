import MiniSearch from 'minisearch';
import { ECU_BRAND_PROFILES } from '../components/EcuConnectorPinouts';
import { REPAIR_KNOWLEDGE_BASE } from '../components/EcuRepairKnowledgeBase';
import {
  DiagnosticTroubleCode,
  EcuPin,
  InjectedFault,
  MultimeterState,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';
import { SavedBenchSession, SavedDiagnosticLog } from './benchStorageService';

export type KnowledgeSourceKind =
  | 'OEM_MANUAL'
  | 'ECU_PINOUT'
  | 'PCB_HOTSPOT'
  | 'BENCH_PLAYBOOK'
  | 'SAVED_DB_LOG'
  | 'SAVED_BENCH';

export interface IndexedKnowledgeDoc {
  id: string;
  kind: KnowledgeSourceKind;
  title: string;
  subtitle: string;
  dtcCode: string;
  ecuModel: string;
  body: string;
  actionTab?: 'BENCH_LAB' | 'WIRING_DIAGRAM' | 'ECU_PINOUT' | 'OSCILLOSCOPE' | 'PCB_SCANNER' | 'REPAIR_GUIDE';
  targetPinId?: string;
}

export interface LiveBenchContext {
  powerSupply: PowerSupplyState;
  pins: EcuPin[];
  wires: WireConnection[];
  faults: InjectedFault[];
  activeDTCs: DiagnosticTroubleCode[];
  nodeVoltages: Record<string, number>;
  supplyCurrentDrawAmps: number;
  isSupplyCurrentTripped: boolean;
  multimeter: MultimeterState;
  multimeterDisplay: string;
  multimeterUnit: string;
  multimeterWarning?: string;
  selectedPinId: string | null;
}

export interface AssistantCitation {
  id: string;
  kind: KnowledgeSourceKind;
  title: string;
  subtitle: string;
  snippet: string;
  score: number;
  actionTab?: IndexedKnowledgeDoc['actionTab'];
  targetPinId?: string;
}

export interface OfflineAssistantReply {
  answer: string;
  citations: AssistantCitation[];
  suggestedPrompts: string[];
  indexedCount: number;
}

const BENCH_PLAYBOOKS: IndexedKnowledgeDoc[] = [
  {
    id: 'pb-p0122',
    kind: 'BENCH_PLAYBOOK',
    title: 'DTC P0122 — Throttle Position Sensor (TPS) Low Input (< 0.20V)',
    subtitle: 'Virtual Bench MNA Diagnostic Playbook · Pin 7 (TPS_SIG)',
    dtcCode: 'P0122',
    ecuModel: 'Universal ECU Bench',
    actionTab: 'BENCH_LAB',
    targetPinId: 'ecu-pin-7',
    body: [
      'Trigger Condition: MNA solver detects TPS_SIG (Pin 7) voltage < 0.20V while ignition is ON.',
      'Common Root Causes: Open circuit on TPS signal wire, broken 5V VREF supply (Pin 5), or TPS signal wire shorted directly to Chassis Ground (KL31).',
      'Bench Verification Steps:',
      '1. Attach Red (+) DMM probe to Pin 5 (VREF_5V) and Black (-) COM to Chassis GND (KL31). Verify 5.00V DC.',
      '2. Attach Red (+) probe to Pin 7 (TPS_SIG). At 20% idle throttle it should measure ~1.30V (0.5V at 0% to 4.5V at 100% WOT).',
      '3. Inspect the Wiring Canvas for a cut wire between comp-tps and ecu-pin-7, or check Fault Injection Matrix on Pin 7 for OPEN_CIRCUIT or SHORT_TO_GND.',
      '4. Switch PSU OFF, set DMM to OHMS, and verify continuity between Pin 7 and TPS wiper (< 1 Ohm).',
    ].join('\n'),
  },
  {
    id: 'pb-p0123',
    kind: 'BENCH_PLAYBOOK',
    title: 'DTC P0123 — Throttle Position Sensor (TPS) High Input (> 4.80V)',
    subtitle: 'Virtual Bench MNA Diagnostic Playbook · Pin 7 (TPS_SIG)',
    dtcCode: 'P0123',
    ecuModel: 'Universal ECU Bench',
    actionTab: 'BENCH_LAB',
    targetPinId: 'ecu-pin-7',
    body: [
      'Trigger Condition: MNA solver detects TPS_SIG (Pin 7) voltage > 4.80V while ignition is ON.',
      'Common Root Causes: TPS signal harness shorted to +12V battery (KL30/KL15), shorted to 5V VREF, or missing Sensor Clean Ground (SGND Pin 6).',
      'Bench Verification Steps:',
      '1. Measure Pin 7 (TPS_SIG) with DMM in V_DC mode. If reading ~12.6V, there is a SHORT_TO_VBAT fault.',
      '2. Measure Pin 6 (SGND) to Chassis GND. If floating above 0.2V, check for open ground or high resistance corrosion on Pin 6 / Pin 1.',
      '3. Clear or repair injected faults on Pin 7 and verify voltage returns to 0.50V - 4.50V range.',
    ].join('\n'),
  },
  {
    id: 'pb-p0117-p0118',
    kind: 'BENCH_PLAYBOOK',
    title: 'DTC P0117 / P0118 — Engine Coolant Temperature (ECT) NTC Sensor Fault',
    subtitle: 'Virtual Bench MNA Diagnostic Playbook · Pin 9 (ECT_SIG)',
    dtcCode: 'P0117 P0118',
    ecuModel: 'Universal ECU Bench',
    actionTab: 'BENCH_LAB',
    targetPinId: 'ecu-pin-9',
    body: [
      'Trigger Conditions: P0117 when ECT_SIG (Pin 9) < 0.15V (Short to GND). P0118 when ECT_SIG > 4.85V (Open Circuit pulled up to 5V via internal 2.2kOhm resistor).',
      'NTC Physics: Resistance drops as temperature rises (~2500 Ohm at 25C, ~250 Ohm at 85-90C).',
      'Bench Verification Steps:',
      '1. Probe Pin 9 (ECT_SIG) in V_DC mode. Nominal warm engine (85C) reads ~0.5V - 1.95V. Reading 5.00V means open thermistor circuit (P0118). Reading 0.00V means short to ground (P0117).',
      '2. Verify harness wire between comp-ect and Pin 9 is intact (not cut) and ECT ground return is bonded.',
    ].join('\n'),
  },
  {
    id: 'pb-u0001',
    kind: 'BENCH_PLAYBOOK',
    title: 'DTC U0001 — High-Speed CAN Bus Communication Malfunction (60Ω Termination)',
    subtitle: 'Virtual Bench MNA Diagnostic Playbook · Pins 13 (CAN_H) & 14 (CAN_L)',
    dtcCode: 'U0001',
    ecuModel: 'Universal ECU Bench',
    actionTab: 'OSCILLOSCOPE',
    targetPinId: 'ecu-pin-13',
    body: [
      'Trigger Condition: CAN_H (Pin 13) or CAN_L (Pin 14) drops below 0.3V or differential exceeds 3.0V.',
      'CAN Bus Physical Specification: Two 120 Ohm termination resistors wired in parallel must measure 60.0 Ohms across CAN_H and CAN_L with Power Supply OFF.',
      'Bench Verification Steps:',
      '1. Turn Bench Power Supply OFF (mandatory before using DMM Ohms mode to avoid live-circuit lockout).',
      '2. Place Red (+) DMM probe on Pin 13 (CAN_H) and Black (-) probe on Pin 14 (CAN_L) in OHMS mode.',
      '3. Expected reading: ~60 Ohms. Reading 120 Ohms means one terminator is open; reading < 5 Ohms means CAN lines are shorted together or to ground.',
      '4. Turn Power Supply ON and inspect Oscilloscope CAN_BUS mode: CAN_H toggles 2.5V to 3.5V, CAN_L toggles 2.5V to 1.5V.',
    ].join('\n'),
  },
  {
    id: 'pb-dmm-ohms-lockout',
    kind: 'BENCH_PLAYBOOK',
    title: 'DMM Live-Circuit Resistance Lockout & Continuity Beeper Guide',
    subtitle: 'Virtual Digital Multimeter Operation Rules',
    dtcCode: 'DMM-SAFE',
    ecuModel: 'Bench Multimeter',
    actionTab: 'BENCH_LAB',
    body: [
      'Never measure Resistance (Ohms) or Continuity on an energized circuit! When Bench Power Supply Output is ON and voltage is present, the Virtual DMM triggers a protective warning & lockout just like a real Fluke automotive meter.',
      'Procedure: Disable Power Supply Output (Key OFF) before switching DMM to OHMS or CONTINUITY (< 50 Ohm beeper).',
    ].join('\n'),
  },
  {
    id: 'pb-psu-ocp-trip',
    kind: 'BENCH_PLAYBOOK',
    title: 'Bench Power Supply Over-Current Protection (OCP) Trip & Short-Circuit Isolation',
    subtitle: 'KL30 (Pin 3) / KL15 (Pin 4) / Short-Circuit Protection',
    dtcCode: 'OCP-TRIP',
    ecuModel: 'Bench Power Supply',
    actionTab: 'BENCH_LAB',
    targetPinId: 'ecu-pin-3',
    body: [
      'Symptom: Total supply current draw hits or exceeds the Current Limit (default 5.0A) and PSU enters OCP trip.',
      'Cause: Direct short to Chassis Ground (KL31) on KL30 (+12V), KL15 Ignition, Injector driver, or shorted clamping diode (e.g., D301/D302 on Hitachi MEC22-251).',
      'Steps: Check Fault Injection Matrix for SHORT_TO_GND on power or actuator pins, verify no misplaced jumper wires from +12V to GND on Wiring Canvas, and inspect current draw telemetry.',
    ].join('\n'),
  },
  {
    id: 'pb-hitachi-mec11-guide',
    kind: 'BENCH_PLAYBOOK',
    title: 'Hitachi MEC11-251 / MEC22-251 Pure K-Line Bench Wakeup & OBD2 Routing',
    subtitle: 'Nissan Sentra / Almera / Sunny N16 (QG16DE) · ISO-9141',
    dtcCode: 'MEC11 MEC22 K-LINE',
    ecuModel: 'Nissan Hitachi MEC11-251 / MEC22-251',
    actionTab: 'ECU_PINOUT',
    body: [
      'Critical Wiring Rule: Hitachi MEC11-251 / MEC22-251 uses pure ISO-9141 K-Line on Pin 88 (or Pin 85) wired to OBD2 Pin 7. Leave Pins 86 & 94 DISCONNECTED (they are internal TCU CAN lines, not OBD2 diagnostic CAN!).',
      'Required Bench Hookup:',
      '- ECU Pin 67 (or 121): +12V Constant Battery (+B) via 5A/10A inline fuse (also OBD2 Pin 16).',
      '- ECU Pin 36 (or 109): +12V Switched Ignition toggle to wake internal EGI relay.',
      '- ECU Pin 48 (or 1 / 57 / 115 / 116): Chassis Ground (-) & OBD2 Pins 4 & 5.',
      '- ECU Pin 88 (or 85): K-Line Data to OBD2 Pin 7.',
    ].join('\n'),
  },
];

function buildBaseDocuments(): IndexedKnowledgeDoc[] {
  const docs: IndexedKnowledgeDoc[] = [...BENCH_PLAYBOOKS];

  // 1. Index all OEM Repair Knowledge Base manuals
  for (const art of REPAIR_KNOWLEDGE_BASE) {
    const symptomsText = art.symptoms.join(' | ');
    const causesText = art.rootCauses
      .map((c) => `${c.cause} (${c.severity}): ${c.description}`)
      .join(' | ');
    const stepsText = art.repairSteps
      .map((s) => `Step ${s.stepNum}: ${s.action} [${s.specification}]`)
      .join('\n');

    docs.push({
      id: `manual_${art.id}`,
      kind: 'OEM_MANUAL',
      title: art.title,
      subtitle: `${art.dtcCode} · ${art.vehicleModel}`,
      dtcCode: art.dtcCode,
      ecuModel: art.vehicleModel,
      actionTab: 'REPAIR_GUIDE',
      body: [
        `Symptoms: ${symptomsText}`,
        `Root Causes: ${causesText}`,
        art.cpuArchitecture ? `Architecture: ${art.cpuArchitecture}` : '',
        art.hardwareNote ? `Hardware Note: ${art.hardwareNote}` : '',
        `Repair Procedure:\n${stepsText}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  // 2. Index all 9 ECU Brand Profiles, their pinouts, and PCB hotspots
  for (const brand of ECU_BRAND_PROFILES) {
    docs.push({
      id: `ecu_profile_${brand.id}`,
      kind: 'ECU_PINOUT',
      title: `${brand.brandName} — ${brand.modelName}`,
      subtitle: `${brand.cavityInfo} · ${brand.popularVehiclesInPH}`,
      dtcCode: '',
      ecuModel: `${brand.brandName} ${brand.modelName}`,
      actionTab: 'ECU_PINOUT',
      body: `${brand.description}\nPopular Vehicles: ${brand.popularVehiclesInPH}\nKey Bench Pins: ${brand.pinouts
        .slice(0, 12)
        .map((p) => `Pin ${p.pinNumber} ${p.label} (${p.signalName}, ${p.nominalVoltage}V)`)
        .join('; ')}`,
    });

    for (const pin of brand.pinouts) {
      docs.push({
        id: `pin_${brand.id}_${pin.plug}_${pin.pinNumber}`,
        kind: 'ECU_PINOUT',
        title: `${brand.brandName} ${brand.modelName.split('(')[0].trim()} — Pin ${pin.pinNumber} (${pin.label})`,
        subtitle: `${pin.plug} · ${pin.signalName} · ${pin.wireColor} · ${pin.nominalVoltage}V`,
        dtcCode: '',
        ecuModel: `${brand.brandName} ${brand.modelName}`,
        actionTab: 'ECU_PINOUT',
        targetPinId: pin.associatedSimPinId,
        body: [
          `Pin ${pin.pinNumber} (${pin.label}) on ${brand.modelName}, Plug ${pin.plug}.`,
          `Signal: ${pin.signalName} (${pin.category}), Wire Color: ${pin.wireColor}, Nominal Voltage: ${pin.nominalVoltage}V.`,
          `Bench Role: ${pin.benchRole}`,
          `Connection Instruction: ${pin.connectionInstruction}`,
          `Electrical Spec: ${pin.electricalSpec}`,
        ].join('\n'),
      });
    }

    if (brand.pcbComponents) {
      for (const comp of brand.pcbComponents) {
        docs.push({
          id: `pcb_${brand.id}_${comp.id}`,
          kind: 'PCB_HOTSPOT',
          title: `${brand.brandName} PCB Component: ${comp.name} (${comp.designation})`,
          subtitle: `${brand.modelName.split('(')[0].trim()} · ${comp.spec}`,
          dtcCode: '',
          ecuModel: `${brand.brandName} ${brand.modelName}`,
          actionTab: 'ECU_PINOUT',
          targetPinId: comp.associatedSimPinId,
          body: [
            `PCB Hotspot ${comp.name} [${comp.designation}], Type: ${comp.type}.`,
            `Specification: ${comp.spec}.`,
            `Diagnostic Role: ${comp.diagnosticRole}`,
            comp.associatedPins ? `Associated Connector Pins: ${comp.associatedPins}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        });
      }
    }
  }

  return docs;
}

const BASE_DOCS = buildBaseDocuments();

export class OfflineDiagnosticChatbot {
  private miniSearch: MiniSearch<IndexedKnowledgeDoc>;
  private docsMap: Map<string, IndexedKnowledgeDoc>;

  constructor(
    savedLogs: SavedDiagnosticLog[] = [],
    savedSessions: SavedBenchSession[] = []
  ) {
    this.docsMap = new Map<string, IndexedKnowledgeDoc>();
    this.miniSearch = new MiniSearch<IndexedKnowledgeDoc>({
      fields: ['title', 'subtitle', 'dtcCode', 'ecuModel', 'body'],
      storeFields: ['id', 'kind', 'title', 'subtitle', 'dtcCode', 'ecuModel', 'body', 'actionTab', 'targetPinId'],
      searchOptions: {
        boost: { dtcCode: 4, title: 3, ecuModel: 2.5, subtitle: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });

    const allDocs: IndexedKnowledgeDoc[] = [...BASE_DOCS];

    for (const log of savedLogs) {
      allDocs.push({
        id: `dblog_${log.id}`,
        kind: 'SAVED_DB_LOG',
        title: log.title,
        subtitle: `Saved Diagnostic Log · ${log.dtcCode || log.sourceType} · ${log.ecuModel || 'User Note'}`,
        dtcCode: log.dtcCode || '',
        ecuModel: log.ecuModel || '',
        body: log.summary,
      });
    }

    for (const sess of savedSessions) {
      allDocs.push({
        id: `dbsess_${sess.id}`,
        kind: 'SAVED_BENCH',
        title: `Saved Bench Workspace: ${sess.title}`,
        subtitle: `${sess.ecuProfileLabel} · ${sess.activeDtcs?.length ? `DTCs: ${sess.activeDtcs.join(', ')}` : 'Nominal'}`,
        dtcCode: (sess.activeDtcs || []).join(' '),
        ecuModel: sess.ecuProfileLabel,
        body: [
          sess.notes || 'Saved custom bench wiring and fault configuration.',
          `PSU: ${sess.powerSupply?.voltageSetting ?? 12.6}V, Draw: ${sess.supplyCurrentDrawAmps ?? 0}A`,
          `Faults: ${(sess.faults || []).map((f) => `${f.pinId} ${f.faultType} (${f.description})`).join('; ') || 'None'}`,
        ].join('\n'),
      });
    }

    for (const d of allDocs) {
      this.docsMap.set(d.id, d);
    }
    this.miniSearch.addAll(allDocs);
  }

  get indexedCount(): number {
    return this.docsMap.size;
  }

  ask(rawQuery: string, liveCtx: LiveBenchContext): OfflineAssistantReply {
    const q = rawQuery.trim();
    const lower = q.toLowerCase();

    const wantsLiveBenchDiagnosis =
      lower.includes('current bench') ||
      lower.includes('my bench') ||
      lower.includes('diagnose') ||
      lower.includes('what is wrong') ||
      lower.includes("what's wrong") ||
      lower.includes('active fault') ||
      lower.includes('active dtc') ||
      lower.includes('why is') ||
      lower.includes('troubleshoot now') ||
      lower.includes('status');

    // Run MiniSearch BM25+ full-text + fuzzy retrieval
    const effectiveQuery =
      wantsLiveBenchDiagnosis && liveCtx.activeDTCs.length > 0
        ? `${q} ${liveCtx.activeDTCs.map((d) => d.code).join(' ')}`
        : q;

    const searchResults = effectiveQuery
      ? this.miniSearch.search(effectiveQuery, { combineWith: 'OR' }).slice(0, 5)
      : [];

    const citations: AssistantCitation[] = searchResults.map((hit) => {
      const full = this.docsMap.get(hit.id);
      const bodyStr = full?.body || '';
      const firstLines = bodyStr.split('\n').slice(0, 3).join(' ');
      return {
        id: hit.id,
        kind: (full?.kind || 'OEM_MANUAL') as KnowledgeSourceKind,
        title: full?.title || String(hit.title || ''),
        subtitle: full?.subtitle || String(hit.subtitle || ''),
        snippet: firstLines.length > 220 ? `${firstLines.slice(0, 217)}...` : firstLines,
        score: Math.round(hit.score * 10) / 10,
        actionTab: full?.actionTab,
        targetPinId: full?.targetPinId,
      };
    });

    const sections: string[] = [];

    // 1. Live MNA Bench Telemetry Diagnosis (if relevant or if faults exist)
    if (wantsLiveBenchDiagnosis || (liveCtx.activeDTCs.length > 0 && lower.includes('help'))) {
      sections.push(this.buildLiveBenchDiagnosis(liveCtx));
    }

    // 2. Selected Pin Inspection context if user asks about selected/current pin
    if (
      (lower.includes('selected pin') || lower.includes('this pin') || lower.includes('current pin')) &&
      liveCtx.selectedPinId
    ) {
      const pin = liveCtx.pins.find((p) => p.id === liveCtx.selectedPinId);
      if (pin) {
        const v = liveCtx.nodeVoltages[pin.id];
        const pinFault = liveCtx.faults.find((f) => f.pinId === pin.id);
        sections.push(
          [
            `LIVE PIN TELEMETRY — ${pin.label} (Pin #${pin.pinNumber}: ${pin.name}):`,
            `• Measured MNA Voltage: ${v !== undefined ? `${v.toFixed(2)}V` : 'Floating'} (Nominal: ${pin.nominalVoltage.toFixed(2)}V)`,
            `• Internal Resistance: ${pin.internalResistance}Ω | Role: ${pin.description}`,
            pinFault
              ? `• ACTIVE FAULT ON THIS PIN: ${pinFault.faultType} — ${pinFault.description}. Clear or repair this in the Fault Injection Matrix.`
              : `• No injected fault directly assigned to ${pin.label}.`,
          ].join('\n')
        );
      }
    }

    // 3. Top Knowledge Base Matches from MiniSearch
    if (searchResults.length > 0) {
      const topDoc = this.docsMap.get(searchResults[0].id);
      if (topDoc) {
        sections.push(
          [
            `MATCHED PROJECT KNOWLEDGE (${topDoc.kind.replace(/_/g, ' ')}):`,
            `**${topDoc.title}**`,
            topDoc.subtitle ? `Context: ${topDoc.subtitle}` : '',
            '',
            topDoc.body,
          ]
            .filter((line) => line !== undefined)
            .join('\n')
        );
      }

      if (searchResults.length > 1) {
        const secondary = searchResults
          .slice(1, 3)
          .map((r) => {
            const docItem = this.docsMap.get(r.id);
            if (!docItem) return null;
            const summaryLine = docItem.body.split('\n')[0] || '';
            return `• **${docItem.title}** (${docItem.subtitle}): ${summaryLine}`;
          })
          .filter(Boolean);
        if (secondary.length > 0) {
          sections.push(`RELATED DATABASE REFERENCES:\n${secondary.join('\n')}`);
        }
      }
    } else if (sections.length === 0) {
      sections.push(
        [
          `No exact keyword match found for "${q}" in the offline knowledge index (${this.indexedCount} records).`,
          'Try asking with a specific ECU model (e.g. "Hitachi MEC11", "Marelli 5NF", "Toyota 1KD", "Bosch ME7.5", "Ford SID208"), a component ("R701 shunt", "TLE9135PD", "D301 diode"), a DTC ("P0122", "P0093", "U0001"), or ask "Diagnose my current bench".',
        ].join('\n\n')
      );
    }

    const suggestedPrompts = this.buildSuggestedPrompts(liveCtx, citations);

    return {
      answer: sections.join('\n\n---\n\n'),
      citations,
      suggestedPrompts,
      indexedCount: this.indexedCount,
    };
  }

  private buildLiveBenchDiagnosis(ctx: LiveBenchContext): string {
    const lines: string[] = ['LIVE BENCH MNA SOLVER DIAGNOSIS:'];
    const cutWires = ctx.wires.filter((w) => w.isCut);

    if (!ctx.powerSupply.isOutputEnabled) {
      lines.push(
        `• Power Supply Output is OFF (${ctx.powerSupply.voltageSetting.toFixed(1)}V preset). Enable PSU Output to energize KL30/KL15 rails for live voltage & DTC evaluation.`
      );
    } else if (ctx.isSupplyCurrentTripped) {
      lines.push(
        `• CRITICAL: Bench Power Supply OCP TRIPPED at ${ctx.supplyCurrentDrawAmps.toFixed(2)}A (limit ${ctx.powerSupply.currentLimit.toFixed(1)}A)! Check for SHORT_TO_GND faults or direct +12V-to-GND jumpers.`
      );
    } else {
      lines.push(
        `• Power Supply: ${ctx.powerSupply.voltageSetting.toFixed(1)}V ON, Draw: ${ctx.supplyCurrentDrawAmps.toFixed(2)}A (Nominal).`
      );
    }

    if (ctx.multimeterWarning) {
      lines.push(`• DMM Safety Alert: ${ctx.multimeterWarning}`);
    } else {
      lines.push(
        `• DMM Reading: ${ctx.multimeterDisplay} ${ctx.multimeterUnit} (Red: ${ctx.multimeter.redProbe.attachedLabel}, Black: ${ctx.multimeter.blackProbe.attachedLabel}).`
      );
    }

    if (cutWires.length > 0) {
      lines.push(
        `• Open Harness Leads Detected (${cutWires.length}): ${cutWires.map((w) => w.label).join(', ')}. Click the cut wire on the Wiring Canvas to reconnect it.`
      );
    }

    if (ctx.faults.length > 0) {
      lines.push(
        `• Injected Faults (${ctx.faults.length}): ${ctx.faults.map((f) => `${f.pinId} -> ${f.faultType} (${f.description})`).join('; ')}.`
      );
    }

    if (ctx.activeDTCs.length === 0) {
      lines.push('• OBD-II Monitor: 0 Active DTCs. All monitored sensor/CAN thresholds are nominal.');
    } else {
      lines.push(
        `• Active OBD-II DTCs (${ctx.activeDTCs.length}): ${ctx.activeDTCs
          .map((d) => `${d.code} [${d.severity}] - ${d.description}`)
          .join('; ')}.`
      );
    }

    return lines.join('\n');
  }

  private buildSuggestedPrompts(
    ctx: LiveBenchContext,
    citations: AssistantCitation[]
  ): string[] {
    const suggestions: string[] = [];

    if (ctx.activeDTCs.length > 0) {
      suggestions.push(`How do I fix ${ctx.activeDTCs[0].code}?`);
    } else {
      suggestions.push('Diagnose my current bench');
    }

    if (citations.some((c) => c.id.includes('mec11') || c.id.includes('mec22'))) {
      suggestions.push('Hitachi MEC22 R701 shunt test');
      suggestions.push('Why leave Pins 86 and 94 disconnected?');
    } else {
      suggestions.push('Hitachi MEC11 K-Line wakeup pins');
      suggestions.push('Marelli IAW 5NF water temp jumper');
    }

    suggestions.push('CAN Bus 60 Ohm termination test');
    return suggestions.slice(0, 4);
  }
}
