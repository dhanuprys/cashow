"use client";

import { formatAmount, parseMoney } from "@cashow/domain";
import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createTransferAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
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
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, formAction] = useActionState<ActionState, FormData>(
    createTransferAction,
    initialActionState,
  );

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

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="transfer-amount">Jumlah dipindahkan</Label>
          <Input
            id="transfer-amount"
            name="amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="2jt"
            className="mt-2 h-12 text-lg"
            required
          />
        </div>

        <div>
          <Label htmlFor="transfer-source">Dari akun</Label>
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
        </div>

        <div>
          <Label htmlFor="transfer-destination">Ke akun</Label>
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
        </div>

        <div>
          <Label htmlFor="transfer-fee">
            Biaya transfer <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Input
            id="transfer-fee"
            name="feeAmount"
            value={feeAmount}
            onChange={(event) => setFeeAmount(event.target.value)}
            inputMode="numeric"
            placeholder="5rb"
            className="mt-2"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Dicatat sebagai pengeluaran terpisah di akun asal.
          </p>
        </div>

        <div>
          <Label htmlFor="transfer-fee-category">
            Kategori biaya <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
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
        </div>

        <div>
          <Label htmlFor="transfer-at">Tanggal &amp; waktu</Label>
          <Input
            id="transfer-at"
            name="occurredAtLocal"
            type="datetime-local"
            defaultValue={defaultOccurredAtLocal}
            className="mt-2"
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Zona waktu {timezone}</p>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="transfer-note">
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Textarea
            id="transfer-note"
            name="note"
            maxLength={1000}
            placeholder="Contoh: pindah dana ke rekening harian"
            className="mt-2"
          />
        </div>
      </div>

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

      <SubmitButton className="w-full" size="lg" pendingLabel="Memindahkan…">
        Simpan transfer
      </SubmitButton>
    </form>
  );
}
