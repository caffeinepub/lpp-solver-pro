// LPP Solver - Pure TypeScript Math Engine

export interface Constraint {
  coeffs: number[];
  sign: "<=" | ">=" | "=";
  rhs: number;
}

export interface LPProblem {
  isMaximize: boolean;
  numVars: number;
  objective: number[];
  constraints: Constraint[];
}

export interface Tableau {
  matrix: number[][];
  basis: number[];
  varNames: string[];
  iteration: number;
}

export interface RowCalc {
  rowName: string;
  isPivot: boolean;
  currentRow: number[];
  pivotRowValues: number[];
  pivotCoeff: number;
  multiplied: number[];
  newRow: number[];
  pivotElement?: number;
}

export interface IterationStep {
  tableau: Tableau;
  pivotCol: number;
  pivotRow: number;
  rowCalculations: RowCalc[];
  resultTableau: Tableau;
  method: "simplex" | "dual-simplex";
}

export type SolverMethod = "simplex" | "dual-simplex";

export interface SolveResult {
  standardFormTableau: Tableau;
  method: SolverMethod;
  iterations: IterationStep[];
  status: "optimal" | "unbounded" | "infeasible" | "needs-tie-break";
  tiedPivotCols?: number[];
  tiedPivotRows?: number[];
  pendingIteration?: {
    tableau: Tableau;
    pivotCol?: number;
    method: SolverMethod;
  };
  optimalSolution?: { [varName: string]: number };
  objectiveValue?: number;
  isMinimization?: boolean;
}

const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function toSub(n: number): string {
  return String(n)
    .split("")
    .map((d) => subscripts[Number.parseInt(d)])
    .join("");
}

export function varName(i: number): string {
  return `x${toSub(i + 1)}`;
}

