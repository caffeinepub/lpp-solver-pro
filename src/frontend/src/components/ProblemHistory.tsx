import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Clock, Trash2 } from "lucide-react";
import { useState } from "react";
import type { HistoryEntry } from "../App";

interface Props {
  entries: HistoryEntry[];
  onClearHistory: () => void;
  onRestoreProblem: (entry: HistoryEntry) => void;
}

const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function toSub(n: number): string {
  return String(n)
    .split("")
    .map((d) => subscripts[Number.parseInt(d)])
    .join("");
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function getMethodColors(method: string): {
  bg: string;
  text: string;
  border: string;
} {
  if (method.includes("Dual"))
    return {
      bg: "bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-300",
    };
  if (method.includes("Cutting") || method.includes("Gomory"))
    return {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-300",
    };
  return {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
  };
}

export default function ProblemHistory({
  entries,
  onClearHistory,
  onRestoreProblem,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Don't render the panel at all when there's no history
  if (entries.length === 0) return null;

  return (
    <>
      <div
        className="bg-white border-b border-border"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        data-ocid="history.panel"
      >
        {/* Panel header — always visible */}
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
            data-ocid="history.toggle"
          >
            <Clock size={15} className="text-primary" />
            <span>Problem History</span>
            <span className="bg-primary text-white text-xs rounded-full px-2 py-0.5 font-bold leading-none">
              {entries.length}
            </span>
            {expanded ? (
              <ChevronUp size={15} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={15} className="text-muted-foreground" />
            )}
          </button>

          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs text-red-600 font-medium">
                  Clear all history?
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs px-2.5"
                  onClick={() => {
                    onClearHistory();
                    setConfirmClear(false);
                    setExpanded(false);
                  }}
                  data-ocid="history.confirm_button"
                >
                  Yes, clear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setConfirmClear(false)}
                  data-ocid="history.cancel_button"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 px-2"
                onClick={() => setConfirmClear(true)}
                data-ocid="history.delete_button"
              >
                <Trash2 size={12} /> Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible entry list */}
        {expanded && (
          <div className="max-w-2xl mx-auto px-4 pb-4">
            <div className="space-y-2" data-ocid="history.list">
              {entries.map((entry, i) => {
                const mc = getMethodColors(entry.methodName);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full text-left bg-background hover:bg-secondary/60 border border-border rounded-xl p-3 transition-all hover:border-primary/40 hover:shadow-xs group"
                    data-ocid={`history.item.${i + 1}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(entry.timestamp)}
                      </span>
                      <span
                        className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${mc.bg} ${mc.text} ${mc.border} shrink-0`}
                      >
                        {entry.methodName}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {entry.objectiveFunction}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-primary">
                        Z = {entry.zValue}
                      </span>
                      {entry.gomoryCutCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          · {entry.gomoryCutCount} Gomory cut
                          {entry.gomoryCutCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      >
        {selectedEntry &&
          (() => {
            const mc = getMethodColors(selectedEntry.methodName);
            return (
              <DialogContent
                className="max-w-lg max-h-[85vh] overflow-y-auto"
                data-ocid="history.modal"
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <span>Problem Detail</span>
                    <span
                      className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${mc.bg} ${mc.text} ${mc.border}`}
                    >
                      {selectedEntry.methodName}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                  {/* Timestamp */}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock size={12} />
                    {formatDate(selectedEntry.timestamp)}
                  </p>

                  {/* Z Value highlight */}
                  <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                      Optimal Value
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      Z = {selectedEntry.zValue}
                    </p>
                    {selectedEntry.gomoryCutCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {selectedEntry.gomoryCutCount} Gomory cut
                        {selectedEntry.gomoryCutCount > 1 ? "s" : ""} applied
                      </p>
                    )}
                  </div>

                  {/* Problem statement */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">
                      Problem
                    </h4>
                    <div className="bg-secondary rounded-xl p-3.5 space-y-1.5 font-mono text-sm">
                      <p className="font-semibold text-foreground">
                        {selectedEntry.objectiveFunction}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Subject to:
                      </p>
                      {selectedEntry.problem.constraints.map((c, i) => {
                        const lhs = c.coeffs
                          .map(
                            (v, j) =>
                              `${v >= 0 && j > 0 ? "+" : ""}${v}x${toSub(j + 1)}`,
                          )
                          .join(" ");
                        return (
                          <p
                            key={`c-${c.rhs}-${c.sign}-${c.coeffs.join(",")}`}
                            className="text-foreground"
                          >
                            C{i + 1}: {lhs} {c.sign} {c.rhs}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  {/* Variable values */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">
                      Solution Variables
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Object.entries(selectedEntry.solutionVars).map(
                        ([k, v]) => (
                          <div
                            key={k}
                            className="bg-background border border-border rounded-lg p-2.5 text-center"
                          >
                            <p className="text-xs text-muted-foreground font-medium">
                              {k}
                            </p>
                            <p className="text-sm font-bold text-foreground">
                              {v}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer with Load and Close buttons */}
                <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                  <Button
                    onClick={() => setSelectedEntry(null)}
                    variant="outline"
                    className="w-full sm:w-auto"
                    data-ocid="history.close_button"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      onRestoreProblem(selectedEntry);
                      setSelectedEntry(null);
                    }}
                    className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90"
                    data-ocid="history.restore.open_modal_button"
                  >
                    Load This Problem
                  </Button>
                </DialogFooter>
              </DialogContent>
            );
          })()}
      </Dialog>
    </>
  );
}
