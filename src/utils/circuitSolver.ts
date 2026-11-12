import {
  EcuPin,
  InjectedFault,
  WireConnection,
  BenchComponent,
  MultimeterState,
  PowerSupplyState,
  DiagnosticTroubleCode,
} from '../types/ecu';
import { CircuitNetwork } from '../simulation/electrical/CircuitNetwork';
import { AutomotiveModels } from '../simulation/components/AutomotiveModels';
import { FaultManager } from '../simulation/faults/FaultManager';

export const DEFAULT_ECU_PINS: EcuPin[] = [
  { id: 'ecu-pin-1', pinNumber: 1, label: 'KL31', name: 'Power Ground 1', category: 'ground', nominalVoltage: 0.0, internalResistance: 0.08, description: 'Chassis/Engine Ground Return' },
  { id: 'ecu-pin-2', pinNumber: 2, label: 'KL31_2', name: 'Power Ground 2', category: 'ground', nominalVoltage: 0.0, internalResistance: 0.08, description: 'Power Ground Secondary' },
  { id: 'ecu-pin-3', pinNumber: 3, label: 'KL30', name: 'Battery Constant +12V', category: 'power', nominalVoltage: 12.6, internalResistance: 0.2, description: 'Unswitched Battery Supply (+30)' },
  { id: 'ecu-pin-4', pinNumber: 4, label: 'KL15', name: 'Ignition Switch Input', category: 'power', nominalVoltage: 12.6, internalResistance: 1200, description: 'Switched Terminal 15 (+15)' },
  { id: 'ecu-pin-5', pinNumber: 5, label: 'VREF_5V', name: 'Sensor 5V Reference', category: 'reference', nominalVoltage: 5.0, internalResistance: 8.5, description: 'Regulated 5.00V Supply (Max 150mA)' },
  { id: 'ecu-pin-6', pinNumber: 6, label: 'SGND', name: 'Sensor Clean Ground', category: 'ground', nominalVoltage: 0.0, internalResistance: 0.35, description: 'Analog Ground Reference' },
  { id: 'ecu-pin-7', pinNumber: 7, label: 'TPS_SIG', name: 'Throttle Position Signal', category: 'sensor_in', nominalVoltage: 0.85, internalResistance: 47000, description: 'Analog ADC input 0.5V - 4.5V' },
  { id: 'ecu-pin-8', pinNumber: 8, label: 'MAP_SIG', name: 'Manifold Pressure Signal', category: 'sensor_in', nominalVoltage: 1.45, internalResistance: 47000, description: 'Pressure Transducer Input' },
  { id: 'ecu-pin-9', pinNumber: 9, label: 'ECT_SIG', name: 'Coolant Temp Signal', category: 'sensor_in', nominalVoltage: 1.95, internalResistance: 2200, description: 'Internal Pull-Up 2.2kΩ to 5V' },
  { id: 'ecu-pin-10', pinNumber: 10, label: 'INJ_1', name: 'Injector 1 Driver', category: 'actuator_out', nominalVoltage: 12.6, internalResistance: 0.15, description: 'Low-Side MOSFET Sink to GND' },
  { id: 'ecu-pin-11', pinNumber: 11, label: 'IGN_1', name: 'Ignition Coil 1 Trigger', category: 'actuator_out', nominalVoltage: 0.0, internalResistance: 100, description: '5V Logic Trigger / Smart Coil' },
  { id: 'ecu-pin-12', pinNumber: 12, label: 'MRELAY', name: 'Main Relay Control', category: 'actuator_out', nominalVoltage: 12.6, internalResistance: 0.2, description: 'Low-side Relay Pull-Down' },
  { id: 'ecu-pin-13', pinNumber: 13, label: 'CAN_H', name: 'High-Speed CAN High', category: 'communication', nominalVoltage: 2.5, internalResistance: 60, description: 'Recessive 2.5V, Dominant 3.5V' },
  { id: 'ecu-pin-14', pinNumber: 14, label: 'CAN_L', name: 'High-Speed CAN Low', category: 'communication', nominalVoltage: 2.5, internalResistance: 60, description: 'Recessive 2.5V, Dominant 1.5V' },
  { id: 'ecu-pin-15', pinNumber: 15, label: 'O2_SIG', name: 'Oxygen Sensor 1 Bank 1', category: 'sensor_in', nominalVoltage: 0.45, internalResistance: 100000, description: 'Zirconia Nernst Cell 0.1V - 0.9V' },
  { id: 'ecu-pin-16', pinNumber: 16, label: 'FP_RELAY', name: 'Fuel Pump Relay Driver', category: 'actuator_out', nominalVoltage: 12.6, internalResistance: 0.2, description: 'Low-Side Ground Switched' },
];

