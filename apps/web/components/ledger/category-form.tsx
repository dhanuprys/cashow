"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface CategoryFormValues {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  parentId: string | null;
}

export interface ParentOption {
  id: string;
  name: string;
  parentName: string | null;
  kind: "INCOME" | "EXPENSE";
}

export function CategoryForm({
  category,
  parents,
  defaultKind = "EXPENSE",
}: {
  category?: CategoryFormValues;
  parents: ParentOption[];
  defaultKind?: "INCOME" | "EXPENSE";
}) {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(category?.kind ?? defaultKind);
  const [state, formAction] = useActionState<ActionState, FormData>(
    category === undefined ? createCategoryAction : updateCategoryAction,
    initialActionState,
  );

  const prefix = category?.id ?? "new";
  const visibleParents = parents.filter(
    (parent) => parent.id !== category?.id && parent.kind === kind,
  );

  return (
    <form action={formAction} className="space-y-4">
      {category === undefined ? null : (
        <input type="hidden" name="categoryId" value={category.id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`category-name-${prefix}`}>Nama kategori</Label>
          <Input
            id={`category-name-${prefix}`}
            name="name"
            defaultValue={category?.name ?? ""}
            maxLength={80}
            placeholder="Contoh: Makan, Transportasi"
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label htmlFor={`category-kind-${prefix}`}>Jenis</Label>
          {category === undefined ? (
            <NativeSelect
              id={`category-kind-${prefix}`}
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as "INCOME" | "EXPENSE")}
              className="mt-2 w-full"
            >
              <NativeSelectOption value="EXPENSE">Pengeluaran</NativeSelectOption>
              <NativeSelectOption value="INCOME">Pemasukan</NativeSelectOption>
            </NativeSelect>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {category.kind === "INCOME" ? "Pemasukan" : "Pengeluaran"} · jenis tidak bisa diubah
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor={`category-parent-${prefix}`}>
            Induk <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <NativeSelect
            id={`category-parent-${prefix}`}
            name="parentId"
            defaultValue={category?.parentId ?? ""}
            className="mt-2 w-full"
          >
            <NativeSelectOption value="">Tanpa induk</NativeSelectOption>
            {visibleParents.map((parent) => (
              <NativeSelectOption key={parent.id} value={parent.id}>
                {parent.parentName === null ? parent.name : `${parent.parentName} · ${parent.name}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Kategori tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">
        {category === undefined ? "Tambah kategori" : "Simpan kategori"}
      </SubmitButton>
    </form>
  );
}
