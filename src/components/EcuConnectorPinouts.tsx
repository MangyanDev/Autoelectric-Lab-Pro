import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { EcuPin, MultimeterState, PowerSupplyState } from '../types/ecu';
import {
  Cpu,
  Disc,
  Search,
  CheckCircle2,
  ShieldAlert,
  Layers,
  ArrowRight,
  Terminal,
  Car,
  Check,
  Globe,
} from 'lucide-react';
import {
  ECU_BRAND_PROFILES,
  ECU_BENCH_PINOUTS,
  BenchPinoutInfo,
  PcbComponentPoint,
  EcuBrandProfile,
} from './ecuPinoutData';
import { OemConnectorDiagram } from './OemConnectorDiagram';

export { ECU_BRAND_PROFILES, ECU_BENCH_PINOUTS };
export type { BenchPinoutInfo, PcbComponentPoint, EcuBrandProfile };

interface EcuConnectorPinoutsProps {
  pins: EcuPin[];
  nodeVoltages: Record<string, number>;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  multimeter: MultimeterState;
  onAttachProbe: (color: 'red' | 'black', pinId: string, label: string) => void;
  powerSupply: PowerSupplyState;
  onSearchLivePinout?: (brandOrModel: string) => void;
}

/**
 * Downscales oversized local photos (e.g. >1280px) to <= maxWidth WebP
 * and revokes object URLs on unmount/change to prevent bitmap RAM spikes.
 */
function useDownscaledImage(src?: string, maxWidth = 1280): string | undefined {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(src);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const img = new Image();
    img.decoding = 'async';
    img.src = src;

    img.onload = () => {
      if (!active) return;
      if (img.naturalWidth <= maxWidth) {
        setResolvedSrc(src);
        return;
      }

      const scale = maxWidth / img.naturalWidth;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setResolvedSrc(src);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!active || !blob) return;
          objectUrl = URL.createObjectURL(blob);
          setResolvedSrc(objectUrl);
          canvas.width = 0;
          canvas.height = 0;
        },
        'image/webp',
        0.82
      );
    };

    img.onerror = () => {
      if (active) setResolvedSrc(src);
    };

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, maxWidth]);

  return resolvedSrc;
}

const LiveVoltageValue = React.memo<{
  simPinId?: string;
  nominalVoltage: number;
  nodeVoltages: Record<string, number>;
  decimals?: number;
  className?: string;
}>(({ simPinId, nominalVoltage, nodeVoltages, decimals = 1, className }) => {
  const val =
    simPinId && nodeVoltages[simPinId] !== undefined
      ? nodeVoltages[simPinId]
      : nominalVoltage;
  return <span className={className}>{val.toFixed(decimals)}V</span>;
});
LiveVoltageValue.displayName = 'LiveVoltageValue';

