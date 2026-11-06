"use client";

import { formatMoney } from "@cashow/domain";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Scale, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";
import { cn } from "@/lib/utils";

export interface DashboardStatStripProps {
  totalBalance: bigint;
  income: bigint;
  expense: bigint;
  net: bigint;
  transactionCount: number;
  activeAccountsCount: number;
  reservedForGoals?: bigint;
}

export function DashboardStatStrip({
  totalBalance,
  income,
  expense,
  net,
  transactionCount,
  activeAccountsCount,
  reservedForGoals,
}: DashboardStatStripProps) {
  const [showBalance, toggleShowBalance] = useBalanceVisibility();

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
      {/* Total Balance Card */}
      <Card size="sm" className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardDescription className="text-xs font-medium text-muted-foreground truncate">
            Total Saldo
          </CardDescription>
          <CardAction>
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
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Wallet className="size-4" aria-hidden="true" />
              </span>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0">
          <p
            className={cn(
              "text-xl font-semibold tabular-nums sm:text-2xl truncate",
              totalBalance < 0n ? "text-rose-700 dark:text-rose-400" : "text-foreground",
            )}
          >
            {showBalance ? formatMoney(totalBalance) : "••••••••"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {activeAccountsCount} akun
            {reservedForGoals !== undefined && reservedForGoals > 0n ? (
              <>
                {" · "}
                <Link
                  href="/app/goals"
                  className="hover:text-foreground underline-offset-2 hover:underline transition-colors"
                  title="Lihat target tabungan"
                >
                  {showBalance ? formatMoney(reservedForGoals) : "••••"} dicadangkan
                </Link>
              </>
            ) : (
              " aktif"
            )}
          </p>
        </CardContent>
      </Card>

      {/* Income Card */}
      <Card size="sm" className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardDescription className="text-xs font-medium text-muted-foreground truncate">
            Pemasukan
          </CardDescription>
          <CardAction>
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0">
              <ArrowDownLeft className="size-4" aria-hidden="true" />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0">
          <p className="text-xl font-semibold tabular-nums text-emerald-700 sm:text-2xl dark:text-emerald-400 truncate">
            {formatMoney(income)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            Total arus kas masuk bulan ini
          </p>
        </CardContent>
      </Card>

      {/* Expense Card */}
      <Card size="sm" className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardDescription className="text-xs font-medium text-muted-foreground truncate">
            Pengeluaran
          </CardDescription>
          <CardAction>
            <span className="grid size-7 place-items-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 shrink-0">
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0">
          <p className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl truncate">
            {formatMoney(expense)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {transactionCount} transaksi tercatat
          </p>
        </CardContent>
      </Card>

      {/* Net Cashflow Card */}
      <Card size="sm" className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardDescription className="text-xs font-medium text-muted-foreground truncate">
            Selisih Bersih
          </CardDescription>
          <CardAction>
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Scale className="size-4" aria-hidden="true" />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="min-w-0">
          <p
            className={cn(
              "text-xl font-semibold tabular-nums sm:text-2xl truncate",
              net < 0n ? "text-rose-700 dark:text-rose-400" : "text-foreground",
            )}
          >
            {formatMoney(net)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {net >= 0n ? "Surplus kas bulan ini" : "Pengeluaran melebihi pemasukan"}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
