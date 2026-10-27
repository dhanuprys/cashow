import { formatMoney } from "@cashow/domain";
import { getBudgetStatus, listBudgets, listCategories } from "@cashow/services";
import { connection } from "next/server";
import { Suspense } from "react";
import { BudgetForm, DeleteBudgetButton } from "@/components/ledger/budget-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { unwrap } from "@/lib/ledger";

export default function BudgetsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-4xl bg-muted" />}>
      <Budgets />
    </Suspense>
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
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Anggaran
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Anggaran bulanan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {budgets.length} anggaran aktif dan nonaktif.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
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
              return (
                <Card key={budget.id}>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{budget.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {budget.categoryName ?? "Semua pengeluaran"} · batas{" "}
                          {formatMoney(budget.amount)}
                        </p>
                      </div>
                      <DeleteBudgetButton budgetId={budget.id} />
                    </div>
                    {status === undefined ? null : (
                      <>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground/70"
                            style={{ width: `${Math.min(status.usedPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Terpakai {formatMoney(status.spent)} dari{" "}
                          {formatMoney(status.budget.amount)} ({status.usedPercent.toFixed(1)}%) ·
                          proyeksi akhir bulan {formatMoney(status.projected)}
                        </p>
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
