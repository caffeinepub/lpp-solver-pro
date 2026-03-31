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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareHeart,
  Shield,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import AuthScreen from "./components/AuthScreen";
import EmailSetupScreen from "./components/EmailSetupScreen";
import FeedbackForm from "./components/FeedbackForm";
import InputForm, { type InputFormState } from "./components/InputForm";
import ProblemHistory from "./components/ProblemHistory";
import SolverView, { type SolverState } from "./components/SolverView";
import UsersPanel from "./components/UsersPanel";
import { useActor } from "./hooks/useActor";
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
  const { actor: backend } = useActor();

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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [showClaimAdmin, setShowClaimAdmin] = useState(false);
  const [claimToken, setClaimToken] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);

  // Profile / email setup state
  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

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

  // Check admin status on mount
  useEffect(() => {
    if (!backend || !identity) return;
    backend
      .isCallerAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, [backend, identity]);

  // Record login and capture location
  useEffect(() => {
    if (!backend || !identity) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = `${pos.coords.latitude.toFixed(2)},${pos.coords.longitude.toFixed(2)}`;
          backend.recordLogin(loc).catch(() => {});
        },
        () => {
          backend.recordLogin("").catch(() => {});
        },
        { timeout: 5000 },
      );
    } else {
      backend.recordLogin("").catch(() => {});
    }
  }, [backend, identity]);

  // Check if user has a profile (first-login detection)
  useEffect(() => {
    if (!backend || !identity) return;
    backend
      .getCallerUserProfile()
      .then((profile) => {
        setHasProfile(profile !== null);
        setProfileChecked(true);
      })
      .catch(() => {
        // On error, skip email setup to avoid blocking access
        setHasProfile(true);
        setProfileChecked(true);
      });
  }, [backend, identity]);

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

  // ─── Profile check loading ────────────────────────────────────────────────
  if (!profileChecked) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-blue-50"
        data-ocid="profile-check.loading_state"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Email setup for first-time users ────────────────────────────────────
  if (!hasProfile) {
    return <EmailSetupScreen onComplete={() => setHasProfile(true)} />;
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

  // Build a problem context snapshot string
  const problemContext = problem ? JSON.stringify(problem) : "";

  // Abbreviated principal for logout bar
  const principal = identity.getPrincipal().toString();
  const shortPrincipal = `${principal.slice(0, 8)}\u2026`;

  return (
    <div className="min-h-screen bg-background">
      {/* Logout bar */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur border-b border-border/60 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
            {shortPrincipal}
          </span>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 h-8 px-3"
                onClick={() => setShowUsersPanel(true)}
                data-ocid="users.open_modal_button"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Users</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 px-3"
                onClick={() => setShowAdminPanel(true)}
                data-ocid="admin.open_modal_button"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Admin</span>
              </Button>
            </>
          )}
          {!isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-yellow-600 h-8 px-3"
              onClick={() => setShowClaimAdmin(true)}
              data-ocid="admin.claim.open_modal_button"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Admin</span>
            </Button>
          )}
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

      {/* Floating feedback button */}
      <Button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full gap-2 px-4 py-2 h-auto"
        data-ocid="feedback.open_modal_button"
      >
        <MessageSquareHeart className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline text-sm font-medium">
          Share Your Feedback
        </span>
      </Button>

      {/* Feedback modal */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="feedback.dialog"
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-2 rounded-lg">
                <MessageSquareHeart className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-lg font-bold">
                Share Your Feedback
              </DialogTitle>
            </div>
          </DialogHeader>
          <FeedbackForm
            principal={principal}
            problemContext={problemContext}
            onClose={() => setFeedbackOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Claim Admin dialog */}
      <Dialog open={showClaimAdmin} onOpenChange={setShowClaimAdmin}>
        <DialogContent data-ocid="admin.claim.dialog">
          <DialogHeader>
            <DialogTitle>Claim Admin Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Enter the admin token to register yourself as admin.
            </p>
            <Input
              type="password"
              placeholder="Admin token"
              value={claimToken}
              onChange={(e) => setClaimToken(e.target.value)}
              data-ocid="admin.claim.input"
            />
            <Button
              className="w-full"
              disabled={claimLoading || !claimToken}
              data-ocid="admin.claim.submit_button"
              onClick={async () => {
                if (!backend) return;
                setClaimLoading(true);
                try {
                  const success = await (backend as any).claimAdminWithToken(
                    claimToken,
                  );
                  if (!success)
                    throw new Error("Invalid token or claim failed");
                  setIsAdmin(true);
                  setShowClaimAdmin(false);
                  setClaimToken("");
                } catch {
                  alert(
                    "Failed to claim admin. The token may be incorrect or admin is already assigned.",
                  );
                } finally {
                  setClaimLoading(false);
                }
              }}
            >
              {claimLoading ? "Claiming..." : "Claim Admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin panel overlay */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {/* Users panel overlay */}
      {showUsersPanel && (
        <UsersPanel onClose={() => setShowUsersPanel(false)} />
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
