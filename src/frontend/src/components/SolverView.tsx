import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import { Download, Info, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DisplayMode, HistoryEntry } from "../App";
import { useActor } from "../hooks/useActor";
import {
  type IterationStep,
  type LPProblem,
  type SolverMethod,
  type Tableau,
  addGomoryCut,
  allInteger,
  buildStandardForm,
  detectMethod,
  extractSolution,
  findGomoryCutRows,
  fractionalPart,
  runOneIteration,
} from "../lppSolver";
import { formatValue } from "../utils/fractions";
import FractionToggle from "./FractionToggle";
import type { InputFormState } from "./InputForm";
import IterationPanel from "./IterationPanel";
import TableauDisplay from "./TableauDisplay";

const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
function toSub(n: number): string {
  return String(n)
    .split("")
    .map((d) => subscripts[Number.parseInt(d)])
    .join("");
}

type SolverPhase =
  | "running"
  | "tie-col"
  | "tie-row"
  | "optimal"
  | "cutting-plane-prompt"
  | "gomory-continue-prompt"
  | "gomory-tie-row"
  | "done"
  | "unbounded"
  | "infeasible";

export interface GomoryIterationRecord {
  cutNumber: number;
  tableauBefore: Tableau;
  iterationsBefore: IterationStep[];
  methodBefore: SolverMethod;
  gomoryCutCountBefore: number;
  tiedRows: number[] | null;
  chosenRow: number | null;
}

export interface GomoryPreCutState {
  tableau: Tableau;
  iterations: IterationStep[];
  method: SolverMethod;
  solution: { [key: string]: number };
  objectiveValue: number;
}

export interface SolverState {
  phase: SolverPhase;
  currentTableau: Tableau;
  method: SolverMethod;
  iterations: IterationStep[];
  tiedCols?: number[];
  tiedRows?: number[];
  tiedGomoryRows?: number[];
  selectedGomoryRow?: number;
  pendingPivotCol?: number;
  solution?: { [key: string]: number };
  objectiveValue?: number;
  gomoryCutCount: number;
  gomoryHistory: GomoryIterationRecord[];
  gomoryPreCutState?: GomoryPreCutState;
}

const STEPS = ["Define Problem", "Standard Form", "Solve", "Result"];

function ProgressStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                i < currentStep
                  ? "bg-primary border-primary text-white"
                  : i === currentStep
                    ? "bg-primary border-primary text-white"
                    : "bg-white text-muted-foreground border-border"
              }`}
            >
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs mt-1 whitespace-nowrap font-medium ${
                i <= currentStep ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 mb-5 transition-colors ${
                i < currentStep ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function getPhaseStep(phase: SolverPhase): number {
  if (
    phase === "running" ||
    phase === "tie-col" ||
    phase === "tie-row" ||
    phase === "gomory-continue-prompt" ||
    phase === "gomory-tie-row"
  )
    return 2;
  if (phase === "optimal" || phase === "cutting-plane-prompt") return 3;
  if (phase === "done") return 4;
  return 2;
}

function formatProblem(problem: LPProblem): string {
  const obj = problem.objective
    .map((c, i) => `${c >= 0 && i > 0 ? "+" : ""}${c}x${toSub(i + 1)}`)
    .join(" ");
  const lines = [
    `${problem.isMaximize ? "Maximize" : "Minimize"} Z = ${obj}`,
    "Subject to:",
    ...problem.constraints.map((c, i) => {
      const lhs = c.coeffs
        .map((v, j) => `${v >= 0 && j > 0 ? "+" : ""}${v}x${toSub(j + 1)}`)
        .join(" ");
      return `  C${i + 1}: ${lhs} ${c.sign} ${c.rhs}`;
    }),
  ];
  return lines.join("\n");
}

export default function SolverView({
  problem,
  onReset,
  displayMode,
  onDisplayModeChange,
  onSaveProblem,
  initialSolverState,
  inputFormStateForHistory,
}: {
  problem: LPProblem;
  onReset: () => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onSaveProblem?: (entry: HistoryEntry) => void;
  initialSolverState?: SolverState;
  inputFormStateForHistory?: InputFormState;
}) {
  const stdForm = buildStandardForm(problem);
  const method = detectMethod(stdForm);
  const savedRef = useRef(Boolean(initialSolverState));
  const { actor: backendActor } = useActor();

  const [state, setState] = useState<SolverState>(
    initialSolverState ?? {
      phase: "running",
      currentTableau: stdForm,
      method,
      iterations: [],
      gomoryCutCount: 0,
      gomoryHistory: [],
      gomoryPreCutState: undefined,
    },
  );

  // Reset savedRef whenever the problem changes (new solve session)
  // biome-ignore lint/correctness/useExhaustiveDependencies: problem prop change is intentional trigger
  useEffect(() => {
    // Don't reset if we're restoring a previous state (savedRef was set to true in init)
    if (!initialSolverState) {
      savedRef.current = false;
    }
  }, [problem]);

  // Save to history once when phase becomes "done"
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-shot save per problem
  useEffect(() => {
    if (
      state.phase === "done" &&
      state.solution !== undefined &&
      !savedRef.current &&
      onSaveProblem
    ) {
      savedRef.current = true;
      const methodName =
        state.gomoryCutCount > 0
          ? "Cutting-Plane (Gomory)"
          : method === "simplex"
            ? "Simplex Method"
            : "Dual Simplex Method";
      const terms = problem.objective
        .map((c, i) => `${c >= 0 && i > 0 ? "+" : ""}${c}x${toSub(i + 1)}`)
        .join(" ");
      const objectiveFunction = `${problem.isMaximize ? "Max" : "Min"} Z = ${terms}`;
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        methodName,
        objectiveFunction,
        zValue: state.objectiveValue ?? 0,
        solutionVars: state.solution,
        gomoryCutCount: state.gomoryCutCount,
        problem,
        inputFormState: inputFormStateForHistory,
        solverState: { ...state },
      };
      onSaveProblem(entry);
      // Record solve in backend for user analytics
      const solveMethod =
        state.gomoryCutCount > 0
          ? "cutting-plane"
          : method === "simplex"
            ? "simplex"
            : "dual";
      backendActor?.recordSolve(solveMethod).catch(() => {});
    }
  }, [state.phase, state.solution]);

  // Auto-run when phase is "running"
  // biome-ignore lint/correctness/useExhaustiveDependencies: problem is stable from parent
  useEffect(() => {
    if (state.phase !== "running") return;

    const result = runOneIteration(
      state.currentTableau,
      state.method,
      undefined,
      undefined,
    );

    if (result.type === "step") {
      setState((prev) => ({
        ...prev,
        iterations: [...prev.iterations, result.step],
        currentTableau: result.step.resultTableau,
        phase: "running",
      }));
    } else if (result.type === "optimal") {
      // First time reaching optimal (no Gomory cuts yet) → show cutting-plane prompt
      if (state.gomoryCutCount === 0) {
        const { solution, objectiveValue } = extractSolution(
          state.currentTableau,
          problem.numVars,
          !problem.isMaximize,
        );
        setState((prev) => ({
          ...prev,
          phase: "cutting-plane-prompt",
          solution,
          objectiveValue,
        }));
      } else {
        // Gomory cuts already in progress — check if all RHS are integer
        if (allInteger(state.currentTableau)) {
          const { solution, objectiveValue } = extractSolution(
            state.currentTableau,
            problem.numVars,
            !problem.isMaximize,
          );
          setState((prev) => ({
            ...prev,
            phase: "done",
            solution,
            objectiveValue,
          }));
        } else {
          // Ask user whether to continue or stop
          const { solution, objectiveValue } = extractSolution(
            state.currentTableau,
            problem.numVars,
            !problem.isMaximize,
          );
          setState((prev) => ({
            ...prev,
            phase: "gomory-continue-prompt",
            solution,
            objectiveValue,
          }));
        }
      }
    } else if (result.type === "tied-col") {
      setState((prev) => ({
        ...prev,
        phase: "tie-col",
        tiedCols: result.ties,
        currentTableau: result.tableau,
      }));
    } else if (result.type === "tied-row") {
      setState((prev) => ({
        ...prev,
        phase: "tie-row",
        tiedRows: result.ties,
        currentTableau: result.tableau,
        pendingPivotCol: result.pivotCol,
      }));
    } else if (result.type === "unbounded") {
      setState((prev) => ({ ...prev, phase: "unbounded" }));
    } else if (result.type === "infeasible") {
      setState((prev) => ({ ...prev, phase: "infeasible" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentTableau, state.method]);

  function handleTieColSelect(col: number) {
    const result = runOneIteration(
      state.currentTableau,
      state.method,
      col,
      undefined,
    );
    if (result.type === "step") {
      setState((prev) => ({
        ...prev,
        phase: "running",
        iterations: [...prev.iterations, result.step],
        currentTableau: result.step.resultTableau,
        tiedCols: undefined,
      }));
    } else if (result.type === "tied-row") {
      setState((prev) => ({
        ...prev,
        phase: "tie-row",
        tiedRows: result.ties,
        pendingPivotCol: col,
        tiedCols: undefined,
      }));
    }
  }

  function handleTieRowSelect(row: number) {
    const pivotCol = state.pendingPivotCol;
    if (pivotCol === undefined) return;
    const result = runOneIteration(
      state.currentTableau,
      state.method,
      pivotCol === -1 ? undefined : pivotCol,
      row,
    );
    if (result.type === "step") {
      setState((prev) => ({
        ...prev,
        phase: "running",
        iterations: [...prev.iterations, result.step],
        currentTableau: result.step.resultTableau,
        tiedRows: undefined,
        pendingPivotCol: undefined,
      }));
    }
  }

  function applyGomoryFromRows(
    rows: number[],
    preState?: GomoryPreCutState,
    record?: GomoryIterationRecord,
  ) {
    if (rows.length === 0) {
      const { solution, objectiveValue } = extractSolution(
        state.currentTableau,
        problem.numVars,
        !problem.isMaximize,
      );
      setState((prev) => ({
        ...prev,
        phase: "done",
        solution,
        objectiveValue,
        gomoryPreCutState: preState ?? prev.gomoryPreCutState,
      }));
      return;
    }
    if (rows.length > 1) {
      // Tie — show tie prompt; record will be created by handleGomoryRowConfirm
      setState((prev) => ({
        ...prev,
        phase: "gomory-tie-row",
        tiedGomoryRows: rows,
        selectedGomoryRow: undefined,
        gomoryPreCutState: preState ?? prev.gomoryPreCutState,
      }));
      return;
    }
    // Single row — apply cut directly; record comes from caller
    const cut = addGomoryCut(state.currentTableau, problem.numVars, rows[0]);
    if (!cut) {
      const { solution, objectiveValue } = extractSolution(
        state.currentTableau,
        problem.numVars,
        !problem.isMaximize,
      );
      setState((prev) => ({
        ...prev,
        phase: "done",
        solution,
        objectiveValue,
        gomoryPreCutState: preState ?? prev.gomoryPreCutState,
        gomoryHistory: record
          ? [...prev.gomoryHistory, record]
          : prev.gomoryHistory,
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      phase: "running",
      currentTableau: cut,
      method: "dual-simplex",
      gomoryCutCount: prev.gomoryCutCount + 1,
      tiedGomoryRows: undefined,
      selectedGomoryRow: undefined,
      gomoryPreCutState: preState ?? prev.gomoryPreCutState,
      gomoryHistory: record
        ? [...prev.gomoryHistory, record]
        : prev.gomoryHistory,
    }));
  }

  function handleApplyGomory() {
    const rows = findGomoryCutRows(state.currentTableau);
    const { solution, objectiveValue } = extractSolution(
      state.currentTableau,
      problem.numVars,
      !problem.isMaximize,
    );
    const preState: GomoryPreCutState = {
      tableau: state.currentTableau,
      iterations: state.iterations,
      method: state.method,
      solution,
      objectiveValue,
    };
    applyGomoryFromRows(rows, preState);
  }

  function handleNoGomory() {
    const { solution, objectiveValue } = extractSolution(
      state.currentTableau,
      problem.numVars,
      !problem.isMaximize,
    );
    setState((prev) => ({ ...prev, phase: "done", solution, objectiveValue }));
  }

  function handleContinueGomory() {
    const rows = findGomoryCutRows(state.currentTableau);
    const record: GomoryIterationRecord = {
      cutNumber: state.gomoryCutCount + 1,
      tableauBefore: state.currentTableau,
      iterationsBefore: state.iterations,
      methodBefore: state.method,
      gomoryCutCountBefore: state.gomoryCutCount,
      tiedRows: null,
      chosenRow: null,
    };
    // Pass record only for single-row case; tie case handled by handleGomoryRowConfirm
    applyGomoryFromRows(
      rows,
      undefined,
      rows.length === 1 ? record : undefined,
    );
  }

  function handleStopGomory() {
    const { solution, objectiveValue } = extractSolution(
      state.currentTableau,
      problem.numVars,
      !problem.isMaximize,
    );
    setState((prev) => ({ ...prev, phase: "done", solution, objectiveValue }));
  }

  // Select a row (without applying yet) — shows confirm/change UI
  function handleGomoryRowSelect(row: number) {
    setState((prev) => ({ ...prev, selectedGomoryRow: row }));
  }

  // Confirm the selected row and apply the Gomory cut
  function handleGomoryRowConfirm() {
    const row = state.selectedGomoryRow;
    if (row === undefined) return;

    const record: GomoryIterationRecord = {
      cutNumber: state.gomoryCutCount + 1,
      tableauBefore: state.currentTableau,
      iterationsBefore: state.iterations,
      methodBefore: state.method,
      gomoryCutCountBefore: state.gomoryCutCount,
      tiedRows: state.tiedGomoryRows ?? null,
      chosenRow: row,
    };

    const cut = addGomoryCut(state.currentTableau, problem.numVars, row);
    if (!cut) {
      const { solution, objectiveValue } = extractSolution(
        state.currentTableau,
        problem.numVars,
        !problem.isMaximize,
      );
      setState((prev) => ({
        ...prev,
        phase: "done",
        solution,
        objectiveValue,
        selectedGomoryRow: undefined,
        gomoryHistory: [...prev.gomoryHistory, record],
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      phase: "running",
      currentTableau: cut,
      method: "dual-simplex",
      gomoryCutCount: prev.gomoryCutCount + 1,
      tiedGomoryRows: undefined,
      selectedGomoryRow: undefined,
      gomoryHistory: [...prev.gomoryHistory, record],
    }));
  }

  // Clear selection so user can re-pick
  function handleGomoryRowChange() {
    setState((prev) => ({ ...prev, selectedGomoryRow: undefined }));
  }

  // Restart the entire Cutting-Plane process from the beginning
  function handleRestartCuttingPlane() {
    if (!state.gomoryPreCutState) return;
    const pre = state.gomoryPreCutState;
    setState((prev) => ({
      ...prev,
      phase: "cutting-plane-prompt",
      currentTableau: pre.tableau,
      iterations: pre.iterations,
      method: pre.method,
      solution: pre.solution,
      objectiveValue: pre.objectiveValue,
      gomoryCutCount: 0,
      gomoryHistory: [],
      tiedGomoryRows: undefined,
      selectedGomoryRow: undefined,
      gomoryPreCutState: pre, // keep so user can restart again
    }));
  }

  // Re-run from a specific Gomory iteration checkpoint
  function handleRedoFromIteration(index: number) {
    const record = state.gomoryHistory[index];
    if (!record) return;
    const { solution, objectiveValue } = extractSolution(
      record.tableauBefore,
      problem.numVars,
      !problem.isMaximize,
    );
    setState((prev) => ({
      ...prev,
      phase:
        record.tiedRows && record.tiedRows.length > 1
          ? "gomory-tie-row"
          : "gomory-continue-prompt",
      currentTableau: record.tableauBefore,
      iterations: record.iterationsBefore,
      method: record.methodBefore,
      gomoryCutCount: record.gomoryCutCountBefore,
      tiedGomoryRows: record.tiedRows ?? undefined,
      selectedGomoryRow: undefined,
      gomoryHistory: prev.gomoryHistory.slice(0, index),
      solution,
      objectiveValue,
    }));
  }

  function fmtVal(n: number): string {
    return formatValue(n, displayMode);
  }

  // ─── PDF helpers ──────────────────────────────────────────────────────────────────

  function addTableauToPDF(
    tableau: Tableau,
    doc: jsPDF,
    yStart: number,
    pageW: number,
    _pageH: number,
    fmt: (n: number) => string,
    checkPB: (y: number, needed?: number) => number,
    _watermark: () => void,
  ): number {
    const colNames = ["Basis", ...tableau.varNames];
    const numCols = colNames.length;
    const availW = pageW - 28;
    const colW = Math.min(20, availW / numCols);
    const rowH = 6;
    const fontSize = numCols > 10 ? 5 : 6;

    let y = checkPB(yStart, rowH + 4);

    // Header row — purple background, white text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setFillColor(70, 40, 130);
    doc.rect(14, y - 4, availW, rowH, "F");
    doc.setTextColor(255, 255, 255);
    for (let c = 0; c < numCols; c++) {
      const label = colNames[c];
      doc.text(
        label.length > 5 ? label.slice(0, 5) : label,
        14 + c * colW + 1,
        y,
      );
    }
    y += rowH - 1;

    const basisNames = [
      "Z",
      ...tableau.basis.map((b: number) => tableau.varNames[b]),
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);

    for (let r = 0; r < tableau.matrix.length; r++) {
      y = checkPB(y, rowH);
      if (r === 0) {
        // Z row — yellow background
        doc.setFillColor(255, 230, 100);
        doc.rect(14, y - 4, availW, rowH, "F");
        doc.setTextColor(60, 40, 0);
      } else if (r % 2 === 1) {
        // Odd constraint rows — light lavender
        doc.setFillColor(240, 235, 255);
        doc.rect(14, y - 4, availW, rowH, "F");
        doc.setTextColor(30, 30, 30);
      } else {
        // Even constraint rows — white
        doc.setTextColor(30, 30, 30);
      }
      doc.text(basisNames[r] ?? "", 14, y);
      for (let c = 0; c < tableau.matrix[r].length; c++) {
        const val = fmt(tableau.matrix[r][c]);
        doc.text(val, 14 + (c + 1) * colW + 1, y);
      }
      y += rowH - 1;
    }

    return y + 3;
  }

  function handleDownloadPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ── Watermark: large, dark, diagonal ──────────────────────────────────────
    function addWatermark() {
      doc.saveGraphicsState();
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(100);
      doc.setFont("helvetica", "bold");
      doc.text("Ravi SKT", pageW / 2, pageH / 2, {
        align: "center",
        angle: 45,
        renderingMode: "fill",
      });
      doc.restoreGraphicsState();
    }

    function checkPageBreak(y: number, needed = 10): number {
      if (y + needed > pageH - 15) {
        doc.addPage();
        addWatermark();
        return 20;
      }
      return y;
    }

    // Colored section header banner
    function sectionTitle(
      title: string,
      yPos: number,
      rgb: [number, number, number] = [30, 60, 130],
    ): number {
      const cy = checkPageBreak(yPos, 16);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(0, cy - 5.5, pageW, 8.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 14, cy);
      return cy + 8;
    }

    function bodyText(text: string, yPos: number, indent = 14): number {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(text, pageW - indent - 14);
      let cy = yPos;
      for (const line of lines) {
        cy = checkPageBreak(cy, 6);
        doc.text(line, indent, cy);
        cy += 5;
      }
      return cy;
    }

    function addTableau(tableau: Tableau, yPos: number): number {
      return addTableauToPDF(
        tableau,
        doc,
        yPos,
        pageW,
        pageH,
        fmtVal,
        checkPageBreak,
        addWatermark,
      );
    }

    // ── Page 1 ────────────────────────────────────────────────────────────────
    addWatermark();

    // Title block — deep blue banner
    doc.setFillColor(30, 60, 130);
    doc.rect(0, 0, pageW, 50, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("LPP Solver Pro", pageW / 2, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(200, 215, 255);
    doc.text("Solution Report", pageW / 2, 30, { align: "center" });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(180, 200, 255);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 39, {
      align: "center",
    });

    // Ravi SKT subtitle in the banner
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(150, 180, 255);
    doc.text("Ravi SKT", pageW / 2, 46, { align: "center" });

    let y = 60;

    // Original Problem — blue
    y = sectionTitle("ORIGINAL PROBLEM", y, [30, 60, 130]);
    y = bodyText(formatProblem(problem), y);
    y += 4;

    // Method — blue
    y = sectionTitle("METHOD", y, [30, 60, 130]);
    const methodName =
      method === "simplex" ? "Simplex Method" : "Dual Simplex Method";
    y = bodyText(methodName, y);
    if (state.gomoryCutCount > 0) {
      y = bodyText(`Gomory Cuts Applied: ${state.gomoryCutCount}`, y);
    }
    y += 4;

    // Initial Tableau — purple
    y = sectionTitle("INITIAL SIMPLEX TABLEAU", y, [90, 30, 130]);
    y = addTableau(stdForm, y);
    y += 4;

    // Iterations — green
    y = sectionTitle("ITERATIONS", y, [20, 110, 60]);

    for (let iter = 0; iter < state.iterations.length; iter++) {
      const step = state.iterations[iter];

      y = checkPageBreak(y, 14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 80, 40);
      doc.text(`Iteration ${iter + 1}`, 14, y);
      y += 5;

      // Entering / leaving variable info
      const enteringVar = step.tableau.varNames[step.pivotCol];
      const leavingVar =
        step.tableau.varNames[step.tableau.basis[step.pivotRow - 1]];
      y = bodyText(`Entering Variable: ${enteringVar}`, y, 18);
      y = bodyText(`Leaving Variable: ${leavingVar}`, y, 18);
      y += 2;

      // Tableau BEFORE pivot — purple label
      y = checkPageBreak(y, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(90, 30, 130);
      doc.text("Tableau (Before Pivot):", 18, y);
      y += 4;
      y = addTableau(step.tableau, y);

      // Row Operations label — green
      y = checkPageBreak(y, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(20, 110, 60);
      doc.text("Row Operations:", 18, y);
      y += 4;

      for (const rc of step.rowCalculations) {
        let calcLine = "";
        if (rc.isPivot) {
          calcLine = `${rc.rowName}: (${rc.currentRow.map((v: number) => fmtVal(v)).join(", ")}) ÷ ${fmtVal(rc.pivotElement ?? 1)} = (${rc.newRow.map((v: number) => fmtVal(v)).join(", ")})`;
        } else {
          calcLine = `${rc.rowName}: (${rc.currentRow.map((v: number) => fmtVal(v)).join(", ")}) − ${fmtVal(rc.pivotCoeff)} × (${rc.pivotRowValues.map((v: number) => fmtVal(v)).join(", ")}) = (${rc.newRow.map((v: number) => fmtVal(v)).join(", ")})`;
        }
        y = bodyText(calcLine, y, 22);
      }
      y += 2;

      // Result Tableau label — purple
      y = checkPageBreak(y, 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(90, 30, 130);
      doc.text("Result Tableau:", 18, y);
      y += 4;
      y = addTableau(step.resultTableau, y);
      y += 4;
    }

    // Final Tableau — purple
    if (state.iterations.length > 0) {
      y = sectionTitle("FINAL TABLEAU", y, [90, 30, 130]);
      y = addTableau(state.currentTableau, y);
      y += 4;
    }

    // Gomory cuts summary — orange
    if (state.gomoryCutCount > 0) {
      y = sectionTitle("GOMORY CUTS APPLIED", y, [180, 80, 0]);
      y = bodyText(`Total Gomory cuts applied: ${state.gomoryCutCount}`, y);
      y = bodyText(
        "The Cutting-Plane Method was used to find an integer optimal solution.",
        y,
      );
      y += 4;
    }

    // Optimal Solution — green
    if (state.solution) {
      y = sectionTitle("OPTIMAL SOLUTION", y, [20, 110, 60]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(20, 110, 60);
      y = checkPageBreak(y, 8);
      doc.text(`Z = ${fmtVal(state.objectiveValue ?? 0)}`, 14, y);
      y += 7;
      for (const [k, v] of Object.entries(state.solution)) {
        y = bodyText(`${k} = ${fmtVal(v as number)}`, y);
      }
    }

    doc.save("lpp-solution.pdf");
  }

  const phaseStep = getPhaseStep(state.phase);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-xs sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              LPP Solver Pro
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Step-by-Step Solution
            </p>
            <p
              className="font-parisienne text-2xl font-bold mt-1"
              style={{ color: "#1E88E5", letterSpacing: "0.03em" }}
            >
              Ravi SKT
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FractionToggle mode={displayMode} onChange={onDisplayModeChange} />
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="gap-1"
              data-ocid="solver.reset.button"
            >
              <RefreshCw size={14} /> New Problem
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <ProgressStepper currentStep={phaseStep >= 4 ? 3 : phaseStep - 1} />

        {/* Problem Statement */}
        <section className="bg-white rounded-xl border border-border shadow-xs p-5 mb-5">
          <h2 className="font-semibold text-foreground mb-3">
            Problem Statement
          </h2>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono bg-background rounded-lg p-3 border border-border">
            {formatProblem(problem)}
          </pre>
        </section>

        {/* Method banner */}
        <div
          className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5"
          data-ocid="solver.method.panel"
        >
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 font-medium">
            This problem is solved using:{" "}
            <strong>
              {state.method === "simplex"
                ? "Simplex Method"
                : "Dual Simplex Method"}
            </strong>
          </p>
        </div>

        {/* Standard Form Tableau */}
        <section className="bg-white rounded-xl border border-border shadow-xs p-5 mb-5">
          <h2 className="font-semibold text-foreground mb-3">
            Initial Simplex Tableau (Standard Form)
          </h2>
          <TableauDisplay
            tableau={stdForm}
            showHighlights={false}
            displayMode={displayMode}
          />
        </section>

        {/* Iterations */}
        {state.iterations.length > 0 && (
          <section className="space-y-4 mb-5">
            <h2 className="font-semibold text-foreground text-lg">
              Iterations
            </h2>
            {state.iterations.map((step) => (
              <IterationPanel
                key={`iter-${step.tableau.iteration}`}
                step={step}
                index={step.tableau.iteration}
                displayMode={displayMode}
              />
            ))}
          </section>
        )}

        {/* Tie-breaking UI — pivot column */}
        {state.phase === "tie-col" && state.tiedCols && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5"
            data-ocid="solver.tie_col.panel"
          >
            <h3 className="font-semibold text-amber-800 mb-3">
              Multiple pivot column options found. Please select one:
            </h3>
            <div className="flex flex-wrap gap-2">
              {state.tiedCols.map((col) => (
                <Button
                  key={col}
                  onClick={() => handleTieColSelect(col)}
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  data-ocid="solver.tie_col.button"
                >
                  {state.currentTableau.varNames[col]}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Tie-breaking UI — pivot row */}
        {state.phase === "tie-row" && state.tiedRows && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5"
            data-ocid="solver.tie_row.panel"
          >
            <h3 className="font-semibold text-amber-800 mb-3">
              Multiple pivot row options found. Please select one:
            </h3>
            <div className="flex flex-wrap gap-2">
              {state.tiedRows.map((row) => (
                <Button
                  key={row}
                  onClick={() => handleTieRowSelect(row)}
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  data-ocid="solver.tie_row.button"
                >
                  Row {row}:{" "}
                  {
                    state.currentTableau.varNames[
                      state.currentTableau.basis[row - 1]
                    ]
                  }
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Status messages */}
        {state.phase === "unbounded" && (
          <div
            className="bg-red-50 border border-red-200 rounded-xl p-5 mb-5"
            data-ocid="solver.unbounded.error_state"
          >
            <h3 className="font-semibold text-red-700">Problem is Unbounded</h3>
            <p className="text-sm text-red-600 mt-1">
              The objective function can be increased/decreased indefinitely.
              The problem has no finite optimal solution.
            </p>
          </div>
        )}

        {state.phase === "infeasible" && (
          <div
            className="bg-red-50 border border-red-200 rounded-xl p-5 mb-5"
            data-ocid="solver.infeasible.error_state"
          >
            <h3 className="font-semibold text-red-700">
              Problem is Infeasible
            </h3>
            <p className="text-sm text-red-600 mt-1">
              No feasible solution exists satisfying all constraints.
            </p>
          </div>
        )}

        {/* Cutting plane prompt — only shown on FIRST optimal (gomoryCutCount === 0) */}
        {state.phase === "cutting-plane-prompt" && (
          <div
            className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5"
            data-ocid="solver.optimal.panel"
          >
            <h3 className="font-semibold text-green-800 mb-2">
              ✓ Optimal Solution Reached!
            </h3>
            {state.solution && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-green-700 mb-1">
                  Z = {fmtVal(state.objectiveValue ?? 0)}
                </p>
                {Object.entries(state.solution)
                  .filter(([, v]) => Math.abs(v) > 1e-9 || true)
                  .slice(0, problem.numVars + 4)
                  .map(([k, v]) => (
                    <p key={k} className="text-sm text-green-700">
                      {k} = {fmtVal(v)}
                    </p>
                  ))}
              </div>
            )}
            <p className="text-sm text-green-800 font-medium mb-3">
              Do you want to apply the Cutting-Plane Method (Gomory cuts for
              Integer Programming)?
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              <Button
                onClick={handleApplyGomory}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-ocid="solver.gomory_yes.button"
              >
                YES — Apply Gomory Cuts
              </Button>
              <Button
                variant="outline"
                onClick={handleNoGomory}
                className="border-green-400 text-green-700"
                data-ocid="solver.gomory_no.button"
              >
                NO — Keep Continuous Solution
              </Button>
            </div>
            {/* Download PDF available even from the prompt stage */}
            <div className="border-t border-green-200 pt-3">
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                size="sm"
                className="gap-2 border-green-400 text-green-700"
                data-ocid="solver.download_pdf.button"
              >
                <Download size={14} /> Download PDF (current state)
              </Button>
            </div>
          </div>
        )}

        {/* Gomory continue/stop prompt — after each subsequent Gomory iteration */}
        {state.phase === "gomory-continue-prompt" && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5"
            data-ocid="solver.gomory_continue.panel"
          >
            <h3 className="font-semibold text-amber-800 mb-2">
              ✂️ Cutting-Plane Iteration {state.gomoryCutCount} Complete
            </h3>
            {state.solution && (
              <div className="mb-3">
                <p className="text-sm font-semibold text-amber-700 mb-1">
                  Current Z = {fmtVal(state.objectiveValue ?? 0)}
                </p>
                {Object.entries(state.solution)
                  .slice(0, problem.numVars + 2)
                  .map(([k, v]) => (
                    <p key={k} className="text-sm text-amber-700">
                      {k} = {fmtVal(v)}
                    </p>
                  ))}
              </div>
            )}
            <p className="text-sm text-amber-800 font-medium mb-3">
              Not all RHS values are integers yet. Do you want to continue with
              the next Gomory cut, or stop and use the current solution?
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleContinueGomory}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                data-ocid="solver.gomory_continue.button"
              >
                Continue — Apply Next Gomory Cut
              </Button>
              <Button
                variant="outline"
                onClick={handleStopGomory}
                className="border-amber-400 text-amber-700"
                data-ocid="solver.gomory_stop.button"
              >
                Stop — Use Current Solution
              </Button>
            </div>
            {/* Restart option during continue/stop prompt */}
            {state.gomoryPreCutState && state.gomoryCutCount > 0 && (
              <div className="border-t border-amber-200 mt-3 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestartCuttingPlane}
                  className="gap-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 text-xs"
                  data-ocid="solver.gomory_restart.button"
                >
                  <RotateCcw size={12} /> Restart Cutting-Plane from beginning
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Gomory tie-row prompt — when multiple rows share the max fractional part */}
        {state.phase === "gomory-tie-row" &&
          state.tiedGomoryRows &&
          (() => {
            const cols = state.currentTableau.matrix[0].length;
            const selected = state.selectedGomoryRow;
            return (
              <div
                className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5"
                data-ocid="solver.gomory_tie_row.panel"
              >
                <h3 className="font-semibold text-amber-800 mb-2">
                  🔗 Tie in Fractional Parts — Choose Pivot Row for Gomory Cut
                </h3>
                <p className="text-sm text-amber-700 mb-4">
                  Multiple rows have the same largest fractional part. Select
                  which row to generate the Gomory cut from:
                </p>

                {selected === undefined ? (
                  // Row selection buttons
                  <div className="flex flex-col gap-2">
                    {state.tiedGomoryRows.map((row) => {
                      const basisName =
                        state.currentTableau.varNames[
                          state.currentTableau.basis[row - 1]
                        ];
                      const rhsVal = state.currentTableau.matrix[row][cols - 1];
                      const frac = fractionalPart(Math.abs(rhsVal));
                      return (
                        <Button
                          key={row}
                          onClick={() => handleGomoryRowSelect(row)}
                          variant="outline"
                          className="border-amber-400 text-amber-700 hover:bg-amber-100 justify-start"
                          data-ocid="solver.gomory_tie_row.button"
                        >
                          Row {basisName}: RHS frac = {fmtVal(frac)}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  // Confirmation view with Change option
                  <div className="space-y-4">
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                      <p className="text-sm font-semibold text-amber-800 mb-1">
                        Selected row:
                      </p>
                      {(() => {
                        const basisName =
                          state.currentTableau.varNames[
                            state.currentTableau.basis[selected - 1]
                          ];
                        const rhsVal =
                          state.currentTableau.matrix[selected][cols - 1];
                        const frac = fractionalPart(Math.abs(rhsVal));
                        return (
                          <p className="text-sm text-amber-900 font-medium">
                            Row {basisName}: RHS frac = {fmtVal(frac)}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleGomoryRowConfirm}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        data-ocid="solver.gomory_confirm.button"
                      >
                        Confirm — Apply Gomory Cut
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleGomoryRowChange}
                        className="border-amber-400 text-amber-700 hover:bg-amber-100"
                        data-ocid="solver.gomory_change.button"
                      >
                        Change — Pick a Different Row
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Final solution */}
        {state.phase === "done" && state.solution && (
          <div
            className="bg-white rounded-xl border border-border shadow-card p-5 mb-5"
            data-ocid="solver.result.panel"
          >
            <h2 className="font-bold text-foreground text-lg mb-4">
              🎯 Final Optimal Solution
            </h2>
            <div className="bg-secondary rounded-lg p-4 mb-4">
              <p className="text-xl font-bold text-primary">
                Z = {fmtVal(state.objectiveValue ?? 0)}
              </p>
              {state.gomoryCutCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  ({state.gomoryCutCount} Gomory cut
                  {state.gomoryCutCount > 1 ? "s" : ""} applied)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(state.solution).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-background rounded-lg p-3 border border-border"
                >
                  <p className="text-xs text-muted-foreground font-medium">
                    {k}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {fmtVal(v)}
                  </p>
                </div>
              ))}
            </div>

            {/* Cutting-Plane history controls — only shown after Gomory cuts */}
            {state.gomoryCutCount > 0 && state.gomoryPreCutState && (
              <div className="border-t border-border mt-5 pt-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm">
                  Cutting-Plane Controls
                </h3>

                {/* Restart button */}
                <Button
                  variant="outline"
                  onClick={handleRestartCuttingPlane}
                  className="gap-2 w-full border-orange-400 text-orange-700 hover:bg-orange-50"
                  data-ocid="solver.gomory_restart_full.button"
                >
                  <RotateCcw size={14} /> Restart Entire Cutting-Plane Process
                </Button>

                {/* Per-iteration redo list */}
                {state.gomoryHistory.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Re-run from a specific cut:
                    </p>
                    {state.gomoryHistory.map((record, i) => (
                      <div
                        key={`hist-cut-${record.cutNumber}`}
                        className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                        data-ocid={`solver.gomory_history.item.${i + 1}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-amber-800">
                            Cut {record.cutNumber}
                            {record.tiedRows && record.tiedRows.length > 1
                              ? ` — tie (${record.tiedRows.length} rows)`
                              : " — single row"}
                          </p>
                          {record.chosenRow !== null && (
                            <p className="text-xs text-amber-600">
                              Chose: Row{" "}
                              {
                                record.tableauBefore.varNames[
                                  record.tableauBefore.basis[
                                    record.chosenRow - 1
                                  ]
                                ]
                              }
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRedoFromIteration(i)}
                          className="border-amber-400 text-amber-700 hover:bg-amber-100 text-xs"
                          data-ocid={`solver.gomory_redo.button.${i + 1}`}
                        >
                          {i === state.gomoryHistory.length - 1
                            ? "Change Last"
                            : `Re-run from Cut ${record.cutNumber}`}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-5">
              <Button
                onClick={handleDownloadPDF}
                className="gap-2 bg-primary text-white hover:bg-primary/90"
                data-ocid="solver.download_pdf.button"
              >
                <Download size={16} /> Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={onReset}
                className="gap-2"
                data-ocid="solver.solve_another.button"
              >
                <RefreshCw size={14} /> Solve Another Problem
              </Button>
            </div>
          </div>
        )}

        {/* Actions for terminal error states */}
        {(state.phase === "unbounded" || state.phase === "infeasible") && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onReset}
              className="gap-2"
              data-ocid="solver.solve_another.button"
            >
              <RefreshCw size={14} /> Solve Another Problem
            </Button>
          </div>
        )}
      </main>

      <footer className="text-center py-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
