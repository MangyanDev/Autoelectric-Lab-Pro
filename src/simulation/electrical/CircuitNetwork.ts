import { MatrixSolver } from '../engine/MatrixSolver';

export interface ResistorBranch {
  id: string;
  nodeA: string;
  nodeB: string;
  resistanceOhms: number;
}

export interface VoltageSourceBranch {
  id: string;
  posNode: string;
  negNode: string;
  voltageVolts: number;
  internalResistanceOhms: number;
}

export interface CurrentSourceBranch {
  id: string;
  fromNode: string;
  toNode: string;
  currentAmps: number;
}

export interface CircuitSolutionResult {
  nodeVoltages: Record<string, number>;
  branchCurrentsAmps: Record<string, number>;
  sourceCurrentDrawAmps: number;
  isSolved: boolean;
  warnings: string[];
}

/**
 * CircuitNetwork: Topological Modified Nodal Analysis (MNA) Network.
 * Models electrical nodes, branches, grounds, and solves node voltages using Kirchhoff's laws.
 */
export class CircuitNetwork {
  private nodeMap: Map<string, number> = new Map();
  private reverseNodeMap: Map<number, string> = new Map();
  private resistors: Map<string, ResistorBranch> = new Map();
  private voltageSources: Map<string, VoltageSourceBranch> = new Map();
  private currentSources: Map<string, CurrentSourceBranch> = new Map();
  private gMin: number = 1e-9; // 1 GΩ shunt conductance to ground for numerical stability on floating nodes

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.nodeMap.clear();
    this.reverseNodeMap.clear();
    this.resistors.clear();
    this.voltageSources.clear();
    this.currentSources.clear();

