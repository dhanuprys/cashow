"use client";

import { formatMoney } from "@cashow/domain";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Scale, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";
import { cn } from "@/lib/utils";

export interface DashboardStatStripProps {
  totalBalance: bigint;
  income: bigint;
  expense: bigint;
  net: bigint;
  transactionCount: number;
  activeAccountsCount: number;
}

export function DashboardStatStrip({
  totalBalance,
  income,
  expense,
  net,
  transactionCount,
  activeAccountsCount,
}: DashboardStatStripProps) {
  const [showBalance, toggleShowBalance] = useBalanceVisibility();

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Balance Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Saldo</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={toggleShowBalance}
              aria-label={showBalance ? "Sembunyikan saldo" : "Tampilkan saldo"}
              className="text-muted-foreground hover:text-foreground"
            >
              {showBalance ? (
                <EyeOff className="size-3.5" aria-hidden="true" />
              ) : (
                <Eye className="size-3.5" aria-hidden="true" />
              )}
            </Button>
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
          </div>
        </div>
        <p
          className={cn(
            "mt-2 text-xl font-semibold tabular-nums sm:text-2xl",
            totalBalance < 0n ? "text-rose-700 dark:text-rose-400" : "text-foreground",
          )}
        >
          {showBalance ? formatMoney(totalBalance) : "••••••••"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {activeAccountsCount} akun dompet &amp; rekening aktif
        </p>
      </Card>

      {/* Income Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Pemasukan</span>
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <ArrowDownLeft className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-2 text-xl font-semibold tabular-nums text-emerald-700 sm:text-2xl dark:text-emerald-400">
          {formatMoney(income)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">Total arus kas masuk bulan ini</p>
      </Card>

      {/* Expense Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Pengeluaran</span>
          <span className="grid size-7 place-items-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400">
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-2 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
          {formatMoney(expense)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {transactionCount} transaksi tercatat
        </p>
      </Card>

      {/* Net Cashflow Card */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Selisih Bersih</span>
          <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Scale className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p
          className={cn(
            "mt-2 text-xl font-semibold tabular-nums sm:text-2xl",
            net < 0n ? "text-rose-700 dark:text-rose-400" : "text-foreground",
          )}
        >
          {formatMoney(net)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {net >= 0n ? "Surplus saldo bulan ini" : "Defisit dari pengeluaran"}
        </p>
      </Card>
    </section>
  );
}
