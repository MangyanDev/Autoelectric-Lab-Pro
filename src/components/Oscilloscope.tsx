import React, { useEffect, useRef, useState } from 'react';
import { Activity, Play, Pause, RotateCcw, Sliders } from 'lucide-react';
import { SignalGenerator } from '../simulation/signals/SignalGenerator';

interface OscilloscopeProps {
  isPowerOn: boolean;
  selectedSignal: 'CAN_BUS' | 'INJECTOR_PWM' | 'CRANK_CKP' | 'TPS_DC' | 'O2_LAMBDA';
  hasCanFault: boolean;
  hasInjectorFault: boolean;
  simulationSpeed?: number;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  isPowerOn,
  selectedSignal,
  hasCanFault,
  hasInjectorFault,
  simulationSpeed = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [voltDiv, setVoltDiv] = useState(1.0);
  const [timeDiv, setTimeDiv] = useState(1.0);
  const [activeSignal, setActiveSignal] = useState<'CAN_BUS' | 'INJECTOR_PWM' | 'CRANK_CKP' | 'TPS_DC' | 'O2_LAMBDA'>(selectedSignal);

  useEffect(() => {
    setActiveSignal(selectedSignal);
  }, [selectedSignal]);

  // Live physical measurements calculated from simulation parameters
  let measuredVpp = '0.00 V';
  let measuredFreq = '0.0 Hz';
  let measuredDuty = '0.0 %';
  let measuredVrms = '0.00 V';

  if (isPowerOn) {
    if (activeSignal === 'CAN_BUS') {
      measuredVpp = hasCanFault ? '0.00 V' : '2.00 V';
      measuredFreq = hasCanFault ? '0.0 kHz' : '500.0 kHz';
      measuredDuty = '50.0 %';
      measuredVrms = hasCanFault ? '0.00 V' : '2.50 V';
    } else if (activeSignal === 'INJECTOR_PWM') {
      measuredVpp = hasInjectorFault ? '0.00 V' : '65.00 V';
      measuredFreq = hasInjectorFault ? '0.0 Hz' : '20.0 Hz';
      measuredDuty = hasInjectorFault ? '0.0 %' : '5.0 %';
      measuredVrms = hasInjectorFault ? '0.00 V' : '12.4 V';
    } else if (activeSignal === 'CRANK_CKP') {
      measuredVpp = '6.40 V';
      measuredFreq = '1.20 kHz';
      measuredDuty = '48.5 %';
      measuredVrms = '2.26 V';
    } else if (activeSignal === 'O2_LAMBDA') {
      measuredVpp = '0.80 V';
      measuredFreq = '1.25 Hz';
      measuredDuty = '50.0 %';
      measuredVrms = '0.45 V';
    } else {
      measuredVpp = '0.05 V';
      measuredFreq = '0.0 Hz';
      measuredDuty = '100.0 %';
      measuredVrms = '2.40 V';
    }
  }

