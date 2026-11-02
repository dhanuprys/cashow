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
              className="group flex items-center gap-3.5 py-3 transition-colors hover:bg-muted/40 sm:py-3.5"
            >
              <div
                aria-hidden="true"
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{title}</p>
                <p
                  className="mt-0.5 truncate text-xs text-muted-foreground"
                  title={`${displayLocalDate(item.occurredOn)}${
                    transfer
                      ? ` · ${item.accountName} → ${item.destinationAccountName ?? "—"}`
                      : item.categoryName === null
                        ? ""
                        : ` · ${item.categoryName}`
                  }${transfer ? "" : item.accountName === "" ? "" : ` · ${item.accountName}`}${
                    item.planName === null ? "" : ` · ${item.planName}`
                  }`}
                >
                  {displayLocalDate(item.occurredOn)}
                  {transfer
                    ? ` · ${item.accountName} → ${item.destinationAccountName ?? "—"}`
                    : item.categoryName === null
                      ? ""
                      : ` · ${item.categoryName}`}
                  {transfer ? "" : item.accountName === "" ? "" : ` · ${item.accountName}`}
                  {item.planName === null ? "" : ` · ${item.planName}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    income ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                  )}
                >
                  {income ? "+" : transfer ? "" : "−"}
                  {formatMoney(item.amount)}
                </p>
                <p className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
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
