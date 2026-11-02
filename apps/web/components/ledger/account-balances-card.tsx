"use client";

import { formatMoney } from "@cashow/domain";
import { ChevronRight, Eye, EyeOff, Wallet } from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/ledger/link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";
import { cn } from "@/lib/utils";

export interface AccountBalanceItem {
  id: string;
  name: string;
  balance: bigint;
  archivedAt: Date | string | null;
}

export function AccountBalancesCard({ accounts }: { accounts: AccountBalanceItem[] }) {
  const [showBalance, toggleShowBalance] = useBalanceVisibility();

  const liveAccounts = accounts.filter((account) => account.archivedAt === null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle className="text-base font-semibold">Saldo per Akun</CardTitle>
              <CardDescription className="text-xs">
                {liveAccounts.length} akun aktif
              </CardDescription>
            </div>
          </div>
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
            <LinkButton href="/app/accounts" variant="ghost" size="sm" className="text-xs">
              Kelola
            </LinkButton>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5 pt-0">
        {accounts.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Belum ada akun.</p>
        ) : (
          <div className="space-y-1">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/app/transactions?accountId=${account.id}`}
                className="group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium group-hover:text-primary">
                    {account.name}
                  </span>
                  {account.archivedAt !== null && (
                    <Badge variant="secondary" className="shrink-0 py-0 text-[10px]">
                      Arsip
                    </Badge>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      account.balance < 0n ? "text-rose-700 dark:text-rose-400" : "text-foreground",
                    )}
                  >
                    {showBalance ? formatMoney(account.balance) : "••••••"}
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
