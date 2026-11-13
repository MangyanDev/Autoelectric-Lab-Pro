import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Activity,
  Zap,
} from 'lucide-react';
import { EcuPin, PowerSupplyState } from '../types/ecu';

type LabTab =
  | 'BENCH_LAB'
  | 'WIRING_DIAGRAM'
  | 'THREE_D_TWIN'
  | 'ECU_PINOUT'
  | 'OSCILLOSCOPE'
  | 'PCB_SCANNER'
  | 'REPAIR_GUIDE';

interface BatchPinResult {
  pinId: string;
  pinNumber: number;
  label: string;
  category: string;
  measuredVoltage: number;
  expectedMin: number;
  expectedMax: number;
  status: 'NOMINAL' | 'DEVIATION' | 'PENDING';
  message: string;
}

interface BatchPinDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  pins: EcuPin[];
  nodeVoltages: Record<string, number>;
  powerSupply: PowerSupplyState;
  onSelectPin: (pinId: string) => void;
  onNavigateTab: (tab: LabTab, pinId?: string) => void;
}

export const BatchPinDiagnosticModal: React.FC<BatchPinDiagnosticModalProps> = ({
  isOpen,
  onClose,
  pins,
  nodeVoltages,
  powerSupply,
  onSelectPin,
  onNavigateTab,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [results, setResults] = useState<BatchPinResult[]>([]);
  const nodeVoltagesRef = React.useRef(nodeVoltages);
  nodeVoltagesRef.current = nodeVoltages;

  // Initialize pending test batch list when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: BatchPinResult[] = pins.map((p) => {
        let expectedMin = 0;
        let expectedMax = 5;
        const label = p.label.toUpperCase();

        if (p.category === 'ground' || p.nominalVoltage === 0) {
          expectedMin = -0.2;
          expectedMax = 0.5;
        } else if (p.category === 'power' || p.nominalVoltage >= 11.0) {
          expectedMin = 10.5;
          expectedMax = 14.5;
        } else if (p.category === 'reference' || Math.abs(p.nominalVoltage - 5.0) < 0.25) {
          expectedMin = 4.75;
          expectedMax = 5.25;
        } else if (label.includes('CAN_H')) {
          expectedMin = 2.2;
          expectedMax = 3.8;
        } else if (label.includes('CAN_L')) {
          expectedMin = 1.2;
          expectedMax = 2.8;
        } else {
          // Analog sensor inputs (TPS, MAP, ECT, O2)
          expectedMin = 0.15;
          expectedMax = 4.85;
        }

        const volts = nodeVoltagesRef.current[p.id] ?? 0;
        return {
          pinId: p.id,
          pinNumber: p.pinNumber,
          label: p.label,
          category: p.category,
          measuredVoltage: volts,
          expectedMin,
          expectedMax,
          status: 'PENDING',
          message: 'Awaiting batch execution',
        };
      });
      setResults(initial);
      setCurrentIndex(-1);
      setIsRunning(false);
    }
  }, [isOpen, pins]);

  const startBatchRun = () => {
    setIsRunning(true);
    setCurrentIndex(0);
  };

  // Step through pins sequentially during batch run
  useEffect(() => {
    if (!isRunning || currentIndex < 0 || currentIndex >= pins.length) {
      if (isRunning && currentIndex >= pins.length) {
        setIsRunning(false);
        setCurrentIndex(-1);
      }
      return;
    }

    const timer = setTimeout(() => {
      const pin = pins[currentIndex];
      const volts = nodeVoltagesRef.current[pin.id] ?? 0;

      setResults((prev) => {
        const updated = [...prev];
        const item = updated[currentIndex];
        if (!item) return prev;

        const isNominal = volts >= item.expectedMin && volts <= item.expectedMax;
        updated[currentIndex] = {
          ...item,
          measuredVoltage: volts,
          status: isNominal ? 'NOMINAL' : 'DEVIATION',
          message: isNominal
            ? `Within nominal spec (${item.expectedMin}V - ${item.expectedMax}V)`
            : `Threshold deviation detected! Measured ${volts.toFixed(2)}V (Expected ${item.expectedMin}V - ${item.expectedMax}V)`,
        };
        return updated;
      });

      setCurrentIndex((prev) => prev + 1);
    }, 120);

    return () => clearTimeout(timer);
  }, [isRunning, currentIndex, pins]);

  if (!isOpen) return null;

  const completedCount = results.filter((r) => r.status !== 'PENDING').length;
  const deviationCount = results.filter((r) => r.status === 'DEVIATION').length;
  const progressPercent = Math.round((completedCount / (pins.length || 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl h-[85vh] flex flex-col hud-panel rounded-2xl shadow-2xl overflow-hidden font-mono text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 hud-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-hud font-bold text-slate-100 tracking-wide uppercase">
                ECU Pinout Batch Diagnostic Run
              </h2>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Automated MNA threshold verification across all {pins.length} ECU harness pins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isRunning && (
              <button
                onClick={startBatchRun}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{completedCount > 0 ? 'Rerun Batch' : 'Start Batch Run'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress & Summary Bar */}
        <div className="px-5 py-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              STATUS:{' '}
              <strong className={isRunning ? 'text-cyan-400 animate-pulse' : completedCount === pins.length ? 'text-emerald-400' : 'text-slate-300'}>
                {isRunning ? `Scanning Pin #${pins[currentIndex]?.pinNumber} (${pins[currentIndex]?.label})...` : completedCount === pins.length ? 'Batch Scan Complete' : 'Ready to Run'}
              </strong>
            </span>
            <span>
              DEVIATIONS:{' '}
              <strong className={deviationCount > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {deviationCount} Flagged
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-48">
            <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-cyan-500 transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">{progressPercent}%</span>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#030712] flex flex-col gap-2">
          {!powerSupply.isOutputEnabled && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-xs flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Bench DC Power Supply is currently OFF. Most powered pins will register 0V until power is enabled.</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {results.map((res, idx) => {
              const isCurrent = isRunning && currentIndex === idx;
              return (
                <div
                  key={res.pinId}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    isCurrent
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : res.status === 'DEVIATION'
                      ? 'bg-rose-950/30 border-rose-800/80'
                      : res.status === 'NOMINAL'
                      ? 'bg-slate-900/80 border-slate-800'
                      : 'bg-slate-950/50 border-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-xs text-cyan-300 shrink-0">
                      #{res.pinNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-100 truncate">
                          {res.label}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {res.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5 truncate">
                        {res.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                    <div className="text-right tabular-nums">
                      <div className="text-xs font-bold text-amber-300">
                        {res.status === 'PENDING' ? '--- V' : `${res.measuredVoltage.toFixed(2)} V`}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Spec: {res.expectedMin}V - {res.expectedMax}V
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {res.status === 'NOMINAL' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>NOMINAL</span>
                        </span>
                      )}
                      {res.status === 'DEVIATION' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/70 px-2 py-1 rounded border border-rose-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>DEVIATION</span>
                        </span>
                      )}
                      {res.status === 'PENDING' && (
                        <span className="text-[10px] text-slate-600 bg-slate-900 px-2 py-1 rounded">
                          PENDING
                        </span>
                      )}

                      <button
                        onClick={() => {
                          onSelectPin(res.pinId);
                          onNavigateTab('ECU_PINOUT', res.pinId);
                          onClose();
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Inspect pin in Pinout Library"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 text-[11px]">
            Deviations automatically highlight wiring faults, open circuits, or shorted sensors.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
