import React, { useState, useRef, useEffect } from 'react';
import { EcuPin, WireConnection, BenchComponent, MultimeterState } from '../types/ecu';
import {
  Scissors,
  Wrench,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Link2,
  Disc,
  Sliders,
  Trash2,
  Activity,
  Flame,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { playProbeTapSound } from '../utils/audioFeedback';

interface AnimatedCoordsState {
  coords: { x: number; y: number } | null;
  isMoving: boolean;
  justLanded: boolean;
  tiltAngle: number;
}

function useAnimatedCoords(
  target: { x: number; y: number } | null,
  color: 'red' | 'black'
): AnimatedCoordsState {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(target);
  const [isMoving, setIsMoving] = useState(false);
  const [justLanded, setJustLanded] = useState(false);
  const [tiltAngle, setTiltAngle] = useState(0);

  const prevTargetRef = useRef<{ x: number; y: number } | null>(target);
  const animFrameRef = useRef<number | null>(null);
  const landTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const prev = prevTargetRef.current;

    // Same target
    if (prev?.x === target?.x && prev?.y === target?.y) {
      return;
    }

    // First mount or connecting from unconnected state
    if (!prev || !target) {
      setCoords(target);
      prevTargetRef.current = target;
      if (target) {
        setJustLanded(true);
        playProbeTapSound();
        if (landTimerRef.current) clearTimeout(landTimerRef.current);
        landTimerRef.current = setTimeout(() => setJustLanded(false), 450);
      }
      return;
    }

    // Moving between two distinct pins: simulate technician lifting and seating the probe
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (landTimerRef.current) clearTimeout(landTimerRef.current);

    const startX = coords?.x ?? prev.x;
    const startY = coords?.y ?? prev.y;
    const destX = target.x;
    const destY = target.y;
    const startTime = performance.now();
    const duration = 280; // Physical transition flight duration in ms

    setIsMoving(true);
    setJustLanded(false);

    const baseDirection = color === 'red' ? -1 : 1;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      // Cubic bezier ease-out curve: 1 - (1 - progress)^3
      const ease = 1 - Math.pow(1 - progress, 3);

      const curX = startX + (destX - startX) * ease;
      const curY = startY + (destY - startY) * ease;

      // Arc lift in angle: lifts up to ~14 degrees during mid-flight leap, then settles to 0
      const currentTilt = Math.sin(progress * Math.PI) * 14 * baseDirection;
      setTiltAngle(currentTilt);
      setCoords({ x: curX, y: curY });

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCoords(target);
        setIsMoving(false);
        setTiltAngle(0);
        prevTargetRef.current = target;
        setJustLanded(true);
        playProbeTapSound();

        landTimerRef.current = setTimeout(() => {
          setJustLanded(false);
        }, 450);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
    };
  }, [target?.x, target?.y, color]);

  return { coords, isMoving, justLanded, tiltAngle };
}

interface WiringCanvasProps {
  pins: EcuPin[];
  wires: WireConnection[];
  components: BenchComponent[];
  nodeVoltages: Record<string, number>;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  onAddWire: (sourcePinId: string, targetPinId: string, color?: string, label?: string) => void;
  onToggleCutWire: (wireId: string) => void;
  onDeleteWire: (wireId: string) => void;
  multimeter: MultimeterState;
  onAttachProbe: (color: 'red' | 'black', pinId: string, label: string) => void;
  onUpdateComponentState: (compId: string, updates: Record<string, number | boolean | string>) => void;
  isPowerOn: boolean;
  onOpenEcuPinouts?: () => void;
  simulationSpeed?: number;
}

const AUTOMOTIVE_WIRE_COLORS = [
  { name: 'Red (+12V Power / KL30)', hex: '#ef4444', category: 'power' },
  { name: 'Brown (Ground / KL31)', hex: '#78350f', category: 'ground' },
  { name: 'Violet (Ignition Wake / KL15)', hex: '#a855f7', category: 'ignition' },
  { name: 'Yellow (5V Sensor VREF)', hex: '#eab308', category: 'reference' },
  { name: 'Green (Signal / K-Line)', hex: '#22c55e', category: 'signal' },
  { name: 'Orange (CAN High Bus)', hex: '#f97316', category: 'comms' },
  { name: 'Blue (Injector / Actuator Drive)', hex: '#3b82f6', category: 'actuator' },
  { name: 'Black (Chassis Earth Return)', hex: '#1e293b', category: 'ground' },
  { name: 'White (Auxiliary / Data)', hex: '#cbd5e1', category: 'aux' },
];

