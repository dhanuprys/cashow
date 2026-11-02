"use client";

import { useActionState, useEffect } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { createSnapshotAction, updateSnapshotAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface SnapshotFormValues {
  id: string;
  amount: string;
  recordedAtLocal: string;
  note: string | null;
}

/**
 * Record or edit the balance the bank actually states. The expected balance and gap
 * are derived on read, so the form never asks for them.
 */
export function SnapshotForm({
  accountId,
  defaultRecordedAtLocal,
  snapshot,
}: {
  accountId: string;
  defaultRecordedAtLocal: string;
  snapshot?: SnapshotFormValues;
}) {
  const isEditing = snapshot !== undefined;
  const [state, formAction] = useActionState<ActionState, FormData>(
    isEditing ? updateSnapshotAction : createSnapshotAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({
      title: "Tersimpan",
      description: state.message ?? (isEditing ? "Snapshot diperbarui." : "Snapshot tersimpan."),
    });
  }, [state, isEditing]);

  return (
    <form action={formAction} className="space-y-3">
      {isEditing ? (
        <input type="hidden" name="snapshotId" value={snapshot.id} />
      ) : (
        <input type="hidden" name="accountId" value={accountId} />
      )}

      <FieldGroup className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`snapshot-amount-${snapshot?.id ?? accountId}`}>
            Saldo menurut bank
          </FieldLabel>
          <CurrencyInput
            id={`snapshot-amount-${snapshot?.id ?? accountId}`}
            name="amount"
            defaultValue={snapshot?.amount ?? ""}
            placeholder="1.500.000"
            className="mt-2"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`snapshot-at-${snapshot?.id ?? accountId}`}>Per waktu</FieldLabel>
          <Input
            id={`snapshot-at-${snapshot?.id ?? accountId}`}
            name="recordedAtLocal"
            type="datetime-local"
            defaultValue={snapshot?.recordedAtLocal ?? defaultRecordedAtLocal}
            className="mt-2"
            required
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`snapshot-note-${snapshot?.id ?? accountId}`}>
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id={`snapshot-note-${snapshot?.id ?? accountId}`}
            name="note"
            maxLength={500}
            defaultValue={snapshot?.note ?? ""}
            placeholder="Contoh: cek mutasi akhir bulan"
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
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {isEditing ? "Snapshot diperbarui." : "Snapshot tersimpan."}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton size="sm" variant="outline" className="w-full sm:w-auto">
          {isEditing ? "Simpan perubahan" : "Simpan snapshot"}
        </SubmitButton>
      </div>
    </form>
  );
}
