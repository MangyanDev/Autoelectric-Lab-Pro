/**
 * MatrixSolver: High-performance linear equation solver for Modified Nodal Analysis (MNA).
 * Solves [A][x] = [b] using Gaussian Elimination with Partial Pivoting.
 * Designed with numerical stability checks, singular matrix detection, and SI unit fidelity.
 */

export class MatrixSolver {
  private static readonly EPSILON = 1e-12;

  /**
   * Solves the linear system A * x = b.
   * @param A Square matrix of size N x N (conductances and branch incidence)
   * @param b Right-hand side vector of size N (currents and voltage sources)
   * @returns Solution vector x of size N (node voltages and branch currents)
   */
  public static solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    if (n === 0) return [];
    if (A.length !== n) {
      throw new Error(`Matrix dimension mismatch: A is ${A.length}x${A[0]?.length || 0}, b is ${n}`);
    }

    // Create deep copies to avoid mutating input matrices
    const M: number[][] = Array.from({ length: n }, (_, i) => [...A[i]]);
    const rhs: number[] = [...b];

    // Forward Elimination with Partial Pivoting
    for (let k = 0; k < n; k++) {
      // Find pivot row with maximum absolute value in column k
      let maxRow = k;
      let maxVal = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        const val = Math.abs(M[i][k]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = i;
        }
      }

      // Check for singularity / floating sub-circuit
      if (maxVal < this.EPSILON) {
        // Regularize near-singular diagonal with micro-conductance (Gmin)
        M[k][k] = this.EPSILON;
      }

      // Swap rows in M and rhs if pivot row is not current row
      if (maxRow !== k) {
        const tempRow = M[k];
        M[k] = M[maxRow];
        M[maxRow] = tempRow;

        const tempRhs = rhs[k];
        rhs[k] = rhs[maxRow];
        rhs[maxRow] = tempRhs;
      }

      // Eliminate rows below pivot
      const pivot = M[k][k];
      for (let i = k + 1; i < n; i++) {
        const factor = M[i][k] / pivot;
        if (Math.abs(factor) > this.EPSILON) {
          rhs[i] -= factor * rhs[k];
          for (let j = k; j < n; j++) {
            M[i][j] -= factor * M[k][j];
          }
        }
      }
    }

    // Back Substitution
    const x: number[] = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = rhs[i];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      const diag = M[i][i];
      if (Math.abs(diag) < this.EPSILON) {
        x[i] = 0; // Singular floating node defaults to 0V ground reference
      } else {
        x[i] = sum / diag;
      }
    }

    return x;
  }
}
