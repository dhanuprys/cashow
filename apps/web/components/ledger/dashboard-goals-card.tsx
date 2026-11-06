"use client";

import { formatMoney } from "@cashow/domain";
import type { GoalSummary } from "@cashow/services";
import { CheckCircle2, ChevronRight, Plus, Target } from "lucide-react";
import Link from "next/link";
import { ReserveGoalDialog } from "@/components/ledger/goal-form";
import { LinkButton } from "@/components/ledger/link-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";
import { cn } from "@/lib/utils";

export interface DashboardGoalsCardProps {
  goals: GoalSummary[];
  accounts: {
    id: string;
    name: string;
    balance: bigint;
  }[];
  className?: string;
}

export function DashboardGoalsCard({ goals, accounts, className }: DashboardGoalsCardProps) {
  const [showBalance] = useBalanceVisibility();

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0n);
  const totalSaved = goals.reduce((sum, g) => sum + g.savedAmount, 0n);
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const overallProgress =
    totalTarget > 0n ? Math.min(Number((totalSaved * 100n) / totalTarget), 100) : 0;

  // Calculate free cash per account so the embedded Sisihkan dialog respects real bank funds
  const reservedByAccount = new Map<string, bigint>();
  for (const goal of goals) {
    for (const reservation of goal.reservations) {
      const current = reservedByAccount.get(reservation.accountId) ?? 0n;
      reservedByAccount.set(reservation.accountId, current + reservation.amount);
    }
  }

  const accountOptions = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    free: account.balance - (reservedByAccount.get(account.id) ?? 0n),
  }));

  const reservableAccounts = accountOptions.filter((a) => a.free > 0n);

  // Show active in-progress goals first, followed by others, max 3 in compact widget
  const sortedGoals = [...goals].sort((a, b) => {
    if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
    if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
    const aRemaining = a.targetAmount - a.savedAmount;
    const bRemaining = b.targetAmount - b.savedAmount;
    if (aRemaining > 0n && bRemaining <= 0n) return -1;
    if (aRemaining <= 0n && bRemaining > 0n) return 1;
    return 0;
  });

  const displayedGoals = sortedGoals.slice(0, 3);
  const overflowCount = goals.length - displayedGoals.length;

  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Target className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold truncate">Target Tabungan</CardTitle>
            <CardDescription className="text-xs truncate">
              {goals.length === 0
                ? "Pos tabungan & dana impian"
                : `${activeGoals.length} target aktif · ${overallProgress}% tercapai`}
            </CardDescription>
          </div>
        </div>

        <CardAction>
          <LinkButton
            href="/app/goals"
            variant="ghost"
            size="xs"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>Kelola</span>
            <ChevronRight className="size-3" aria-hidden="true" />
          </LinkButton>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 min-w-0">
        {goals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-3.5 text-center">
            <p className="text-xs font-medium text-foreground">Belum ada target tabungan</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Sisihkan dana untuk impian atau darurat tanpa mengubah saldo riil bank.
            </p>
            <div className="mt-2.5">
              <LinkButton
                href="/app/goals"
                size="xs"
                variant="outline"
                className="gap-1 text-[11px] h-7"
              >
                <Plus className="size-3" aria-hidden="true" />
                <span>Buat Target Pertama</span>
              </LinkButton>
            </div>
          </div>
        ) : (
          <>
            {/* Compact Overall Progress Strip */}
            <div className="rounded-xl bg-muted/40 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground">Total Dicadangkan</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {showBalance ? formatMoney(totalSaved) : "••••••••"}
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">
                    / {showBalance ? formatMoney(totalTarget) : "••••••••"}
                  </span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={overallProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Total progres target tabungan"
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            {/* Compact Goals List */}
            <div className="divide-y divide-border/40">
              {displayedGoals.map((goal) => {
                const isCompleted = goal.savedAmount >= goal.targetAmount;

                return (
                  <div
                    key={goal.id}
                    className="py-2.5 first:pt-1 last:pb-0 flex flex-col gap-1.5 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <Link href="/app/goals" className="min-w-0 group/goal flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-foreground truncate group-hover/goal:text-primary transition-colors">
                            {goal.name}
                          </span>
                          {isCompleted ? (
                            <Badge
                              variant="default"
                              className="bg-emerald-600 text-white text-[9px] py-0 px-1.5 h-4 gap-0.5 shrink-0"
                            >
                              <CheckCircle2 className="size-2.5" aria-hidden="true" />
                              <span>Tercapai</span>
                            </Badge>
                          ) : goal.status === "PAUSED" ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 px-1 h-4 text-muted-foreground shrink-0"
                            >
                              Dijeda
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                          {goal.targetDate && (
                            <span className="shrink-0">
                              {goal.monthsRemaining === 1
                                ? "Bulan ini"
                                : `${goal.monthsRemaining} bln lagi`}{" "}
                              ·
                            </span>
                          )}
                          <span className="tabular-nums">
                            {showBalance ? formatMoney(goal.savedAmount) : "••••"}
                          </span>
                          <span>/</span>
                          <span className="tabular-nums">
                            {showBalance ? formatMoney(goal.targetAmount) : "••••"}
                          </span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <span className="text-[11px] font-semibold tabular-nums text-foreground">
                          {goal.progressPercent.toFixed(0)}%
                        </span>
                        {!isCompleted && goal.status === "ACTIVE" && (
                          <ReserveGoalDialog
                            goalId={goal.id}
                            goalName={goal.name}
                            accounts={reservableAccounts}
                            remainingAmount={goal.remainingAmount}
                            monthlyPacing={goal.monthlyPacing}
                            compact
                          />
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isCompleted ? "bg-emerald-500" : "bg-primary",
                        )}
                        style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overflow link if more than 3 goals */}
            {overflowCount > 0 && (
              <div className="pt-1.5 text-center border-t border-border/40">
                <Link
                  href="/app/goals"
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>Lihat {overflowCount} target lainnya</span>
                  <ChevronRight className="size-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
