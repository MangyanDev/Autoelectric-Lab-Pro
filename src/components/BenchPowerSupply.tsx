import React from 'react';
import { PowerSupplyState } from '../types/ecu';
import { Power, Zap, Sliders, AlertCircle, RotateCcw } from 'lucide-react';

interface BenchPowerSupplyProps {
  powerSupply: PowerSupplyState;
  onChange: (updated: PowerSupplyState) => void;
  actualCurrentAmps: number;
  isTripped: boolean;
}

export const BenchPowerSupply: React.FC<BenchPowerSupplyProps> = ({
  powerSupply,
  onChange,
  actualCurrentAmps,
  isTripped,
}) => {
  const handleVoltageChange = (val: number) => {
    const clamped = Math.max(0, Math.min(32.0, parseFloat(val.toFixed(2))));
    onChange({
      ...powerSupply,
      voltageSetting: clamped,
      preset: 'CUSTOM',
    });
  };

  const handleCurrentLimitChange = (val: number) => {
    const clamped = Math.max(0.1, Math.min(10.0, parseFloat(val.toFixed(2))));
    onChange({
      ...powerSupply,
      currentLimit: clamped,
    });
  };

  const setPreset = (preset: PowerSupplyState['preset'], volts: number, current: number = 3.0) => {
    onChange({
      ...powerSupply,
      preset,
      voltageSetting: volts,
      currentLimit: current,
    });
  };

  const powerWatts = powerSupply.isOutputEnabled ? powerSupply.voltageSetting * actualCurrentAmps : 0;

  return (
    <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-4 flex flex-col gap-4 shadow-sm">
      {/* Unit Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
            BENCH DC POWER SUPPLY
          </span>
          <span className="text-[10px] font-mono text-slate-500">0-30V / 10A</span>
        </div>
        <div className="flex items-center gap-2">
          {isTripped && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded">
              <AlertCircle className="w-3 h-3" /> C.C. LIMIT TRIPPED
            </span>
          )}
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              powerSupply.isOutputEnabled
                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {powerSupply.isOutputEnabled ? 'OUTPUT: ACTIVE' : 'OUTPUT: STANDBY'}
          </span>
        </div>
      </div>

      {/* Main Dual LED Telemetry Displays */}
      <div className="grid grid-cols-3 gap-2">
        {/* Voltage Display */}
        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase">
            <span>Voltage Output</span>
            <span className="text-amber-400 font-semibold">V</span>
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400 tabular-nums my-1">
            {powerSupply.isOutputEnabled ? powerSupply.voltageSetting.toFixed(2) : '0.00'}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Set: {powerSupply.voltageSetting.toFixed(2)} V
          </div>
        </div>

        {/* Current Display */}
        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase">
            <span>Current Draw</span>
            <span className="text-cyan-400 font-semibold">A</span>
          </div>
          <div className="text-2xl font-mono font-bold text-cyan-400 tabular-nums my-1">
            {powerSupply.isOutputEnabled ? actualCurrentAmps.toFixed(3) : '0.000'}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Lim: {powerSupply.currentLimit.toFixed(2)} A
          </div>
        </div>

        {/* Power Display */}
        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase">
            <span>Power</span>
            <span className="text-emerald-400 font-semibold">W</span>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums my-1">
            {powerWatts.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            Mode: {powerSupply.isOutputEnabled ? (isTripped ? 'C.C.' : 'C.V.') : 'OFF'}
          </div>
        </div>
      </div>

      {/* Precision Controls */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Voltage Stepper */}
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded flex flex-col gap-1.5">
          <label className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>VOLTAGE ADJUST</span>
            <span className="text-amber-400 font-semibold">{powerSupply.voltageSetting.toFixed(1)} V</span>
          </label>
          <input
            type="range"
            min="0"
            max="28"
            step="0.1"
            value={powerSupply.voltageSetting}
            onChange={e => handleVoltageChange(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
          <div className="grid grid-cols-4 gap-1 mt-1">
            <button
              onClick={() => handleVoltageChange(powerSupply.voltageSetting - 1.0)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              -1.0V
            </button>
            <button
              onClick={() => handleVoltageChange(powerSupply.voltageSetting - 0.1)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              -0.1V
            </button>
            <button
              onClick={() => handleVoltageChange(powerSupply.voltageSetting + 0.1)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              +0.1V
            </button>
            <button
              onClick={() => handleVoltageChange(powerSupply.voltageSetting + 1.0)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              +1.0V
            </button>
          </div>
        </div>

        {/* Current Limit Stepper */}
        <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded flex flex-col gap-1.5">
          <label className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>CURRENT LIMIT</span>
            <span className="text-cyan-400 font-semibold">{powerSupply.currentLimit.toFixed(1)} A</span>
          </label>
          <input
            type="range"
            min="0.2"
            max="10.0"
            step="0.1"
            value={powerSupply.currentLimit}
            onChange={e => handleCurrentLimitChange(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
          <div className="grid grid-cols-4 gap-1 mt-1">
            <button
              onClick={() => handleCurrentLimitChange(powerSupply.currentLimit - 0.5)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              -0.5A
            </button>
            <button
              onClick={() => handleCurrentLimitChange(powerSupply.currentLimit - 0.1)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              -0.1A
            </button>
            <button
              onClick={() => handleCurrentLimitChange(powerSupply.currentLimit + 0.1)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              +0.1A
            </button>
            <button
              onClick={() => handleCurrentLimitChange(powerSupply.currentLimit + 0.5)}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono rounded text-slate-300"
            >
              +0.5A
            </button>
          </div>
        </div>
      </div>

      {/* Automotive Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          Automotive Bench Presets
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => setPreset('12V_BENCH', 12.6, 4.0)}
            className={`px-2 py-1.5 text-[11px] font-mono rounded border transition ${
              powerSupply.preset === '12V_BENCH'
                ? 'bg-slate-800 border-amber-400 text-amber-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            12.6V Battery
          </button>
          <button
            onClick={() => setPreset('14.4V_RUNNING', 14.4, 5.0)}
            className={`px-2 py-1.5 text-[11px] font-mono rounded border transition ${
              powerSupply.preset === '14.4V_RUNNING'
                ? 'bg-slate-800 border-amber-400 text-amber-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            14.4V Charging
          </button>
          <button
            onClick={() => setPreset('10.2V_CRANKING', 10.2, 8.0)}
            className={`px-2 py-1.5 text-[11px] font-mono rounded border transition ${
              powerSupply.preset === '10.2V_CRANKING'
                ? 'bg-slate-800 border-amber-400 text-amber-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            10.2V Cranking
          </button>
          <button
            onClick={() => setPreset('5V_LOGIC', 5.0, 2.0)}
            className={`px-2 py-1.5 text-[11px] font-mono rounded border transition ${
              powerSupply.preset === '5V_LOGIC'
                ? 'bg-slate-800 border-amber-400 text-amber-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            5.0V Logic
          </button>
        </div>
      </div>

      {/* Main Output Switch */}
      <button
        onClick={() => onChange({ ...powerSupply, isOutputEnabled: !powerSupply.isOutputEnabled })}
        className={`w-full py-2.5 px-4 rounded font-mono text-xs font-semibold flex items-center justify-center gap-2 transition ${
          powerSupply.isOutputEnabled
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
        }`}
      >
        <Power className={`w-4 h-4 ${powerSupply.isOutputEnabled ? 'text-white' : 'text-slate-500'}`} />
        <span>{powerSupply.isOutputEnabled ? 'DEACTIVATE POWER OUTPUT' : 'ENABLE POWER SUPPLY (OUTPUT ON)'}</span>
      </button>
    </div>
  );
};