export const DEFAULT_BENCH_COMPONENTS: BenchComponent[] = [
  {
    id: 'comp-tps',
    name: 'Throttle Position Sensor (TPS)',
    type: 'sensor',
    x: 480,
    y: 60,
    pins: [
      { id: 'tps-vcc', label: '5V VCC', type: 'power', relativeX: 0, relativeY: 46 },
      { id: 'tps-sig', label: 'WIPER SIG', type: 'output', relativeX: 0, relativeY: 78 },
      { id: 'tps-gnd', label: 'GND', type: 'ground', relativeX: 0, relativeY: 110 },
    ],
    state: { throttleAnglePercent: 20 },
  },
  {
    id: 'comp-map',
    name: 'Manifold Pressure (MAP)',
    type: 'sensor',
    x: 480,
    y: 220,
    pins: [
      { id: 'map-vcc', label: '5V VCC', type: 'power', relativeX: 0, relativeY: 46 },
      { id: 'map-sig', label: 'PRESSURE SIG', type: 'output', relativeX: 0, relativeY: 78 },
      { id: 'map-gnd', label: 'GND', type: 'ground', relativeX: 0, relativeY: 110 },
    ],
    state: { pressureKpa: 42 },
  },
  {
    id: 'comp-ect',
    name: 'Coolant Temp Sensor (ECT)',
    type: 'sensor',
    x: 480,
    y: 380,
    pins: [
      { id: 'ect-sig', label: 'THERMISTOR +', type: 'input', relativeX: 0, relativeY: 46 },
      { id: 'ect-gnd', label: 'GND RETURN', type: 'ground', relativeX: 0, relativeY: 78 },
    ],
    state: { tempCelsius: 85 },
  },
  {
    id: 'comp-inj',
    name: 'Cylinder 1 Fuel Injector',
    type: 'actuator',
    x: 770,
    y: 60,
    pins: [
      { id: 'inj-vbat', label: '+12V BATTERY', type: 'power', relativeX: 0, relativeY: 46 },
      { id: 'inj-ctrl', label: 'ECU SINK CTRL', type: 'input', relativeX: 0, relativeY: 78 },
    ],
    state: { coilResistanceOhms: 12.5, isFiring: true },
  },
  {
    id: 'comp-relay',
    name: 'Main System Relay (ISO)',
    type: 'relay',
    x: 770,
    y: 210,
    pins: [
      { id: 'relay-30', label: 'PIN 30 (+12V IN)', type: 'power', relativeX: 0, relativeY: 46 },
      { id: 'relay-87', label: 'PIN 87 (LOAD OUT)', type: 'output', relativeX: 0, relativeY: 78 },
      { id: 'relay-86', label: 'PIN 86 (COIL +)', type: 'power', relativeX: 0, relativeY: 110 },
      { id: 'relay-85', label: 'PIN 85 (COIL -)', type: 'input', relativeX: 0, relativeY: 142 },
    ],
    state: { isLatched: true, coilResistanceOhms: 85 },
  },
  {
    id: 'comp-can',
    name: 'CAN Bus Terminator (120Ω)',
    type: 'bus_node',
    x: 770,
    y: 400,
    pins: [
      { id: 'can-term-h', label: 'CAN-H TERMINAL', type: 'input', relativeX: 0, relativeY: 46 },
      { id: 'can-term-l', label: 'CAN-L TERMINAL', type: 'input', relativeX: 0, relativeY: 78 },
    ],
    state: { terminatingResistanceOhms: 120 },
  },
];

