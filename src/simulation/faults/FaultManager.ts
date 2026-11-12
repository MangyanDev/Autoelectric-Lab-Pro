import { InjectedFault } from '../../types/ecu';
import { CircuitNetwork } from '../electrical/CircuitNetwork';

/**
 * FaultManager: Applies physical topological faults directly into the MNA electrical circuit network.
 * Supports multiple simultaneous faults without overwriting.
 */
export class FaultManager {
  public static applyFaults(network: CircuitNetwork, faults: InjectedFault[]): void {
    for (const fault of faults) {
      const pinNode = fault.pinId.toLowerCase();

      switch (fault.faultType) {
        case 'SHORT_TO_GND':
          // Low-impedance 0.01Ω direct path to Ground (Node 0)
          network.addResistor(`fault-short-gnd-${fault.pinId}`, pinNode, 'chassis-gnd', 0.01);
          break;

        case 'SHORT_TO_VBAT':
          // Low-impedance 0.01Ω direct path to Battery Positive (+12V Rail)
          network.addResistor(`fault-short-vbat-${fault.pinId}`, pinNode, 'bench-vbat', 0.01);
          break;

        case 'HIGH_RESISTANCE_50R':
          // Adds 50Ω corrosion/contact resistance in series to ground or load
          network.addResistor(`fault-high-r50-${fault.pinId}`, pinNode, 'chassis-gnd', 50.0);
          break;

        case 'HIGH_RESISTANCE_250R':
          // Adds 250Ω harness corrosion resistance
          network.addResistor(`fault-high-r250-${fault.pinId}`, pinNode, 'chassis-gnd', 250.0);
          break;

        case 'HIGH_RESISTANCE_1K':
          // Adds 1000Ω high-resistance terminal oxidation
          network.addResistor(`fault-high-r1k-${fault.pinId}`, pinNode, 'chassis-gnd', 1000.0);
          break;

        case 'OPEN_CIRCUIT':
          // An open circuit isolates the pin: simulated with Gmin bleed (10^9 Ω)
          network.addResistor(`fault-open-${fault.pinId}`, pinNode, 'chassis-gnd', 1e9);
          break;

        default:
          break;
      }
    }
  }
}
