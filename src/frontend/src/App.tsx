import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useState } from "react";
import AuthScreen from "./components/AuthScreen";
import InputForm, { type InputFormState } from "./components/InputForm";
import ProblemHistory from "./components/ProblemHistory";
import SolverView, { type SolverState } from "./components/SolverView";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import type { LPProblem } from "./lppSolver";

export type AppView = "input" | "solver";
export type DisplayMode = "fraction" | "decimal";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  methodName: string;
  objectiveFunction: string;
  zValue: number;
  solutionVars: { [key: string]: number };
  gomoryCutCount: number;
  problem: LPProblem;
  inputFormState?: InputFormState;
  solverState?: SolverState;
}

export default function App() {
  const { identity, login, clear, isInitializing, isLoggingIn } =
    useInternetIdentity();

  const [view, setView] = useState<AppView>("input");
  const [problem, setProblem] = useState<LPProblem | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("decimal");
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lpp-solver-history") || "[]");
    } catch {
      return [];
    }
  });

  // Restore-from-history state
  const [formKey, setFormKey] = useState(0);
  const [initialInputState, setInitialInputState] = useState<
    InputFormState | undefined
  >();
  const [initialSolverState, setInitialSolverState] = useState<
    SolverState | undefined
  >();
  const [pendingRestore, setPendingRestore] = useState<HistoryEntry | null>(
    null,
  );

  // ─── Auth gate ───────────────────────────────────────────────────────────
  if (isInitializing || !identity) {
    return (
      <AuthScreen
        onLogin={login}
        isLoggingIn={isLoggingIn}
        isInitializing={isInitializing}
      />
    );
  }

  // ─── Solver handlers ─────────────────────────────────────────────────────
  function handleSolve(p: LPProblem) {
    setProblem(p);
    setView("solver");
  }

  function handleReset() {
    setView("input");
    setProblem(null);
    setInitialSolverState(undefined);
  }

  function handleSaveProblem(entry: HistoryEntry) {
    setHistory((prev) => {
      const updated = [entry, ...prev];
      localStorage.setItem("lpp-solver-history", JSON.stringify(updated));
      return updated;
    });
  }

  function handleClearHistory() {
    setHistory([]);
    localStorage.removeItem("lpp-solver-history");
  }

  function handleRestoreProblem(entry: HistoryEntry) {
    setPendingRestore(entry);
  }

  function handleConfirmRestore() {
    if (!pendingRestore) return;

    setFormKey((k) => k + 1);
    setInitialInputState(pendingRestore.inputFormState);

    if (pendingRestore.solverState && pendingRestore.problem) {
      setProblem(pendingRestore.problem);
      setInitialSolverState(pendingRestore.solverState);
      setView("solver");
    } else {
      setInitialSolverState(undefined);
      setProblem(null);
      setView("input");
    }

    setPendingRestore(null);
  }

  // Abbreviated principal for logout bar
  const principal = identity.getPrincipal().toString();
  const shortPrincipal = `${principal.slice(0, 8)}…`;

  return (
    <div className="min-h-screen bg-background">
      {/* Logout bar */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border/60 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {shortPrincipal}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-3"
            onClick={clear}
            data-ocid="auth.logout.button"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Logout</span>
          </Button>
        </div>
      </div>

      <ProblemHistory
        entries={history}
        onClearHistory={handleClearHistory}
        onRestoreProblem={handleRestoreProblem}
      />
      {view === "input" && (
        <InputForm
          key={formKey}
          onSolve={handleSolve}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          initialState={initialInputState}
        />
      )}
      {view === "solver" && problem && (
        <SolverView
          problem={problem}
          onReset={handleReset}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          onSaveProblem={handleSaveProblem}
          initialSolverState={initialSolverState}
          inputFormStateForHistory={initialInputState}
        />
      )}

      {/* Confirmation dialog for restoring a history problem */}
      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(null);
        }}
      >
        <AlertDialogContent data-ocid="history.restore.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Load this problem?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current setup. Your current solved problem
              is already saved in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingRestore(null)}
              data-ocid="history.restore.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              data-ocid="history.restore.confirm_button"
            >
              Load Problem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
