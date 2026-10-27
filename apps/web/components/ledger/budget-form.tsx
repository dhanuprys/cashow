"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createBudgetAction, deleteBudgetAction, updateBudgetAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface BudgetFormCategory {
  id: string;
  name: string;
}

export interface BudgetFormValues {
  id: string;
  name: string;
  categoryId: string | null;
  amount: string;
  active: boolean;
}

export function BudgetForm({
  categories,
  budget,
}: {
  categories: BudgetFormCategory[];
  budget?: BudgetFormValues;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    budget === undefined ? createBudgetAction : updateBudgetAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {budget === undefined ? null : <input type="hidden" name="budgetId" value={budget.id} />}
      <input type="hidden" name="active" value={budget?.active === false ? "false" : "true"} />

      <div>
        <Label htmlFor={`budget-name-${budget?.id ?? "new"}`}>Nama anggaran</Label>
        <Input
          id={`budget-name-${budget?.id ?? "new"}`}
          name="name"
          defaultValue={budget?.name ?? ""}
          maxLength={80}
          placeholder="Contoh: Belanja bulanan"
          className="mt-2"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`budget-category-${budget?.id ?? "new"}`}>Kategori (opsional)</Label>
          <NativeSelect
            id={`budget-category-${budget?.id ?? "new"}`}
            name="categoryId"
            defaultValue={budget?.categoryId ?? ""}
            className="mt-2 w-full"
          >
            <NativeSelectOption value="">Semua pengeluaran</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`budget-amount-${budget?.id ?? "new"}`}>Batas</Label>
          <Input
            id={`budget-amount-${budget?.id ?? "new"}`}
            name="amount"
            defaultValue={budget?.amount ?? ""}
            inputMode="numeric"
            placeholder="3jt"
            className="mt-2"
            required
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Anggaran tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">
        {budget === undefined ? "Buat anggaran" : "Simpan anggaran"}
      </SubmitButton>
    </form>
  );
}

export function DeleteBudgetButton({ budgetId }: { budgetId: string }) {
  return (
    <form action={deleteBudgetAction}>
      <input type="hidden" name="budgetId" value={budgetId} />
      <button
        type="submit"
        className="text-xs text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          if (!window.confirm("Hapus anggaran ini?")) event.preventDefault();
        }}
      >
        Hapus
      </button>
    </form>
  );
}
