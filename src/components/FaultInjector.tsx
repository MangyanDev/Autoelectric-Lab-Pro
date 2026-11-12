import React, { useEffect } from 'react';
import { EcuPin, FaultType, InjectedFault, DiagnosticTroubleCode } from '../types/ecu';
import { AlertTriangle, ShieldCheck, Trash2, ZapOff, CheckCircle2, Flame, Wrench, Sparkles, Globe, Activity } from 'lucide-react';
import { recordRenderCycle } from '../utils/perfMonitor';

interface FaultInjectorProps {
  pins: EcuPin[];
  faults: InjectedFault[];
  activeDTCs: DiagnosticTroubleCode[];
  onAddFault: (pinId: string, faultType: FaultType, description: string) => void;
  onRemoveFault: (pinId: string) => void;
  onClearAll: () => void;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onSearchDtc?: (dtcCode: string, description: string) => void;
}

export const FaultInjector: React.FC<FaultInjectorProps> = React.memo(({
  pins,
  faults,
  activeDTCs,
  onAddFault,
  onRemoveFault,
  onClearAll,
  selectedPinId,
  onSelectPin,
  onSearchDtc,
}) => {
  useEffect(() => {
    recordRenderCycle('FaultInjector');
  });

  const currentPin = pins.find(p => p.id === selectedPinId) || pins[0];
  const activeFaultForPin = faults.find(f => f.pinId === currentPin.id);

  const faultOptions: { type: FaultType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    { type: 'NONE', label: 'Nominal (No Fault)', desc: 'Clean OEM pin connection without electrical fault', icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, color: 'hover:border-emerald-500' },
    { type: 'OPEN_CIRCUIT', label: 'Open Circuit (Harness Break)', desc: 'Terminal pushed out, broken copper strand, or unseated pin', icon: <ZapOff className="w-4 h-4 text-amber-400" />, color: 'hover:border-amber-500' },
    { type: 'SHORT_TO_GND', label: 'Short to Ground (KL31)', desc: 'Harness pinched against chassis metal / engine block ground', icon: <AlertTriangle className="w-4 h-4 text-rose-400" />, color: 'hover:border-rose-500' },
    { type: 'SHORT_TO_VBAT', label: 'Short to Battery (+12V)', desc: 'Harness melted/shorted to constant unswitched +12V battery rail', icon: <Flame className="w-4 h-4 text-orange-400" />, color: 'hover:border-orange-500' },
    { type: 'HIGH_RESISTANCE_50R', label: 'High Resistance (+50Ω)', desc: 'Mild connector pin fretting corrosion / oxidation', icon: <Wrench className="w-4 h-4 text-yellow-400" />, color: 'hover:border-yellow-500' },
    { type: 'HIGH_RESISTANCE_250R', label: 'High Resistance (+250Ω)', desc: 'Moderate water intrusion & terminal green-crust corrosion', icon: <Wrench className="w-4 h-4 text-yellow-500" />, color: 'hover:border-yellow-500' },
  ];

  // Quick Automotive Diagnostic Scenarios
  const runScenario = (pinId: string, faultType: FaultType, desc: string) => {
    onSelectPin(pinId);
    onAddFault(pinId, faultType, desc);
  };

  return (
    <div className="hud-panel rounded-xl p-3.5 flex flex-col gap-3.5 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-hud font-bold tracking-wider text-slate-100 uppercase">
            Fault Injection Matrix
          </span>
        </div>
        {faults.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800 transition"
          >
            <Trash2 className="w-3 h-3" /> Clear All ({faults.length})
          </button>
        )}
      </div>

      {/* Quick Scenario Presets */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Diagnostic Scenarios</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <button
            onClick={() => runScenario('ecu-pin-7', 'OPEN_CIRCUIT', 'TPS Signal Wire Break')}
            className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-500 rounded text-left text-slate-300 transition"
          >
            <span className="text-amber-400 font-semibold block">TPS Wire Break</span>
            <span className="text-[9px] text-slate-500">Triggers P0122</span>
          </button>
          <button
            onClick={() => runScenario('ecu-pin-13', 'SHORT_TO_GND', 'CAN_H Shorted to GND')}
            className="p-1.5 bg-slate-950 border border-slate-800 hover:border-rose-500 rounded text-left text-slate-300 transition"
          >
            <span className="text-rose-400 font-semibold block">CAN Bus Short</span>
            <span className="text-[9px] text-slate-500">Triggers U0001</span>
          </button>
          <button
            onClick={() => runScenario('ecu-pin-10', 'OPEN_CIRCUIT', 'Injector 1 Open Circuit')}
            className="p-1.5 bg-slate-950 border border-slate-800 hover:border-amber-500 rounded text-left text-slate-300 transition"
          >
            <span className="text-amber-400 font-semibold block">Injector 1 Open</span>
            <span className="text-[9px] text-slate-500">Triggers P0201</span>
          </button>
          <button
            onClick={() => runScenario('ecu-pin-1', 'HIGH_RESISTANCE_50R', 'Main Ground Fretting')}
            className="p-1.5 bg-slate-950 border border-slate-800 hover:border-yellow-500 rounded text-left text-slate-300 transition"
          >
            <span className="text-yellow-400 font-semibold block">Ground Corrosion</span>
            <span className="text-[9px] text-slate-500">+50Ω Ground Offset</span>
          </button>
        </div>
      </div>

      {/* Target Pin Selector */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800">
        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Target ECU Pin Under Test:
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 max-h-28 overflow-y-auto pr-1">
          {pins.map(p => {
            const hasFault = faults.some(f => f.pinId === p.id);
            const isSelected = p.id === currentPin.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPin(p.id)}
                className={`px-1.5 py-1 text-[10px] font-mono rounded border flex flex-col items-center justify-center transition ${
                  isSelected
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 font-bold ring-1 ring-cyan-500'
                    : hasFault
                    ? 'bg-rose-950/70 border-rose-600 text-rose-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span>{p.label}</span>
                {hasFault && <span className="text-[8px] text-rose-400 font-bold">FAULT</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Pin Details */}
      <div className="hud-well p-2 rounded-lg flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-cyan-400 font-semibold">{currentPin.label}</span>
          <span className="text-slate-400 ml-2">Pin #{currentPin.pinNumber}: {currentPin.name}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          Nominal: {currentPin.nominalVoltage.toFixed(1)}V
        </div>
      </div>

      {/* Fault Injection Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {faultOptions.map(opt => {
          const isActive = (opt.type === 'NONE' && !activeFaultForPin) || (activeFaultForPin?.faultType === opt.type);
          return (
            <button
              key={opt.type}
              onClick={() => {
                if (opt.type === 'NONE') {
                  onRemoveFault(currentPin.id);
                } else {
                  onAddFault(currentPin.id, opt.type, opt.label);
                }
              }}
              className={`p-2 rounded border text-left flex items-start gap-2 transition ${
                isActive
                  ? 'bg-cyan-950/50 border-cyan-500/70 text-white'
                  : `bg-slate-950/70 border-slate-800/90 text-slate-300 ${opt.color}`
              }`}
            >
              <div className="mt-0.5">{opt.icon}</div>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-semibold">{opt.label}</span>
                <span className="text-[9px] text-slate-400 leading-tight mt-0.5">{opt.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live ECU OBD-II Diagnostic Trouble Codes */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-cyan-500/15">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            LIVE OBD-II DTC MONITOR:
          </span>
          <span className="text-[10px] font-mono text-slate-500">{activeDTCs.length} Stored</span>
        </div>

        {activeDTCs.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-900/60 p-2 rounded text-[11px] font-mono text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>ECU Status: All circuits nominal. Zero DTCs logged.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {activeDTCs.map(dtc => (
              <div
                key={dtc.code}
                className="bg-slate-950 border border-rose-900/60 p-1.5 rounded flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="bg-rose-950 text-rose-300 border border-rose-700 px-1.5 py-0.5 rounded font-bold text-[10px]">
                    {dtc.code}
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="text-slate-200 font-semibold text-[10px] truncate">{dtc.system}</span>
                    <span className="text-slate-400 text-[9px] truncate">{dtc.description}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-semibold">
                    {dtc.severity}
                  </span>
                  {onSearchDtc && (
                    <button
                      onClick={() => onSearchDtc(dtc.code, dtc.description)}
                      className="px-1.5 py-0.5 rounded bg-blue-950 hover:bg-blue-900 border border-blue-700/80 text-cyan-300 hover:text-white transition flex items-center gap-1 text-[9px] font-bold"
                      title={`Search Live Google Grounding for ${dtc.code}`}
                    >
                      <Globe className="w-2.5 h-2.5 text-cyan-400" />
                      <span>Search TSB</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
