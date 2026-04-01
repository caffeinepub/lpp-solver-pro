import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Edit2, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { DisplayMode } from "../App";
import type { Constraint, LPProblem } from "../lppSolver";
import FractionToggle from "./FractionToggle";

export interface VarCoeff {
  sign: "+" | "-";
  value: string;
}

export interface ConstraintRow {
  id: string;
  coeffs: VarCoeff[];
  sign: "<=" | ">=" | "=";
  rhs: string;
}

export interface InputFormState {
  isMaximize: boolean;
  varIds: string[];
  activeVars: boolean[];
  objCoeffs: VarCoeff[];
  constraints: ConstraintRow[];
  activeConstraints: boolean[];
  constraintVarActive: boolean[][];
}

interface Props {
  onSolve: (problem: LPProblem) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  initialState?: InputFormState;
  hasSolved?: boolean;
  onEditQuestion?: () => void;
  onStateChange?: (state: InputFormState) => void;
  hideActions?: boolean;
}

const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
function toSub(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[Number.parseInt(d)])
    .join("");
}

let _idCounter = 10;
function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${_idCounter}`;
}

const STEPS = ["Define Problem", "Standard Form", "Solve", "Result"];

function ProgressStepper(_props: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static list
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                i === 0
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-muted-foreground border-border"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs mt-1 whitespace-nowrap font-medium ${
                i === 0 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="w-8 h-0.5 bg-border mx-1 mb-5" />
          )}
        </div>
      ))}
    </div>
  );
}

const INITIAL_VAR_IDS = ["var-1", "var-2"];
const INITIAL_CONSTRAINTS: ConstraintRow[] = [
  {
    id: "con-1",
    coeffs: [
      { sign: "+", value: "6" },
      { sign: "+", value: "4" },
    ],
    sign: "<=",
    rhs: "24",
  },
  {
    id: "con-2",
    coeffs: [
      { sign: "+", value: "1" },
      { sign: "+", value: "0" },
    ],
    sign: "<=",
    rhs: "3",
  },
];

export default function InputForm({
  onSolve,
  displayMode,
  onDisplayModeChange,
  initialState,
  hasSolved,
  onEditQuestion,
  onStateChange,
  hideActions,
}: Props) {
  const [isMaximize, setIsMaximize] = useState(
    initialState?.isMaximize ?? true,
  );
  const [varIds, setVarIds] = useState<string[]>(
    initialState?.varIds ?? INITIAL_VAR_IDS,
  );
  const [activeVars, setActiveVars] = useState<boolean[]>(
    initialState?.activeVars ?? [true, true],
  );
  const [objCoeffs, setObjCoeffs] = useState<VarCoeff[]>(
    initialState?.objCoeffs ?? [
      { sign: "+", value: "5" },
      { sign: "+", value: "4" },
    ],
  );
  const [constraints, setConstraints] = useState<ConstraintRow[]>(
    initialState?.constraints ?? INITIAL_CONSTRAINTS,
  );
  const [activeConstraints, setActiveConstraints] = useState<boolean[]>(
    initialState?.activeConstraints ?? [true, true],
  );
  // constraintVarActive[ci][vi]: is variable vi active in constraint ci?
  const [constraintVarActive, setConstraintVarActive] = useState<boolean[][]>(
    () =>
      initialState?.constraintVarActive ?? [
        [true, true],
        [true, true],
      ],
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Notify parent whenever form state changes
  useEffect(() => {
    onStateChange?.({
      isMaximize,
      varIds,
      activeVars,
      objCoeffs,
      constraints,
      activeConstraints,
      constraintVarActive,
    });
  }, [
    isMaximize,
    varIds,
    activeVars,
    objCoeffs,
    constraints,
    activeConstraints,
    constraintVarActive,
    onStateChange,
  ]);

  const numVars = varIds.length;

  function toggleVar(i: number) {
    const activeCount = activeVars.filter(Boolean).length;
    if (activeVars[i] && activeCount <= 1) return;
    setActiveVars(activeVars.map((v, idx) => (idx === i ? !v : v)));
    const newErrors = { ...errors };
    delete newErrors[`obj_${i}`];
    for (let ci = 0; ci < constraints.length; ci++) {
      delete newErrors[`c_${ci}_${i}`];
    }
    setErrors(newErrors);
  }

  function toggleConstraintVar(ci: number, vi: number) {
    setConstraintVarActive((prev) =>
      prev.map((row, r) =>
        r === ci ? row.map((v, c) => (c === vi ? !v : v)) : row,
      ),
    );
  }

  function toggleConstraint(ci: number) {
    const activeCount = activeConstraints.filter(Boolean).length;
    if (activeConstraints[ci] && activeCount <= 1) return;
    setActiveConstraints(
      activeConstraints.map((v, idx) => (idx === ci ? !v : v)),
    );
  }

  function addVariable() {
    const newId = nextId("var");
    setVarIds([...varIds, newId]);
    setActiveVars([...activeVars, true]);
    setObjCoeffs([...objCoeffs, { sign: "+" as const, value: "0" }]);
    setConstraints(
      constraints.map((c) => ({
        ...c,
        coeffs: [...c.coeffs, { sign: "+" as const, value: "0" }],
      })),
    );
    setConstraintVarActive((prev) => prev.map((row) => [...row, true]));
  }

  function removeLastVariable() {
    if (numVars <= 1) return;
    const newNum = numVars - 1;
    setVarIds(varIds.slice(0, newNum));
    setActiveVars(activeVars.slice(0, newNum));
    setObjCoeffs(objCoeffs.slice(0, newNum));
    setConstraints(
      constraints.map((c) => ({ ...c, coeffs: c.coeffs.slice(0, newNum) })),
    );
    setConstraintVarActive((prev) => prev.map((row) => row.slice(0, newNum)));
  }

  function addConstraint() {
    const newId = nextId("con");
    setActiveConstraints([...activeConstraints, true]);
    setConstraints([
      ...constraints,
      {
        id: newId,
        coeffs: Array.from({ length: numVars }, () => ({
          sign: "+" as const,
          value: "0",
        })),
        sign: "<=",
        rhs: "0",
      },
    ]);
    setConstraintVarActive((prev) => [...prev, Array(numVars).fill(true)]);
  }

  function removeConstraint(idx: number) {
    if (constraints.length <= 1) return;
    setActiveConstraints(activeConstraints.filter((_, i) => i !== idx));
    setConstraints(constraints.filter((_, i) => i !== idx));
    setConstraintVarActive((prev) => prev.filter((_, i) => i !== idx));
  }

  function setObjCoeff(i: number, field: "sign" | "value", val: string) {
    const updated = [...objCoeffs];
    updated[i] = { ...updated[i], [field]: val };
    setObjCoeffs(updated);
  }

  function setConstraintCoeff(
    ci: number,
    vi: number,
    field: "sign" | "value",
    val: string,
  ) {
    const updated = constraints.map((c, i) => {
      if (i !== ci) return c;
      const newCoeffs = c.coeffs.map((vc, j) => {
        if (j !== vi) return vc;
        return { ...vc, [field]: val };
      });
      return { ...c, coeffs: newCoeffs };
    });
    setConstraints(updated);
  }

  function setConstraintSign(ci: number, sign: "<=" | ">=" | "=") {
    setConstraints(constraints.map((c, i) => (i === ci ? { ...c, sign } : c)));
  }

  function setConstraintRhs(ci: number, rhs: string) {
    setConstraints(constraints.map((c, i) => (i === ci ? { ...c, rhs } : c)));
  }

  function validate(): boolean {
    const newErrors: { [key: string]: string } = {};

    for (let i = 0; i < numVars; i++) {
      if (!activeVars[i]) continue;
      const v = objCoeffs[i]?.value;
      if (
        v === undefined ||
        v.trim() === "" ||
        Number.isNaN(Number.parseFloat(v))
      ) {
        newErrors[`obj_${i}`] = "Required";
      }
    }

    for (let ci = 0; ci < constraints.length; ci++) {
      if (!activeConstraints[ci]) continue;
      for (let vi = 0; vi < numVars; vi++) {
        if (!constraintVarActive[ci]?.[vi]) continue;
        const v = constraints[ci].coeffs[vi]?.value;
        if (
          v === undefined ||
          v.trim() === "" ||
          Number.isNaN(Number.parseFloat(v))
        ) {
          newErrors[`c_${ci}_${vi}`] = "Required";
        }
      }
      if (
        constraints[ci].rhs.trim() === "" ||
        Number.isNaN(Number.parseFloat(constraints[ci].rhs))
      ) {
        newErrors[`rhs_${ci}`] = "Required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSolve() {
    if (!validate()) return;

    const activeIndices = activeVars
      .map((a, i) => (a ? i : -1))
      .filter((i) => i !== -1);
    const activeNumVars = activeIndices.length;

    const objective = activeIndices.map((i) => {
      const vc = objCoeffs[i];
      const v = Number.parseFloat(vc.value);
      return vc.sign === "-" ? -v : v;
    });

    const constraintList: Constraint[] = constraints
      .filter((_, ci) => activeConstraints[ci])
      .map((c, _newCi) => {
        const origCi = constraints.indexOf(c);
        return {
          coeffs: activeIndices.map((origVi) => {
            if (!constraintVarActive[origCi]?.[origVi]) return 0;
            const vc = c.coeffs[origVi];
            const v = Number.parseFloat(vc.value);
            return vc.sign === "-" ? -v : v;
          }),
          sign: c.sign,
          rhs: Number.parseFloat(c.rhs),
        };
      });

    onSolve({
      isMaximize,
      numVars: activeNumVars,
      objective,
      constraints: constraintList,
    });
  }

  const activeCount = activeVars.filter(Boolean).length;
  const activeNames = varIds
    .map((_, i) => (activeVars[i] ? `x${i + 1}` : null))
    .filter(Boolean)
    .join(", ");
  const activeConstraintCount = activeConstraints.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-xs sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            LPP Solver Pro
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Step-by-Step Linear Programming Solver
          </p>
          <p
            className="font-parisienne text-2xl font-bold mt-1"
            style={{ color: "#1E88E5", letterSpacing: "0.03em" }}
          >
            Ravi SKT
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <ProgressStepper currentStep={0} />

        {/* Variable Manager */}
        <section className="bg-white rounded-xl shadow-card border border-border p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Variables
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle variables on/off. Active: {activeCount} of {numVars}
                {activeNames ? ` · ${activeNames}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariable}
                className="gap-1"
                data-ocid="variables.add_button"
              >
                <Plus size={14} /> Add
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={removeLastVariable}
                disabled={numVars <= 1}
                className="gap-1 text-destructive hover:text-destructive"
                data-ocid="variables.remove_button"
              >
                <Trash2 size={14} /> Remove Last
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {varIds.map((vid, i) => {
              const isActive = activeVars[i];
              return (
                <button
                  key={vid}
                  type="button"
                  onClick={() => toggleVar(i)}
                  disabled={isActive && activeCount <= 1}
                  title={
                    isActive ? `Deactivate x${i + 1}` : `Activate x${i + 1}`
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    isActive
                      ? "bg-primary text-white border-primary hover:bg-primary/80"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary hover:text-primary"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  data-ocid={`variables.toggle.${i + 1}`}
                >
                  {isActive ? <Eye size={13} /> : <EyeOff size={13} />}x
                  {toSub(i + 1)}
                </button>
              );
            })}
          </div>

          {activeCount < numVars && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠ Inactive variables will be excluded from the objective function.
            </p>
          )}
        </section>

        {/* Objective Function */}
        <section className="bg-white rounded-xl shadow-card border border-border p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground text-lg">
              Objective Function
            </h2>
            <div className="flex items-center gap-2">
              <FractionToggle
                mode={displayMode}
                onChange={onDisplayModeChange}
              />
              <div
                className="inline-flex rounded-lg border border-border overflow-hidden"
                data-ocid="objective.toggle"
              >
                <button
                  type="button"
                  onClick={() => setIsMaximize(true)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    isMaximize
                      ? "bg-primary text-white"
                      : "bg-white text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Max
                </button>
                <button
                  type="button"
                  onClick={() => setIsMaximize(false)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    !isMaximize
                      ? "bg-primary text-white"
                      : "bg-white text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Min
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground self-center">
              Z =
            </span>
            {varIds.map((vid, i) => {
              if (!activeVars[i]) return null;
              const objKey = `obj-${vid}`;
              return (
                <div key={objKey} className="flex items-center gap-1">
                  <select
                    value={objCoeffs[i]?.sign ?? "+"}
                    onChange={(e) => setObjCoeff(i, "sign", e.target.value)}
                    className="border border-border rounded-md px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="+">+</option>
                    <option value="-">−</option>
                  </select>
                  <div className="relative">
                    <Input
                      type="number"
                      value={objCoeffs[i]?.value ?? ""}
                      onChange={(e) => setObjCoeff(i, "value", e.target.value)}
                      className={`w-16 text-center ${
                        errors[`obj_${i}`] ? "border-destructive" : ""
                      }`}
                      placeholder="0"
                      data-ocid={`obj.input.${i + 1}`}
                    />
                    {errors[`obj_${i}`] && (
                      <span
                        className="absolute -bottom-4 left-0 text-xs text-destructive"
                        data-ocid="obj.error_state"
                      >
                        {errors[`obj_${i}`]}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    x{toSub(i + 1)}
                  </span>
                </div>
              );
            })}
          </div>

          {activeCount === 0 && (
            <p className="text-xs text-destructive mt-1">
              Please activate at least one variable.
            </p>
          )}
        </section>

        {/* Constraints */}
        <section className="bg-white rounded-xl shadow-card border border-border p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground text-lg">
                Constraints
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle constraints on/off. Active: {activeConstraintCount} of{" "}
                {constraints.length}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {constraints.map((c, ci) => {
              const cva = constraintVarActive[ci] ?? [];
              const cActiveCount = cva.filter(Boolean).length;
              const cActiveNames = varIds
                .map((_, vi) => (cva[vi] ? `x${vi + 1}` : null))
                .filter(Boolean)
                .join(", ");
              return (
                <div
                  key={c.id}
                  className="border border-border rounded-lg p-3 bg-background"
                  data-ocid={`constraints.item.${ci + 1}`}
                >
                  {/* Constraint header: on/off toggle + per-constraint variable pills */}
                  <div className="flex items-start gap-2 flex-wrap mb-3">
                    <button
                      type="button"
                      onClick={() => toggleConstraint(ci)}
                      disabled={
                        activeConstraints[ci] && activeConstraintCount <= 1
                      }
                      title={
                        activeConstraints[ci]
                          ? `Deactivate C${ci + 1}`
                          : `Activate C${ci + 1}`
                      }
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all self-center ${
                        activeConstraints[ci]
                          ? "bg-primary text-white border-primary hover:bg-primary/80"
                          : "bg-secondary text-muted-foreground border-border hover:border-primary hover:text-primary"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {activeConstraints[ci] ? (
                        <Eye size={11} />
                      ) : (
                        <EyeOff size={11} />
                      )}
                      C{ci + 1}
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                      <span className="text-xs text-muted-foreground">
                        Active: {cActiveCount} of {numVars}
                        {cActiveNames ? ` · ${cActiveNames}` : ""}
                      </span>
                      {varIds.map((vid, vi) => {
                        const isVarActive = cva[vi] ?? true;
                        return (
                          <button
                            key={`${c.id}-toggle-${vid}`}
                            type="button"
                            onClick={() => toggleConstraintVar(ci, vi)}
                            title={
                              isVarActive
                                ? `Remove x${vi + 1} from C${ci + 1}`
                                : `Add x${vi + 1} to C${ci + 1}`
                            }
                            className={`px-2 py-1 rounded-full text-xs font-medium border transition-all ${
                              isVarActive
                                ? "bg-primary text-white border-primary hover:bg-primary/80"
                                : "bg-secondary text-muted-foreground border-border hover:border-primary hover:text-primary"
                            }`}
                            data-ocid={`constraints.toggle.${ci + 1}`}
                          >
                            x{vi + 1}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeConstraint(ci)}
                      className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                      title="Remove constraint"
                      data-ocid={`constraints.delete_button.${ci + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Constraint input fields */}
                  <div
                    className={`flex flex-wrap gap-2 items-start ${
                      !activeConstraints[ci]
                        ? "opacity-40 pointer-events-none"
                        : ""
                    }`}
                  >
                    {varIds.map((vid, vi) => {
                      if (!cva[vi]) return null;
                      const coeffKey = `${c.id}-${vid}`;
                      return (
                        <div key={coeffKey} className="flex items-center gap-1">
                          <select
                            value={c.coeffs[vi]?.sign ?? "+"}
                            onChange={(e) =>
                              setConstraintCoeff(ci, vi, "sign", e.target.value)
                            }
                            className="border border-border rounded-md px-1.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                          >
                            <option value="+">+</option>
                            <option value="-">−</option>
                          </select>
                          <div className="relative">
                            <Input
                              type="number"
                              value={c.coeffs[vi]?.value ?? ""}
                              onChange={(e) =>
                                setConstraintCoeff(
                                  ci,
                                  vi,
                                  "value",
                                  e.target.value,
                                )
                              }
                              className={`w-14 text-center ${
                                errors[`c_${ci}_${vi}`]
                                  ? "border-destructive"
                                  : ""
                              }`}
                              placeholder="0"
                              data-ocid={`constraints.input.${ci + 1}`}
                            />
                            {errors[`c_${ci}_${vi}`] && (
                              <span className="absolute -bottom-4 left-0 text-xs text-destructive">
                                {errors[`c_${ci}_${vi}`]}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            x{toSub(vi + 1)}
                          </span>
                        </div>
                      );
                    })}

                    <select
                      value={c.sign}
                      onChange={(e) =>
                        setConstraintSign(
                          ci,
                          e.target.value as "<=" | ">=" | "=",
                        )
                      }
                      className="border border-border rounded-md px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      data-ocid={`constraints.select.${ci + 1}`}
                    >
                      <option value="<=">≤</option>
                      <option value=">=">≥</option>
                      <option value="=">=</option>
                    </select>

                    <div className="relative">
                      <Input
                        type="number"
                        value={c.rhs}
                        onChange={(e) => setConstraintRhs(ci, e.target.value)}
                        className={`w-16 text-center ${
                          errors[`rhs_${ci}`] ? "border-destructive" : ""
                        }`}
                        placeholder="0"
                        data-ocid={`constraints.rhs.input.${ci + 1}`}
                      />
                      {errors[`rhs_${ci}`] && (
                        <span className="absolute -bottom-4 left-0 text-xs text-destructive">
                          {errors[`rhs_${ci}`]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addConstraint}
            className="mt-4 gap-1"
            data-ocid="constraints.add_button"
          >
            <Plus size={14} /> Add Constraint
          </Button>
        </section>

        {/* Solve / Edit Buttons */}
        {!hideActions && (
          <>
            <div className="flex gap-3">
              <Button
                type="button"
                className="flex-1 h-12 text-base font-semibold bg-primary text-white hover:bg-primary/90 shadow-card"
                onClick={handleSolve}
                data-ocid="solve.primary_button"
              >
                Solve Problem
                <ChevronDown className="ml-2" size={18} />
              </Button>
              {hasSolved && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-5 text-base font-semibold gap-2 border-primary text-primary hover:bg-primary/5"
                  onClick={onEditQuestion}
                  data-ocid="edit.open_modal_button"
                >
                  <Edit2 size={16} />
                  Edit
                </Button>
              )}
            </div>

            {Object.keys(errors).length > 0 && (
              <p
                className="text-destructive text-sm text-center mt-3"
                data-ocid="solve.error_state"
              >
                Please fix the highlighted errors above.
              </p>
            )}
          </>
        )}
      </main>

      {/* Footer */}
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
