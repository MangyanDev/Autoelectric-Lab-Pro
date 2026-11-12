import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Flame,
  Layers,
  RotateCcw,
  Sliders,
  Zap,
  AlertTriangle,
  Bot,
  Globe,
} from 'lucide-react';
import {
  BenchComponent,
  DiagnosticTroubleCode,
  EcuPin,
  InjectedFault,
  MultimeterState,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';
import {
  BenchOverlayMode,
  BenchSceneManager,
  BenchTelemetrySnapshot,
  CameraPresetKey,
} from './three/BenchSceneManager';
import { PickTargetMeta } from './three/ecuHardwareModels';

interface ThreeBenchTwinProps {
  pins: EcuPin[];
  wires: WireConnection[];
  components: BenchComponent[];
  faults: InjectedFault[];
  activeDTCs: DiagnosticTroubleCode[];
  nodeVoltages: Record<string, number>;
  wireCurrentsMa: Record<string, number>;
  multimeter: MultimeterState;
  powerSupply: PowerSupplyState;
  selectedPinId: string | null;
  simulationSpeed: number;
  onSelectPin: (pinId: string | null) => void;
  onAttachProbe: (color: 'red' | 'black', pinId: string, label: string) => void;
  onUpdateComponentState: (compId: string, stateUpdates: Record<string, number | boolean | string>) => void;
  onOpenOfflineBot?: (prompt?: string) => void;
  onOpenGroundedSearch?: (query?: string, dtc?: string) => void;
}

const ThreeBenchTwinComponent: React.FC<ThreeBenchTwinProps> = ({
  pins,
  wires,
  components,
  faults,
  activeDTCs,
  nodeVoltages,
  wireCurrentsMa,
  multimeter,
  powerSupply,
  selectedPinId,
  simulationSpeed,
  onSelectPin,
  onAttachProbe,
  onUpdateComponentState,
  onOpenOfflineBot,
  onOpenGroundedSearch,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<BenchSceneManager | null>(null);

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPresetKey>('OVERVIEW');
  const [overlayMode, setOverlayMode] = useState<BenchOverlayMode>('VOLTAGE');
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [hoveredMeta, setHoveredMeta] = useState<PickTargetMeta | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const onSelectPinRef = useRef(onSelectPin);
  onSelectPinRef.current = onSelectPin;

  const latestTelemetry = useMemo<BenchTelemetrySnapshot>(
    () => ({
      pins,
      wires,
      components,
      faults,
      activeDTCs,
      nodeVoltages,
      wireCurrentsMa,
      multimeter,
      powerSupply,
      selectedPinId,
      simulationSpeed,
      overlayMode,
      explodeAmount,
    }),
    [
      pins,
      wires,
      components,
      faults,
      activeDTCs,
      nodeVoltages,
      wireCurrentsMa,
      multimeter,
      powerSupply,
      selectedPinId,
      simulationSpeed,
      overlayMode,
      explodeAmount,
    ]
  );

  const initialTelemetryRef = useRef(latestTelemetry);
  initialTelemetryRef.current = latestTelemetry;

  // Mount Three.js WebGL scene once inside isolated mountRef
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let mgr: BenchSceneManager | null = null;
    try {
      mgr = new BenchSceneManager(container, initialTelemetryRef.current, {
        onHoverTarget: (meta) => setHoveredMeta(meta),
        onSelectTarget: (meta) => {
          if (meta?.pinId) {
            onSelectPinRef.current(meta.pinId);
          }
        },
        onContextLostChange: (lost) => setContextLost(lost),
        onExplodeTargetSync: (val) => setExplodeAmount(val),
      });
      managerRef.current = mgr;
      setInitError(null);
    } catch (err) {
      setInitError(
        err instanceof Error ? err.message : 'WebGL2 3D viewport failed to initialize.'
      );
    }

    return () => {
      mgr?.dispose();
      managerRef.current = null;
    };
  }, []);

  // Push live MNA telemetry updates into scene without recreating WebGL
  useEffect(() => {
    managerRef.current?.updateTelemetry(latestTelemetry);
  }, [latestTelemetry]);

  // Keyboard shortcut 'H' to toggle Cinema / Zen HUD dock
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handlePresetClick = useCallback((preset: CameraPresetKey) => {
    setActivePreset(preset);
    managerRef.current?.flyToPreset(preset);
  }, []);

  // Resolve active inspected pin info (hovered takes temporary peek, else selectedPinId)
  const inspectedPinId = hoveredMeta?.pinId ?? selectedPinId;
  const inspectedEcuPin = useMemo(
    () => pins.find((p) => p.id === inspectedPinId) || null,
    [pins, inspectedPinId]
  );

  const inspectedLabel = useMemo(() => {
    if (hoveredMeta) return hoveredMeta.label;
    if (inspectedEcuPin) return `Pin ${inspectedEcuPin.pinNumber}: ${inspectedEcuPin.label}`;
    for (const c of components) {
      const cp = c.pins.find((p) => p.id === inspectedPinId);
      if (cp) return `${c.name.split('(')[0].trim()} · ${cp.label}`;
    }
    if (inspectedPinId === 'chassis-gnd') return 'Chassis GND (KL31)';
    return 'Select a 3D Pin or Terminal';
  }, [hoveredMeta, inspectedEcuPin, components, inspectedPinId]);

  const inspectedVoltage =
    inspectedPinId && nodeVoltages[inspectedPinId] !== undefined
      ? nodeVoltages[inspectedPinId]
      : null;

  const inspectedFault = useMemo(
    () => (inspectedPinId ? faults.find((f) => f.pinId === inspectedPinId) : undefined),
    [faults, inspectedPinId]
  );

  const inspectedDtc = useMemo(
    () =>
      inspectedPinId
        ? activeDTCs.find((d) => d.associatedPinIds.includes(inspectedPinId))
        : undefined,
    [activeDTCs, inspectedPinId]
  );

  const tpsComp = useMemo(
    () => components.find((c) => c.id === 'comp-tps'),
    [components]
  );
  const tpsThrottlePct = Number(tpsComp?.state?.throttleAnglePercent ?? 20);
  const showTpsQuickSlider =
    inspectedPinId === 'ecu-pin-7' ||
    inspectedPinId === 'tps-sig' ||
    inspectedPinId === 'tps-vcc' ||
    inspectedPinId === 'tps-gnd';

  return (
    <div className="relative flex-1 w-full h-full rounded-xl overflow-hidden border border-cyan-500/25 bg-[#090f1d]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* WebGL Error / Context Loss Fallback */}
      {(initError || contextLost) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-6">
          <div className="max-w-md rounded-xl border border-amber-500/40 bg-slate-900 p-5 text-center font-mono">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <h3 className="font-hud text-sm font-bold text-slate-100 uppercase tracking-wider">
              {contextLost ? 'WebGL Context Interrupted' : '3D Bench Viewport Unavailable'}
            </h3>
            <p className="mt-1.5 text-xs font-sans text-slate-400">
              {initError ||
                'Your browser temporarily paused the 3D GPU context. Switch tabs or reload to restore live hardware rendering.'}
            </p>
          </div>
        </div>
      )}

      {/* Compact Top-Left 3D Terminal Inspector (Solid/rgba, zero backdrop-blur) */}
      <div className="absolute top-3 left-3 z-10 w-72 sm:w-80 rounded-xl border border-cyan-500/30 bg-[#0b1222]/95 p-3 shadow-xl pointer-events-auto">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Box className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-hud text-[11px] font-bold tracking-wider uppercase text-slate-100 truncate">
              3D Bench Twin · MNA Sync
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
            {powerSupply.isOutputEnabled ? `${powerSupply.voltageSetting.toFixed(1)}V ON` : 'PWR OFF'}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-cyan-300 truncate">
              {inspectedLabel}
            </div>
            <div className="text-[10px] font-sans text-slate-400 truncate mt-0.5">
              {hoveredMeta?.subtitle ||
                inspectedEcuPin?.description ||
                'Drag to orbit · Scroll to zoom · Click any pin'}
            </div>
          </div>
          {inspectedVoltage !== null && (
            <div className="text-right shrink-0 font-mono">
              <div className="text-sm font-bold text-amber-300 tabular-nums">
                {inspectedVoltage.toFixed(2)} V
              </div>
              <div className="text-[9px] text-slate-500 uppercase">Live Node</div>
            </div>
          )}
        </div>

        {inspectedFault && inspectedFault.faultType !== 'NONE' && (
          <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/80 px-2.5 py-1.5 text-[10px] font-mono text-rose-200 flex items-center justify-between gap-2">
            <span className="truncate font-semibold">
              FAULT: {inspectedFault.faultType.replace(/_/g, ' ')}
            </span>
            {inspectedDtc && (
              <span className="text-amber-300 font-bold shrink-0">{inspectedDtc.code}</span>
            )}
          </div>
        )}

        {/* Quick 3D Probe & Diagnostic Actions */}
        {inspectedPinId && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAttachProbe('red', inspectedPinId, inspectedLabel)}
              className="flex-1 px-2 py-1 rounded border border-rose-700/80 bg-rose-950/75 hover:bg-rose-900/80 text-[10px] font-mono font-semibold text-rose-200 transition cursor-pointer whitespace-nowrap"
            >
              Probe Red (+)
            </button>
            <button
              type="button"
              onClick={() => onAttachProbe('black', inspectedPinId, inspectedLabel)}
              className="flex-1 px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] font-mono font-semibold text-slate-200 transition cursor-pointer whitespace-nowrap"
            >
              Probe Black (-)
            </button>
            {inspectedDtc && onOpenOfflineBot && (
              <button
                type="button"
                onClick={() => onOpenOfflineBot(`${inspectedDtc.code} ${inspectedLabel}`)}
                className="px-2 py-1 rounded border border-amber-600/60 bg-amber-950/70 hover:bg-amber-900/80 text-[10px] font-mono text-amber-200 flex items-center gap-1 transition cursor-pointer"
                title="Ask Offline Diagnostic Bot"
              >
                <Bot className="w-3 h-3" />
                <span>Guide</span>
              </button>
            )}
            {inspectedDtc && onOpenGroundedSearch && (
              <button
                type="button"
                onClick={() => onOpenGroundedSearch(`${inspectedDtc.code} automotive diagnostic`, inspectedDtc.code)}
                className="px-2 py-1 rounded border border-cyan-600/60 bg-cyan-950/70 hover:bg-cyan-900/80 text-[10px] font-mono text-cyan-200 flex items-center gap-1 transition cursor-pointer"
                title="Search OEM TSBs"
              >
                <Globe className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Live 3D Throttle Butterfly Test Slider when TPS node is inspected */}
        {showTpsQuickSlider && (
          <div className="mt-2.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1">
              <span>3D Throttle Butterfly Angle</span>
              <span className="text-cyan-300 font-bold tabular-nums">{tpsThrottlePct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={tpsThrottlePct}
              onChange={(e) =>
                onUpdateComponentState('comp-tps', {
                  throttleAnglePercent: Number(e.target.value),
                })
              }
              className="w-full accent-cyan-400 cursor-pointer h-1.5"
            />
          </div>
        )}
      </div>

      {/* Collapsible Bottom-Center Unified Control Dock (<=15% viewport footprint) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(940px,95vw)] pointer-events-auto">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          title="Toggle 3D Controls (H)"
          className="px-3 py-1 rounded-t-lg border border-b-0 border-cyan-500/35 bg-[#0b1222]/95 text-[10px] font-mono font-semibold text-cyan-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Show 3D Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full rounded-xl border border-cyan-500/35 bg-[#0b1222]/95 px-3 py-2 shadow-2xl flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono">
            {/* Camera Presets */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400 mx-1 shrink-0" />
              {(
                [
                  ['OVERVIEW', 'Overview'],
                  ['ECU_EXPLODED', 'ECU Exploded'],
                  ['CONNECTOR_16PIN', '16-Pin Header'],
                  ['HARNESS_ACTUATORS', 'Actuators'],
                ] as [CameraPresetKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetClick(key)}
                  className={`px-2 py-1 rounded text-[10px] transition whitespace-nowrap cursor-pointer ${
                    activePreset === key
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Explode ECU Housing Slider */}
            <div className="flex items-center gap-2 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800">
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[10px] text-slate-300 whitespace-nowrap">Explode ECU</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(explodeAmount * 100)}
                onChange={(e) => setExplodeAmount(Number(e.target.value) / 100)}
                aria-label="Explode ECU Housing"
                className="w-20 sm:w-24 accent-amber-400 cursor-pointer h-1.5"
              />
              <span className="text-[10px] text-amber-300 font-bold tabular-nums w-8 text-right">
                {Math.round(explodeAmount * 100)}%
              </span>
            </div>

            {/* Diagnostic Overlay Switcher */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setOverlayMode('VOLTAGE')}
                className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 transition whitespace-nowrap cursor-pointer ${
                  overlayMode === 'VOLTAGE'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Voltage</span>
              </button>
              <button
                type="button"
                onClick={() => setOverlayMode('THERMAL')}
                className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 transition whitespace-nowrap cursor-pointer ${
                  overlayMode === 'THERMAL'
                    ? 'bg-rose-500 text-white font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Fault Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => setOverlayMode('WIRE_ID')}
                className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 transition whitespace-nowrap cursor-pointer ${
                  overlayMode === 'WIRE_ID'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Wire ID</span>
              </button>
            </div>

            {/* Reset View */}
            <button
              type="button"
              onClick={() => {
                setExplodeAmount(0);
                handlePresetClick('OVERVIEW');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-200 flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              title="Reset 3D Camera & Enclosure"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset View</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ThreeBenchTwin = React.memo(ThreeBenchTwinComponent);
