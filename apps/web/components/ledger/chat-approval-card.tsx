"use client";

import { formatMoney, parseMoney } from "@cashow/domain";
import { ArrowDownLeft, ArrowUpRight, Check, Layers, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The part shape we need, kept structural so the card does not depend on the
 * AI SDK's generic tool typing. Static tools carry their name in `type`
 * (`tool-createTransaction`, `tool-createBatchTransactions`).
 */
export interface ApprovalRequestPart {
  type: string;
  toolCallId: string;
  state: "approval-requested";
  input: unknown;
  approval: { id: string };
}

interface ChatApprovalCardProps {
  part: ApprovalRequestPart;
  disabled?: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}

interface DetailRow {
  label: string;
  value: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readText(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readMoney(input: Record<string, unknown>, key: string): string | null {
  const raw = readText(input, key);
  if (raw === null) return null;
  const parsed = parseMoney(raw);
  return parsed === null ? raw : formatMoney(parsed);
}

function toolNameOf(part: ApprovalRequestPart): string {
  if (part.type === "dynamic-tool") {
    const name = (part as { toolName?: unknown }).toolName;
    return typeof name === "string" ? name : part.type;
  }
  return part.type.startsWith("tool-") ? part.type.slice(5) : part.type;
}

export function ChatApprovalCard({ part, disabled = false, onRespond }: ChatApprovalCardProps) {
  const tool = toolNameOf(part);
  const input = asRecord(part.input);
  const isTransfer = tool === "createTransfer";
  const isBatch = tool === "createBatchTransactions";

  // Batch transactions view
  if (isBatch) {
    const rawList = Array.isArray(input.transactions)
      ? (input.transactions as Record<string, unknown>[])
      : [];
    const defaultAccount = readText(input, "accountName");

    let totalExpense = 0n;
    let totalIncome = 0n;

    for (const item of rawList) {
      const rawAmt = readText(item, "amount");
      const parsed = rawAmt ? parseMoney(rawAmt) : null;
      const amt = parsed ?? 0n;
      if (item.type === "INCOME") {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
    }

    return (
      <div className="rounded-xl border border-border/70 bg-card/90 p-3.5 shadow-2xs space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0">
            <Layers className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground">
                Konfirmasi {rawList.length} Transaksi Sekaligus
              </p>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                Batch
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {defaultAccount ? `Rekening: ${defaultAccount} · ` : ""}
              Periksa rincian sebelum dimasukkan ke buku kas.
            </p>
          </div>
        </div>

        {/* Totals strip */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          {totalExpense > 0n && (
            <div className="flex items-center gap-1.5">
              <span className="text-rose-600 dark:text-rose-400 font-medium text-[11px] flex items-center gap-0.5">
                <ArrowDownLeft className="size-3" />
                Total Keluar:
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(totalExpense)}
              </span>
            </div>
          )}
          {totalIncome > 0n && (
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px] flex items-center gap-0.5">
                <ArrowUpRight className="size-3" />
                Total Masuk:
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMoney(totalIncome)}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable list of items */}
        {rawList.length > 0 && (
          <div className="max-h-56 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/15 text-xs">
            {rawList.map((item) => {
              const type = item.type === "INCOME" ? "INCOME" : "EXPENSE";
              const note = readText(item, "note") ?? readText(item, "merchant") ?? "Tanpa catatan";
              const category = readText(item, "categoryName");
              const dateRaw = readText(item, "occurredAtLocal") ?? "";
              const dateDisplay = dateRaw.split("T")[0] ?? dateRaw;
              const account = readText(item, "accountName") ?? defaultAccount;

              return (
                <div
                  key={`batch-item-${dateDisplay}-${type}-${note}-${readText(item, "amount") ?? ""}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {dateDisplay}
                      </span>
                      <span className="font-medium text-foreground truncate">{note}</span>
                      {category && (
                        <span className="text-[10px] rounded bg-muted/60 px-1 py-0.2 text-muted-foreground truncate shrink-0">
                          {category}
                        </span>
                      )}
                    </div>
                    {account && account !== defaultAccount && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Akun: {account}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-semibold tabular-nums text-xs ${
                        type === "INCOME"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {type === "INCOME" ? "+" : "-"}
                      {readMoney(item, "amount")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onRespond(part.approval.id, false)}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <X className="size-3.5" aria-hidden="true" />
            Batalkan
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => onRespond(part.approval.id, true)}
            className="h-8 gap-1.5 px-3.5 text-xs"
          >
            <Check className="size-3.5" aria-hidden="true" />
            Setujui Semua ({rawList.length} Transaksi)
          </Button>
        </div>
      </div>
    );
  }

  // Single transaction or transfer view
  const rows: DetailRow[] = [];
  const push = (label: string, value: string | null) => {
    if (value !== null) rows.push({ label, value });
  };

  if (isTransfer) {
    push("Nominal", readMoney(input, "amount"));
    push("Dari", readText(input, "fromAccountName"));
    push("Ke", readText(input, "toAccountName"));
    const fee = readMoney(input, "feeAmount");
    if (fee !== null && fee !== "Rp0") push("Biaya", fee);
  } else {
    const type = readText(input, "type");
    if (type !== null) {
      push("Jenis", type === "INCOME" ? "Pemasukan" : "Pengeluaran");
    }
    push("Nominal", readMoney(input, "amount"));
    push("Akun", readText(input, "accountName"));
    push("Kategori", readText(input, "categoryName"));
  }
  push("Tanggal", readText(input, "occurredAtLocal"));
  push("Catatan", readText(input, "note") ?? readText(input, "merchant"));

  const title = isTransfer ? "Konfirmasi transfer" : "Konfirmasi transaksi";

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-3 shadow-2xs">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Periksa detail ini sebelum dicatat ke buku kas.
            </p>
          </div>

          {rows.length > 0 && (
            <dl className="space-y-1 text-[11px]">
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onRespond(part.approval.id, false)}
              className="h-7 gap-1 px-2.5 text-[11px]"
            >
              <X className="size-3" aria-hidden="true" />
              Batalkan
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => onRespond(part.approval.id, true)}
              className="h-7 gap-1 px-2.5 text-[11px]"
            >
              <Check className="size-3" aria-hidden="true" />
              Setujui &amp; catat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
