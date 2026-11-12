import React, { useEffect, useState } from 'react';
import { Activity, Cpu, RotateCcw, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import {
  getPerfSnapshot,
  PerfSnapshot,
  resetPerfCounters,
  subscribePerfReset,
} from '../utils/perfMonitor';

export const PerformanceMonitorWidget: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(() => getPerfSnapshot(false));

  useEffect(() => {
    const refresh = () => {
      setSnapshot(getPerfSnapshot(isExpanded));
    };

    refresh();

    const intervalMs = isExpanded ? 1000 : 1500;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refresh();
    }, intervalMs);

    const unsubReset = subscribePerfReset(refresh);

    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      unsubReset();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isExpanded]);

  const { memory, counts, domNodes } = snapshot;

  const heapColorClass = !memory.supported
    ? 'text-slate-400'
    : memory.usagePercent >= 75
    ? 'text-rose-400'
    : memory.usagePercent >= 50
    ? 'text-amber-300'
    : 'text-emerald-300';

  const harnessRatio =
    counts.App > 0 ? Math.round((counts.WiringCanvas / counts.App) * 100) : 0;

  return (
    <div className="relative flex items-center">
      {/* Compact Inline Footer Pill */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        title="Toggle Runtime Heap & Render Cycle Monitor"
        className={`flex items-center gap-2 px-2 py-1 rounded border text-[10px] font-mono transition cursor-pointer whitespace-nowrap ${
          isExpanded
            ? 'bg-cyan-950/80 border-cyan-500/70 text-cyan-200'
            : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/90 text-slate-300'
        }`}
      >
        <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
        <span className="tabular-nums">
          HEAP:{' '}
          <strong className={heapColorClass}>
            {memory.supported ? `${memory.usedMb.toFixed(1)} MB` : 'N/A'}
          </strong>
        </span>
        <span className="text-slate-600">·</span>
        <span className="tabular-nums">
          HARNESS:{' '}
          <strong className="text-amber-300">{counts.WiringCanvas}</strong>
          <span className="text-slate-500 hidden sm:inline">/{counts.App}</span>
        </span>
        <span className="text-slate-600 hidden lg:inline">·</span>
        <span className="tabular-nums hidden lg:inline">
          MNA: <strong className="text-cyan-300">{counts.MnaSolver}</strong>
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronUp className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {/* Expandable Upward Diagnostic Popover */}
      {isExpanded && (
        <div
          role="region"
          aria-label="Runtime Performance & Render Cycle Monitor"
          className="absolute bottom-full right-0 mb-2 w-80 sm:w-96 hud-panel rounded-xl p-3 shadow-2xl z-50 text-[11px] font-mono text-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-hud text-xs font-bold tracking-wider text-slate-100 uppercase">
                Runtime Memory &amp; Render Telemetry
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSnapshot(getPerfSnapshot(true))}
                title="Refresh sample now"
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={resetPerfCounters}
                title="Reset render cycle counters"
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* JS Heap Memory Section */}
          <div className="hud-well rounded-lg p-2.5 mb-2.5">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-slate-400 uppercase tracking-wider">JS Heap Consumption</span>
              {memory.supported ? (
                <span className={`font-bold tabular-nums ${heapColorClass}`}>
                  {memory.usedMb.toFixed(1)} / {memory.totalMb.toFixed(1)} MB ({memory.usagePercent}%)
                </span>
              ) : (
                <span className="text-slate-500">Chromium performance.memory unavailable</span>
              )}
            </div>

            {memory.supported && (
              <>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-1.5">
                  <div
                    className={`h-full transition-all duration-300 ${
                      memory.usagePercent >= 75
                        ? 'bg-rose-500'
                        : memory.usagePercent >= 50
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(4, (memory.usedMb / Math.max(1, memory.totalMb)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
                  <span>Heap Limit: {memory.limitMb.toFixed(0)} MB</span>
                  <span>DOM Nodes: {domNodes}</span>
                </div>
              </>
            )}

            {!memory.supported && (
              <div className="text-[10px] text-slate-400 tabular-nums">
                Active DOM Nodes: <strong className="text-cyan-300">{domNodes}</strong>
              </div>
            )}
          </div>

          {/* Render Cycle Counters */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
              <span>Committed Render Cycles</span>
              <span className="text-cyan-300 tabular-nums">
                Harness/App Ratio: {harnessRatio}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="hud-well rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-amber-300 font-semibold">WiringCanvas</span>
                <span className="font-bold text-slate-100 tabular-nums">{counts.WiringCanvas}</span>
              </div>
              <div className="hud-well rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-cyan-300 font-semibold">App Shell</span>
                <span className="font-bold text-slate-100 tabular-nums">{counts.App}</span>
              </div>
              <div className="hud-well rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-slate-300">DigitalMultimeter</span>
                <span className="font-bold text-slate-100 tabular-nums">{counts.DigitalMultimeter}</span>
              </div>
              <div className="hud-well rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-slate-300">BenchPowerSupply</span>
                <span className="font-bold text-slate-100 tabular-nums">{counts.BenchPowerSupply}</span>
              </div>
              <div className="hud-well rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-slate-300">FaultInjector</span>
                <span className="font-bold text-slate-100 tabular-nums">{counts.FaultInjector}</span>
              </div>
              <div className="hud-well rounded px-2 py-1.5 flex items-center justify-between">
                <span className="text-emerald-300 font-semibold">MNA Solves</span>
                <span className="font-bold text-emerald-300 tabular-nums">{counts.MnaSolver}</span>
              </div>
            </div>
          </div>

          <p className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-sans text-slate-400 leading-snug">
            Isolated leaf monitor: polling does not trigger App or WiringCanvas re-renders. UI-only toggles should increment App without incrementing WiringCanvas or MNA Solves.
          </p>
        </div>
      )}
    </div>
  );
};