export const DEFAULT_WIRES: WireConnection[] = [
  { id: 'wire-1', sourcePinId: 'ecu-pin-5', targetPinId: 'tps-vcc', color: '#eab308', label: '5V VREF -> TPS VCC', isCut: false, resistance: 0.05 },
  { id: 'wire-2', sourcePinId: 'ecu-pin-7', targetPinId: 'tps-sig', color: '#22c55e', label: 'TPS SIG -> ECU Pin 7', isCut: false, resistance: 0.05 },
  { id: 'wire-3', sourcePinId: 'ecu-pin-6', targetPinId: 'tps-gnd', color: '#78716c', label: 'TPS GND -> ECU SGND', isCut: false, resistance: 0.05 },

  { id: 'wire-4', sourcePinId: 'ecu-pin-5', targetPinId: 'map-vcc', color: '#eab308', label: '5V VREF -> MAP VCC', isCut: false, resistance: 0.05 },
  { id: 'wire-5', sourcePinId: 'ecu-pin-8', targetPinId: 'map-sig', color: '#06b6d4', label: 'MAP SIG -> ECU Pin 8', isCut: false, resistance: 0.05 },
  { id: 'wire-6', sourcePinId: 'ecu-pin-6', targetPinId: 'map-gnd', color: '#78716c', label: 'MAP GND -> ECU SGND', isCut: false, resistance: 0.05 },

  { id: 'wire-7', sourcePinId: 'ecu-pin-9', targetPinId: 'ect-sig', color: '#f97316', label: 'ECT SIG -> ECU Pin 9', isCut: false, resistance: 0.05 },
  { id: 'wire-8', sourcePinId: 'ecu-pin-6', targetPinId: 'ect-gnd', color: '#78716c', label: 'ECT GND -> ECU SGND', isCut: false, resistance: 0.05 },

  { id: 'wire-9', sourcePinId: 'ecu-pin-10', targetPinId: 'inj-ctrl', color: '#3b82f6', label: 'ECU INJ1 -> Injector Sink', isCut: false, resistance: 0.05 },

  { id: 'wire-10', sourcePinId: 'ecu-pin-13', targetPinId: 'can-term-h', color: '#6366f1', label: 'CAN_H -> Bus Terminator', isCut: false, resistance: 0.05 },
  { id: 'wire-11', sourcePinId: 'ecu-pin-14', targetPinId: 'can-term-l', color: '#a855f7', label: 'CAN_L -> Bus Terminator', isCut: false, resistance: 0.05 },
];

export interface CircuitSolution {
  nodeVoltages: Record<string, number>;
  nodeResistances: Record<string, number>;
  wireCurrentsMa: Record<string, number>;
  supplyCurrentDrawAmps: number;
  isSupplyCurrentTripped: boolean;
  activeDTCs: DiagnosticTroubleCode[];
  multimeterReading: {
    display: string;
    value: number;
    unit: string;
    isOverLimit: boolean;
    isWarning: boolean;
    warningMessage?: string;
    shouldBeep: boolean;
  };
}

/**
 * solveCircuit: Solves the entire physical electrical lab using Modified Nodal Analysis (MNA).
 */
