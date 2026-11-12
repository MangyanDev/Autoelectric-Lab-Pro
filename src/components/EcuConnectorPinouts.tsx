import React, { useState } from 'react';
import { EcuPin, MultimeterState, PowerSupplyState } from '../types/ecu';
import {
  Cpu,
  Zap,
  Activity,
  Disc,
  Search,
  CheckCircle2,
  Info,
  Maximize2,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Layers,
  ArrowRight,
  Terminal,
  Car,
  Check,
  Globe,
} from 'lucide-react';

export interface BenchPinoutInfo {
  pinNumber: number;
  plug: string; // Plug chamber name e.g. 'PLUG_A_81PIN', 'PLUG_A_34PIN', etc.
  label: string;
  signalName: string;
  category: 'power' | 'ground' | 'communication' | 'sensor_in' | 'actuator_out' | 'boot';
  nominalVoltage: number;
  wireColor: string;
  colorHex: string;
  benchRole: string;
  connectionInstruction: string;
  electricalSpec: string;
  associatedSimPinId?: string; // Links to live circuit simulation
  connectorCoords?: { xPercent: number; yPercent: number }; // Relative position on the connector image
}

export interface PcbComponentPoint {
  id: string;
  name: string;
  designation: string; // Component silk marking e.g. 'R701 / R702 / R703 (028)', 'C844-C879'
  type: 'shunt' | 'capacitor' | 'resistor' | 'diode' | 'transistor' | 'connector_header' | 'ground_bond';
  xPercent: number;
  yPercent: number;
  spec: string;
  diagnosticRole: string;
  associatedPins?: string;
  associatedSimPinId?: string;
}

export interface EcuBrandProfile {
  id: string;
  brandName: string;
  modelName: string;
  cavityInfo: string;
  popularVehiclesInPH: string;
  description: string;
  imageSrc: string;
  pcbImageSrc?: string;
  pcbComponents?: PcbComponentPoint[];
  plugs: { id: string; label: string }[];
  essentialChecklist: { pin: string; role: string }[];
  pinouts: BenchPinoutInfo[];
}

