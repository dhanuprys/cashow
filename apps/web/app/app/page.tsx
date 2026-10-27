import { formatMoney } from "@cashow/domain";
import {
  getSafeToSpend,
  getSummary,
  listAccounts,
  listCategories,
  listTransactions,
} from "@cashow/services";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { LinkButton } from "@/components/ledger/link-button";
import { QuickAddForm } from "@/components/ledger/quick-add-form";
import { TransactionList } from "@/components/ledger/transaction-list";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  currentMonthKey,
  displayDate,
  monthLabel,
  monthRange,
  previousMonthKey,
} from "@/lib/format";
import { unwrap } from "@/lib/ledger";
import { cn } from "@/lib/utils";

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await connection();

  const user = await requireUser();
  const db = await getDb();
  const ctx = { db, userId: user.id };
  const now = new Date();
  const requested = (await searchParams).month;
  const month =
    requested !== undefined && /^\d{4}-\d{2}$/.test(requested)
      ? requested
      : currentMonthKey(now, user.timezone);
  const range = monthRange(month);

  const [summaryResult, recent, accounts, categories, safeToSpendResult] = await Promise.all([
    getSummary(ctx, { period: "custom", from: range.from, to: range.to }),
    listTransactions(ctx, { limit: 6 }),
    listAccounts(ctx),
    listCategories(ctx),
    getSafeToSpend(ctx),
  ]);

  const summary = unwrap(summaryResult);
  const latest = unwrap(recent);
  const accountList = unwrap(accounts);
  const categoryList = unwrap(categories).filter((category) => category.archivedAt === null);
  const liveAccounts = accountList.filter((account) => account.archivedAt === null);
  const safeToSpend = safeToSpendResult.ok ? safeToSpendResult.value : null;

  const topExpense = summary.byCategory[0]?.total ?? 0n;
  const nextMonth = (() => {
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const index = Number(monthText);
    return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, "0")}`;
  })();

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Ringkasan
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Halo, {user.name ?? "Pemilik"}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayDate(now, user.timezone)} · {user.timezone}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <LinkButton
            href={`/app?month=${previousMonthKey(month)}`}
            variant="outline"
            size="icon-sm"
          >
            <ChevronLeft aria-hidden="true" />
            <span className="sr-only">Bulan sebelumnya</span>
          </LinkButton>
          <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
          <LinkButton href={`/app?month=${nextMonth}`} variant="outline" size="icon-sm">
            <ChevronRight aria-hidden="true" />
            <span className="sr-only">Bulan berikutnya</span>
          </LinkButton>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Arus bulan ini</CardTitle>
            <CardDescription>{summary.transactionCount} transaksi tercatat.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowDownLeft className="size-3.5 text-emerald-500" aria-hidden="true" />
                Masuk
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(summary.income)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRight className="size-3.5 text-rose-500" aria-hidden="true" />
                Keluar
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(summary.expense)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Selisih</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  summary.net < 0n ? "text-rose-600 dark:text-rose-400" : "",
                )}
              >
                {formatMoney(summary.net)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catat cepat</CardTitle>
            <CardDescription>Satu ketikan, langsung masuk buku.</CardDescription>
          </CardHeader>
          <CardContent>
            <QuickAddForm
              accounts={liveAccounts.map((account) => ({ id: account.id, name: account.name }))}
              categories={categoryList.map((category) => ({
                id: category.id,
                name: category.name,
                kind: category.kind,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Transaksi terakhir</CardTitle>
            <CardDescription>Enam catatan terbaru.</CardDescription>
            <CardAction>
              <LinkButton href="/app/transactions" variant="outline" size="sm">
                Lihat semua
              </LinkButton>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TransactionList
              items={latest.items}
              empty={
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Belum ada transaksi</EmptyTitle>
                    <EmptyDescription>
                      Catat pemasukan atau pengeluaran pertama lewat formulir cepat.
                    </EmptyDescription>
                  </EmptyHeader>
                  <LinkButton href="/app/transactions/new" size="sm">
                    <Plus aria-hidden="true" />
                    Tambah transaksi
                  </LinkButton>
                </Empty>
              }
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {safeToSpend === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle>Safe to spend</CardTitle>
                <CardDescription>
                  Sisa anggaran bulan ini dibagi {safeToSpend.daysLeft} hari.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(safeToSpend.daily)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tersedia {formatMoney(safeToSpend.available)} · tagihan mendatang{" "}
                  {formatMoney(safeToSpend.upcoming)}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pengeluaran terbesar</CardTitle>
              <CardDescription>Bulan {monthLabel(month)}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
              ) : (
                summary.byCategory.map((category) => {
                  const width =
                    topExpense === 0n ? 0 : Number((category.total * 100n) / topExpense);
                  return (
                    <div key={category.categoryId ?? "none"}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">{category.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatMoney(category.total)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.max(width, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saldo akun</CardTitle>
              <CardDescription>Dihitung dari saldo awal dan transaksi.</CardDescription>
              <CardAction>
                <LinkButton href="/app/accounts" variant="ghost" size="sm">
                  Kelola
                </LinkButton>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {accountList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada akun.</p>
              ) : (
                accountList.map((account) => (
                  <div key={account.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{account.name}</span>
                      {account.archivedAt === null ? null : (
                        <Badge variant="secondary">Arsip</Badge>
                      )}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        account.balance < 0n ? "text-rose-600 dark:text-rose-400" : "",
                      )}
                    >
                      {formatMoney(account.balance)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {range.from} – {range.to} · semua jumlah dalam rupiah utuh
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 w-64 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-40 animate-pulse rounded-4xl bg-muted" />
        <div className="h-40 animate-pulse rounded-4xl bg-muted" />
      </div>
      <div className="h-72 animate-pulse rounded-4xl bg-muted" />
    </div>
  );
}
