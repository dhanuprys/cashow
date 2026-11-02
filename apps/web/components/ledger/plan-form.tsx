"use client";

import { useActionState, useEffect } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { createPlanAction, updatePlanAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface PlanFormValues {
  id: string;
  name: string;
  description: string | null;
}

/** Create a plan (items are added on its detail page) or rename one. */
export function PlanForm({ plan }: { plan?: PlanFormValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    plan === undefined ? createPlanAction : updatePlanAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: "Tersimpan", description: state.message ?? "Perubahan tersimpan." });
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {plan === undefined ? null : <input type="hidden" name="planId" value={plan.id} />}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`plan-name-${plan?.id ?? "new"}`}>Nama rencana</FieldLabel>
          <Input
            id={`plan-name-${plan?.id ?? "new"}`}
            name="name"
            defaultValue={plan?.name ?? ""}
            maxLength={120}
            placeholder="Contoh: Proyek renovasi"
            className="mt-2"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`plan-description-${plan?.id ?? "new"}`}>
            Keterangan <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id={`plan-description-${plan?.id ?? "new"}`}
            name="description"
            defaultValue={plan?.description ?? ""}
            maxLength={1000}
            placeholder="Siapa yang membayar dan untuk apa"
            className="mt-2"
          />
        </Field>
      </FieldGroup>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Rencana tersimpan.</p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton size="sm" className="w-full sm:w-auto">
          {plan === undefined ? "Buat rencana" : "Simpan rencana"}
        </SubmitButton>
      </div>
    </form>
  );
}
