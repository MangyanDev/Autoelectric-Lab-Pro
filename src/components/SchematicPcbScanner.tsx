import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzePcbImage } from '../services/pcbImageAnalysisService';
import {
  ImageAnalysisComponent,
  ImageAnalysisHotspot,
  ImageAnalysisNet,
  ImageAnalysisPinSpec,
  ImageAnalysisResult,
  PcbNormalizedBox,
} from '../server/services/imageAnalysisTypes';
import {
  clampBbox,
  clampCoord,
  cropPcbRegionToJpegBase64,
  fusePcbVisionResults,
  getBoxCenter,
  LocalPcbCvOutput,
  mergeMacroCropResults,
  runLocalPcbCv,
} from '../utils/pcbLocalVision';
import {
  deletePcbScan,
  SavedPcbScan,
  savePcbScan,
  subscribePcbScans,
} from '../services/benchStorageService';
import { useAuth } from '../context/AuthContext';
import { PowerSupplyState, InjectedFault } from '../types/ecu';
import {
  Upload,
  Cpu,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Download,
  Plus,
  Eye,
  EyeOff,
  Search,
  Trash2,
  Activity,
  Disc,
  Crop,
  Move,
  Flame,
  Globe,
  Bot,
  CloudUpload,
  FolderOpen,
  Link2,
  Sparkles,
} from 'lucide-react';

export type PcbPinSpec = ImageAnalysisPinSpec;
export type DetailedPcbComponent = ImageAnalysisComponent;

export interface SchematicPcbScannerProps {
  onOpenGroundedSearch?: (query?: string, dtc?: string, ecu?: string) => void;
  onOpenOfflineBot?: (prompt?: string) => void;
  onOpenCloudModal?: () => void;
  nodeVoltages?: Record<string, number>;
  supplyCurrentDrawAmps?: number;
  powerSupply?: PowerSupplyState;
  faults?: InjectedFault[];
}

interface SampleBoard {
  id: string;
  name: string;
  type: string;
  summary: string;
  components: DetailedPcbComponent[];
  nets: ImageAnalysisNet[];
  hotspots: ImageAnalysisHotspot[];
}

// Normalized 0..1000 coordinate presets (aspect 3:2)
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
        bbox: { ymin: 333, xmin: 333, ymax: 667, xmax: 583 },
        confidenceScore: 0.96,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Main ECU 5V Reference & Logic Power Rail Regulator',
        terminalIds: ['U1-VIN', 'U1-GND', 'U1-VOUT', 'U1-RESET', 'U1-DELAY'],
        notes: 'Matches Bosch ME7.5 main power supply topology. High thermal dissipation tab tied to GND pour.',
        operatingVoltageRange: '4.2V - 42V DC',
        maxCurrentRating: '450 mA',
        datasheetSummary: 'Low drop voltage (typ. 250mV at 300mA), reverse polarity proof (-42V), overtemperature protection.',
        source: 'MANUAL',
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
        bbox: { ymin: 354, xmin: 111, ymax: 521, xmax: 250 },
        confidenceScore: 0.93,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Reverse Battery Polarity Protection',
        terminalIds: ['D1-A', 'D1-K'],
        operatingVoltageRange: '40V Reverse Repetitive Peak',
        maxCurrentRating: '5.0 A',
        datasheetSummary: 'High current capability, ultra-low forward voltage drop (0.55V at 5A).',
        source: 'MANUAL',
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
        bbox: { ymin: 583, xmin: 111, ymax: 813, xmax: 250 },
        confidenceScore: 0.89,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Input Battery Ripple Filter',
        terminalIds: ['C1-POS', 'C1-NEG'],
        operatingVoltageRange: '35V DC Max',
        maxCurrentRating: '1.2A Ripple Current',
        datasheetSummary: 'Low ESR automotive grade electrolytic capacitor for dampening alternator ripple.',
        source: 'MANUAL',
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
        bbox: { ymin: 375, xmin: 653, ymax: 521, xmax: 778 },
        confidenceScore: 0.88,
        verificationStatus: 'UNVERIFIED',
        circuitFunction: '5V Output Stability Filter',
        terminalIds: ['C2-POS', 'C2-NEG'],
        operatingVoltageRange: '10V DC',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'Ensures LDO control loop phase margin and suppresses high-frequency digital noise.',
        source: 'MANUAL',
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
        bbox: { ymin: 625, xmin: 653, ymax: 771, xmax: 778 },
        confidenceScore: 0.91,
        verificationStatus: 'UNVERIFIED',
        circuitFunction: 'Load Dump ISO 7637-2 Transient Suppression',
        terminalIds: ['TVS-1', 'TVS-2'],
        operatingVoltageRange: '24V Breakdown / 38.9V Clamp',
        maxCurrentRating: '600W Peak Pulse Power',
        datasheetSummary: 'Clamps inductive load dump spikes (ignition coils/starter motor collapse).',
        source: 'MANUAL',
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
          { x: 250, y: 438 },
          { x: 333, y: 438 },
          { x: 333, y: 396 },
          { x: 181, y: 438 },
          { x: 181, y: 583 },
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
          { x: 583, y: 604 },
          { x: 653, y: 604 },
          { x: 653, y: 448 },
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
          { x: 181, y: 813 },
          { x: 458, y: 667 },
          { x: 715, y: 521 },
          { x: 715, y: 771 },
        ],
        confidenceScore: 0.96,
        verificationStatus: 'VERIFIED',
        isComplete: true,
      },
    ],
    hotspots: [
      {
        id: 'sample-tvs-stress',
        label: 'Load-Dump Clamp Thermal Stress Zone',
        severity: 'WARNING',
        bbox: { ymin: 610, xmin: 640, ymax: 790, xmax: 792 },
        suspectComponentRef: 'TVS1',
        notes: 'Check bidirectional TVS diode resistance in-circuit; shorted TVS blows KL30 main fuse under jump-start.',
        source: 'AI',
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
        bbox: { ymin: 396, xmin: 333, ymax: 688, xmax: 528 },
        confidenceScore: 0.97,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Physical CAN Bus Differential Interface Transceiver',
        terminalIds: ['U2-TXD', 'U2-GND', 'U2-VCC', 'U2-RXD', 'U2-VREF', 'U2-CANL', 'U2-CANH', 'U2-S'],
        operatingVoltageRange: '4.75V - 5.25V DC',
        maxCurrentRating: '70 mA',
        datasheetSummary: 'Fully ISO 11898 compliant, low EME, high ESD robustness (> 6kV), split output pin VREF.',
        source: 'MANUAL',
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
        bbox: { ymin: 354, xmin: 611, ymax: 458, xmax: 708 },
        confidenceScore: 0.93,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Split Termination Upper Arm (60.4Ω to CAN-H)',
        terminalIds: ['R1-1', 'R1-2'],
        operatingVoltageRange: '0.125W Rating',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'High precision 1% metal film resistor for matching differential bus impedance.',
        source: 'MANUAL',
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
        bbox: { ymin: 604, xmin: 611, ymax: 708, xmax: 708 },
        confidenceScore: 0.93,
        verificationStatus: 'VERIFIED',
        circuitFunction: 'Split Termination Lower Arm (60.4Ω to CAN-L)',
        terminalIds: ['R2-1', 'R2-2'],
        operatingVoltageRange: '0.125W Rating',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'High precision 1% metal film resistor for matching differential bus impedance.',
        source: 'MANUAL',
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
        bbox: { ymin: 479, xmin: 764, ymax: 583, xmax: 833 },
        confidenceScore: 0.88,
        verificationStatus: 'UNVERIFIED',
        circuitFunction: 'Split Termination Common-Mode RF Ground Capacitor',
        terminalIds: ['C3-1', 'C3-2'],
        operatingVoltageRange: '50V DC',
        maxCurrentRating: 'N/A',
        datasheetSummary: 'Bypasses common-mode high-frequency noise from split termination node to ground.',
        source: 'MANUAL',
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
          { x: 528, y: 458 },
          { x: 611, y: 406 },
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
          { x: 528, y: 583 },
          { x: 611, y: 656 },
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
          { x: 708, y: 406 },
          { x: 708, y: 656 },
          { x: 764, y: 531 },
        ],
        confidenceScore: 0.91,
        verificationStatus: 'UNVERIFIED',
        isComplete: true,
      },
    ],
    hotspots: [
      {
        id: 'sample-can-esd',
        label: 'CANH/CANL ESD Surge Susceptibility',
        severity: 'INFO',
        bbox: { ymin: 410, xmin: 495, ymax: 660, xmax: 550 },
        suspectComponentRef: 'U2',
        notes: 'Check pins 6 & 7 against GND for 12V short damage if OBD-II CAN bus fails to wake.',
        source: 'AI',
      },
    ],
  },
];

