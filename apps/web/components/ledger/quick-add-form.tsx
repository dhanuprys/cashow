"use client";

import { formatMoney, parseMoney } from "@cashow/domain";
import { useActionState, useEffect, useMemo, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { quickAddAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { useClientId } from "@/lib/use-client-id";
import { cn } from "@/lib/utils";

export interface QuickAddAccount {
  id: string;
  name: string;
}

export interface QuickAddCategory {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
}

/**
 * The one-screen entry point: type, amount, note. Account defaults to the
 * first live account, so a receipt can be captured in a few taps.
 */
export function QuickAddForm({
  accounts,
  categories,
}: {
  accounts: QuickAddAccount[];
  categories: QuickAddCategory[];
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [requestId, regenerateRequestId] = useClientId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    quickAddAction,
    initialActionState,
  );

  const parsedAmount = useMemo(() => {
    if (!amount.trim()) return null;
    return parseMoney(amount);
  }, [amount]);

  useEffect(() => {
    if (state.status !== "success") return;
    setAmount("");
    setNote("");
    regenerateRequestId();
    toast.add({ title: "Tercatat", description: state.message ?? "Transaksi tersimpan." });
  }, [state, regenerateRequestId]);

  const visibleCategories = categories.filter((category) => category.kind === type);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="clientRequestId" value={requestId} />
      <div className="flex items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label="Tipe transaksi"
          className="flex rounded-full bg-muted p-1"
        >
          {(
            [
              { value: "EXPENSE", label: "Keluar" },
              { value: "INCOME", label: "Masuk" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-3 sm:py-1 sm:text-xs",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70",
                type === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <input
                className="sr-only"
                type="radio"
                name="type"
                value={option.value}
                checked={type === option.value}
                onChange={() => {
                  setType(option.value);
                  setCategoryId("");
                }}
              />
              {option.label}
            </label>
          ))}
        </div>
        {state.status === "success" ? (
          <span
            role="status"
            aria-live="polite"
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
          >
            Tercatat ✓
          </span>
        ) : null}
      </div>

      <div>
        <CurrencyInput
          name="amount"
          value={amount}
          onValueChange={setAmount}
          placeholder="Nominal (cth. 50rb, 1.5jt, atau 25000)"
          className="h-11 text-base"
          aria-label="Jumlah"
          presets={["10000", "20000", "50000", "100000"]}
          required
        />
        {parsedAmount !== null && parsedAmount > 0n ? (
          <p className="mt-1 px-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            = {formatMoney(parsedAmount)}
          </p>
        ) : amount.trim() !== "" && parsedAmount === null ? (
          <p className="mt-1 px-1 text-xs text-muted-foreground">
            Format didukung: 50k, 35rb, 1.5jt, atau 50000
          </p>
        ) : null}
      </div>

      <Input
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={200}
        placeholder="Catatan singkat"
        aria-label="Catatan"
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <NativeSelect
          name="categoryId"
          aria-label="Kategori"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">Tanpa kategori</NativeSelectOption>
          {visibleCategories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="accountId" aria-label="Akun" defaultValue="" className="w-full">
          <NativeSelectOption value="">Akun utama</NativeSelectOption>
          {accounts.map((account) => (
            <NativeSelectOption key={account.id} value={account.id}>
              {account.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {state.status === "error" ? (
        <p className="text-xs text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan Transaksi"}
      </Button>
    </form>
  );
}
