"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
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
  period?: "MONTHLY" | "WEEKLY" | "CUSTOM";
  startDate?: string | null;
  endDate?: string | null;
  active: boolean;
}

export function BudgetForm({
  categories,
  budget,
  onSuccess,
}: {
  categories: BudgetFormCategory[];
  budget?: BudgetFormValues;
  onSuccess?: () => void;
}) {
  const [period, setPeriod] = useState<"MONTHLY" | "WEEKLY" | "CUSTOM">(
    budget?.period ?? "MONTHLY",
  );
  const [startDate, setStartDate] = useState(budget?.startDate ?? "");
  const [endDate, setEndDate] = useState(budget?.endDate ?? "");

  const [state, formAction] = useActionState<ActionState, FormData>(
    budget === undefined ? createBudgetAction : updateBudgetAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({
      title: budget === undefined ? "Anggaran Dibuat" : "Anggaran Diperbarui",
      description: state.message ?? "Perubahan tersimpan.",
    });
    onSuccess?.();
  }, [state, budget, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {budget === undefined ? null : <input type="hidden" name="budgetId" value={budget.id} />}
      <input type="hidden" name="active" value={budget?.active === false ? "false" : "true"} />

      <Field>
        <FieldLabel htmlFor={`budget-name-${budget?.id ?? "new"}`}>Nama anggaran</FieldLabel>
        <Input
          id={`budget-name-${budget?.id ?? "new"}`}
          name="name"
          defaultValue={budget?.name ?? ""}
          maxLength={80}
          placeholder="Contoh: Belanja bulanan / Liburan akhir tahun"
          className="mt-2"
          required
        />
      </Field>

      {/* Siklus Periode Anggaran */}
      <Field>
        <FieldLabel htmlFor={`budget-period-${budget?.id ?? "new"}`}>Periode Anggaran</FieldLabel>
        <NativeSelect
          id={`budget-period-${budget?.id ?? "new"}`}
          name="period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as "MONTHLY" | "WEEKLY" | "CUSTOM")}
          className="mt-2 w-full"
        >
          <NativeSelectOption value="MONTHLY">Bulanan (Siklus Gajian)</NativeSelectOption>
          <NativeSelectOption value="WEEKLY">Mingguan (Tiap Pekan)</NativeSelectOption>
          <NativeSelectOption value="CUSTOM">Rentang Khusus (Proyek / Event)</NativeSelectOption>
        </NativeSelect>
      </Field>

      {/* Custom Date Range Inputs */}
      {period === "CUSTOM" && (
        <FieldGroup className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border/80 bg-muted/20 p-3 sm:p-4">
          <Field>
            <FieldLabel htmlFor={`budget-start-${budget?.id ?? "new"}`} className="text-xs">
              Tanggal Mulai
            </FieldLabel>
            <Input
              id={`budget-start-${budget?.id ?? "new"}`}
              type="date"
              name="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
              required={period === "CUSTOM"}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`budget-end-${budget?.id ?? "new"}`} className="text-xs">
              Tanggal Selesai
            </FieldLabel>
            <Input
              id={`budget-end-${budget?.id ?? "new"}`}
              type="date"
              name="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1.5"
              required={period === "CUSTOM"}
            />
          </Field>
        </FieldGroup>
      )}

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`budget-category-${budget?.id ?? "new"}`}>
            Kategori (opsional)
          </FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`budget-amount-${budget?.id ?? "new"}`}>Batas</FieldLabel>
          <CurrencyInput
            id={`budget-amount-${budget?.id ?? "new"}`}
            name="amount"
            defaultValue={budget?.amount ?? ""}
            placeholder="3jt atau 3.000.000"
            className="mt-2"
            presets={["500000", "1000000", "2000000", "5000000", "10000000"]}
            required
          />
        </Field>
      </FieldGroup>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Anggaran tersimpan.</p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton size="sm" className="w-full sm:w-auto">
          {budget === undefined ? "Buat anggaran" : "Simpan anggaran"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeleteBudgetButton({ budgetId }: { budgetId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  return (
    <>
      <form ref={formRef} action={deleteBudgetAction}>
        <input type="hidden" name="budgetId" value={budgetId} />
      </form>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="min-h-9 text-xs text-muted-foreground hover:text-destructive"
            />
          }
        >
          Hapus
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus anggaran ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Anggaran yang dihapus tidak lagi dipakai untuk menghitung sisa. Riwayat pengeluaran
              tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setPending(true);
                formRef.current?.requestSubmit();
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function EditBudgetDialog({
  budget,
  categories,
}: {
  budget: BudgetFormValues;
  categories: BudgetFormCategory[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <Pencil className="size-3" aria-hidden="true" />
        <span>Ubah</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-lg sm:rounded-xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Pencil className="size-4 text-primary" aria-hidden="true" />
              <span>Ubah Anggaran</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sesuaikan nama, target kategori, atau batas nominal pengeluaran.
            </DialogDescription>
          </DialogHeader>

          <BudgetForm
            key={budget.id}
            budget={budget}
            categories={categories}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
