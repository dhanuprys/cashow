"use client";

import { formatMoney } from "@cashow/domain";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmRecurringDraftAction,
  createRecurringAction,
  deleteRecurringAction,
  runRecurringAction,
  skipRecurringDraftAction,
  updateRecurringAction,
} from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface RecurringFormAccount {
  id: string;
  name: string;
}

export interface RecurringFormCategory {
  id: string;
  name: string;
}

export interface RecurringFormValues {
  id: string;
  type: string;
  amount: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  merchant: string | null;
  counterparty: string | null;
  note: string | null;
  frequency: string;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
}

export function RecurringForm({
  accounts,
  categories,
  template,
}: {
  accounts: RecurringFormAccount[];
  categories: RecurringFormCategory[];
  template?: RecurringFormValues;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    template === undefined ? createRecurringAction : updateRecurringAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {template === undefined ? null : (
        <input type="hidden" name="recurringId" value={template.id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`rec-type-${template?.id ?? "new"}`}>Jenis</Label>
          <NativeSelect
            id={`rec-type-${template?.id ?? "new"}`}
            name="type"
            defaultValue={template?.type ?? "EXPENSE"}
            className="mt-2 w-full"
            required
          >
            <NativeSelectOption value="EXPENSE">Pengeluaran</NativeSelectOption>
            <NativeSelectOption value="INCOME">Pemasukan</NativeSelectOption>
            <NativeSelectOption value="TRANSFER">Transfer</NativeSelectOption>
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`rec-amount-${template?.id ?? "new"}`}>Jumlah</Label>
          <Input
            id={`rec-amount-${template?.id ?? "new"}`}
            name="amount"
            defaultValue={template?.amount ?? ""}
            inputMode="numeric"
            placeholder="500rb"
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label htmlFor={`rec-account-${template?.id ?? "new"}`}>Akun asal</Label>
          <NativeSelect
            id={`rec-account-${template?.id ?? "new"}`}
            name="accountId"
            defaultValue={template?.accountId ?? accounts[0]?.id ?? ""}
            className="mt-2 w-full"
            required
          >
            {accounts.map((account) => (
              <NativeSelectOption key={account.id} value={account.id}>
                {account.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`rec-destination-${template?.id ?? "new"}`}>Akun tujuan (transfer)</Label>
          <NativeSelect
            id={`rec-destination-${template?.id ?? "new"}`}
            name="destinationAccountId"
            defaultValue={template?.destinationAccountId ?? ""}
            className="mt-2 w-full"
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {accounts.map((account) => (
              <NativeSelectOption key={account.id} value={account.id}>
                {account.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`rec-category-${template?.id ?? "new"}`}>Kategori</Label>
          <NativeSelect
            id={`rec-category-${template?.id ?? "new"}`}
            name="categoryId"
            defaultValue={template?.categoryId ?? ""}
            className="mt-2 w-full"
          >
            <NativeSelectOption value="">Tanpa kategori</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`rec-frequency-${template?.id ?? "new"}`}>Frekuensi</Label>
          <NativeSelect
            id={`rec-frequency-${template?.id ?? "new"}`}
            name="frequency"
            defaultValue={template?.frequency ?? "MONTHLY"}
            className="mt-2 w-full"
            required
          >
            <NativeSelectOption value="DAILY">Harian</NativeSelectOption>
            <NativeSelectOption value="WEEKLY">Mingguan</NativeSelectOption>
            <NativeSelectOption value="MONTHLY">Bulanan</NativeSelectOption>
            <NativeSelectOption value="YEARLY">Tahunan</NativeSelectOption>
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`rec-dayofmonth-${template?.id ?? "new"}`}>Hari (bulan)</Label>
          <Input
            id={`rec-dayofmonth-${template?.id ?? "new"}`}
            name="dayOfMonth"
            defaultValue={template?.dayOfMonth ?? ""}
            inputMode="numeric"
            placeholder="1-31"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor={`rec-start-${template?.id ?? "new"}`}>Mulai (YYYY-MM-DD)</Label>
          <Input
            id={`rec-start-${template?.id ?? "new"}`}
            name="startDate"
            type="date"
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`rec-merchant-${template?.id ?? "new"}`}>Toko / penerima</Label>
        <Input
          id={`rec-merchant-${template?.id ?? "new"}`}
          name="merchant"
          defaultValue={template?.merchant ?? ""}
          className="mt-2"
        />
      </div>

      <div>
        <Label htmlFor={`rec-note-${template?.id ?? "new"}`}>Catatan</Label>
        <Textarea
          id={`rec-note-${template?.id ?? "new"}`}
          name="note"
          defaultValue={template?.note ?? ""}
          maxLength={1000}
          className="mt-2"
        />
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Template tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">
        {template === undefined ? "Buat template" : "Simpan template"}
      </SubmitButton>
    </form>
  );
}

export function RunRecurringButton() {
  return (
    <form action={runRecurringAction}>
      <SubmitButton size="sm" variant="outline" pendingLabel="Menjalankan…">
        Buat draf yang jatuh tempo
      </SubmitButton>
    </form>
  );
}

export function DeleteRecurringButton({ id }: { id: string }) {
  return (
    <form action={deleteRecurringAction}>
      <input type="hidden" name="recurringId" value={id} />
      <button
        type="submit"
        className="text-xs text-muted-foreground hover:text-destructive"
        onClick={(event) => {
          if (!window.confirm("Hapus template ini?")) event.preventDefault();
        }}
      >
        Hapus
      </button>
    </form>
  );
}

export interface RecurringDraftCard {
  id: string;
  templateType: "INCOME" | "EXPENSE" | "TRANSFER";
  runAt: string;
  amount: bigint;
  accountName: string;
  destinationAccountName: string | null;
  categoryName: string | null;
  note: string | null;
}

/** One staged occurrence, with the two decisions the owner can make. */
export function RecurringDraftRow({ draft }: { draft: RecurringDraftCard }) {
  const label =
    draft.templateType === "TRANSFER"
      ? `${draft.accountName} → ${draft.destinationAccountName ?? "—"}`
      : draft.accountName;

  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {formatMoney(draft.amount)} · {label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(draft.runAt).toLocaleDateString("id-ID")}
            {draft.categoryName === null ? "" : ` · ${draft.categoryName}`}
            {draft.note === null ? "" : ` · ${draft.note}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={confirmRecurringDraftAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <Button type="submit" size="sm">
              Konfirmasi
            </Button>
          </form>
          <form action={skipRecurringDraftAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <Button type="submit" size="sm" variant="outline">
              Lewati
            </Button>
          </form>
        </div>
      </div>
    </li>
  );
}
