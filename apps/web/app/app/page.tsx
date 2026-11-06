import { deriveFinancialMood, formatMoney } from "@cashow/domain";
import {
  getBudgetStatus,
  getSafeToSpend,
  getSummary,
  listAccounts,
  listCategories,
  listGoals,
  listTransactions,
} from "@cashow/services";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountBalancesCard } from "@/components/ledger/account-balances-card";
import { CashflowChart } from "@/components/ledger/cashflow-chart";
import { CategoryChart } from "@/components/ledger/category-chart";
import { DashboardGoalsCard } from "@/components/ledger/dashboard-goals-card";
import { DashboardStatStrip } from "@/components/ledger/dashboard-stat-strip";
import { FinancialMoodBanner } from "@/components/ledger/financial-mood-modal";
import { LinkButton } from "@/components/ledger/link-button";
import { PrintButton } from "@/components/ledger/print-button";
import { QuickAddForm } from "@/components/ledger/quick-add-form";
import { SafeToSpendCard } from "@/components/ledger/safe-to-spend-card";
import { TransactionList } from "@/components/ledger/transaction-list";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { UserAvatar } from "@/components/ui/user-avatar";
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

export const metadata = {
  title: "Ringkasan",
};

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

  const [
    summaryResult,
    recent,
    accounts,
    categories,
    safeToSpendResult,
    budgetStatusResult,
    goalsResult,
  ] = await Promise.all([
    getSummary(ctx, { period: "custom", from: range.from, to: range.to }),
    listTransactions(ctx, { limit: 6 }),
    listAccounts(ctx),
    listCategories(ctx),
    getSafeToSpend(ctx),
    getBudgetStatus(ctx),
    listGoals(ctx),
  ]);

  const summary = unwrap(summaryResult);
  const latest = unwrap(recent);
  const accountList = unwrap(accounts);
  const categoryList = unwrap(categories).filter((category) => category.archivedAt === null);
  const liveAccounts = accountList.filter((account) => account.archivedAt === null);
  const totalBalance = liveAccounts.reduce((sum, account) => sum + account.balance, 0n);
  const safeToSpend = safeToSpendResult.ok ? safeToSpendResult.value : null;
  const goalList = goalsResult.ok ? goalsResult.value : [];
  const reservedForGoals = goalList.reduce((sum, g) => sum + g.savedAmount, 0n);

  // Derive Dynamic Financial Mood
  const maxBudgetUsed =
    budgetStatusResult.ok && budgetStatusResult.value.length > 0
      ? Math.max(...budgetStatusResult.value.map((b) => b.usedPercent))
      : null;
  const financialMood = deriveFinancialMood({
    income: summary.income,
    expense: summary.expense,
    budgetUsedPercent: maxBudgetUsed,
  });

  const topExpense = summary.byCategory[0]?.total ?? 0n;
  const nextMonth = (() => {
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const index = Number(monthText);
    return index === 12 ? `${year + 1}-01` : `${year}-${String(index + 1).padStart(2, "0")}`;
  })();

  const cashflowData = summary.daily.map((day) => ({
    date: day.date,
    day: day.date.slice(8), // DD format e.g. "01", "15"
    income: Number(day.income),
    expense: Number(day.expense),
  }));

  const categoryExpenseData = summary.byCategory.map((cat) => ({
    name: cat.name,
    total: Number(cat.total),
  }));

  const currentMonth = currentMonthKey(now, user.timezone);
  const isCurrentMonth = month === currentMonth;

  return (
    <div className="space-y-6">
      {/* Page Header: Welcome + User Avatar + Month Navigator */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <UserAvatar avatar={user.avatar} name={user.name ?? user.username} size="lg" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Halo, {user.name ?? "Pemilik"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {displayDate(now, user.timezone)} · {user.timezone}
              {user.bio ? ` — "${user.bio}"` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-2xs">
            <LinkButton
              href={`/app?month=${previousMonthKey(month)}`}
              variant="ghost"
              size="icon-sm"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="sr-only">Bulan sebelumnya</span>
            </LinkButton>
            <span className="min-w-28 text-center text-xs font-medium">{monthLabel(month)}</span>
            <LinkButton href={`/app?month=${nextMonth}`} variant="ghost" size="icon-sm">
              <ChevronRight className="size-4" aria-hidden="true" />
              <span className="sr-only">Bulan berikutnya</span>
            </LinkButton>
          </div>
          {!isCurrentMonth && (
            <LinkButton href="/app" variant="outline" size="sm" className="text-xs">
              Bulan ini
            </LinkButton>
          )}
          <PrintButton />
        </div>
      </section>

      {/* Financial Health Status Ribbon (Option 1) */}
      <FinancialMoodBanner
        mood={financialMood}
        income={summary.income}
        expense={summary.expense}
        maxBudgetUsed={maxBudgetUsed}
      />

      {/* First-run onboarding: guide the owner to set up accounts and record the
          first transaction instead of showing an empty dashboard. */}
      {liveAccounts.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Mulai siapkan pembukuanmu</CardTitle>
            <CardDescription>
              Tambahkan rekening atau dompet kas, lalu catat transaksi pertamamu untuk mengaktifkan
              ringkasan keuangan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              <LinkButton href="/app/accounts" className="w-full">
                1. Buat rekening / dompet
              </LinkButton>
              <LinkButton
                href="/app/transactions/new?type=INCOME"
                variant="outline"
                className="w-full"
              >
                2. Masukkan saldo awal
              </LinkButton>
              <LinkButton href="/app/transactions/new" variant="outline" className="w-full">
                3. Catat transaksi
              </LinkButton>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Top 4-Stat KPI Strip including Total Balance */}
      <DashboardStatStrip
        totalBalance={totalBalance}
        income={summary.income}
        expense={summary.expense}
        net={summary.net}
        transactionCount={summary.transactionCount}
        activeAccountsCount={liveAccounts.length}
        reservedForGoals={reservedForGoals}
      />

      {/* Tier 1: Daily Guardrail & Savings Envelopes */}
      <section
        aria-label="Batas Belanja dan Target"
        className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0"
      >
        {safeToSpend !== null ? <SafeToSpendCard safeToSpend={safeToSpend} /> : null}
        <DashboardGoalsCard
          goals={goalList}
          accounts={liveAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            balance: account.balance,
          }))}
          className={safeToSpend === null ? "md:col-span-2" : undefined}
        />
      </section>

      {/* Tier 2: Visual Insights (Side-by-Side Analytics) */}
      <section
        aria-label="Grafik Analitik"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0"
      >
        {/* Daily Cashflow Chart */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Arus Kas Harian</CardTitle>
            <CardDescription>
              Grafik pergerakan uang masuk dan keluar sepanjang bulan {monthLabel(month)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            <CashflowChart data={cashflowData} />
          </CardContent>
        </Card>

        {/* Category Breakdown Donut + ranked bars */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>Pengeluaran per Kategori</CardTitle>
            <CardDescription>Komposisi pengeluaran bulan {monthLabel(month)}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0">
            {summary.byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">
                Belum ada pengeluaran pada bulan ini.
              </p>
            ) : (
              <>
                <CategoryChart data={categoryExpenseData} />
                <div className="space-y-2.5 pt-2 min-w-0">
                  {summary.byCategory.map((category) => {
                    const width =
                      topExpense === 0n ? 0 : Number((category.total * 100n) / topExpense);
                    return (
                      <div key={category.categoryId ?? "none"} className="min-w-0">
                        <div className="flex items-baseline justify-between gap-2 text-xs min-w-0">
                          <span className="truncate font-medium">{category.name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {formatMoney(category.total)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/80"
                            style={{ width: `${Math.max(width, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tier 3: Operational Command & Ledgers */}
      <section
        aria-label="Catatan Transaksi dan Akun"
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] min-w-0"
      >
        {/* Left Column: Recent Ledger */}
        <div className="space-y-6 min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Transaksi Terakhir</CardTitle>
              <CardDescription>Catatan pengeluaran &amp; pemasukan terbaru.</CardDescription>
              <CardAction>
                <LinkButton href="/app/transactions" variant="outline" size="sm">
                  Lihat semua
                </LinkButton>
              </CardAction>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <TransactionList
                items={latest.items}
                empty={
                  <Empty className="border-0">
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
        </div>

        {/* Right Column: Account Balances & Quick Add */}
        <div className="space-y-6 min-w-0">
          {/* Account Balances Summary */}
          <AccountBalancesCard
            accounts={accountList.map((account) => ({
              id: account.id,
              name: account.name,
              balance: account.balance,
              archivedAt: account.archivedAt,
            }))}
          />

          {/* Quick Add Form Widget */}
          <Card className="print:hidden min-w-0 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle>Catat Cepat</CardTitle>
              <CardDescription>
                Catat pemasukan atau pengeluaran dalam hitungan detik.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
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
      </section>

      <p className="text-center text-xs text-muted-foreground/80">
        Periode pembukuan: {range.from} s.d. {range.to} · Seluruh nominal dalam Rupiah (IDR)
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {/* Header wireframe */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Ringkasan Keuangan
          </p>
          <div className="mt-1 h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="mt-1.5 h-3 w-36 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
      </section>

      {/* 4-KPI Stat Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["stat-balance", "stat-income", "stat-expense", "stat-net"].map((key) => (
          <div
            key={key}
            className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4"
          >
            <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
            <div className="mt-3 h-6 w-32 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>

      {/* Tier 1 Skeleton: 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-5 h-44 animate-pulse bg-muted/20" />
        <div className="rounded-2xl border border-border bg-card p-5 h-44 animate-pulse bg-muted/20" />
      </div>

      {/* Tier 2 Skeleton: 2 side-by-side charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6 h-72 animate-pulse bg-muted/20" />
        <div className="rounded-2xl border border-border bg-card p-6 h-72 animate-pulse bg-muted/20" />
      </div>

      {/* Tier 3 Skeleton: Ledger & Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-border bg-card p-6 h-96 animate-pulse bg-muted/20" />
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 h-44 animate-pulse bg-muted/20" />
          <div className="rounded-2xl border border-border bg-card p-5 h-48 animate-pulse bg-muted/20" />
        </div>
      </div>
    </div>
  );
}
