import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { RowCalc } from "../lppSolver";

interface Props {
  rowCalc: RowCalc;
}

function fmtArr(arr: number[]): string {
  return `(${arr
    .map((v) => {
      if (Math.abs(v) < 1e-9) return "0";
      return v.toFixed(4).replace(/\.?0+$/, "");
    })
    .join(", ")})`;
}

function fmt(n: number): string {
  if (Math.abs(n) < 1e-9) return "0";
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export default function RowCalculation({ rowCalc }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-background hover:bg-secondary/50 transition-colors text-left"
      >
        <span className="font-medium text-sm text-foreground">
          {rowCalc.rowName} row
        </span>
        <div className="flex items-center gap-2">
          {rowCalc.isPivot && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Pivot Row
            </span>
          )}
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 bg-white border-t border-border space-y-2">
          {rowCalc.isPivot ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pivot Row Normalization
              </p>
              <p className="text-sm font-mono">
                New Pivot Row = {fmtArr(rowCalc.currentRow)} ÷{" "}
                {fmt(rowCalc.pivotElement ?? 1)}
              </p>
              <p className="text-sm font-mono text-primary">
                = {fmtArr(rowCalc.newRow)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Step A — Formula
                </p>
                <p className="text-sm font-mono">
                  {rowCalc.rowName} = [{fmtArr(rowCalc.currentRow)} − {"{"}(
                  {fmt(rowCalc.pivotCoeff)}) × {fmtArr(rowCalc.pivotRowValues)}
                  {"}"}]
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Step B — Multiplication
                </p>
                <p className="text-sm font-mono">
                  ({fmt(rowCalc.pivotCoeff)}) × {fmtArr(rowCalc.pivotRowValues)}{" "}
                  = {fmtArr(rowCalc.multiplied)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Step C — Final
                </p>
                <p className="text-sm font-mono">
                  {fmtArr(rowCalc.currentRow)} − {fmtArr(rowCalc.multiplied)} ={" "}
                  {fmtArr(rowCalc.newRow)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
