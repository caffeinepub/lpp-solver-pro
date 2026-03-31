import { Badge } from "@/components/ui/badge";
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
import { ChevronDown, ChevronRight, Shield, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FeedbackEntry, FeedbackStats } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface AdminPanelProps {
  onClose: () => void;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className="h-3.5 w-3.5"
          fill={s <= rating ? "#f59e0b" : "none"}
          stroke={s <= rating ? "#f59e0b" : "#94a3b8"}
        />
      ))}
    </span>
  );
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const { actor: backend } = useActor();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!backend) return;
    async function load() {
      setLoading(true);
      try {
        const [adminCheck, allFeedback, feedbackStats] = await Promise.all([
          backend!.isCallerAdmin(),
          backend!.getAllFeedback(),
          backend!.getFeedbackStats(),
        ]);
        setIsAdmin(adminCheck);
        if (adminCheck) {
          setFeedback(allFeedback);
          setStats(feedbackStats);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [backend]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function formatTimestamp(ts: bigint) {
    return new Date(Number(ts) / 1_000_000).toLocaleString();
  }

  function truncatePrincipal(p: { toString(): string }) {
    const s = p.toString();
    return `${s.slice(0, 8)}…${s.slice(-4)}`;
  }

  const skeletonKeys = ["sk1", "sk2", "sk3", "sk4", "sk5"];

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col"
      data-ocid="admin.panel"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <h2 className="text-white font-bold text-lg">Admin Panel</h2>
          <span className="text-slate-400 text-sm hidden sm:inline">
            — Feedback & Users
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full"
          data-ocid="admin.close_button"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div
            className="p-6 flex flex-col gap-3 max-w-5xl mx-auto"
            data-ocid="admin.loading_state"
          >
            {skeletonKeys.map((k) => (
              <Skeleton key={k} className="h-10 w-full" />
            ))}
          </div>
        ) : !isAdmin ? (
          <div
            className="flex flex-col items-center justify-center h-64 gap-3 text-center"
            data-ocid="admin.error_state"
          >
            <Shield className="h-12 w-12 text-destructive" />
            <p className="text-xl font-bold text-destructive">Access Denied</p>
            <p className="text-muted-foreground">
              You are not authorized to view this page.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">Total Reviews</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {Number(stats.totalCount)}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    Average Rating
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-amber-500">
                      {stats.averageRating.toFixed(1)}
                    </p>
                    <StarDisplay rating={Math.round(stats.averageRating)} />
                  </div>
                </div>
              </div>
            )}

            {/* Feedback table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <h3 className="font-semibold text-sm">All Feedback Entries</h3>
              </div>
              <ScrollArea className="w-full">
                <Table data-ocid="admin.table">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Email
                      </TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Submitted
                      </TableHead>
                      <TableHead className="w-10">Context</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.length === 0 ? (
                      <TableRow data-ocid="admin.empty_state">
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          No feedback submitted yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      feedback.map((entry, idx) => {
                        const rowKey = entry.id.toString();
                        const isExpanded = expandedRows.has(rowKey);
                        const ocidIdx = idx + 1;
                        return (
                          <TableRow
                            key={rowKey}
                            data-ocid={`admin.row.item.${ocidIdx}`}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {ocidIdx}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {truncatePrincipal(entry.principal)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {entry.name ? (
                                <Badge variant="secondary">{entry.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                              {entry.email || "—"}
                            </TableCell>
                            <TableCell>
                              <StarDisplay rating={Number(entry.rating)} />
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="text-sm line-clamp-2">
                                {entry.comment}
                              </p>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                              {formatTimestamp(entry.timestamp)}
                            </TableCell>
                            <TableCell>
                              {entry.problemContext ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(rowKey)}
                                  className="text-blue-500 hover:text-blue-700 p-1 rounded"
                                  title="Toggle problem context"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  —
                                </span>
                              )}
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