export function solveCircuit(
  powerSupply: PowerSupplyState,
  pins: EcuPin[],
  faults: InjectedFault[],
  wires: WireConnection[],
  components: BenchComponent[],
  multimeter: MultimeterState
): CircuitSolution {
  const net = new CircuitNetwork();

  const isPowerOn = powerSupply.isOutputEnabled && powerSupply.voltageSetting > 0.4;
  const vSupply = isPowerOn ? powerSupply.voltageSetting : 0.0;

  // 1. Stamp Laboratory Power Supply
  if (isPowerOn) {
    net.addVoltageSource('bench-vsource', 'bench-vbat', 'chassis-gnd', vSupply, 0.02);
  } else {
    net.addResistor('bench-off-bleed', 'bench-vbat', 'chassis-gnd', 1e6);
  }

  // 2. Stamp ECU Ground & Power Rails
  // Pin 1 & Pin 2: Ground returns to Chassis Ground
  net.addResistor('ecu-gnd-1', 'ecu-pin-1', 'chassis-gnd', 0.08);
  net.addResistor('ecu-gnd-2', 'ecu-pin-2', 'chassis-gnd', 0.08);

  // Pin 3 (KL30) & Pin 4 (KL15): Internal ECU quiescent load
  net.addResistor('ecu-kl30-load', 'ecu-pin-3', 'chassis-gnd', 1200);
  net.addResistor('ecu-kl15-load', 'ecu-pin-4', 'chassis-gnd', 1200);

  // Pin 6: Sensor clean ground plane
  net.addResistor('ecu-sgnd-plane', 'ecu-pin-6', 'chassis-gnd', 0.35);

  // Pin 5: Regulated +5.00V Sensor Reference Supply Rail (Internal LDO)
  if (isPowerOn && vSupply >= 6.5) {
    net.addVoltageSource('ecu-vref-ldo', 'ecu-pin-5', 'chassis-gnd', 5.0, 8.5);
  } else if (isPowerOn && vSupply > 1.5) {
    // Dropout mode
    net.addVoltageSource('ecu-vref-ldo', 'ecu-pin-5', 'chassis-gnd', Math.max(0, vSupply - 1.2), 8.5);
  } else {
    net.addResistor('ecu-vref-off', 'ecu-pin-5', 'chassis-gnd', 4700);
  }

  // Pin 9 (ECT ADC input with internal 2.2kΩ pull-up to +5V VREF)
  net.addResistor('ecu-ect-pullup', 'ecu-pin-5', 'ecu-pin-9', 2200);

  // Pin 7 & Pin 8 (ADC input buffers with 47kΩ internal impedance)
  net.addResistor('ecu-tps-adc', 'ecu-pin-7', 'chassis-gnd', 47000);
  net.addResistor('ecu-map-adc', 'ecu-pin-8', 'chassis-gnd', 47000);

  // Pin 13 & Pin 14: ECU High-Speed CAN Bus termination (120Ω between CAN-H and CAN-L)
  net.addResistor('ecu-can-termination', 'ecu-pin-13', 'ecu-pin-14', 120.0);
  // CAN Transceiver recessive biasing to 2.5V
  if (isPowerOn) {
    net.addVoltageSource('can-h-bias', 'ecu-pin-13', 'chassis-gnd', 2.5, 60.0);
    net.addVoltageSource('can-l-bias', 'ecu-pin-14', 'chassis-gnd', 2.5, 60.0);
  }

  // 3. Stamp Components into Network
  const tpsComp = components.find(c => c.id === 'comp-tps');
  const angle = (tpsComp?.state?.throttleAnglePercent as number) ?? 20;
  const tpsModel = AutomotiveModels.calculateTps(angle, 5.0);
  net.addResistor('tps-upper', 'tps-vcc', 'tps-sig', tpsModel.rUpper);
  net.addResistor('tps-lower', 'tps-sig', 'tps-gnd', tpsModel.rLower);

  const ectComp = components.find(c => c.id === 'comp-ect');
  const temp = (ectComp?.state?.tempCelsius as number) ?? 85;
  const ectModel = AutomotiveModels.calculateEct(temp, 5.0);
  net.addResistor('ect-ntc', 'ect-sig', 'ect-gnd', ectModel.resistanceOhms);

  const mapComp = components.find(c => c.id === 'comp-map');
  const kpa = (mapComp?.state?.pressureKpa as number) ?? 42;
  const mapModel = AutomotiveModels.calculateMap(kpa, 5.0);
  // Model MAP sensor as thevenin equivalent output
  net.addVoltageSource('map-transducer', 'map-sig', 'map-gnd', isPowerOn ? mapModel.voltage : 0.0, 150);
  net.addResistor('map-vcc-load', 'map-vcc', 'map-gnd', 3500);

  // Injector Solenoid
  net.addResistor('inj-coil', 'inj-vbat', 'inj-ctrl', 12.5);
  // Injector low-side driver sink (switches to ground when ECU pulses)
  if (isPowerOn) {
    net.addResistor('inj-lowside-driver', 'ecu-pin-10', 'chassis-gnd', 0.15);
  }

  // Main System Relay
  net.addResistor('relay-coil', 'relay-86', 'relay-85', 85.0);
  net.addResistor('relay-contacts', 'relay-30', 'relay-87', 0.05);

  // Cluster CAN Terminator (120Ω)
  net.addResistor('cluster-can-term', 'can-term-h', 'can-term-l', 120.0);

  // 4. Stamp Harness Wires
  for (const wire of wires) {
    if (!wire.isCut) {
      net.addResistor(`wire-${wire.id}`, wire.sourcePinId, wire.targetPinId, wire.resistance || 0.05);
    } else {
      // Cut wire creates open circuit ($10^9\,\Omega$)
      net.addResistor(`wire-${wire.id}`, wire.sourcePinId, wire.targetPinId, 1e9);
    }
  }

  // 5. Apply Faults via Topological FaultManager
  FaultManager.applyFaults(net, faults);

  // 6. Solve Network using MNA
  const solution = net.solve();
  const nodeVoltages = solution.nodeVoltages;
  const wireCurrentsMa: Record<string, number> = {};

  for (const wire of wires) {
    const iA = Math.abs(solution.branchCurrentsAmps[`wire-${wire.id}`] || 0);
    wireCurrentsMa[wire.id] = iA * 1000.0;
  }

  // Check Power Supply Current Limit Trip
  const supplyCurrentDraw = solution.sourceCurrentDrawAmps;
  const isSupplyCurrentTripped = isPowerOn && supplyCurrentDraw > powerSupply.currentLimit;

  // Compute Node Resistances for UI
  const nodeResistances: Record<string, number> = {};
  for (const p of pins) {
    nodeResistances[p.id] = p.internalResistance;
  }

  // 7. Calculate Real Multimeter Measurement
  const redNode = multimeter.redProbe.attachedToPinId?.toLowerCase() || null;
  const blackNode = multimeter.blackProbe.attachedToPinId?.toLowerCase() || null;

  let dmmDisplay = '0.00';
  let dmmVal = 0.0;
  let dmmUnit = 'V';
  let dmmOverLimit = false;
  let dmmWarning = false;
  let dmmWarningMsg = '';
  let dmmShouldBeep = false;

  if (!multimeter.isPowered) {
    dmmDisplay = 'OFF';
    dmmUnit = '';
  } else if (!redNode || !blackNode) {
    dmmDisplay = '---';
    dmmUnit = '';
  } else {
    const vRed = nodeVoltages[redNode] !== undefined ? nodeVoltages[redNode] : 0.0;
    const vBlack = nodeVoltages[blackNode] !== undefined ? nodeVoltages[blackNode] : 0.0;
    const deltaV = vRed - vBlack;

    switch (multimeter.mode) {
      case 'V_DC': {
        dmmVal = deltaV;
        const absV = Math.abs(deltaV);
        if (absV >= 1000) {
          dmmDisplay = (deltaV / 1000).toFixed(2);
          dmmUnit = 'kV DC';
        } else if (absV >= 1.0 || absV === 0) {
          dmmDisplay = deltaV.toFixed(2);
          dmmUnit = 'V DC';
        } else {
          dmmDisplay = (deltaV * 1000).toFixed(1);
          dmmUnit = 'mV DC';
        }
        break;
      }

      case 'V_AC': {
        // High-speed alternating / ripple voltage component
        const hasCanSignal = (redNode.includes('can') || blackNode.includes('can'));
        const acRms = hasCanSignal ? 0.707 * 1.0 : Math.abs(deltaV * 0.02);
        dmmVal = acRms;
        if (acRms >= 1000) {
          dmmDisplay = (acRms / 1000).toFixed(2);
          dmmUnit = 'kV AC';
        } else if (acRms >= 1.0 || acRms === 0) {
          dmmDisplay = acRms.toFixed(3);
          dmmUnit = 'V AC';
        } else {
          dmmDisplay = (acRms * 1000).toFixed(1);
          dmmUnit = 'mV AC';
        }
        break;
      }

      case 'RESISTANCE': {
        const vRed = Math.abs(nodeVoltages[redNode] ?? 0);
        const vBlack = Math.abs(nodeVoltages[blackNode] ?? 0);
        const isLiveCircuit = isPowerOn && (Math.abs(deltaV) > 0.1 || vRed > 0.3 || vBlack > 0.3);

        if (isLiveCircuit) {
          dmmWarning = true;
          dmmWarningMsg = 'VOLTAGE DETECTED ON LIVE CIRCUIT! Turn bench power supply OFF for accurate Ohms measurement.';
          dmmDisplay = 'ERR';
          dmmUnit = 'Ω';
        } else {
          const rEq = net.calculateEquivalentResistance(redNode, blackNode);
          dmmVal = rEq;
          if (rEq >= 1e8 || !isFinite(rEq)) {
            dmmDisplay = 'O.L';
            dmmUnit = 'MΩ';
            dmmOverLimit = true;
          } else if (rEq >= 1e6) {
            dmmDisplay = (rEq / 1e6).toFixed(2);
            dmmUnit = 'MΩ';
          } else if (rEq >= 1000) {
            dmmDisplay = (rEq / 1000.0).toFixed(2);
            dmmUnit = 'kΩ';
          } else if (rEq >= 1.0 || rEq === 0) {
            dmmDisplay = rEq.toFixed(1);
            dmmUnit = 'Ω';
          } else {
            // Sub-ohm wire lead or contact resistance scaled to milliohms
            dmmDisplay = (rEq * 1000.0).toFixed(1);
            dmmUnit = 'mΩ';
          }
        }
        break;
      }

      case 'CONTINUITY': {
        const rCont = net.calculateEquivalentResistance(redNode, blackNode);
        dmmVal = rCont;
        if (rCont < 30.0) {
          dmmShouldBeep = true;
          if (rCont < 1.0 && rCont > 0) {
            dmmDisplay = (rCont * 1000).toFixed(0);
            dmmUnit = 'mΩ';
          } else {
            dmmDisplay = rCont.toFixed(1);
            dmmUnit = 'Ω';
          }
        } else if (rCont >= 1e6 || !isFinite(rCont)) {
          dmmDisplay = 'O.L';
          dmmUnit = 'Ω';
          dmmOverLimit = true;
        } else if (rCont >= 1000) {
          dmmDisplay = (rCont / 1000.0).toFixed(2);
          dmmUnit = 'kΩ';
        } else {
          dmmDisplay = rCont.toFixed(1);
          dmmUnit = 'Ω';
        }
        break;
      }

      case 'DIODE': {
        // Standard forward diode drop check
        dmmVal = Math.abs(deltaV);
        if (Math.abs(deltaV) > 0.4 && Math.abs(deltaV) < 0.85) {
          dmmDisplay = Math.abs(deltaV).toFixed(3);
          dmmUnit = 'V';
        } else if (Math.abs(deltaV) < 0.05) {
          dmmDisplay = (Math.abs(deltaV) * 1000).toFixed(1);
          dmmUnit = 'mV (SHORT)';
        } else {
          dmmDisplay = 'O.L';
          dmmUnit = 'V';
          dmmOverLimit = true;
        }
        break;
      }

      case 'FREQUENCY': {
        const isCanBus = redNode.includes('can') || blackNode.includes('can');
        const isInj = redNode.includes('inj') || blackNode.includes('inj');
        let hz = 0;
        if (isCanBus && isPowerOn) {
          hz = 25000;
        } else if (isInj && isPowerOn) {
          hz = 20;
        }
        dmmVal = hz;

        if (hz >= 1e6) {
          dmmDisplay = (hz / 1e6).toFixed(2);
          dmmUnit = 'MHz';
        } else if (hz >= 1000) {
          dmmDisplay = (hz / 1000.0).toFixed(1);
          dmmUnit = 'kHz';
        } else {
          dmmDisplay = hz.toFixed(1);
          dmmUnit = 'Hz';
        }
        break;
      }
    }
  }

  // 8. Generate Active OBD-II Diagnostic Trouble Codes (DTCs) from Actual Simulated Voltages
  const dtcs: DiagnosticTroubleCode[] = [];

  const tpsVoltage = nodeVoltages['ecu-pin-7'] !== undefined ? nodeVoltages['ecu-pin-7'] : 0.85;
  if (isPowerOn && tpsVoltage < 0.20) {
    dtcs.push({
      code: 'P0122',
      system: 'Throttle Position Sensor',
      description: 'Throttle Position Sensor (G79) Circuit Low Input (Voltage < 0.20V)',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      associatedPinIds: ['ecu-pin-7'],
    });
  } else if (isPowerOn && tpsVoltage > 4.80) {
    dtcs.push({
      code: 'P0123',
      system: 'Throttle Position Sensor',
      description: 'Throttle Position Sensor (G79) Circuit High Input (Voltage > 4.80V)',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      associatedPinIds: ['ecu-pin-7'],
    });
  }

  const ectVoltage = nodeVoltages['ecu-pin-9'] !== undefined ? nodeVoltages['ecu-pin-9'] : 1.95;
  if (isPowerOn && ectVoltage < 0.15) {
    dtcs.push({
      code: 'P0117',
      system: 'Engine Coolant Temperature',
      description: 'Coolant Temperature Sensor (G62) Circuit Low Input (Short to GND)',
      severity: 'WARNING',
      status: 'ACTIVE',
      associatedPinIds: ['ecu-pin-9'],
    });
  } else if (isPowerOn && ectVoltage > 4.85) {
    dtcs.push({
      code: 'P0118',
      system: 'Engine Coolant Temperature',
      description: 'Coolant Temperature Sensor (G62) Circuit High Input (Open Circuit)',
      severity: 'WARNING',
      status: 'ACTIVE',
      associatedPinIds: ['ecu-pin-9'],
    });
  }

  const canHVoltage = nodeVoltages['ecu-pin-13'] !== undefined ? nodeVoltages['ecu-pin-13'] : 2.5;
  const canLVoltage = nodeVoltages['ecu-pin-14'] !== undefined ? nodeVoltages['ecu-pin-14'] : 2.5;
  const canDifferential = Math.abs(canHVoltage - canLVoltage);
  if (isPowerOn && (canHVoltage < 0.3 || canLVoltage < 0.3 || canDifferential > 3.0)) {
    dtcs.push({
      code: 'U0001',
      system: 'CAN Communication Network',
      description: 'High Speed CAN Communication Bus Malfunction (Bus shorted or terminated incorrectly)',
      severity: 'CRITICAL',
      status: 'ACTIVE',
      associatedPinIds: ['ecu-pin-13', 'ecu-pin-14'],
    });
  }

  return {
    nodeVoltages,
    nodeResistances,
    wireCurrentsMa,
    supplyCurrentDrawAmps: supplyCurrentDraw,
    isSupplyCurrentTripped,
    activeDTCs: dtcs,
    multimeterReading: {
      display: dmmDisplay,
      value: dmmVal,
      unit: dmmUnit,
      isOverLimit: dmmOverLimit,
      isWarning: dmmWarning,
      warningMessage: dmmWarningMsg,
      shouldBeep: dmmShouldBeep,
    },
  };
}
