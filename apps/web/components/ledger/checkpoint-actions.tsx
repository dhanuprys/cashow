"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockCheckpointAction, verifyCheckpointAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

/** Verify a balanced snapshot, turning it into a locking checkpoint. */
export function VerifyCheckpointButton({ snapshotId }: { snapshotId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    verifyCheckpointAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="snapshotId" value={snapshotId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Memverifikasi…">
        Verifikasi checkpoint
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-xs text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Unlocking is deliberate and audited: the reason is stored with the
 * checkpoint so the history explains why a period reopened.
 */
export function UnlockCheckpointForm({ checkpointId }: { checkpointId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    unlockCheckpointAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="checkpointId" value={checkpointId} />
      <div>
        <Label htmlFor={`unlock-reason-${checkpointId}`} className="text-xs">
          Alasan membuka kunci
        </Label>
        <Input
          id={`unlock-reason-${checkpointId}`}
          name="reason"
          maxLength={500}
          placeholder="Contoh: koreksi tanggal transfer"
          className="mt-1.5"
          required
        />
      </div>
      <SubmitButton size="sm" variant="outline" pendingLabel="Membuka…">
        Buka kunci
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-xs text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
