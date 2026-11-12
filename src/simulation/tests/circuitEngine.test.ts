/**
 * Automated Verification Test Suite for AutoTech Virtual Lab Pro
 * Tests MNA Circuit Simulation Engine, Automotive Component Models,
 * Multimeter Thevenin Measurements, Power Supply, and Fault Injection.
 */

import { MatrixSolver } from '../engine/MatrixSolver';
import { CircuitNetwork } from '../electrical/CircuitNetwork';
import { AutomotiveModels } from '../components/AutomotiveModels';
import { FaultManager } from '../faults/FaultManager';
import { SignalGenerator } from '../signals/SignalGenerator';
import {
  solveCircuit,
  DEFAULT_ECU_PINS,
  DEFAULT_BENCH_COMPONENTS,
  DEFAULT_WIRES,
} from '../../utils/circuitSolver';
import { InjectedFault, MultimeterState, PowerSupplyState } from '../../types/ecu';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(name: string, category: string, condition: boolean, expected: string, actual: string) {
  testResults.push({
    name,
    category,
    passed: condition,
    expected,
    actual,
  });
}

function assertCloseTo(
  name: string,
  category: string,
  actual: number,
  expected: number,
  tolerance = 0.05
) {
  const diff = Math.abs(actual - expected);
  const passed = diff <= tolerance;
  assert(
    name,
    category,
    passed,
    `${expected} ± ${tolerance}`,
    `${actual.toFixed(4)} (diff: ${diff.toFixed(4)})`
  );
}

// ==========================================
// TEST SUITE 1: Numerical Linear Solver (MNA)
// ==========================================
function testMatrixSolver() {
  // Test 1.1: 2x2 system
  // 2*v1 - 1*v2 = 5
  // -1*v1 + 3*v2 = 5
  // Solution: v1 = 4, v2 = 3
  const A = [
    [2, -1],
    [-1, 3],
  ];
  const b = [5, 5];
  const x = MatrixSolver.solve(A, b);

  assertCloseTo('MNA 2x2 Linear System Solve', 'Numerical Solver', x[0], 4.0, 0.001);
  assertCloseTo('MNA 2x2 Linear System Solve (v2)', 'Numerical Solver', x[1], 3.0, 0.001);

  // Test 1.2: Singular / Degenerate Matrix
  const A_sing = [
    [1, 1],
    [1, 1],
  ];
  const b_sing = [2, 2];
  const x_sing = MatrixSolver.solve(A_sing, b_sing);
  assert(
    'Singular Matrix Graceful Regularization',
    'Numerical Solver',
    x_sing.every(v => !isNaN(v) && isFinite(v)),
    'Finite non-NaN values',
    JSON.stringify(x_sing)
  );
}

// ==========================================
// TEST SUITE 2: Ohm's Law & Circuit Network
// ==========================================
function testOhmsLawAndNetwork() {
  const network = new CircuitNetwork();

  // Voltage source: 12.6V on node 'vbat'
  network.addVoltageSource('VS1', 'vbat', '0', 12.6, 0.02);

  // Load resistor: 10 ohms between 'vbat' and 'load_node'
  network.addResistor('load_node', '0', 10.0);
  network.addResistor('vbat', 'load_node', 0.05); // wire resistance

  const solution = network.solve();
  const vLoad = solution.nodeVoltages['load_node'] ?? 0;
  const currentDraw = solution.sourceCurrentDrawAmps;

  // Expected: 12.6 / (10 + 0.02 + 0.05) = 12.6 / 10.07 ≈ 1.2512 A
  // vLoad = 1.2512 * 10 = 12.512 V
  assertCloseTo("Ohm's Law V_Load", 'Electrical Network', vLoad, 12.512, 0.05);
  assertCloseTo("Ohm's Law Source Current", 'Electrical Network', currentDraw, 1.2512, 0.05);
}