const PinDirectoryRow = React.memo<{
  pin: BenchPinoutInfo;
  isSelected: boolean;
  isRedProbe: boolean;
  isBlackProbe: boolean;
  nodeVoltages: Record<string, number>;
  onSelect: (pin: BenchPinoutInfo) => void;
}>(({ pin, isSelected, isRedProbe, isBlackProbe, nodeVoltages, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(pin)}
      className={`p-2 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-1 ${
        isSelected
          ? 'bg-slate-800/90 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 min-w-[26px] h-6 rounded bg-slate-900 border border-slate-700 font-bold flex items-center justify-center text-cyan-300 text-[11px] shrink-0">
            {pin.pinCode || `#${pin.pinNumber}`}
          </span>
          <div className="truncate">
            <span className="font-bold text-slate-100">{pin.label}</span>
            <span className="text-[10px] text-slate-400 ml-1.5">{pin.signalName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-1">
          <LiveVoltageValue
            simPinId={pin.associatedSimPinId}
            nominalVoltage={pin.nominalVoltage}
            nodeVoltages={nodeVoltages}
            decimals={1}
            className="text-amber-400 font-bold tabular-nums text-[11px]"
          />
          {isRedProbe && (
            <span
              className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white"
              title="Red DMM Probe Attached"
            />
          )}
          {isBlackProbe && (
            <span
              className="w-2.5 h-2.5 rounded-full bg-slate-300 ring-2 ring-black"
              title="Black COM Probe Attached"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1 mt-0.5">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: pin.colorHex }}
          />
          <span className="truncate">{pin.wireColor}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 truncate max-w-[180px] sm:max-w-[230px]">
            {pin.benchRole}
          </span>
        </div>
        <span className="text-slate-500 font-mono shrink-0 ml-1">{pin.plug}</span>
      </div>
    </div>
  );
});
PinDirectoryRow.displayName = 'PinDirectoryRow';

export const EcuConnectorPinouts: React.FC<EcuConnectorPinoutsProps> = ({
  nodeVoltages,
  onSelectPin,
  multimeter,
  onAttachProbe,
  onSearchLivePinout,
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('toyota-denso-175822');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugFilter, setSelectedPlugFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showOverlayMarkers, setShowOverlayMarkers] = useState(true);
  const [viewMode, setViewMode] = useState<'PHYSICAL' | 'PCB' | 'LOGICAL'>('PHYSICAL');

  const activeBrand = useMemo(
    () => ECU_BRAND_PROFILES.find((b) => b.id === selectedBrandId) || ECU_BRAND_PROFILES[0],
    [selectedBrandId]
  );

  const [activePinDetail, setActivePinDetail] = useState<BenchPinoutInfo>(
    () => activeBrand.pinouts[0]
  );
  const [selectedPcbComponent, setSelectedPcbComponent] = useState<PcbComponentPoint | null>(
    () => activeBrand.pcbComponents?.[0] ?? null
  );

  // Only decode PCB raster image when PCB view is active
  const activePcbImg = useDownscaledImage(
    viewMode === 'PCB' ? activeBrand.pcbImageSrc : undefined,
    1280
  );

  const handleBrandChange = useCallback((brandId: string) => {
    setSelectedBrandId(brandId);
    const newBrand =
      ECU_BRAND_PROFILES.find((b) => b.id === brandId) || ECU_BRAND_PROFILES[0];
    setSelectedPlugFilter('ALL');
    setActivePinDetail(newBrand.pinouts[0]);
    if (newBrand.pcbComponents && newBrand.pcbComponents.length > 0) {
      setSelectedPcbComponent(newBrand.pcbComponents[0]);
    } else {
      setSelectedPcbComponent(null);
      setViewMode((prev) => (prev === 'PCB' ? 'PHYSICAL' : prev));
    }
  }, []);

  const handleSelectPinRow = useCallback(
    (pin: BenchPinoutInfo) => {
      setActivePinDetail(pin);
      if (pin.associatedSimPinId) onSelectPin(pin.associatedSimPinId);
    },
    [onSelectPin]
  );

  const filteredPins = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return activeBrand.pinouts.filter((p) => {
      const matchesSearch =
        q === '' ||
        p.pinNumber.toString().includes(q) ||
        (p.pinCode && p.pinCode.toLowerCase().includes(q)) ||
        p.label.toLowerCase().includes(q) ||
        p.signalName.toLowerCase().includes(q) ||
        p.benchRole.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (q === 'ground' &&
          (p.category === 'ground' ||
            p.benchRole.toLowerCase().includes('ground') ||
            p.signalName.toLowerCase().includes('ground'))) ||
        ((q === 'k-line' || q === 'kline') &&
          (p.category === 'communication' ||
            p.label.toLowerCase().includes('k-line') ||
            p.signalName.toLowerCase().includes('k-line') ||
            p.benchRole.toLowerCase().includes('k-line') ||
            p.label.toLowerCase().includes('sil'))) ||
        (q === 'can' &&
          (p.category === 'communication' ||
            p.signalName.toLowerCase().includes('can') ||
            p.label.toLowerCase().includes('can'))) ||
        (q === 'injector' &&
          (p.category === 'actuator_out' ||
            p.signalName.toLowerCase().includes('injector') ||
            p.benchRole.toLowerCase().includes('injector'))) ||
        ((q === 'sensor' || q === 'sensor signal') && p.category === 'sensor_in') ||
        (q === 'power' && p.category === 'power');

      const matchesPlug = selectedPlugFilter === 'ALL' || p.plug === selectedPlugFilter;
      const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;

      return matchesSearch && matchesPlug && matchesCategory;
    });
  }, [activeBrand.pinouts, searchQuery, selectedPlugFilter, categoryFilter]);

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden text-slate-100 p-1 font-mono select-none">
      {/* 1. Header Toolbar */}
      <div className="hud-panel rounded-xl p-3 flex flex-col gap-3 shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-cyan-500/15 pb-2.5">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
              alt="AutoElectric Lab Pro Official Logo"
              width={32}
              height={32}
              decoding="async"
              className="h-8 w-auto object-contain rounded border border-cyan-500/40 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-hud font-bold text-slate-100 tracking-wide uppercase">
                  {activeBrand.modelName}
                </h2>
                <span className="text-[10px] text-cyan-300 bg-cyan-950/70 border border-cyan-600/60 px-2 py-0.5 rounded font-semibold">
                  {activeBrand.cavityInfo}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                <strong className="text-amber-300">PH Vehicles:</strong>{' '}
                {activeBrand.popularVehiclesInPH}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">
              ECU BRAND:
            </span>
            <select
              value={selectedBrandId}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="bg-slate-950 border-2 border-cyan-500/80 text-cyan-300 font-bold rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 flex-1 md:w-72 shadow-md cursor-pointer"
            >
              {ECU_BRAND_PROFILES.map((brand) => (
                <option
                  key={brand.id}
                  value={brand.id}
                  className="bg-slate-950 text-slate-100 font-mono"
                >
                  {brand.brandName} — {brand.modelName.split('(')[0]}
                </option>
              ))}
            </select>
            {onSearchLivePinout && (
              <button
                onClick={() => onSearchLivePinout(activeBrand.modelName)}
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-950 to-cyan-950 hover:from-blue-900 hover:to-cyan-900 border border-cyan-500/80 text-cyan-200 flex items-center gap-1.5 text-xs font-bold transition whitespace-nowrap shadow-sm cursor-pointer"
                title="Search live Google Search Grounding for OEM bench pinouts"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Search Live Pinouts</span>
              </button>
            )}
          </div>
        </div>

        {/* Brand Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {ECU_BRAND_PROFILES.map((brand) => {
            const isSelected = brand.id === selectedBrandId;
            return (
              <button
                key={brand.id}
                onClick={() => handleBrandChange(brand.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 border cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-300'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                <Car className="w-3 h-3" />
                <span>{brand.brandName}</span>
                {isSelected && <Check className="w-3 h-3 text-cyan-200" />}
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search function (Ground, CAN, Injector, Sensor)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64 sm:w-72"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10.5px]">
              {['', 'Ground', 'K-Line', 'CAN', 'Injector', 'Sensor'].map((term) => {
                const active =
                  (term === '' && searchQuery === '') ||
                  (term !== '' &&
                    (searchQuery.toLowerCase() === term.toLowerCase() ||
                      (term === 'K-Line' && searchQuery.toLowerCase() === 'kline')));
                return (
                  <button
                    key={term || 'all'}
                    onClick={() => setSearchQuery(term)}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      active
                        ? term === 'K-Line'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-cyan-600 text-white font-bold'
                        : term === 'K-Line'
                        ? 'text-emerald-400 hover:text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {term === ''
                      ? 'All'
                      : term === 'K-Line'
                      ? 'K-Line (ISO-9141)'
                      : term === 'Sensor'
                      ? 'Sensor Signal'
                      : term}
                  </button>
                );
              })}
            </div>

            <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {activeBrand.plugs.map((plug) => (
                <button
                  key={plug.id}
                  onClick={() => setSelectedPlugFilter(plug.id)}
                  className={`px-2.5 py-1 rounded transition text-[10.5px] cursor-pointer ${
                    selectedPlugFilter === plug.id
                      ? 'bg-slate-800 text-cyan-400 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {plug.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowOverlayMarkers((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition cursor-pointer ${
              showOverlayMarkers
                ? 'bg-cyan-950/80 border-cyan-600 text-cyan-300 font-semibold'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            title="Toggle Interactive Pin Markers on Photograph"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pin Overlay: {showOverlayMarkers ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden min-h-0">
        {/* Left Column: Socket / PCB / Logical Schematic + Inspection Card */}
        <div className="flex-1 flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-hidden shadow-inner">
          <div className="flex flex-wrap items-center justify-between text-xs border-b border-slate-800 pb-2 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">
                {viewMode === 'PHYSICAL'
                  ? 'PHYSICAL CONNECTOR RECEPTACLE (SOCKET)'
                  : viewMode === 'PCB'
                  ? 'INTERNAL ECU PCB BOARD & COMPONENT TOPOLOGY'
                  : 'LOGICAL ELECTRICAL SCHEMATIC'}
              </span>
              <span className="text-slate-500 text-[10px]">· {activeBrand.brandName}</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('PHYSICAL')}
                className={`px-2.5 py-1 rounded transition text-[10.5px] font-bold cursor-pointer ${
                  viewMode === 'PHYSICAL'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Socket Plug
              </button>
              {activeBrand.pcbImageSrc && (
                <button
                  onClick={() => {
                    setViewMode('PCB');
                    if (!selectedPcbComponent && activeBrand.pcbComponents?.length) {
                      setSelectedPcbComponent(activeBrand.pcbComponents[0]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded transition text-[10.5px] font-bold flex items-center gap-1 cursor-pointer ${
                    viewMode === 'PCB'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300'
                      : 'text-emerald-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-emerald-300" />
                  <span>Internal PCB Board</span>
                </button>
              )}
              <button
                onClick={() => setViewMode('LOGICAL')}
                className={`px-2.5 py-1 rounded transition text-[10.5px] font-bold cursor-pointer ${
                  viewMode === 'LOGICAL'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Logical Schematic
              </button>
            </div>
          </div>

          {/* Viewport */}
          {viewMode === 'PHYSICAL' ? (
            <OemConnectorDiagram
              brand={activeBrand}
              activePinDetail={activePinDetail}
              selectedPlugFilter={selectedPlugFilter}
              showOverlayMarkers={showOverlayMarkers}
              multimeter={multimeter}
              nodeVoltages={nodeVoltages}
              onSelectPin={handleSelectPinRow}
            />
          ) : viewMode === 'PCB' && activeBrand.pcbImageSrc ? (
            <div className="relative h-64 sm:h-80 lg:flex-1 bg-black rounded-lg overflow-hidden border border-emerald-500/50 flex items-center justify-center">
              <img
                key={activePcbImg || activeBrand.pcbImageSrc}
                src={activePcbImg || activeBrand.pcbImageSrc}
                alt={`${activeBrand.modelName} Internal PCB Inspection`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain select-none"
              />

              <div className="absolute inset-0 pointer-events-auto">
                {activeBrand.pcbComponents?.map((comp) => {
                  const isSelected = selectedPcbComponent?.id === comp.id;
                  return (
                    <div
                      key={comp.id}
                      onClick={() => setSelectedPcbComponent(comp)}
                      style={{
                        position: 'absolute',
                        left: `${comp.xPercent}%`,
                        top: `${comp.yPercent}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="cursor-pointer group/comp z-10"
                      title={`${comp.designation}: ${comp.name}`}
                    >
                      <div
                        className={`px-2 py-0.5 rounded-full border text-[9px] font-bold font-mono flex items-center gap-1 transition-transform shadow ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 border-white ring-2 ring-emerald-400 scale-110 z-20'
                            : 'bg-emerald-950/95 text-emerald-300 border-emerald-500 hover:scale-110'
                        }`}
                      >
                        <Cpu className="w-2.5 h-2.5 shrink-0" />
                        <span className="whitespace-nowrap">
                          {comp.designation.split(' ')[0]}
                        </span>
                      </div>

                      <div className="opacity-0 group-hover/comp:opacity-100 pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 border border-emerald-400 text-white text-[10px] px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap z-30 transition-opacity">
                        <strong className="text-emerald-400">{comp.designation}</strong>:{' '}
                        {comp.name}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-2 left-2 bg-slate-950/90 px-2.5 py-1 rounded border border-emerald-500/60 text-[10px] text-emerald-300">
                {activeBrand.brandName} PCB Inspection · Click any hotspot to inspect SMD test
                points
              </div>
            </div>
          ) : (
            <div className="relative h-64 sm:h-80 lg:flex-1 bg-[#060c14] rounded-lg overflow-hidden border border-cyan-500/40 p-3 flex flex-col items-center justify-center">
              <svg viewBox="0 0 700 280" className="w-full h-full">
                <rect width="700" height="280" fill="#081412" />
                <path
                  d="M 0 50 L 700 50 M 0 100 L 700 100 M 0 150 L 700 150 M 0 200 L 700 200 M 0 250 L 700 250"
                  stroke="#16362e"
                  strokeWidth="0.8"
                  strokeDasharray="4,4"
                />
                <rect
                  x="230"
                  y="40"
                  width="240"
                  height="200"
                  rx="10"
                  fill="#0d2b23"
                  stroke="#00f3ff"
                  strokeWidth="2"
                />
                <text
                  x="350"
                  y="75"
                  fill="#00f3ff"
                  fontSize="12"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {activeBrand.brandName.toUpperCase()} MCU
                </text>
                <text
                  x="350"
                  y="95"
                  fill="#448d79"
                  fontSize="9.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {activeBrand.modelName.split('(')[0]}
                </text>
                <text
                  x="350"
                  y="222"
                  fill="#94a3b8"
                  fontSize="8.5"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  LOGICAL SCHEMATIC VIEW · ACTIVE BENCH
                </text>

                {activeBrand.pinouts.slice(0, 14).map((pin, idx) => {
                  const yPos = 55 + Math.floor(idx / 2) * 26;
                  const isLeft = idx % 2 === 0;
                  const xNode = isLeft ? 230 : 470;
                  const xExt = isLeft ? 135 : 565;
                  const isSelected =
                    activePinDetail.pinNumber === pin.pinNumber &&
                    activePinDetail.plug === pin.plug;
                  const color = pin.colorHex || '#00f3ff';

                  return (
                    <g
                      key={`${pin.plug}-${pin.pinNumber}`}
                      onClick={() => handleSelectPinRow(pin)}
                      className="cursor-pointer"
                    >
                      <line
                        x1={xNode}
                        y1={yPos}
                        x2={xExt}
                        y2={yPos}
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 1.75}
                      />
                      <circle
                        cx={xNode}
                        cy={yPos}
                        r={isSelected ? 5 : 3.5}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <rect
                        x={isLeft ? 25 : 565}
                        y={yPos - 9}
                        width="110"
                        height="18"
                        rx="3"
                        fill="#091512"
                        stroke={isSelected ? '#00f3ff' : '#1b4d3e'}
                        strokeWidth="1.2"
                      />
                      <text
                        x={isLeft ? 80 : 620}
                        y={yPos + 3.5}
                        fill={isSelected ? '#00f3ff' : '#cbd5e1'}
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {pin.pinCode || `#${pin.pinNumber}`} {pin.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-2 left-2 bg-slate-950/90 px-2.5 py-1 rounded border border-cyan-500/60 text-[10px] text-cyan-300">
                Logical Electrical Schematic · Click any pin node to select
              </div>
            </div>
          )}

          {/* Bottom Inspection Card */}
          {viewMode === 'PCB' && selectedPcbComponent ? (
            <div className="bg-slate-950 border border-emerald-500/50 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-white shrink-0" />
                  <span className="font-bold text-sm text-emerald-300">
                    {selectedPcbComponent.designation} · {selectedPcbComponent.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded uppercase shrink-0">
                  {selectedPcbComponent.type.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">COMPONENT SPECIFICATION</span>
                  <span className="font-semibold text-emerald-300">
                    {selectedPcbComponent.spec}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">
                    ASSOCIATED HARNESS CONNECTOR PINS
                  </span>
                  <span className="font-semibold text-slate-200">
                    {selectedPcbComponent.associatedPins || 'Internal Power/Ground Plane'}
                  </span>
                </div>
              </div>

              <p className="text-slate-300 text-[11px] font-sans leading-relaxed bg-slate-900/90 p-2 rounded border border-slate-800">
                {selectedPcbComponent.diagnosticRole}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onAttachProbe(
                        'red',
                        selectedPcbComponent.associatedSimPinId || 'ecu-pin-10',
                        `${selectedPcbComponent.designation} Test Point`
                      )
                    }
                    className="px-2.5 py-1 text-xs rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                    <span>Attach Red Probe to Test Point</span>
                  </button>
                  <button
                    onClick={() => onAttachProbe('black', 'ecu-pin-1', 'PCB Chassis Ground')}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-slate-400 fill-slate-400" />
                    <span>Attach Black COM to PCB Ground</span>
                  </button>
                </div>
                <button
                  onClick={() => setViewMode('PHYSICAL')}
                  className="px-2.5 py-1 text-xs rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Inspect Harness Socket Pins</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
                    style={{ backgroundColor: activePinDetail.colorHex }}
                  />
                  <span className="font-bold text-sm text-cyan-300 truncate">
                    {activePinDetail.pinCode || `PIN #${activePinDetail.pinNumber}`} ·{' '}
                    {activePinDetail.label}
                  </span>
                  <span className="text-slate-400 text-xs truncate">
                    ({activePinDetail.signalName})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                  <span className="text-slate-400">VOLTAGE:</span>
                  <LiveVoltageValue
                    simPinId={activePinDetail.associatedSimPinId}
                    nominalVoltage={activePinDetail.nominalVoltage}
                    nodeVoltages={nodeVoltages}
                    decimals={2}
                    className="text-amber-400 font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">CONNECTOR PLUG</span>
                  <span className="font-semibold text-slate-200">{activePinDetail.plug}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">HARNESS WIRE COLOR</span>
                  <span className="font-semibold" style={{ color: activePinDetail.colorHex }}>
                    {activePinDetail.wireColor}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">SIGNAL CATEGORY</span>
                  <span className="font-semibold text-cyan-300 uppercase">
                    {activePinDetail.category.replace('_', ' ')}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">BENCH ROLE</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {activePinDetail.benchRole}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/90 p-2 rounded border border-slate-800 text-[11px] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px]">
                  <Terminal className="w-3 h-3" />
                  <span>BENCH CONNECTION INSTRUCTION:</span>
                </div>
                <p className="text-slate-300 text-[11px] font-sans">
                  {activePinDetail.connectionInstruction}
                </p>
                <div className="text-[10px] text-slate-400 font-sans">
                  <strong className="text-slate-300">Spec:</strong>{' '}
                  {activePinDetail.electricalSpec}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const simId =
                        activePinDetail.associatedSimPinId ||
                        `ecu-pin-${activePinDetail.pinNumber}`;
                      onAttachProbe(
                        'red',
                        simId,
                        `Pin ${activePinDetail.pinCode || activePinDetail.pinNumber} - ${activePinDetail.label}`
                      );
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                    <span>Attach Red Probe (+)</span>
                  </button>
                  <button
                    onClick={() => {
                      const simId =
                        activePinDetail.associatedSimPinId ||
                        `ecu-pin-${activePinDetail.pinNumber}`;
                      onAttachProbe(
                        'black',
                        simId,
                        `Pin ${activePinDetail.pinCode || activePinDetail.pinNumber} - ${activePinDetail.label}`
                      );
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-slate-400 fill-slate-400" />
                    <span>Attach Black COM (-)</span>
                  </button>
                </div>

                {activePinDetail.category === 'boot' && (
                  <div className="text-[10px] text-amber-400 bg-amber-950/50 border border-amber-800/80 px-2 py-1 rounded flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Boot Mode Pin: Requires 1kΩ pull-down to GND</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Bench Pinout Directory */}
        <div className="w-full lg:w-[480px] flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-hidden shadow-inner shrink-0">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">BENCH PINOUT DIRECTORY</span>
              <span className="text-slate-500 text-[10px]">
                ({filteredPins.length} Pins Tracked)
              </span>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[10px] text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="power">Power Supplies (+12V / 5V)</option>
              <option value="ground">Grounds (Chassis / Sensor Return)</option>
              <option value="communication">CAN & Diagnostic Comms</option>
              <option value="sensor_in">Analog Sensor Inputs</option>
              <option value="actuator_out">Actuators & Injector Drivers</option>
              <option value="boot">Boot Mode Recovery</option>
            </select>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-cyan-400 font-bold text-[10px]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                MINIMUM BENCH FLASH & TEST WIRING ({activeBrand.brandName}):
              </span>
              <span className="text-slate-400 font-normal">
                {activeBrand.essentialChecklist.length} Essential Wires
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
              {activeBrand.essentialChecklist.map((item, idx) => (
                <div key={idx}>
                  • <strong>{item.pin}</strong>: {item.role}
                </div>
              ))}
            </div>
            {activeBrand.description && (
              <p className="text-[10px] text-slate-400 font-sans border-t border-slate-800/80 pt-1.5 mt-0.5 leading-snug">
                {activeBrand.description}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 max-h-[440px] lg:max-h-none">
            {filteredPins.map((pin) => {
              const isSelected =
                activePinDetail.pinNumber === pin.pinNumber &&
                activePinDetail.plug === pin.plug;
              const isRedProbe =
                !!pin.associatedSimPinId &&
                multimeter.redProbe.attachedToPinId === pin.associatedSimPinId;
              const isBlackProbe =
                !!pin.associatedSimPinId &&
                multimeter.blackProbe.attachedToPinId === pin.associatedSimPinId;

              return (
                <PinDirectoryRow
                  key={`${pin.plug}-${pin.pinNumber}`}
                  pin={pin}
                  isSelected={isSelected}
                  isRedProbe={isRedProbe}
                  isBlackProbe={isBlackProbe}
                  nodeVoltages={nodeVoltages}
                  onSelect={handleSelectPinRow}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
