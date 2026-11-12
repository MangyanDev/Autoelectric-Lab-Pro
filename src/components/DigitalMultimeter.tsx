import React, { useEffect, useState } from 'react';
import { MultimeterState, MultimeterMode, EcuPin, BenchComponent } from '../types/ecu';
import { Volume2, AlertTriangle, ArrowLeftRight, X, Disc } from 'lucide-react';
import { playContinuityBeep } from '../utils/audioFeedback';

interface DigitalMultimeterProps {
  multimeter: MultimeterState;
  onChange: (updated: MultimeterState) => void;
  reading: {
    display: string;
    value: number;
    unit: string;
    isOverLimit: boolean;
    isWarning: boolean;
    warningMessage?: string;
    shouldBeep: boolean;
  };
  pins: EcuPin[];
  components: BenchComponent[];
  selectedPinId: string | null;
}

const MODE_EXPLANATIONS: Record<MultimeterMode, { title: string; desc: string; usage: string }> = {
  V_DC: {
    title: 'DC Voltage (V DC)',
    desc: 'Measures steady Direct Current potential difference relative to Ground or reference chassis.',
    usage: 'Testing ECU power feeds (KL30/KL15), 5V reference rails (TPS/MAP), and ground voltage drops.',
  },
  V_AC: {
    title: 'AC Voltage (V AC~)',
    desc: 'Measures Alternating Current Root-Mean-Square (RMS) potential difference across active AC signals.',
    usage: 'Alternator diode AC ripple testing, wheel speed sensors, and Variable Reluctance (VR) crankshaft signals.',
  },
  RESISTANCE: {
    title: 'Resistance (Ω Ohms)',
    desc: 'Injects an internal test current to measure loop resistance. MUST be used with circuit Power OFF!',
    usage: 'Sensor thermistor resistance (ECT), injector coil resistance, CAN termination (60Ω), and harness corrosion.',
  },
  CONTINUITY: {
    title: 'Continuity Test (BEEP)',
    desc: 'Audible continuity test that beeps when loop resistance between probes is below 30 Ω.',
    usage: 'Verifying solid ground connections, tracing harness continuity, and detecting broken wires.',
  },
  FREQUENCY: {
    title: 'Frequency (Hz / % Duty Cycle)',
    desc: 'Measures signal switching frequency in Hertz and Pulse-Width Modulation (PWM) duty cycle percentage.',
    usage: 'Crankshaft/Camshaft Hall sensors, EVAP purge solenoid PWM, and fuel injector driver firing frequency.',
  },
  DIODE: {
    title: 'Diode Junction Test (-▷|-)',
    desc: 'Measures forward semiconductor PN-junction voltage drop (nominally 0.4V to 0.7V).',
    usage: 'Testing relay flyback suppression diodes, alternator rectifier bridges, and ECU ESD protection.',
  },
};

