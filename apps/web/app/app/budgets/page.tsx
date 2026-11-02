import { formatMoney } from "@cashow/domain";
import { getBudgetStatus, listBudgets, listCategories } from "@cashow/services";
import { connection } from "next/server";
import { Suspense } from "react";
import { BudgetForm, DeleteBudgetButton } from "@/components/ledger/budget-form";
import { ContentSkeleton } from "@/components/ledger/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Anggaran",
};

export default function BudgetsPage() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Anggaran
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Anggaran bulanan
        </h1>
      </section>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="-mt-3 h-4 w-44 animate-pulse rounded-md bg-muted" />
            <ContentSkeleton />
          </div>
        }
      >
        <Budgets />
      </Suspense>
    </div>
  );
}

async function Budgets() {
  await connection();
  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };

  const [budgetsResult, statusResult, categoriesResult] = await Promise.all([
    listBudgets(ctx),
    getBudgetStatus(ctx),
    listCategories(ctx),
  ]);
  const budgets = unwrap(budgetsResult);
  const statuses = unwrap(statusResult);
  const categories = unwrap(categoriesResult).filter(
    (c) => c.kind === "EXPENSE" && c.archivedAt === null,
  );

  const statusById = new Map(statuses.map((s) => [s.budget.id, s]));

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-sm text-muted-foreground">
        {budgets.length} anggaran aktif dan nonaktif.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {budgets.length === 0 ? (
            <Card>
              <CardContent>
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada anggaran</EmptyTitle>
                    <EmptyDescription>
                      Buat batas pengeluaran per kategori atau keseluruhan.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            budgets.map((budget) => {
              const status = statusById.get(budget.id);
              const isOver = (status?.usedPercent ?? 0) >= 100;
              const isWarning = (status?.usedPercent ?? 0) >= 80 && !isOver;

              return (
                <Card key={budget.id}>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium break-words line-clamp-2">{budget.name}</p>
                          {status && (
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap",
                                isOver
                                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                                  : isWarning
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              {status.usedPercent.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground break-words">
                          {budget.categoryName ?? "Semua pengeluaran"} · batas{" "}
                          {formatMoney(budget.amount)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <DeleteBudgetButton budgetId={budget.id} />
                      </div>
                    </div>
                    {status === undefined ? null : (
                      <>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              isOver
                                ? "bg-rose-500"
                                : isWarning
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                            style={{ width: `${Math.min(status.usedPercent, 100)}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted-foreground">
                          <p>
                            Terpakai {formatMoney(status.spent)} dari{" "}
                            {formatMoney(status.budget.amount)} ({status.usedPercent.toFixed(1)}%) ·
                            proyeksi akhir bulan {formatMoney(status.projected)}
                          </p>
                          <span className="text-[11px]">
                            Hari ke-{status.daysElapsed}/{status.totalDays} (
                            {status.monthElapsedPercent}% waktu) ·{" "}
                            <span
                              className={cn(
                                "font-semibold",
                                status.usedPercent > status.monthElapsedPercent + 10
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {status.usedPercent > status.monthElapsedPercent + 10
                                ? "Pace cepat (waspada)"
                                : "Terkendali"}
                            </span>
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anggaran baru</CardTitle>
            <CardDescription>Batas pengeluaran per bulan anggaran.</CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