type InteractionDrag =
  | {
      type: 'MOVE';
      refDes: string;
      startClientX: number;
      startClientY: number;
      origBox: PcbNormalizedBox;
      boardRect: DOMRect;
    }
  | {
      type: 'RESIZE';
      refDes: string;
      startClientX: number;
      startClientY: number;
      origBox: PcbNormalizedBox;
      boardRect: DOMRect;
    }
  | {
      type: 'CROP';
      startXNorm: number;
      startYNorm: number;
      boardRect: DOMRect;
    };

export const SchematicPcbScanner: React.FC<SchematicPcbScannerProps> = ({
  onOpenGroundedSearch,
  onOpenOfflineBot,
  onOpenCloudModal,
  nodeVoltages,
  supplyCurrentDrawAmps,
  powerSupply,
  faults,
}) => {
  const { user, authReady } = useAuth();

  const [selectedBoard, setSelectedBoard] = useState<SampleBoard>(SAMPLE_BOARDS[0]);
  const [boardTitle, setBoardTitle] = useState<string>(SAMPLE_BOARDS[0].name);
  const [boardType, setBoardType] = useState<string>(SAMPLE_BOARDS[0].type);
  const [analysisSummary, setAnalysisSummary] = useState<string>(SAMPLE_BOARDS[0].summary);
  const [analysisModel, setAnalysisModel] = useState<string>('preset-reference');

  const [components, setComponents] = useState<DetailedPcbComponent[]>(SAMPLE_BOARDS[0].components);
  const [nets, setNets] = useState<ImageAnalysisNet[]>(SAMPLE_BOARDS[0].nets);
  const [hotspots, setHotspots] = useState<ImageAnalysisHotspot[]>(SAMPLE_BOARDS[0].hotspots);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    'AI & LOCAL CV ENGINE ONLINE · Drag boxes to adjust, or upload any ECU PCB photo'
  );
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [boardAspect, setBoardAspect] = useState<number>(1.5); // width / height
  const [selectedCompRef, setSelectedCompRef] = useState<string | null>('U1');
  const [activeNetId, setActiveNetId] = useState<string | null>('NET_5V_REGULATED');
  const [hoveredPinNetId, setHoveredPinNetId] = useState<string | null>(null);
  const effectiveNetId = hoveredPinNetId || activeNetId;
  const [selectedPinNumber, setSelectedPinNumber] = useState<number | null>(5);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [mobileTab, setMobileTab] = useState<'CANVAS' | 'DRAWER'>('CANVAS');

  // Interactive Modes & Layer Visibility
  const [interactionMode, setInteractionMode] = useState<'EDIT' | 'MACRO_CROP'>('EDIT');
  const [cropMarquee, setCropMarquee] = useState<PcbNormalizedBox | null>(null);
  const [showComponents, setShowComponents] = useState(true);
  const [showNets, setShowNets] = useState(true);
  const [showPinMarkers, setShowPinMarkers] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [showThermalHeatmap, setShowThermalHeatmap] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Cloud Saved PCB Scans state
  const [savedScans, setSavedScans] = useState<SavedPcbScan[]>([]);
  const [showSavedScansPanel, setShowSavedScansPanel] = useState(false);
  const [isSavingScan, setIsSavingScan] = useState(false);

  // Quick Net Creation state
  const [newNetName, setNewNetName] = useState('');

  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<InteractionDrag | null>(null);
  const cropMarqueeRef = useRef<PcbNormalizedBox | null>(null);
  const lastLocalCvRef = useRef<LocalPcbCvOutput | null>(null);

  // Subscribe to user's saved PCB scans in Firestore
  useEffect(() => {
    if (!authReady || !user) {
      setSavedScans([]);
      return;
    }
    const unsub = subscribePcbScans(
      user.uid,
      (scans) => setSavedScans(scans),
      () => {}
    );
    return () => unsub();
  }, [authReady, user]);

  // Revoke ObjectURL on change/unmount
  useEffect(() => {
    return () => {
      if (uploadedImageUrl && uploadedImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedImageUrl);
      }
    };
  }, [uploadedImageUrl]);

  // Prepare downscaled JPEG + run deterministic Local CV on uploaded PCB photo
  const prepareOptimizedPcbImage = async (
    file: File
  ): Promise<{
    previewUrl: string;
    imageBase64: string;
    mimeType: string;
    aspect: number;
    localCv: LocalPcbCvOutput;
  }> => {
    const MAX_DIM = 1600;
    const rawUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to decode uploaded PCB image'));
        el.src = rawUrl;
      });

      const natW = img.naturalWidth || 1200;
      const natH = img.naturalHeight || 800;
      const scale = Math.min(1, MAX_DIM / Math.max(natW, natH));
      const targetW = Math.max(1, Math.round(natW * scale));
      const targetH = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Instant deterministic local CV pass over resized board canvas
      const localCv = runLocalPcbCv(canvas);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Image compression failed'))),
          'image/jpeg',
          0.86
        );
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
      const imageBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      canvas.width = 0;
      canvas.height = 0;

      return {
        previewUrl: URL.createObjectURL(blob),
        imageBase64,
        mimeType: 'image/jpeg',
        aspect: targetW / targetH,
        localCv,
      };
    } finally {
      URL.revokeObjectURL(rawUrl);
    }
  };

  // Load Sample Preset
  const loadSample = (board: SampleBoard) => {
    setSelectedBoard(board);
    setBoardTitle(board.name);
    setBoardType(board.type);
    setAnalysisSummary(board.summary);
    setAnalysisModel('preset-reference');
    setComponents(board.components);
    setNets(board.nets);
    setHotspots(board.hotspots);
    setUploadedImageUrl(null);
    setBoardAspect(1.5);
    setInteractionMode('EDIT');
    setCropMarquee(null);
    setSelectedCompRef(board.components[0]?.refDes || null);
    setActiveNetId(board.nets[0]?.name || null);
    setSelectedHotspotId(null);
    setStatusMessage(`Loaded preset: ${board.name}`);
  };

  // Automatic Upload & Hybrid Vision Mapping (Local CV + Free Gemini 4 Hydrogen)
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      setStatusMessage('ERROR: File size exceeds 12 MB upload limit.');
      return;
    }

    setIsAnalyzing(true);
    setInteractionMode('EDIT');
    setCropMarquee(null);
    setStatusMessage('PHASE 1/2: Running Local Sobel/Pad CV & optimizing photo...');

    try {
      const { previewUrl, imageBase64, mimeType, aspect, localCv } = await prepareOptimizedPcbImage(file);
      lastLocalCvRef.current = localCv;
      setUploadedImageUrl(previewUrl);
      setBoardAspect(aspect);
      setBoardTitle(file.name.replace(/\.[^.]+$/, ''));
      setBoardType('Uploaded Automotive ECU PCB');

      // Show instant Local CV map immediately while Gemini Vision analyzes markings & pinouts
      if (localCv.components.length > 0 || localCv.hotspots.length > 0) {
        const draft = fusePcbVisionResults(null, localCv);
        setComponents(draft.components);
        setNets(draft.nets);
        setHotspots(draft.hotspots || []);
        setSelectedCompRef(draft.components[0]?.refDes || null);
        setActiveNetId(draft.nets[0]?.name || null);
      }

      setStatusMessage('PHASE 2/2: Mapping ICs, pinouts & copper traces with Gemini 4 Hydrogen...');

      let aiResult: ImageAnalysisResult | null = null;
      try {
        aiResult = await analyzePcbImage({
          imageBase64,
          mimeType,
          documentName: file.name,
          documentType: 'pcb',
        });
      } catch (aiErr) {
        console.warn('AI analysis fallback to Local CV:', aiErr);
      }

      const fused = fusePcbVisionResults(
        aiResult && aiResult.detectionMethod === 'AI_ANALYZED' ? aiResult : null,
        localCv
      );

      setComponents(fused.components);
      setNets(fused.nets);
      setHotspots(fused.hotspots || []);
      setAnalysisSummary(fused.analysisSummary);
      setAnalysisModel(fused.model);
      setSelectedCompRef(fused.components[0]?.refDes || null);
      setActiveNetId(fused.nets[0]?.name || null);
      setSelectedHotspotId(fused.hotspots?.[0]?.id || null);

      if (fused.detectionMethod === 'AI_ANALYZED') {
        setStatusMessage(
          `AUTO-MAP COMPLETE (${fused.model}): ${fused.components.length} parts, ${fused.nets.length} nets, ${fused.hotspots?.length || 0} hotspots`
        );
      } else {
        setStatusMessage(
          `LOCAL CV MAPPED (Offline Mode): ${fused.components.length} clusters, ${fused.nets.length} trace links, ${fused.hotspots?.length || 0} hotspots`
        );
      }
    } catch (err) {
      console.error('PCB upload pipeline error:', err);
      setStatusMessage('ERROR: Could not decode PCB image. Try a standard PNG/JPG photo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Re-run deterministic Local CV hotspot & cluster scan on current uploaded image
  const handleRerunLocalCv = async () => {
    if (!uploadedImageUrl) return;
    setIsAnalyzing(true);
    setStatusMessage('Running local Sobel/thermal hotspot CV scan...');
    try {
      const { localCv } = await cropPcbRegionToJpegBase64(uploadedImageUrl, {
        ymin: 0,
        xmin: 0,
        ymax: 1000,
        xmax: 1000,
      });
      lastLocalCvRef.current = localCv;
      const fused = fusePcbVisionResults(
        {
          documentType: 'pcb',
          confidenceScore: 0.85,
          detectionMethod: 'AI_ANALYZED',
          analysisSummary,
          components,
          terminals: [],
          nets,
          hotspots,
          warnings: [],
          model: analysisModel,
          provider: 'hybrid',
        },
        localCv
      );
      setComponents(fused.components);
      setNets(fused.nets);
      setHotspots(fused.hotspots || []);
      setStatusMessage(
        `LOCAL CV REFRESHED: ${fused.hotspots?.length || 0} hotspot(s) & ${fused.components.length} components mapped.`
      );
    } catch (err) {
      console.warn('Local CV refresh failed:', err);
      setStatusMessage('Local CV refresh failed on current board.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Execute Macro Crop Re-Scan on selected normalized [0..1000] rectangle
  const executeMacroCropScan = useCallback(
    async (cropBox: PcbNormalizedBox) => {
      if (!uploadedImageUrl) return;
      setIsAnalyzing(true);
      setStatusMessage(
        `MACRO CROP SCAN: Zooming region [${cropBox.xmin},${cropBox.ymin}]–[${cropBox.xmax},${cropBox.ymax}]...`
      );
      try {
        const { imageBase64, mimeType, localCv } = await cropPcbRegionToJpegBase64(
          uploadedImageUrl,
          cropBox
        );

        let aiCrop: ImageAnalysisResult | null = null;
        try {
          aiCrop = await analyzePcbImage({
            imageBase64,
            mimeType,
            documentName: `${boardTitle}_macro_crop.jpg`,
            documentType: 'pcb_macro_crop',
            regionBox: cropBox,
          });
        } catch (err) {
          console.warn('Macro crop AI fallback to local CV:', err);
        }

        const fusedCrop = fusePcbVisionResults(
          aiCrop && aiCrop.detectionMethod === 'AI_ANALYZED' ? aiCrop : null,
          localCv
        );

        const merged = mergeMacroCropResults(
          { components, nets, hotspots },
          cropBox,
          fusedCrop
        );

        setComponents(merged.components);
        setNets(merged.nets);
        setHotspots(merged.hotspots);
        setInteractionMode('EDIT');
        setCropMarquee(null);
        setStatusMessage(
          `MACRO CROP MERGED: +${merged.addedCount} new parts, ${merged.updatedCount} refined markings`
        );
      } catch (err) {
        console.warn('Macro crop error:', err);
        setStatusMessage('Macro crop scan failed. Try drawing a slightly larger box.');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [uploadedImageUrl, boardTitle, components, nets, hotspots]
  );

  // Pointer Move & Pointer Up handler for Drag, Resize & Macro Crop
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === 'MOVE') {
        const dxNorm = ((e.clientX - drag.startClientX) / Math.max(1, drag.boardRect.width)) * 1000;
        const dyNorm = ((e.clientY - drag.startClientY) / Math.max(1, drag.boardRect.height)) * 1000;
        const w = drag.origBox.xmax - drag.origBox.xmin;
        const h = drag.origBox.ymax - drag.origBox.ymin;
        const xmin = clampCoord(drag.origBox.xmin + dxNorm, 0, 1000 - w);
        const ymin = clampCoord(drag.origBox.ymin + dyNorm, 0, 1000 - h);
        const nextBox: PcbNormalizedBox = {
          ymin,
          xmin,
          ymax: ymin + h,
          xmax: xmin + w,
        };
        setComponents((prev) =>
          prev.map((c) => (c.refDes === drag.refDes ? { ...c, bbox: nextBox } : c))
        );
      } else if (drag.type === 'RESIZE') {
        const dxNorm = ((e.clientX - drag.startClientX) / Math.max(1, drag.boardRect.width)) * 1000;
        const dyNorm = ((e.clientY - drag.startClientY) / Math.max(1, drag.boardRect.height)) * 1000;
        const xmax = clampCoord(drag.origBox.xmax + dxNorm, drag.origBox.xmin + 20, 1000);
        const ymax = clampCoord(drag.origBox.ymax + dyNorm, drag.origBox.ymin + 20, 1000);
        const nextBox: PcbNormalizedBox = {
          ymin: drag.origBox.ymin,
          xmin: drag.origBox.xmin,
          ymax,
          xmax,
        };
        setComponents((prev) =>
          prev.map((c) => (c.refDes === drag.refDes ? { ...c, bbox: nextBox } : c))
        );
      } else if (drag.type === 'CROP') {
        const currX = clampCoord(((e.clientX - drag.boardRect.left) / Math.max(1, drag.boardRect.width)) * 1000);
        const currY = clampCoord(((e.clientY - drag.boardRect.top) / Math.max(1, drag.boardRect.height)) * 1000);
        const nextBox: PcbNormalizedBox = {
          xmin: Math.min(drag.startXNorm, currX),
          ymin: Math.min(drag.startYNorm, currY),
          xmax: Math.max(drag.startXNorm, currX),
          ymax: Math.max(drag.startYNorm, currY),
        };
        cropMarqueeRef.current = nextBox;
        setCropMarquee(nextBox);
      }
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.type === 'MOVE') {
        // Re-center trace points linked to this component cleanly
        const movedComp = components.find((c) => c.refDes === drag.refDes);
        if (movedComp) {
          const oldCenter = getBoxCenter(drag.origBox);
          const newCenter = getBoxCenter(movedComp.bbox);
          const deltaX = newCenter.x - oldCenter.x;
          const deltaY = newCenter.y - oldCenter.y;
          if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
            setNets((prevNets) =>
              prevNets.map((net) => {
                if (!net.connectedComponentRefs.includes(drag.refDes)) return net;
                let movedAny = false;
                const updatedPts = net.tracePoints.map((pt) => {
                  const dist = Math.hypot(pt.x - oldCenter.x, pt.y - oldCenter.y);
                  if (dist < 110) {
                    movedAny = true;
                    return {
                      x: clampCoord(pt.x + deltaX),
                      y: clampCoord(pt.y + deltaY),
                    };
                  }
                  return pt;
                });
                return movedAny ? { ...net, tracePoints: updatedPts } : net;
              })
            );
          }
        }
      } else if (drag.type === 'CROP') {
        const box = cropMarqueeRef.current;
        cropMarqueeRef.current = null;
        if (box && box.xmax - box.xmin >= 25 && box.ymax - box.ymin >= 25) {
          void executeMacroCropScan(box);
        } else {
          setCropMarquee(null);
          setStatusMessage('Macro crop box too small — drag a larger area around the IC or trace.');
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [components, executeMacroCropScan]);

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
      bbox: { ymin: 220, xmin: 420, ymax: 300, xmax: 510 },
      confidenceScore: 1.0,
      verificationStatus: 'VERIFIED',
      circuitFunction: 'Manual Technician Oscilloscope / Multimeter Test Point',
      terminalIds: [`TP${nextIndex}-1`],
      notes: 'Added manually during visual board inspection.',
      operatingVoltageRange: '0V - 16V DC',
      source: 'MANUAL',
      pinSpecs: [
        {
          pinNumber: 1,
          pinName: 'PAD',
          category: 'signal_in',
          nominalVoltage: 12.6,
          connectedNetId: activeNetId || 'NET_KL30_VBAT',
          notes: 'Test point pad for multimeter probe lead attachment',
        },
      ],
    };
    setComponents((prev) => [...prev, newComp]);
    setSelectedCompRef(refDes);
    setStatusMessage(`Added ${refDes} — drag box on PCB canvas to position over pad.`);
  };

  // Delete Component
  const handleDeleteComponent = (refDes: string) => {
    setComponents((prev) => prev.filter((c) => c.refDes !== refDes));
    setNets((prev) =>
      prev.map((n) => ({
        ...n,
        connectedComponentRefs: n.connectedComponentRefs.filter((r) => r !== refDes),
      }))
    );
    if (selectedCompRef === refDes) setSelectedCompRef(null);
  };

  // Inline Component Field Update
  const updateSelectedComponentField = (
    refDes: string,
    updates: Partial<DetailedPcbComponent>
  ) => {
    setComponents((prev) =>
      prev.map((c) => (c.refDes === refDes ? { ...c, ...updates } : c))
    );
  };

  // Inline Pin Net / Name Update + Sync Trace Connection
  const handleUpdatePinNet = (
    compRefDes: string,
    pinNumber: number,
    nextNetId: string,
    nextPinName?: string,
    nextVoltage?: number
  ) => {
    const cleanNet = nextNetId.trim().toUpperCase().replace(/\s+/g, '_') || 'NET_UNASSIGNED';

    setComponents((prev) =>
      prev.map((c) => {
        if (c.refDes !== compRefDes) return c;
        const nextPins = (c.pinSpecs || []).map((p) =>
          p.pinNumber === pinNumber
            ? {
                ...p,
                connectedNetId: cleanNet,
                pinName: nextPinName !== undefined ? nextPinName : p.pinName,
                nominalVoltage: nextVoltage !== undefined ? nextVoltage : p.nominalVoltage,
              }
            : p
        );
        return { ...c, pinSpecs: nextPins };
      })
    );

    if (cleanNet !== 'NET_UNASSIGNED') {
      setNets((prevNets) => {
        const compObj = components.find((c) => c.refDes === compRefDes);
        const compCenter = compObj ? getBoxCenter(compObj.bbox) : { x: 500, y: 500 };
        const existingIdx = prevNets.findIndex((n) => n.name === cleanNet);

        if (existingIdx >= 0) {
          return prevNets.map((n, idx) => {
            if (idx !== existingIdx) return n;
            const hasComp = n.connectedComponentRefs.includes(compRefDes);
            return {
              ...n,
              connectedComponentRefs: hasComp
                ? n.connectedComponentRefs
                : [...n.connectedComponentRefs, compRefDes],
              tracePoints: hasComp
                ? n.tracePoints
                : [...n.tracePoints, compCenter],
            };
          });
        }

        return [
          ...prevNets,
          {
            name: cleanNet,
            signalType: cleanNet.includes('GND')
              ? 'GROUND'
              : cleanNet.includes('5V')
              ? '5V_LOGIC'
              : cleanNet.includes('VBAT')
              ? 'BATTERY_POWER'
              : 'SIGNAL_TRACE',
            connectedComponentRefs: [compRefDes],
            connectedTerminalIds: [`${compRefDes}-P${pinNumber}`],
            tracePoints: [compCenter],
            confidenceScore: 0.9,
            verificationStatus: 'VERIFIED',
            isComplete: false,
          },
        ];
      });
      setActiveNetId(cleanNet);
    }
  };

  // Create/Link a new Net directly to the selected component
  const handleCreateAndLinkNet = () => {
    if (!selectedCompRef) return;
    const targetName =
      newNetName.trim().toUpperCase().replace(/\s+/g, '_') || `NET_TRACE_${nets.length + 1}`;
    const comp = components.find((c) => c.refDes === selectedCompRef);
    const firstPin = comp?.pinSpecs?.[0]?.pinNumber || 1;
    handleUpdatePinNet(selectedCompRef, firstPin, targetName);
    setNewNetName('');
    setStatusMessage(`Linked ${selectedCompRef} Pin #${firstPin} to net [${targetName}]`);
  };

  // Auto-Route trace polyline between all components belonging to active net
  const handleAutoRouteNet = (netName: string) => {
    setNets((prev) =>
      prev.map((n) => {
        if (n.name !== netName) return n;
        const pts = n.connectedComponentRefs
          .map((ref) => components.find((c) => c.refDes === ref))
          .filter((c): c is DetailedPcbComponent => Boolean(c))
          .map((c) => getBoxCenter(c.bbox));
        return pts.length >= 2 ? { ...n, tracePoints: pts, isComplete: true } : n;
      })
    );
    setStatusMessage(`Auto-routed copper trace polyline for [${netName}]`);
  };

  // Technician Verification Action
  const verifyComponent = (refDes: string) => {
    setComponents((prev) =>
      prev.map((c) =>
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

  // Save Mapped PCB Overlay to Firestore
  const handleSavePcbToCloud = async () => {
    if (!user) {
      if (onOpenCloudModal) {
        onOpenCloudModal();
      } else {
        setStatusMessage('Sign in via Saved Benches to store PCB maps in Cloud Storage.');
      }
      return;
    }

    setIsSavingScan(true);
    try {
      await savePcbScan(user.uid, {
        title: boardTitle || 'Mapped ECU PCB Scan',
        boardType: boardType || 'Automotive ECU PCB',
        analysisSummary,
        model: analysisModel,
        components,
        nets,
        hotspots,
      });
      setStatusMessage(`SAVED TO CLOUD: "${boardTitle}" (${components.length} parts, ${hotspots.length} hotspots)`);
    } catch (err) {
      console.error('Failed to save PCB scan:', err);
      setStatusMessage('Cloud save failed — check verification status or network.');
    } finally {
      setIsSavingScan(false);
    }
  };

  // Load Saved PCB Scan Overlay from Firestore
  const handleLoadSavedScan = (scan: SavedPcbScan) => {
    setBoardTitle(scan.title);
    setBoardType(scan.boardType);
    setAnalysisSummary(scan.analysisSummary);
    setAnalysisModel(scan.model);
    setComponents(scan.components || []);
    setNets(scan.nets || []);
    setHotspots(scan.hotspots || []);
    setUploadedImageUrl(null);
    setBoardAspect(1.5);
    setSelectedCompRef(scan.components?.[0]?.refDes || null);
    setActiveNetId(scan.nets?.[0]?.name || null);
    setShowSavedScansPanel(false);
    setStatusMessage(`Loaded Cloud PCB Map: ${scan.title} (${scan.components?.length || 0} components)`);
  };

  const handleDeleteSavedScan = async (scanId: string) => {
    if (!user) return;
    try {
      await deletePcbScan(user.uid, scanId);
    } catch (err) {
      console.warn('Delete PCB scan failed:', err);
    }
  };

  // JSON Export / Backup
  const exportProjectJson = () => {
    const project = {
      boardName: boardTitle,
      boardType,
      analysisSummary,
      model: analysisModel,
      timestamp: new Date().toISOString(),
      components,
      nets,
      hotspots,
      source: 'AutoElectric Lab Pro PCB Inspection Engine',
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoelectric-pcb-${boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered components
  const filteredComponents = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return components.filter((c) => {
      const matchesSearch =
        c.refDes.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.marking.toLowerCase().includes(q) ||
        c.decodedValue.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filterMode === 'VERIFIED') return c.verificationStatus === 'VERIFIED';
      if (filterMode === 'UNVERIFIED') return c.verificationStatus === 'UNVERIFIED';
      return true;
    });
  }, [components, searchTerm, filterMode]);

  const selectedComponent = components.find((c) => c.refDes === selectedCompRef);

  const getNetColor = (netName: string): string => {
    if (netName.includes('5V') || netName.includes('REG')) return '#00f3ff';
    if (netName.includes('VBAT') || netName.includes('KL30')) return '#ef4444';
    if (netName.includes('GND')) return '#39ff14';
    if (netName.includes('HIGH') || netName.includes('CANH')) return '#ff6600';
    if (netName.includes('LOW') || netName.includes('CANL')) return '#a855f7';
    return '#f59e0b';
  };

  // Aspect-locked board dimensions so 0..1000 coordinates match photo pixels 1:1
  const boardWidthPx = Math.round(720 * zoomLevel);
  const boardHeightPx = Math.round((720 / Math.max(0.5, Math.min(2.2, boardAspect))) * zoomLevel);

  return (
    <div className="flex-1 flex flex-col hud-panel rounded-xl overflow-hidden text-slate-100 font-mono select-none">
      {/* Top Banner Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-cyan-500/15 p-2.5 hud-header text-xs gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
            alt="AutoElectric Lab Pro Official Logo"
            className="h-7 w-auto object-contain rounded border border-cyan-500/40 shadow-sm shrink-0"
          />
          <span className="text-sm font-hud font-bold text-slate-100 tracking-wider uppercase whitespace-nowrap">
            PCB Vision & Auto Track Mapper
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-[11px] text-cyan-300 truncate max-w-[340px] font-sans">
            {isAnalyzing ? 'Analyzing PCB...' : statusMessage}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Sample Presets */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">SAMPLES:</span>
            {SAMPLE_BOARDS.map((sb) => (
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

          {/* Add Manual Part */}
          <button
            onClick={handleAddManualComponent}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition"
            title="Add Manual Test Pad / Component"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Part</span>
          </button>

          {/* Local CV Re-Scan (when image uploaded) */}
          {uploadedImageUrl && (
            <button
              onClick={handleRerunLocalCv}
              disabled={isAnalyzing}
              className="flex items-center gap-1 px-2 py-1 bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-600/60 rounded transition disabled:opacity-50"
              title="Run Local CV Burn/Oxidation & Pad Cluster Scan"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Local CV</span>
            </button>
          )}

          {/* Save Cloud Map */}
          <button
            onClick={handleSavePcbToCloud}
            disabled={isSavingScan}
            className="flex items-center gap-1 px-2 py-1 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-600/60 rounded transition disabled:opacity-50"
            title="Save Mapped PCB Components, Nets & Hotspots to Firestore"
          >
            <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isSavingScan ? 'Saving...' : 'Save Cloud'}</span>
          </button>

          {/* Saved Maps Dropdown Toggle */}
          <button
            onClick={() => setShowSavedScansPanel((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-1 rounded border transition ${
              showSavedScansPanel
                ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Load Saved Cloud PCB Scans"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Saved ({savedScans.length})</span>
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

      {/* Collapsible Saved Cloud PCB Maps Bar */}
      {showSavedScansPanel && (
        <div className="bg-slate-950 border-b border-cyan-500/20 px-3 py-2 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-300 uppercase">
              Cloud Saved PCB Maps ({savedScans.length})
            </span>
            {!user && (
              <button
                onClick={() => onOpenCloudModal?.()}
                className="text-[11px] px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
              >
                Sign In to Sync Cloud Maps
              </button>
            )}
          </div>
          {savedScans.length === 0 ? (
            <div className="text-[11px] text-slate-400 font-sans">
              {user
                ? 'No saved PCB maps yet. Click "Save Cloud" after mapping a PCB.'
                : 'Sign in with Google via Saved Benches to access your private cloud PCB library.'}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {savedScans.map((scan) => (
                <div
                  key={scan.id}
                  className="min-w-[220px] max-w-[260px] bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2 shrink-0"
                >
                  <button
                    onClick={() => handleLoadSavedScan(scan)}
                    className="text-left min-w-0 flex-1 hover:text-cyan-300 transition"
                  >
                    <div className="font-bold text-slate-100 truncate">{scan.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {scan.components?.length || 0} parts · {scan.nets?.length || 0} nets ·{' '}
                      {scan.hotspots?.length || 0} hotspots
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteSavedScan(scan.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition shrink-0"
                    title="Delete Saved PCB Map"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile Segmented Control Switcher */}
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
          <span>Inspector ({components.length})</span>
        </button>
      </div>

      {/* Main Dual Workspace: Interactive PCB Canvas Left + Component Inspector Right */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left: Interactive Canvas */}
        <div
          className={`flex-1 relative hud-blueprint-grid border-r border-cyan-500/15 flex-col overflow-hidden ${
            mobileTab === 'CANVAS' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* HUD Layer & Tool Controls */}
          <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 hud-panel p-1 rounded-lg text-[11px] text-slate-300">
            <button
              onClick={() => setInteractionMode('EDIT')}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                interactionMode === 'EDIT' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Select, Drag & Resize Component Boxes"
            >
              <Move className="w-3 h-3" />
              <span>Edit Boxes</span>
            </button>

            <button
              onClick={() => {
                if (!uploadedImageUrl) {
                  setStatusMessage('Upload a PCB photo first to use zoomed Macro Crop re-scan.');
                  return;
                }
                setInteractionMode((m) => (m === 'MACRO_CROP' ? 'EDIT' : 'MACRO_CROP'));
                setCropMarquee(null);
              }}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                interactionMode === 'MACRO_CROP'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Drag a zoom box over any SMD cluster to re-scan IC markings"
            >
              <Crop className="w-3 h-3" />
              <span>Macro Crop</span>
            </button>

            <span className="text-slate-700">|</span>

            <button
              onClick={() => setShowComponents(!showComponents)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showComponents ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'
              }`}
            >
              {showComponents ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Parts</span>
            </button>
            <button
              onClick={() => setShowNets(!showNets)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showNets ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'
              }`}
            >
              {showNets ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Traces</span>
            </button>
            <button
              onClick={() => setShowHotspots(!showHotspots)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showHotspots ? 'bg-slate-800 text-rose-300 font-bold' : 'text-slate-500'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>Hotspots ({hotspots.length})</span>
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
            <button
              onClick={() => setShowThermalHeatmap(!showThermalHeatmap)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 transition ${
                showThermalHeatmap ? 'bg-rose-950 text-rose-300 font-bold border border-rose-500/60' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle Simulated Thermal Heatmap Gradient Overlay"
            >
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Thermal</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 hud-panel p-1 rounded-lg">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(0.6, +(prev - 0.15).toFixed(2)))}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] px-1.5 text-slate-300 tabular-nums">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(2.0, +(prev + 0.15).toFixed(2)))}
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

          {/* Aspect-Locked 0..1000 Normalized PCB Viewport */}
          <div className="flex-1 overflow-auto p-6 pt-14 flex items-center justify-center">
            <div
              ref={boardRef}
              onPointerDown={(e) => {
                if (interactionMode !== 'MACRO_CROP' || !boardRef.current) return;
                const rect = boardRef.current.getBoundingClientRect();
                const startXNorm = clampCoord(((e.clientX - rect.left) / Math.max(1, rect.width)) * 1000);
                const startYNorm = clampCoord(((e.clientY - rect.top) / Math.max(1, rect.height)) * 1000);
                dragRef.current = {
                  type: 'CROP',
                  startXNorm,
                  startYNorm,
                  boardRect: rect,
                };
                setCropMarquee({
                  xmin: startXNorm,
                  ymin: startYNorm,
                  xmax: startXNorm,
                  ymax: startYNorm,
                });
              }}
              style={{ width: `${boardWidthPx}px`, height: `${boardHeightPx}px` }}
              className={`relative shrink-0 bg-[#0c1815] border-4 border-[#16362e] rounded-xl shadow-2xl overflow-hidden select-none ${
                interactionMode === 'MACRO_CROP' ? 'cursor-crosshair' : ''
              }`}
            >
              {/* Scan Photo (exact aspect match -> 1:1 coordinate fidelity) or FR4 Board Vector */}
              {uploadedImageUrl ? (
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded PCB Scan Document"
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-fill opacity-90 pointer-events-none"
                />
              ) : (
                <svg
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  <rect width="1000" height="1000" fill="#0a1d18" />
                  <ellipse cx="500" cy="500" rx="340" ry="440" fill="#0d2b23" opacity="0.45" />
                  <path
                    d="M 55 80 L 945 80 L 945 920 L 55 920 Z"
                    fill="none"
                    stroke="#235c4d"
                    strokeWidth="2.5"
                    strokeDasharray="10,7"
                  />
                  <text x="80" y="145" fill="#448d79" fontSize="22" fontFamily="monospace" fontWeight="bold">
                    AUTOELECTRIC LAB // {boardTitle.toUpperCase()}
                  </text>
                  <text x="80" y="185" fill="#2d6d5d" fontSize="15" fontFamily="monospace">
                    TOP LAYER SILKSCREEN · 1oz COPPER · AEC-Q100 AUTOMOTIVE BENCH
                  </text>
                </svg>
              )}

              {/* Neon Copper Traces SVG Overlay (0..1000 normalized viewBox) */}
              {showNets && (
                <svg
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full z-10 pointer-events-none"
                >
                  {nets.map((net) => {
                    if (!net.tracePoints || net.tracePoints.length < 2) return null;
                    const isNetActive = effectiveNetId === net.name;
                    const neonColor = getNetColor(net.name);
                    const points = net.tracePoints.map((p) => `${p.x},${p.y}`).join(' ');

                    return (
                      <g
                        key={net.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNetId(net.name);
                          setStatusMessage(
                            `NET PATH: [${net.name}] -> ${net.connectedComponentRefs.join(', ') || 'Trace Node'}`
                          );
                        }}
                        className="cursor-pointer pointer-events-auto"
                      >
                        <polyline
                          points={points}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="26"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points={points}
                          fill="none"
                          stroke={isNetActive ? '#00f3ff' : neonColor}
                          strokeWidth={isNetActive ? '12' : '5'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={isNetActive ? '0.95' : '0.55'}
                          style={{
                            filter: isNetActive
                              ? 'drop-shadow(0 0 12px #00f3ff)'
                              : `drop-shadow(0 0 5px ${neonColor})`,
                          }}
                        />
                        <polyline
                          points={points}
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={isNetActive ? '3.5' : '1.5'}
                          strokeLinecap="round"
                          opacity={isNetActive ? '1' : '0.8'}
                        />
                        {showPinMarkers &&
                          net.tracePoints.map((p, idx) => (
                            <circle
                              key={idx}
                              cx={p.x}
                              cy={p.y}
                              r={isNetActive ? '9' : '5.5'}
                              fill={isNetActive ? '#00f3ff' : neonColor}
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          ))}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Fault Hotspots Layer (Burn / Oxidation / Thermal Zones) */}
              {showHotspots &&
                hotspots.map((hotspot) => {
                  const isSelectedHotspot = selectedHotspotId === hotspot.id;
                  const topPct = (hotspot.bbox.ymin / 1000) * 100;
                  const leftPct = (hotspot.bbox.xmin / 1000) * 100;
                  const widthPct = ((hotspot.bbox.xmax - hotspot.bbox.xmin) / 1000) * 100;
                  const heightPct = ((hotspot.bbox.ymax - hotspot.bbox.ymin) / 1000) * 100;

                  const tone =
                    hotspot.severity === 'CRITICAL'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                      : hotspot.severity === 'WARNING'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-cyan-400 bg-cyan-500/15 text-cyan-200';

                  return (
                    <div
                      key={hotspot.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHotspotId(hotspot.id);
                        if (hotspot.suspectComponentRef) {
                          setSelectedCompRef(hotspot.suspectComponentRef);
                        }
                        setStatusMessage(`HOTSPOT [${hotspot.severity}]: ${hotspot.label}`);
                      }}
                      style={{
                        top: `${topPct}%`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className={`absolute z-15 border-2 border-dashed rounded-md cursor-pointer transition ${tone} ${
                        isSelectedHotspot ? 'ring-2 ring-white shadow-lg z-25' : ''
                      }`}
                      title={`${hotspot.severity}: ${hotspot.label}`}
                    >
                      <span className="absolute -top-4 left-0 text-[8.5px] font-bold px-1 rounded bg-slate-950/90 border border-current whitespace-nowrap flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" />
                        {hotspot.severity}
                      </span>
                    </div>
                  );
                })}

              {/* Interactive Draggable & Resizable Component Bounding Boxes (0..1000 %) */}
              {showComponents &&
                components.map((comp) => {
                  const isSelected = selectedCompRef === comp.refDes;
                  const isVerified = comp.verificationStatus === 'VERIFIED';
                  const activeNetObj = nets.find((n) => n.name === effectiveNetId);
                  const isCompInActiveNet = effectiveNetId
                    ? comp.pinSpecs?.some((p) => p.connectedNetId === effectiveNetId) ||
                      activeNetObj?.connectedComponentRefs.includes(comp.refDes)
                    : false;

                  // Thermal intensity calculation
                  const isPowered = powerSupply?.isOutputEnabled ?? true;
                  const currentDraw = supplyCurrentDrawAmps || 0.5;
                  const isRegulator = comp.category.includes('REGULATOR') || comp.refDes.startsWith('U');
                  const isTvs = comp.category.includes('TVS') || comp.refDes.includes('TVS');
                  const hasFault = faults?.some((f) => comp.pinSpecs?.some((p) => p.connectedNetId?.includes(f.pinId) || f.pinId.includes(comp.refDes)));

                  let baseTemp = 32;
                  if (!isPowered) baseTemp = 25;
                  else if (hasFault) baseTemp = 120;
                  else if (isRegulator) baseTemp = 50 + currentDraw * 40;
                  else if (isTvs) baseTemp = 42 + currentDraw * 20;
                  else baseTemp = 34 + currentDraw * 12;

                  const tempC = Math.min(130, Math.max(25, Math.round(baseTemp)));

                  const topPct = (comp.bbox.ymin / 1000) * 100;
                  const leftPct = (comp.bbox.xmin / 1000) * 100;
                  const widthPct = ((comp.bbox.xmax - comp.bbox.xmin) / 1000) * 100;
                  const heightPct = ((comp.bbox.ymax - comp.bbox.ymin) / 1000) * 100;

                  const positionY = comp.bbox.ymin < 220 ? 'top-full mt-2' : 'bottom-full mb-2';
                  const positionX = comp.bbox.xmin > 580 ? 'right-0' : 'left-0';

                  return (
                    <div
                      key={comp.refDes}
                      tabIndex={0}
                      onMouseEnter={() => {
                        const firstNet = comp.pinSpecs?.[0]?.connectedNetId;
                        if (firstNet && firstNet !== 'NET_UNASSIGNED') {
                          setHoveredPinNetId(firstNet);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredPinNetId(null);
                      }}
                      onPointerDown={(e) => {
                        if (interactionMode !== 'EDIT' || !boardRef.current) return;
                        if ((e.target as HTMLElement).dataset.noDrag === 'true') return;
                        e.stopPropagation();
                        setSelectedCompRef(comp.refDes);
                        if (comp.pinSpecs?.[0]?.connectedNetId && comp.pinSpecs[0].connectedNetId !== 'NET_UNASSIGNED') {
                          setActiveNetId(comp.pinSpecs[0].connectedNetId);
                          setSelectedPinNumber(comp.pinSpecs[0].pinNumber);
                        }
                        dragRef.current = {
                          type: 'MOVE',
                          refDes: comp.refDes,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          origBox: { ...comp.bbox },
                          boardRect: boardRef.current.getBoundingClientRect(),
                        };
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedCompRef(comp.refDes);
                        }
                      }}
                      style={{
                        top: `${topPct}%`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      className={`group/comp absolute cursor-grab active:cursor-grabbing border-2 transition-shadow flex flex-col justify-between p-1 rounded-md focus:outline-none ${
                        showThermalHeatmap
                          ? tempC >= 105
                            ? 'border-rose-500 bg-rose-950/85 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.9)] animate-pulse z-20'
                            : tempC >= 80
                            ? 'border-amber-400 bg-amber-950/75 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.7)] z-20'
                            : tempC >= 55
                            ? 'border-orange-400 bg-orange-950/50 text-orange-200 z-20'
                            : 'border-blue-500 bg-blue-950/40 text-blue-200 z-20'
                          : isSelected
                          ? 'border-cyan-400 bg-cyan-950/75 shadow-2xl ring-2 ring-cyan-400/60 z-30'
                          : isCompInActiveNet
                          ? 'border-cyan-400 bg-cyan-950/80 shadow-[0_0_18px_rgba(0,243,255,0.6)] ring-1 ring-cyan-300 z-20'
                          : isVerified
                          ? 'border-emerald-500/80 bg-emerald-950/35 hover:border-emerald-400 z-10'
                          : 'border-amber-500/80 bg-amber-950/30 hover:border-amber-400 z-10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold leading-none gap-1">
                        <span
                          className={
                            showThermalHeatmap
                              ? tempC >= 105 ? 'text-rose-300 font-extrabold' : tempC >= 80 ? 'text-amber-300 font-extrabold' : 'text-blue-300 font-extrabold'
                              : isSelected || isCompInActiveNet
                              ? 'text-cyan-300 font-extrabold'
                              : isVerified
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                          }
                        >
                          {comp.refDes}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {showThermalHeatmap && (
                            <span className={`text-[8.5px] px-1 rounded font-bold border ${
                              tempC >= 105 ? 'bg-rose-950 text-rose-300 border-rose-500' : tempC >= 80 ? 'bg-amber-950 text-amber-300 border-amber-500' : 'bg-blue-950 text-blue-300 border-blue-500'
                            }`}>
                              {tempC}°C
                            </span>
                          )}
                          {!showThermalHeatmap && isCompInActiveNet && (
                            <span className="text-[7px] bg-cyan-400 text-black px-1 rounded font-extrabold">
                              NET
                            </span>
                          )}
                          {isVerified ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <span className="text-[7.5px] text-amber-300 bg-amber-950/90 px-1 rounded border border-amber-700">
                              {comp.source === 'LOCAL_CV' ? 'CV' : 'AI'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[9px] font-mono truncate text-slate-100 font-semibold leading-tight">
                        {comp.marking || comp.category}
                      </div>

                      {/* Component Pin Nodes */}
                      {comp.pinSpecs && comp.pinSpecs.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap pt-0.5 border-t border-slate-800/70">
                          {comp.pinSpecs.slice(0, 8).map((pin) => {
                            const isPinSelected =
                              selectedPinNumber === pin.pinNumber && selectedCompRef === comp.refDes;
                            const isPinNetActive = effectiveNetId === pin.connectedNetId;
                            return (
                              <button
                                key={pin.pinNumber}
                                data-no-drag="true"
                                onMouseEnter={() => {
                                  if (pin.connectedNetId && pin.connectedNetId !== 'NET_UNASSIGNED') {
                                    setHoveredPinNetId(pin.connectedNetId);
                                  }
                                }}
                                onMouseLeave={() => {
                                  setHoveredPinNetId(null);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCompRef(comp.refDes);
                                  setSelectedPinNumber(pin.pinNumber);
                                  setActiveNetId(pin.connectedNetId);
                                  const connectedNet = nets.find((n) => n.name === pin.connectedNetId);
                                  const nodes = connectedNet
                                    ? connectedNet.connectedComponentRefs.join(', ')
                                    : comp.refDes;
                                  setStatusMessage(
                                    `PIN #${pin.pinNumber} (${pin.pinName}) · Net [${pin.connectedNetId}] -> ${nodes}`
                                  );
                                }}
                                title={`Pin #${pin.pinNumber} (${pin.pinName}) -> ${pin.connectedNetId}`}
                                className={`px-1 rounded text-[7.5px] font-mono font-bold transition flex items-center ${
                                  isPinSelected
                                    ? 'bg-cyan-300 text-black ring-1 ring-white font-extrabold'
                                    : isPinNetActive
                                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.5)]'
                                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-700'
                                }`}
                              >
                                #{pin.pinNumber}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Corner Resize Handle */}
                      {interactionMode === 'EDIT' && (
                        <div
                          data-no-drag="true"
                          onPointerDown={(e) => {
                            if (!boardRef.current) return;
                            e.stopPropagation();
                            setSelectedCompRef(comp.refDes);
                            dragRef.current = {
                              type: 'RESIZE',
                              refDes: comp.refDes,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              origBox: { ...comp.bbox },
                              boardRect: boardRef.current.getBoundingClientRect(),
                            };
                          }}
                          title="Drag to resize bounding box"
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-cyan-400 border border-slate-950 rounded-sm cursor-nwse-resize opacity-80 hover:opacity-100"
                        />
                      )}

                      {/* Hover Contextual Spec Tooltip */}
                      <div
                        className={`opacity-0 group-hover/comp:opacity-100 pointer-events-none absolute ${positionY} ${positionX} w-64 bg-slate-950/95 backdrop-blur-md border border-cyan-500/70 text-slate-100 p-2.5 rounded-lg shadow-2xl z-40 transition-opacity duration-150 font-mono`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-cyan-300 text-xs">{comp.refDes}</strong>
                            <span className="text-[10px] text-slate-400 font-sans truncate max-w-[110px]">
                              {comp.category.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-[9px] px-1.5 rounded font-bold bg-slate-900 border border-slate-700 text-cyan-300 tabular-nums">
                            {Math.round((comp.confidenceScore || 0.8) * 100)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                          <div>
                            <span className="text-slate-500 text-[8.5px] block font-sans">Package</span>
                            <span className="font-semibold text-slate-100 truncate block">{comp.packageType || 'SMD'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8.5px] block font-sans">Voltage</span>
                            <span className="font-semibold text-cyan-300 truncate block">
                              {comp.operatingVoltageRange || '5V DC'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8.5px] block font-sans">Marking</span>
                            <span className="font-semibold text-amber-300 truncate block">
                              {comp.marking || comp.decodedValue || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[8.5px] block font-sans">Max Current</span>
                            <span className="font-semibold text-emerald-300 truncate block">
                              {comp.maxCurrentRating || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Thermal Heatmap Legend Bar */}
              {showThermalHeatmap && (
                <div className="absolute bottom-3 left-3 z-30 bg-slate-950/90 backdrop-blur-md border border-rose-500/60 rounded-xl p-2.5 text-[10px] font-mono text-slate-100 shadow-2xl flex items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold text-rose-300">
                    <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span>THERMAL HEATMAP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 25°C</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 60°C</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 85°C</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 110°C+</span>
                  </div>
                </div>
              )}

              {/* Macro Crop Drag Selection Marquee */}
              {cropMarquee && (
                <div
                  style={{
                    top: `${(cropMarquee.ymin / 1000) * 100}%`,
                    left: `${(cropMarquee.xmin / 1000) * 100}%`,
                    width: `${((cropMarquee.xmax - cropMarquee.xmin) / 1000) * 100}%`,
                    height: `${((cropMarquee.ymax - cropMarquee.ymin) / 1000) * 100}%`,
                  }}
                  className="absolute z-40 border-2 border-dashed border-amber-400 bg-amber-400/15 pointer-events-none"
                >
                  <span className="absolute -top-5 left-0 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 rounded">
                    MACRO CROP SCAN AREA
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Inspection, Editor, Hotspots & Ecosystem Integrations Drawer */}
        <aside
          className={`w-full md:w-[410px] bg-slate-900 p-3 flex-col gap-3 overflow-y-auto text-xs font-mono border-t md:border-t-0 md:border-l border-slate-800 shrink-0 ${
            mobileTab === 'DRAWER' ? 'flex' : 'hidden md:flex'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> INSPECTOR & NET MAPPER
            </span>
            <span className="text-[10px] text-slate-400 font-bold tabular-nums">
              {components.length} Parts · {nets.length} Nets
            </span>
          </div>

          {/* Selected Component Datasheet + Inline Editor + Ecosystem Actions */}
          {selectedComponent ? (
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col gap-2.5 shadow-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg font-bold text-cyan-300">{selectedComponent.refDes}</span>
                  <span className="text-[11px] text-slate-400 font-sans truncate">
                    ({selectedComponent.category})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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

              {/* Editable Component Specs */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-sans">
                <div>
                  <label className="text-slate-500 block text-[9px] font-mono uppercase">Marking Code</label>
                  <input
                    type="text"
                    value={selectedComponent.marking}
                    onChange={(e) =>
                      updateSelectedComponentField(selectedComponent.refDes, { marking: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-[9px] font-mono uppercase">Package</label>
                  <input
                    type="text"
                    value={selectedComponent.packageType}
                    onChange={(e) =>
                      updateSelectedComponentField(selectedComponent.refDes, { packageType: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-[9px] font-mono uppercase">Operating V</label>
                  <input
                    type="text"
                    value={selectedComponent.operatingVoltageRange || ''}
                    onChange={(e) =>
                      updateSelectedComponentField(selectedComponent.refDes, {
                        operatingVoltageRange: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-cyan-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block text-[9px] font-mono uppercase">Decoded Value</label>
                  <input
                    type="text"
                    value={selectedComponent.decodedValue}
                    onChange={(e) =>
                      updateSelectedComponentField(selectedComponent.refDes, {
                        decodedValue: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-amber-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Ecosystem Action Buttons: Google Grounding & Offline Bot */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    onOpenGroundedSearch?.(
                      `${selectedComponent.marking || selectedComponent.decodedValue} ${selectedComponent.category} automotive ECU datasheet pinout`,
                      '',
                      selectedComponent.marking || selectedComponent.refDes
                    )
                  }
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-semibold text-[11px] transition"
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Lookup IC / TSB</span>
                </button>
                <button
                  onClick={() =>
                    onOpenOfflineBot?.(
                      `Analyze ECU PCB component ${selectedComponent.refDes} (${selectedComponent.marking || selectedComponent.decodedValue}, ${selectedComponent.category}). Function: ${selectedComponent.circuitFunction}. What failure modes and multimeter checks apply?`
                    )
                  }
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 font-semibold text-[11px] transition"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ask Offline Bot</span>
                </button>
              </div>

              {selectedComponent.datasheetSummary && (
                <div className="text-[10.5px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 font-sans leading-relaxed">
                  <span className="text-[9px] text-cyan-400 uppercase font-mono font-bold block mb-0.5">
                    Datasheet / CV Notes:
                  </span>
                  {selectedComponent.datasheetSummary}
                </div>
              )}

              {/* Editable Pinout & Net Assignment Table */}
              {selectedComponent.pinSpecs && selectedComponent.pinSpecs.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">
                    PINOUT & NET EDITOR ({selectedComponent.pinSpecs.length} PINS)
                  </span>
                  <div className="border border-slate-800 rounded-lg overflow-hidden text-[10px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900 text-slate-400 font-mono text-[9px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="p-1.5">Pin</th>
                          <th className="p-1.5">Name</th>
                          <th className="p-1.5">V</th>
                          <th className="p-1.5">Net ID (Editable)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selectedComponent.pinSpecs.map((pin) => {
                          const isPinSelected =
                            selectedPinNumber === pin.pinNumber &&
                            selectedCompRef === selectedComponent.refDes;
                          return (
                            <tr
                              key={pin.pinNumber}
                              onClick={() => {
                                setSelectedPinNumber(pin.pinNumber);
                                setActiveNetId(pin.connectedNetId);
                              }}
                              className={`cursor-pointer transition ${
                                isPinSelected ? 'bg-cyan-950 text-cyan-200' : 'hover:bg-slate-900/60 text-slate-300'
                              }`}
                            >
                              <td className="p-1 font-bold text-cyan-400">#{pin.pinNumber}</td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={pin.pinName}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    handleUpdatePinNet(
                                      selectedComponent.refDes,
                                      pin.pinNumber,
                                      pin.connectedNetId,
                                      e.target.value
                                    )
                                  }
                                  className="w-16 bg-transparent border-b border-slate-800 focus:border-cyan-500 text-slate-200 focus:outline-none"
                                />
                              </td>
                              <td className="p-1 text-amber-300 tabular-nums">
                                {pin.nominalVoltage.toFixed(1)}V
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={pin.connectedNetId}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    handleUpdatePinNet(
                                      selectedComponent.refDes,
                                      pin.pinNumber,
                                      e.target.value
                                    )
                                  }
                                  className="w-full bg-slate-900/90 border border-slate-800 rounded px-1 py-0.5 text-cyan-300 focus:outline-none focus:border-cyan-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Quick Link Component to New or Existing Net */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="New net e.g. NET_5V_REF"
                      value={newNetName}
                      onChange={(e) => setNewNetName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleCreateAndLinkNet}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-700 text-white text-[10px] font-semibold"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>Link Net</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Technician Sign-Off Button */}
              <button
                onClick={() => verifyComponent(selectedComponent.refDes)}
                className={`mt-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
                  selectedComponent.verificationStatus === 'VERIFIED'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {selectedComponent.verificationStatus === 'VERIFIED'
                    ? 'Revoke Sign-off'
                    : 'Technician Sign-Off & Verify'}
                </span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 text-center text-xs font-sans">
              Click any component box, hotspot, or copper trace on the board to inspect and edit.
            </div>
          )}

          {/* Fault Hotspots Section */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
            <span className="text-[10px] text-rose-300 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              FAULT HOTSPOTS ({hotspots.length})
            </span>
            {hotspots.length === 0 ? (
              <div className="text-[10.5px] text-slate-500 font-sans px-2 py-1.5 bg-slate-950 rounded-lg border border-slate-800">
                No thermal scorch or oxidation hotspots flagged.
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                {hotspots.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => {
                      setSelectedHotspotId(h.id);
                      if (h.suspectComponentRef) setSelectedCompRef(h.suspectComponentRef);
                    }}
                    className={`p-2 rounded-lg border cursor-pointer transition text-[10.5px] ${
                      selectedHotspotId === h.id
                        ? 'bg-rose-950/60 border-rose-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span className="truncate">{h.label}</span>
                      <span
                        className={`text-[9px] px-1.5 rounded ${
                          h.severity === 'CRITICAL'
                            ? 'bg-rose-900 text-rose-200'
                            : h.severity === 'WARNING'
                            ? 'bg-amber-900 text-amber-200'
                            : 'bg-cyan-900 text-cyan-200'
                        }`}
                      >
                        {h.severity}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-snug">{h.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connected Copper Traces Net Registry */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              COPPER TRACE NETS ({nets.length}):
            </span>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {nets.map((net) => {
                const isSelected = activeNetId === net.name;
                const color = getNetColor(net.name);
                return (
                  <div
                    key={net.name}
                    onClick={() => setActiveNetId(net.name)}
                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition text-[11px] ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-400 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{net.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-slate-400 tabular-nums">
                        {net.connectedComponentRefs.length} Nodes
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAutoRouteNet(net.name);
                        }}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
                        title="Rebuild trace line across linked components"
                      >
                        Route
                      </button>
                    </div>
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
                  className={`px-1.5 py-0.5 rounded ${
                    filterMode === 'ALL' ? 'bg-slate-800 text-cyan-300 font-bold' : 'text-slate-500'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterMode('VERIFIED')}
                  className={`px-1.5 py-0.5 rounded ${
                    filterMode === 'VERIFIED' ? 'bg-emerald-950 text-emerald-300 font-bold' : 'text-slate-500'
                  }`}
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
              {filteredComponents.map((comp) => (
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
                    {comp.verificationStatus === 'VERIFIED'
                      ? 'VERIFIED'
                      : comp.source === 'LOCAL_CV'
                      ? 'CV'
                      : 'AI'}
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