// ==========================================
// TEST SUITE 3: Automotive Component Physics
// ==========================================
function testAutomotiveModels() {
  // 3.1: Dual TPS Transfer Function
  const tpsIdle = AutomotiveModels.calculateTps(0, 5.0);
  assertCloseTo('TPS Throttle 0% Track 1 (0.50V min)', 'Automotive Models', tpsIdle.track1Voltage, 0.50, 0.02);
  assertCloseTo('TPS Throttle 0% Track 2 (4.50V inverted)', 'Automotive Models', tpsIdle.track2Voltage, 4.50, 0.02);

  const tpsHalf = AutomotiveModels.calculateTps(50, 5.0);
  assertCloseTo('TPS Throttle 50% Track 1 (2.50V)', 'Automotive Models', tpsHalf.track1Voltage, 2.50, 0.02);

  const tpsWot = AutomotiveModels.calculateTps(100, 5.0);
  assertCloseTo('TPS Throttle 100% Track 1 (4.50V WOT)', 'Automotive Models', tpsWot.track1Voltage, 4.50, 0.02);
  assertCloseTo('TPS Throttle 100% Track 2 (0.50V WOT)', 'Automotive Models', tpsWot.track2Voltage, 0.50, 0.02);

  // 3.2: ECT Steinhart-Hart NTC Thermistor
  const rCold = AutomotiveModels.calculateEct(10).resistanceOhms; // 10°C
  const rNominal = AutomotiveModels.calculateEct(25).resistanceOhms; // 25°C
  const rHot = AutomotiveModels.calculateEct(85).resistanceOhms; // 85°C

  assert(
    'ECT NTC Negative Temperature Coefficient (R_cold > R_nominal > R_hot)',
    'Automotive Models',
    rCold > rNominal && rNominal > rHot,
    'Cold > Nominal > Hot',
    `Cold: ${rCold.toFixed(0)}Ω, Nom: ${rNominal.toFixed(0)}Ω, Hot: ${rHot.toFixed(0)}Ω`
  );
  assertCloseTo('ECT Thermistor 25°C Benchmark (2500Ω)', 'Automotive Models', rNominal, 2500, 1.0);

  // 3.3: CAN Bus Termination Resistance
  const canNominal = AutomotiveModels.calculateCanBus(true, true);
  assertCloseTo('CAN Bus Dual 120Ω Parallel Termination (60Ω)', 'Automotive Models', canNominal.busResistanceOhms, 60.0, 0.1);

  const canOpenTerm = AutomotiveModels.calculateCanBus(true, false);
  assertCloseTo('CAN Bus Single Term Open (120Ω Remaining)', 'Automotive Models', canOpenTerm.busResistanceOhms, 120.0, 0.1);
}

