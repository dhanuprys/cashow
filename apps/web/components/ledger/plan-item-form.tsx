"use client";

import { useActionState, useEffect } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { DatePicker } from "@/components/ledger/date-picker";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { createPlanItemAction, updatePlanItemAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface PlanItemFormValues {
  id: string;
  label: string;
  expectedAmount: string;
  dueOn: string | null;
  note: string | null;
}

/** Add a step to a plan, or edit one in place (totals re-derive on read). */
export function PlanItemForm({ planId, item }: { planId: string; item?: PlanItemFormValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    item === undefined ? createPlanItemAction : updatePlanItemAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: "Tersimpan", description: state.message ?? "Perubahan tersimpan." });
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="planId" value={planId} />
      {item === undefined ? null : <input type="hidden" name="itemId" value={item.id} />}

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`item-label-${item?.id ?? "new"}`}>Nama tahap</FieldLabel>
          <Input
            id={`item-label-${item?.id ?? "new"}`}
            name="label"
            defaultValue={item?.label ?? ""}
            maxLength={120}
            placeholder="Contoh: DP, Termin 2, Pelunasan"
            className="mt-2"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`item-amount-${item?.id ?? "new"}`}>
            Nilai yang diharapkan
          </FieldLabel>
          <CurrencyInput
            id={`item-amount-${item?.id ?? "new"}`}
            name="expectedAmount"
            defaultValue={item?.expectedAmount ?? ""}
            placeholder="5jt atau 5.000.000"
            className="mt-2"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`item-due-${item?.id ?? "new"}`}>
            Jatuh tempo <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <DatePicker
            id={`item-due-${item?.id ?? "new"}`}
            name="dueOn"
            defaultValue={item?.dueOn ?? ""}
            ariaLabel="Jatuh tempo"
            className="mt-2"
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`item-note-${item?.id ?? "new"}`}>
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id={`item-note-${item?.id ?? "new"}`}
            name="note"
            defaultValue={item?.note ?? ""}
            maxLength={1000}
            className="mt-2"
            placeholder="Detail singkat tahap ini"
          />
        </Field>
      </FieldGroup>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Tahap tersimpan.</p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton size="sm" className="w-full sm:w-auto">
          {item === undefined ? "Tambah tahap" : "Simpan tahap"}
        </SubmitButton>
      </div>
    </form>
  );
}
