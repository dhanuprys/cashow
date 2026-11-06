"use client";

import { formatMoney } from "@cashow/domain";
import { Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { DatePicker } from "@/components/ledger/date-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  confirmRecurringDraftAction,
  createRecurringAction,
  deleteRecurringAction,
  runRecurringAction,
  skipRecurringDraftAction,
  toggleRecurringActiveAction,
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
  onSuccess,
}: {
  accounts: RecurringFormAccount[];
  categories: RecurringFormCategory[];
  template?: RecurringFormValues;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    template === undefined ? createRecurringAction : updateRecurringAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: "Tersimpan", description: state.message ?? "Perubahan tersimpan." });
    onSuccess?.();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {template === undefined ? null : (
        <input type="hidden" name="recurringId" value={template.id} />
      )}

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`rec-type-${template?.id ?? "new"}`}>Jenis</FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-amount-${template?.id ?? "new"}`}>Jumlah</FieldLabel>
          <CurrencyInput
            id={`rec-amount-${template?.id ?? "new"}`}
            name="amount"
            defaultValue={template?.amount ?? ""}
            placeholder="500rb atau 500.000"
            className="mt-2"
            presets={["50000", "100000", "250000", "500000", "1000000"]}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-account-${template?.id ?? "new"}`}>Akun asal</FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-destination-${template?.id ?? "new"}`}>
            Akun tujuan <span className="font-normal text-muted-foreground">(transfer)</span>
          </FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-category-${template?.id ?? "new"}`}>Kategori</FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-frequency-${template?.id ?? "new"}`}>Frekuensi</FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-dayofmonth-${template?.id ?? "new"}`}>Hari (bulan)</FieldLabel>
          <Input
            id={`rec-dayofmonth-${template?.id ?? "new"}`}
            name="dayOfMonth"
            defaultValue={template?.dayOfMonth ?? ""}
            inputMode="numeric"
            placeholder="1-31"
            className="mt-2"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`rec-start-${template?.id ?? "new"}`}>Mulai (YYYY-MM-DD)</FieldLabel>
          <DatePicker
            id={`rec-start-${template?.id ?? "new"}`}
            name="startDate"
            ariaLabel="Tanggal mulai"
            className="mt-2"
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`rec-merchant-${template?.id ?? "new"}`}>Toko / penerima</FieldLabel>
          <Input
            id={`rec-merchant-${template?.id ?? "new"}`}
            name="merchant"
            defaultValue={template?.merchant ?? ""}
            className="mt-2"
          />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`rec-note-${template?.id ?? "new"}`}>
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id={`rec-note-${template?.id ?? "new"}`}
            name="note"
            defaultValue={template?.note ?? ""}
            maxLength={1000}
            className="mt-2"
            placeholder="Catatan singkat"
          />
        </Field>
      </FieldGroup>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Template tersimpan.</p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton size="sm" className="w-full sm:w-auto">
          {template === undefined ? "Buat template" : "Simpan template"}
        </SubmitButton>
      </div>
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

export function EditRecurringDialog({
  template,
  accounts,
  categories,
}: {
  template: RecurringFormValues;
  accounts: RecurringFormAccount[];
  categories: RecurringFormCategory[];
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
              <span>Ubah Template Berulang</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sesuaikan nominal, jadwal, akun, atau kategori transaksi.
            </DialogDescription>
          </DialogHeader>

          <RecurringForm
            key={template.id}
            template={template}
            accounts={accounts}
            categories={categories}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ToggleRecurringActiveButton({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={toggleRecurringActiveAction}>
      <input type="hidden" name="recurringId" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-8 px-2 text-xs"
        title={active ? "Jeda template" : "Aktifkan template"}
      >
        {active ? "Jeda" : "Aktifkan"}
      </Button>
    </form>
  );
}

export function DeleteRecurringButton({ id }: { id: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  return (
    <>
      <form ref={formRef} action={deleteRecurringAction}>
        <input type="hidden" name="recurringId" value={id} />
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
            <AlertDialogTitle>Hapus template ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Template yang dihapus tidak lagi membuat draf baru. Riwayat transaksi yang sudah
              tercatat tetap ada.
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
