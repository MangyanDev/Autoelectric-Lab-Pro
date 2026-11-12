export type PinCategory = 'power' | 'ground' | 'sensor_in' | 'actuator_out' | 'communication' | 'reference';

export interface EcuPin {
  id: string;
  pinNumber: number;
  label: string;
  name: string;
  category: PinCategory;
  nominalVoltage: number; // e.g. 12.0, 5.0, 0.0, 2.5
  internalResistance: number; // ohms
  description: string;
  isEnergized?: boolean;
}

export type FaultType = 'NONE' | 'OPEN_CIRCUIT' | 'SHORT_TO_GND' | 'SHORT_TO_VBAT' | 'HIGH_RESISTANCE_50R' | 'HIGH_RESISTANCE_250R' | 'HIGH_RESISTANCE_1K';

export interface InjectedFault {
  pinId: string;
  faultType: FaultType;
  description: string;
  timestamp: number;
}

export interface WireConnection {
  id: string;
  sourcePinId: string; // e.g. "ecu-p3" or "sensor-tps-1"
  targetPinId: string;
  color: string;
  label: string;
  isCut: boolean;
  resistance: number; // default 0.05 ohms
}

export interface BenchComponent {
  id: string;
  name: string;
  type: 'sensor' | 'actuator' | 'relay' | 'bus_node';
  x: number;
  y: number;
  pins: {
    id: string;
    label: string;
    type: 'input' | 'output' | 'power' | 'ground';
    relativeX: number;
    relativeY: number;
    nominalVoltage?: number;
  }[];
  state?: Record<string, number | boolean | string>;
  notes?: string;
}

export type MultimeterMode = 'V_DC' | 'V_AC' | 'RESISTANCE' | 'CONTINUITY' | 'FREQUENCY' | 'DIODE';

export interface MultimeterProbe {
  attachedToPinId: string | null; // e.g. 'ecu-1', 'chassis-gnd', 'tps-signal'
  attachedLabel: string;
}

export interface MultimeterState {
  mode: MultimeterMode;
  redProbe: MultimeterProbe;
  blackProbe: MultimeterProbe;
  isPowered: boolean;
  rangeAuto: boolean;
  holdValue: boolean;
}

export interface PowerSupplyState {
  voltageSetting: number; // 0 - 30V
  currentLimit: number; // 0.1 - 10A
  isOutputEnabled: boolean;
  preset: '12V_BENCH' | '14.4V_RUNNING' | '10.2V_CRANKING' | '5V_LOGIC' | 'CUSTOM';
}

export interface DiagnosticTroubleCode {
  code: string;
  system: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'ACTIVE' | 'PENDING' | 'RESOLVED';
  associatedPinIds: string[];
}
