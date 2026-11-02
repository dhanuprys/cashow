import { formatMoney } from "@cashow/domain";
import { getBudgetStatus, listBudgets, listCategories } from "@cashow/services";
import { ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BudgetForm, DeleteBudgetButton, EditBudgetDialog } from "@/components/ledger/budget-form";
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

              // Construct drill-down link to transactions for this budget's cycle and category
              const txQuery = new URLSearchParams();
              txQuery.set("type", "EXPENSE");
              if (budget.categoryId) {
                txQuery.set("categoryId", budget.categoryId);
              }
              if (status?.from) {
                txQuery.set("from", status.from);
              }
              if (status?.to) {
                txQuery.set("to", status.to);
              }
              const transactionsUrl = `/app/transactions?${txQuery.toString()}`;

              return (
                <Card key={budget.id}>
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground text-sm sm:text-base break-words line-clamp-2">
                            {budget.name}
                          </p>
                          <span className="inline-flex shrink-0 items-center rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {budget.period === "WEEKLY"
                              ? "Mingguan"
                              : budget.period === "CUSTOM"
                                ? "Khusus"
                                : "Bulanan"}
                          </span>
                          {status?.isExpired && (
                            <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Selesai
                            </span>
                          )}
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
                          {budget.categoryName ? (
                            <>
                              Kategori{" "}
                              <span className="font-medium text-foreground">
                                {budget.categoryName}
                              </span>{" "}
                              (termasuk subkategori)
                            </>
                          ) : (
                            "Semua pengeluaran"
                          )}{" "}
                          · Batas{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatMoney(budget.amount)}
                          </span>
                          {budget.period === "CUSTOM" && budget.startDate && budget.endDate && (
                            <span className="ml-1 text-[11px] text-muted-foreground/80">
                              ({budget.startDate} s/d {budget.endDate})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <EditBudgetDialog
                          budget={{
                            id: budget.id,
                            name: budget.name,
                            categoryId: budget.categoryId,
                            amount: String(budget.amount),
                            period: budget.period,
                            startDate: budget.startDate,
                            endDate: budget.endDate,
                            active: budget.active,
                          }}
                          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                        />
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">
                              Terpakai{" "}
                              <strong className="text-foreground font-semibold tabular-nums">
                                {formatMoney(status.spent)}
                              </strong>{" "}
                              ({status.usedPercent.toFixed(1)}%)
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Sisa anggaran:{" "}
                              <span
                                className={cn(
                                  "font-medium tabular-nums",
                                  status.remaining >= 0n
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-rose-700 dark:text-rose-400 font-semibold",
                                )}
                              >
                                {formatMoney(status.remaining)}
                              </span>
                            </p>
                          </div>

                          <div className="space-y-1 sm:text-right">
                            <p className="text-muted-foreground">
                              Batas aman:{" "}
                              <strong className="text-primary font-semibold tabular-nums">
                                {formatMoney(status.dailyPacing)}
                              </strong>
                              <span className="text-[11px] text-muted-foreground"> / hari</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Proyeksi akhir bulan:{" "}
                              <span className="tabular-nums font-medium text-foreground">
                                {formatMoney(status.projected)}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/30">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
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

                          <Link
                            href={transactionsUrl}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                          >
                            <span>Lihat {status.transactionCount} transaksi</span>
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                          </Link>
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
