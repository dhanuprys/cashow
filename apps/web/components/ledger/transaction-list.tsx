import { formatMoney } from "@cashow/domain";
import type { TransactionSummary } from "@cashow/services";
import { Paperclip } from "lucide-react";
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
        const title =
          item.merchant ??
          item.counterparty ??
          item.note ??
          item.categoryName ??
          (income ? "Pemasukan" : "Pengeluaran");

        return (
          <li key={item.id}>
            <Link
              href={`/app/transactions/${item.id}`}
              className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-2 shrink-0 rounded-full",
                  income ? "bg-emerald-500" : "bg-rose-500",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {displayLocalDate(item.occurredOn)}
                  {item.categoryName === null ? "" : ` · ${item.categoryName}`}
                  {item.accountName === "" ? "" : ` · ${item.accountName}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    income ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                  )}
                >
                  {income ? "+" : "−"}
                  {formatMoney(item.amount)}
                </p>
                <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  {item.attachmentCount > 0 ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Paperclip className="size-3" aria-hidden="true" />
                      {item.attachmentCount}
                    </span>
                  ) : null}
                  {item.deletedAt === null ? null : <Badge variant="secondary">Dihapus</Badge>}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
