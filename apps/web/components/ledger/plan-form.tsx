"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <form action={formAction} className="space-y-4">
      {plan === undefined ? null : <input type="hidden" name="planId" value={plan.id} />}

      <div>
        <Label htmlFor={`plan-name-${plan?.id ?? "new"}`}>Nama rencana</Label>
        <Input
          id={`plan-name-${plan?.id ?? "new"}`}
          name="name"
          defaultValue={plan?.name ?? ""}
          maxLength={120}
          placeholder="Contoh: Proyek renovasi"
          className="mt-2"
          required
        />
      </div>

      <div>
        <Label htmlFor={`plan-description-${plan?.id ?? "new"}`}>
          Keterangan <span className="font-normal text-muted-foreground">(opsional)</span>
        </Label>
        <Textarea
          id={`plan-description-${plan?.id ?? "new"}`}
          name="description"
          defaultValue={plan?.description ?? ""}
          maxLength={1000}
          placeholder="Siapa yang membayar dan untuk apa"
          className="mt-2"
        />
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Rencana tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">
        {plan === undefined ? "Buat rencana" : "Simpan rencana"}
      </SubmitButton>
    </form>
  );
}
