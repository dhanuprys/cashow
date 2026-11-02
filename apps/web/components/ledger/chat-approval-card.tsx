"use client";

import { formatMoney, parseMoney } from "@cashow/domain";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The part shape we need, kept structural so the card does not depend on the
 * AI SDK's generic tool typing. Static tools carry their name in `type`
 * (`tool-createTransaction`).
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
