import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  AlertTriangle,
  Cpu,
  Zap,
  Activity,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Car,
  Terminal,
  Layers,
  Wrench,
  Globe,
  Sparkles,
} from 'lucide-react';
import { GroundedSearchPanel } from './GroundedSearchPanel';
import { DtcFrequencyWidget } from './DtcFrequencyWidget';
import { SavedBenchSession, SavedDiagnosticLog } from '../services/benchStorageService';
import { DiagnosticTroubleCode } from '../types/ecu';

export interface RepairArticle {
  id: string;
  dtcCode: string;
  title: string;
  vehicleModel: string;
  category: 'NISSAN_HITACHI' | 'MAGNETI_MARELLI' | 'TOYOTA_DENSO' | 'BOSCH_FORD';
  symptoms: string[];
  rootCauses: { cause: string; description: string; severity: 'CRITICAL' | 'MODERATE' | 'WARNING' }[];
  hardwareNote?: string;
  cpuArchitecture?: string;
  images?: { url: string; caption: string }[];
  repairSteps: { stepNum: number; action: string; specification: string }[];
}

export const REPAIR_KNOWLEDGE_BASE: RepairArticle[] = [
  // 1. Nissan Hitachi MEC11-251 / MEC22-251 Bench Testing & K-Line Diagnostic Guide
  {
    id: 'art-nissan-mec11-bench',
    dtcCode: 'MEC11 / MEC22',
    title: 'Nissan Sentra/Almera N16 (Hitachi MEC11-251 / MEC22-251) - Pure K-Line Bench Diagnostic & Wakeup Manual',
    vehicleModel: 'Nissan Sentra N16 (Exalta / GX / GS), Almera N16, Sunny (QG16DE Engine / Hitachi MEC11-251 & MEC22-251 ECM)',
    category: 'NISSAN_HITACHI',
    symptoms: [
      'ECU bench wake-up fails to communicate with Ancel V7 HD or CONSULT-II scanner when technician erroneously hooks CAN lines instead of K-Line',
      'Engine crank but no start; fuel pump relay does not prime and no injector pulse output',
      'No diagnostic communication on OBD-II Pin 7 when Pin 88 or Pin 85 is not wired or Pin 36 toggle is open',
      'Confusion between internal TCU CAN bus (Pins 86 & 94) and diagnostic serial communication',
      'Internal main relay logic not latching during bench power-up',
    ],
    rootCauses: [
      {
        cause: 'Connecting Scan Tool to Pins 86 & 94 (TCU CAN) instead of Pin 88 (K-Line)',
        description: 'CRITICAL ARCHITECTURE FACT: Hitachi MEC11-251 and MEC22-251 ECMs communicate strictly via ISO-9141 K-Line on Pin 88 (or Pin 85) to OBD2 Pin 7. Pins 86 & 94 are dedicated inter-module lines exclusively to the Automatic Transmission Control Unit (TCU on automatic models) and will NEVER respond to diagnostic OBD2 scan tools.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Missing Constant Battery (+12V) on Pin 67 (or Pin 121)',
        description: 'Microcontroller SRAM memory and internal supervisory circuits remain unpowered without permanent fused +12V battery power.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Ignition Wake-Up Toggle (Pin 36 / Pin 109) Not Energized',
        description: 'Switched ignition input is required to trigger the internal EGI relay ground driver on Pin 111 and wake the CPU.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Floating Ground or High-Resistance OBD2 Negative Return',
        description: 'OBD2 socket Pins 4 & 5 must be solidly bonded to ECU ground pins (Pins 48, 1, 57, 115, 116).',
        severity: 'MODERATE',
      },
      {
        cause: 'Missing 5A/10A Inline Fuse Protection',
        description: 'Direct car battery connections without inline fuse can destroy PCB traces if adjacent pins touch.',
        severity: 'WARNING',
      },
    ],
    hardwareNote: 'Hitachi MEC11-251 / MEC22-251 121-pin ECU connector is split into three horizontal rows. BENCH TEST HARNESS: Pin 67 (or 121) to +12V Constant, Pin 36 (or 109) to +12V Ignition switch toggle, Pin 48 (or 1/57) to Ground & OBD2 Pins 4/5, Pin 88 (or 85) to OBD2 Pin 7 (Pure ISO-9141 K-Line). ⚠️ LEAVE PINS 86 & 94 DISCONNECTED: They are dedicated internal TCU CAN lines, NOT diagnostic CAN!',
    cpuArchitecture: 'Hitachi Renesas SH705x Automotive Microcontroller with on-chip flash, ISO-9141 K-Line UART transceiver for all diagnostic sessions (OBD2 Pin 7), and dedicated TCU inter-module bus.',
    repairSteps: [
      { stepNum: 1, action: 'Connect Constant +12V Fused Power (+B)', specification: 'Connect ECU Pin 67 (or Pin 121) to battery positive (+) via 5A or 10A inline fuse' },
      { stepNum: 2, action: 'Connect Main Chassis & Diagnostic Ground', specification: 'Bond ECU Pin 48 (or Pin 1, Pin 57, Pin 115/116) to Battery (-) and OBD2 Socket Pins 4 & 5' },
      { stepNum: 3, action: 'Route Pure K-Line Diagnostic Lead to OBD2 Pin 7', specification: 'Connect ECU Pin 88 (or Pin 85) directly to OBD2 Socket Pin 7. Do NOT connect CAN Pins 6 & 14!' },
      { stepNum: 4, action: 'Apply Switched Ignition (+12V) via Toggle Switch', specification: 'Switch +12V into Pin 36 (or Pin 109) to trigger processor wake-up and internal EGI relay latching' },
      { stepNum: 5, action: 'Initiate Diagnostic Scanner Session over K-Line', specification: 'Plug Ancel V7 HD / scanner into OBD2 socket (Pins 4, 5, 7, 16); select Nissan -> Manual Diagnosis -> Sentra/Almera/Sunny (N16 Engine Controls via ISO-9141)' },
    ],
  },

  // 2. Nissan Hitachi MEC22-251 Physical Harness Socket Cavity Mapping & Multilayer PCB Component Topology
  {
    id: 'art-nissan-mec22-pcb-socket',
    dtcCode: 'MEC22-MAP',
    title: 'Nissan Hitachi MEC22-251 - Physical Socket Cavity Mapping & Internal PCB Component Topology Manual',
    vehicleModel: 'Nissan Sentra N16, Almera N16, Sunny (Hitachi MEC22-251 ECM / QG16DE 1.6L)',
    category: 'NISSAN_HITACHI',
    images: [
      {
        url: '/assets/aistudio/IMG_20261031_102222_185ec4db.jpg',
        caption: 'Physical 121-Pin Receptacle: Dual-Chamber Grey Connector (Chamber A: 81 Pins with Green Power Terminal Retainers; Chamber B: 40 Pins including K-Line Pin 88)'
      },
      {
        url: '/assets/aistudio/IMG_20261031_100429_ce48661e.jpg',
        caption: 'MEC22-251 Internal Multilayer PCB: R701-R703 (0.028Ω Current Sense Shunts), R704 (82Ω Pulldown), C844-C879 Filter Bank, Clamping Diodes D301-D302, & Solder Array'
      }
    ],
    symptoms: [
      'P0201 - P0204 Cylinder 1-4 Injector Circuit Malfunction caused by burnt current-sense shunts (R701, R702, R703)',
      'Erratic MAF or Cam/Crank sensor noise and timing jitters caused by dried or cracked SMD filter capacitors (C844 - C879)',
      'No power latch or blown fuse 5A/10A due to reverse polarity breakdown in TVS clamping diodes (D301, D302)',
      'Broken or oxidized harness terminal socket cavities (Chamber A Pin 1, 3, 48, 67 or Chamber B Pin 88)',
      'Main CPU reset under heavy alternator load due to high-resistance chassis ground bond screw connection'
    ],
    rootCauses: [
      {
        cause: 'Overcurrent Burnout of Injector Current Sense Shunts (R701, R702, R703 - Code 028 = 0.028Ω)',
        description: 'Short circuits in fuel injector solenoid coils cause massive current flow through precision current sense SMD resistors R701, R702, and R703 (labeled 028, 0.028Ω). If any shunt resistor goes high resistance or open circuit, the ECM CPU registers injector circuit fault (P0201-P0204) and cuts fuel delivery.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Transient Spike Breakdown of Clamping Protection Diodes D301 & D302',
        description: 'Alternator load dumps or jump-start reverse voltage triggers conduction in high-speed clamping diodes D301 and D302. If they fail shorted to ground, the main +12V EGI relay immediately blows the vehicle 15A fuse.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Degradation of Sensor Decoupling Capacitor Array C844 to C879',
        description: 'High frequency electromagnetic interference from ignition coils is filtered through ceramic surface-mount capacitor bank C844-C879. Micro-cracking causes intermittent signal clipping on Camshaft PHASE (Pin 14) and Crankshaft POS (Pin 13).',
        severity: 'MODERATE',
      },
      {
        cause: 'Corroded or Spread Female Terminal Terminals in Harness Socket',
        description: 'Chamber A green retention inserts secure the heavy-gauge terminals (Pins 1, 3, 48, 67). Drag-testing with a proper male test pin must show at least 1.5N retention force; loosened cavities cause sudden stall on bumps.',
        severity: 'MODERATE',
      },
    ],
    hardwareNote: 'PHYSICAL CONNECTOR TOPOLOGY: Chamber A spans Pins 1 to 81 with green terminal lock clips. Pin 67 is fused +12V battery; Pin 36 is switched ignition; Pins 48/57/1 are power grounds. Chamber B spans Pins 82 to 121: Pin 88 is ISO-9141 K-Line directly wired to OBD-II Pin 7. Pins 86 & 94 connect solely to the TCU.',
    cpuArchitecture: 'Hitachi Renesas Automotive MCU with dedicated injector low-side driver stage, external 0.028Ω shunts (R701-R703), and ISO-9141 serial transceiver for diagnostic protocol handling.',
    repairSteps: [
      { stepNum: 1, action: 'Inspect Shunt Resistors R701, R702, R703 on Internal PCB', specification: 'Measure cold resistance across R701-R703 with precision milliohmmeter. Each shunt must measure 0.028Ω ± 5%. Replace with 1W SMD shunt if discolored or open' },
      { stepNum: 2, action: 'Test Clamping Diodes D301 & D302 in Diode Mode', specification: 'Forward bias: 0.55V - 0.70V drop. Reverse bias: Infinite (O.L.). If reading ~0.00V, remove and replace shorted diode' },
      { stepNum: 3, action: 'Check Sensor Line Decoupling Capacitors (C844 - C879)', specification: 'Measure resistance from sensor lines (Pins 13, 14, 50) to chassis ground. Must exceed 100kΩ with no DC leakage' },
      { stepNum: 4, action: 'Clean and Re-torque Enclosure Ground Bond Screw', specification: 'Ensure star washer bites into bare copper ground ring on PCB for minimal impedance (< 0.05Ω to casing)' },
      { stepNum: 5, action: 'Terminal Drag Test on Socket Cavities (Chamber A & B)', specification: 'Insert Nissan 1.0mm & 2.3mm test pins into Pins 1, 3, 36, 48, 67, and Pin 88. Verify positive mechanical retention force' },
    ],
  },

  // 2. Nissan QG16 ECM Inspection Table & Voltage Specifications (EC-52 to EC-60)
  {
    id: 'art-nissan-qg16-spec',
    dtcCode: 'QG16-TABLE',
    title: 'Nissan QG16DE ECM Terminal Voltage Reference & Sensor Inspection Table (EC-52 to EC-60)',
    vehicleModel: 'Nissan Almera N16, Sentra N16 1.6L (QG16DE Twin Cam 16V Engine)',
    category: 'NISSAN_HITACHI',
    symptoms: [
      'Rough idle, engine hesitation, or stall during sudden acceleration',
      'Electronic Throttle Control motor relay unlatched or position tracking mismatch',
      'Mass Air Flow (MAF) out-of-range voltage causing rich/lean condition',
      'Camshaft (PHASE) / Crankshaft (POS) synchronization fault resulting in extended crank',
    ],
    rootCauses: [
      {
        cause: 'Degraded MAF Sensor Voltage (Pin 50)',
        description: 'Output must be 1.0V-1.7V at warm idle and 1.5V-2.1V at 2500 RPM. Values outside this window trigger fuel trim codes.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Electronic Throttle Motor Relay / Drive Fault (Pins 3, 4, 5)',
        description: 'Pin 3 must receive 11-14V with ignition ON. Pin 4 (Close) and Pin 5 (Open) output 0-14V PWM drive waves.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Ground Loop / Using ECM Ground For Voltage Probing',
        description: 'CAUTION FROM NISSAN MANUAL: Never use ECM ground terminals when probing input/output voltages; doing so damages internal driver transistors.',
        severity: 'CRITICAL',
      },
      {
        cause: 'ECT Coolant Sensor Voltage Drift (Pin 72)',
        description: 'NTC sensor output must read 0-4.8V varying smoothly with temperature (~3.5V cold, ~0.8V at 90°C).',
        severity: 'MODERATE',
      },
    ],
    hardwareNote: 'Reference Data from Nissan Service Manual EC-52 to EC-60. Positional sensors: POS Crankshaft (Pin 13) approx 3.0V AC; PHASE Camshaft (Pin 14) 1.0V-4.0V pulse. Dual TPS tracks: TPS 1 (Pin 49) >0.36V closed / <4.75V WOT; TPS 2 (Pin 68) inverted.',
    cpuArchitecture: 'Hitachi MEC11-251 ECM supporting Nissan CONSULT-II: Work Support, Self-Diagnostic Results, Data Monitor, Active Test, CAN Diagnostic Monitor.',
    repairSteps: [
      { stepNum: 1, action: 'Verify Electronic Throttle Motor Power (Pin 3)', specification: '11V - 14V Battery Voltage with Ignition ON' },
      { stepNum: 2, action: 'Probe Mass Air Flow Sensor Output (Pin 50)', specification: '1.0V - 1.7V at idle; 1.5V - 2.1V at 2500 RPM' },
      { stepNum: 3, action: 'Inspect Crankshaft POS (Pin 13) & Camshaft PHASE (Pin 14)', specification: 'POS: ~3.0V AC waveform; PHASE: 1.0V - 4.0V square pulses' },
      { stepNum: 4, action: 'Measure 5V Regulated Sensor Reference Rails', specification: 'Pin 46 (Refrigerant), Pin 47 (TPS), Pin 65 (Power Steering): Exactly 5.00V ± 0.05V' },
      { stepNum: 5, action: 'Check Fuel Pump Relay Control (Pin 113)', specification: '0V (Ground sink) for 1 second after ignition ON, then returns to 12V until cranking' },
    ],
  },

  // 3. Magneti Marelli IAW 5NF Water Temperature Sensor Failure
  {
    id: 'art-iaw-5nf-water-temp',
    dtcCode: 'IAW-5NF-01',
    title: 'Magneti Marelli IAW 5NF - Water Temperature Sensor & Acceleration Loss Jumper Guide',
    vehicleModel: 'Fiat Stilo 1.8L, Palio, Idea, Punto (Magneti Marelli IAW 5NF.T6 / 5NF.T7)',
    category: 'MAGNETI_MARELLI',
    images: [
      {
        url: '/assets/aistudio/Screenshot_20261112_170414_com_facebook_katana_FbMainTabActivity_75282c2f.jpg',
        caption: 'Diagnostic 1: Jumper from Pin 10 of Injector Driver IC (TLE9135PD) to Connector A Pin 35/36 restoring water temp sensor ground return'
      },
      {
        url: '/assets/aistudio/Screenshot_20261112_170409_com_facebook_katana_FbMainTabActivity_af47a1b8.jpg',
        caption: 'Component Topology Map of Magneti Marelli IAW 5NF: TLE9135PD (Magenta Arrow) & Connector A 64-pin layout'
      }
    ],
    symptoms: [
      'Dashboard temperature warning light is illuminated continuously',
      'Temperature gauge displays no reading on the instrument cluster',
      'Vehicle experiences total loss of acceleration / throttle pedal response',
    ],
    rootCauses: [
      {
        cause: 'Internal PCB Trace / Driver IC Pin 10 Disconnection',
        description: 'Broken internal substrate trace connecting Injector Driver IC (TLE9135PD) to temperature sensor low-side return.',
        severity: 'CRITICAL',
      },
    ],
    hardwareNote: 'Magneti Marelli IAW 5NF features 64 pins per connector (Connector A & B) with EEPROM SOIC 95160. Injector Driver IC is TLE9135PD (Magenta Arrow).',
    cpuArchitecture: 'Magneti Marelli IAW 5NF (Variants: 5NF.T6 1.8L, 5NF.T7 Flex Fuel, 5NF.TH, 5NF.F3 1.0L/1.3L 16V).',
    repairSteps: [
      { stepNum: 1, action: 'Locate Injector Driver IC (TLE9135PD)', specification: 'Identify Magenta Arrow IC on component topology map' },
      { stepNum: 2, action: 'Install Hardware Jumper Wire', specification: 'Solder jumper wire from Pin 10 of Injector Driver IC (TLE9135PD) to Connector A, Pin 35 or Pin 36 (internally interconnected)' },
      { stepNum: 3, action: 'Verify Temperature Signal Return', specification: 'Confirm dashboard gauge restores normal live temperature reading and throttle response normalizes' },
    ],
  },

  // 4. Magneti Marelli IAW 5NF Lambda Ground Fault
  {
    id: 'art-iaw-5nf-lambda',
    dtcCode: 'IAW-5NF-02',
    title: 'Magneti Marelli IAW 5NF - Lambda Probe (Oxygen Sensor) Ground Fault Repair',
    vehicleModel: 'Fiat Stilo 1.8L, Palio, Punto (Magneti Marelli IAW 5NF)',
    category: 'MAGNETI_MARELLI',
    images: [
      {
        url: '/assets/aistudio/Screenshot_20261112_170414_com_facebook_katana_FbMainTabActivity_75282c2f.jpg',
        caption: 'Diagnostic 2: Sonda não trabalha - Bridge sensor ground directly to Pin 35 / Pin 36 vias along the red arrow pathway'
      }
    ],
    symptoms: [
      'Lambda probe (Oxygen Sensor) is completely inactive / non-functional (Sonda não trabalha)',
      'High fuel consumption, rich exhaust odor, and persistent O2 sensor DTC logged',
    ],
    rootCauses: [
      {
        cause: 'Missing Oxygen Sensor Ground Return Trace',
        description: 'Internal ground trace fracture leading to oxygen sensor heater and signal ground floating.',
        severity: 'MODERATE',
      },
    ],
    hardwareNote: 'Lambda Probe Driver IC located on bottom board section. Ground return must be restored to signal ground plane.',
    repairSteps: [
      { stepNum: 1, action: 'Locate Lambda Driver Circuitry', specification: 'Bottom cyan arrow section on component topology map' },
      { stepNum: 2, action: 'Bridge Ground Connection Directly to Pin 35/36 Vias', specification: 'Connect sensor ground pad directly to Pin 35 / Pin 36 vias following schematic red pathway' },
    ],
  },

  // 5. Magneti Marelli IAW 5NF Electronic Throttle Malfunction & 1R Resistors
  {
    id: 'art-iaw-5nf-throttle',
    dtcCode: 'IAW-5NF-03',
    title: 'Magneti Marelli IAW 5NF - Electronic Throttle Malfunction & 1-Ohm (1R) Resistor Check',
    vehicleModel: 'Fiat Stilo 1.8L, Palio 1.8L (Magneti Marelli IAW 5NF)',
    category: 'MAGNETI_MARELLI',
    images: [
      {
        url: '/assets/aistudio/Screenshot_20261112_170418_com_facebook_katana_FbMainTabActivity_29a7e205.jpg',
        caption: 'Diagnostic 3: Electronic Throttle Driver MC33186DH and 1-Ohm (1R) current sense resistors verification'
      }
    ],
    symptoms: [
      'Electronic throttle body defect / malfunction (Limp mode active)',
      'Accelerator pedal unresponsive with throttle butterfly motor inactive',
    ],
    rootCauses: [
      {
        cause: 'Burnt 1-Ohm (1R) Current Sense Resistors or MC33186DH Failure',
        description: 'Electronic Throttle Controller IC (MC33186DH / 5NNX1) or current sense shunt resistors open-circuit.',
        severity: 'CRITICAL',
      },
    ],
    hardwareNote: 'Throttle Driver IC: MC33186DH (Cyan Arrow). Current sense resistors: Two surface-mount resistors marked 1R0 / 1R.',
    repairSteps: [
      { stepNum: 1, action: 'Measure Resistance on Current Sense Resistors (Yellow Arrow)', specification: 'Use DMM: Both resistors must read exactly 1.0 Ohm (1R). If open or drifting, replace immediately' },
      { stepNum: 2, action: 'Inspect Electronic Throttle Driver IC (MC33186DH)', specification: 'Check for thermal bubbling or short-circuit between H-bridge drive pins' },
      { stepNum: 3, action: 'Replace Defective Components via SMD Rework Station', specification: 'Install genuine 1Ω precision shunt resistors and MC33186DH controller' },
    ],
  },

  // 6. Magneti Marelli IAW 5NF Dead Module & 5V Regulator Trace Fracture
  {
    id: 'art-iaw-5nf-dead',
    dtcCode: 'IAW-5NF-04',
    title: 'Magneti Marelli IAW 5NF - Dead Module & Fuel Pump Relay Failure (5V Regulator Edge Trace)',
    vehicleModel: 'Fiat Stilo / Palio / Idea (Magneti Marelli IAW 5NF)',
    category: 'MAGNETI_MARELLI',
    images: [
      {
        url: '/assets/aistudio/Screenshot_20261112_170418_com_facebook_katana_FbMainTabActivity_29a7e205.jpg',
        caption: 'Diagnostic 4: Micro-jumper across broken edge trace to restore 5V to UE06AB6 regulator and fuel pump relay circuit'
      }
    ],
    symptoms: [
      'Module is completely unresponsive ("Dead Module" / No Communication)',
      'ECU fails to trigger the fuel pump relay at key-on',
      'Missing 5.0V regulated power supply at primary voltage regulator (UE06AB6)',
    ],
    rootCauses: [
      {
        cause: 'Board Edge Trace Fracture (5V Rail Pathway)',
        description: 'Micro-crack on PCB outer edge trace supplying 5V regulated power from UE06AB6 regulator.',
        severity: 'CRITICAL',
      },
    ],
    hardwareNote: '5V Voltage Regulator IC: UE06AB6 (Green Arrow). Edge trace fracture is frequent due to engine bay vibration and thermal cycling.',
    repairSteps: [
      { stepNum: 1, action: 'Trace 5V output line from UE06AB6 regulator to board edge', specification: 'Locate hairline fracture on PCB perimeter trace' },
      { stepNum: 2, action: 'Install micro-jumper across broken perimeter trace', specification: 'Solder fine insulated wire across the fractured trace to bridge 5V rail' },
      { stepNum: 3, action: 'Power Bench Test', specification: 'Confirm 5.00V restores across microcontroller and fuel pump relay latches normally' },
    ],
  },

  // 7. Toyota 1KD/2KD P0093 Fuel Leak & Dual-CPU #2 Fast Flashing
  {
    id: 'art-p0093-toyota-1kd',
    dtcCode: 'P0093',
    title: 'Toyota 1KD/2KD Fuel System Leak / P0093 & Dual-CPU #2 Fast-Flashing Diagnosis',
    vehicleModel: 'Toyota Hilux 1KD-FTV / 2KD-FTV, Fortuner, Innova (2005-2022)',
    category: 'TOYOTA_DENSO',
    images: [
      {
        url: '/assets/aistudio/Screenshot_20261112_145941_com_facebook_katana_ImmersiveActivity_0131e03d.jpg',
        caption: 'Dual-CPU Denso Architecture: CPU #1 (Denso/Toshiba Flash MCU) and CPU #2 (Sub-Processor) with 175822-887* board'
      },
      {
        url: '/assets/aistudio/Screenshot_20261112_145945_com_facebook_katana_ImmersiveActivity_0f70fb91.jpg',
        caption: 'Fast-Flashing Engine Light Source: CPU #2 Clock Crystal Oscillator (X-Tal) and dual 22pF load capacitors'
      },
      {
        url: '/assets/aistudio/Screenshot_20261112_145932_com_facebook_katana_ImmersiveActivity_9d5c7a34.jpg',
        caption: 'Diagnostic Trouble Code P0093: 4 Classic Symptoms & ECU Damage Causes in Toyota 1KD/2KD Repair Manual'
      }
    ],
    symptoms: [
      'The Engine light flashes rapidly (CPU #2 fault signal) and engine cannot be started',
      'Engine light is normal; engine starts then stalls after a while and will not restart until left to cool',
      'Rough idle; engine cuts out or stalls on acceleration',
      'Starts then stalls, stalls while driving, cuts out when accelerating to overtake',
    ],
    rootCauses: [
      {
        cause: 'Burnt ECU (Reverse Polarity Damage)',
        description: 'Caused by reversing positive and negative battery connections or jump-starting with reversed polarity.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Electric Welder Spike Damage',
        description: 'Connecting an electric welder to the vehicle chassis without removing both battery terminals.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Shorted Common Rail Injector Solenoid',
        description: 'Solenoid or piezo injector internal short circuit feeding high inductive kickback voltage back into ECU injector driver transistors.',
        severity: 'CRITICAL',
      },
    ],
    hardwareNote: 'Toyota 1KD/2KD ECU utilizes a dual-CPU architecture (CPU #1 and CPU #2). A fast-flashing Check Engine Light points directly to CPU #2 communication or crystal oscillator (X-Tal) failure.',
    cpuArchitecture: 'Dual-CPU System: CPU #1 manages main powertrain fuel delivery & injectors; CPU #2 monitors immobilizer, security, and watchdog safety loops. Fast-flashing = CPU #2 halt.',
    repairSteps: [
      { stepNum: 1, action: 'Inspect Main Power & Ground Terminals (KL30, KL31, IGSW)', specification: '12.6V constant on Pin 4 (+B), 0V solid ground on Pin 1 (E1)' },
      { stepNum: 2, action: 'Check CPU #2 Crystal Oscillator (X-Tal) & Peripheral Capacitors', specification: 'Measure 16MHz / 20MHz clock oscillation with oscilloscope' },
      { stepNum: 3, action: 'Test Injector Solenoid Resistance & Insulation Breakdown', specification: 'Resistance must be 12-16Ω (solenoid) or >10MΩ to ground' },
    ],
  },

  // 8. Bosch ME7.5 C167 Boot Mode Recovery
  {
    id: 'art-bosch-me75-boot',
    dtcCode: 'P0606',
    title: 'Bosch ME7.5 / ME7.1.1 C167 Microcontroller Boot Mode & Recovery Manual',
    vehicleModel: 'Volkswagen Golf 1.8T, Audi A4, VW Beetle, Skoda Octavia (ME7.5)',
    category: 'BOSCH_FORD',
    symptoms: [
      'ECU fails to communicate with VCDS or diagnostic scanner (No K-Line response)',
      'Engine crank but no start with corrupted flash memory or bricked flash session',
      'Constant high-speed radiator cooling fan run when key turned ON',
    ],
    rootCauses: [
      {
        cause: 'Corrupted Flash EEPROM Checksum',
        description: 'Improper tuning write or power drop during writing sequence.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Boot Pin Not Grounded During Boot Sequence',
        description: 'Infineon C167 processor failed to enter internal hardware bootloader mode.',
        severity: 'MODERATE',
      },
    ],
    hardwareNote: 'Requires grounding Pin 65 (Boot pin) through a 1kΩ resistor during initial ECU power-up (KL30 + KL15) to halt internal execution and listen for bootloader commands.',
    cpuArchitecture: 'Infineon C167 / ST10 16-bit Automotive Microcontroller with on-chip bootstrap loader.',
    repairSteps: [
      { stepNum: 1, action: 'Connect bench harness power to Pin 3 (KL30) and Pin 1/2 (KL31)', specification: '12.6V DC Bench Power Supply' },
      { stepNum: 2, action: 'Ground Pin 65 (Boot Pin) via 1kΩ resistor', specification: 'Active LOW during power-up transition' },
      { stepNum: 3, action: 'Apply Switched Ignition (+12V) to Pin 4 (KL15)', specification: 'Wake up ECU micro' },
      { stepNum: 4, action: 'Flash original stock binary via K-Line (Pin 43)', specification: '10.4 kbps ISO 9141 transfer' },
    ],
  },

  // 9. Ford SID208 FEPS Protocol Manual
  {
    id: 'art-ford-sid208',
    dtcCode: 'P0215',
    title: 'Ford Ranger / Everest SID208 PCM Bench Flashing & 18V FEPS Protocol',
    vehicleModel: 'Ford Ranger 2.2L / 3.2L & 2.0L Bi-Turbo, Everest (2012-2023)',
    category: 'BOSCH_FORD',
    symptoms: [
      'Instrument cluster dead, PATS security light flashing rapidly',
      'PCM programming failure during Ford IDS / Forscan module update',
      'High-Speed CAN bus communication timeout (U0100)',
    ],
    rootCauses: [
      {
        cause: 'FEPS Voltage Drop During Programming',
        description: 'Flash Programming Voltage (FEPS Pin B-12) must rise to 18V to enable flash write protection disable.',
        severity: 'CRITICAL',
      },
      {
        cause: 'Corrupted MS-CAN / HS-CAN Gateway Termination',
        description: 'Missing 120Ω terminating resistor on bench network harness.',
        severity: 'WARNING',
      },
    ],
    hardwareNote: 'Ford Visteon SID208 requires a specialized 18V FEPS programming pulse on Plug B Pin 12 to unlock internal flash sectors for writing.',
    cpuArchitecture: 'TriCore Tricore AURIX / Freescale MPC55xx High-Performance Automotive Engine Controller.',
    repairSteps: [
      { stepNum: 1, action: 'Connect Dual HS-CAN (Pin B-20/21) with 120Ω resistor', specification: '500 kbps Powertrain CAN' },
      { stepNum: 2, action: 'Apply 12V permanent power to Pin A-03 (VBAT)', specification: '12.6V constant' },
      { stepNum: 3, action: 'Apply 18V pulse to FEPS Pin B-12 during flash write request', specification: '18.0V Flash Enable Voltage' },
    ],
  },
];

