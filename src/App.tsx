import React, { useEffect, useState } from 'react';
import {
  DEFAULT_ECU_PINS,
  DEFAULT_BENCH_COMPONENTS,
  DEFAULT_WIRES,
  solveCircuit,
} from './utils/circuitSolver';
import {
  EcuPin,
  BenchComponent,
  WireConnection,
  InjectedFault,
  FaultType,
  MultimeterState,
  PowerSupplyState,
} from './types/ecu';
import { BenchPowerSupply } from './components/BenchPowerSupply';
import { DigitalMultimeter } from './components/DigitalMultimeter';
import { FaultInjector } from './components/FaultInjector';
import { WiringCanvas } from './components/WiringCanvas';
import { Oscilloscope } from './components/Oscilloscope';
import { SchematicPcbScanner } from './components/SchematicPcbScanner';
import { EcuConnectorPinouts } from './components/EcuConnectorPinouts';
import { IntroductionModal } from './components/IntroductionModal';
import { EcuRepairKnowledgeBase } from './components/EcuRepairKnowledgeBase';
import { GroundedSearchModal } from './components/GroundedSearchModal';
import { BenchCloudModal } from './components/BenchCloudModal';
import { OfflineAssistantModal } from './components/OfflineAssistantModal';
import { DiagnosticGuidePanel } from './components/DiagnosticGuidePanel';
import {
  SavedBenchSession,
  SavedDiagnosticLog,
  subscribeBenchSessions,
  subscribeDiagnosticLogs,
} from './services/benchStorageService';
import { useAuth } from './context/AuthContext';
import {
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Globe,
  Save,
  Bot,
  PanelRightOpen,
} from 'lucide-react';

type LabTab = 'BENCH_LAB' | 'WIRING_DIAGRAM' | 'ECU_PINOUT' | 'OSCILLOSCOPE' | 'PCB_SCANNER' | 'REPAIR_GUIDE';
type RackFilter = 'ALL' | 'DMM_POWER' | 'FAULT_MATRIX';

