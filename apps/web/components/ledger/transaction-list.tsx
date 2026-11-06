import { formatMoney } from "@cashow/domain";
import type { TransactionSummary } from "@cashow/services";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Paperclip } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { displayLocalDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A compact, linkable row used by the dashboard and the transaction list. */
export function TransactionList({
  items,
  empty,
}: {
  items: TransactionSummary[];
  empty: React.ReactNode;
}) {
  if (items.length === 0) return <>{empty}</>;

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const income = item.type === "INCOME";
        const transfer = item.type === "TRANSFER";
        const title = transfer
          ? (item.note ?? `Transfer ke ${item.destinationAccountName ?? "akun lain"}`)
          : (item.merchant ??
            item.counterparty ??
            item.note ??
            item.categoryName ??
            (income ? "Pemasukan" : "Pengeluaran"));

        return (
          <li key={item.id}>
            <Link
              href={`/app/transactions/${item.id}`}
              className={cn(
                "group flex items-center justify-between gap-3 py-3 px-2 sm:px-3 rounded-xl transition-all duration-150 hover:bg-muted/60 sm:py-3.5 sm:gap-4",
                item.deletedAt !== null && "opacity-60 bg-muted/20",
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105 shadow-2xs",
                    income
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : transfer
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
                  )}
                >
                  {income ? (
                    <ArrowDownLeft className="size-4" />
                  ) : transfer ? (
                    <ArrowLeftRight className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
                      {title}
                    </p>
                    {item.deletedAt !== null && (
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5 shrink-0">
                        Dihapus
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="shrink-0 tabular-nums">
                      {displayLocalDate(item.occurredOn)}
                    </span>
                    {transfer ? (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate">
                          {item.accountName} → {item.destinationAccountName ?? "—"}
                        </span>
                      </>
                    ) : (
                      <>
                        {item.categoryName && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
                              {item.categoryName}
                            </span>
                          </>
                        )}
                        {item.accountName && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="truncate">{item.accountName}</span>
                          </>
                        )}
                      </>
                    )}
                    {item.planName && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate text-primary font-medium">{item.planName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right pl-3">
                <p
                  className={cn(
                    "text-sm sm:text-base font-semibold tabular-nums tracking-tight",
                    income
                      ? "text-emerald-700 dark:text-emerald-400"
                      : transfer
                        ? "text-sky-600 dark:text-sky-400"
                        : "text-foreground",
                  )}
                >
                  {income ? "+" : transfer ? "" : "−"}
                  {formatMoney(item.amount)}
                </p>
                {item.attachmentCount > 0 && (
                  <div className="mt-0.5 flex items-center justify-end text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded">
                      <Paperclip className="size-3" aria-hidden="true" />
                      <span>{item.attachmentCount}</span>
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