export function slackName(i: number): string {
  return `s${toSub(i + 1)}`;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function cloneMatrix(m: number[][]): number[][] {
  return m.map((r) => [...r]);
}

function cloneTableau(t: Tableau): Tableau {
  return {
    matrix: cloneMatrix(t.matrix),
    basis: [...t.basis],
    varNames: [...t.varNames],
    iteration: t.iteration,
  };
}

export function buildStandardForm(problem: LPProblem): Tableau {
  const { isMaximize, numVars, objective, constraints } = problem;

  // Normalize to maximization
  const obj = isMaximize ? [...objective] : objective.map((c) => -c);

  // Expand constraints to <=
  const expandedConstraints: { coeffs: number[]; rhs: number }[] = [];
  for (const c of constraints) {
    if (c.sign === ">=") {
      expandedConstraints.push({
        coeffs: c.coeffs.map((x) => -x),
        rhs: -c.rhs,
      });
    } else if (c.sign === "=") {
      // = splits into two
      expandedConstraints.push({ coeffs: [...c.coeffs], rhs: c.rhs });
      expandedConstraints.push({
        coeffs: c.coeffs.map((x) => -x),
        rhs: -c.rhs,
      });
    } else {
      expandedConstraints.push({ coeffs: [...c.coeffs], rhs: c.rhs });
    }
  }

  const m = expandedConstraints.length;
  const n = numVars + m; // decision + slack vars
  const cols = n + 1; // +1 for RHS

  const varNames: string[] = [
    ...Array.from({ length: numVars }, (_, i) => varName(i)),
    ...Array.from({ length: m }, (_, i) => slackName(i)),
    "RHS",
  ];

  // Build matrix: row 0 = Z row, rows 1..m = constraints
  const matrix: number[][] = [];

  // Z row: -(obj coeffs), 0 for slacks, 0 for RHS
  const zRow = new Array(cols).fill(0);
  for (let j = 0; j < numVars; j++) {
    zRow[j] = -obj[j];
  }
  matrix.push(zRow);

  // Constraint rows
  for (let i = 0; i < m; i++) {
    const row = new Array(cols).fill(0);
    for (let j = 0; j < numVars; j++) {
      row[j] = expandedConstraints[i].coeffs[j] ?? 0;
    }
    // Slack variable: identity column
    row[numVars + i] = 1;
    row[cols - 1] = expandedConstraints[i].rhs;
    matrix.push(row);
  }

  // Basis: slack variables s1..sm are basic (indices numVars..numVars+m-1)
  const basis = Array.from({ length: m }, (_, i) => numVars + i);

  return { matrix, basis, varNames, iteration: 0 };
}

export function detectMethod(tableau: Tableau): SolverMethod {
  const m = tableau.matrix.length - 1;
  const cols = tableau.matrix[0].length;
  for (let i = 1; i <= m; i++) {
    if (tableau.matrix[i][cols - 1] < -1e-8) return "dual-simplex";
  }
  return "simplex";
}

function findSimplexPivotCol(tableau: Tableau): number[] {
  const zRow = tableau.matrix[0];
  const cols = zRow.length - 1;
  let minVal = -1e-8;
  const tied: number[] = [];
  for (let j = 0; j < cols; j++) {
    if (zRow[j] < minVal - 1e-8) {
      minVal = zRow[j];
      tied.length = 0;
      tied.push(j);
    } else if (Math.abs(zRow[j] - minVal) < 1e-8 && zRow[j] < -1e-8) {
      tied.push(j);
    }
  }
  return tied;
}

function findSimplexPivotRow(tableau: Tableau, pivotCol: number): number[] {
  const m = tableau.matrix.length - 1;
  const cols = tableau.matrix[0].length;
  let minRatio = Number.POSITIVE_INFINITY;
  const tied: number[] = [];
  for (let i = 1; i <= m; i++) {
    const val = tableau.matrix[i][pivotCol];
    if (val > 1e-8) {
      const ratio = tableau.matrix[i][cols - 1] / val;
      if (ratio < minRatio - 1e-8) {
        minRatio = ratio;
        tied.length = 0;
        tied.push(i);
      } else if (Math.abs(ratio - minRatio) < 1e-8) {
        tied.push(i);
      }
    }
  }
  return tied;
}

function findDualPivotRow(tableau: Tableau): number[] {
  const m = tableau.matrix.length - 1;
  const cols = tableau.matrix[0].length;
  let minRHS = -1e-8;
  const tied: number[] = [];
  for (let i = 1; i <= m; i++) {
    const rhs = tableau.matrix[i][cols - 1];
    if (rhs < minRHS - 1e-8) {
      minRHS = rhs;
      tied.length = 0;
      tied.push(i);
    } else if (Math.abs(rhs - minRHS) < 1e-8 && rhs < -1e-8) {
      tied.push(i);
    }
  }
  return tied;
}

function findDualPivotCol(tableau: Tableau, pivotRow: number): number[] {
  const cols = tableau.matrix[0].length - 1;
  const row = tableau.matrix[pivotRow];
  const zRow = tableau.matrix[0];
  let minRatio = Number.POSITIVE_INFINITY;
  const tied: number[] = [];
  for (let j = 0; j < cols; j++) {
    if (row[j] < -1e-8) {
      const ratio = -zRow[j] / row[j];
      if (ratio < minRatio - 1e-8) {
        minRatio = ratio;
        tied.length = 0;
        tied.push(j);
      } else if (Math.abs(ratio - minRatio) < 1e-8) {
        tied.push(j);
      }
    }
  }
  return tied;
}

function performRowOps(
  tableau: Tableau,
  pivotRow: number,
  pivotCol: number,
): { newTableau: Tableau; rowCalcs: RowCalc[] } {
  const m = tableau.matrix.length;
  const pivotElement = tableau.matrix[pivotRow][pivotCol];
  const rowCalcs: RowCalc[] = [];

  const newMatrix = cloneMatrix(tableau.matrix);

  // Normalize pivot row
  const oldPivotRow = [...tableau.matrix[pivotRow]];
  const newPivotRow = oldPivotRow.map((v) => round6(v / pivotElement));
  newMatrix[pivotRow] = newPivotRow;

  const rowNames = ["Z", ...tableau.basis.map((b) => tableau.varNames[b])];

  // Pivot row calc
  rowCalcs.push({
    rowName: rowNames[pivotRow],
    isPivot: true,
    currentRow: oldPivotRow,
    pivotRowValues: oldPivotRow,
    pivotCoeff: pivotElement,
    multiplied: [],
    newRow: newPivotRow,
    pivotElement,
  });

  // Other rows
  for (let i = 0; i < m; i++) {
    if (i === pivotRow) continue;
    const currentRow = [...tableau.matrix[i]];
    const pivotCoeff = currentRow[pivotCol];
    const multiplied = newPivotRow.map((v) => round6(pivotCoeff * v));
    const newRow = currentRow.map((v, j) => round6(v - multiplied[j]));
    newMatrix[i] = newRow;
    rowCalcs.push({
      rowName: rowNames[i],
      isPivot: false,
      currentRow,
      pivotRowValues: newPivotRow,
      pivotCoeff,
      multiplied,
      newRow,
    });
  }

  const newBasis = [...tableau.basis];
  newBasis[pivotRow - 1] = pivotCol;

  const newTableau: Tableau = {
    matrix: newMatrix,
    basis: newBasis,
    varNames: tableau.varNames,
    iteration: tableau.iteration + 1,
  };

  return { newTableau, rowCalcs };
}

export function isOptimal(tableau: Tableau, method: SolverMethod): boolean {
  const zRow = tableau.matrix[0];
  const cols = zRow.length - 1;
  if (method === "simplex") {
    for (let j = 0; j < cols; j++) {
      if (zRow[j] < -1e-8) return false;
    }
    return true;
  }
  // dual simplex: check all RHS >= 0
  for (let i = 1; i < tableau.matrix.length; i++) {
    if (tableau.matrix[i][cols] < -1e-8) return false;
  }
  // also check z row is non-negative
  for (let j = 0; j < cols; j++) {
    if (zRow[j] < -1e-8) return false;
  }
  return true;
}

export function extractSolution(
  tableau: Tableau,
  _numOrigVars: number,
  isMinimization: boolean,
): { solution: { [key: string]: number }; objectiveValue: number } {
  const cols = tableau.matrix[0].length;
  const solution: { [key: string]: number } = {};

  // All variables default to 0
  for (let j = 0; j < cols - 1; j++) {
    solution[tableau.varNames[j]] = 0;
  }

  // Basic variables get their RHS value
  for (let i = 0; i < tableau.basis.length; i++) {
    const bIdx = tableau.basis[i];
    solution[tableau.varNames[bIdx]] = round6(tableau.matrix[i + 1][cols - 1]);
  }

  let objectiveValue = round6(tableau.matrix[0][cols - 1]);
  if (isMinimization) objectiveValue = -objectiveValue;

  return { solution, objectiveValue };
}

export function fractionalPart(n: number): number {
  return n - Math.floor(n);
}

export function findGomoryCutRows(tableau: Tableau): number[] {
  const m = tableau.matrix.length - 1;
  const cols = tableau.matrix[0].length;
  let maxFrac = 1e-6;
  const rows: number[] = [];
  for (let i = 1; i <= m; i++) {
    const rhs = tableau.matrix[i][cols - 1];
    if (rhs >= -1e-8) {
      const frac = fractionalPart(Math.abs(rhs));
      if (frac > 1e-6 && frac < 1 - 1e-6) {
        if (frac > maxFrac + 1e-6) {
          maxFrac = frac;
          rows.length = 0;
          rows.push(i);
        } else if (Math.abs(frac - maxFrac) < 1e-6) {
          rows.push(i);
        }
      }
    }
  }
  return rows;
}

export function addGomoryCut(
  tableau: Tableau,
  _numOrigVars: number,
  cutRowOverride?: number,
): Tableau | null {
  const m = tableau.matrix.length - 1;
  const cols = tableau.matrix[0].length;

  let cutRow = -1;

  if (cutRowOverride !== undefined) {
    cutRow = cutRowOverride;
  } else {
    // Find basic variable row with largest fractional part
    let maxFrac = 1e-6;
    for (let i = 1; i <= m; i++) {
      const rhs = tableau.matrix[i][cols - 1];
      if (rhs >= -1e-8) {
        const frac = fractionalPart(Math.abs(rhs));
        if (frac > maxFrac && frac < 1 - 1e-6) {
          maxFrac = frac;
          cutRow = i;
        }
      }
    }
  }

  if (cutRow === -1) return null; // all integer

  const row = tableau.matrix[cutRow];
  const newSlackIdx = cols - 1; // new column index

  // Gomory cut coefficients: -(frac part of each column coefficient)
  const cutCoeffs = row.slice(0, cols - 1).map((v) => {
    const frac = fractionalPart(v < 0 ? v - Math.floor(v) : v - Math.floor(v));
    return -frac;
  });
  const cutRhs = -fractionalPart(row[cols - 1]);

  // Add new slack variable column to all rows
  const newVarName = slackName(
    tableau.varNames.filter((n) => n.startsWith("s")).length,
  );
  const newVarNames = [...tableau.varNames.slice(0, -1), newVarName, "RHS"];

  const newMatrix = tableau.matrix.map((r, i) => {
    const newRow = [...r.slice(0, cols - 1), i === 0 ? 0 : 0, r[cols - 1]];
    return newRow;
  });

  // Add the cut row
  const cutRow2 = [...cutCoeffs, 1, cutRhs];
  newMatrix.push(cutRow2);

  const newBasis = [...tableau.basis, newSlackIdx];

  return {
    matrix: newMatrix,
    basis: newBasis,
    varNames: newVarNames,
    iteration: tableau.iteration,
  };
}

export function allInteger(tableau: Tableau): boolean {
  const cols = tableau.matrix[0].length;
  for (let i = 0; i < tableau.basis.length; i++) {
    const val = tableau.matrix[i + 1][cols - 1];
    if (val >= -1e-8) {
      const frac = fractionalPart(val);
      if (frac > 1e-6 && frac < 1 - 1e-6) return false;
    }
  }
  return true;
}

// Run one simplex/dual-simplex iteration with tie handling
// Returns the iteration step or indicates ties
export function runOneIteration(
  tableau: Tableau,
  method: SolverMethod,
  pivotColOverride?: number,
  pivotRowOverride?: number,
):
  | { type: "step"; step: IterationStep }
  | { type: "tied-col"; ties: number[]; tableau: Tableau }
  | { type: "tied-row"; ties: number[]; tableau: Tableau; pivotCol: number }
  | { type: "optimal" }
  | { type: "unbounded" }
  | { type: "infeasible" } {
  if (isOptimal(tableau, method)) return { type: "optimal" };

  let pivotCol: number;
  let pivotRow: number;

  if (method === "simplex") {
    if (pivotColOverride !== undefined) {
      pivotCol = pivotColOverride;
    } else {
      const tiedCols = findSimplexPivotCol(tableau);
      if (tiedCols.length === 0) return { type: "optimal" };
      if (tiedCols.length > 1 && pivotColOverride === undefined) {
        return { type: "tied-col", ties: tiedCols, tableau };
      }
      pivotCol = tiedCols[0];
    }

    if (pivotRowOverride !== undefined) {
      pivotRow = pivotRowOverride;
    } else {
      const tiedRows = findSimplexPivotRow(tableau, pivotCol);
      if (tiedRows.length === 0) return { type: "unbounded" };
      if (tiedRows.length > 1) {
        return { type: "tied-row", ties: tiedRows, tableau, pivotCol };
      }
      pivotRow = tiedRows[0];
    }
  } else {
    // dual simplex
    if (pivotRowOverride !== undefined) {
      pivotRow = pivotRowOverride;
    } else {
      const tiedRows = findDualPivotRow(tableau);
      if (tiedRows.length === 0) return { type: "optimal" };
      if (tiedRows.length > 1 && pivotRowOverride === undefined) {
        return { type: "tied-row", ties: tiedRows, tableau, pivotCol: -1 };
      }
      pivotRow = tiedRows[0];
    }

    if (pivotColOverride !== undefined) {
      pivotCol = pivotColOverride;
    } else {
      const tiedCols = findDualPivotCol(tableau, pivotRow);
      if (tiedCols.length === 0) return { type: "infeasible" };
      if (tiedCols.length > 1) {
        return { type: "tied-col", ties: tiedCols, tableau };
      }
      pivotCol = tiedCols[0];
    }
  }

  const { newTableau, rowCalcs } = performRowOps(tableau, pivotRow, pivotCol);

  const step: IterationStep = {
    tableau: cloneTableau(tableau),
    pivotCol,
    pivotRow,
    rowCalculations: rowCalcs,
    resultTableau: newTableau,
    method,
  };

  return { type: "step", step };
}