export const DigitalMultimeter: React.FC<DigitalMultimeterProps> = ({
  multimeter,
  onChange,
  reading,
  pins,
  components,
}) => {
  const [hoveredMode, setHoveredMode] = useState<MultimeterMode | null>(null);

  // Beep effect
  useEffect(() => {
    if (multimeter.isPowered && multimeter.mode === 'CONTINUITY' && reading.shouldBeep) {
      playContinuityBeep(true);
    } else {
      playContinuityBeep(false);
    }

    return () => {
      playContinuityBeep(false);
    };
  }, [multimeter.isPowered, multimeter.mode, reading.shouldBeep]);

  const setMode = (mode: MultimeterMode) => {
    onChange({ ...multimeter, mode });
  };

  const attachRedProbe = (pinId: string, label: string) => {
    onChange({
      ...multimeter,
      redProbe: { attachedToPinId: pinId, attachedLabel: label },
    });
  };

  const attachBlackProbe = (pinId: string, label: string) => {
    onChange({
      ...multimeter,
      blackProbe: { attachedToPinId: pinId, attachedLabel: label },
    });
  };

  const swapProbes = () => {
    onChange({
      ...multimeter,
      redProbe: multimeter.blackProbe,
      blackProbe: multimeter.redProbe,
    });
  };

  const clearProbes = () => {
    onChange({
      ...multimeter,
      redProbe: { attachedToPinId: null, attachedLabel: 'Unconnected' },
      blackProbe: { attachedToPinId: null, attachedLabel: 'Unconnected' },
    });
  };

  // Build full list of all available terminals in the lab
  const allTerminals: { id: string; label: string; group: string }[] = [
    { id: 'chassis-gnd', label: 'Chassis Ground (KL31)', group: 'Reference Rails' },
    { id: 'bench-vbat', label: 'Power Supply (+12V VBat)', group: 'Reference Rails' },
    ...pins.map(p => ({ id: p.id, label: `${p.label} - ${p.name}`, group: 'ECU Breakout Header' })),
    ...components.flatMap(c =>
      c.pins.map(cp => ({ id: cp.id, label: `${c.name}: ${cp.label}`, group: 'Bench Components' }))
    ),
  ];

  const activeModeInfo = MODE_EXPLANATIONS[hoveredMode || multimeter.mode];

  return (
    <div className="bg-slate-900 border-2 border-amber-600/40 rounded-xl p-3.5 flex flex-col gap-3 shadow-md text-slate-100">
      {/* Top Brand Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-amber-400">
            AUTO-DMM 88V
          </span>
          <span className="text-[10px] font-mono text-slate-400">AUTOMOTIVE MULTIMETER</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange({ ...multimeter, isPowered: !multimeter.isPowered })}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition ${
              multimeter.isPowered
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 font-semibold'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            {multimeter.isPowered ? 'PWR ON' : 'PWR OFF'}
          </button>
        </div>
      </div>

      {/* High-Contrast LCD Screen */}
      <div className="bg-[#94a382] border-4 border-slate-950 rounded-lg p-3 text-slate-950 shadow-inner flex flex-col justify-between min-h-[92px] relative group">
        {multimeter.isPowered ? (
          <>
            <div className="flex justify-between items-center text-[10px] font-mono font-bold tracking-wider text-slate-800">
              <div className="flex items-center gap-2">
                <span>AUTO</span>
                {multimeter.mode === 'CONTINUITY' && <Volume2 className="w-3 h-3 text-slate-900" />}
                {multimeter.mode === 'V_AC' && <span>AC~</span>}
                {multimeter.mode === 'V_DC' && <span>DC</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="uppercase">{multimeter.mode.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="flex items-baseline justify-end gap-2 my-0.5">
              <span className="text-3xl sm:text-4xl font-mono font-black tracking-tight tabular-nums text-slate-950">
                {reading.display}
              </span>
              <span className="text-base font-mono font-bold text-slate-900 w-10 text-left">
                {reading.unit}
              </span>
            </div>

            <div className="text-[10px] font-mono font-semibold text-slate-800 flex justify-between border-t border-slate-700/30 pt-1 truncate">
              <span className="truncate max-w-[150px]">+ RED: {multimeter.redProbe.attachedLabel}</span>
              <span className="truncate max-w-[150px]">- COM: {multimeter.blackProbe.attachedLabel}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-700/60 font-mono text-xs">
            [ METER POWERED OFF ]
          </div>
        )}
      </div>

      {/* Live Warning Banner */}
      {reading.isWarning && reading.warningMessage && (
        <div className="bg-rose-950/80 border border-rose-700 px-3 py-1.5 rounded flex items-start gap-2 text-[11px] text-rose-300 font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{reading.warningMessage}</span>
        </div>
      )}

      {/* Rotary Selector Dial Buttons with High-Visibility Active State, Keyboard Navigation & Non-Obscuring Lab Tooltips */}
      <div
        className="grid grid-cols-6 gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800 shadow-inner relative"
        role="radiogroup"
        aria-label="Multimeter Measurement Mode Selector (Use Arrow Keys to Navigate)"
      >
        {(['V_DC', 'V_AC', 'RESISTANCE', 'CONTINUITY', 'FREQUENCY', 'DIODE'] as MultimeterMode[]).map((modeKey, idx, arr) => {
          const info = MODE_EXPLANATIONS[modeKey];
          const isSelected = multimeter.mode === modeKey;

          // Smart horizontal alignment to prevent tooltips from bleeding off-screen or obscuring adjacent cards
          const tooltipAlignClass =
            idx === 0
              ? 'left-0 translate-x-0'
              : idx === 5
              ? 'right-0 translate-x-0'
              : 'left-1/2 -translate-x-1/2';

          const arrowAlignClass =
            idx === 0
              ? 'left-4 translate-x-0'
              : idx === 5
              ? 'right-4 translate-x-0'
              : 'left-1/2 -translate-x-1/2';

          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              const nextIndex = (idx + 1) % arr.length;
              setMode(arr[nextIndex]);
              setHoveredMode(arr[nextIndex]);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              const prevIndex = (idx - 1 + arr.length) % arr.length;
              setMode(arr[prevIndex]);
              setHoveredMode(arr[prevIndex]);
            } else if (e.key === 'Home') {
              e.preventDefault();
              setMode(arr[0]);
              setHoveredMode(arr[0]);
            } else if (e.key === 'End') {
              e.preventDefault();
              setMode(arr[arr.length - 1]);
              setHoveredMode(arr[arr.length - 1]);
            }
          };

          return (
            <div key={modeKey} className="relative group/btn flex flex-col items-center">
              <button
                role="radio"
                tabIndex={isSelected ? 0 : -1}
                aria-checked={isSelected}
                aria-label={`${info.title} measurement mode. ${info.desc}`}
                onClick={() => setMode(modeKey)}
                onMouseEnter={() => setHoveredMode(modeKey)}
                onMouseLeave={() => setHoveredMode(null)}
                onFocus={() => setHoveredMode(modeKey)}
                onBlur={() => setHoveredMode(null)}
                onKeyDown={handleKeyDown}
                className={`w-full py-2 px-1 text-[10px] font-mono font-bold rounded-lg transition-all transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-300 flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.6)] font-black scale-[1.03] z-20'
                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-amber-400 border border-slate-800'
                }`}
              >
                {/* High-Contrast Active Mode LED Indicator Dot */}
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full transition-all ${isSelected ? 'bg-slate-950 ring-2 ring-slate-900 animate-pulse' : 'bg-slate-700'}`} />
                </div>

                <span className="flex items-center gap-0.5 whitespace-nowrap tracking-tight">
                  {modeKey === 'CONTINUITY' && <Volume2 className="w-3 h-3" />}
                  {modeKey === 'CONTINUITY'
                    ? 'BEEP'
                    : modeKey === 'RESISTANCE'
                    ? 'Ω OHM'
                    : modeKey === 'FREQUENCY'
                    ? 'Hz / %'
                    : modeKey === 'DIODE'
                    ? '-▷| -'
                    : modeKey === 'V_AC'
                    ? 'V AC~'
                    : 'V DC'}
                </span>
              </button>

              {/* Accessible Non-Obscuring Dark Laboratory Hover / Focus Tooltip Popup */}
              <div
                role="tooltip"
                className={`opacity-0 group-hover/btn:opacity-100 group-focus-within/btn:opacity-100 pointer-events-none absolute bottom-full mb-2.5 w-56 bg-slate-950/95 backdrop-blur-md border border-amber-500/80 text-slate-100 text-[10px] p-2.5 rounded-xl shadow-2xl shadow-amber-950/80 z-50 transition-all duration-200 transform translate-y-1 group-hover/btn:translate-y-0 font-sans ${tooltipAlignClass}`}
              >
                <div className="font-mono font-bold text-amber-400 border-b border-slate-800/80 pb-1 mb-1.5 flex items-center justify-between">
                  <span>{info.title}</span>
                  <span className="text-[9px] text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-700/60 font-mono">
                    {isSelected ? 'ACTIVE' : 'SELECT'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-snug mb-1.5">{info.desc}</p>
                <div className="text-[9.5px] text-cyan-300 font-mono bg-cyan-950/50 border border-cyan-800/60 p-1.5 rounded">
                  <strong className="text-slate-400">Diagnostic Application:</strong> {info.usage}
                </div>
                {/* Tooltip Down Arrow Pointer */}
                <div className={`absolute top-full -mt-[1px] border-4 border-transparent border-t-amber-500/80 ${arrowAlignClass}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Student Mode Educational Card */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 font-sans text-[11px] flex flex-col gap-1 shadow-inner">
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-amber-400 font-bold tracking-wide uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {activeModeInfo.title}
          </span>
          <span className="text-slate-400 text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
            STUDENT LAB GUIDE
          </span>
        </div>
        <p className="text-slate-300 text-[11px] leading-snug">{activeModeInfo.desc}</p>
        <div className="text-[10px] text-cyan-300 font-mono pt-1 border-t border-slate-800/60 mt-0.5">
          <strong className="text-slate-400">Diagnostic Application:</strong> {activeModeInfo.usage}
        </div>
      </div>

      {/* Probes Lead Jacks & Connection Terminal Controls */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400 uppercase tracking-wider">Probe Leads</span>
          <div className="flex gap-2">
            <button
              onClick={swapProbes}
              className="text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition"
            >
              <ArrowLeftRight className="w-3 h-3" /> Swap
            </button>
            <button
              onClick={clearProbes}
              className="text-[10px] font-mono text-slate-400 hover:text-rose-400 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition"
            >
              <X className="w-3 h-3" /> Disconnect
            </button>
          </div>
        </div>

        {/* Lead Connection Terminal Rows */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {/* Red Lead Card */}
          <div className="bg-slate-950 border-2 border-rose-600/50 p-2 rounded-lg flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <Disc className="w-3 h-3 text-rose-500 fill-rose-500" /> (+) RED PROBE
              </span>
            </div>
            {/* Quick dropdown for ANY terminal */}
            <select
              value={multimeter.redProbe.attachedToPinId || ''}
              onChange={e => {
                const target = allTerminals.find(t => t.id === e.target.value);
                if (target) attachRedProbe(target.id, target.label);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="">-- Choose Terminal --</option>
              {allTerminals.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Black Lead Card */}
          <div className="bg-slate-950 border-2 border-slate-700 p-2 rounded-lg flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Disc className="w-3 h-3 text-slate-400 fill-slate-400" /> (-) BLACK COM
              </span>
            </div>
            {/* Quick dropdown for ANY terminal */}
            <select
              value={multimeter.blackProbe.attachedToPinId || ''}
              onChange={e => {
                const target = allTerminals.find(t => t.id === e.target.value);
                if (target) attachBlackProbe(target.id, target.label);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-slate-500"
            >
              <option value="">-- Choose Terminal --</option>
              {allTerminals.map(t => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
