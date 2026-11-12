/**
 * AutomotiveModels: Physically consistent models for automotive sensors, actuators, and networks.
 * Uses real physical formulas (Steinhart-Hart, potentiometer dividers, inductive coils, ISO 11898 CAN).
 */

export class AutomotiveModels {
  /**
   * Throttle Position Sensor (TPS) dual potentiometer model.
   * @param anglePercent Throttle blade opening percentage (0 - 100%)
   * @param vRef Reference supply voltage (nominally 5.00V)
   * @returns Track 1 voltage, Track 2 inverted voltage, and potentiometer resistances
   */
  public static calculateTps(anglePercent: number, vRef = 5.0) {
    const clampedAngle = Math.max(0, Math.min(100, anglePercent));
    const normalizedRatio = clampedAngle / 100.0;

    // Automotive throttle pots have physical mechanical end-stops:
    // Track 1: 0.50V at idle (0%) to 4.50V at WOT (100%)
    const track1Voltage = 0.50 + normalizedRatio * 4.0 * (vRef / 5.0);
    // Track 2: Inverted redundant safety track: 4.50V at idle to 0.50V at WOT
    const track2Voltage = 4.50 - normalizedRatio * 4.0 * (vRef / 5.0);

    const totalResistance = 2500; // 2.5kΩ potentiometer track
    const rLower = Math.max(250, (track1Voltage / vRef) * totalResistance);
    const rUpper = Math.max(250, totalResistance - rLower);

    return {
      track1Voltage: Math.max(0, Math.min(vRef, track1Voltage)),
      track2Voltage: Math.max(0, Math.min(vRef, track2Voltage)),
      rUpper,
      rLower,
      totalResistance,
    };
  }

  /**
   * Engine Coolant Temperature (ECT) NTC Thermistor model.
   * Uses the B-parameter Steinhart-Hart equation: R(T) = R25 * exp(B * (1/T - 1/T25))
   * @param tempCelsius Coolant temperature in Celsius (-40°C to 130°C)
   * @returns Thermistor resistance in Ohms and expected voltage with 2.2kΩ internal pull-up
   */
  public static calculateEct(tempCelsius: number, vRef = 5.0) {
    const clampedTemp = Math.max(-40, Math.min(130, tempCelsius));
    const T_kelvin = clampedTemp + 273.15;
    const T25_kelvin = 298.15; // 25°C in Kelvin
    const R25 = 2500; // 2.5kΩ nominal resistance at 25°C
    const BETA = 3950; // Standard automotive NTC thermistor coefficient

    // Exponential NTC resistance calculation
    const resistanceOhms = R25 * Math.exp(BETA * (1.0 / T_kelvin - 1.0 / T25_kelvin));

    // Bosch ECU internal pull-up resistor (2.2kΩ tied to +5V reference rail)
    const pullupOhms = 2200;
    const dividerRatio = resistanceOhms / (resistanceOhms + pullupOhms);
    const voltage = vRef * dividerRatio;

    return {
      resistanceOhms,
      voltage,
      pullupOhms,
    };
  }

  /**
   * Manifold Absolute Pressure (MAP) Sensor model.
   * Linear 20 kPa - 100 kPa transfer function.
   * @param pressureKpa Manifold pressure in kPa (20 kPa idle vacuum to 100 kPa ambient)
   * @param vRef 5.0V sensor supply
   */
  public static calculateMap(pressureKpa: number, vRef = 5.0) {
    const clampedKpa = Math.max(10, Math.min(250, pressureKpa));
    // Linear 0.5V to 4.5V over 20 to 100 kPa range
    const normalized = (clampedKpa - 20) / 80.0;
    const voltage = 0.5 + normalized * 4.0 * (vRef / 5.0);

    return {
      voltage: Math.max(0.2, Math.min(vRef, voltage)),
      pressureKpa: clampedKpa,
    };
  }

  /**
   * High-Speed CAN Bus (ISO 11898) Termination and Differential Voltage Model.
   * @param terminator1Connected Whether ECU 120Ω terminator is intact
   * @param terminator2Connected Whether Cluster/Gateway 120Ω terminator is intact
   */
  public static calculateCanBus(terminator1Connected = true, terminator2Connected = true) {
    let busResistance = Infinity;
    if (terminator1Connected && terminator2Connected) {
      busResistance = 60.0; // Two 120Ω in parallel = 60Ω
    } else if (terminator1Connected || terminator2Connected) {
      busResistance = 120.0; // Single terminator intact
    }

    // Nominal Recessive: CAN-H = 2.50V, CAN-L = 2.50V, Differential = 0.0V
    // Nominal Dominant:  CAN-H = 3.50V, CAN-L = 1.50V, Differential = 2.0V
    return {
      busResistanceOhms: busResistance,
      recessiveVoltageH: 2.5,
      recessiveVoltageL: 2.5,
      dominantVoltageH: 3.5,
      dominantVoltageL: 1.5,
      differentialDominantV: 2.0,
      differentialRecessiveV: 0.0,
    };
  }
}
