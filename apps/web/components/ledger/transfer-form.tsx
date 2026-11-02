"use client";

import { formatAmount, parseMoney } from "@cashow/domain";
import { useActionState, useEffect, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { createTransferAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { useClientId } from "@/lib/use-client-id";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./submit-button";

export interface TransferAccountOption {
  id: string;
  name: string;
}

export interface TransferCategoryOption {
  id: string;
  name: string;
}

/**
 * A transfer moves money between the owner's own accounts. Any fee is a
 * separate expense on the source account, so the source falls by
 * `amount + fee` and the destination rises by `amount`.
 */
export function TransferForm({
  accounts,
  categories,
  defaultOccurredAtLocal,
  timezone,
}: {
  accounts: TransferAccountOption[];
  categories: TransferCategoryOption[];
  defaultOccurredAtLocal: string;
  timezone: string;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(
    accounts.find((account) => account.id !== (accounts[0]?.id ?? ""))?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [requestId] = useClientId();
  const [state, formAction] = useActionState<ActionState, FormData>(
    createTransferAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: "Tersimpan", description: state.message ?? "Perubahan tersimpan." });
  }, [state]);

  const amountValue = parseMoney(amount) ?? 0n;
  const feeValue = parseMoney(feeAmount) ?? 0n;
  const totalOut = amountValue + feeValue;
  const sameAccount = accountId !== "" && accountId === destinationAccountId;

  function changeSource(next: string) {
    setAccountId(next);
    if (next === destinationAccountId) {
      const fallback = accounts.find((account) => account.id !== next);
      setDestinationAccountId(fallback?.id ?? "");
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="clientRequestId" value={requestId} />

      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="transfer-amount">Jumlah dipindahkan</FieldLabel>
          <CurrencyInput
            id="transfer-amount"
            name="amount"
            value={amount}
            onValueChange={setAmount}
            placeholder="2jt atau 2.000.000"
            className="mt-2 h-12 text-lg"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="transfer-source">Dari akun</FieldLabel>
          <NativeSelect
            id="transfer-source"
            name="accountId"
            value={accountId}
            onChange={(event) => changeSource(event.target.value)}
            className="mt-2 w-full"
            required
          >
            <NativeSelectOption value="">Pilih akun asal</NativeSelectOption>
            {accounts.map((account) => (
              <NativeSelectOption key={account.id} value={account.id}>
                {account.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="transfer-destination">Ke akun</FieldLabel>
          <NativeSelect
            id="transfer-destination"
            name="destinationAccountId"
            value={destinationAccountId}
            onChange={(event) => setDestinationAccountId(event.target.value)}
            className="mt-2 w-full"
            required
            aria-invalid={sameAccount}
          >
            <NativeSelectOption value="">Pilih akun tujuan</NativeSelectOption>
            {accounts
              .filter((account) => account.id !== accountId)
              .map((account) => (
                <NativeSelectOption key={account.id} value={account.id}>
                  {account.name}
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {sameAccount ? (
            <p className="mt-1.5 text-xs text-destructive">Akun asal dan tujuan harus berbeda.</p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="transfer-fee">
            Biaya transfer <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <CurrencyInput
            id="transfer-fee"
            name="feeAmount"
            value={feeAmount}
            onValueChange={setFeeAmount}
            placeholder="5rb atau 6.500"
            className="mt-2"
          />
          <FieldDescription>Dicatat sebagai pengeluaran terpisah di akun asal.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="transfer-fee-category">
            Kategori biaya <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <NativeSelect
            id="transfer-fee-category"
            name="feeCategoryId"
            defaultValue=""
            className="mt-2 w-full"
          >
            <NativeSelectOption value="">Biaya Transfer</NativeSelectOption>
            {categories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="transfer-at">Tanggal &amp; waktu</FieldLabel>
          <Input
            id="transfer-at"
            name="occurredAtLocal"
            type="datetime-local"
            defaultValue={defaultOccurredAtLocal}
            className="mt-2"
            required
          />
          <FieldDescription>Zona waktu {timezone}</FieldDescription>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="transfer-note">
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id="transfer-note"
            name="note"
            maxLength={1000}
            placeholder="Contoh: pindah dana ke rekening harian"
            className="mt-2"
          />
        </Field>
      </FieldGroup>

      <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Akun asal berkurang</span>
          <span className="font-semibold tabular-nums">{formatAmount(totalOut)}</span>
        </p>
        <p className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">Akun tujuan bertambah</span>
          <span className="font-semibold tabular-nums">{formatAmount(amountValue)}</span>
        </p>
        {feeValue > 0n ? (
          <p className={cn("mt-1 text-xs text-muted-foreground")}>
            Termasuk biaya {formatAmount(feeValue)} yang tercatat sebagai pengeluaran.
          </p>
        ) : null}
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton className="w-full" size="lg" pendingLabel="Memindahkan…">
          Simpan transfer
        </SubmitButton>
      </div>
    </form>
  );
}
