/**
 * SignalGenerator: Generates time-domain automotive waveforms driven by simulation parameters.
 * Eliminates artificial Math.random noise with reproducible physical signal synthesis.
 */

export class SignalGenerator {
  /**
   * Generates Crankshaft 60-2 VR (Variable Reluctance) sensor waveform.
   * @param t Time in seconds
   * @param rpm Engine rotational speed in RPM
   * @returns Instantaneous voltage in Volts
   */
  public static getCrankshaftVrSignal(t: number, rpm = 1200): number {
    const revsPerSec = rpm / 60.0;
    // 60 teeth per revolution (each tooth is 1/60th of a revolution)
    const teethPerSec = revsPerSec * 60.0;
    const currentToothCycle = (t * teethPerSec) % 60;

    // Missing 2 teeth (teeth 58 and 59 are absent for Top-Dead-Center cylinder 1 sync)
    if (currentToothCycle >= 58) {
      return 0.0;
    }

    // Peak VR amplitude scales with engine speed: e.g. 2.5V at 800 RPM, 6V at 2500 RPM
    const peakAmplitude = Math.min(18.0, 1.2 + (rpm / 1000.0) * 1.8);
    const toothPhase = (currentToothCycle % 1) * 2 * Math.PI;
    return peakAmplitude * Math.sin(toothPhase);
  }

  /**
   * Generates Camshaft Hall Effect sensor square sync pulse.
   * Runs at half crankshaft speed (4-stroke engine cycle).
   */
  public static getCamshaftHallSignal(t: number, rpm = 1200): number {
    const camRevsPerSec = rpm / 120.0;
    const camPhase = (t * camRevsPerSec) % 1.0;
    // Single 5V pulse over 180° of camshaft rotation (0.5 duty cycle)
    return camPhase < 0.5 ? 5.0 : 0.0;
  }

  /**
   * Generates Fuel Injector low-side control voltage waveform with inductive flyback kick.
   * @param t Time in seconds
   * @param isFaulted If circuit has open/short fault
   * @param vBat Battery supply voltage (nominally 12.6V)
   */
  public static getInjectorWaveform(t: number, isFaulted = false, vBat = 12.6): number {
    if (isFaulted) return 0.0;

    // Firing interval: e.g. 50ms cycle (20Hz at 1200 RPM)
    const cyclePeriod = 0.05;
    const tCycle = t % cyclePeriod;
    const pulseWidth = 0.0025; // 2.5ms injection dwell time

    if (tCycle < pulseWidth) {
      // MOSFET turns ON and grounds the injector: voltage drops to ~0.2V (Vce sat)
      return 0.2;
    } else if (tCycle < pulseWidth + 0.0004) {
      // MOSFET turns OFF: Inductor collapses, producing high-voltage flyback spike clamped at 65V
      const spikePhase = (tCycle - pulseWidth) / 0.0004;
      return 65.0 * Math.exp(-spikePhase * 3.5);
    } else {
      // Quiescent state: injector is held high at battery voltage through coil
      return vBat;
    }
  }

  /**
   * Generates High-Speed CAN Bus Differential Signals (ISO 11898 at 500 kbps).
   */
  public static getCanBusSignals(t: number, hasFault = false) {
    if (hasFault) {
      return { canHigh: 0.0, canLow: 0.0, differential: 0.0 };
    }

    // Packet burst generation: pseudo-random but deterministic based on time
    const bitPeriod = 1.0 / 25000.0; // Scaled for visible oscilloscope screen inspection
    const bitIndex = Math.floor(t / bitPeriod);
    const isDominant = ((bitIndex * 2654435761) & 0x7) < 3; // Deterministic pseudo-random bits

    if (isDominant) {
      return {
        canHigh: 3.5,
        canLow: 1.5,
        differential: 2.0,
      };
    } else {
      return {
        canHigh: 2.5,
        canLow: 2.5,
        differential: 0.0,
      };
    }
  }
}