// ==========================================
// TEST SUITE 4: Fault Injection & Diagnostics
// ==========================================
function testFaultInjection() {
  const basePins = DEFAULT_ECU_PINS;
  const baseComponents = DEFAULT_BENCH_COMPONENTS;
  const baseWires = DEFAULT_WIRES;

  const normalSupply: PowerSupplyState = {
    voltageSetting: 12.6,
    currentLimit: 5.0,
    isOutputEnabled: true,
    preset: '12V_BENCH',
  };

  const dmmVoltage: MultimeterState = {
    mode: 'V_DC',
    redProbe: { attachedToPinId: 'ecu-pin-7', attachedLabel: 'TPS_SIG (Pin 7)' },
    blackProbe: { attachedToPinId: 'chassis-gnd', attachedLabel: 'Chassis GND' },
    isPowered: true,
    rangeAuto: true,
    holdValue: false,
  };

  // Set TPS throttle component to 50% for 2.50V benchmark
  const testComponents = baseComponents.map(c =>
    c.id === 'comp-tps' ? { ...c, state: { ...c.state, throttleAnglePercent: 50 } } : c
  );

  // Normal TPS Voltage (2.50V at 50% throttle)
  const normSol = solveCircuit(normalSupply, basePins, [], baseWires, testComponents, dmmVoltage);
  assertCloseTo('Nominal TPS Sensor Output Voltage (2.50V at 50% throttle)', 'Fault Injection', normSol.multimeterReading.value, 2.50, 0.15);
  assert('Nominal State DTC Count == 0', 'Fault Injection', normSol.activeDTCs.length === 0, '0 DTCs', `${normSol.activeDTCs.length} DTCs`);

  // Fault 1: Short TPS to Ground
  const shortFault: InjectedFault[] = [
    { pinId: 'ecu-pin-7', faultType: 'SHORT_TO_GND', description: 'TPS signal wire pinched to metal ground', timestamp: Date.now() },
  ];
  const shortSol = solveCircuit(normalSupply, basePins, shortFault, baseWires, testComponents, dmmVoltage);
  assertCloseTo('TPS Short to GND Voltage (0.0V)', 'Fault Injection', shortSol.multimeterReading.value, 0.0, 0.05);
  assert('TPS Short to GND Generates P0122 DTC', 'Fault Injection', shortSol.activeDTCs.some(d => d.code === 'P0122'), 'Contains P0122', JSON.stringify(shortSol.activeDTCs.map(d => d.code)));

  // Fault 2: Short to Battery (+12.6V)
  const vbatFault: InjectedFault[] = [
    { pinId: 'ecu-pin-7', faultType: 'SHORT_TO_VBAT', description: 'Harness shorted to battery +12V', timestamp: Date.now() },
  ];
  const vbatSol = solveCircuit(normalSupply, basePins, vbatFault, baseWires, testComponents, dmmVoltage);
  assertCloseTo('TPS Short to VBAT Voltage (12.6V)', 'Fault Injection', vbatSol.multimeterReading.value, 12.6, 0.2);
  assert('TPS Short to VBAT Generates P0123 DTC', 'Fault Injection', vbatSol.activeDTCs.some(d => d.code === 'P0123'), 'Contains P0123', JSON.stringify(vbatSol.activeDTCs.map(d => d.code)));

  // Fault 3: High Resistance Corrosion (250Ω)
  const corrodeFault: InjectedFault[] = [
    { pinId: 'ecu-pin-7', faultType: 'HIGH_RESISTANCE_250R', description: 'Corroded pin terminal (250Ω)', timestamp: Date.now() },
  ];
  const corrodeSol = solveCircuit(normalSupply, basePins, corrodeFault, baseWires, testComponents, dmmVoltage);
  assert(
    'Corrosion Introduces Measurable Voltage Attenuation',
    'Fault Injection',
    corrodeSol.multimeterReading.value < normSol.multimeterReading.value,
    '< nominal 2.5V',
    `${corrodeSol.multimeterReading.value.toFixed(3)}V (nominal: ${normSol.multimeterReading.value.toFixed(3)}V)`
  );
}

// ==========================================
// TEST SUITE 5: Virtual Multimeter & Measurements
// ==========================================
function testMultimeterModes() {
  // Key-OFF condition: power supply turned OFF for passive resistance diagnostics
  const offSupply: PowerSupplyState = {
    voltageSetting: 12.6,
    currentLimit: 5.0,
    isOutputEnabled: false,
    preset: '12V_BENCH',
  };

  // 5.1: Continuity / Resistance Mode on CAN Bus Termination (Key OFF)
  const dmmOhms: MultimeterState = {
    mode: 'RESISTANCE',
    redProbe: { attachedToPinId: 'ecu-pin-13', attachedLabel: 'CAN_H' },
    blackProbe: { attachedToPinId: 'ecu-pin-14', attachedLabel: 'CAN_L' },
    isPowered: true,
    rangeAuto: true,
    holdValue: false,
  };

  const ohmsSol = solveCircuit(offSupply, DEFAULT_ECU_PINS, [], DEFAULT_WIRES, DEFAULT_BENCH_COMPONENTS, dmmOhms);
  assertCloseTo(
    'DMM Resistance Mode Measures CAN Bus Termination (60Ω Key-OFF)',
    'Digital Multimeter',
    ohmsSol.multimeterReading.value,
    60.0,
    2.0
  );

  // 5.2: Live Circuit Warning when measuring Ohms with Power ON
  const liveSupply: PowerSupplyState = {
    voltageSetting: 12.6,
    currentLimit: 5.0,
    isOutputEnabled: true,
    preset: '12V_BENCH',
  };
  const liveOhmsSol = solveCircuit(liveSupply, DEFAULT_ECU_PINS, [], DEFAULT_WIRES, DEFAULT_BENCH_COMPONENTS, dmmOhms);
  assert(
    'DMM Ohms on Live Circuit Triggers Warning & Lockout',
    'Digital Multimeter',
    liveOhmsSol.multimeterReading.isWarning && liveOhmsSol.multimeterReading.display === 'ERR',
    'Warning ERR',
    `${liveOhmsSol.multimeterReading.display} (${liveOhmsSol.multimeterReading.warningMessage ?? 'OK'})`
  );

  // 5.3: Continuity Mode
  const dmmCont: MultimeterState = {
    mode: 'CONTINUITY',
    redProbe: { attachedToPinId: 'ecu-pin-1', attachedLabel: 'KL31 GND 1' },
    blackProbe: { attachedToPinId: 'ecu-pin-2', attachedLabel: 'KL31 GND 2' },
    isPowered: true,
    rangeAuto: true,
    holdValue: false,
  };
  const contSol = solveCircuit(offSupply, DEFAULT_ECU_PINS, [], DEFAULT_WIRES, DEFAULT_BENCH_COMPONENTS, dmmCont);
  assert(
    'DMM Continuity Beeps on Common Grounds (<50Ω)',
    'Digital Multimeter',
    contSol.multimeterReading.shouldBeep || contSol.multimeterReading.value < 5.0,
    'Continuity BEEP',
    contSol.multimeterReading.display
  );
}

