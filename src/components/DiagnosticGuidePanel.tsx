import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cpu,
  FileText,
  Gauge,
  Link2,
  PanelRightClose,
  Play,
  Scissors,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { DiagnosticReportModal } from './DiagnosticReportModal';
import { BatchPinDiagnosticModal } from './BatchPinDiagnosticModal';
import {
  DiagnosticTroubleCode,
  EcuPin,
  InjectedFault,
  MultimeterState,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';

type LabTab =
  | 'BENCH_LAB'
  | 'WIRING_DIAGRAM'
  | 'THREE_D_TWIN'
  | 'ECU_PINOUT'
  | 'OSCILLOSCOPE'
  | 'PCB_SCANNER'
  | 'REPAIR_GUIDE';

interface DiagnosticGuidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  powerSupply: PowerSupplyState;
  pins: EcuPin[];
  wires: WireConnection[];
  faults: InjectedFault[];
  activeDTCs: DiagnosticTroubleCode[];
  nodeVoltages: Record<string, number>;
  supplyCurrentDrawAmps: number;
  isSupplyCurrentTripped: boolean;
  multimeter: MultimeterState;
  multimeterReading: {
    display: string;
    unit: string;
    isWarning: boolean;
    warningMessage?: string;
  };
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onNavigateTab: (tab: LabTab, pinId?: string) => void;
  onOpenOfflineBot: (prompt?: string) => void;
}

type StepStatus = 'done' | 'attention' | 'active' | 'pending';

interface DiagnosticStep {
  id: number;
  title: string;
  summary: string;
  guidance: string;
  status: StepStatus;
  ctaLabel?: string;
  onCta?: () => void;
}

