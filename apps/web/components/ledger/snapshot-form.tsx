"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSnapshotAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

/**
 * Record the balance the bank actually states. The expected balance and gap
 * are derived on read, so the form never asks for them.
 */
export function SnapshotForm({
  accountId,
  defaultRecordedAtLocal,
}: {
  accountId: string;
  defaultRecordedAtLocal: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createSnapshotAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="accountId" value={accountId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`snapshot-amount-${accountId}`}>Saldo menurut bank</Label>
          <Input
            id={`snapshot-amount-${accountId}`}
            name="amount"
            inputMode="numeric"
            placeholder="1.500.000"
            className="mt-2"
            required
          />
        </div>
        <div>
          <Label htmlFor={`snapshot-at-${accountId}`}>Per waktu</Label>
          <Input
            id={`snapshot-at-${accountId}`}
            name="recordedAtLocal"
            type="datetime-local"
            defaultValue={defaultRecordedAtLocal}
            className="mt-2"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`snapshot-note-${accountId}`}>
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Textarea
            id={`snapshot-note-${accountId}`}
            name="note"
            maxLength={500}
            placeholder="Contoh: cek mutasi akhir bulan"
            className="mt-2"
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Snapshot tersimpan.</p>
      ) : null}

      <SubmitButton size="sm" variant="outline">
        Simpan snapshot
      </SubmitButton>
    </form>
  );
}
