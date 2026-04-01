import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Principal } from "@icp-sdk/core/principal";
import { RefreshCw, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { UserActivity, UserProfile } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface UsersPanelProps {
  onClose: () => void;
}

export default function UsersPanel({ onClose }: UsersPanelProps) {
  const { actor: backend } = useActor();
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!backend) return;
    setLoading(true);
    setError(null);
    try {
      const [allUsers, profiles] = await Promise.all([
        backend.getAllUserActivity(),
        backend.getAllUserProfiles(),
      ]);
      setUsers(allUsers);
      setEmailMap(
        new Map(
          (profiles as Array<[Principal, UserProfile]>).map(([p, prof]) => [
            p.toString(),
            prof.email,
          ]),
        ),
      );
      setLastRefresh(new Date());
    } catch {
      setError(
        "Failed to load user data. Please close and re-enter the token.",
      );
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  function formatTimestamp(ts: bigint) {
    if (!ts) return "\u2014";
    return new Date(Number(ts) / 1_000_000).toLocaleString();
  }

  function truncatePrincipal(p: { toString(): string }) {
    const s = p.toString();
    return `${s.slice(0, 8)}\u2026${s.slice(-4)}`;
  }

  const skeletonKeys = ["sk1", "sk2", "sk3", "sk4", "sk5"];
  const totalSolves = users.reduce((sum, u) => sum + Number(u.solveCount), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col"
      data-ocid="users.panel"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-400" />
          <h2 className="text-white font-bold text-lg">Users Panel</h2>
          <span className="text-slate-400 text-sm hidden sm:inline">
            \u2014 Activity & Analytics
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-slate-400 text-xs hidden sm:inline">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            className="text-slate-300 hover:text-white hover:bg-white/10 gap-1.5 h-8 px-3"
            data-ocid="users.refresh.button"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span className="text-xs">Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full"
            data-ocid="users.close_button"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && users.length === 0 ? (
          <div
            className="p-6 flex flex-col gap-3 max-w-6xl mx-auto"
            data-ocid="users.loading_state"
          >
            {skeletonKeys.map((k) => (
              <Skeleton key={k} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div
            className="flex flex-col items-center justify-center h-64 gap-3 text-center"
            data-ocid="users.error_state"
          >
            <Users className="h-12 w-12 text-destructive" />
            <p className="text-xl font-bold text-destructive">Error</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold text-blue-600">
                  {users.length}
                </p>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Total Solves</p>
                <p className="text-3xl font-bold text-green-600">
                  {totalSolves}
                </p>
              </div>
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4 flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-3xl font-bold text-purple-600">
                  {users.reduce((sum, u) => sum + Number(u.visitCount), 0)}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Avg Solves/User</p>
                <p className="text-3xl font-bold text-amber-600">
                  {users.length > 0
                    ? (totalSolves / users.length).toFixed(1)
                    : "0"}
                </p>
              </div>
            </div>

            {/* Users table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <h3 className="font-semibold text-sm">All Users Activity</h3>
              </div>
              <ScrollArea className="w-full">
                <Table data-ocid="users.table">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Email
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        First Seen
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Last Login
                      </TableHead>
                      <TableHead>Visits</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Location
                      </TableHead>
                      <TableHead>Solves</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Simplex
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Dual
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Cut-Plane
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow data-ocid="users.empty_state">
                        <TableCell
                          colSpan={11}
                          className="text-center text-muted-foreground py-8"
                        >
                          No users tracked yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u, idx) => {
                        const ocidIdx = idx + 1;
                        return (
                          <TableRow
                            key={u.principal.toString()}
                            data-ocid={`users.row.item.${ocidIdx}`}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {ocidIdx}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {truncatePrincipal(u.principal)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                              {emailMap.get(u.principal.toString()) || "\u2014"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                              {formatTimestamp(u.firstSeen)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                              {formatTimestamp(u.lastLogin)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {Number(u.visitCount)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                              {u.location || "\u2014"}
                            </TableCell>
                            <TableCell className="text-sm font-bold text-green-600">
                              {Number(u.solveCount)}
                            </TableCell>
                            <TableCell className="text-xs hidden lg:table-cell">
                              {Number(u.simplexCount)}
                            </TableCell>
                            <TableCell className="text-xs hidden lg:table-cell">
                              {Number(u.dualSimplexCount)}
                            </TableCell>
                            <TableCell className="text-xs hidden lg:table-cell">
                              {Number(u.cuttingPlaneCount)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