export const DiagnosticGuidePanel: React.FC<DiagnosticGuidePanelProps> = ({
  isOpen,
  onClose,
  powerSupply,
  pins,
  wires,
  faults,
  activeDTCs,
  nodeVoltages,
  supplyCurrentDrawAmps,
  isSupplyCurrentTripped,
  multimeter,
  multimeterReading,
  selectedPinId,
  onSelectPin,
  onNavigateTab,
  onOpenOfflineBot,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const cutWires = useMemo(() => wires.filter((w) => w.isCut), [wires]);
  const selectedPin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) || null,
    [pins, selectedPinId]
  );

  const kl30V = nodeVoltages['ecu-pin-3'] ?? 0;
  const kl31V = nodeVoltages['ecu-pin-1'] ?? 0;
  const powerRailHealthy =
    powerSupply.isOutputEnabled &&
    !isSupplyCurrentTripped &&
    kl30V >= 10.5 &&
    Math.abs(kl31V) <= 0.6;

  const probeSeated = Boolean(
    multimeter.isPowered &&
      multimeter.redProbe.attachedToPinId &&
      multimeter.blackProbe.attachedToPinId
  );

  const hasFaultOrCut = faults.length > 0 || cutWires.length > 0;

  const steps: DiagnosticStep[] = useMemo(() => {
    const firstFault = faults[0];
    const firstFaultPin = firstFault ? pins.find((p) => p.id === firstFault.pinId) : null;
    const firstCutWire = cutWires[0];

    const step1Status: StepStatus = !powerSupply.isOutputEnabled
      ? 'active'
      : activeDTCs.length > 0
      ? 'attention'
      : 'done';

    const step2Status: StepStatus = isSupplyCurrentTripped
      ? 'attention'
      : powerRailHealthy
      ? 'done'
      : powerSupply.isOutputEnabled
      ? 'attention'
      : 'pending';

    const step3Status: StepStatus = multimeterReading.isWarning
      ? 'attention'
      : probeSeated
      ? 'done'
      : powerSupply.isOutputEnabled
      ? 'active'
      : 'pending';

    const step4Status: StepStatus = hasFaultOrCut
      ? 'attention'
      : powerSupply.isOutputEnabled
      ? 'done'
      : 'pending';

    const step5Status: StepStatus =
      powerSupply.isOutputEnabled && !isSupplyCurrentTripped && activeDTCs.length === 0 && !hasFaultOrCut
        ? 'done'
        : hasFaultOrCut || activeDTCs.length > 0
        ? 'pending'
        : 'active';

    const firstDtc = activeDTCs[0];

    return [
      {
        id: 1,
        title: 'Read ECU Telemetry & DTCs',
        summary: !powerSupply.isOutputEnabled
          ? 'PSU output on standby'
          : activeDTCs.length > 0
          ? `${activeDTCs.length} active DTC${activeDTCs.length > 1 ? 's' : ''} (${activeDTCs
              .map((d) => d.code)
              .join(', ')})`
          : `Nominal · ${supplyCurrentDrawAmps.toFixed(2)} A draw`,
        guidance: !powerSupply.isOutputEnabled
          ? 'Enable the Bench DC Power Supply output to energize KL30/KL15 and allow the MNA solver to evaluate live ECU DTC thresholds.'
          : activeDTCs.length > 0
          ? `OBD-II monitor flagged ${activeDTCs
              .map((d) => `${d.code} (${d.system})`)
              .join(', ')}. Inspect the highlighted circuit nodes or query the Offline Bot for exact test tolerances.`
          : 'MNA telemetry shows zero stored DTCs and stable quiescent current draw.',
        status: step1Status,
        ctaLabel: firstDtc ? `Ask Bot: ${firstDtc.code}` : 'Open Repair Manuals',
        onCta: firstDtc
          ? () => onOpenOfflineBot(`Diagnose ${firstDtc.code} on current bench`)
          : () => onNavigateTab('REPAIR_GUIDE'),
      },
      {
        id: 2,
        title: 'Verify Power & Ground Rails',
        summary: isSupplyCurrentTripped
          ? `OCP Tripped (${supplyCurrentDrawAmps.toFixed(2)} A)`
          : powerSupply.isOutputEnabled
          ? `KL30 ${kl30V.toFixed(2)} V · KL31 ${kl31V.toFixed(2)} V`
          : 'Awaiting bench power',
        guidance: isSupplyCurrentTripped
          ? 'Bench power supply Constant-Current limit tripped due to excessive load or dead short to ground. Check KL30/actuators before raising current limit.'
          : Math.abs(kl31V) > 0.6
          ? `Elevated ground offset (${kl31V.toFixed(2)} V) detected at KL31 Pin #1. Check for ground fretting corrosion or cut return wire.`
          : kl30V < 10.5 && powerSupply.isOutputEnabled
          ? `KL30 Pin #3 is low (${kl30V.toFixed(2)} V). Verify power supply voltage preset and KL30 harness continuity.`
          : 'KL30 (+12V) and KL31 (0V return) are within automotive bench operating specification.',
        status: step2Status,
        ctaLabel: 'Check Pin #3 (KL30)',
        onCta: () => onSelectPin('ecu-pin-3'),
      },
      {
        id: 3,
        title: 'Probe & Analyze Signals',
        summary: multimeterReading.isWarning
          ? 'DMM Mode Lockout Warning'
          : probeSeated
          ? `${multimeterReading.display} ${multimeterReading.unit} on ${selectedPin ? selectedPin.label : 'target'}`
          : 'Attach DMM probes to target pin',
        guidance: multimeterReading.isWarning
          ? multimeterReading.warningMessage ||
            'Never measure Resistance (Ω) on a live energized circuit. Switch PSU OFF or change DMM to V DC.'
          : `DMM Red (+) on ${multimeter.redProbe.attachedLabel}, COM (-) on ${multimeter.blackProbe.attachedLabel}. Open Oscilloscope to inspect transient PWM, VR crank, or CAN differential frames.`,
        status: step3Status,
        ctaLabel: 'Open Oscilloscope',
        onCta: () => onNavigateTab('OSCILLOSCOPE'),
      },
      {
        id: 4,
        title: 'Isolate Harness or Pin Fault',
        summary: firstFault
          ? `${firstFaultPin?.label || firstFault.pinId}: ${firstFault.faultType.replace(/_/g, ' ')}`
          : firstCutWire
          ? `Cut wire: ${firstCutWire.label}`
          : 'All pins & harness wires intact',
        guidance: firstFault
          ? `Active fault on ${firstFaultPin ? `${firstFaultPin.label} (Pin #${firstFaultPin.pinNumber})` : firstFault.pinId}: ${firstFault.description}. Use the Fault Matrix to inspect or restore nominal continuity once verified.`
          : firstCutWire
          ? `Harness lead "${firstCutWire.label}" is currently cut open on the canvas. Click the wire on the Wiring Canvas to restore continuity.`
          : 'No injected pin faults or cut harness leads are active on the current circuit.',
        status: step4Status,
        ctaLabel: firstFault
          ? `Focus ${firstFaultPin?.label || 'Fault Pin'}`
          : firstCutWire
          ? 'Inspect Harness Wiring'
          : undefined,
        onCta: firstFault
          ? () => onSelectPin(firstFault.pinId)
          : firstCutWire
          ? () => onNavigateTab('WIRING_DIAGRAM')
          : undefined,
      },
      {
        id: 5,
        title: 'Verify Nominal Recovery',
        summary:
          step5Status === 'done'
            ? 'Bench verified · 0 Active DTCs'
            : `${activeDTCs.length} DTCs · ${faults.length + cutWires.length} open issues`,
        guidance:
          step5Status === 'done'
            ? 'All MNA node voltages, harness continuity, and OBD-II monitors confirm nominal operation. You can save this verified bench state under Saved Benches.'
            : 'Resolve remaining pin faults or cut harness leads, ensure PSU output is enabled without C.C. trip, and confirm DTC count returns to 0.',
        status: step5Status,
        ctaLabel: 'Open ECU Pinout Library',
        onCta: () => onNavigateTab('ECU_PINOUT'),
      },
    ];
  }, [
    activeDTCs,
    cutWires,
    faults,
    hasFaultOrCut,
    isSupplyCurrentTripped,
    kl30V,
    kl31V,
    multimeter.blackProbe.attachedLabel,
    multimeter.redProbe.attachedLabel,
    multimeterReading.display,
    multimeterReading.isWarning,
    multimeterReading.unit,
    multimeterReading.warningMessage,
    onNavigateTab,
    onOpenOfflineBot,
    onSelectPin,
    pins,
    powerRailHealthy,
    powerSupply.isOutputEnabled,
    probeSeated,
    selectedPin,
    supplyCurrentDrawAmps,
  ]);

  if (!isOpen) return null;

  // Auto-highlight the highest priority step if user hasn't manually pinned one
  const autoStep =
    steps.find((s) => s.status === 'attention') ||
    steps.find((s) => s.status === 'active') ||
    steps[steps.length - 1];
  const activeStep = steps.find((s) => s.id === selectedStepId) || autoStep;

  const renderStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'attention':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'active':
        return <Activity className="w-4 h-4 text-cyan-400 shrink-0" />;
      default:
        return <Circle className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  return (
    <aside
      aria-label="5-Step MNA Diagnostic Guide"
      className="w-full lg:w-[315px] xl:w-[335px] hud-panel rounded-xl p-3 sm:p-3.5 flex flex-col justify-between gap-3 shrink-0 overflow-y-auto flex-1 lg:flex-initial min-h-0"
    >
      <div className="flex flex-col gap-3">
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center shrink-0">
              <Wrench className="w-3.5 h-3.5 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 className="font-hud text-sm font-bold uppercase tracking-wider text-slate-100 truncate">
                MNA Diagnostic Guide
              </h2>
              <p className="text-[10px] font-mono text-slate-400 truncate">
                Step {activeStep.id} of 5 · Live Circuit Sync
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-slate-100 transition shrink-0"
            title="Collapse Diagnostic Guide"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5-Step Checklist */}
        <div className="flex flex-col gap-1.5">
          {steps.map((step) => {
            const isFocused = activeStep.id === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setSelectedStepId(step.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg border transition flex items-start gap-2.5 ${
                  isFocused
                    ? 'bg-cyan-950/50 border-cyan-500/60 text-white'
                    : step.status === 'done'
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200 hover:border-emerald-600/50'
                    : step.status === 'attention'
                    ? 'bg-amber-950/25 border-amber-700/50 text-slate-200 hover:border-amber-500/60'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5">{renderStatusIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">
                      0{step.id}. {step.title}
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        isFocused ? 'text-cyan-400 translate-x-0.5' : 'text-slate-600'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5 tabular-nums">
                    {step.summary}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Contextual Diagnostic Insight Card */}
        <div className="hud-well rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>Step 0{activeStep.id} Insight</span>
            </span>
            <span
              className={`font-bold uppercase ${
                activeStep.status === 'done'
                  ? 'text-emerald-400'
                  : activeStep.status === 'attention'
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {activeStep.status === 'done'
                ? 'Verified'
                : activeStep.status === 'attention'
                ? 'Action Needed'
                : 'In Progress'}
            </span>
          </div>

          <p className="text-xs font-body text-slate-300 leading-relaxed">{activeStep.guidance}</p>

          {activeStep.ctaLabel && activeStep.onCta && (
            <button
              type="button"
              onClick={activeStep.onCta}
              className="mt-0.5 w-full py-1.5 px-3 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-600/60 text-cyan-200 text-[11px] font-mono font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
            >
              <span>{activeStep.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Snapshot Strip + Batch Run & PDF Report Buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-cyan-500/20">
        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono tabular-nums">
          <div className="hud-well rounded-lg px-2 py-1.5">
            <span className="text-slate-500 block text-[9px]">KL30</span>
            <strong className="text-amber-300">{kl30V.toFixed(1)} V</strong>
          </div>
          <div className="hud-well rounded-lg px-2 py-1.5">
            <span className="text-slate-500 block text-[9px]">FAULTS</span>
            <strong className={hasFaultOrCut ? 'text-rose-400' : 'text-emerald-400'}>
              {faults.length + cutWires.length}
            </strong>
          </div>
          <div className="hud-well rounded-lg px-2 py-1.5">
            <span className="text-slate-500 block text-[9px]">DTCs</span>
            <strong className={activeDTCs.length > 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {activeDTCs.length}
            </strong>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="w-full py-2 px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap shadow-sm"
            title="Automatically sequence through all standard ECU pin checks and flag voltage threshold deviations"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
            <span>Run Batch Pin Diagnostics</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="w-full py-2 px-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap shadow-sm"
            title="Compile circuit state, detected faults, and active readings into a visual PDF report preview"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Diagnostic PDF Report</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenOfflineBot('Diagnose my current bench')}
              className="py-2 px-2.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/60 text-amber-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span>Ask Offline Bot</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextId = activeStep.id >= 5 ? 1 : activeStep.id + 1;
                setSelectedStepId(nextId);
              }}
              className="py-2 px-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1 transition whitespace-nowrap"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Pin Diagnostic Modal */}
      <BatchPinDiagnosticModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        pins={pins}
        nodeVoltages={nodeVoltages}
        powerSupply={powerSupply}
        onSelectPin={onSelectPin}
        onNavigateTab={onNavigateTab}
      />

      {/* Diagnostic PDF Report Modal */}
      <DiagnosticReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        powerSupply={powerSupply}
        pins={pins}
        wires={wires}
        faults={faults}
        activeDTCs={activeDTCs}
        nodeVoltages={nodeVoltages}
        supplyCurrentDrawAmps={supplyCurrentDrawAmps}
        isSupplyCurrentTripped={isSupplyCurrentTripped}
        multimeter={multimeter}
        multimeterReading={multimeterReading}
        selectedPinId={selectedPinId}
      />
    </aside>
  );
};
