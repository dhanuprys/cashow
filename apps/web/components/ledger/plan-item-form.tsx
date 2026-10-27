"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="planId" value={planId} />
      {item === undefined ? null : <input type="hidden" name="itemId" value={item.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`item-label-${item?.id ?? "new"}`}>Nama tahap</Label>
          <Input
            id={`item-label-${item?.id ?? "new"}`}
            name="label"
            defaultValue={item?.label ?? ""}
            maxLength={120}
            placeholder="Contoh: DP, Termin 2, Pelunasan"
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label htmlFor={`item-amount-${item?.id ?? "new"}`}>Nilai yang diharapkan</Label>
          <Input
            id={`item-amount-${item?.id ?? "new"}`}
            name="expectedAmount"
            defaultValue={item?.expectedAmount ?? ""}
            inputMode="numeric"
            placeholder="5jt"
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label htmlFor={`item-due-${item?.id ?? "new"}`}>
            Jatuh tempo <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Input
            id={`item-due-${item?.id ?? "new"}`}
            name="dueOn"
            type="date"
            defaultValue={item?.dueOn ?? ""}
            className="mt-2"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor={`item-note-${item?.id ?? "new"}`}>
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Textarea
            id={`item-note-${item?.id ?? "new"}`}
            name="note"
            defaultValue={item?.note ?? ""}
            maxLength={1000}
            className="mt-2"
            placeholder="Detail singkat tahap ini"
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Tahap tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">{item === undefined ? "Tambah tahap" : "Simpan tahap"}</SubmitButton>
    </form>
  );
}
