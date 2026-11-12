export type PerfMetricKey =
  | 'App'
  | 'WiringCanvas'
  | 'DigitalMultimeter'
  | 'BenchPowerSupply'
  | 'FaultInjector'
  | 'MnaSolver';

export interface PerfMemoryInfo {
  supported: boolean;
  usedMb: number;
  totalMb: number;
  limitMb: number;
  usagePercent: number;
}

export interface PerfSnapshot {
  counts: Record<PerfMetricKey, number>;
  totalComponentRenders: number;
  memory: PerfMemoryInfo;
  domNodes: number;
  capturedAt: number;
}

interface ChromiumPerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

const counters: Record<PerfMetricKey, number> = {
  App: 0,
  WiringCanvas: 0,
  DigitalMultimeter: 0,
  BenchPowerSupply: 0,
  FaultInjector: 0,
  MnaSolver: 0,
};

const resetListeners = new Set<() => void>();

export function recordRenderCycle(key: PerfMetricKey): void {
  counters[key] += 1;
}

export function resetPerfCounters(): void {
  (Object.keys(counters) as PerfMetricKey[]).forEach((k) => {
    counters[k] = 0;
  });
  resetListeners.forEach((cb) => cb());
}

export function subscribePerfReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

export function readMemoryInfo(): PerfMemoryInfo {
  if (typeof performance === 'undefined') {
    return { supported: false, usedMb: 0, totalMb: 0, limitMb: 0, usagePercent: 0 };
  }
  const perfWithMem = performance as Performance & { memory?: ChromiumPerformanceMemory };
  const mem = perfWithMem.memory;
  if (!mem || !mem.jsHeapSizeLimit) {
    return { supported: false, usedMb: 0, totalMb: 0, limitMb: 0, usagePercent: 0 };
  }

  const MB = 1024 * 1024;
  const usedMb = mem.usedJSHeapSize / MB;
  const totalMb = mem.totalJSHeapSize / MB;
  const limitMb = mem.jsHeapSizeLimit / MB;
  const usagePercent = Math.min(100, Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 1000) / 10);

  return {
    supported: true,
    usedMb,
    totalMb,
    limitMb,
    usagePercent,
  };
}

export function getPerfSnapshot(includeDomCount = false): PerfSnapshot {
  const counts: Record<PerfMetricKey, number> = { ...counters };
  const totalComponentRenders =
    counts.App +
    counts.WiringCanvas +
    counts.DigitalMultimeter +
    counts.BenchPowerSupply +
    counts.FaultInjector;

  return {
    counts,
    totalComponentRenders,
    memory: readMemoryInfo(),
    domNodes:
      includeDomCount && typeof document !== 'undefined'
        ? document.getElementsByTagName('*').length
        : 0,
    capturedAt: Date.now(),
  };
}
