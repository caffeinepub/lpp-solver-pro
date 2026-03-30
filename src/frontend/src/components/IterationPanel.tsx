import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DisplayMode } from "../App";
import type { IterationStep } from "../lppSolver";
import RowCalculation from "./RowCalculation";
import TableauDisplay from "./TableauDisplay";

interface Props {
  step: IterationStep;
  index: number;
  displayMode?: DisplayMode;
}

export default function IterationPanel({
  step,
  index,
  displayMode = "decimal",
}: Props) {
  const [showCalcs, setShowCalcs] = useState(false);

  const pivotVarName = step.tableau.varNames[step.pivotCol];
  const pivotRowName =
    step.tableau.varNames[step.tableau.basis[step.pivotRow - 1]];

  return (
    <div className="bg-white rounded-xl border border-border shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Iteration {index + 1}
          </h3>
          <span className="text-xs font-medium text-muted-foreground bg-white border border-border px-2 py-1 rounded-full">
            {step.method === "simplex" ? "Simplex" : "Dual Simplex"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Pivot Column:{" "}
          <strong className="text-blue-600">{pivotVarName}</strong> · Pivot Row:{" "}
          <strong className="text-green-600">{pivotRowName}</strong>
        </p>
      </div>

      {/* Tableau before ops */}
      <div className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Tableau (Before)
        </p>
        <TableauDisplay
          tableau={step.tableau}
          pivotRow={step.pivotRow}
          pivotCol={step.pivotCol}
          showHighlights={true}
          displayMode={displayMode}
        />
      </div>

      {/* Row calculations accordion */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => setShowCalcs((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary rounded-lg hover:bg-secondary/70 transition-colors mb-2"
          data-ocid="iteration.show_calcs.button"
        >
          <span className="text-sm font-medium text-foreground">
            Show Row Calculations
          </span>
          {showCalcs ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {showCalcs && (
          <div className="space-y-2">
            {step.rowCalculations.map((rc, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: row order stable
              <RowCalculation key={i} rowCalc={rc} />
            ))}
          </div>
        )}
      </div>

      {/* Resulting tableau */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Tableau (After)
        </p>
        <TableauDisplay
          tableau={step.resultTableau}
          showHighlights={false}
          displayMode={displayMode}
        />
      </div>
    </div>
  );
}