  useEffect(() => {
    let animFrame: number;
    let simTime = 0;

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const targetWidth = Math.floor(rect.width);
      const targetHeight = Math.floor(rect.height);

      if (canvas.width !== targetWidth * dpr || canvas.height !== targetHeight * dpr) {
        canvas.width = targetWidth * dpr;
        canvas.height = targetHeight * dpr;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = targetWidth;
      const height = targetHeight;

      // Dark oscilloscope phosphor CRT screen background
      ctx.fillStyle = '#030807';
      ctx.fillRect(0, 0, width, height);

      // Draw Reticle Grid
      ctx.strokeStyle = '#0a231f';
      ctx.lineWidth = 1;

      const numX = 10;
      const numY = 8;
      const stepX = width / numX;
      const stepY = height / numY;

      for (let x = 0; x <= width; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center crosshair axis
      ctx.strokeStyle = '#143c34';
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (!isPowerOn) {
        ctx.fillStyle = '#10b98144';
        ctx.font = '12px monospace';
        ctx.fillText('[ CIRCUIT DE-ENERGIZED - ZERO SIGNAL VOLTAGE ]', width / 2 - 140, height / 2);
        ctx.restore();
        return;
      }

      if (isRunning) {
        simTime += 0.0004 * timeDiv * simulationSpeed;
      }

      ctx.lineWidth = 2.5;

      if (activeSignal === 'CAN_BUS') {
        // CH1 CAN_H Yellow
        ctx.strokeStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const tPoint = simTime + (x * 0.000008 / timeDiv);
          const sig = SignalGenerator.getCanBusSignals(tPoint, hasCanFault);
          const y = (height / 2) - ((sig.canHigh - 2.5) * 45 * voltDiv) - 25;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // CH2 CAN_L Cyan
        ctx.strokeStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const tPoint = simTime + (x * 0.000008 / timeDiv);
          const sig = SignalGenerator.getCanBusSignals(tPoint, hasCanFault);
          const y = (height / 2) - ((sig.canLow - 2.5) * 45 * voltDiv) + 25;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (activeSignal === 'INJECTOR_PWM') {
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const tPoint = simTime + (x * 0.00015 / timeDiv);
          const v = SignalGenerator.getInjectorWaveform(tPoint, hasInjectorFault, 12.6);
          // Scale 0V - 65V to screen
          const y = (height - 30) - (v * 3.2 * voltDiv);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (activeSignal === 'CRANK_CKP') {
        ctx.strokeStyle = '#4ade80';
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const tPoint = simTime + (x * 0.00008 / timeDiv);
          const v = SignalGenerator.getCrankshaftVrSignal(tPoint, 1200);
          const y = (height / 2) - (v * 16 * voltDiv);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (activeSignal === 'O2_LAMBDA') {
        ctx.strokeStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const tPoint = simTime + (x * 0.002 / timeDiv);
          const v = 0.45 + 0.4 * Math.sin(tPoint * 2 * Math.PI * 1.25);
          const y = (height / 2) - ((v - 0.5) * 120 * voltDiv);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // TPS_DC analog level
        ctx.strokeStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const y = (height - 40) - (2.4 * 35 * voltDiv);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.restore();
      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [isPowerOn, isRunning, activeSignal, hasCanFault, hasInjectorFault, timeDiv, voltDiv]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-slate-100 flex flex-col gap-3 shadow-sm">
      {/* Scope Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-semibold tracking-wider text-slate-200">
            DIGITAL STORAGE LAB OSCILLOSCOPE
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">2-CH 50MS/s TRUE RMS</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-2.5 py-1 text-[10px] font-mono rounded border flex items-center gap-1.5 font-semibold transition ${
              isRunning
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                : 'bg-amber-950/80 border-amber-700 text-amber-300'
            }`}
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isRunning ? 'RUNNING' : 'HOLD / STOP'}</span>
          </button>
        </div>
      </div>

      {/* Screen Canvas Container */}
      <div
        ref={containerRef}
        className="relative border-2 border-slate-800 rounded-lg overflow-hidden bg-[#030807] h-[220px] w-full"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Live HUD Waveform Annotations */}
        <div className="absolute top-2.5 left-2.5 flex gap-2 text-[10px] font-mono pointer-events-none">
          <span className="text-yellow-400 font-bold bg-slate-950/80 px-2 py-0.5 rounded border border-yellow-500/40">
            CH1: {activeSignal === 'CAN_BUS' ? 'CAN_H (3.5V Recessive/Dominant)' : activeSignal}
          </span>
          {activeSignal === 'CAN_BUS' && (
            <span className="text-cyan-400 font-bold bg-slate-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
              CH2: CAN_L (1.5V Differential)
            </span>
          )}
        </div>

        {/* Live On-Screen Telemetry Strip */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/85 backdrop-blur px-2.5 py-1 rounded border border-slate-800 pointer-events-none">
          <div className="flex items-center gap-3">
            <span>Vpp: <strong className="text-cyan-300 font-mono tabular-nums">{measuredVpp}</strong></span>
            <span>Freq: <strong className="text-emerald-300 font-mono tabular-nums">{measuredFreq}</strong></span>
            <span>Duty: <strong className="text-amber-300 font-mono tabular-nums">{measuredDuty}</strong></span>
            <span>Vrms: <strong className="text-slate-200 font-mono tabular-nums">{measuredVrms}</strong></span>
          </div>
          <div className="text-[9px] text-slate-500">TRIGGER: AUTO EDGE &uarr;</div>
        </div>
      </div>

      {/* Control Bar & Channel Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pt-1 border-t border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 uppercase">Input Channel:</span>
          <button
            onClick={() => setActiveSignal('CAN_BUS')}
            className={`px-2 py-1 text-[10px] rounded border transition ${
              activeSignal === 'CAN_BUS'
                ? 'bg-slate-800 border-yellow-400 text-yellow-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            CAN High/Low Bus
          </button>
          <button
            onClick={() => setActiveSignal('INJECTOR_PWM')}
            className={`px-2 py-1 text-[10px] rounded border transition ${
              activeSignal === 'INJECTOR_PWM'
                ? 'bg-slate-800 border-cyan-400 text-cyan-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            Injector 1 Pulse
          </button>
          <button
            onClick={() => setActiveSignal('CRANK_CKP')}
            className={`px-2 py-1 text-[10px] rounded border transition ${
              activeSignal === 'CRANK_CKP'
                ? 'bg-slate-800 border-emerald-400 text-emerald-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            Crank 60-2 Sensor
          </button>
          <button
            onClick={() => setActiveSignal('O2_LAMBDA')}
            className={`px-2 py-1 text-[10px] rounded border transition ${
              activeSignal === 'O2_LAMBDA'
                ? 'bg-slate-800 border-purple-400 text-purple-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            O2 Lambda Sensor
          </button>
          <button
            onClick={() => setActiveSignal('TPS_DC')}
            className={`px-2 py-1 text-[10px] rounded border transition ${
              activeSignal === 'TPS_DC'
                ? 'bg-slate-800 border-amber-400 text-amber-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            TPS Analog DC
          </button>
        </div>

        {/* Scope Scale Controls */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
            <span>VOLT/DIV:</span>
            <button
              onClick={() => setVoltDiv(v => Math.max(0.5, v - 0.25))}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
            >
              -
            </button>
            <span className="font-semibold text-slate-200 tabular-nums">{voltDiv.toFixed(2)}x</span>
            <button
              onClick={() => setVoltDiv(v => Math.min(2.5, v + 0.25))}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800">
            <span>TIME/DIV:</span>
            <button
              onClick={() => setTimeDiv(t => Math.max(0.5, t - 0.25))}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
            >
              -
            </button>
            <span className="font-semibold text-slate-200 tabular-nums">{timeDiv.toFixed(2)}x</span>
            <button
              onClick={() => setTimeDiv(t => Math.min(2.0, t + 0.25))}
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