export const ECU_BRAND_PROFILES: EcuBrandProfile[] = [
  // 1. Bosch ME7.5 (VAG Benchmark)
  {
    id: 'bosch-me75',
    brandName: 'Bosch Automotive',
    modelName: 'Bosch ME7.5 / ME7.1.1 (121-Pin)',
    cavityInfo: '121-Pin Dual Chamber (Plug A: 81-Pin / Plug B: 40-Pin)',
    popularVehiclesInPH: 'Volkswagen Polo/Golf, Audi A4/A6, VW Beetle 1.8T / 2.0L Petrol',
    description: 'Industry benchmark Bosch 16-bit ECU using C167 MCU. Common in European models and bench flashing training.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_81PIN', label: 'Plug A (81-Pin)' },
      { id: 'PLUG_B_40PIN', label: 'Plug B (40-Pin)' },
    ],
    essentialChecklist: [
      { pin: 'Pin 1 & 2', role: 'Main Chassis Ground (KL31)' },
      { pin: 'Pin 3', role: '+12V Unswitched Permanent Memory (KL30)' },
      { pin: 'Pin 4', role: '+12V Switched Ignition Wake-up (KL15)' },
      { pin: 'Pin 43', role: 'K-Line Diagnostic (OBD-II Pin 7)' },
      { pin: 'Pin 58 / 62', role: 'CAN-H / CAN-L (120Ω Terminated)' },
      { pin: 'Pin 65', role: 'Boot Mode (1kΩ to GND for flashing)' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_81PIN',
        label: 'KL31',
        signalName: 'Main Power Ground 1',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown (BN)',
        colorHex: '#78350f',
        benchRole: 'Primary Chassis Ground Return',
        connectionInstruction: 'Connect to Bench Power Supply Negative (-) / Ground Terminal',
        electricalSpec: '0.0V Ground Sink (Max 15A)',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.5, yPercent: 44.5 },
      },
      {
        pinNumber: 2,
        plug: 'PLUG_A_81PIN',
        label: 'KL31_2',
        signalName: 'Main Power Ground 2',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown (BN)',
        colorHex: '#78350f',
        benchRole: 'Secondary Power Ground Return',
        connectionInstruction: 'Bridge with Pin 1 to Bench Power Supply Negative (-)',
        electricalSpec: '0.0V Ground Sink (Redundant Safety Ground)',
        associatedSimPinId: 'ecu-pin-2',
        connectorCoords: { xPercent: 26.2, yPercent: 44.5 },
      },
      {
        pinNumber: 3,
        plug: 'PLUG_A_81PIN',
        label: 'KL30',
        signalName: 'Permanent Battery Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red / Blue (RD/BU)',
        colorHex: '#ef4444',
        benchRole: 'Continuous ECU Memory & Microcontroller VBat',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.0V - +14.4V DC (Quiescent draw ~40mA)',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.5 },
      },
      {
        pinNumber: 4,
        plug: 'PLUG_A_81PIN',
        label: 'KL15',
        signalName: 'Switched Ignition +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Black / Violet (BK/VT)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Wake-up Trigger',
        connectionInstruction: 'Connect to Bench Toggle Switch from +12V (Turns ECU ON/OFF)',
        electricalSpec: '+12.6V Active, 0.0V Sleep / Off',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 29.8, yPercent: 44.5 },
      },
      {
        pinNumber: 21,
        plug: 'PLUG_A_81PIN',
        label: 'MRELAY',
        signalName: 'Main Engine Relay Control (J271)',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Blue / Yellow (BU/YE)',
        colorHex: '#3b82f6',
        benchRole: 'ECU-Controlled Relay Pull-Down Sink',
        connectionInstruction: 'Connect to Bench Relay Coil 85 (or 100Ω pull-up to +12V)',
        electricalSpec: 'Low-side MOSFET ground switch (Sinks coil current when ignition active)',
        associatedSimPinId: 'ecu-pin-12',
        connectorCoords: { xPercent: 32.5, yPercent: 48.0 },
      },
      {
        pinNumber: 43,
        plug: 'PLUG_A_81PIN',
        label: 'K-LINE',
        signalName: 'Bidirectional Serial Diagnostics (ISO 9141-2)',
        category: 'communication',
        nominalVoltage: 12.0,
        wireColor: 'Green / White (GN/WH)',
        colorHex: '#10b981',
        benchRole: 'OBD-II Diagnostic & Flash Communication',
        connectionInstruction: 'Connect to Bench OBD-II Port Pin 7 (or KKL/VCDS USB cable K-line)',
        electricalSpec: '10.4 kbps UART (High idle at +12V, pulled low during data packets)',
        associatedSimPinId: 'ecu-pin-16',
        connectorCoords: { xPercent: 41.0, yPercent: 48.0 },
      },
      {
        pinNumber: 58,
        plug: 'PLUG_A_81PIN',
        label: 'CAN_H',
        signalName: 'High-Speed CAN High (ISO 11898)',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange / Black (OG/BK)',
        colorHex: '#f97316',
        benchRole: '500 kbps Powertrain High-Speed CAN Bus (+)',
        connectionInstruction: 'Connect to Bench OBD-II Port Pin 6 and 120Ω terminating resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 62,
        plug: 'PLUG_A_81PIN',
        label: 'CAN_L',
        signalName: 'High-Speed CAN Low (ISO 11898)',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange / Brown (OG/BN)',
        colorHex: '#ea580c',
        benchRole: '500 kbps Powertrain High-Speed CAN Bus (-)',
        connectionInstruction: 'Connect to Bench OBD-II Port Pin 14 and 120Ω terminating resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
      {
        pinNumber: 65,
        plug: 'PLUG_A_81PIN',
        label: 'BOOT',
        signalName: 'Microcontroller Boot Mode Pin',
        category: 'boot',
        nominalVoltage: 3.3,
        wireColor: 'Grey (GY)',
        colorHex: '#64748b',
        benchRole: 'Infineon C167 / ST10 Boot Mode Flash & Recovery',
        connectionInstruction: 'Connect to Ground through 1kΩ or 100Ω resistor during power-up',
        electricalSpec: 'Active LOW on power-up to halt processor execution into internal bootloader',
        connectorCoords: { xPercent: 56.5, yPercent: 48.0 },
      },
      {
        pinNumber: 98,
        plug: 'PLUG_B_40PIN',
        label: 'VREF_5V',
        signalName: 'Regulated 5.00V Sensor Supply',
        category: 'power',
        nominalVoltage: 5.0,
        wireColor: 'Violet / Red (VT/RD)',
        colorHex: '#eab308',
        benchRole: 'Precision 5.00V Reference Rail for Analog Sensors',
        connectionInstruction: 'Feeds TPS, MAP, and Pressure Sensors on Bench',
        electricalSpec: '5.00V ± 0.05V (Max current 150mA with thermal short-circuit protection)',
        associatedSimPinId: 'ecu-pin-5',
        connectorCoords: { xPercent: 68.5, yPercent: 44.5 },
      },
      {
        pinNumber: 108,
        plug: 'PLUG_B_40PIN',
        label: 'SGND',
        signalName: 'Analog Sensor Clean Ground Return',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown / Blue (BN/BU)',
        colorHex: '#78716c',
        benchRole: 'Dedicated Analog Ground Return (Noise-Isolated)',
        connectionInstruction: 'Connect to Sensor Low-Side Returns (Do NOT short to noisy chassis GND)',
        electricalSpec: '0.0V Analog Return with dedicated internal star ground plane',
        associatedSimPinId: 'ecu-pin-6',
        connectorCoords: { xPercent: 74.0, yPercent: 52.0 },
      },
      {
        pinNumber: 92,
        plug: 'PLUG_B_40PIN',
        label: 'TPS_SIG',
        signalName: 'Throttle Position Sensor Signal 1 (G79)',
        category: 'sensor_in',
        nominalVoltage: 0.85,
        wireColor: 'Green / Black (GN/BK)',
        colorHex: '#22c55e',
        benchRole: 'Analog Potentiometer 1 Track Input',
        connectionInstruction: 'Connect to Bench TPS Wiper or 0.5V - 4.5V variable voltage source',
        electricalSpec: '0.50V (Idle / Closed) to 4.50V (Wide Open Throttle)',
        associatedSimPinId: 'ecu-pin-7',
        connectorCoords: { xPercent: 66.5, yPercent: 48.0 },
      },
      {
        pinNumber: 96,
        plug: 'PLUG_B_40PIN',
        label: 'INJ_1',
        signalName: 'Cylinder 1 Fuel Injector Driver',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Grey / Yellow (GY/YE)',
        colorHex: '#3b82f6',
        benchRole: 'Solenoid Low-Side Ground Switch Output',
        connectionInstruction: 'Connect to Bench Injector Solenoid (12-16Ω) or LED test light to +12V',
        electricalSpec: 'Low-side MOSFET with 65V active clamp protection',
        associatedSimPinId: 'ecu-pin-10',
        connectorCoords: { xPercent: 69.5, yPercent: 48.0 },
      },
    ],
  },

  // 2. Toyota Denso 175822 / 275036 (Philippines' #1 Selling Vehicle ECU)
  {
    id: 'toyota-denso-175822',
    brandName: 'Toyota / Denso',
    modelName: 'Denso 175822 / 275036 (121-Pin Quad Plug)',
    cavityInfo: '121-Pin Quad Plug (Chamber A: 34P, B: 35P, C: 28P, D: 24P)',
    popularVehiclesInPH: 'Toyota Vios (1NZ-FE/2NZ-FE), Innova, Fortuner (1TR-FE/2TR-FE/2KD-FTV), Hilux 2005-2022',
    description: 'The most widely repaired ECU in the Philippines. Powers taxis, UV Express vans, private Vios sedans, and Hilux pickups.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    pcbImageSrc: '/assets/aistudio/Screenshot_20261112_145941_com_facebook_katana_ImmersiveActivity_0131e03d.jpg',
    pcbComponents: [
      {
        id: 'pcb-toyota-cpu1',
        name: 'CPU #1: Main Powertrain Microcontroller',
        designation: 'CPU #1 (Denso / Toshiba 76F00xx Flash MCU)',
        type: 'transistor',
        xPercent: 64.0,
        yPercent: 26.0,
        spec: '32-Bit RISC Automotive MCU, 16MHz Operating Frequency',
        diagnosticRole: 'Executes core fuel map lookup, throttle fly-by-wire calculation, and cylinder-by-cylinder common rail injector drive timing. Normal communication indicates valid 5V supply and intact crystal.',
        associatedPins: 'Plug A Pins 4, 8, 12, 16',
        associatedSimPinId: 'ecu-pin-3',
      },
      {
        id: 'pcb-toyota-cpu2',
        name: 'CPU #2: Safety & Supervisory Co-Processor',
        designation: 'CPU #2 (Denso Sub-Processor - Security & Watchdog)',
        type: 'transistor',
        xPercent: 37.0,
        yPercent: 26.0,
        spec: 'Dedicated Watchdog & Immobilizer Security Processor',
        diagnosticRole: 'Monitors fuel rail pressure plausibility, injector timing plausibility, and vehicle security handshakes. A fast-flashing Check Engine Light (MIL) specifically indicates CPU #2 has halted or lost clock synchronization, frequently logging false DTC P0093.',
        associatedPins: 'Plug A Pin 16 (SIL / K-Line), Plug B Pin 4',
        associatedSimPinId: 'ecu-pin-16',
      },
      {
        id: 'pcb-toyota-xtal',
        name: 'X-Tal Clock Quartz Resonator & Filter Caps',
        designation: 'X-Tal Resonator (CPU #2 Clock Generator)',
        type: 'capacitor',
        xPercent: 76.5,
        yPercent: 28.0,
        spec: '16.000 MHz / 20.000 MHz Ceramic-Sealed Quartz Resonator + 22pF Load Caps',
        diagnosticRole: 'Supplies clock pulses to CPU #2. Susceptible to fatigue fractures from engine bay vibration. Failure halts CPU #2, producing the classic fast-flashing engine light and P0093 fuel leak DTC even when fuel pressure is normal.',
        associatedPins: 'CPU #2 Osc-In / Osc-Out Pins',
        associatedSimPinId: 'ecu-pin-16',
      },
      {
        id: 'pcb-toyota-inj-driver',
        name: 'Common Rail High-Voltage Injector Driver Array',
        designation: 'Denso Custom MOSFET & Inductive Clamping Stage',
        type: 'transistor',
        xPercent: 28.0,
        yPercent: 42.0,
        spec: 'High-Current Low-Side Drivers with >80V Flyback Clamp Diodes',
        diagnosticRole: 'Drives solenoid injectors on 1KD/2KD engines. Reverse-polarity jump starting or welding without disconnecting battery terminals causes avalanche breakdown in these driver MOSFETs.',
        associatedPins: 'Plug C Injector Pins 1, 2, 3, 4',
        associatedSimPinId: 'ecu-pin-12',
      },
      {
        id: 'pcb-toyota-header',
        name: 'Quad-Chamber Header Through-Hole Header Array',
        designation: 'Header 2271A / 2270 / MRC1 / LH',
        type: 'connector_header',
        xPercent: 50.0,
        yPercent: 51.0,
        spec: '121-Pin Heavy-Gauge Solder Terminals',
        diagnosticRole: 'Interconnects PCB traces with the external wire harness. Inspect for cold solder joints or pin fretting corrosion causing intermittent throttle or injector open-circuit DTCs.',
        associatedPins: 'Chamber A, B, C, D 121 Pins',
        associatedSimPinId: 'ecu-pin-1',
      },
    ],
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_34P', label: 'Plug A (34-Pin Power)' },
      { id: 'PLUG_B_35P', label: 'Plug B (35-Pin Sensor)' },
      { id: 'PLUG_C_28P', label: 'Plug C (28-Pin Driver)' },
    ],
    essentialChecklist: [
      { pin: 'Pin 1 (E1)', role: 'Engine Power Ground' },
      { pin: 'Pin 4 (+B / BAT)', role: 'Battery Permanent +12V Supply' },
      { pin: 'Pin 8 (IGSW)', role: 'Ignition Key Switch +12V Input' },
      { pin: 'Pin 12 (MREL)', role: 'Main EFI Relay Control Pull-Down' },
      { pin: 'Pin 16 (SIL)', role: 'K-Line / OBD-II Diagnostic Bus (Pin 7)' },
      { pin: 'Pin 22 & 23', role: 'CAN-H / CAN-L Powertrain Bus' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_34P',
        label: 'E1',
        signalName: 'Main Chassis Ground Return',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown / Black (BN/BK)',
        colorHex: '#78350f',
        benchRole: 'Primary Engine Ground Return',
        connectionInstruction: 'Connect to Bench Power Supply (-) / Ground terminal',
        electricalSpec: '0.0V Solid Ground (Max 20A sink capability)',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.0, yPercent: 44.0 },
      },
      {
        pinNumber: 4,
        plug: 'PLUG_A_34P',
        label: '+B (BAT)',
        signalName: 'Permanent Battery Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red / Yellow (RD/YL)',
        colorHex: '#ef4444',
        benchRole: 'ECU SRAM & Memory Power',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.0V to +14.4V DC',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.0 },
      },
      {
        pinNumber: 8,
        plug: 'PLUG_A_34P',
        label: 'IGSW',
        signalName: 'Switched Ignition Power +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Black / Red (BK/RD)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Switch Wake-up Trigger',
        connectionInstruction: 'Connect through Bench Toggle Switch to +12V',
        electricalSpec: '+12.6V Active, 0.0V Off',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 30.0, yPercent: 44.0 },
      },
      {
        pinNumber: 12,
        plug: 'PLUG_A_34P',
        label: 'MREL',
        signalName: 'Main EFI Relay Control Output',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Blue / Black (BU/BK)',
        colorHex: '#3b82f6',
        benchRole: 'EFI Main Relay Coil Sink',
        connectionInstruction: 'Connect to Bench Relay Coil terminal (low-side sink when IGSW active)',
        electricalSpec: 'Low-side driver switch',
        associatedSimPinId: 'ecu-pin-12',
        connectorCoords: { xPercent: 33.0, yPercent: 48.0 },
      },
      {
        pinNumber: 16,
        plug: 'PLUG_A_34P',
        label: 'SIL',
        signalName: 'K-Line Diagnostic Bus (OBD-II Pin 7)',
        category: 'communication',
        nominalVoltage: 12.0,
        wireColor: 'Violet / White (VT/WH)',
        colorHex: '#10b981',
        benchRole: 'Techstream / OBD-II Scanner Diagnostics',
        connectionInstruction: 'Connect to OBD-II Diagnostic Connector Pin 7 (ISO 9141)',
        electricalSpec: '10.4 kbps UART bidirectional diagnostic line',
        associatedSimPinId: 'ecu-pin-16',
        connectorCoords: { xPercent: 41.0, yPercent: 48.0 },
      },
      {
        pinNumber: 22,
        plug: 'PLUG_A_34P',
        label: 'CANH',
        signalName: 'Toyota High-Speed CAN High',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange / Black (OG/BK)',
        colorHex: '#f97316',
        benchRole: 'Powertrain High-Speed CAN Bus (+)',
        connectionInstruction: 'Connect to OBD-II Pin 6 and 120Ω terminating resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant (500 kbps)',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 23,
        plug: 'PLUG_A_34P',
        label: 'CANL',
        signalName: 'Toyota High-Speed CAN Low',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange / Brown (OG/BN)',
        colorHex: '#ea580c',
        benchRole: 'Powertrain High-Speed CAN Bus (-)',
        connectionInstruction: 'Connect to OBD-II Pin 14 and 120Ω terminating resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant (500 kbps)',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
      {
        pinNumber: 31,
        plug: 'PLUG_B_35P',
        label: 'VC',
        signalName: 'Regulated 5.00V Sensor Reference',
        category: 'power',
        nominalVoltage: 5.0,
        wireColor: 'Yellow / Red (YE/RD)',
        colorHex: '#eab308',
        benchRole: 'Precision 5.0V Sensor Rail',
        connectionInstruction: 'Supplies TPS and MAP Sensor VREF on bench',
        electricalSpec: '5.00V ± 0.05V (Max 100mA draw)',
        associatedSimPinId: 'ecu-pin-5',
        connectorCoords: { xPercent: 68.5, yPercent: 44.5 },
      },
      {
        pinNumber: 33,
        plug: 'PLUG_B_35P',
        label: 'E2',
        signalName: 'Sensor Clean Signal Ground',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown / Black (BN/BK)',
        colorHex: '#78716c',
        benchRole: 'Analog Sensor Dedicated Return',
        connectionInstruction: 'Connect to Sensor Low-Side Returns (Isolated from chassis noise)',
        electricalSpec: '0.0V Clean Sensor Return Plane',
        associatedSimPinId: 'ecu-pin-6',
        connectorCoords: { xPercent: 74.0, yPercent: 52.0 },
      },
      {
        pinNumber: 41,
        plug: 'PLUG_B_35P',
        label: 'VTA1',
        signalName: 'Throttle Position Sensor Track 1 (1NZ/1TR)',
        category: 'sensor_in',
        nominalVoltage: 0.7,
        wireColor: 'Green / White (GN/WH)',
        colorHex: '#22c55e',
        benchRole: 'Analog TPS Potentiometer Input',
        connectionInstruction: 'Connect to Bench TPS wiper (0.6V idle -> 4.2V WOT)',
        electricalSpec: '0.6V Idle, 4.2V WOT linear analog ADC',
        associatedSimPinId: 'ecu-pin-7',
        connectorCoords: { xPercent: 66.5, yPercent: 48.0 },
      },
      {
        pinNumber: 61,
        plug: 'PLUG_C_28P',
        label: '#10 (#1)',
        signalName: 'Cylinder 1 Fuel Injector Driver',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Grey / Black (GY/BK)',
        colorHex: '#3b82f6',
        benchRole: 'Injector Solenoid Low-side Switch',
        connectionInstruction: 'Connect to Bench Injector Load Resistor (12Ω) to +12V',
        electricalSpec: 'Low-side N-channel MOSFET ground driver',
        associatedSimPinId: 'ecu-pin-10',
        connectorCoords: { xPercent: 69.5, yPercent: 48.0 },
      },
    ],
  },

  // 3. Ford FoMoCo SID208 / SID209 / Visteon PCM (Ford Ranger / Everest - PH Diesel Pickup/SUV Leader)
  {
    id: 'ford-fomoco-sid208',
    brandName: 'Ford / FoMoCo',
    modelName: 'Ford FoMoCo SID208 / SID209 / PCM (154-Pin)',
    cavityInfo: '154-Pin Triple Chamber (Plug A: 50P, Plug B: 54P, Plug C: 50P)',
    popularVehiclesInPH: 'Ford Ranger 2.2L/3.2L & 2.0L Bi-Turbo, Ford Everest, Ranger Raptor, EcoSport 1.5L',
    description: 'Widely repaired diesel pickup & SUV PCM in PH. Features dual HS-CAN & MS-CAN networks with Ford FEPS high voltage flash line.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_50P', label: 'Plug A (Power & GND)' },
      { id: 'PLUG_B_54P', label: 'Plug B (HS/MS-CAN & FEPS)' },
      { id: 'PLUG_C_50P', label: 'Plug C (Injectors & Solenoids)' },
    ],
    essentialChecklist: [
      { pin: 'Pin A-01 & A-02', role: 'Main Ground Return (GND)' },
      { pin: 'Pin A-03 (VBAT)', role: 'Continuous Battery +12V Feed' },
      { pin: 'Pin A-05 (IGN)', role: 'Switched Ignition +12V Key-ON' },
      { pin: 'Pin B-12 (FEPS)', role: 'FEPS Flash Line (18V Flashing Signal)' },
      { pin: 'Pin B-20 & B-21', role: 'HS-CAN High/Low (500 kbps)' },
      { pin: 'Pin B-22 & B-23', role: 'MS-CAN High/Low (125 kbps)' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_50P',
        label: 'GND_1',
        signalName: 'Main PCM Power Ground 1',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black / Blue (BK/BU)',
        colorHex: '#78350f',
        benchRole: 'Chassis Power Ground',
        connectionInstruction: 'Connect to Bench Power Supply (-) Terminal',
        electricalSpec: '0.0V Ground Return (Max 25A sink)',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.5, yPercent: 44.5 },
      },
      {
        pinNumber: 3,
        plug: 'PLUG_A_50P',
        label: 'VBAT',
        signalName: 'Permanent Battery Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Yellow / Red (YE/RD)',
        colorHex: '#ef4444',
        benchRole: 'Continuous PCM SRAM Power',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.6V DC Memory Power',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.5 },
      },
      {
        pinNumber: 5,
        plug: 'PLUG_A_50P',
        label: 'IGN',
        signalName: 'Switched Ignition Power +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Violet / Green (VT/GN)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Key Switch Wake-up',
        connectionInstruction: 'Connect to Bench Toggle Switch from +12V',
        electricalSpec: '+12.6V Active Key-ON',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 30.0, yPercent: 44.5 },
      },
      {
        pinNumber: 12,
        plug: 'PLUG_B_54P',
        label: 'FEPS',
        signalName: 'Ford Flash FEPS Programming Line (K-Line)',
        category: 'communication',
        nominalVoltage: 12.0,
        wireColor: 'White / Violet (WH/VT)',
        colorHex: '#10b981',
        benchRole: 'Ford IDS / Forscan ECU Flashing Trigger',
        connectionInstruction: 'Connect to OBD-II Pin 13 / FEPS flash line (Requires 18V during flash programming)',
        electricalSpec: '12V Idle, 18V Programming High Signal',
        associatedSimPinId: 'ecu-pin-16',
        connectorCoords: { xPercent: 41.0, yPercent: 48.0 },
      },
      {
        pinNumber: 20,
        plug: 'PLUG_B_54P',
        label: 'HS_CAN_H',
        signalName: 'High-Speed CAN High (Powertrain)',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Gray / Orange (GY/OG)',
        colorHex: '#f97316',
        benchRole: '500 kbps HS-CAN Bus (+)',
        connectionInstruction: 'Connect to OBD-II Pin 6 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 21,
        plug: 'PLUG_B_54P',
        label: 'HS_CAN_L',
        signalName: 'High-Speed CAN Low (Powertrain)',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Violet / Orange (VT/OG)',
        colorHex: '#ea580c',
        benchRole: '500 kbps HS-CAN Bus (-)',
        connectionInstruction: 'Connect to OBD-II Pin 14 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
      {
        pinNumber: 22,
        plug: 'PLUG_B_54P',
        label: 'MS_CAN_H',
        signalName: 'Medium-Speed CAN High (Body/IPC)',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'White / Blue (WH/BU)',
        colorHex: '#38bdf8',
        benchRole: '125 kbps MS-CAN Bus (+)',
        connectionInstruction: 'Connect to OBD-II Pin 3 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        connectorCoords: { xPercent: 56.0, yPercent: 44.5 },
      },
      {
        pinNumber: 23,
        plug: 'PLUG_B_54P',
        label: 'MS_CAN_L',
        signalName: 'Medium-Speed CAN Low (Body/IPC)',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'White (WH)',
        colorHex: '#94a3b8',
        benchRole: '125 kbps MS-CAN Bus (-)',
        connectionInstruction: 'Connect to OBD-II Pin 11 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        connectorCoords: { xPercent: 58.0, yPercent: 44.5 },
      },
      {
        pinNumber: 35,
        plug: 'PLUG_B_54P',
        label: 'VREF_5V',
        signalName: 'Regulated 5.00V Sensor Reference',
        category: 'power',
        nominalVoltage: 5.0,
        wireColor: 'Yellow (YE)',
        colorHex: '#eab308',
        benchRole: 'Precision 5.0V Sensor Rail',
        connectionInstruction: 'Feeds Bench MAP & Fuel Pressure Sensors',
        electricalSpec: '5.00V Regulated Rail',
        associatedSimPinId: 'ecu-pin-5',
        connectorCoords: { xPercent: 68.5, yPercent: 44.5 },
      },
    ],
  },

  // 3. Mitsubishi Electric E6T (Montero Sport / Strada 4D56 / 4N15 Diesel)
  {
    id: 'mitsubishi-e6t',
    brandName: 'Mitsubishi Electric',
    modelName: 'Mitsubishi E6T / E6T7xx (3-Plug Diesel ECU)',
    cavityInfo: '3-Plug Chamber (Plug A: 26P, Plug B: 32P, Plug C: 35P)',
    popularVehiclesInPH: 'Mitsubishi Montero Sport, Strada/L200 (4D56 / 4N15 MIVEC), Lancer 4G18',
    description: 'Widely used in Mitsubishi midsize SUV & pickup models in PH. Requires precise 12V ignition wake-up and relay coil load.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_26P', label: 'Plug A (Power & GND)' },
      { id: 'PLUG_B_32P', label: 'Plug B (Sensors)' },
      { id: 'PLUG_C_35P', label: 'Plug C (Injectors & Drivers)' },
    ],
    essentialChecklist: [
      { pin: 'Pin 1 & 2', role: 'Main Ground Return (GND)' },
      { pin: 'Pin 3 (VBAT)', role: 'Continuous Battery +12V Supply' },
      { pin: 'Pin 5 (IG_SW)', role: 'Ignition Key Switch Trigger (+12V)' },
      { pin: 'Pin 10 & 11', role: 'MUT-III Diagnostic CAN-H / CAN-L' },
      { pin: 'Pin 21', role: '5.00V Sensor Reference Output' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_26P',
        label: 'GND_1',
        signalName: 'Main Power Ground 1',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (BK)',
        colorHex: '#78350f',
        benchRole: 'Primary Chassis Return',
        connectionInstruction: 'Connect to Bench Power Supply (-) Terminal',
        electricalSpec: '0.0V Power Ground Sink',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.5, yPercent: 44.5 },
      },
      {
        pinNumber: 3,
        plug: 'PLUG_A_26P',
        label: 'VBAT',
        signalName: 'Constant Battery Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red (RD)',
        colorHex: '#ef4444',
        benchRole: 'Continuous ECU Memory Power',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.6V DC Supply',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.5 },
      },
      {
        pinNumber: 5,
        plug: 'PLUG_A_26P',
        label: 'IG_SW',
        signalName: 'Switched Ignition Switch +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Black / White (BK/WH)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Wake-up Trigger',
        connectionInstruction: 'Connect to Bench Toggle Switch from +12V',
        electricalSpec: '+12.6V Active Key-ON',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 30.0, yPercent: 44.5 },
      },
      {
        pinNumber: 10,
        plug: 'PLUG_A_26P',
        label: 'CAN_H',
        signalName: 'Powertrain High-Speed CAN High',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange (OG)',
        colorHex: '#f97316',
        benchRole: 'MUT-III & OBD-II Diagnostic CAN (+)',
        connectionInstruction: 'Connect to OBD-II Pin 6 and 120Ω terminating resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 11,
        plug: 'PLUG_A_26P',
        label: 'CAN_L',
        signalName: 'Powertrain High-Speed CAN Low',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Brown (BN)',
        colorHex: '#ea580c',
        benchRole: 'MUT-III & OBD-II Diagnostic CAN (-)',
        connectionInstruction: 'Connect to OBD-II Pin 14 and 120Ω terminating resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
      {
        pinNumber: 21,
        plug: 'PLUG_B_32P',
        label: 'VREF',
        signalName: 'Regulated 5.00V Sensor Power',
        category: 'power',
        nominalVoltage: 5.0,
        wireColor: 'Violet (VT)',
        colorHex: '#eab308',
        benchRole: '5V Sensor Reference Voltage Rail',
        connectionInstruction: 'Feeds Bench Accelerator & Pressure Sensors',
        electricalSpec: '5.00V Regulated Supply',
        associatedSimPinId: 'ecu-pin-5',
        connectorCoords: { xPercent: 68.5, yPercent: 44.5 },
      },
    ],
  },

  // 4. Transtron Isuzu (D-Max / Mu-X 4JJ1-TCX 3.0L Diesel - PH Commercial Standard)
  {
    id: 'isuzu-transtron-4jj1',
    brandName: 'Isuzu / Transtron',
    modelName: 'Transtron 4JJ1 / 4JK1 Common Rail Diesel ECU',
    cavityInfo: '121-Pin Triple Heavy-Duty Chamber',
    popularVehiclesInPH: 'Isuzu D-Max, Mu-X, NHR/NKR Truck (4JJ1-TCX / 4JK1 2.5L & 3.0L Euro-4 Diesel)',
    description: 'The premier commercial diesel ECU in the Philippines. Controls common rail high-pressure fuel pumps and piezo injectors.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_E_34P', label: 'Plug E (Engine & Power)' },
      { id: 'PLUG_C_35P', label: 'Plug C (Cab & Ignition)' },
      { id: 'PLUG_I_52P', label: 'Plug I (Injectors & High Voltage)' },
    ],
    essentialChecklist: [
      { pin: 'Pin E-01', role: 'Engine Power Ground' },
      { pin: 'Pin E-05', role: 'Constant Battery +12V' },
      { pin: 'Pin C-09', role: 'Switched Ignition Switch (+12V)' },
      { pin: 'Pin C-15 & C-16', role: 'Global Tech2 / G-Scan CAN High/Low' },
      { pin: 'Pin I-40', role: 'Common Rail High Voltage Injector Driver' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_E_34P',
        label: 'GND_ENG',
        signalName: 'Heavy Duty Engine Ground Sink',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown / White (BN/WH)',
        colorHex: '#78350f',
        benchRole: 'High Current Ground Return',
        connectionInstruction: 'Connect to Bench Power Supply (-) Terminal',
        electricalSpec: '0.0V Ground Sink (Max 25A rating)',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.5, yPercent: 44.5 },
      },
      {
        pinNumber: 5,
        plug: 'PLUG_E_34P',
        label: 'BATT_12V',
        signalName: 'Permanent Battery Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red / Blue (RD/BU)',
        colorHex: '#ef4444',
        benchRole: 'ECU Memory & Injector Charge Capacitor Power',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.6V DC Main Power',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.5 },
      },
      {
        pinNumber: 9,
        plug: 'PLUG_C_35P',
        label: 'IGN_SW',
        signalName: 'Switched Ignition Power +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Black / Yellow (BK/YE)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Key Switch Wake-up Input',
        connectionInstruction: 'Connect through Bench Toggle Switch from +12V',
        electricalSpec: '+12.6V Active Key-ON',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 30.0, yPercent: 44.5 },
      },
      {
        pinNumber: 15,
        plug: 'PLUG_C_35P',
        label: 'CAN_H',
        signalName: 'Isuzu Powertrain CAN High',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange (OG)',
        colorHex: '#f97316',
        benchRole: 'Tech2 / G-Scan / Diagnostic CAN (+)',
        connectionInstruction: 'Connect to OBD-II Diagnostic Pin 6 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 16,
        plug: 'PLUG_C_35P',
        label: 'CAN_L',
        signalName: 'Isuzu Powertrain CAN Low',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Brown (BN)',
        colorHex: '#ea580c',
        benchRole: 'Tech2 / G-Scan / Diagnostic CAN (-)',
        connectionInstruction: 'Connect to OBD-II Diagnostic Pin 14 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
    ],
  },

  // 5. Keihin Honda PGM-FI (Civic / City / Jazz L13A / L15A / R18A - PH Compact Leader)
  {
    id: 'honda-keihin-pgmfi',
    brandName: 'Honda / Keihin',
    modelName: 'Keihin PGM-FI (3-Plug / 4-Plug ECU)',
    cavityInfo: 'Multi-Plug Compact Chamber (Plug A: 31P, Plug B: 24P, Plug C: 22P)',
    popularVehiclesInPH: 'Honda City, Civic, Jazz, CR-V (L13A / L15A / R18A / K20A Engine Families)',
    description: 'Standard Keihin PGM-FI ECU found across Honda vehicles in the PH market. Features dual VTEC and F-CAN bus communication.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_31P', label: 'Plug A (Power/GND)' },
      { id: 'PLUG_B_24P', label: 'Plug B (Sensors)' },
      { id: 'PLUG_C_22P', label: 'Plug C (CAN/OBD)' },
    ],
    essentialChecklist: [
      { pin: 'Pin A-01 (PG1)', role: 'Power Ground Return' },
      { pin: 'Pin A-02 (IG1)', role: 'Ignition Key Switch +12V Input' },
      { pin: 'Pin A-03 (BACKUP)', role: 'Battery Permanent Memory +12V' },
      { pin: 'Pin C-10 & C-11', role: 'Honda HDS F-CAN High/Low Bus' },
      { pin: 'Pin B-20 (VCC1)', role: '5.00V Sensor Reference Supply' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_31P',
        label: 'PG1',
        signalName: 'Main Power Ground 1',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (BLK)',
        colorHex: '#78350f',
        benchRole: 'Chassis Power Ground',
        connectionInstruction: 'Connect to Bench Power Supply (-) Terminal',
        electricalSpec: '0.0V Ground Return',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.5, yPercent: 44.5 },
      },
      {
        pinNumber: 2,
        plug: 'PLUG_A_31P',
        label: 'IG1',
        signalName: 'Switched Ignition Power +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Yellow / Black (YEL/BLK)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Wake-up Input',
        connectionInstruction: 'Connect to Bench Toggle Switch from +12V',
        electricalSpec: '+12.6V Active Key-ON',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 30.0, yPercent: 44.5 },
      },
      {
        pinNumber: 3,
        plug: 'PLUG_A_31P',
        label: 'BACKUP',
        signalName: 'Permanent Battery Memory +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'White / Red (WHT/RED)',
        colorHex: '#ef4444',
        benchRole: 'Continuous SRAM Power',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.6V DC Memory Supply',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.5 },
      },
      {
        pinNumber: 10,
        plug: 'PLUG_C_22P',
        label: 'F-CAN_H',
        signalName: 'Honda Fast CAN High',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Red (RED)',
        colorHex: '#f97316',
        benchRole: 'HDS Diagnostic & Instrument Cluster CAN (+)',
        connectionInstruction: 'Connect to OBD-II Diagnostic Pin 6 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 11,
        plug: 'PLUG_C_22P',
        label: 'F-CAN_L',
        signalName: 'Honda Fast CAN Low',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'White (WHT)',
        colorHex: '#ea580c',
        benchRole: 'HDS Diagnostic & Instrument Cluster CAN (-)',
        connectionInstruction: 'Connect to OBD-II Diagnostic Pin 14 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
    ],
  },

  // 6. Delphi MT20U / MT22U (Geely / Suzuki / Changan Popular Compact ECUs)
  {
    id: 'delphi-mt20u',
    brandName: 'Delphi Technologies',
    modelName: 'Delphi MT20U / MT22U / MT80',
    cavityInfo: '80-Pin Dual Chamber (Plug A: 40P, Plug B: 40P)',
    popularVehiclesInPH: 'Geely Coolray / Emgrand, Suzuki Jimny / Ertiga (K15B), Changan CS35, Chery Tiggo',
    description: 'Popular Delphi engine management system used across modern crossover and compact petrol models in PH.',
    imageSrc: '/assets/images/ecu_connector_socket.jpg',
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_40P', label: 'Plug A (Power/CAN)' },
      { id: 'PLUG_B_40P', label: 'Plug B (Sensors/Inj)' },
    ],
    essentialChecklist: [
      { pin: 'Pin 1 & 2', role: 'Main Ground (GND)' },
      { pin: 'Pin 3', role: 'Battery Permanent Supply (+12V)' },
      { pin: 'Pin 4', role: 'Ignition Key Switch (+12V)' },
      { pin: 'Pin 18 & 19', role: 'Diagnostic CAN High / Low' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_40P',
        label: 'GND_1',
        signalName: 'Main Power Ground Return',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (BK)',
        colorHex: '#78350f',
        benchRole: 'Chassis Power Ground',
        connectionInstruction: 'Connect to Bench Power Supply (-) Terminal',
        electricalSpec: '0.0V Ground Return',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 24.5, yPercent: 44.5 },
      },
      {
        pinNumber: 3,
        plug: 'PLUG_A_40P',
        label: 'VBAT',
        signalName: 'Battery Permanent Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red (RD)',
        colorHex: '#ef4444',
        benchRole: 'ECU SRAM Power',
        connectionInstruction: 'Connect to Bench Power Supply Positive (+12.6V constant)',
        electricalSpec: '+12.6V DC Supply',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 28.0, yPercent: 44.5 },
      },
      {
        pinNumber: 4,
        plug: 'PLUG_A_40P',
        label: 'IGN',
        signalName: 'Switched Ignition Power +12V',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Violet (VT)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Switch Trigger',
        connectionInstruction: 'Connect to Bench Toggle Switch from +12V',
        electricalSpec: '+12.6V Active Key-ON',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 30.0, yPercent: 44.5 },
      },
      {
        pinNumber: 18,
        plug: 'PLUG_A_40P',
        label: 'CAN_H',
        signalName: 'Diagnostic CAN High',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Orange (OG)',
        colorHex: '#f97316',
        benchRole: 'OBD-II Diagnostic CAN (+)',
        connectionInstruction: 'Connect to OBD-II Pin 6 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 51.5, yPercent: 44.5 },
      },
      {
        pinNumber: 19,
        plug: 'PLUG_A_40P',
        label: 'CAN_L',
        signalName: 'Diagnostic CAN Low',
        category: 'communication',
        nominalVoltage: 2.5,
        wireColor: 'Brown (BN)',
        colorHex: '#ea580c',
        benchRole: 'OBD-II Diagnostic CAN (-)',
        connectionInstruction: 'Connect to OBD-II Pin 14 and 120Ω resistor',
        electricalSpec: '2.5V Recessive, 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 54.0, yPercent: 44.5 },
      },
    ],
  },

  // 7. Nissan Sentra / Almera N16 (Hitachi MEC11-251 / MEC22-251 / QG16DE)
  {
    id: 'nissan-hitachi-mec11',
    brandName: 'Nissan / Hitachi',
    modelName: 'Hitachi MEC11-251 / MEC22-251 (121-Pin QG16)',
    cavityInfo: '121-Pin Dual Chamber (Chamber A: 81-Pin / Chamber B: 40-Pin)',
    popularVehiclesInPH: 'Nissan Sentra N16 (Exalta / GX / GS / 1.6L QG16DE), Almera N16, Sunny',
    description: 'Widely used in Philippine-market Nissan Sentra Exalta (N16 / QG16DE), GX, GS, and Almera N16 models. Operates strictly on ISO-9141 K-Line diagnostic communication on Pin 88 (or Pin 85) to OBD2 Pin 7. ⚠️ IMPORTANT: Pins 86 & 94 are dedicated inter-module CAN lines exclusively communicating with the Automatic Transmission Control Unit (TCU); they do NOT support OBD-II diagnostic scanning or bench flashing and must remain disconnected on the bench.',
    imageSrc: '/assets/aistudio/IMG_20261031_102222_185ec4db.jpg',
    pcbImageSrc: '/assets/aistudio/IMG_20261031_100429_ce48661e.jpg',
    pcbComponents: [
      {
        id: 'pcb-shunt-r701-r703',
        name: 'Injector Low-Side Current Shunt Array',
        designation: 'R701 / R702 / R703 (028 = 0.028Ω)',
        type: 'shunt',
        xPercent: 23.0,
        yPercent: 78.5,
        spec: '0.028Ω ± 1% Precision SMD Current Shunts (Marked "028")',
        diagnosticRole: 'Current sense shunts for Fuel Injectors 1-4. If an injector solenoid shorts to +12V or suffers high flyback spikes, this resistor burns open causing injector DTCs (P0201-P0204) and total loss of injection.',
        associatedPins: 'Pins 23, 24, 25, 26 (INJ 1-4)',
        associatedSimPinId: 'ecu-pin-10',
      },
      {
        id: 'pcb-res-r704',
        name: 'Driver Sense Feedback Resistor',
        designation: 'R704 (820 = 820Ω)',
        type: 'resistor',
        xPercent: 25.0,
        yPercent: 71.0,
        spec: '820Ω Precision SMT Sensing Feedback Resistor',
        diagnosticRole: 'Feeds current-sense voltage into the microcontroller ADC channel for dwell angle regulation and short-circuit protection shutdown.',
        associatedPins: 'Low-Side Driver Gate Circuit',
      },
      {
        id: 'pcb-cap-bank-c844-c879',
        name: 'Multi-Channel Sensor Signal Filter Array',
        designation: 'C844 - C879 Multi-Cap Bank',
        type: 'capacitor',
        xPercent: 75.0,
        yPercent: 50.0,
        spec: '0.1µF 50V Ceramic Noise Suppression Decoupling Caps',
        diagnosticRole: 'Filters high-frequency ignition and alternator EMI noise on MAF (Pin 50), TPS (Pin 49), POS Crank (Pin 13), and PHASE Cam (Pin 14) analog inputs. A shorted capacitor here pulls the 5V reference rail down to 0V.',
        associatedPins: 'Pins 13, 14, 49, 50, 72',
        associatedSimPinId: 'ecu-pin-5',
      },
      {
        id: 'pcb-clamping-d301-d302',
        name: 'Transient Voltage Suppression Clamping Diodes',
        designation: 'D301 / D302 Clamping Diodes',
        type: 'diode',
        xPercent: 82.0,
        yPercent: 76.0,
        spec: 'Schottky Clamping Diodes / Fast Recovery (0.35V Vf)',
        diagnosticRole: 'Protects ECU internal microcontroller against alternator inductive load dump and reverse polarity damage when jump-starting.',
        associatedPins: 'Pins 67, 121 (VBAT Feed)',
        associatedSimPinId: 'ecu-pin-3',
      },
      {
        id: 'pcb-trans-t301',
        name: 'Actuator & Relay Low-Side Driver Transistor',
        designation: 'T301 SOT-23 Switching Transistor',
        type: 'transistor',
        xPercent: 68.0,
        yPercent: 79.0,
        spec: 'NPN / N-Ch MOSFET Low-Side Switch (45V, 500mA)',
        diagnosticRole: 'Drives low-side sink for EGI Main Relay (Pin 111) and Fuel Pump Relay (Pin 113) upon receiving ignition wake-up on Pin 36.',
        associatedPins: 'Pins 36, 111, 113',
        associatedSimPinId: 'ecu-pin-12',
      },
      {
        id: 'pcb-conn-header-array',
        name: '121-Pin Through-Hole Connector Solder Header Matrix',
        designation: '121-Pin Receptacle Solder Array',
        type: 'connector_header',
        xPercent: 65.0,
        yPercent: 65.0,
        spec: 'Triple-Row Through-Hole Gold-Plated Terminal Headers',
        diagnosticRole: 'Direct solder interface connecting PCB copper traces to the harness receptacle socket. Inspect for micro-cracks or dry joints under thermal vibration.',
        associatedPins: 'Pins 1 through 121',
      },
      {
        id: 'pcb-ground-bond-screw',
        name: 'Chassis & Shield Ground Bond Point',
        designation: 'Enclosure Ground Screw Bond',
        type: 'ground_bond',
        xPercent: 35.0,
        yPercent: 48.0,
        spec: 'M4 Gold-Plated Chassis Ground Return Screw',
        diagnosticRole: 'Bonds internal PCB power ground plane directly to the die-cast aluminum heatsink casing. Ensures EMI shielding and 0.0V reference.',
        associatedPins: 'Pins 1, 48, 57, 115 (GND)',
        associatedSimPinId: 'ecu-pin-1',
      },
    ],
    plugs: [
      { id: 'ALL', label: 'All Plugs' },
      { id: 'PLUG_A_81P', label: 'Chamber A (Pins 1-81)' },
      { id: 'PLUG_B_40P', label: 'Chamber B (Pins 82-121)' },
    ],
    essentialChecklist: [
      { pin: 'Pin 67 / 121', role: 'Constant +12V Fused Battery Power (Back-Up & Memory via 5A/10A fuse)' },
      { pin: 'Pin 36 / 109', role: 'Switched Ignition +12V Input (Inline Toggle Switch to wake MCU)' },
      { pin: 'Pin 48 / 1 / 57', role: 'Main Electronics Ground (Battery Negative & OBD2 Pins 4 & 5)' },
      { pin: 'Pin 88 / 85', role: 'K-Line Diagnostic Data (Direct to OBD2 Pin 7 - Pure K-Line, NO CAN!)' },
      { pin: 'Pin 119 & 120', role: 'Power Supply for ECM (+12V via EGI Relay / bridged to switched 12V)' },
      { pin: 'Pins 86 & 94 (TCU)', role: 'Internal TCU Inter-Module CAN Only (Do NOT connect on bench; non-diagnostic)' },
    ],
    pinouts: [
      {
        pinNumber: 1,
        plug: 'PLUG_A_81P',
        label: 'GND_1',
        signalName: 'ECM Power Ground 1',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (B)',
        colorHex: '#78350f',
        benchRole: 'Primary Engine Ground Return',
        connectionInstruction: 'Connect to Bench Power Supply Negative (-) & OBD2 Pins 4/5',
        electricalSpec: '0.0V Solid Ground Return',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 17.5, yPercent: 20.0 },
      },
      {
        pinNumber: 3,
        plug: 'PLUG_A_81P',
        label: 'ETC_PWR',
        signalName: 'Throttle Control Motor Power Supply',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red (R)',
        colorHex: '#ef4444',
        benchRole: 'Electronic Throttle Motor VBat Feed',
        connectionInstruction: 'Supplied with +12V when Ignition Switch ON',
        electricalSpec: 'Battery Voltage (11.0V - 14.0V)',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 23.5, yPercent: 20.0 },
      },
      {
        pinNumber: 13,
        plug: 'PLUG_A_81P',
        label: 'POS_CKP',
        signalName: 'Crankshaft Position Sensor (POS)',
        category: 'sensor_in',
        nominalVoltage: 3.0,
        wireColor: 'Red (R)',
        colorHex: '#22c55e',
        benchRole: 'Engine RPM & Crank Angle Input',
        connectionInstruction: 'Connect to Bench Signal Generator (Square / Sine wave pulse)',
        electricalSpec: 'Approx 3.0V AC / Digital Frequency Signal (Warm-up / Idle)',
        associatedSimPinId: 'ecu-pin-7',
        connectorCoords: { xPercent: 18.5, yPercent: 26.5 },
      },
      {
        pinNumber: 14,
        plug: 'PLUG_A_81P',
        label: 'PHASE_CMP',
        signalName: 'Camshaft Position Sensor (PHASE)',
        category: 'sensor_in',
        nominalVoltage: 2.5,
        wireColor: 'Red (R)',
        colorHex: '#22c55e',
        benchRole: 'Cylinder Identification & Phase Sync',
        connectionInstruction: '1.0V - 4.0V Pulse from Cam Hall / Optical sensor',
        electricalSpec: '1.0V - 4.0V Dynamic Pulse',
        connectorCoords: { xPercent: 21.5, yPercent: 26.5 },
      },
      {
        pinNumber: 23,
        plug: 'PLUG_A_81P',
        label: 'INJ_1',
        signalName: 'Injector No. 1 Driver',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Red / Black (R/B)',
        colorHex: '#3b82f6',
        benchRole: 'Cylinder 1 Fuel Injector Low-Side Switch',
        connectionInstruction: 'Connect to Bench Injector Solenoid (12-16Ω) or LED light to +12V',
        electricalSpec: 'Battery Voltage High, Pulled Low to 0.2V during injection dwell',
        associatedSimPinId: 'ecu-pin-10',
        connectorCoords: { xPercent: 25.0, yPercent: 26.5 },
      },
      {
        pinNumber: 36,
        plug: 'PLUG_A_81P',
        label: 'IGN_36',
        signalName: 'Ignition Switch Input (MEC11-251 / MEC22-251 Primary Wake-Up)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Black / Red (B/R)',
        colorHex: '#ef4444',
        benchRole: 'Primary Bench Ignition Wake-Up Toggle (+12V)',
        connectionInstruction: 'Connect via Inline Toggle Switch to Fused +12V. Turning switch ON energizes internal MCU logic and triggers EGI main relay latching.',
        electricalSpec: 'Battery Voltage (11.0V - 14.0V) when ON, 0.0V when OFF',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 32.5, yPercent: 26.5 },
      },
      {
        pinNumber: 47,
        plug: 'PLUG_A_81P',
        label: 'AVCC_TPS',
        signalName: 'Throttle Position Sensor 5V Supply',
        category: 'power',
        nominalVoltage: 5.0,
        wireColor: 'Green (G)',
        colorHex: '#eab308',
        benchRole: 'Regulated 5.00V Sensor Reference',
        connectionInstruction: 'Feeds Bench Throttle Position Sensor VCC',
        electricalSpec: '5.00V ± 0.05V Regulated',
        associatedSimPinId: 'ecu-pin-5',
        connectorCoords: { xPercent: 18.5, yPercent: 33.0 },
      },
      {
        pinNumber: 48,
        plug: 'PLUG_A_81P',
        label: 'GND_48',
        signalName: 'Main Chassis & Electronics Ground Return',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (B)',
        colorHex: '#78350f',
        benchRole: 'Primary Bench Ground Return (OBD2 Pins 4 & 5)',
        connectionInstruction: 'Connect directly to Battery Negative (-) and OBD-II Socket Pins 4 & 5 (Solid 0V reference)',
        electricalSpec: '0.0V Solid Ground Return',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 23.5, yPercent: 33.0 },
      },
      {
        pinNumber: 49,
        plug: 'PLUG_A_81P',
        label: 'TPS_1',
        signalName: 'Throttle Position Sensor Track 1',
        category: 'sensor_in',
        nominalVoltage: 0.6,
        wireColor: 'White (W)',
        colorHex: '#22c55e',
        benchRole: 'Analog Throttle Opening Voltage Input',
        connectionInstruction: 'Connect to Bench Potentiometer (Wiper: 0.36V closed -> 4.75V WOT)',
        electricalSpec: '>0.36V Fully Released, <4.75V Fully Depressed',
        associatedSimPinId: 'ecu-pin-7',
        connectorCoords: { xPercent: 27.0, yPercent: 33.0 },
      },
      {
        pinNumber: 50,
        plug: 'PLUG_A_81P',
        label: 'MAF',
        signalName: 'Mass Air Flow Sensor Signal',
        category: 'sensor_in',
        nominalVoltage: 1.3,
        wireColor: 'Yellow (Y)',
        colorHex: '#22c55e',
        benchRole: 'Hot-Wire Air Flow Analog Input',
        connectionInstruction: 'Connect to 1.0V - 2.5V variable signal source',
        electricalSpec: '1.0V - 1.7V at Idle, 1.5V - 2.1V at 2500 RPM',
        connectorCoords: { xPercent: 30.5, yPercent: 33.0 },
      },
      {
        pinNumber: 57,
        plug: 'PLUG_A_81P',
        label: 'SGND',
        signalName: 'Sensors Clean Ground Return',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (B)',
        colorHex: '#78716c',
        benchRole: 'Analog Sensor Low-Side Ground Return',
        connectionInstruction: 'Alternative Bench Ground (Bridge with Pin 1 / 48)',
        electricalSpec: '0.0V Clean Signal Ground Return',
        associatedSimPinId: 'ecu-pin-6',
        connectorCoords: { xPercent: 34.0, yPercent: 33.0 },
      },
      {
        pinNumber: 61,
        plug: 'PLUG_A_81P',
        label: 'IGN_1',
        signalName: 'Ignition Signal No. 1 (Coil-on-Plug Trigger)',
        category: 'actuator_out',
        nominalVoltage: 0.05,
        wireColor: 'Brown (BR)',
        colorHex: '#a855f7',
        benchRole: 'Cylinder 1 Ignition Coil Spark Trigger',
        connectionInstruction: 'Connect to Bench Ignition Test Light or Scope CH2',
        electricalSpec: '0.0V - 0.1V Trigger Pulses (5V Logic Pulse to Igniter)',
        connectorCoords: { xPercent: 35.5, yPercent: 26.5 },
      },
      {
        pinNumber: 67,
        plug: 'PLUG_A_81P',
        label: 'VBAT_67',
        signalName: 'Continuous Battery Power Supply (Back-Up Memory & SRAM)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red / White (R/W)',
        colorHex: '#ef4444',
        benchRole: 'Primary Bench Unswitched Constant +12V Feed',
        connectionInstruction: 'Connect directly to Fused Battery Positive (+12.6V Constant) via 5A or 10A inline fuse',
        electricalSpec: 'Battery Voltage (11.0V - 14.0V) continuous draw <25mA',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 34.5, yPercent: 20.0 },
      },
      {
        pinNumber: 72,
        plug: 'PLUG_A_81P',
        label: 'ECT',
        signalName: 'Engine Coolant Temperature Sensor Signal',
        category: 'sensor_in',
        nominalVoltage: 1.8,
        wireColor: 'Brown / White (BR/W)',
        colorHex: '#f97316',
        benchRole: 'NTC Thermistor Coolant Temperature Input',
        connectionInstruction: 'Connect to Bench ECT Thermistor (Cold: ~3.5V, Hot 90°C: ~0.8V)',
        electricalSpec: '0.0V - 4.8V Analog Voltage (Varies with Coolant Temp)',
        connectorCoords: { xPercent: 36.5, yPercent: 33.0 },
      },
      {
        pinNumber: 85,
        plug: 'PLUG_B_40P',
        label: 'K-LINE_85',
        signalName: 'Data Link Connector (Alternate ISO-9141 K-Line)',
        category: 'communication',
        nominalVoltage: 12.0,
        wireColor: 'Light Green (LG)',
        colorHex: '#10b981',
        benchRole: 'Secondary OBD-II Diagnostic Scanner K-Line Pin',
        connectionInstruction: 'Connect to OBD-II Socket Pin 7 (Ancel V7 HD / Scanner Data Line - Pure K-Line)',
        electricalSpec: '0V when disconnected, 11V-14V connected (Pulls low during 10.4kbps packet exchange)',
        associatedSimPinId: 'ecu-pin-16',
        connectorCoords: { xPercent: 60.5, yPercent: 19.5 },
      },
      {
        pinNumber: 86,
        plug: 'PLUG_B_40P',
        label: 'TCU_CAN_L',
        signalName: 'Automatic Transmission Control (TCU) CAN-Low',
        category: 'communication',
        nominalVoltage: 2.3,
        wireColor: 'Red (R)',
        colorHex: '#64748b',
        benchRole: 'TCU Inter-Module Communication ONLY (Non-Diagnostic)',
        connectionInstruction: '⚠️ DO NOT CONNECT ON BENCH: Dedicated internal link to Transmission Control Unit (TCU). Diagnostic scanners communicate via K-Line (Pin 88 / Pin 85), NOT CAN! Leave disconnected.',
        electricalSpec: 'Inter-module communication line to TCU only (Inactive on bench without TCU)',
        connectorCoords: { xPercent: 63.5, yPercent: 19.5 },
      },
      {
        pinNumber: 88,
        plug: 'PLUG_B_40P',
        label: 'K-LINE_88',
        signalName: 'Primary Diagnostic K-Line Data Link (ISO-9141)',
        category: 'communication',
        nominalVoltage: 12.0,
        wireColor: 'Light Green (LG)',
        colorHex: '#10b981',
        benchRole: 'Primary OBD-II Pin 7 Diagnostic Data Link (Ancel / CONSULT-II)',
        connectionInstruction: 'Connect directly to OBD-II Diagnostic Socket Pin 7. Pure K-Line protocol (ISO-9141), no CAN bus required for scan tool communication!',
        electricalSpec: '11.0V - 14.0V High when idle, pulls to 0V during 10.4 kbps data packets',
        associatedSimPinId: 'ecu-pin-16',
        connectorCoords: { xPercent: 61.5, yPercent: 26.0 },
      },
      {
        pinNumber: 94,
        plug: 'PLUG_B_40P',
        label: 'TCU_CAN_H',
        signalName: 'Automatic Transmission Control (TCU) CAN-High',
        category: 'communication',
        nominalVoltage: 2.8,
        wireColor: 'Blue (L)',
        colorHex: '#64748b',
        benchRole: 'TCU Inter-Module Communication ONLY (Non-Diagnostic)',
        connectionInstruction: '⚠️ DO NOT CONNECT ON BENCH: Dedicated internal link to Transmission Control Unit (TCU). Diagnostic scanners communicate via K-Line (Pin 88 / Pin 85), NOT CAN! Leave disconnected.',
        electricalSpec: 'Inter-module communication line to TCU only (Inactive on bench without TCU)',
        connectorCoords: { xPercent: 66.5, yPercent: 19.5 },
      },
      {
        pinNumber: 109,
        plug: 'PLUG_B_40P',
        label: 'IGN_SW',
        signalName: 'Ignition Switch Input (Secondary Wake-Up)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Black / Red (B/R)',
        colorHex: '#a855f7',
        benchRole: 'Ignition Key-ON Wake-Up Trigger (Alternative to Pin 36)',
        connectionInstruction: 'Connect via Inline Toggle Switch to Fused +12V (Alternative to Pin 36 on some QG16 harness variants)',
        electricalSpec: 'Battery Voltage (11.0V - 14.0V) when ON, 0V when OFF',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 71.5, yPercent: 26.0 },
      },
      {
        pinNumber: 111,
        plug: 'PLUG_B_40P',
        label: 'EGI_RLY',
        signalName: 'EGI Main Relay Control Output',
        category: 'actuator_out',
        nominalVoltage: 0.0,
        wireColor: 'White / Green (W/G)',
        colorHex: '#3b82f6',
        benchRole: 'Main Engine Relay Coil Ground Sink',
        connectionInstruction: 'Connect to Bench Relay Coil terminal 85',
        electricalSpec: 'Low-side sink (0V when active, +12V when unlatched)',
        associatedSimPinId: 'ecu-pin-12',
        connectorCoords: { xPercent: 74.5, yPercent: 26.0 },
      },
      {
        pinNumber: 113,
        plug: 'PLUG_B_40P',
        label: 'FPR_RLY',
        signalName: 'Fuel Pump Relay Control',
        category: 'actuator_out',
        nominalVoltage: 0.0,
        wireColor: 'Black / Pink (B/P)',
        colorHex: '#3b82f6',
        benchRole: 'Fuel Pump Prime Relay Ground Sink',
        connectionInstruction: 'Pulls low for 1-2 seconds at key-on to prime fuel rail',
        electricalSpec: '0V for 1 sec after ignition ON, then +12V until cranking',
        connectorCoords: { xPercent: 77.5, yPercent: 26.0 },
      },
      {
        pinNumber: 115,
        plug: 'PLUG_B_40P',
        label: 'ECM_GND2',
        signalName: 'ECM Power Ground 2',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (B)',
        colorHex: '#78350f',
        benchRole: 'Power Output Stage Ground Return',
        connectionInstruction: 'Bridge with Pin 1 / Pin 48 / Pin 116 to Power Supply Negative (-)',
        electricalSpec: '0.0V Ground Sink',
        associatedSimPinId: 'ecu-pin-2',
        connectorCoords: { xPercent: 61.5, yPercent: 33.0 },
      },
      {
        pinNumber: 119,
        plug: 'PLUG_B_40P',
        label: 'VBAT_EGI',
        signalName: 'Power Supply for ECM (Switched via EGI Relay)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'White (W)',
        colorHex: '#ef4444',
        benchRole: 'Main Microcontroller & Actuator Power',
        connectionInstruction: 'Connect to +12V Fused Power Supply (energized when EGI active or bridge with Pin 36)',
        electricalSpec: 'Battery Voltage (11.0V - 14.0V)',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 72.0, yPercent: 33.0 },
      },
      {
        pinNumber: 121,
        plug: 'PLUG_B_40P',
        label: 'BACKUP',
        signalName: 'Power Supply for ECM (Back-Up Memory / Alternative to Pin 67)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'White (W)',
        colorHex: '#ef4444',
        benchRole: 'Continuous Unswitched Battery Power (+12V)',
        connectionInstruction: 'Connect directly to Fused Battery Positive (+12.6V Constant via 5A/10A fuse)',
        electricalSpec: 'Battery Voltage (11.0V - 14.0V) continuous draw <25mA',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 77.0, yPercent: 33.0 },
      },
    ],
  },

  // 8. Magneti Marelli IAW 5NF (Fiat Stilo / Palio / Punto 1.6 & 1.8)
  {
    id: 'magneti-marelli-iaw-5nf',
    brandName: 'Magneti Marelli',
    modelName: 'Magneti Marelli IAW 5NF (128-Pin Hybrid ECM)',
    cavityInfo: '128-Pin Dual Chamber (Connector A: 64-Pin Vehicle / Connector B: 64-Pin Engine)',
    popularVehiclesInPH: 'Fiat Stilo 1.8L / 1.6L 16V, Palio, Punto, Siena, Idea, Doblo (Variants: 5NF.T1, 5NF.T6, 5NF.T7 Flex, 5NF.TH, 5NF.F3)',
    description: 'Specialized hybrid ceramic/SMD ECU famous for thermal stress fractures. Features dual 64-pin connectors and internal drivers: MC33186DH throttle driver, TLE9135PD injector driver, VB025 coil drivers, UE06AB6 5V regulator, TLE6230GP fan driver, and SOIC 95160 EEPROM.',
    imageSrc: '/assets/aistudio/Screenshot_20261112_170409_com_facebook_katana_FbMainTabActivity_af47a1b8.jpg',
    pcbImageSrc: '/assets/aistudio/Screenshot_20261112_170409_com_facebook_katana_FbMainTabActivity_af47a1b8.jpg',
    pcbComponents: [
      {
        id: 'pcb-iaw-vb025-cyl14',
        name: 'Ignition Coil Driver Cyl 1 & 4 (Red Arrow)',
        designation: 'VB025 Coil Driver (Cyl 1 & 4) -> Pin A17',
        type: 'transistor',
        xPercent: 36.5,
        yPercent: 37.5,
        spec: 'VB025 High-Voltage High-Current Ignition Darlington/IGBT Driver',
        diagnosticRole: 'Low-side driver pulling ignition coil negative terminal to ground for dwell charge. Common failure: short circuit causing constant coil energization, melted coil pack, or P0351.',
        associatedPins: 'Connector A Pin 17',
        associatedSimPinId: 'ecu-pin-12',
      },
      {
        id: 'pcb-iaw-vb025-cyl23',
        name: 'Ignition Coil Driver Cyl 2 & 3 (Yellow Arrow)',
        designation: 'VB025 Coil Driver (Cyl 2 & 3) -> Pin A19',
        type: 'transistor',
        xPercent: 36.5,
        yPercent: 39.5,
        spec: 'VB025 High-Voltage High-Current Ignition Darlington/IGBT Driver',
        diagnosticRole: 'Drives ignition coils for cylinders 2 & 3. Measure resistance from Pin A19 to ground; shorted VB025 reads 0Ω and destroys replacement coil.',
        associatedPins: 'Connector A Pin 19',
        associatedSimPinId: 'ecu-pin-12',
      },
      {
        id: 'pcb-iaw-mc33186dh',
        name: 'Electronic Throttle Body H-Bridge Driver (Cyan Top Arrow)',
        designation: 'MC33186DH 5.0A H-Bridge Motor Driver',
        type: 'transistor',
        xPercent: 54.5,
        yPercent: 36.0,
        spec: '5.0A Peak H-Bridge Motor Controller IC (MC33186DH / HSOP-20)',
        diagnosticRole: 'Drives throttle flap motor forward and reverse. Associated with Diagnostic 3 (Electronic Throttle Malfunction). If throttle enters limp mode, check MC33186DH outputs and 1Ω (1R) current sense resistors.',
        associatedPins: 'Connector B Pins 15, 16',
        associatedSimPinId: 'ecu-pin-7',
      },
      {
        id: 'pcb-iaw-tle9135pd',
        name: 'Multi-Channel Injector Driver IC (Magenta Arrow)',
        designation: 'TLE9135PD Multi-Output Injector Driver',
        type: 'transistor',
        xPercent: 44.5,
        yPercent: 38.5,
        spec: 'Infineon TLE9135PD Intelligent Quad Low-Side Switch',
        diagnosticRole: 'Controls fuel injectors 1-4. CRITICAL REPAIR NOTE: Pin 10 of TLE9135PD provides the internal ground return for the engine water temperature sensor circuit (Diagnostic 1). An internal trace fracture causes gauge drop and acceleration loss; resolved by soldering a jumper from Pin 10 to Connector A Pin 35/36.',
        associatedPins: 'Connector A Pins 35, 36 & Connector B Pins 3, 4, 5, 6',
        associatedSimPinId: 'ecu-pin-11',
      },
      {
        id: 'pcb-iaw-5nxx1',
        name: 'Electronic Throttle Controller IC (White Arrow)',
        designation: '5NXX1 Custom Micro-Logic Throttle Interface',
        type: 'transistor',
        xPercent: 59.0,
        yPercent: 40.5,
        spec: 'Magneti Marelli Custom ASIC / Gate Controller',
        diagnosticRole: 'Decodes dual TPS potentiometer feedback and sends PWM drive commands to the MC33186DH H-bridge driver.',
        associatedPins: 'Connector B TPS Pins',
        associatedSimPinId: 'ecu-pin-7',
      },
      {
        id: 'pcb-iaw-ue06ab6',
        name: '5V Precision System Voltage Regulator (Green Arrow)',
        designation: 'UE06AB6 Automotive Power Management & 5V Reg',
        type: 'transistor',
        xPercent: 59.5,
        yPercent: 44.0,
        spec: '5.00V ±15mV Regulated Multi-Output Supply IC',
        diagnosticRole: 'Generates stabilized 5V logic power for CPU and external sensors. Associated with Diagnostic 4 (Dead Module & Fuel Pump Failure); hairline fracture on the perimeter board edge trace severs 5V distribution, resolved with edge micro-jumper.',
        associatedPins: 'Connector A Pins 12, 16 & Internal 5V Rail',
        associatedSimPinId: 'ecu-pin-9',
      },
      {
        id: 'pcb-iaw-tle6230gp',
        name: 'Radiator Fan Driver 1 & 2 (Dark Blue Arrow)',
        designation: 'TLE6230GP Octal Low-Side Switch',
        type: 'transistor',
        xPercent: 48.0,
        yPercent: 42.0,
        spec: 'Infineon TLE6230GP Smart Octal Low-Side Driver',
        diagnosticRole: 'Switches low-speed and high-speed engine cooling fan relays, purge canister valve, and A/C compressor clutch relay.',
        associatedPins: 'Connector B Fan Relay Pins',
        associatedSimPinId: 'ecu-pin-12',
      },
      {
        id: 'pcb-iaw-lambda',
        name: 'Lambda Probe (O2 Sensor) Driver (Cyan Bottom Arrow)',
        designation: 'Oxygen Sensor Signal Conditioner & Heater Driver',
        type: 'transistor',
        xPercent: 42.0,
        yPercent: 42.0,
        spec: 'Precision High-Impedance Differential Input Stage',
        diagnosticRole: 'Processes 0-1V exhaust oxygen sensor voltages. Associated with Diagnostic 2 (Lambda probe inactive); restored by bridging sensor ground directly to Pin 35/36 ground vias.',
        associatedPins: 'Connector B Pin 23 & Connector A Pin 35/36',
        associatedSimPinId: 'ecu-pin-6',
      },
      {
        id: 'pcb-iaw-eeprom95160',
        name: 'SOIC 95160 Serial EEPROM (Vehicle Configuration & Immo)',
        designation: 'ST 95160 16Kb SPI Serial EEPROM',
        type: 'transistor',
        xPercent: 36.0,
        yPercent: 66.5,
        spec: '16 Kbit SPI Bus EEPROM (2048 x 8-bit)',
        diagnosticRole: 'Stores vehicle VIN, Fiat CODE rolling immobilizer keys, mileage, and adaptives. Sits on external casing area. Bench programming or virginizing for immobilizer bypass requires desoldering or in-circuit clip reading.',
        associatedPins: 'SPI Bus Internal to CPU',
        associatedSimPinId: 'ecu-pin-16',
      },
    ],
    plugs: [
      { id: 'ALL', label: 'All Connectors' },
      { id: 'CONN_A_64P', label: 'Connector A (64-Pin Vehicle / Body)' },
      { id: 'CONN_B_64P', label: 'Connector B (64-Pin Engine / Actuators)' },
    ],
    essentialChecklist: [
      { pin: 'Pin A16', role: 'Permanent Battery Supply (+12V KL30)' },
      { pin: 'Pin A12', role: 'Switched Ignition (+12V KL15 Key-On)' },
      { pin: 'Pin A10', role: 'K-Line Diagnostic Serial (OBD-II Pin 7)' },
      { pin: 'Pin A20 / A36', role: 'CAN-Bus High / Low Lines' },
      { pin: 'Pin A35 / A36', role: 'Ground Return Vias (TLE9135PD Jumper Pad)' },
      { pin: 'Pin B1', role: 'Chassis Power Ground' },
      { pin: 'Pin B3-B6', role: 'Fuel Injector Outputs Cyl 1-4' },
      { pin: 'Pin A17 / A19', role: 'Ignition Coil 1-4 & 2-3 Drivers (VB025)' },
    ],
    pinouts: [
      {
        pinNumber: 16,
        plug: 'CONN_A_64P',
        label: 'KL30_A16',
        signalName: 'Permanent Battery Supply (+12V)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Red (RD)',
        colorHex: '#ef4444',
        benchRole: 'Continuous Microcontroller & Memory Battery Rail',
        connectionInstruction: 'Connect to Bench Power Supply (+12.6V Constant via 5A fuse)',
        electricalSpec: '+11.5V to +14.2V DC continuous draw',
        associatedSimPinId: 'ecu-pin-3',
        connectorCoords: { xPercent: 22.0, yPercent: 72.0 },
      },
      {
        pinNumber: 12,
        plug: 'CONN_A_64P',
        label: 'KL15_A12',
        signalName: 'Switched Ignition +12V (Key-On Wakeup)',
        category: 'power',
        nominalVoltage: 12.6,
        wireColor: 'Orange / Black (OG/BK)',
        colorHex: '#f97316',
        benchRole: 'Ignition Wakeup Trigger for UE06AB6 Regulator',
        connectionInstruction: 'Connect to Bench Power Supply via Toggle Switch (+12V Key-ON)',
        electricalSpec: '+12.6V Active / 0.0V Standby',
        associatedSimPinId: 'ecu-pin-4',
        connectorCoords: { xPercent: 26.0, yPercent: 72.0 },
      },
      {
        pinNumber: 10,
        plug: 'CONN_A_64P',
        label: 'K-LINE_A10',
        signalName: 'Bidirectional Serial Diagnostic Link (ISO-9141)',
        category: 'communication',
        nominalVoltage: 12.0,
        wireColor: 'White / Red (WH/RD)',
        colorHex: '#10b981',
        benchRole: 'OBD-II Diagnostic K-Line to Scan Tool Pin 7',
        connectionInstruction: 'Connect to OBD-II Socket Pin 7 for Fiat Multiecuscan / diagnostic scanner',
        electricalSpec: 'ISO-9141 UART 10.4 kbps (12V Idle High)',
        associatedSimPinId: 'ecu-pin-16',
        connectorCoords: { xPercent: 30.0, yPercent: 72.0 },
      },
      {
        pinNumber: 20,
        plug: 'CONN_A_64P',
        label: 'CAN_L_A20',
        signalName: 'CAN Bus Low (Body Network)',
        category: 'communication',
        nominalVoltage: 2.4,
        wireColor: 'White / Black (WH/BK)',
        colorHex: '#06b6d4',
        benchRole: 'Powertrain CAN Bus Low',
        connectionInstruction: 'Connect to OBD-II Socket Pin 14 (terminated with 120Ω)',
        electricalSpec: 'ISO 11898 CAN 2.4V Recessive / 1.5V Dominant',
        associatedSimPinId: 'ecu-pin-14',
        connectorCoords: { xPercent: 34.0, yPercent: 72.0 },
      },
      {
        pinNumber: 36,
        plug: 'CONN_A_64P',
        label: 'CAN_H_A36',
        signalName: 'CAN Bus High / Ground Interconnect',
        category: 'communication',
        nominalVoltage: 2.6,
        wireColor: 'Green / Black (GN/BK)',
        colorHex: '#3b82f6',
        benchRole: 'Powertrain CAN Bus High',
        connectionInstruction: 'Connect to OBD-II Socket Pin 6 (terminated with 120Ω)',
        electricalSpec: 'ISO 11898 CAN 2.6V Recessive / 3.5V Dominant',
        associatedSimPinId: 'ecu-pin-13',
        connectorCoords: { xPercent: 38.0, yPercent: 72.0 },
      },
      {
        pinNumber: 35,
        plug: 'CONN_A_64P',
        label: 'GND_VIA_A35',
        signalName: 'Sensor Ground Return Via (Diagnostic Jumper Pad)',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Black (BK)',
        colorHex: '#78350f',
        benchRole: 'Ground Reference for Water Temp & Lambda Jumper Repairs',
        connectionInstruction: 'Internally connected to Pin A36. Target pad for TLE9135PD Pin 10 jumper wire (Diagnostic 1 & 2)',
        electricalSpec: '0.00V Low-Noise Sensor Ground Return',
        associatedSimPinId: 'ecu-pin-2',
        connectorCoords: { xPercent: 42.0, yPercent: 72.0 },
      },
      {
        pinNumber: 17,
        plug: 'CONN_A_64P',
        label: 'COIL_1_4_A17',
        signalName: 'Ignition Coil Driver Output (Cylinders 1 & 4)',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Blue / Red (BU/RD)',
        colorHex: '#f59e0b',
        benchRole: 'Low-Side Switched Ground for Coils 1 & 4 (VB025)',
        connectionInstruction: 'Connect to Ignition Coil (-) or 100Ω pull-up load with LED',
        electricalSpec: 'Sinks up to 10A dwell current, >380V primary clamp',
        associatedSimPinId: 'ecu-pin-12',
        connectorCoords: { xPercent: 46.0, yPercent: 72.0 },
      },
      {
        pinNumber: 19,
        plug: 'CONN_A_64P',
        label: 'COIL_2_3_A19',
        signalName: 'Ignition Coil Driver Output (Cylinders 2 & 3)',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Blue / White (BU/WH)',
        colorHex: '#f59e0b',
        benchRole: 'Low-Side Switched Ground for Coils 2 & 3 (VB025)',
        connectionInstruction: 'Connect to Ignition Coil (-) or 100Ω pull-up load with LED',
        electricalSpec: 'Sinks up to 10A dwell current, >380V primary clamp',
        associatedSimPinId: 'ecu-pin-12',
        connectorCoords: { xPercent: 50.0, yPercent: 72.0 },
      },
      {
        pinNumber: 1,
        plug: 'CONN_B_64P',
        label: 'PWR_GND_B1',
        signalName: 'Main Power Ground Return (KL31)',
        category: 'ground',
        nominalVoltage: 0.0,
        wireColor: 'Brown (BN)',
        colorHex: '#78350f',
        benchRole: 'Chassis Power Ground for ECM Housing and Drivers',
        connectionInstruction: 'Connect to Bench Power Supply Negative (-) / Ground Rail',
        electricalSpec: '0.0V Solid Ground (Max 20A sink capability)',
        associatedSimPinId: 'ecu-pin-1',
        connectorCoords: { xPercent: 22.0, yPercent: 65.0 },
      },
      {
        pinNumber: 3,
        plug: 'CONN_B_64P',
        label: 'INJ_1_B3',
        signalName: 'Fuel Injector 1 Driver Output',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Grey / Black (GY/BK)',
        colorHex: '#ec4899',
        benchRole: 'Low-Side Switched Ground for Injector 1 (TLE9135PD)',
        connectionInstruction: 'Connect to Injector Solenoid (-) or 50Ω load to +12V',
        electricalSpec: '12.6V Quiescent, 0.2V Active Dwell Pulse',
        associatedSimPinId: 'ecu-pin-11',
        connectorCoords: { xPercent: 26.0, yPercent: 65.0 },
      },
      {
        pinNumber: 4,
        plug: 'CONN_B_64P',
        label: 'INJ_2_B4',
        signalName: 'Fuel Injector 2 Driver Output',
        category: 'actuator_out',
        nominalVoltage: 12.6,
        wireColor: 'Grey / Green (GY/GN)',
        colorHex: '#ec4899',
        benchRole: 'Low-Side Switched Ground for Injector 2 (TLE9135PD)',
        connectionInstruction: 'Connect to Injector Solenoid (-) or 50Ω load to +12V',
        electricalSpec: '12.6V Quiescent, 0.2V Active Dwell Pulse',
        associatedSimPinId: 'ecu-pin-11',
        connectorCoords: { xPercent: 30.0, yPercent: 65.0 },
      },
      {
        pinNumber: 15,
        plug: 'CONN_B_64P',
        label: 'ETC_M_POS_B15',
        signalName: 'Electronic Throttle Motor Forward Drive (+)',
        category: 'actuator_out',
        nominalVoltage: 6.0,
        wireColor: 'Yellow / Red (YE/RD)',
        colorHex: '#06b6d4',
        benchRole: 'H-Bridge Positive Output from MC33186DH Driver',
        connectionInstruction: 'Connect to Throttle Motor Terminal (+) or Oscilloscope',
        electricalSpec: 'PWM 0-12V at 1kHz - 5kHz (MC33186DH H-Bridge)',
        associatedSimPinId: 'ecu-pin-7',
        connectorCoords: { xPercent: 34.0, yPercent: 65.0 },
      },
      {
        pinNumber: 16,
        plug: 'CONN_B_64P',
        label: 'ETC_M_NEG_B16',
        signalName: 'Electronic Throttle Motor Reverse Drive (-)',
        category: 'actuator_out',
        nominalVoltage: 6.0,
        wireColor: 'Yellow / Black (YE/BK)',
        colorHex: '#06b6d4',
        benchRole: 'H-Bridge Negative Output from MC33186DH Driver',
        connectionInstruction: 'Connect to Throttle Motor Terminal (-) or Oscilloscope',
        electricalSpec: 'PWM 0-12V at 1kHz - 5kHz (MC33186DH H-Bridge)',
        associatedSimPinId: 'ecu-pin-7',
        connectorCoords: { xPercent: 38.0, yPercent: 65.0 },
      },
      {
        pinNumber: 22,
        plug: 'CONN_B_64P',
        label: 'ECT_SIG_B22',
        signalName: 'Engine Coolant Temperature (ECT) Sensor Signal',
        category: 'sensor_in',
        nominalVoltage: 2.5,
        wireColor: 'Green / White (GN/WH)',
        colorHex: '#10b981',
        benchRole: 'NTC Temperature Sensor Input to ADC',
        connectionInstruction: 'Connect to ECT Thermistor or 1kΩ-5kΩ Potentiometer to ground',
        electricalSpec: '0.5V (Hot 100°C) to 4.5V (Cold -10°C) via internal pull-up',
        associatedSimPinId: 'ecu-pin-8',
        connectorCoords: { xPercent: 42.0, yPercent: 65.0 },
      },
      {
        pinNumber: 23,
        plug: 'CONN_B_64P',
        label: 'LAMBDA_SIG_B23',
        signalName: 'Upstream Oxygen Sensor (Lambda Probe) Signal',
        category: 'sensor_in',
        nominalVoltage: 0.45,
        wireColor: 'Black / Violet (BK/VT)',
        colorHex: '#8b5cf6',
        benchRole: 'Zirconia O2 Sensor Signal Input (Diagnostic 2)',
        connectionInstruction: 'Connect to 0.1V - 0.9V signal generator or O2 sensor',
        electricalSpec: '0.1V Lean to 0.9V Rich cycling voltage. Missing ground reads 0.00V flat',
        associatedSimPinId: 'ecu-pin-6',
        connectorCoords: { xPercent: 46.0, yPercent: 65.0 },
      },
    ],
  },
];