    // Node 0 is always the absolute Ground reference (KL31 / Chassis Ground)
    this.nodeMap.set('0', 0);
    this.nodeMap.set('gnd', 0);
    this.nodeMap.set('chassis-gnd', 0);
    this.reverseNodeMap.set(0, 'chassis-gnd');
  }

  /**
   * Registers a node name or retrieves its integer index.
   */
  public getOrCreateNode(name: string | number): number {
    const normalized = String(name ?? '').trim().toLowerCase();
    if (this.nodeMap.has(normalized)) {
      return this.nodeMap.get(normalized)!;
    }
    const newIndex = this.nodeMap.size;
    this.nodeMap.set(normalized, newIndex);
    this.reverseNodeMap.set(newIndex, String(name));
    return newIndex;
  }

  /**
   * Adds or updates a resistor branch.
   * Supports both (id, nodeA, nodeB, resistanceOhms) and (nodeA, nodeB, resistanceOhms).
   */
  public addResistor(
    arg1: string,
    arg2: string,
    arg3: string | number,
    arg4?: number
  ): void {
    let id: string;
    let nodeA: string;
    let nodeB: string;
    let resistanceOhms: number;

    if (typeof arg3 === 'number' && arg4 === undefined) {
      // Called as addResistor(nodeA, nodeB, resistanceOhms)
      nodeA = arg1;
      nodeB = arg2;
      resistanceOhms = arg3;
      id = `res_${nodeA}_${nodeB}_${this.resistors.size}`;
    } else {
      // Called as addResistor(id, nodeA, nodeB, resistanceOhms)
      id = arg1;
      nodeA = arg2;
      nodeB = String(arg3);
      resistanceOhms = arg4 ?? 1e-4;
    }

    const validR = Math.max(1e-4, resistanceOhms);
    this.getOrCreateNode(nodeA);
    this.getOrCreateNode(nodeB);
    this.resistors.set(id, { id, nodeA, nodeB, resistanceOhms: validR });
  }

  /**
   * Adds or updates an independent voltage source branch.
   */
  public addVoltageSource(
    id: string,
    posNode: string,
    negNode: string,
    voltageVolts: number,
    internalResistanceOhms = 0.05
  ): void {
    this.getOrCreateNode(posNode);
    this.getOrCreateNode(negNode);
    this.voltageSources.set(id, {
      id,
      posNode,
      negNode,
      voltageVolts,
      internalResistanceOhms: Math.max(1e-4, internalResistanceOhms),
    });
  }

  /**
   * Adds an independent current source or sink.
   */
  public addCurrentSource(id: string, fromNode: string, toNode: string, currentAmps: number): void {
    this.getOrCreateNode(fromNode);
    this.getOrCreateNode(toNode);
    this.currentSources.set(id, { id, fromNode, toNode, currentAmps });
  }

  /**
   * Solves the complete DC circuit using Modified Nodal Analysis (MNA).
   * Constructs the conductance matrix G, incidence matrices B & C, and RHS vector.
   */
  public solve(): CircuitSolutionResult {
    // Number of non-ground nodes
    // Node 0 is ground, nodes 1..N are unknown node voltages
    const nonGroundNodes = this.nodeMap.size - 1; // excluding node 0
    const numVSources = this.voltageSources.size;
    const totalUnknowns = nonGroundNodes + numVSources;

    if (nonGroundNodes <= 0) {
      return {
        nodeVoltages: { 'chassis-gnd': 0 },
        branchCurrentsAmps: {},
        sourceCurrentDrawAmps: 0,
        isSolved: true,
        warnings: [],
      };
    }

    // Allocate MNA Matrix [A] of size (N + M) x (N + M) and RHS vector [b]
    const A: number[][] = Array.from({ length: totalUnknowns }, () => new Array(totalUnknowns).fill(0));
    const b: number[] = new Array(totalUnknowns).fill(0);

    // 1. Stamp shunt conductance to ground Gmin to prevent floating node singularity
    for (let i = 0; i < nonGroundNodes; i++) {
      A[i][i] += this.gMin;
    }

    // 2. Stamp Resistors into Conductance Matrix G (rows/cols 0..nonGroundNodes-1)
    for (const res of this.resistors.values()) {
      const idxA = this.getOrCreateNode(res.nodeA);
      const idxB = this.getOrCreateNode(res.nodeB);
      const G = 1.0 / res.resistanceOhms;

      // Map to 0-based non-ground index (index - 1)
      if (idxA !== 0) {
        const rowA = idxA - 1;
        A[rowA][rowA] += G;
        if (idxB !== 0) {
          const colB = idxB - 1;
          A[rowA][colB] -= G;
        }
      }

      if (idxB !== 0) {
        const rowB = idxB - 1;
        A[rowB][rowB] += G;
        if (idxA !== 0) {
          const colA = idxA - 1;
          A[rowB][colA] -= G;
        }
      }
    }

    // 3. Stamp Current Sources into RHS vector b
    for (const cs of this.currentSources.values()) {
      const idxFrom = this.getOrCreateNode(cs.fromNode);
      const idxTo = this.getOrCreateNode(cs.toNode);

      // Current leaves idxFrom (-I) and enters idxTo (+I)
      if (idxFrom !== 0) {
        b[idxFrom - 1] -= cs.currentAmps;
      }
      if (idxTo !== 0) {
        b[idxTo - 1] += cs.currentAmps;
      }
    }

    // 4. Stamp Voltage Sources into MNA sub-matrices B and C, and RHS
    let vSourceIdx = 0;
    const vSourceEntries: { id: string; branchIdx: number }[] = [];
    for (const vs of this.voltageSources.values()) {
      const idxPos = this.getOrCreateNode(vs.posNode);
      const idxNeg = this.getOrCreateNode(vs.negNode);
      const vEquationRow = nonGroundNodes + vSourceIdx;

      vSourceEntries.push({ id: vs.id, branchIdx: vEquationRow });

      if (idxPos !== 0) {
        const posCol = idxPos - 1;
        A[posCol][vEquationRow] += 1.0; // B matrix (incidence)
        A[vEquationRow][posCol] += 1.0; // C matrix (incidence)
      }

      if (idxNeg !== 0) {
        const negCol = idxNeg - 1;
        A[negCol][vEquationRow] -= 1.0;
        A[vEquationRow][negCol] -= 1.0;
      }

      // If source has internal resistance, stamp it into the diagonal
      if (vs.internalResistanceOhms > 1e-4) {
        A[vEquationRow][vEquationRow] = -vs.internalResistanceOhms;
      }

      b[vEquationRow] = vs.voltageVolts;
      vSourceIdx++;
    }

    // Solve the MNA system [A][x] = [b]
    let x: number[];
    try {
      x = MatrixSolver.solve(A, b);
    } catch {
      return {
        nodeVoltages: {},
        branchCurrentsAmps: {},
        sourceCurrentDrawAmps: 0,
        isSolved: false,
        warnings: ['Matrix solver divergence: check for ungrounded circuits or extreme resistances.'],
      };
    }

    // Extract node voltages
    const nodeVoltages: Record<string, number> = {};
    for (const [name, index] of this.nodeMap.entries()) {
      if (index === 0) {
        nodeVoltages[name] = 0.0;
      } else {
        const row = index - 1;
        const v = x[row] !== undefined ? x[row] : 0.0;
        nodeVoltages[name] = Math.abs(v) < 1e-6 ? 0.0 : v;
      }
    }

    // Extract branch currents through resistors
    const branchCurrents: Record<string, number> = {};
    for (const res of this.resistors.values()) {
      const vA = nodeVoltages[res.nodeA.toLowerCase()] || 0.0;
      const vB = nodeVoltages[res.nodeB.toLowerCase()] || 0.0;
      const iBranch = (vA - vB) / res.resistanceOhms;
      branchCurrents[res.id] = iBranch;
    }

    // Calculate total supply current draw
    let totalDrawAmps = 0;
    for (const entry of vSourceEntries) {
      const currentThroughVSource = Math.abs(x[entry.branchIdx] || 0);
      branchCurrents[entry.id] = currentThroughVSource;
      totalDrawAmps += currentThroughVSource;
    }

    return {
      nodeVoltages,
      branchCurrentsAmps: branchCurrents,
      sourceCurrentDrawAmps: totalDrawAmps,
      isSolved: true,
      warnings: [],
    };
  }

  /**
   * Calculates equivalent Thevenin/Norton resistance between two probe terminals.
   * Injects an infinitesimal test current (1mA) and measures resultant delta voltage.
   */
  public calculateEquivalentResistance(nodeA: string | number, nodeB: string | number): number {
    const normA = String(nodeA ?? '').trim().toLowerCase();
    const normB = String(nodeB ?? '').trim().toLowerCase();
    if (normA === normB) return 0.0;

    // Create a shadow isolated resistance measurement network
    const testNet = new CircuitNetwork();

    // Copy all passive resistors from this network
    for (const res of this.resistors.values()) {
      testNet.addResistor(res.id, res.nodeA, res.nodeB, res.resistanceOhms);
    }

    // De-energize active voltage sources (short them to their internal resistance for Thevenin equivalent)
    for (const vs of this.voltageSources.values()) {
      testNet.addResistor(`internal-r-${vs.id}`, vs.posNode, vs.negNode, vs.internalResistanceOhms || 0.05);
    }

    // Inject 1mA test current from nodeA to nodeB
    const iTest = 0.001; // 1 mA
    testNet.addCurrentSource('dmm-itest', normB, normA, iTest);

    const sol = testNet.solve();
    const vA = sol.nodeVoltages[normA] || 0.0;
    const vB = sol.nodeVoltages[normB] || 0.0;
    const deltaV = Math.abs(vA - vB);

    const rEq = deltaV / iTest;
    return rEq > 1e7 ? Infinity : rEq;
  }
}
