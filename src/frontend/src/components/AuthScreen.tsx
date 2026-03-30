import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Lock, Shield } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onLogin: () => void;
  isLoggingIn: boolean;
  isInitializing: boolean;
}

export default function AuthScreen({
  onLogin,
  isLoggingIn,
  isInitializing,
}: AuthScreenProps) {
  if (isInitializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-blue-50"
        data-ocid="auth.loading_state"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-background to-blue-50 px-4 py-12">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        <Card className="shadow-card border-border/60 bg-card">
          <CardContent className="pt-8 pb-8 px-8">
            {/* Branding */}
            <div className="text-center mb-6">
              <h1
                className="font-parisienne text-5xl text-primary leading-tight mb-1"
                data-ocid="auth.section"
              >
                Ravi SKT
              </h1>
              <p className="text-foreground font-semibold text-lg tracking-wide">
                LPP Solver Pro
              </p>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                Your step-by-step Linear Programming Problem solver
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Sign In to Continue
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Login button */}
            <Button
              className="w-full h-12 text-base font-semibold gap-2 shadow-xs"
              onClick={onLogin}
              disabled={isLoggingIn}
              data-ocid="auth.login.primary_button"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Login with Internet Identity
                </>
              )}
            </Button>

            {/* Security note */}
            <div className="flex items-start gap-2 mt-5 p-3 rounded-lg bg-muted/60">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Secure login powered by Internet Identity — no password required
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </motion.div>
    </div>
  );
}