export default function App() {
  const { user, authReady } = useAuth();

  // Introduction View Modal (opens automatically on initial app launch)
  const [showIntroModal, setShowIntroModal] = useState(true);

  // Saved Bench & Diagnostic Logs Modal
  const [showCloudModal, setShowCloudModal] = useState(false);

  // 100% Offline MiniSearch Diagnostic Chatbot Modal
  const [showOfflineBot, setShowOfflineBot] = useState(false);
  const [offlineBotPrompt, setOfflineBotPrompt] = useState<string | null>(null);
  const [showDiagnosticGuide, setShowDiagnosticGuide] = useState(true);
  const [savedLogs, setSavedLogs] = useState<SavedDiagnosticLog[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedBenchSession[]>([]);

  const handleOpenOfflineBot = (prompt?: string) => {
    setOfflineBotPrompt(prompt || null);
    setShowOfflineBot(true);
  };

  useEffect(() => {
    if (!authReady || !user) {
      setSavedLogs([]);
      setSavedSessions([]);
      return;
    }

    const unsubLogs = subscribeDiagnosticLogs(
      user.uid,
      (logs) => setSavedLogs(logs),
      () => {}
    );
    const unsubSessions = subscribeBenchSessions(
      user.uid,
      (sessions) => setSavedSessions(sessions),
      () => {}
    );

    return () => {
      unsubLogs();
      unsubSessions();
    };
  }, [authReady, user]);

  // Live Google Search Grounding Modal State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [groundedSearchQuery, setGroundedSearchQuery] = useState('');
  const [groundedSearchDtc, setGroundedSearchDtc] = useState('');
  const [groundedSearchEcu, setGroundedSearchEcu] = useState('');

  const handleOpenGroundedSearch = (query?: string, dtc?: string, ecu?: string) => {
    setGroundedSearchQuery(query || '');
    setGroundedSearchDtc(dtc || '');
    setGroundedSearchEcu(ecu || '');
    setShowSearchModal(true);
  };

  // Navigation
  const [activeTab, setActiveTab] = useState<LabTab>('BENCH_LAB');
  const [rackFilter, setRackFilter] = useState<RackFilter>('ALL');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1.0);

  // Core Bench State
  const [powerSupply, setPowerSupply] = useState<PowerSupplyState>({
    voltageSetting: 12.6,
    currentLimit: 5.0,
    isOutputEnabled: true,
    preset: '12V_BENCH',
  });

  const [pins, setPins] = useState<EcuPin[]>(DEFAULT_ECU_PINS);
  const [components, setComponents] = useState<BenchComponent[]>(DEFAULT_BENCH_COMPONENTS);
  const [wires, setWires] = useState<WireConnection[]>(DEFAULT_WIRES);
  const [faults, setFaults] = useState<InjectedFault[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>('ecu-pin-7'); // TPS_SIG default

  // Multimeter State
  const [multimeter, setMultimeter] = useState<MultimeterState>({
    mode: 'V_DC',
    redProbe: { attachedToPinId: 'ecu-pin-7', attachedLabel: 'TPS_SIG (Pin 7)' },
    blackProbe: { attachedToPinId: 'chassis-gnd', attachedLabel: 'Chassis GND (KL31)' },
    isPowered: true,
    rangeAuto: true,
    holdValue: false,
  });

  // Calculate live circuit solution based on all physical parameters
  const circuitSolution = solveCircuit(
    powerSupply,
    pins,
    faults,
    wires,
    components,
    multimeter
  );

  // Fault management handlers
  const handleAddFault = (pinId: string, faultType: FaultType, description: string) => {
    setFaults(prev => {
      const filtered = prev.filter(f => f.pinId !== pinId);
      return [...filtered, { pinId, faultType, description, timestamp: Date.now() }];
    });
  };

  const handleRemoveFault = (pinId: string) => {
    setFaults(prev => prev.filter(f => f.pinId !== pinId));
  };

  const handleClearAllFaults = () => {
    setFaults([]);
  };

  // Wire management
  const handleAddWire = (sourcePinId: string, targetPinId: string) => {
    const exists = wires.some(
      w =>
        (w.sourcePinId === sourcePinId && w.targetPinId === targetPinId) ||
        (w.sourcePinId === targetPinId && w.targetPinId === sourcePinId)
    );
    if (exists) return;

    const newWire: WireConnection = {
      id: `wire-${Date.now()}`,
      sourcePinId,
      targetPinId,
      color: '#06b6d4',
      label: 'Auxiliary Harness Lead',
      isCut: false,
      resistance: 0.05,
    };
    setWires(prev => [...prev, newWire]);
  };

  const handleToggleCutWire = (wireId: string) => {
    setWires(prev =>
      prev.map(w => (w.id === wireId ? { ...w, isCut: !w.isCut } : w))
    );
  };

  const handleDeleteWire = (wireId: string) => {
    setWires(prev => prev.filter(w => w.id !== wireId));
  };

  const handleUpdateComponentState = (compId: string, updates: Record<string, number | boolean | string>) => {
    setComponents(prev =>
      prev.map(c => (c.id === compId ? { ...c, state: { ...c.state, ...updates } } : c))
    );
  };

  // Reset entire laboratory to pristine factory state
  const handleResetLab = () => {
    setPowerSupply({
      voltageSetting: 12.6,
      currentLimit: 5.0,
      isOutputEnabled: true,
      preset: '12V_BENCH',
    });
    setPins(DEFAULT_ECU_PINS);
    setComponents(DEFAULT_BENCH_COMPONENTS);
    setWires(DEFAULT_WIRES);
    setFaults([]);
    setSelectedPinId('ecu-pin-7');
    setMultimeter({
      mode: 'V_DC',
      redProbe: { attachedToPinId: 'ecu-pin-7', attachedLabel: 'TPS_SIG (Pin 7)' },
      blackProbe: { attachedToPinId: 'chassis-gnd', attachedLabel: 'Chassis GND (KL31)' },
      isPowered: true,
      rangeAuto: true,
      holdValue: false,
    });
  };

  // Restore saved bench session into live MNA state
  const handleLoadBenchSession = (session: SavedBenchSession) => {
    if (session.powerSupply) {
      setPowerSupply(session.powerSupply);
    }
    if (Array.isArray(session.wires)) {
      setWires(session.wires);
    }
    if (Array.isArray(session.faults)) {
      setFaults(
        session.faults.map((f) => ({
          pinId: f.pinId,
          faultType: f.faultType as FaultType,
          description: f.description,
          timestamp: f.timestamp,
        }))
      );
    }
    if (session.componentStates) {
      setComponents((prev) =>
        prev.map((c) =>
          session.componentStates[c.id]
            ? { ...c, state: { ...c.state, ...session.componentStates[c.id] } }
            : c
        )
      );
    }
  };

  const hasCanFault = faults.some(f => f.pinId === 'ecu-pin-13' || f.pinId === 'ecu-pin-14');
  const hasInjectorFault = faults.some(f => f.pinId === 'ecu-pin-10');

  // Selected Pin details
  const selectedPin = pins.find(p => p.id === selectedPinId);

  return (
    <div className="flex flex-col h-screen hud-shell text-slate-100 font-body select-none overflow-hidden">
      {/* 1. Streamlined 3-Zone Top Navigation Bar */}
      <header className="h-13 hud-header px-3 sm:px-5 flex items-center justify-between gap-4 sm:gap-6 text-xs shrink-0 overflow-x-auto scrollbar-none">
        {/* Zone 1: Single-Line Brand Wordmark & Emblem */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img
            src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
            alt="AutoElectric Lab Pro"
            className="h-7 sm:h-8 w-auto object-contain rounded-md border border-cyan-500/40"
          />
          <span className="font-hud font-bold tracking-wide text-sm sm:text-base whitespace-nowrap shrink-0">
            <span className="brand-wordmark-silver">AutoElectric Lab</span>{' '}
            <span className="brand-wordmark-amber">Pro</span>
          </span>
        </div>

        {/* Zone 2: 6 Unified Navigation Tabs */}
        <nav className="flex items-center gap-1 hud-well p-1 rounded-lg overflow-x-auto scrollbar-none shrink-0 max-w-full">
          <button
            onClick={() => setActiveTab('BENCH_LAB')}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-hud font-bold tracking-wide uppercase rounded-md whitespace-nowrap shrink-0 transition ${
              activeTab === 'BENCH_LAB'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            Bench Lab
          </button>
          <button
            onClick={() => setActiveTab('WIRING_DIAGRAM')}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-hud font-bold tracking-wide uppercase rounded-md whitespace-nowrap shrink-0 transition ${
              activeTab === 'WIRING_DIAGRAM'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            Harness Wiring
          </button>
          <button
            onClick={() => setActiveTab('ECU_PINOUT')}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-hud font-bold tracking-wide uppercase rounded-md whitespace-nowrap shrink-0 transition ${
              activeTab === 'ECU_PINOUT'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            ECU Pinouts
          </button>
          <button
            onClick={() => setActiveTab('OSCILLOSCOPE')}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-hud font-bold tracking-wide uppercase rounded-md whitespace-nowrap shrink-0 transition ${
              activeTab === 'OSCILLOSCOPE'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            Oscilloscope
          </button>
          <button
            onClick={() => setActiveTab('PCB_SCANNER')}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-hud font-bold tracking-wide uppercase rounded-md whitespace-nowrap shrink-0 transition ${
              activeTab === 'PCB_SCANNER'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            PCB Scanner
          </button>
          <button
            onClick={() => setActiveTab('REPAIR_GUIDE')}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-hud font-bold tracking-wide uppercase rounded-md whitespace-nowrap shrink-0 transition flex items-center gap-1 ${
              activeTab === 'REPAIR_GUIDE'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Repair Manuals</span>
          </button>
        </nav>

        {/* Zone 3: Live Telemetry & Utility Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 font-mono">
          <div className="hidden 2xl:flex items-center gap-2 text-[11px] text-slate-400 mr-1">
            <span>DRAW:</span>
            <span className="text-amber-400 font-bold tabular-nums">
              {circuitSolution.supplyCurrentDrawAmps.toFixed(2)} A
            </span>
            <span className="text-slate-700">·</span>
            {circuitSolution.activeDTCs.length > 0 ? (
              <span className="text-rose-400 font-bold flex items-center gap-1 whitespace-nowrap">
                <AlertTriangle className="w-3.5 h-3.5" /> {circuitSolution.activeDTCs.length} FAULT
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5" /> NOMINAL
              </span>
            )}
          </div>

          {/* Global Simulation Speed Control */}
          <div className="flex items-center gap-1.5 hud-well px-2 py-1 rounded-lg text-xs shrink-0">
            <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap hidden xl:inline">SPEED:</span>
            <select
              aria-label="Simulation Speed"
              value={simulationSpeed}
              onChange={e => setSimulationSpeed(parseFloat(e.target.value))}
              className="bg-transparent text-cyan-300 font-bold rounded px-1 py-0.5 text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="0.25" className="bg-slate-950">0.25x Slow-Mo</option>
              <option value="0.5" className="bg-slate-950">0.5x Slow</option>
              <option value="1.0" className="bg-slate-950">1.0x Realtime</option>
              <option value="2.0" className="bg-slate-950">2.0x Fast</option>
              <option value="4.0" className="bg-slate-950">4.0x Turbo</option>
            </select>
          </div>

          <button
            onClick={() => setShowCloudModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 rounded-lg transition whitespace-nowrap shrink-0"
            title="Save or Load Bench Workspaces & Diagnostic Logs"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">{user ? 'Saved Benches' : 'Save Bench'}</span>
          </button>

          <button
            onClick={() => handleOpenOfflineBot()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/50 rounded-lg transition whitespace-nowrap shrink-0"
            title="100% Offline Diagnostic Assistant (MiniSearch Local Engine)"
          >
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Offline Bot</span>
          </button>

          <button
            onClick={() => handleOpenGroundedSearch()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition whitespace-nowrap shrink-0"
            title="Search Live OEM Bulletins, TSBs & Pinouts with Google Search Grounding"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Google Grounding</span>
          </button>

          <button
            onClick={() => setShowIntroModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-300 bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 rounded-lg transition whitespace-nowrap shrink-0"
            title="View Instructions & Executive Credentials"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xl:inline">Guide & Credits</span>
          </button>

          <button
            onClick={handleResetLab}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition whitespace-nowrap shrink-0"
            title="Reset Bench to Factory Setup"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 overflow-y-auto md:overflow-hidden p-2 sm:p-3 flex gap-2.5 sm:gap-3">
        {/* TAB 1: BENCH LAB */}
        {activeTab === 'BENCH_LAB' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-2.5 sm:gap-3 overflow-y-auto lg:overflow-hidden min-h-0">
            {/* Left Instrument Column with Ergonomic Filter Tabs */}
            <div className="w-full lg:w-[370px] xl:w-[385px] flex flex-col gap-2.5 shrink-0 overflow-y-auto lg:overflow-hidden max-h-[50vh] lg:max-h-none">
              {/* Rack View Filter Tabs */}
              <div className="flex items-center gap-1 hud-panel p-1 rounded-lg text-[11px] font-mono shrink-0">
                <button
                  onClick={() => setRackFilter('ALL')}
                  className={`flex-1 py-1 rounded text-center transition whitespace-nowrap ${
                    rackFilter === 'ALL' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Rack
                </button>
                <button
                  onClick={() => setRackFilter('DMM_POWER')}
                  className={`flex-1 py-1 rounded text-center transition ${
                    rackFilter === 'DMM_POWER' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  DMM & Power
                </button>
                <button
                  onClick={() => setRackFilter('FAULT_MATRIX')}
                  className={`flex-1 py-1 rounded text-center transition ${
                    rackFilter === 'FAULT_MATRIX' ? 'bg-slate-800 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fault Matrix
                </button>
              </div>

              {/* Scrollable Instruments Area */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                {(rackFilter === 'ALL' || rackFilter === 'DMM_POWER') && (
                  <>
                    <BenchPowerSupply
                      powerSupply={powerSupply}
                      onChange={setPowerSupply}
                      actualCurrentAmps={circuitSolution.supplyCurrentDrawAmps}
                      isTripped={circuitSolution.isSupplyCurrentTripped}
                    />

                    <DigitalMultimeter
                      multimeter={multimeter}
                      onChange={setMultimeter}
                      reading={circuitSolution.multimeterReading}
                      pins={pins}
                      components={components}
                      selectedPinId={selectedPinId}
                    />
                  </>
                )}

                {(rackFilter === 'ALL' || rackFilter === 'FAULT_MATRIX') && (
                  <FaultInjector
                    pins={pins}
                    faults={faults}
                    activeDTCs={circuitSolution.activeDTCs}
                    onAddFault={handleAddFault}
                    onRemoveFault={handleRemoveFault}
                    onClearAll={handleClearAllFaults}
                    selectedPinId={selectedPinId}
                    onSelectPin={setSelectedPinId}
                    onSearchDtc={(code, desc) =>
                      handleOpenGroundedSearch(
                        `${code} ${desc} OEM diagnostic procedure technical service bulletin`,
                        code,
                        'Universal Bench'
                      )
                    }
                  />
                )}
              </div>
            </div>

            {/* Center: Live Interactive Wiring Canvas */}
            <WiringCanvas
              pins={pins}
              wires={wires}
              components={components}
              nodeVoltages={circuitSolution.nodeVoltages}
              selectedPinId={selectedPinId}
              onSelectPin={setSelectedPinId}
              onAddWire={handleAddWire}
              onToggleCutWire={handleToggleCutWire}
              onDeleteWire={handleDeleteWire}
              multimeter={multimeter}
              onAttachProbe={(color, pinId, label) => {
                if (color === 'red') {
                  setMultimeter(prev => ({ ...prev, redProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                } else {
                  setMultimeter(prev => ({ ...prev, blackProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                }
              }}
              onUpdateComponentState={handleUpdateComponentState}
              isPowerOn={powerSupply.isOutputEnabled}
              onOpenEcuPinouts={() => setActiveTab('ECU_PINOUT')}
              simulationSpeed={simulationSpeed}
            />

            {/* Right: Collapsible 5-Step MNA-Synced Diagnostic Guide */}
            <DiagnosticGuidePanel
              isOpen={showDiagnosticGuide}
              onClose={() => setShowDiagnosticGuide(false)}
              powerSupply={powerSupply}
              pins={pins}
              wires={wires}
              faults={faults}
              activeDTCs={circuitSolution.activeDTCs}
              nodeVoltages={circuitSolution.nodeVoltages}
              supplyCurrentDrawAmps={circuitSolution.supplyCurrentDrawAmps}
              isSupplyCurrentTripped={circuitSolution.isSupplyCurrentTripped}
              multimeter={multimeter}
              multimeterReading={circuitSolution.multimeterReading}
              selectedPinId={selectedPinId}
              onSelectPin={setSelectedPinId}
              onNavigateTab={setActiveTab}
              onOpenOfflineBot={handleOpenOfflineBot}
            />
          </div>
        )}

        {/* TAB 2: WIRING DIAGRAM (Expanded Full-Screen Harness Engine) */}
        {activeTab === 'WIRING_DIAGRAM' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <WiringCanvas
              pins={pins}
              wires={wires}
              components={components}
              nodeVoltages={circuitSolution.nodeVoltages}
              selectedPinId={selectedPinId}
              onSelectPin={setSelectedPinId}
              onAddWire={handleAddWire}
              onToggleCutWire={handleToggleCutWire}
              onDeleteWire={handleDeleteWire}
              multimeter={multimeter}
              onAttachProbe={(color, pinId, label) => {
                if (color === 'red') {
                  setMultimeter(prev => ({ ...prev, redProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                } else {
                  setMultimeter(prev => ({ ...prev, blackProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                }
              }}
              onUpdateComponentState={handleUpdateComponentState}
              isPowerOn={powerSupply.isOutputEnabled}
              onOpenEcuPinouts={() => setActiveTab('ECU_PINOUT')}
              simulationSpeed={simulationSpeed}
            />
          </div>
        )}

        {/* TAB 3: ECU CONNECTOR & BENCH TEST PINOUTS */}
        {activeTab === 'ECU_PINOUT' && (
          <div className="flex-1 flex overflow-hidden">
            <EcuConnectorPinouts
              pins={pins}
              nodeVoltages={circuitSolution.nodeVoltages}
              selectedPinId={selectedPinId}
              onSelectPin={setSelectedPinId}
              multimeter={multimeter}
              onAttachProbe={(color, pinId, label) => {
                if (color === 'red') {
                  setMultimeter(prev => ({ ...prev, redProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                } else {
                  setMultimeter(prev => ({ ...prev, blackProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                }
              }}
              powerSupply={powerSupply}
              onSearchLivePinout={(model) =>
                handleOpenGroundedSearch(
                  `${model} ECU bench pinout wiring diagram KL30 KL15 KL31 K-Line CAN`,
                  '',
                  model
                )
              }
            />
          </div>
        )}

        {/* TAB 4: OSCILLOSCOPE */}
        {activeTab === 'OSCILLOSCOPE' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <Oscilloscope
              isPowerOn={powerSupply.isOutputEnabled}
              selectedSignal={hasCanFault ? 'CAN_BUS' : 'INJECTOR_PWM'}
              hasCanFault={hasCanFault}
              hasInjectorFault={hasInjectorFault}
              simulationSpeed={simulationSpeed}
            />
            {/* Split with Wiring Canvas for rapid testing */}
            <div className="flex-1 min-h-[360px] overflow-hidden">
              <WiringCanvas
                pins={pins}
                wires={wires}
                components={components}
                nodeVoltages={circuitSolution.nodeVoltages}
                selectedPinId={selectedPinId}
                onSelectPin={setSelectedPinId}
                onAddWire={handleAddWire}
                onToggleCutWire={handleToggleCutWire}
                onDeleteWire={handleDeleteWire}
                multimeter={multimeter}
                onAttachProbe={(color, pinId, label) => {
                  if (color === 'red') {
                    setMultimeter(prev => ({ ...prev, redProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                  } else {
                    setMultimeter(prev => ({ ...prev, blackProbe: { attachedToPinId: pinId, attachedLabel: label } }));
                  }
                }}
                onUpdateComponentState={handleUpdateComponentState}
                isPowerOn={powerSupply.isOutputEnabled}
                simulationSpeed={simulationSpeed}
              />
            </div>
          </div>
        )}

        {/* TAB 4: PCB & AI SCHEMATIC SCANNER */}
        {activeTab === 'PCB_SCANNER' && (
          <div className="flex-1 flex overflow-hidden">
            <SchematicPcbScanner />
          </div>
        )}

        {/* TAB 5: ECU REPAIR KNOWLEDGE BASE & MANUALS */}
        {activeTab === 'REPAIR_GUIDE' && (
          <div className="flex-1 flex overflow-hidden">
            <EcuRepairKnowledgeBase
              savedSessions={savedSessions}
              savedLogs={savedLogs}
              liveActiveDtcs={circuitSolution.activeDTCs}
              onOpenSavedBenches={() => setShowCloudModal(true)}
            />
          </div>
        )}
      </div>

      {/* 3. Functional Bottom Probe & Quick-Action Bar */}
      <footer className="min-h-10 hud-header border-t border-cyan-500/20 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono shrink-0 text-slate-400">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap truncate">
          <span className="truncate">
            TARGET:{' '}
            <strong className="text-cyan-300">
              {selectedPin ? `${selectedPin.label} (#${selectedPin.pinNumber})` : 'None'}
            </strong>
          </span>
          <span className="text-slate-700 hidden xs:inline">|</span>
          <span className="whitespace-nowrap tabular-nums">
            DMM:{' '}
            <strong className="text-amber-300 font-bold">
              {circuitSolution.multimeterReading.display} {circuitSolution.multimeterReading.unit}
            </strong>
          </span>
          <span className="text-slate-700 hidden md:inline">|</span>
          <span className="whitespace-nowrap hidden md:inline tabular-nums">
            HARNESS:{' '}
            <strong className="text-slate-200">
              {wires.filter(w => !w.isCut).length} Active / {wires.length} Wires
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'BENCH_LAB' && (
            <button
              onClick={() => setShowDiagnosticGuide(prev => !prev)}
              className={`text-[10px] flex items-center gap-1 px-2.5 py-1 rounded border transition whitespace-nowrap ${
                showDiagnosticGuide
                  ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle 5-Step MNA Diagnostic Guide"
            >
              <PanelRightOpen className="w-3 h-3 text-cyan-400" />
              <span>5-Step Guide</span>
            </button>
          )}
          <button
            onClick={() => {
              if (selectedPinId) {
                const label = selectedPin ? `${selectedPin.label} (${selectedPin.name})` : selectedPinId;
                setMultimeter(prev => ({
                  ...prev,
                  redProbe: { attachedToPinId: selectedPinId, attachedLabel: label },
                }));
              }
            }}
            className="text-[10px] text-rose-300 hover:text-white flex items-center gap-1 bg-rose-950/60 hover:bg-rose-900/60 px-2 py-1 rounded border border-rose-800/80 transition whitespace-nowrap"
          >
            Attach Red (+)
          </button>
          <button
            onClick={() => {
              setMultimeter(prev => ({
                ...prev,
                blackProbe: { attachedToPinId: 'chassis-gnd', attachedLabel: 'Chassis GND (KL31)' },
              }));
            }}
            className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-900 hover:bg-slate-800 px-2 py-1 rounded border border-slate-700 transition whitespace-nowrap"
          >
            Black COM (-)
          </button>
        </div>
      </footer>

      {/* Auto-Trigger Introduction & Executive Credentials View Modal */}
      <IntroductionModal
        isOpen={showIntroModal}
        onClose={() => setShowIntroModal(false)}
      />

      {/* Live Google Search Grounding Modal */}
      <GroundedSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        initialQuery={groundedSearchQuery}
        initialDtc={groundedSearchDtc}
        initialEcu={groundedSearchEcu}
      />

      {/* Saved Bench Workspaces & Diagnostic Case Logs Modal */}
      <BenchCloudModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        powerSupply={powerSupply}
        wires={wires}
        faults={faults}
        components={components}
        activeDTCs={circuitSolution.activeDTCs}
        supplyCurrentDrawAmps={circuitSolution.supplyCurrentDrawAmps}
        onLoadBenchSession={handleLoadBenchSession}
      />

      {/* 100% Offline Diagnostic Chatbot Modal */}
      <OfflineAssistantModal
        isOpen={showOfflineBot}
        onClose={() => setShowOfflineBot(false)}
        liveContext={{
          powerSupply,
          pins,
          wires,
          faults,
          activeDTCs: circuitSolution.activeDTCs,
          nodeVoltages: circuitSolution.nodeVoltages,
          supplyCurrentDrawAmps: circuitSolution.supplyCurrentDrawAmps,
          isSupplyCurrentTripped: circuitSolution.isSupplyCurrentTripped,
          multimeter,
          multimeterDisplay: circuitSolution.multimeterReading.display,
          multimeterUnit: circuitSolution.multimeterReading.unit,
          multimeterWarning: circuitSolution.multimeterReading.warningMessage,
          selectedPinId,
        }}
        savedLogs={savedLogs}
        savedSessions={savedSessions}
        initialPrompt={offlineBotPrompt}
        onClearInitialPrompt={() => setOfflineBotPrompt(null)}
        onNavigateTab={(tab, pinId) => {
          setActiveTab(tab);
          if (pinId) {
            setSelectedPinId(pinId);
          }
        }}
      />
    </div>
  );
}