export const WiringCanvas: React.FC<WiringCanvasProps> = ({
  pins,
  wires,
  components,
  nodeVoltages,
  selectedPinId,
  onSelectPin,
  onAddWire,
  onToggleCutWire,
  onDeleteWire,
  multimeter,
  onAttachProbe,
  onUpdateComponentState,
  isPowerOn,
  onOpenEcuPinouts,
  simulationSpeed = 1.0,
}) => {
  const [wireSourcePin, setWireSourcePin] = useState<{ id: string; label: string } | null>(null);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [activePinMenuId, setActivePinMenuId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [hoveredEcuPinId, setHoveredEcuPinId] = useState<string | null>(null);
  const [hoveredCompPinId, setHoveredCompPinId] = useState<string | null>(null);

  // Pending wire creation state for color selector modal
  const [pendingWire, setPendingWire] = useState<{
    sourceId: string;
    sourceLabel: string;
    targetId: string;
    targetLabel: string;
  } | null>(null);
  const [selectedWireColor, setSelectedWireColor] = useState<string>('#ef4444');
  const [selectedWireLabel, setSelectedWireLabel] = useState<string>('Automotive Harness Wire');

  // Exact Layout Constants for 100% Mathematical Terminal Alignment
  const ECU_BOX_X = 24;
  const ECU_BOX_Y = 24;
  const ECU_BOX_WIDTH = 236;
  const ECU_HEADER_HEIGHT = 40;
  const ECU_ROW_HEIGHT = 36; // 32px height + 4px gap

  const COMP_WIDTH = 230;
  const COMP_HEADER_HEIGHT = 38;
  const COMP_ROW_HEIGHT = 34; // 30px height + 4px gap

  // Mathematical Coordinate Calculator
  const getPinCoords = (pinId: string): { x: number; y: number } => {
    // 1. ECU Pins
    const ecuIndex = pins.findIndex(p => p.id === pinId);
    if (ecuIndex !== -1) {
      return {
        x: ECU_BOX_X + ECU_BOX_WIDTH,
        y: ECU_BOX_Y + ECU_HEADER_HEIGHT + ecuIndex * ECU_ROW_HEIGHT + 16,
      };
    }

    // 2. Component Pins
    for (const comp of components) {
      const pinIndex = comp.pins.findIndex(p => p.id === pinId);
      if (pinIndex !== -1) {
        return {
          x: comp.x,
          y: comp.y + COMP_HEADER_HEIGHT + pinIndex * COMP_ROW_HEIGHT + 15,
        };
      }
    }

    if (pinId === 'chassis-gnd') return { x: ECU_BOX_X + ECU_BOX_WIDTH, y: 640 };
    if (pinId === 'bench-vbat') return { x: ECU_BOX_X + ECU_BOX_WIDTH, y: 15 };

    return { x: 200, y: 200 };
  };

  const handlePinAction = (pinId: string, label: string) => {
    onSelectPin(pinId);
    setActivePinMenuId(activePinMenuId === pinId ? null : pinId);

    if (wireSourcePin) {
      if (wireSourcePin.id !== pinId) {
        let defaultColor = '#ef4444';
        const l = label.toLowerCase();
        if (l.includes('gnd') || l.includes('ground') || l.includes('kl31')) defaultColor = '#78350f';
        else if (l.includes('can')) defaultColor = '#f97316';
        else if (l.includes('sig') || l.includes('vta') || l.includes('signal')) defaultColor = '#22c55e';
        else if (l.includes('5v') || l.includes('vref')) defaultColor = '#eab308';
        else if (l.includes('ign') || l.includes('kl15')) defaultColor = '#a855f7';

        setPendingWire({
          sourceId: wireSourcePin.id,
          sourceLabel: wireSourcePin.label,
          targetId: pinId,
          targetLabel: label,
        });
        setSelectedWireColor(defaultColor);
        setSelectedWireLabel(`${wireSourcePin.label} -> ${label}`);
      }
      setWireSourcePin(null);
      setActivePinMenuId(null);
    }
  };

  // Get coordinates for probes and connect physics animation hook
  const targetRedCoords = multimeter.redProbe.attachedToPinId
    ? getPinCoords(multimeter.redProbe.attachedToPinId)
    : null;
  const targetBlackCoords = multimeter.blackProbe.attachedToPinId
    ? getPinCoords(multimeter.blackProbe.attachedToPinId)
    : null;

  const redAnimated = useAnimatedCoords(targetRedCoords, 'red');
  const blackAnimated = useAnimatedCoords(targetBlackCoords, 'black');

  return (
    <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col select-none shadow-inner">
      {/* Canvas Top Status HUD */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 shadow">
        <div className="flex items-center gap-1.5 font-semibold text-cyan-400">
          <Activity className="w-3.5 h-3.5" />
          <span>HARNESS SCHEMATIC ENGINE</span>
        </div>
        <span className="text-slate-700">|</span>
        {wireSourcePin ? (
          <div className="flex items-center gap-2 text-amber-400 animate-pulse font-medium">
            <Link2 className="w-3.5 h-3.5" />
            <span>Connect &ldquo;{wireSourcePin.label}&rdquo; &rarr; Click target terminal</span>
            <button
              onClick={() => setWireSourcePin(null)}
              className="text-[10px] text-slate-400 hover:text-white underline ml-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="text-slate-400 text-[11px]">
            Click any pin jack to route wires or attach multimeter probes
          </span>
        )}
      </div>

      {/* Zoom / Reset HUD */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg text-slate-300 shadow">
        <button
          onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-mono px-1.5 text-slate-400 tabular-nums">
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoomLevel(1.0)}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
          title="Reset View 100%"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
          className="relative transition-transform duration-100 min-w-[1060px] min-h-[690px]"
        >
          {/* SVG Connection Layer */}
          <svg className="w-[1060px] h-[690px] block pointer-events-auto">
            {/* Engineering Grid */}
            <defs>
              <pattern id="benchCanvasGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#1e293b" />
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#0f172a" strokeWidth="0.5" />
              </pattern>

              <filter id="wireGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#benchCanvasGrid)" />

            {/* Automotive Wires */}
            {wires.map(wire => {
              const start = getPinCoords(wire.sourcePinId);
              const end = getPinCoords(wire.targetPinId);
              const dx = end.x - start.x;
              const ctrl1X = start.x + dx * 0.45;
              const ctrl2X = end.x - dx * 0.45;
              const pathD = `M ${start.x} ${start.y} C ${ctrl1X} ${start.y}, ${ctrl2X} ${end.y}, ${end.x} ${end.y}`;

              const isHovered = hoveredWireId === wire.id;
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;

              return (
                <g
                  key={wire.id}
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredWireId(wire.id)}
                  onMouseLeave={() => setHoveredWireId(null)}
                >
                  {/* Broad invisible hit area for easy clicking */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    onClick={() => onToggleCutWire(wire.id)}
                  />

                  {/* Wire Outer Jacket */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={wire.isCut ? '#475569' : wire.color}
                    strokeWidth={isHovered ? '4.5' : '3'}
                    strokeDasharray={wire.isCut ? '6,6' : undefined}
                    opacity={wire.isCut ? 0.35 : 0.9}
                    filter={isHovered && !wire.isCut ? 'url(#wireGlow)' : undefined}
                    className="transition-all"
                  />

                  {/* Animated electron current flow particles (when powered & continuous based on voltage) */}
                  {(() => {
                    const srcVolt = nodeVoltages[wire.sourcePinId] ?? 0;
                    const tgtVolt = nodeVoltages[wire.targetPinId] ?? 0;
                    const avgVolt = (srcVolt + tgtVolt) / 2;
                    const isEnergized = isPowerOn && !wire.isCut && avgVolt > 0.4;

                    if (!isEnergized) return null;

                    return (
                      <g className="pointer-events-none">
                        {/* Energy glow stream */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={avgVolt > 10 ? '#38bdf8' : '#eab308'}
                          strokeWidth="4.5"
                          opacity="0.35"
                          filter="url(#wireGlow)"
                        />
                        {/* Moving electron pulse particles */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2"
                          strokeDasharray="6,24"
                          className="animate-electron-flow"
                          style={{ animationDuration: `${0.75 / simulationSpeed}s` }}
                          opacity="0.95"
                        />
                      </g>
                    );
                  })()}

                  {/* Terminal Connection Beads */}
                  <circle cx={start.x} cy={start.y} r="3.5" fill={wire.isCut ? '#475569' : wire.color} />
                  <circle cx={end.x} cy={end.y} r="3.5" fill={wire.isCut ? '#475569' : wire.color} />

                  {/* Cut Wire Badge */}
                  {wire.isCut && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <circle r="11" fill="#dc2626" />
                      <Scissors className="w-3.5 h-3.5 text-white -translate-x-[7px] -translate-y-[7px]" />
                    </g>
                  )}

                  {/* Wire Interactive Hover Tooltip */}
                  {isHovered && (
                    <g transform={`translate(${midX}, ${midY - 22})`} className="pointer-events-none">
                      <rect
                        x="-80"
                        y="-14"
                        width="160"
                        height="28"
                        rx="5"
                        fill="#020617"
                        stroke="#06b6d4"
                        strokeWidth="1.5"
                        className="shadow-xl"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#e2e8f0"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {wire.isCut ? 'Click to Repair Harness Wire' : 'Click to Cut Wire'}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Virtual Multimeter Red Probe Cable Lead with Physical Motion */}
            {redAnimated.coords && (
              <g className="pointer-events-none">
                {/* Touchdown Contact Ripple / Spark Effect */}
                {redAnimated.justLanded && (
                  <g transform={`translate(${redAnimated.coords.x}, ${redAnimated.coords.y})`}>
                    <circle
                      r="16"
                      fill="#ef4444"
                      fillOpacity="0.25"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      className="animate-probe-tap"
                    />
                    <circle r="4" fill="#ffffff" />
                  </g>
                )}

                {/* Flexible silicone test lead wire originating from Red DMM terminal */}
                <path
                  d={`M 15 20 C 15 ${redAnimated.coords.y * 0.45 + 30}, ${redAnimated.coords.x - 70} ${redAnimated.coords.y - 12}, ${redAnimated.coords.x - 28} ${redAnimated.coords.y}`}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.9"
                  style={{
                    filter: 'drop-shadow(0 2px 5px rgba(239, 68, 68, 0.4))',
                  }}
                />

                {/* Probe Handle & Needle assembly with physical tilt and contact point */}
                <g
                  transform={`translate(${redAnimated.coords.x}, ${redAnimated.coords.y}) rotate(${redAnimated.tiltAngle})`}
                  className="transition-transform duration-75"
                >
                  {/* Flexible strain-relief boot */}
                  <rect x="-35" y="-3" width="7" height="6" rx="1.5" fill="#7f1d1d" stroke="#991b1b" strokeWidth="0.8" />
                  {/* Ergonomic Fluke-style probe body */}
                  <rect x="-28" y="-4.5" width="18" height="9" rx="2" fill="#dc2626" stroke="#fca5a5" strokeWidth="0.8" />
                  {/* Grip ridges */}
                  <line x1="-24" y1="-3" x2="-24" y2="3" stroke="#991b1b" strokeWidth="1" />
                  <line x1="-20" y1="-3" x2="-20" y2="3" stroke="#991b1b" strokeWidth="1" />
                  <line x1="-16" y1="-3" x2="-16" y2="3" stroke="#991b1b" strokeWidth="1" />
                  {/* Finger safety barrier flange */}
                  <rect x="-11" y="-6.5" width="2.5" height="13" rx="1" fill="#991b1b" stroke="#f87171" strokeWidth="0.5" />
                  {/* Hardened probe needle shaft */}
                  <line x1="-8.5" y1="0" x2="-2" y2="0" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  {/* Sharp needle tip seated into terminal jack */}
                  <polygon points="-2,-1 0,0 -2,1" fill="#f8fafc" />

                  {/* Terminal contact point indicator */}
                  <circle cx="0" cy="0" r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />

                  {/* High-visibility probe status badge */}
                  <g transform="translate(-10, -22)">
                    <rect
                      x="-2"
                      y="-12"
                      width="92"
                      height="18"
                      rx="3.5"
                      fill="#090d16"
                      stroke="#ef4444"
                      strokeWidth="1.2"
                      opacity="0.95"
                    />
                    <text x="5" y="1" fill="#fca5a5" fontSize="9" fontFamily="monospace" fontWeight="bold">
                      [+] RED PROBE
                    </text>
                  </g>
                </g>
              </g>
            )}

            {/* Virtual Multimeter Black Probe Cable Lead with Physical Motion */}
            {blackAnimated.coords && (
              <g className="pointer-events-none">
                {/* Touchdown Contact Ripple / Spark Effect */}
                {blackAnimated.justLanded && (
                  <g transform={`translate(${blackAnimated.coords.x}, ${blackAnimated.coords.y})`}>
                    <circle
                      r="16"
                      fill="#38bdf8"
                      fillOpacity="0.25"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      className="animate-probe-tap"
                    />
                    <circle r="4" fill="#ffffff" />
                  </g>
                )}

                {/* Flexible silicone COM lead wire originating from COM terminal at (15, 670) */}
                <path
                  d={`M 15 670 C 15 ${blackAnimated.coords.y * 0.6 + 250}, ${blackAnimated.coords.x - 70} ${blackAnimated.coords.y + 12}, ${blackAnimated.coords.x - 28} ${blackAnimated.coords.y}`}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.9"
                  style={{
                    filter: 'drop-shadow(0 2px 5px rgba(100, 116, 139, 0.4))',
                  }}
                />

                {/* Probe Handle & Needle assembly */}
                <g
                  transform={`translate(${blackAnimated.coords.x}, ${blackAnimated.coords.y}) rotate(${blackAnimated.tiltAngle})`}
                  className="transition-transform duration-75"
                >
                  {/* Flexible strain-relief boot */}
                  <rect x="-35" y="-3" width="7" height="6" rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
                  {/* Ergonomic probe body */}
                  <rect x="-28" y="-4.5" width="18" height="9" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.8" />
                  {/* Grip ridges */}
                  <line x1="-24" y1="-3" x2="-24" y2="3" stroke="#0f172a" strokeWidth="1" />
                  <line x1="-20" y1="-3" x2="-20" y2="3" stroke="#0f172a" strokeWidth="1" />
                  <line x1="-16" y1="-3" x2="-16" y2="3" stroke="#0f172a" strokeWidth="1" />
                  {/* Finger safety barrier flange */}
                  <rect x="-11" y="-6.5" width="2.5" height="13" rx="1" fill="#0f172a" stroke="#64748b" strokeWidth="0.5" />
                  {/* Hardened probe needle shaft */}
                  <line x1="-8.5" y1="0" x2="-2" y2="0" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  {/* Sharp steel needle tip seated into terminal jack */}
                  <polygon points="-2,-1 0,0 -2,1" fill="#e2e8f0" />

                  {/* Terminal contact point indicator */}
                  <circle cx="0" cy="0" r="3.5" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />

                  {/* High-visibility probe status badge */}
                  <g transform="translate(-10, 16)">
                    <rect
                      x="-2"
                      y="-1"
                      width="92"
                      height="18"
                      rx="3.5"
                      fill="#090d16"
                      stroke="#64748b"
                      strokeWidth="1.2"
                      opacity="0.95"
                    />
                    <text x="5" y="12" fill="#cbd5e1" fontSize="9" fontFamily="monospace" fontWeight="bold">
                      [-] COM DMM
                    </text>
                  </g>
                </g>
              </g>
            )}
          </svg>

          {/* HTML Overlay 1: ECU Module & Breakout Headers */}
          <div
            style={{
              position: 'absolute',
              top: `${ECU_BOX_Y}px`,
              left: `${ECU_BOX_X}px`,
              width: `${ECU_BOX_WIDTH}px`,
            }}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl p-3 shadow-2xl"
          >
            {/* Header */}
            <div className="h-[36px] flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-xs font-mono font-bold text-slate-100">ECU BREAKOUT</span>
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenEcuPinouts && (
                  <button
                    onClick={onOpenEcuPinouts}
                    className="text-[9px] font-mono text-cyan-400 hover:text-white bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800 px-1.5 py-0.5 rounded transition"
                    title="Inspect Actual ECU Connector Socket & Pinout Tracking"
                  >
                    Socket View
                  </button>
                )}
                <span className="text-[10px] font-mono text-slate-400">ME7.5 1.8T</span>
              </div>
            </div>

            {/* Pin Rows */}
            <div className="flex flex-col gap-1">
              {pins.map(pin => {
                const isSelected = selectedPinId === pin.id;
                const isWireSource = wireSourcePin?.id === pin.id;
                const isMenuOpen = activePinMenuId === pin.id;
                const v = nodeVoltages[pin.id] !== undefined ? nodeVoltages[pin.id] : pin.nominalVoltage;

                const isRedProbe = multimeter.redProbe.attachedToPinId === pin.id;
                const isBlackProbe = multimeter.blackProbe.attachedToPinId === pin.id;

                let categoryBg = 'bg-slate-950/80 border-slate-800 text-slate-300';
                if (pin.category === 'ground') categoryBg = 'border-stone-700 text-stone-300 bg-stone-950/60';
                if (pin.category === 'power') categoryBg = 'border-amber-800 text-amber-300 bg-amber-950/40';
                if (pin.category === 'reference') categoryBg = 'border-yellow-700 text-yellow-300 bg-yellow-950/40';
                if (pin.category === 'communication') categoryBg = 'border-indigo-800 text-indigo-300 bg-indigo-950/40';

                return (
                  <div
                    key={pin.id}
                    className="relative h-[32px]"
                    onMouseEnter={() => setHoveredEcuPinId(pin.id)}
                    onMouseLeave={() => setHoveredEcuPinId(null)}
                  >
                    <div
                      onClick={() => handlePinAction(pin.id, pin.label)}
                      className={`h-full flex items-center justify-between px-2.5 rounded-md border text-[11px] font-mono cursor-pointer transition ${categoryBg} ${
                        isSelected ? 'ring-2 ring-cyan-400 border-cyan-400 font-bold' : 'hover:border-slate-600'
                      } ${isWireSource ? 'ring-2 ring-amber-400 animate-pulse' : ''}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] text-slate-500 font-mono w-4">{pin.pinNumber}</span>
                        <span className="font-semibold">{pin.label}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] tabular-nums text-slate-400">{v.toFixed(1)}V</span>
                        {/* Terminal Jack Circle */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            isWireSource
                              ? 'bg-amber-400 border-white'
                              : isRedProbe
                              ? 'bg-rose-500 border-white ring-2 ring-rose-400 animate-pulse shadow-sm shadow-rose-500/50'
                              : isBlackProbe
                              ? 'bg-slate-700 border-white ring-2 ring-slate-400 animate-pulse shadow-sm shadow-slate-400/50'
                              : 'bg-slate-800 border-slate-600 group-hover:border-cyan-400'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${isRedProbe ? 'bg-white' : isBlackProbe ? 'bg-slate-200' : 'bg-slate-950'}`} />
                        </div>
                      </div>

                      {/* Lead Probe Indicators */}
                      {(isRedProbe || isBlackProbe) && (
                        <div className="absolute -left-3 flex flex-col gap-0.5">
                          {isRedProbe && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
                          {isBlackProbe && <div className="w-2.5 h-2.5 rounded-full bg-slate-300 ring-2 ring-black" />}
                        </div>
                      )}
                    </div>

                    {/* Interactive ECU Pin Tooltip on Hover */}
                    {hoveredEcuPinId === pin.id && !isMenuOpen && !wireSourcePin && (
                      <div
                        className="absolute left-[244px] top-1/2 -translate-y-1/2 z-40 w-64 bg-slate-900 border border-cyan-500/80 rounded-lg p-2.5 shadow-2xl pointer-events-none transition-all duration-150"
                        style={{
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px rgba(6, 182, 212, 0.25)',
                        }}
                      >
                        {/* Header: Pin Number, Label, Category */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-cyan-950 border border-cyan-500/60 font-bold flex items-center justify-center text-cyan-300 text-[10px]">
                              #{pin.pinNumber}
                            </span>
                            <span className="font-bold text-slate-100 text-xs tracking-tight">
                              {pin.label}
                            </span>
                          </div>
                          <span className="text-[9px] font-semibold uppercase text-cyan-400 bg-cyan-950/70 border border-cyan-800/80 px-1.5 py-0.5 rounded">
                            {pin.category.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Full Pin Name */}
                        <div className="text-[11px] font-semibold text-slate-200 mb-1 leading-tight">
                          {pin.name}
                        </div>

                        {/* Purpose / Description */}
                        <div className="text-[10px] text-slate-400 font-sans leading-relaxed mb-2">
                          <strong className="text-slate-300 font-mono text-[9px] uppercase tracking-wider block">PURPOSE:</strong>
                          {pin.description}
                        </div>

                        {/* Voltage & Electrical Stats */}
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800 flex items-center justify-between text-[10px] mb-1.5">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">CURRENT VOLTAGE</span>
                            <span className="text-amber-400 font-bold text-xs tabular-nums">
                              {v.toFixed(2)} V
                            </span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">NOMINAL / IMPEDANCE</span>
                            <span className="text-slate-300 font-medium text-[10px] tabular-nums">
                              {pin.nominalVoltage.toFixed(1)}V · {pin.internalResistance >= 1000 ? `${(pin.internalResistance / 1000).toFixed(1)}kΩ` : `${pin.internalResistance}Ω`}
                            </span>
                          </div>
                        </div>

                        {/* Multimeter Probes Indicator */}
                        {(isRedProbe || isBlackProbe) && (
                          <div className="flex flex-col gap-0.5 text-[9px] border-t border-slate-800/80 pt-1">
                            {isRedProbe && (
                              <span className="text-rose-400 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Red Multimeter Probe (+) Attached
                              </span>
                            )}
                            {isBlackProbe && (
                              <span className="text-slate-300 font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                Black COM Multimeter Probe (-) Attached
                              </span>
                            )}
                          </div>
                        )}

                        {/* Indicator Pointer */}
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-900 border-l border-b border-cyan-500/80 rotate-45" />
                      </div>
                    )}

                    {/* Contextual Pin Menu Popover */}
                    {isMenuOpen && (
                      <div className="absolute left-[242px] top-0 z-30 w-44 bg-slate-900 border border-slate-700 rounded-lg p-1.5 shadow-2xl flex flex-col gap-1 text-[10px] font-mono">
                        <button
                          onClick={() => {
                            onAttachProbe('red', pin.id, `${pin.label} (${pin.name})`);
                            setActivePinMenuId(null);
                          }}
                          className="px-2 py-1 text-left text-rose-300 hover:bg-rose-950/60 rounded flex items-center gap-1.5"
                        >
                          <Disc className="w-3 h-3 text-rose-400" />
                          <span>Attach Red Probe (+)</span>
                        </button>
                        <button
                          onClick={() => {
                            onAttachProbe('black', pin.id, `${pin.label} (${pin.name})`);
                            setActivePinMenuId(null);
                          }}
                          className="px-2 py-1 text-left text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                        >
                          <Disc className="w-3 h-3 text-slate-400" />
                          <span>Attach Black COM (-)</span>
                        </button>
                        <button
                          onClick={() => {
                            setWireSourcePin({ id: pin.id, label: pin.label });
                            setActivePinMenuId(null);
                          }}
                          className="px-2 py-1 text-left text-cyan-300 hover:bg-cyan-950/60 rounded flex items-center gap-1.5"
                        >
                          <Link2 className="w-3 h-3 text-cyan-400" />
                          <span>Route Wire From Here</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* HTML Overlay 2: Bench Components */}
          {components.map(comp => (
            <div
              key={comp.id}
              style={{
                position: 'absolute',
                left: `${comp.x}px`,
                top: `${comp.y}px`,
                width: `${COMP_WIDTH}px`,
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl"
            >
              {/* Component Card Header */}
              <div className="h-[34px] flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <span className="text-xs font-mono font-semibold text-slate-200">{comp.name}</span>
                <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider">{comp.type}</span>
              </div>

              {/* Component Pin Terminal Rows */}
              <div className="flex flex-col gap-1 mb-2">
                {comp.pins.map(cp => {
                  const isSelected = selectedPinId === cp.id;
                  const isWireSource = wireSourcePin?.id === cp.id;
                  const isMenuOpen = activePinMenuId === cp.id;
                  const v = nodeVoltages[cp.id] !== undefined ? nodeVoltages[cp.id] : 0.0;
                  const isRedProbe = multimeter.redProbe.attachedToPinId === cp.id;
                  const isBlackProbe = multimeter.blackProbe.attachedToPinId === cp.id;

                  return (
                    <div
                      key={cp.id}
                      className="relative h-[30px]"
                      onMouseEnter={() => setHoveredCompPinId(cp.id)}
                      onMouseLeave={() => setHoveredCompPinId(null)}
                    >
                      <div
                        onClick={() => handlePinAction(cp.id, `${comp.name}: ${cp.label}`)}
                        className={`h-full flex items-center justify-between px-2 rounded border text-[10px] font-mono cursor-pointer transition bg-slate-950 ${
                          isSelected ? 'ring-1 ring-cyan-400 border-cyan-400 text-white' : 'border-slate-800 text-slate-300 hover:border-slate-700'
                        } ${isWireSource ? 'ring-1 ring-amber-400 animate-pulse' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {/* Left Terminal Jack */}
                          <div
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                              isWireSource
                                ? 'bg-amber-400 border-white'
                                : isRedProbe
                                ? 'bg-rose-500 border-white ring-2 ring-rose-400 animate-pulse shadow-sm shadow-rose-500/50'
                                : isBlackProbe
                                ? 'bg-slate-700 border-white ring-2 ring-slate-400 animate-pulse shadow-sm shadow-slate-400/50'
                                : 'bg-slate-800 border-slate-600'
                            }`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${isRedProbe ? 'bg-white' : isBlackProbe ? 'bg-slate-200' : 'bg-slate-950'}`} />
                          </div>
                          <span>{cp.label}</span>
                        </div>
                        <span className="text-slate-400 tabular-nums">{v.toFixed(2)}V</span>

                        {(isRedProbe || isBlackProbe) && (
                          <div className="absolute -left-2.5 flex flex-col gap-0.5">
                            {isRedProbe && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-1 ring-white" />}
                            {isBlackProbe && <div className="w-2.5 h-2.5 rounded-full bg-slate-300 ring-1 ring-black" />}
                          </div>
                        )}
                      </div>

                      {/* Interactive Component Pin Tooltip on Hover */}
                      {hoveredCompPinId === cp.id && !isMenuOpen && !wireSourcePin && (
                        <div
                          className="absolute left-[236px] top-1/2 -translate-y-1/2 z-40 w-56 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl pointer-events-none transition-all duration-150"
                          style={{
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 10px rgba(59, 130, 246, 0.2)',
                          }}
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                            <span className="font-bold text-slate-100 text-[11px] truncate">{comp.name}</span>
                            <span className="text-[9px] uppercase font-semibold text-cyan-400 bg-cyan-950/70 px-1 rounded border border-cyan-800/60">
                              {cp.type}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 font-semibold mb-1">
                            Terminal: {cp.label}
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded border border-slate-800 flex items-center justify-between text-[10px]">
                            <span className="text-[9px] text-slate-500 uppercase">CURRENT VOLTAGE:</span>
                            <span className="text-amber-400 font-bold tabular-nums">{v.toFixed(2)} V</span>
                          </div>
                          <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
                        </div>
                      )}

                      {/* Component Contextual Menu */}
                      {isMenuOpen && (
                        <div className="absolute left-[236px] top-0 z-30 w-44 bg-slate-900 border border-slate-700 rounded-lg p-1.5 shadow-2xl flex flex-col gap-1 text-[10px] font-mono">
                          <button
                            onClick={() => {
                              onAttachProbe('red', cp.id, `${comp.name}: ${cp.label}`);
                              setActivePinMenuId(null);
                            }}
                            className="px-2 py-1 text-left text-rose-300 hover:bg-rose-950/60 rounded flex items-center gap-1.5"
                          >
                            <Disc className="w-3 h-3 text-rose-400" />
                            <span>Attach Red Probe (+)</span>
                          </button>
                          <button
                            onClick={() => {
                              onAttachProbe('black', cp.id, `${comp.name}: ${cp.label}`);
                              setActivePinMenuId(null);
                            }}
                            className="px-2 py-1 text-left text-slate-300 hover:bg-slate-800 rounded flex items-center gap-1.5"
                          >
                            <Disc className="w-3 h-3 text-slate-400" />
                            <span>Attach Black COM (-)</span>
                          </button>
                          <button
                            onClick={() => {
                              setWireSourcePin({ id: cp.id, label: `${comp.name}: ${cp.label}` });
                              setActivePinMenuId(null);
                            }}
                            className="px-2 py-1 text-left text-cyan-300 hover:bg-cyan-950/60 rounded flex items-center gap-1.5"
                          >
                            <Link2 className="w-3 h-3 text-cyan-400" />
                            <span>Route Wire From Here</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live Physical Component Controls */}
              {comp.id === 'comp-tps' && (
                <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>THROTTLE ANGLE:</span>
                    <span className="text-amber-400 font-bold tabular-nums">
                      {comp.state?.throttleAnglePercent ?? 20}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={(comp.state?.throttleAnglePercent as number) ?? 20}
                    onChange={e => onUpdateComponentState(comp.id, { throttleAnglePercent: parseInt(e.target.value) })}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                  <div className="text-[9px] text-slate-500 flex justify-between">
                    <span>Closed (0.5V)</span>
                    <span>WOT (4.5V)</span>
                  </div>
                </div>
              )}

              {comp.id === 'comp-map' && (
                <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>MANIFOLD PRESSURE:</span>
                    <span className="text-cyan-400 font-bold tabular-nums">
                      {comp.state?.pressureKpa ?? 42} kPa
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={(comp.state?.pressureKpa as number) ?? 42}
                    onChange={e => onUpdateComponentState(comp.id, { pressureKpa: parseInt(e.target.value) })}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                  <div className="text-[9px] text-slate-500 flex justify-between">
                    <span>Idle Vac (20 kPa)</span>
                    <span>Atmo (100 kPa)</span>
                  </div>
                </div>
              )}

              {comp.id === 'comp-ect' && (
                <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>COOLANT TEMP:</span>
                    <span className="text-orange-400 font-bold tabular-nums">
                      {comp.state?.tempCelsius ?? 85}°C
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="115"
                    value={(comp.state?.tempCelsius as number) ?? 85}
                    onChange={e => onUpdateComponentState(comp.id, { tempCelsius: parseInt(e.target.value) })}
                    className="w-full accent-orange-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                  <div className="text-[9px] text-slate-500 flex justify-between">
                    <span>Cold (10°C / 2.5kΩ)</span>
                    <span>Hot (90°C / 250Ω)</span>
                  </div>
                </div>
              )}

              {comp.id === 'comp-inj' && (
                <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono flex items-center justify-between mt-1">
                  <span className="text-slate-400">PULSE:</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    PULSING 2.5ms
                  </span>
                </div>
              )}

              {comp.id === 'comp-relay' && (
                <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono flex items-center justify-between mt-1">
                  <span className="text-slate-400">CONTACTS:</span>
                  <span className="text-emerald-400 font-semibold">LATCHED 30&rarr;87</span>
                </div>
              )}

              {comp.id === 'comp-can' && (
                <div className="bg-slate-950 p-2 rounded-md border border-slate-800 text-[10px] font-mono flex items-center justify-between text-slate-400 mt-1">
                  <span>RESISTOR:</span>
                  <span className="text-indigo-400 font-semibold">120Ω SPLIT (ISO 11898)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Wire Color Selector Modal Dialog */}
      {pendingWire && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-cyan-500 rounded-xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  New Harness Wire Connection
                </h3>
              </div>
              <button
                onClick={() => setPendingWire(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 block">SOURCE TERMINAL</span>
                  <span className="font-bold text-cyan-300">{pendingWire.sourceLabel}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 block">TARGET TERMINAL</span>
                  <span className="font-bold text-amber-300">{pendingWire.targetLabel}</span>
                </div>
              </div>

              {/* Wire Label Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Wire Harness Label / Circuit Note:</label>
                <input
                  type="text"
                  value={selectedWireLabel}
                  onChange={e => setSelectedWireLabel(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Automotive Standard Color Selector Dropdown / Grid */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                  Automotive Wire Color Standard:
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-800">
                  {AUTOMOTIVE_WIRE_COLORS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedWireColor(c.hex)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left transition cursor-pointer ${
                        selectedWireColor === c.hex
                          ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400/40'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full border border-white/40 shrink-0" style={{ backgroundColor: c.hex }} />
                      <div className="flex flex-col truncate">
                        <span className="font-bold text-[11px] truncate">{c.name.split(' ')[0]}</span>
                        <span className="text-[9px] text-slate-400 truncate">{c.name.split('(')[1]?.replace(')', '') || c.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPendingWire(null)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onAddWire(pendingWire.sourceId, pendingWire.targetId, selectedWireColor, selectedWireLabel);
                  setPendingWire(null);
                }}
                className="px-4 py-1.5 text-xs rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Route Color-Coded Wire</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