interface EcuRepairKnowledgeBaseProps {
  savedSessions?: SavedBenchSession[];
  savedLogs?: SavedDiagnosticLog[];
  liveActiveDtcs?: DiagnosticTroubleCode[];
  onOpenSavedBenches?: () => void;
}

export const EcuRepairKnowledgeBase: React.FC<EcuRepairKnowledgeBaseProps> = ({
  savedSessions = [],
  savedLogs = [],
  liveActiveDtcs = [],
  onOpenSavedBenches,
}) => {
  const [activeMode, setActiveMode] = useState<'OEM_MANUALS' | 'LIVE_GROUNDING_SEARCH'>('OEM_MANUALS');
  const [groundingPrefill, setGroundingPrefill] = useState<{ query: string; ecu: string; dtc: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<RepairArticle>(REPAIR_KNOWLEDGE_BASE[0]);

  const filteredArticles = REPAIR_KNOWLEDGE_BASE.filter(art => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      art.dtcCode.toLowerCase().includes(q) ||
      art.title.toLowerCase().includes(q) ||
      art.vehicleModel.toLowerCase().includes(q) ||
      art.symptoms.some(s => s.toLowerCase().includes(q));

    const matchesCat = selectedCategory === 'ALL' || art.category === selectedCategory;

    return matchesSearch && matchesCat;
  });

  const handleLaunchArticleGrounding = (art: RepairArticle) => {
    setGroundingPrefill({
      query: `${art.vehicleModel} ${art.dtcCode} ${art.title} bench testing wiring diagnostic bulletin`,
      ecu: art.vehicleModel,
      dtc: art.dtcCode,
    });
    setActiveMode('LIVE_GROUNDING_SEARCH');
  };

  const handleSelectDtcFromChart = (dtcCode: string) => {
    const codeUpper = dtcCode.toUpperCase();
    const matched = REPAIR_KNOWLEDGE_BASE.find(
      (art) =>
        art.dtcCode.toUpperCase().includes(codeUpper) ||
        art.title.toUpperCase().includes(codeUpper) ||
        art.symptoms.some((s) => s.toUpperCase().includes(codeUpper))
    );

    if (matched) {
      setSelectedCategory('ALL');
      setSearchQuery(dtcCode);
      setSelectedArticle(matched);
      setActiveMode('OEM_MANUALS');
    } else {
      setGroundingPrefill({
        query: `${dtcCode} automotive ECU bench diagnostic procedure pinout TSB`,
        ecu: 'Universal ECU Bench',
        dtc: dtcCode,
      });
      setActiveMode('LIVE_GROUNDING_SEARCH');
    }
  };

  const handleSearchGroundingForDtc = (dtcCode: string) => {
    setGroundingPrefill({
      query: `${dtcCode} automotive ECU diagnostic procedure wiring pinout bulletin`,
      ecu: 'Universal ECU Bench',
      dtc: dtcCode,
    });
    setActiveMode('LIVE_GROUNDING_SEARCH');
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden text-slate-100 p-1 font-mono select-none">
      
      {/* Top Header Toolbar */}
      <div className="hud-panel rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
            alt="AutoElectric Lab Pro Official Logo"
            className="h-8 w-auto object-contain rounded border border-cyan-500/40 shadow-sm"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-hud font-bold text-slate-100 tracking-wide uppercase">
                ECU Repair Knowledge Base & OEM Bulletins
              </h2>
              <span className="text-[10px] text-cyan-300 bg-cyan-950/70 border border-cyan-600/60 px-2 py-0.5 rounded font-semibold">
                {REPAIR_KNOWLEDGE_BASE.length} OEM Guides Loaded
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              OEM Manuals (Nissan MEC11/22, Marelli 5NF, Toyota 1KD/2KD, ME7.5, SID208) + Live Google Search Grounding
            </p>
          </div>
        </div>

        {/* View Mode Switcher: OEM Manuals vs Live Google Search Grounding */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveMode('OEM_MANUALS')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 ${
                activeMode === 'OEM_MANUALS'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>OEM Manuals</span>
            </button>
            <button
              onClick={() => setActiveMode('LIVE_GROUNDING_SEARCH')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 ${
                activeMode === 'LIVE_GROUNDING_SEARCH'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Google Search Grounding</span>
              <span className="text-[9px] bg-blue-900/80 px-1 rounded text-cyan-200 font-mono">Live</span>
            </button>
          </div>

          {activeMode === 'OEM_MANUALS' && (
            <div className="flex items-center gap-2">
              <div className="relative hidden xl:block w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter manuals..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="NISSAN_HITACHI">Nissan Hitachi</option>
                <option value="MAGNETI_MARELLI">Marelli 5NF</option>
                <option value="TOYOTA_DENSO">Toyota 1KD/2KD</option>
                <option value="BOSCH_FORD">Bosch & Ford</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Conditionally Render: Live Google Grounding Search vs OEM Manuals */}
      {activeMode === 'LIVE_GROUNDING_SEARCH' ? (
        <div className="flex-1 overflow-y-auto">
          <GroundedSearchPanel
            initialQuery={groundingPrefill?.query || ''}
            initialEcu={groundingPrefill?.ecu || ''}
            initialDtc={groundingPrefill?.dtc || ''}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden min-h-0">
          <DtcFrequencyWidget
            savedSessions={savedSessions}
            savedLogs={savedLogs}
            liveActiveDtcs={liveActiveDtcs}
            onSelectDtc={handleSelectDtcFromChart}
            onSearchGroundingDtc={handleSearchGroundingForDtc}
            onOpenSavedBenches={onOpenSavedBenches}
          />

          <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-y-auto lg:overflow-hidden min-h-0">
        
        {/* Left Column: Article Index List */}
        <div className="w-full lg:w-[380px] flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-hidden shadow-inner shrink-0">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-200">REPAIR MANUAL INDEX</span>
            <span className="text-slate-500 text-[10px]">{filteredArticles.length} Manuals Found</span>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {filteredArticles.map(art => {
              const isSelected = selectedArticle.id === art.id;
              return (
                <div
                  key={art.id}
                  onClick={() => setSelectedArticle(art)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-400 shadow-md ring-1 ring-cyan-400/40 text-white'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700 text-amber-300 font-bold font-mono text-[10px]">
                      {art.dtcCode}
                    </span>
                    <span className="text-[9px] text-cyan-400 uppercase font-semibold">
                      {art.category.replace('_', ' ')}
                    </span>
                  </div>

                  <span className="font-bold text-slate-100 line-clamp-1">{art.title}</span>
                  <span className="text-[10px] text-slate-400 font-sans line-clamp-1">{art.vehicleModel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Repair Manual View */}
        <div className="flex-1 flex flex-col gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto shadow-inner">
          
          {/* Article Header */}
          <div className="flex flex-col gap-1.5 border-b border-slate-800 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-600 text-amber-300 font-bold font-mono text-xs">
                  {selectedArticle.dtcCode}
                </span>
                <span className="text-xs text-cyan-400 font-semibold uppercase bg-cyan-950/70 border border-cyan-800 px-2 py-0.5 rounded">
                  {selectedArticle.category.replace('_', ' ')}
                </span>
              </div>
              <button
                onClick={() => handleLaunchArticleGrounding(selectedArticle)}
                className="self-start sm:self-auto text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-950 to-cyan-950 hover:from-blue-900 hover:to-cyan-900 border border-cyan-500/70 text-cyan-200 flex items-center gap-1.5 transition font-mono font-semibold shadow-sm"
                title="Search live Google Search Grounding for this specific ECU & DTC"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Search Live OEM TSBs on Google</span>
              </button>
            </div>
            <h1 className="text-base font-bold text-slate-100 tracking-wide mt-1">
              {selectedArticle.title}
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              <strong className="text-slate-300">Vehicle Models:</strong> {selectedArticle.vehicleModel}
            </p>
          </div>

          {/* CPU Architecture & Hardware Note Box */}
          {selectedArticle.cpuArchitecture && (
            <div className="bg-slate-950 p-3 rounded-lg border border-cyan-500/50 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-[11px]">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>HARDWARE ARCHITECTURE NOTE:</span>
              </div>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                {selectedArticle.cpuArchitecture}
              </p>
              {selectedArticle.hardwareNote && (
                <p className="text-amber-300 font-sans text-[11px] bg-amber-950/40 p-2 rounded border border-amber-800/60 mt-1">
                  💡 <strong>Expert Insight:</strong> {selectedArticle.hardwareNote}
                </p>
              )}
            </div>
          )}

          {/* Hardware Photographic Documentation Gallery */}
          {selectedArticle.images && selectedArticle.images.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Physical Hardware & PCB Photographic Documentation:</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedArticle.images.map((img, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                    <div className="relative aspect-video rounded-md overflow-hidden border border-slate-700 bg-black flex items-center justify-center">
                      <img
                        src={img.url}
                        alt={img.caption}
                        className="w-full h-full object-contain hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-[11px] text-cyan-300 font-sans leading-relaxed">
                      <strong className="text-slate-200 font-semibold">Photo {idx + 1}:</strong> {img.caption}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Symptoms List */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Classic Symptoms & Fault Manifestations:</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedArticle.symptoms.map((symptom, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-950 border border-rose-700 text-rose-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="font-sans leading-snug">{symptom}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Root Causes */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Primary Root Causes & ECU Damage Sources:</span>
            </h3>
            <div className="flex flex-col gap-2">
              {selectedArticle.rootCauses.map((rc, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      {rc.cause}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                      rc.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border-rose-700' : 'bg-amber-950 text-amber-300 border-amber-700'
                    }`}>
                      {rc.severity}
                    </span>
                  </div>
                  <p className="text-slate-400 font-sans text-xs">{rc.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Repair Steps */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span>Step-by-Step Bench Repair & Testing Procedure:</span>
            </h3>
            <div className="flex flex-col gap-2">
              {selectedArticle.repairSteps.map(step => (
                <div key={step.stepNum} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-600 font-bold text-cyan-300 flex items-center justify-center text-xs shrink-0 font-mono">
                    {step.stepNum}
                  </span>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="font-bold text-slate-100 text-xs">{step.action}</span>
                    <span className="text-[11px] text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-900/60 font-mono">
                      <strong>Specification / Routing:</strong> {step.specification}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        </div>
      </div>
      )}
    </div>
  );
};