// Fallback constant for backwards compatibility
export const ECU_BENCH_PINOUTS = ECU_BRAND_PROFILES[0].pinouts;

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

export const EcuConnectorPinouts: React.FC<EcuConnectorPinoutsProps> = ({
  pins,
  nodeVoltages,
  selectedPinId,
  onSelectPin,
  multimeter,
  onAttachProbe,
  powerSupply,
  onSearchLivePinout,
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('toyota-denso-175822'); // Default Toyota Denso (PH #1)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugFilter, setSelectedPlugFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showOverlayMarkers, setShowOverlayMarkers] = useState(true);
  const [viewMode, setViewMode] = useState<'PHYSICAL' | 'PCB' | 'LOGICAL'>('PHYSICAL');

  // Get current active brand profile
  const activeBrand = ECU_BRAND_PROFILES.find(b => b.id === selectedBrandId) || ECU_BRAND_PROFILES[0];
  const [activePinDetail, setActivePinDetail] = useState<BenchPinoutInfo>(activeBrand.pinouts[0]);
  const [selectedPcbComponent, setSelectedPcbComponent] = useState<PcbComponentPoint | null>(
    activeBrand.pcbComponents && activeBrand.pcbComponents.length > 0 ? activeBrand.pcbComponents[0] : null
  );

  // Handle brand profile change
  const handleBrandChange = (brandId: string) => {
    setSelectedBrandId(brandId);
    const newBrand = ECU_BRAND_PROFILES.find(b => b.id === brandId) || ECU_BRAND_PROFILES[0];
    setSelectedPlugFilter('ALL');
    setActivePinDetail(newBrand.pinouts[0]);
    if (newBrand.pcbComponents && newBrand.pcbComponents.length > 0) {
      setSelectedPcbComponent(newBrand.pcbComponents[0]);
    } else {
      setSelectedPcbComponent(null);
      if (viewMode === 'PCB') setViewMode('PHYSICAL');
    }
  };

  // Filtered pins list
  const filteredPins = activeBrand.pinouts.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      p.pinNumber.toString().includes(q) ||
      p.label.toLowerCase().includes(q) ||
      p.signalName.toLowerCase().includes(q) ||
      p.benchRole.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (q === 'ground' && (p.category === 'ground' || p.benchRole.toLowerCase().includes('ground') || p.signalName.toLowerCase().includes('ground'))) ||
      (q === 'k-line' && (p.category === 'communication' || p.label.toLowerCase().includes('k-line') || p.signalName.toLowerCase().includes('k-line') || p.benchRole.toLowerCase().includes('k-line'))) ||
      (q === 'kline' && (p.category === 'communication' || p.label.toLowerCase().includes('k-line') || p.signalName.toLowerCase().includes('k-line') || p.benchRole.toLowerCase().includes('k-line'))) ||
      (q === 'can' && (p.category === 'communication' || p.signalName.toLowerCase().includes('can') || p.label.toLowerCase().includes('can'))) ||
      (q === 'injector' && (p.category === 'actuator_out' || p.signalName.toLowerCase().includes('injector') || p.benchRole.toLowerCase().includes('injector'))) ||
      (q === 'sensor' && (p.category === 'sensor_in' || p.signalName.toLowerCase().includes('sensor'))) ||
      (q === 'sensor signal' && p.category === 'sensor_in') ||
      (q === 'power' && p.category === 'power');

    const matchesPlug = selectedPlugFilter === 'ALL' || p.plug === selectedPlugFilter;
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;

    return matchesSearch && matchesPlug && matchesCategory;
  });

  const getSimulatedVoltage = (pin: BenchPinoutInfo): number => {
    if (pin.associatedSimPinId && nodeVoltages[pin.associatedSimPinId] !== undefined) {
      return nodeVoltages[pin.associatedSimPinId];
    }
    return pin.nominalVoltage;
  };

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden bg-slate-950 text-slate-100 p-2 font-mono select-none">
      
      {/* 1. ECU Brand Family Selector Header Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-3 shadow-md shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
              alt="AutoElectric Lab Pro Official Logo"
              className="h-8 w-auto object-contain rounded border border-cyan-500/40 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
                  {activeBrand.modelName}
                </h2>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/70 border border-cyan-800 px-2 py-0.5 rounded font-semibold">
                  {activeBrand.cavityInfo}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                <strong className="text-amber-300">PH Popular Vehicles:</strong> {activeBrand.popularVehiclesInPH}
              </p>
            </div>
          </div>

          {/* ECU Brand Select Dropdown & Live Search Button */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">ECU BRAND:</span>
            <select
              value={selectedBrandId}
              onChange={e => handleBrandChange(e.target.value)}
              className="bg-slate-950 border-2 border-cyan-500/80 text-cyan-300 font-bold rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 flex-1 md:w-72 shadow-md cursor-pointer"
            >
              {ECU_BRAND_PROFILES.map(brand => (
                <option key={brand.id} value={brand.id} className="bg-slate-950 text-slate-100 font-mono">
                  {brand.brandName} — {brand.modelName.split('(')[0]}
                </option>
              ))}
            </select>
            {onSearchLivePinout && (
              <button
                onClick={() => onSearchLivePinout(activeBrand.modelName)}
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-950 to-cyan-950 hover:from-blue-900 hover:to-cyan-900 border border-cyan-500/80 text-cyan-200 flex items-center gap-1.5 text-xs font-bold transition whitespace-nowrap shadow-sm"
                title="Search live Google Search Grounding for OEM bench pinouts"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Search Live Pinouts</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick ECU Brand Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {ECU_BRAND_PROFILES.map(brand => {
            const isSelected = brand.id === selectedBrandId;
            return (
              <button
                key={brand.id}
                onClick={() => handleBrandChange(brand.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-cyan-600 text-white border-cyan-400 shadow-md ring-1 ring-cyan-300'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                <Car className="w-3 h-3" />
                <span>{brand.brandName.split('/')[0]}</span>
                {isSelected && <Check className="w-3 h-3 text-cyan-200" />}
              </button>
            );
          })}
        </div>

        {/* Search by Function & Plug Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search function (Ground, CAN, Injector, Sensor)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64 sm:w-72"
              />
            </div>

            {/* Quick Function Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10.5px]">
              <button
                onClick={() => setSearchQuery('')}
                className={`px-2 py-0.5 rounded transition ${searchQuery === '' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setSearchQuery('Ground')}
                className={`px-2 py-0.5 rounded transition ${searchQuery.toLowerCase() === 'ground' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Ground
              </button>
              <button
                onClick={() => setSearchQuery('K-Line')}
                className={`px-2 py-0.5 rounded transition ${searchQuery.toLowerCase() === 'k-line' || searchQuery.toLowerCase() === 'kline' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-400 hover:text-white'}`}
              >
                K-Line (ISO-9141)
              </button>
              <button
                onClick={() => setSearchQuery('CAN')}
                className={`px-2 py-0.5 rounded transition ${searchQuery.toLowerCase() === 'can' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                CAN
              </button>
              <button
                onClick={() => setSearchQuery('Injector')}
                className={`px-2 py-0.5 rounded transition ${searchQuery.toLowerCase() === 'injector' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Injector
              </button>
              <button
                onClick={() => setSearchQuery('Sensor')}
                className={`px-2 py-0.5 rounded transition ${searchQuery.toLowerCase() === 'sensor' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Sensor Signal
              </button>
            </div>

            {/* Dynamic Plug Chamber Filter */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs hidden sm:flex">
              {activeBrand.plugs.map(plug => (
                <button
                  key={plug.id}
                  onClick={() => setSelectedPlugFilter(plug.id)}
                  className={`px-2.5 py-1 rounded transition text-[10.5px] ${
                    selectedPlugFilter === plug.id ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {plug.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowOverlayMarkers(!showOverlayMarkers)}
            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition ${
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
        
        {/* Left Column: Actual ECU Image / Logical Schematic & Interactive Pins */}
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

            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setViewMode('PHYSICAL')}
                className={`px-2.5 py-1 rounded transition text-[10.5px] font-bold flex items-center gap-1 cursor-pointer ${
                  viewMode === 'PHYSICAL' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📷 Socket Plug</span>
              </button>
              {activeBrand.pcbImageSrc && (
                <button
                  onClick={() => {
                    setViewMode('PCB');
                    if (!selectedPcbComponent && activeBrand.pcbComponents && activeBrand.pcbComponents.length > 0) {
                      setSelectedPcbComponent(activeBrand.pcbComponents[0]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded transition text-[10.5px] font-bold flex items-center gap-1 cursor-pointer ${
                    viewMode === 'PCB' ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300' : 'text-emerald-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-emerald-300" />
                  <span>🔬 Internal PCB Board</span>
                </button>
              )}
              <button
                onClick={() => setViewMode('LOGICAL')}
                className={`px-2.5 py-1 rounded transition text-[10.5px] font-bold flex items-center gap-1 cursor-pointer ${
                  viewMode === 'LOGICAL' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡ Logical Schematic</span>
              </button>
            </div>
          </div>

          {/* View Mode Content: Physical Photo Container, Internal PCB Board Photo, OR Logical SVG Schematic */}
          {viewMode === 'PHYSICAL' ? (
            <div className="relative h-64 sm:h-80 lg:flex-1 bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center group">
              <img
                src={activeBrand.imageSrc}
                alt={`${activeBrand.modelName} Connector Face Socket`}
                className="w-full h-full object-contain select-none"
              />

              {/* Interactive Pin Tracking Marker Overlay */}
              {showOverlayMarkers && (
                <div className="absolute inset-0 pointer-events-auto">
                  {activeBrand.pinouts.map(pin => {
                    if (!pin.connectorCoords) return null;
                    const isSelected = activePinDetail.pinNumber === pin.pinNumber;
                    const isRedProbe = multimeter.redProbe.attachedToPinId === pin.associatedSimPinId;
                    const isBlackProbe = multimeter.blackProbe.attachedToPinId === pin.associatedSimPinId;

                    return (
                      <div
                        key={pin.pinNumber}
                        onClick={() => {
                          setActivePinDetail(pin);
                          if (pin.associatedSimPinId) onSelectPin(pin.associatedSimPinId);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${pin.connectorCoords.xPercent}%`,
                          top: `${pin.connectorCoords.yPercent}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="cursor-pointer group/pin z-10"
                        title={`Pin #${pin.pinNumber} - ${pin.label} (${pin.signalName})`}
                      >
                        {/* Pulsing Target Dot */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-cyan-400 border-white ring-4 ring-cyan-400/50 scale-125 z-20'
                              : isRedProbe
                              ? 'bg-rose-500 border-white ring-4 ring-rose-500/50 scale-110 z-20 animate-pulse'
                              : isBlackProbe
                              ? 'bg-slate-300 border-black ring-4 ring-slate-400/50 scale-110 z-20 animate-pulse'
                              : 'bg-amber-500/80 border-amber-200 hover:scale-125 hover:bg-amber-300'
                          }`}
                        >
                          <span className="text-[7px] font-bold text-slate-950 font-mono">
                            {pin.pinNumber}
                          </span>
                        </div>

                        {/* Tooltip on Hover */}
                        <div className="opacity-0 group-hover/pin:opacity-100 pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 bg-slate-950 border border-cyan-500 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-30 transition">
                          <strong>#{pin.pinNumber} {pin.label}</strong> ({pin.signalName})
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick Helper Badge */}
              <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded border border-slate-800 text-[10px] text-slate-400">
                Click any pin cavity to inspect bench test wiring & attach multimeter probes
              </div>
            </div>
          ) : viewMode === 'PCB' && activeBrand.pcbImageSrc ? (
            <div className="relative h-64 sm:h-80 lg:flex-1 bg-black rounded-lg overflow-hidden border border-emerald-500/50 flex items-center justify-center group">
              <img
                src={activeBrand.pcbImageSrc}
                alt={`${activeBrand.modelName} Internal PCB Board Inspection`}
                className="w-full h-full object-contain select-none"
              />

              {/* Interactive PCB Component Hotspots */}
              <div className="absolute inset-0 pointer-events-auto">
                {activeBrand.pcbComponents?.map(comp => {
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
                      {/* Pulsing Hotspot Target */}
                      <div
                        className={`px-2 py-0.5 rounded-full border text-[9px] font-bold font-mono flex items-center gap-1 transition-all shadow-lg ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 border-white ring-4 ring-emerald-400/60 scale-110 z-20'
                            : 'bg-emerald-950/90 text-emerald-300 border-emerald-500 hover:scale-110 hover:bg-emerald-800'
                        }`}
                      >
                        <Cpu className="w-2.5 h-2.5 shrink-0" />
                        <span className="whitespace-nowrap">{comp.designation.split(' ')[0]}</span>
                      </div>

                      {/* Tooltip on Hover */}
                      <div className="opacity-0 group-hover/comp:opacity-100 pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 border border-emerald-400 text-white text-[10px] px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap z-30 transition">
                        <strong className="text-emerald-400">{comp.designation}</strong>: {comp.name}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Helper Badge */}
              <div className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur px-2.5 py-1 rounded border border-emerald-500/60 text-[10px] text-emerald-300">
                Hitachi MEC22-251 Actual PCB Photo · Click any component hotspot to inspect SMD test points
              </div>
            </div>
          ) : (
            <div className="relative h-64 sm:h-80 lg:flex-1 bg-[#060c14] rounded-lg overflow-hidden border border-cyan-500/40 p-3 flex flex-col items-center justify-center shadow-inner">
              <svg className="w-full h-full">
                {/* Schematic grid background */}
                <rect width="100%" height="100%" fill="#081412" opacity="0.7" />
                <path d="M 0 50 L 700 50 M 0 100 L 700 100 M 0 150 L 700 150 M 0 200 L 700 200 M 0 250 L 700 250" stroke="#16362e" strokeWidth="0.8" strokeDasharray="4,4" />

                {/* Central Processor Unit Box */}
                <rect x="230" y="50" width="240" height="200" rx="10" fill="#0d2b23" stroke="#00f3ff" strokeWidth="2.5" />
                <text x="350" y="85" fill="#00f3ff" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  {activeBrand.brandName.toUpperCase()} MCU
                </text>
                <text x="350" y="105" fill="#448d79" fontSize="9.5" fontFamily="monospace" textAnchor="middle">
                  {activeBrand.modelName.split('(')[0]}
                </text>
                <text x="350" y="225" fill="#94a3b8" fontSize="8.5" fontFamily="monospace" textAnchor="middle">
                  LOGICAL SCHEMATIC VIEW · ACTIVE BENCH
                </text>

                {/* Pin Nodes & Traces */}
                {activeBrand.pinouts.map((pin, idx) => {
                  const yPos = 70 + (idx * 22) % 155;
                  const isLeft = idx % 2 === 0;
                  const xNode = isLeft ? 230 : 470;
                  const xExt = isLeft ? 50 : 650;
                  const isSelected = activePinDetail.pinNumber === pin.pinNumber;
                  const color = pin.colorHex || '#00f3ff';

                  return (
                    <g
                      key={pin.pinNumber}
                      onClick={() => {
                        setActivePinDetail(pin);
                        if (pin.associatedSimPinId) onSelectPin(pin.associatedSimPinId);
                      }}
                      className="cursor-pointer group/sch"
                    >
                      {/* Trace Wire */}
                      <line
                        x1={xNode}
                        y1={yPos}
                        x2={xExt}
                        y2={yPos}
                        stroke={color}
                        strokeWidth={isSelected ? '3.5' : '2'}
                        opacity="0.9"
                        style={{ filter: isSelected ? 'drop-shadow(0 0 8px #00f3ff)' : 'none' }}
                      />
                      {/* Terminal Circle */}
                      <circle
                        cx={xNode}
                        cy={yPos}
                        r={isSelected ? '6' : '4'}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      {/* Label tag */}
                      <rect
                        x={isLeft ? 55 : 565}
                        y={yPos - 9}
                        width="80"
                        height="18"
                        rx="3"
                        fill="#091512"
                        stroke={isSelected ? '#00f3ff' : '#1b4d3e'}
                        strokeWidth="1.5"
                      />
                      <text
                        x={isLeft ? 95 : 605}
                        y={yPos + 3.5}
                        fill={isSelected ? '#00f3ff' : '#cbd5e1'}
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        #{pin.pinNumber} {pin.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-2 left-2 bg-slate-950/90 backdrop-blur px-2.5 py-1 rounded border border-cyan-500/60 text-[10px] text-cyan-300">
                Logical Electrical Schematic · Click any pin node to select
              </div>
            </div>
          )}

          {/* Inspection Card: Displays PCB Component Details OR Harness Socket Pin Details */}
          {viewMode === 'PCB' && selectedPcbComponent ? (
            <div className="bg-slate-950 border border-emerald-500/50 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-white" />
                  <span className="font-bold text-sm text-emerald-300">
                    {selectedPcbComponent.designation} · {selectedPcbComponent.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded uppercase">
                  {selectedPcbComponent.type.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">COMPONENT SPECIFICATION</span>
                  <span className="font-semibold text-emerald-300 font-mono">
                    {selectedPcbComponent.spec}
                  </span>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">ASSOCIATED HARNESS CONNECTOR PINS</span>
                  <span className="font-semibold text-slate-200">
                    {selectedPcbComponent.associatedPins || 'Internal Power/Ground Plane'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-[11px] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px]">
                  <Terminal className="w-3 h-3" />
                  <span>DIAGNOSTIC TEST ROLE & FAILURE SYMPTOMS:</span>
                </div>
                <p className="text-slate-300 text-[11px] font-sans leading-relaxed">
                  {selectedPcbComponent.diagnosticRole}
                </p>
              </div>

              {/* Probing Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const simId = selectedPcbComponent.associatedSimPinId || 'ecu-pin-10';
                      onAttachProbe('red', simId, `${selectedPcbComponent.designation} Test Point`);
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                    <span>Attach Red Probe to Test Point</span>
                  </button>
                  <button
                    onClick={() => {
                      onAttachProbe('black', 'ecu-pin-1', 'PCB Chassis Ground');
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-slate-400 fill-slate-400" />
                    <span>Attach Black COM to PCB Ground</span>
                  </button>
                </div>
                <button
                  onClick={() => setViewMode('PHYSICAL')}
                  className="px-2.5 py-1 text-xs rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Inspect Harness Socket Pins</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white"
                    style={{ backgroundColor: activePinDetail.colorHex }}
                  />
                  <span className="font-bold text-sm text-cyan-300">
                    PIN #{activePinDetail.pinNumber} · {activePinDetail.label}
                  </span>
                  <span className="text-slate-400 text-xs">({activePinDetail.signalName})</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">VOLTAGE:</span>
                  <span className="text-amber-400 font-bold tabular-nums">
                    {getSimulatedVoltage(activePinDetail).toFixed(2)} V
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-slate-900 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">CONNECTOR PLUG</span>
                  <span className="font-semibold text-slate-200">
                    {activePinDetail.plug}
                  </span>
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
                <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                  <strong className="text-slate-300">Spec:</strong> {activePinDetail.electricalSpec}
                </div>
              </div>

              {/* Quick Actions for Selected Pin */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const simId = activePinDetail.associatedSimPinId || `ecu-pin-${activePinDetail.pinNumber}`;
                      onAttachProbe('red', simId, `Pin ${activePinDetail.pinNumber} - ${activePinDetail.label}`);
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Disc className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                    <span>Attach Red Probe (+)</span>
                  </button>
                  <button
                    onClick={() => {
                      const simId = activePinDetail.associatedSimPinId || `ecu-pin-${activePinDetail.pinNumber}`;
                      onAttachProbe('black', simId, `Pin ${activePinDetail.pinNumber} - ${activePinDetail.label}`);
                    }}
                    className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
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

        {/* Right Column: Complete Bench Pinout Table with Tracking Numbers */}
        <div className="w-full lg:w-[480px] flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-hidden shadow-inner shrink-0">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">BENCH PINOUT DIRECTORY</span>
              <span className="text-slate-500 text-[10px]">({filteredPins.length} Pins Tracked)</span>
            </div>
            {/* Category Quick Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
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

          {/* Essential Bench Test Checklist Card for Active Brand */}
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-cyan-400 font-bold text-[10px]">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                MINIMUM BENCH FLASH & TEST WIRING ({activeBrand.brandName}):
              </span>
              <span className="text-slate-400 font-normal">{activeBrand.essentialChecklist.length} Essential Wires</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
              {activeBrand.essentialChecklist.map((item, idx) => (
                <div key={idx}>
                  • <strong>{item.pin}</strong>: {item.role}
                </div>
              ))}
            </div>
          </div>

          {/* Pinout List Table */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 max-h-[440px] lg:max-h-none">
            {filteredPins.map(pin => {
              const isSelected = activePinDetail.pinNumber === pin.pinNumber;
              const isRedProbe = multimeter.redProbe.attachedToPinId === pin.associatedSimPinId;
              const isBlackProbe = multimeter.blackProbe.attachedToPinId === pin.associatedSimPinId;
              const v = getSimulatedVoltage(pin);

              return (
                <div
                  key={`${pin.plug}-${pin.pinNumber}`}
                  onClick={() => {
                    setActivePinDetail(pin);
                    if (pin.associatedSimPinId) onSelectPin(pin.associatedSimPinId);
                  }}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-slate-800/90 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Tracking Number Badge */}
                      <span className="w-6 h-6 rounded bg-slate-900 border border-slate-700 font-bold flex items-center justify-center text-cyan-300 text-[11px]">
                        #{pin.pinNumber}
                      </span>
                      <div>
                        <span className="font-bold text-slate-100">{pin.label}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">{pin.signalName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold tabular-nums text-[11px]">
                        {v.toFixed(1)}V
                      </span>
                      {/* Probe Indicator Badges */}
                      {isRedProbe && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" title="Red DMM Probe Attached" />
                      )}
                      {isBlackProbe && (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 ring-2 ring-black" title="Black COM Probe Attached" />
                      )}
                    </div>
                  </div>

                  {/* Wire color and bench connection note */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-1 mt-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: pin.colorHex }}
                      />
                      <span className="truncate">{pin.wireColor}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">{pin.benchRole}</span>
                    </div>
                    <span className="text-slate-500 font-mono shrink-0 ml-1">
                      {pin.plug}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
