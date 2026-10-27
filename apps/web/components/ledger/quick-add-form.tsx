"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { quickAddAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
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
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    quickAddAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    setAmount("");
    setNote("");
    setRequestId(crypto.randomUUID());
  }, [state]);

  const visibleCategories = categories.filter((category) => category.kind === type);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="clientRequestId" value={requestId} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-full bg-muted p-1">
          {(
            [
              { value: "EXPENSE", label: "Keluar" },
              { value: "INCOME", label: "Masuk" },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
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
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Tercatat ✓
          </span>
        ) : null}
      </div>

      <Input
        name="amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Jumlah — 35rb, 1,5jt"
        className="h-11 text-base"
        aria-label="Jumlah"
        required
      />

      <Input
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={200}
        placeholder="Catatan singkat"
        aria-label="Catatan"
      />

      <div className="flex gap-2">
        <NativeSelect
          name="categoryId"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="min-w-0 flex-1"
        >
          <NativeSelectOption value="">Tanpa kategori</NativeSelectOption>
          {visibleCategories.map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="accountId" defaultValue="" className="min-w-0 flex-1">
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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan…" : "Catat cepat"}
      </Button>
    </form>
  );
}
