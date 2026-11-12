import React, { useState } from 'react';
import { analyzePcbImage } from '../services/pcbImageAnalysisService';
import { ImageAnalysisResult, ImageAnalysisComponent, ImageAnalysisNet } from '../server/services/imageAnalysisTypes';
import {
  Upload,
  Cpu,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FileCode,
  Download,
  Plus,
  Eye,
  EyeOff,
  Search,
  Trash2,
  Activity,
  Zap,
  ShieldCheck,
  Disc,
  Info,
  ExternalLink,
} from 'lucide-react';

export interface PcbPinSpec {
  pinNumber: number;
  pinName: string;
  category: 'power' | 'ground' | 'signal_in' | 'driver_out' | 'bus';
  nominalVoltage: number;
  connectedNetId: string;
  notes: string;
}

export interface DetailedPcbComponent extends ImageAnalysisComponent {
  operatingVoltageRange?: string;
  maxCurrentRating?: string;
  pinSpecs?: PcbPinSpec[];
  datasheetSummary?: string;
}

interface SampleBoard {
  id: string;
  name: string;
  type: string;
  summary: string;
  components: DetailedPcbComponent[];
  nets: ImageAnalysisNet[];
}

const SAMPLE_BOARDS: SampleBoard[] = [
  {
    id: 'sample-power-stage',
    name: 'ECU 5V Power Supply & Clamping Stage',
    type: 'Automotive ECU Power PCB',
    summary: 'Infineon TLE4275 5V Low-Dropout Regulator with reverse polarity Schottky protection & filter bulk caps.',
    components: [
      {
        refDes: 'U1',
        category: 'VOLTAGE_REGULATOR',
        marking: 'TLE4275G',
        decodedValue: '5.0V / 450mA LDO',
        packageType: 'TO-263-5',
        bbox: { ymin: 160, xmin: 240, ymax: 320, xmax: 420 },
        confidenceScore: 0.96,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Main ECU 5V Reference & Logic Power Rail Regulator',
        terminalIds: ['U1-VIN', 'U1-GND', 'U1-VOUT', 'U1-RESET', 'U1-DELAY'],
        notes: 'Matches Bosch ME7.5 main power supply topology. High thermal dissipation tab tied to GND pour.',
        operatingVoltageRange: '4.2V - 42V DC',
        maxCurrentRating: '450 mA',
        datasheetSummary: 'Low drop voltage (typ. 250mV at 300mA), reverse polarity proof (-42V), overtemperature protection.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'VIN', category: 'power', nominalVoltage: 12.6, connectedNetId: 'NET_KL30_VBAT', notes: 'Filtered +12V battery feed from D1' },
          { pinNumber: 2, pinName: 'DELAY', category: 'signal_in', nominalVoltage: 2.4, connectedNetId: 'NET_DELAY_CAP', notes: 'Reset delay timing capacitor connection' },
          { pinNumber: 3, pinName: 'GND', category: 'ground', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Main ground plane connection' },
          { pinNumber: 4, pinName: 'RESET', category: 'signal_in', nominalVoltage: 5.0, connectedNetId: 'NET_MCU_RESET', notes: 'Active-low microcontroller power reset' },
          { pinNumber: 5, pinName: 'VOUT', category: 'power', nominalVoltage: 5.0, connectedNetId: 'NET_5V_REGULATED', notes: '+5.00V regulated reference supply output rail' },
        ],
      },
      {
        refDes: 'D1',
        category: 'DIODE',
        marking: 'B540C',
        decodedValue: '40V / 5A Schottky',
        packageType: 'SMC',
        bbox: { ymin: 170, xmin: 80, ymax: 250, xmax: 180 },
        confidenceScore: 0.93,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Reverse Battery Polarity Protection',
        terminalIds: ['D1-A', 'D1-K'],
        operatingVoltageRange: '40V Reverse Repetitive Peak',
        maxCurrentRating: '5.0 A',
        datasheetSummary: 'High current capability, ultra-low forward voltage drop (0.55V at 5A).',
        pinSpecs: [
          { pinNumber: 1, pinName: 'ANODE (A)', category: 'power', nominalVoltage: 12.6, connectedNetId: 'NET_RAW_KL30', notes: 'Unprotected battery inlet' },
          { pinNumber: 2, pinName: 'CATHODE (K)', category: 'power', nominalVoltage: 12.05, connectedNetId: 'NET_KL30_VBAT', notes: 'Protected internal VBat bus' },
        ],
      },
      {
        refDes: 'C1',
        category: 'ELECTROLYTIC_CAP',
        marking: '470uF 35V',
        decodedValue: '470 µF / 35V',
        packageType: 'Radial SMD',
        bbox: { ymin: 280, xmin: 80, ymax: 390, xmax: 180 },
        confidenceScore: 0.89,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Input Battery Ripple Filter',
        terminalIds: ['C1-POS', 'C1-NEG'],
        operatingVoltageRange: '35V DC Max',
        maxCurrentRating: '1.2A Ripple Current',
        datasheetSummary: 'Low ESR automotive grade electrolytic capacitor for dampening alternator ripple.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'POS (+)', category: 'power', nominalVoltage: 12.05, connectedNetId: 'NET_KL30_VBAT', notes: '+12V VBat smoothing node' },
          { pinNumber: 2, pinName: 'NEG (-)', category: 'ground', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Chassis ground return' },
        ],
      },
      {
        refDes: 'C2',
        category: 'CAPACITOR',
        marking: '22uF',
        decodedValue: '22 µF Tantalum',
        packageType: 'EIA 7343',
        bbox: { ymin: 180, xmin: 470, ymax: 250, xmax: 560 },
        confidenceScore: 0.88,
        verificationStatus: 'UNVERIFIED',
        circuitFunction: '5V Output Stability Filter',
        terminalIds: ['C2-POS', 'C2-NEG'],
        operatingVoltageRange: '10V DC',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'Ensures LDO control loop phase margin and suppresses high-frequency digital noise.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'POS (+)', category: 'power', nominalVoltage: 5.0, connectedNetId: 'NET_5V_REGULATED', notes: '+5V VREF bus smoothing' },
          { pinNumber: 2, pinName: 'NEG (-)', category: 'ground', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Ground plane' },
        ],
      },
      {
        refDes: 'TVS1',
        category: 'TVS_DIODE',
        marking: 'SMBJ24CA',
        decodedValue: '24V Bidirectional TVS',
        packageType: 'SMB',
        bbox: { ymin: 300, xmin: 470, ymax: 370, xmax: 560 },
        confidenceScore: 0.91,
        verificationStatus: 'UNVERIFIED',
        circuitFunction: 'Load Dump ISO 7637-2 Transient Suppression',
        terminalIds: ['TVS-1', 'TVS-2'],
        operatingVoltageRange: '24V Breakdown / 38.9V Clamp',
        maxCurrentRating: '600W Peak Pulse Power',
        datasheetSummary: 'Clamps inductive load dump spikes (ignition coils/starter motor collapse).',
        pinSpecs: [
          { pinNumber: 1, pinName: 'TERM 1', category: 'power', nominalVoltage: 12.05, connectedNetId: 'NET_KL30_VBAT', notes: '+12V VBat bus clamping' },
          { pinNumber: 2, pinName: 'TERM 2', category: 'ground', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Heavy ground dump path' },
        ],
      },
    ],
    nets: [
      {
        name: 'NET_KL30_VBAT',
        signalType: 'BATTERY_POWER',
        connectedComponentRefs: ['D1', 'C1', 'U1', 'TVS1'],
        connectedTerminalIds: ['D1-K', 'C1-POS', 'U1-VIN', 'TVS-1'],
        tracePoints: [
          { x: 180, y: 210 },
          { x: 240, y: 210 },
          { x: 240, y: 190 },
          { x: 130, y: 210 },
          { x: 130, y: 280 },
        ],
        confidenceScore: 0.94,
        verificationStatus: 'VERIFIED',
        isComplete: true,
      },
      {
        name: 'NET_5V_REGULATED',
        signalType: '5V_LOGIC',
        connectedComponentRefs: ['U1', 'C2'],
        connectedTerminalIds: ['U1-VOUT', 'C2-POS'],
        tracePoints: [
          { x: 420, y: 290 },
          { x: 470, y: 290 },
          { x: 470, y: 215 },
        ],
        confidenceScore: 0.92,
        verificationStatus: 'VERIFIED',
        isComplete: true,
      },
      {
        name: 'NET_CHASSIS_GND',
        signalType: 'GROUND',
        connectedComponentRefs: ['U1', 'C1', 'C2', 'TVS1'],
        connectedTerminalIds: ['U1-GND', 'C1-NEG', 'C2-NEG', 'TVS-2'],
        tracePoints: [
          { x: 130, y: 390 },
          { x: 330, y: 320 },
          { x: 515, y: 250 },
          { x: 515, y: 370 },
        ],
        confidenceScore: 0.96,
        verificationStatus: 'VERIFIED',
        isComplete: true,
      },
    ],
  },
  {
    id: 'sample-can-stage',
    name: 'High-Speed CAN Transceiver Stage',
    type: 'CAN Bus Interface PCB',
    summary: 'NXP TJA1050 automotive transceiver with split termination and common-mode choke filter.',
    components: [
      {
        refDes: 'U2',
        category: 'CAN_TRANSCEIVER',
        marking: 'TJA1050',
        decodedValue: 'High-Speed CAN 1 Mbps',
        packageType: 'SOIC-8',
        bbox: { ymin: 190, xmin: 240, ymax: 330, xmax: 380 },
        confidenceScore: 0.97,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Physical CAN Bus Differential Interface Transceiver',
        terminalIds: ['U2-TXD', 'U2-GND', 'U2-VCC', 'U2-RXD', 'U2-VREF', 'U2-CANL', 'U2-CANH', 'U2-S'],
        operatingVoltageRange: '4.75V - 5.25V DC',
        maxCurrentRating: '70 mA',
        datasheetSummary: 'Fully ISO 11898 compliant, low EME, high ESD robustness (> 6kV), split output pin VREF.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'TXD', category: 'signal_in', nominalVoltage: 3.3, connectedNetId: 'NET_MCU_TX', notes: 'Transmit data input from ECU Microcontroller' },
          { pinNumber: 2, pinName: 'GND', category: 'ground', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Transceiver ground' },
          { pinNumber: 3, pinName: 'VCC', category: 'power', nominalVoltage: 5.0, connectedNetId: 'NET_5V_REGULATED', notes: '+5V supply rail' },
          { pinNumber: 4, pinName: 'RXD', category: 'signal_in', nominalVoltage: 3.3, connectedNetId: 'NET_MCU_RX', notes: 'Receive data output to ECU Microcontroller' },
          { pinNumber: 5, pinName: 'VREF', category: 'power', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_SPLIT', notes: '2.5V mid-supply reference for split termination' },
          { pinNumber: 6, pinName: 'CANL', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_LOW', notes: 'Low-speed differential bus terminal (1.5V dominant)' },
          { pinNumber: 7, pinName: 'CANH', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_HIGH', notes: 'High-speed differential bus terminal (3.5V dominant)' },
          { pinNumber: 8, pinName: 'S', category: 'signal_in', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Silent mode control pin (GND for high-speed operation)' },
        ],
      },
      {
        refDes: 'R1',
        category: 'RESISTOR',
        marking: '60R0',
        decodedValue: '60.4 Ω 1%',
        packageType: '0805',
        bbox: { ymin: 170, xmin: 440, ymax: 220, xmax: 510 },
        confidenceScore: 0.93,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Split Termination Upper Arm (60.4Ω to CAN-H)',
        terminalIds: ['R1-1', 'R1-2'],
        operatingVoltageRange: '0.125W Rating',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'High precision 1% metal film resistor for matching differential bus impedance.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'TERM 1', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_HIGH', notes: 'Connected to CAN-H bus line' },
          { pinNumber: 2, pinName: 'TERM 2', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_SPLIT', notes: 'Connected to central split termination node' },
        ],
      },
      {
        refDes: 'R2',
        category: 'RESISTOR',
        marking: '60R0',
        decodedValue: '60.4 Ω 1%',
        packageType: '0805',
        bbox: { ymin: 290, xmin: 440, ymax: 340, xmax: 510 },
        confidenceScore: 0.93,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Split Termination Lower Arm (60.4Ω to CAN-L)',
        terminalIds: ['R2-1', 'R2-2'],
        operatingVoltageRange: '0.125W Rating',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'High precision 1% metal film resistor for matching differential bus impedance.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'TERM 1', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_LOW', notes: 'Connected to CAN-L bus line' },
          { pinNumber: 2, pinName: 'TERM 2', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_SPLIT', notes: 'Connected to central split termination node' },
        ],
      },
      {
        refDes: 'C3',
        category: 'CAPACITOR',
        marking: '4n7',
        decodedValue: '4.7 nF MLCC',
        packageType: '0603',
        bbox: { ymin: 230, xmin: 550, ymax: 280, xmax: 600 },
        confidenceScore: 0.88,
        verificationStatus: 'UNVERIFIED',
        circuitFunction: 'Split Termination Common-Mode RF Ground Capacitor',
        terminalIds: ['C3-1', 'C3-2'],
        operatingVoltageRange: '50V DC',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'Bypasses common-mode high-frequency noise from split termination node to ground.',
        pinSpecs: [
          { pinNumber: 1, pinName: 'POS', category: 'bus', nominalVoltage: 2.5, connectedNetId: 'NET_CAN_SPLIT', notes: 'Central 60Ω split node' },
          { pinNumber: 2, pinName: 'NEG', category: 'ground', nominalVoltage: 0.0, connectedNetId: 'NET_CHASSIS_GND', notes: 'Chassis ground' },
        ],
      },
    ],
    nets: [
      {
        name: 'NET_CAN_HIGH',
        signalType: 'CAN_DIFFERENTIAL',
        connectedComponentRefs: ['U2', 'R1'],
        connectedTerminalIds: ['U2-CANH', 'R1-1'],
        tracePoints: [
          { x: 380, y: 220 },
          { x: 440, y: 195 },
        ],
        confidenceScore: 0.96,
        verificationStatus: 'VERIFIED',
        isComplete: true,
      },
      {
        name: 'NET_CAN_LOW',
        signalType: 'CAN_DIFFERENTIAL',
        connectedComponentRefs: ['U2', 'R2'],
        connectedTerminalIds: ['U2-CANL', 'R2-1'],
        tracePoints: [
          { x: 380, y: 280 },
          { x: 440, y: 315 },
        ],
        confidenceScore: 0.96,
        verificationStatus: 'VERIFIED',
        isComplete: true,
      },
      {
        name: 'NET_CAN_SPLIT',
        signalType: 'CAN_DIFFERENTIAL',
        connectedComponentRefs: ['U2', 'R1', 'R2', 'C3'],
        connectedTerminalIds: ['U2-VREF', 'R1-2', 'R2-2', 'C3-1'],
        tracePoints: [
          { x: 510, y: 195 },
          { x: 510, y: 315 },
          { x: 550, y: 255 },
        ],
        confidenceScore: 0.91,
        verificationStatus: 'UNVERIFIED',
        isComplete: true,
      },
    ],
  },
];

export const SchematicPcbScanner: React.FC = () => {
  const [selectedBoard, setSelectedBoard] = useState<SampleBoard>(SAMPLE_BOARDS[0]);
  const [components, setComponents] = useState<DetailedPcbComponent[]>(SAMPLE_BOARDS[0].components);
  const [nets, setNets] = useState<ImageAnalysisNet[]>(SAMPLE_BOARDS[0].nets);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('AI & VISION ENGINE ONLINE · Click any trace or part to inspect');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [selectedCompRef, setSelectedCompRef] = useState<string | null>('U1');
  const [activeNetId, setActiveNetId] = useState<string | null>('NET_5V_REGULATED');
  const [selectedPinNumber, setSelectedPinNumber] = useState<number | null>(5); // Default U1-VOUT Pin 5
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [mobileTab, setMobileTab] = useState<'CANVAS' | 'DRAWER'>('CANVAS');

  // Layer Visibility
  const [showComponents, setShowComponents] = useState(true);
  const [showNets, setShowNets] = useState(true);
  const [showPinMarkers, setShowPinMarkers] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Load sample board
  const loadSample = (board: SampleBoard) => {
    setSelectedBoard(board);
    setComponents(board.components);
    setNets(board.nets);
    setUploadedImageUrl(null);
    setSelectedCompRef(board.components[0]?.refDes || null);
    setActiveNetId(board.nets[0]?.name || null);
    setStatusMessage(`Loaded preset: ${board.name}`);
  };

  // Upload handler
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('File size exceeds 8 MB payload limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target?.result as string;
      setUploadedImageUrl(dataUrl);

      const imageBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      setIsAnalyzing(true);
      setStatusMessage('AI ANALYSIS RUNNING: Neural vision component & copper track extraction...');

      try {
        const analysis: ImageAnalysisResult = await analyzePcbImage({
          imageBase64,
          documentName: file.name,
          documentType: 'pcb',
        });

        if (analysis.components && analysis.components.length > 0) {
          const normalizedComps: DetailedPcbComponent[] = analysis.components.map(c => ({
            ...c,
            verificationStatus: 'UNVERIFIED' as const,
            pinSpecs: c.terminalIds?.map((t, idx) => ({
              pinNumber: idx + 1,
              pinName: t,
              category: 'signal_in' as const,
              nominalVoltage: 5.0,
              connectedNetId: 'NET_AUTO_DETECTED',
              notes: 'Extracted by AI computer vision model.',
            })),
          }));
          setComponents(normalizedComps);
          setNets(analysis.nets || []);
          setSelectedCompRef(normalizedComps[0]?.refDes || null);
          setStatusMessage(
            `AI MAPPING COMPLETE: ${normalizedComps.length} components detected (${(analysis.confidenceScore * 100).toFixed(0)}% confidence). Technician sign-off required.`
          );
        } else {
          setStatusMessage('MANUAL REVIEW MODE: Image loaded. No confident components identified by AI.');
        }
      } catch (err) {
        console.warn('AI analysis fallback to manual:', err);
        setStatusMessage('AI ANALYSIS UNAVAILABLE: Provider offline. Manual review mode active.');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add Manual Component Observation
  const handleAddManualComponent = () => {
    const nextIndex = components.length + 1;
    const refDes = `TP${nextIndex}`;
    const newComp: DetailedPcbComponent = {
      refDes,
      category: 'TEST_POINT',
      marking: 'TP',
      decodedValue: 'Diagnostic Pad',
      packageType: 'SMD Test Pad',
      bbox: { ymin: 120, xmin: 300, ymax: 160, xmax: 340 },
      confidenceScore: 1.0,
      verificationStatus: 'VERIFIED',
      circuitFunction: 'Manual Technician Oscilloscope / Multimeter Test Point',
      terminalIds: [`TP${nextIndex}-1`],
      notes: 'Added manually during visual board inspection.',
      operatingVoltageRange: '0V - 16V DC',
      pinSpecs: [
        {
          pinNumber: 1,
          pinName: 'PAD',
          category: 'signal_in',
          nominalVoltage: 12.6,
          connectedNetId: 'NET_KL30_VBAT',
          notes: 'Test point pad for multimeter probe lead attachment',
        },
      ],
    };
    setComponents(prev => [...prev, newComp]);
    setSelectedCompRef(refDes);
  };

  // Delete Component
  const handleDeleteComponent = (refDes: string) => {
    setComponents(prev => prev.filter(c => c.refDes !== refDes));
    if (selectedCompRef === refDes) setSelectedCompRef(null);
  };

  // Technician Verification Action
  const verifyComponent = (refDes: string) => {
    setComponents(prev =>
      prev.map(c =>
        c.refDes === refDes
          ? {
              ...c,
              verificationStatus: c.verificationStatus === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED',
              notes:
                c.verificationStatus === 'VERIFIED'
                  ? 'Reverted to unverified status'
                  : 'Verified by Senior Auto-Electrician against OEM schematics.',
            }
          : c
      )
    );
  };

  // JSON Export / Backup
  const exportProjectJson = () => {
    const project = {
      boardName: selectedBoard.name,
      timestamp: new Date().toISOString(),
      components,
      nets,
      source: 'Autoelectric Lab PCB Inspection Engine',
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoelectric-pcb-${selectedBoard.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered components
  const filteredComponents = components.filter(c => {
    const matchesSearch =
      c.refDes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.marking.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.decodedValue.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterMode === 'VERIFIED') return c.verificationStatus === 'VERIFIED';
    if (filterMode === 'UNVERIFIED') return c.verificationStatus === 'UNVERIFIED';
    return true;
  });

  const selectedComponent = components.find(c => c.refDes === selectedCompRef);

  const getNetColor = (netName: string): string => {
    if (netName.includes('5V') || netName.includes('REG')) return '#00f3ff'; // Neon Cyan
    if (netName.includes('VBAT') || netName.includes('KL30')) return '#ef4444'; // Neon Red
    if (netName.includes('GND')) return '#39ff14'; // Neon Green
    if (netName.includes('HIGH') || netName.includes('CANH')) return '#ff6600'; // Neon Orange
    if (netName.includes('LOW') || netName.includes('CANL')) return '#a855f7'; // Neon Purple
    return '#f59e0b'; // Amber fallback
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden text-slate-100 shadow-sm font-mono select-none">
      {/* Top Banner Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 p-2.5 bg-slate-900 text-xs gap-2">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
            alt="AutoElectric Lab Pro Official Logo"
            className="h-7 w-auto object-contain rounded border border-cyan-500/40 shadow-sm"
          />
          <span className="font-bold text-slate-100 tracking-wide whitespace-nowrap">
            PCB VISION & AUTO TRACK MAPPER
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-[11px] text-cyan-300 truncate max-w-[340px] font-sans">{statusMessage}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sample Presets */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">SAMPLE PCBs:</span>
            {SAMPLE_BOARDS.map(sb => (
              <button
                key={sb.id}
                onClick={() => loadSample(sb)}
                className={`px-2 py-0.5 text-[10px] rounded border transition ${
                  selectedBoard.id === sb.id && !uploadedImageUrl
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-bold'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {sb.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Add Manual Observation */}
          <button
            onClick={handleAddManualComponent}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition"
            title="Add Manual Test Pad / Component"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Part</span>
          </button>

          {/* Upload Button */}
          <label className="flex items-center gap-1 px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded cursor-pointer font-semibold transition">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload PCB Photo</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>

          {/* Export JSON */}
          <button
            onClick={exportProjectJson}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition"
            title="Export JSON Datasheet Backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Mobile Segmented Control Switcher (Visible on mobile screens < md) */}
      <div className="flex md:hidden items-center bg-slate-900 p-1 border-b border-slate-800 text-xs font-mono shrink-0">
        <button
          onClick={() => setMobileTab('CANVAS')}
          className={`flex-1 py-1.5 rounded-md text-center transition font-semibold flex items-center justify-center gap-1.5 ${
            mobileTab === 'CANVAS' ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>PCB Image Canvas</span>
        </button>
        <button
          onClick={() => setMobileTab('DRAWER')}
          className={`flex-1 py-1.5 rounded-md text-center transition font-semibold flex items-center justify-center gap-1.5 ${
            mobileTab === 'DRAWER' ? 'bg-cyan-600 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Datasheets & Nets ({components.length})</span>
        </button>
      </div>

      {/* Main Dual Workspace: Interactive PCB Canvas Left + Component Inspector Right */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left: Interactive Canvas */}
        <div className={`flex-1 relative bg-[#070b12] border-r border-slate-800 flex-col overflow-hidden ${
          mobileTab === 'CANVAS' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* HUD Layer Controls */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg text-[11px] text-slate-300 shadow-md">
            <button
              onClick={() => setShowComponents(!showComponents)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showComponents ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'
              }`}
            >
              {showComponents ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Components</span>
            </button>
            <button
              onClick={() => setShowNets(!showNets)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showNets ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'
              }`}
            >
              {showNets ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Neon Traces</span>
            </button>
            <button
              onClick={() => setShowPinMarkers(!showPinMarkers)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showPinMarkers ? 'bg-slate-800 text-amber-300 font-bold' : 'text-slate-500'
              }`}
            >
              <Disc className="w-3 h-3" />
              <span>Pins</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg shadow-md">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] px-1.5 text-slate-300 tabular-nums">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.6, prev + 0.1))}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={() => setZoomLevel(1.0)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* SVG PCB Viewport */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            <div
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
              className="relative w-[720px] h-[480px] bg-[#0c1815] border-4 border-[#16362e] rounded-xl shadow-2xl overflow-hidden select-none transition-transform"
            >
              {/* Scan Photo or FR4 Board Texture Background */}
              {uploadedImageUrl ? (
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded PCB Scan Document"
                  className="absolute inset-0 w-full h-full object-contain opacity-85 pointer-events-none"
                />
              ) : (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* FR4 Board Texture & Copper Ground Pour */}
                  <rect width="100%" height="100%" fill="#0a1d18" />
                  <circle cx="360" cy="240" r="230" fill="#0d2b23" opacity="0.4" />

                  {/* Silkscreen Grid */}
                  <path d="M 40 40 L 680 40 L 680 440 L 40 440 Z" fill="none" stroke="#235c4d" strokeWidth="1.5" strokeDasharray="6,4" />
                  <text x="60" y="70" fill="#448d79" fontSize="12" fontFamily="monospace" fontWeight="bold">
                    AUTOELECTRIC LAB // {selectedBoard.name.toUpperCase()}
                  </text>
                  <text x="60" y="88" fill="#2d6d5d" fontSize="9" fontFamily="monospace">
                    TOP LAYER SILKSCREEN · 1oz COPPER · AUTOMOTIVE GRADE AEC-Q100
                  </text>
                </svg>
              )}

              {/* Neon Copper Traces SVG Overlay Layer (ALWAYS RENDERED AS VISUAL OVERLAY OVER PCB SCAN IMAGE) */}
              {showNets && (
                <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                  {nets.map(net => {
                    const isNetActive = activeNetId === net.name;
                    const neonColor = getNetColor(net.name);
                    const points = net.tracePoints.map(p => `${p.x},${p.y}`).join(' ');

                    return (
                      <g
                        key={net.name}
                        onClick={e => {
                          e.stopPropagation();
                          setActiveNetId(net.name);
                          setStatusMessage(`NET PATH HIGHLIGHTED: [${net.name}] connecting components: ${net.connectedComponentRefs.join(', ')}`);
                        }}
                        className="cursor-pointer pointer-events-auto group/net"
                      >
                        {/* Wide hit area for trace clicking */}
                        <polyline
                          points={points}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="22"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Glow background stroke */}
                        <polyline
                          points={points}
                          fill="none"
                          stroke={isNetActive ? '#00f3ff' : neonColor}
                          strokeWidth={isNetActive ? '10' : '4'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={isNetActive ? '1.0' : '0.5'}
                          style={{
                            filter: isNetActive
                              ? 'drop-shadow(0 0 14px #00f3ff) drop-shadow(0 0 24px #00f3ff)'
                              : `drop-shadow(0 0 6px ${neonColor})`,
                          }}
                          className={isNetActive ? 'animate-pulse' : ''}
                        />
                        {/* Bright core line */}
                        <polyline
                          points={points}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={isNetActive ? '3' : '1.5'}
                          strokeLinecap="round"
                          opacity={isNetActive ? '1.0' : '0.8'}
                        />
                        {/* Terminal Node Pads */}
                        {showPinMarkers &&
                          net.tracePoints.map((p, idx) => (
                            <circle
                              key={idx}
                              cx={p.x}
                              cy={p.y}
                              r={isNetActive ? '8' : '4.5'}
                              fill={isNetActive ? '#00f3ff' : neonColor}
                              stroke="#ffffff"
                              strokeWidth="2"
                              className={isNetActive ? 'animate-pulse' : ''}
                            />
                          ))}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Bounding Boxes & Component Overlays */}
              {showComponents &&
                components.map(comp => {
                  const isSelected = selectedCompRef === comp.refDes;
                  const isVerified = comp.verificationStatus === 'VERIFIED';
                  const activeNetObj = nets.find(n => n.name === activeNetId);
                  const isCompInActiveNet = activeNetId
                    ? comp.pinSpecs?.some(p => p.connectedNetId === activeNetId) ||
                      activeNetObj?.connectedComponentRefs.includes(comp.refDes)
                    : false;

                  const top = comp.bbox.ymin;
                  const left = comp.bbox.xmin;
                  const width = comp.bbox.xmax - comp.bbox.xmin;
                  const height = comp.bbox.ymax - comp.bbox.ymin;

                  // Smart positioning logic for hover tooltip so it does not overflow canvas viewport
                  const positionY = comp.bbox.ymin < 140 ? 'top-full mt-2' : 'bottom-full mb-2';
                  const positionX = comp.bbox.xmin > 460 ? 'right-0' : 'left-0';

                  return (
                    <div
                      key={comp.refDes}
                      tabIndex={0}
                      onClick={() => {
                        setSelectedCompRef(comp.refDes);
                        if (comp.pinSpecs?.[0]?.connectedNetId) {
                          setActiveNetId(comp.pinSpecs[0].connectedNetId);
                          setSelectedPinNumber(comp.pinSpecs[0].pinNumber);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCompRef(comp.refDes);
                          if (comp.pinSpecs?.[0]?.connectedNetId) {
                            setActiveNetId(comp.pinSpecs[0].connectedNetId);
                            setSelectedPinNumber(comp.pinSpecs[0].pinNumber);
                          }
                        }
                      }}
                      style={{ top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px` }}
                      className={`group/comp absolute cursor-pointer border-2 transition-all flex flex-col justify-between p-1.5 rounded-md focus:outline-none ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-950/80 shadow-2xl ring-4 ring-cyan-400/50 z-30 scale-[1.02]'
                          : isCompInActiveNet
                          ? 'border-cyan-400 bg-cyan-950/90 shadow-[0_0_24px_rgba(0,243,255,0.7)] ring-2 ring-cyan-300 z-20 scale-[1.01]'
                          : isVerified
                          ? 'border-emerald-500/80 bg-emerald-950/40 hover:border-emerald-400 hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-emerald-400'
                          : 'border-amber-500/80 bg-amber-950/30 hover:border-amber-400 hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold leading-none">
                        <span className={isSelected || isCompInActiveNet ? 'text-cyan-300 font-extrabold' : isVerified ? 'text-emerald-300' : 'text-amber-300'}>
                          {comp.refDes}
                        </span>
                        <div className="flex items-center gap-1">
                          {isCompInActiveNet && (
                            <span className="text-[7.5px] bg-cyan-400 text-black px-1 py-0.2 rounded font-extrabold animate-pulse">
                              NET
                            </span>
                          )}
                          {isVerified ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <span className="text-[8px] text-amber-400 bg-amber-950/90 px-1 py-0.2 rounded border border-amber-800">
                              AI
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[9.5px] font-mono truncate text-slate-100 font-semibold leading-tight">
                        {comp.marking || comp.category}
                      </div>

                      {/* Component Pin Terminal Nodes for Net Path Selection */}
                      {comp.pinSpecs && comp.pinSpecs.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap mt-1 pt-1 border-t border-slate-800/80">
                          {comp.pinSpecs.map(pin => {
                            const isPinSelected = selectedPinNumber === pin.pinNumber && selectedCompRef === comp.refDes;
                            const isPinNetActive = activeNetId === pin.connectedNetId;
                            return (
                              <button
                                key={pin.pinNumber}
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedCompRef(comp.refDes);
                                  setSelectedPinNumber(pin.pinNumber);
                                  setActiveNetId(pin.connectedNetId);
                                  const connectedNet = nets.find(n => n.name === pin.connectedNetId);
                                  const nodes = connectedNet ? connectedNet.connectedComponentRefs.join(', ') : comp.refDes;
                                  setStatusMessage(
                                    `PIN #${pin.pinNumber} (${pin.pinName}) SELECTED · Highlighting net [${pin.connectedNetId}] across: ${nodes}`
                                  );
                                }}
                                title={`Pin #${pin.pinNumber} (${pin.pinName}) -> Net: ${pin.connectedNetId}`}
                                className={`px-1 py-0.2 rounded text-[7.5px] font-mono font-bold transition-all flex items-center ${
                                  isPinSelected
                                    ? 'bg-cyan-300 text-black ring-2 ring-white font-extrabold scale-110 shadow-[0_0_8px_#00f3ff]'
                                    : isPinNetActive
                                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-400 animate-pulse'
                                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700'
                                }`}
                              >
                                <span>#{pin.pinNumber}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Interactive Hover-Based Contextual Component Specification Tooltip */}
                      <div
                        className={`opacity-0 group-hover/comp:opacity-100 group-focus-within/comp:opacity-100 pointer-events-none absolute ${positionY} ${positionX} w-64 bg-slate-950/95 backdrop-blur-md border border-cyan-500/70 text-slate-100 p-2.5 rounded-lg shadow-2xl z-40 transition-all duration-150 transform scale-95 group-hover/comp:scale-100 group-focus-within/comp:scale-100 font-mono`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <strong className="text-cyan-300 text-xs">{comp.refDes}</strong>
                            <span className="text-[10px] text-slate-400 font-sans truncate max-w-[100px]">({comp.category.replace('_', ' ')})</span>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                              isVerified
                                ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                                : 'bg-amber-950 border-amber-700 text-amber-300'
                            }`}
                          >
                            {isVerified ? 'VERIFIED' : `AI (${Math.round((comp.confidenceScore || 0.9) * 100)}%)`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-300">
                          <div>
                            <span className="text-slate-500 text-[8.5px] block uppercase font-sans">Package Type</span>
                            <span className="font-semibold text-slate-100 truncate block">{comp.packageType || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8.5px] block uppercase font-sans">Operating Voltage</span>
                            <span className="font-semibold text-cyan-300 truncate block">{comp.operatingVoltageRange || '5.0V DC'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8.5px] block uppercase font-sans">Marking / Value</span>
                            <span className="font-semibold text-amber-300 truncate block">{comp.marking || comp.decodedValue || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8.5px] block uppercase font-sans">Max Current</span>
                            <span className="font-semibold text-emerald-300 truncate block">{comp.maxCurrentRating || 'N/A'}</span>
                          </div>
                        </div>

                        {comp.circuitFunction && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[9.5px] text-slate-300 font-sans leading-tight">
                            <span className="text-cyan-400 font-mono text-[8.5px] font-bold block mb-0.5">FUNCTION:</span>
                            {comp.circuitFunction}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right: Inspection & Component Datasheet Drawer */}
        <aside className={`w-full md:w-96 bg-slate-900 p-2.5 sm:p-3.5 flex-col gap-3 overflow-y-auto text-xs font-mono border-t md:border-t-0 md:border-l border-slate-800 shrink-0 ${
          mobileTab === 'DRAWER' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> COMPONENT DATASHEET & PINOUTS
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{components.length} Items</span>
          </div>

          {/* Selected Component Datasheet Card */}
          {selectedComponent ? (
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col gap-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-cyan-300">{selectedComponent.refDes}</span>
                  <span className="text-xs text-slate-400 font-sans font-medium">({selectedComponent.category})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      selectedComponent.verificationStatus === 'VERIFIED'
                        ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                        : 'bg-amber-950 border-amber-700 text-amber-300'
                    }`}
                  >
                    {selectedComponent.verificationStatus}
                  </span>
                  <button
                    onClick={() => handleDeleteComponent(selectedComponent.refDes)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                    title="Delete Part Observation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-sans">
                <div>
                  <span className="text-slate-500 block text-[9px] font-mono uppercase">Package Type:</span>
                  <strong className="text-slate-200 font-mono">{selectedComponent.packageType}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] font-mono uppercase">Marking Code:</span>
                  <strong className="text-slate-200 font-mono">{selectedComponent.marking || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] font-mono uppercase">Operating Voltage:</span>
                  <strong className="text-cyan-300 font-mono">{selectedComponent.operatingVoltageRange || '5V DC'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] font-mono uppercase">Max Current:</span>
                  <strong className="text-amber-300 font-mono">{selectedComponent.maxCurrentRating || 'N/A'}</strong>
                </div>
              </div>

              {/* Datasheet Summary Note */}
              {selectedComponent.datasheetSummary && (
                <div className="text-[10.5px] text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 font-sans leading-relaxed">
                  <span className="text-[9px] text-cyan-400 uppercase font-mono font-bold block mb-0.5">Datasheet Notes:</span>
                  {selectedComponent.datasheetSummary}
                </div>
              )}

              {/* Pinout Breakout Specification Table */}
              {selectedComponent.pinSpecs && selectedComponent.pinSpecs.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-300 uppercase tracking-wider">
                      PINOUT BREAKOUT TABLE ({selectedComponent.pinSpecs.length} PINS)
                    </span>
                  </div>
                  <div className="border border-slate-800 rounded-lg overflow-hidden text-[10px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900 text-slate-400 font-mono text-[9px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-1.5">Pin #</th>
                          <th className="p-1.5">Name</th>
                          <th className="p-1.5">Nominal</th>
                          <th className="p-1.5">Net ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedComponent.pinSpecs.map(pin => {
                          const isPinSelected = selectedPinNumber === pin.pinNumber && selectedCompRef === selectedComponent.refDes;
                          const isPinNetActive = activeNetId === pin.connectedNetId;
                          return (
                            <tr
                              key={pin.pinNumber}
                              onClick={() => {
                                setSelectedPinNumber(pin.pinNumber);
                                setActiveNetId(pin.connectedNetId);
                                const connectedNet = nets.find(n => n.name === pin.connectedNetId);
                                const nodes = connectedNet ? connectedNet.connectedComponentRefs.join(', ') : selectedComponent.refDes;
                                setStatusMessage(
                                  `PIN #${pin.pinNumber} (${pin.pinName}) SELECTED · Highlighting net [${pin.connectedNetId}] across: ${nodes}`
                                );
                              }}
                              className={`cursor-pointer transition ${
                                isPinSelected
                                  ? 'bg-cyan-950 border-l-4 border-cyan-400 text-cyan-200 font-bold shadow-sm'
                                  : isPinNetActive
                                  ? 'bg-cyan-950/50 text-cyan-300'
                                  : 'hover:bg-slate-900/60 text-slate-300'
                              }`}
                            >
                              <td className="p-1.5 font-bold text-slate-300 flex items-center gap-1">
                                <span className={isPinSelected ? 'text-cyan-400 font-extrabold' : 'text-slate-400'}>#{pin.pinNumber}</span>
                                {isPinSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                              </td>
                              <td className="p-1.5 font-semibold text-slate-200">{pin.pinName}</td>
                              <td className="p-1.5 text-amber-300 tabular-nums">{pin.nominalVoltage.toFixed(1)}V</td>
                              <td className="p-1.5 text-cyan-400 truncate max-w-[90px]">{pin.connectedNetId}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Technician Sign-Off Action Button */}
              <button
                onClick={() => verifyComponent(selectedComponent.refDes)}
                className={`mt-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
                  selectedComponent.verificationStatus === 'VERIFIED'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {selectedComponent.verificationStatus === 'VERIFIED'
                    ? 'Revoke Sign-off (Mark Unverified)'
                    : 'Technician Sign-Off & Verification'}
                </span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-center text-xs font-sans">
              Click any component box or neon copper trace on the board to view datasheets and pinouts.
            </div>
          )}

          {/* Connected Copper Traces Net Registry */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              COPPER TRACE NETS ({nets.length}):
            </span>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {nets.map(net => {
                const isSelected = activeNetId === net.name;
                const color = getNetColor(net.name);
                return (
                  <div
                    key={net.name}
                    onClick={() => setActiveNetId(net.name)}
                    className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition text-[11px] ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{net.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {net.connectedComponentRefs.length} Nodes
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Component Search & Registry List */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                PART REGISTRY ({filteredComponents.length}):
              </span>
              <div className="flex items-center gap-1 text-[9px]">
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-1.5 py-0.5 rounded ${filterMode === 'ALL' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterMode('VERIFIED')}
                  className={`px-1.5 py-0.5 rounded ${filterMode === 'VERIFIED' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-slate-500'}`}
                >
                  Verified
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search RefDes, IC, marking..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
              {filteredComponents.map(comp => (
                <div
                  key={comp.refDes}
                  onClick={() => {
                    setSelectedCompRef(comp.refDes);
                    if (comp.pinSpecs?.[0]?.connectedNetId) {
                      setActiveNetId(comp.pinSpecs[0].connectedNetId);
                    }
                  }}
                  className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition text-[11px] ${
                    selectedCompRef === comp.refDes
                      ? 'bg-slate-800 border-cyan-400 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-cyan-400 font-mono">{comp.refDes}</span>
                    <span className="text-slate-400 text-[10px] truncate max-w-[130px]">
                      {comp.marking || comp.category}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      comp.verificationStatus === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {comp.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'AI'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