// ==========================================
// TEST SUITE 6: Oscilloscope Physical Signals
// ==========================================
function testOscilloscopeSignals() {
  // 6.1: Crankshaft 60-2 Missing Tooth Pattern
  const crankTooth1 = SignalGenerator.getCrankshaftVrSignal(0.001, 1200);
  assert('Crankshaft VR Signal Generates Dynamic Sine Wave', 'Oscilloscope Engine', typeof crankTooth1 === 'number' && !isNaN(crankTooth1), 'Valid Number', crankTooth1.toString());

  // 6.2: Injector Waveform 3-Phase Physical Profile
  // Phase 1: MOSFET Dwell Saturation (0.2V)
  const injDwell = SignalGenerator.getInjectorWaveform(0.001, false, 12.6);
  assertCloseTo('Injector MOSFET Ground Dwell Voltage (~0.2V)', 'Oscilloscope Engine', injDwell, 0.2, 0.05);

  // Phase 2: Inductive Flyback Kick (> 40V)
  const injFlyback = SignalGenerator.getInjectorWaveform(0.00255, false, 12.6);
  assert(
    'Injector Flyback Spike > 40V During De-energization',
    'Oscilloscope Engine',
    injFlyback > 40.0,
    '> 40V Kick',
    `${injFlyback.toFixed(1)}V`
  );

  // Phase 3: Quiescent VBat (12.6V)
  const injQuiescent = SignalGenerator.getInjectorWaveform(0.010, false, 12.6);
  assertCloseTo('Injector Quiescent Battery Voltage (12.6V)', 'Oscilloscope Engine', injQuiescent, 12.6, 0.1);
}

// ==========================================
// RUNNER & REPORTING
// ==========================================
export function runAllTests(): { passed: number; failed: number; total: number; results: TestResult[] } {
  testResults.length = 0;

  try {
    testMatrixSolver();
    testOhmsLawAndNetwork();
    testAutomotiveModels();
    testFaultInjection();
    testMultimeterModes();
    testOscilloscopeSignals();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    testResults.push({
      name: 'Test Execution Exception',
      category: 'Runner',
      passed: false,
      expected: 'Clean Execution',
      actual: msg,
    });
  }

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log('====================================================');
  console.log(`AUTOTECH LAB TEST SUITE RESULTS: ${passed}/${testResults.length} PASSED`);
  console.log('====================================================');
  testResults.forEach(r => {
    const symbol = r.passed ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`${symbol} [${r.category}] ${r.name}`);
    if (!r.passed) {
      console.log(`    Expected: ${r.expected}`);
      console.log(`    Actual:   ${r.actual}`);
    }
  });

  return { passed, failed, total: testResults.length, results: testResults };
}

// Allow direct execution via tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('circuitEngine.test.ts')) {
  const result = runAllTests();
  process.exit(result.failed > 0 ? 1 : 0);
}
