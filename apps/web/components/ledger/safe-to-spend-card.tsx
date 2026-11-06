"use client";

import { formatMoney } from "@cashow/domain";
import type { SafeToSpend } from "@cashow/services";
import { ChevronRight, Clock, Sparkles, Target } from "lucide-react";
import Link from "next/link";
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

export interface SafeToSpendCardProps {
  safeToSpend: SafeToSpend;
  className?: string;
}

export function SafeToSpendCard({ safeToSpend, className }: SafeToSpendCardProps) {
  const [showBalance] = useBalanceVisibility();
  const isDeficit = safeToSpend.available < 0n;

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden transition-all",
        isDeficit
          ? "border-destructive/30 bg-destructive/[0.03]"
          : "border-primary/20 bg-primary/[0.03]",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              isDeficit ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold truncate">Batas Belanja Aman</CardTitle>
            <CardDescription className="text-xs truncate">
              Panduan batas belanja harian hingga akhir periode
            </CardDescription>
          </div>
        </div>

        <CardAction>
          <LinkButton
            href="/app/budgets"
            variant="ghost"
            size="xs"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>Anggaran</span>
            <ChevronRight className="size-3" aria-hidden="true" />
          </LinkButton>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 min-w-0">
        {/* Highlight Daily Allowance Box */}
        <div
          className={cn(
            "rounded-xl border p-3 flex flex-wrap items-baseline justify-between gap-2",
            isDeficit
              ? "border-destructive/20 bg-destructive/10"
              : "border-primary/20 bg-primary/10",
          )}
        >
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Batas Maksimal Hari Ini
            </span>
            <p
              className={cn(
                "text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight mt-0.5",
                isDeficit ? "text-destructive" : "text-primary",
              )}
            >
              {showBalance ? formatMoney(safeToSpend.daily) : "••••••••"}
              <span className="text-xs font-normal text-muted-foreground ml-1">/ hari</span>
            </p>
          </div>

          <Badge
            variant="secondary"
            className="gap-1 text-[11px] font-normal py-0.5 px-2 bg-background/80 shrink-0"
          >
            <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Sisa {safeToSpend.daysLeft} hari</span>
          </Badge>
        </div>

        {/* Breakdown of Safety Guardrails */}
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between text-[11px]">
            <span>Sisa dana bebas periode ini</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                isDeficit ? "text-destructive font-bold" : "text-foreground",
              )}
            >
              {showBalance ? formatMoney(safeToSpend.available) : "••••••••"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span>Tagihan berulang terjadwal</span>
            <span className="font-semibold tabular-nums text-foreground">
              {showBalance ? formatMoney(safeToSpend.upcoming) : "••••"}
            </span>
          </div>

          {safeToSpend.reserved > 0n && (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
              <Link
                href="/app/goals"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground group"
              >
                <Target
                  className="size-3 text-primary group-hover:scale-110 transition-transform"
                  aria-hidden="true"
                />
                <span className="underline-offset-2 group-hover:underline">
                  Dana target tabungan
                </span>
              </Link>
              <span className="font-semibold tabular-nums text-foreground">
                {showBalance ? formatMoney(safeToSpend.reserved) : "••••"}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
