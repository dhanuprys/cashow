"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { createAccountAction, updateAccountAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface AccountFormValues {
  id: string;
  name: string;
  type: string;
  openingBalance: string;
  currency: string;
}

const TYPES = [
  { value: "CASH", label: "Tunai" },
  { value: "BANK", label: "Bank" },
  { value: "EWALLET", label: "E-wallet" },
  { value: "INVESTMENT", label: "Investasi" },
] as const;

export function AccountForm({ account }: { account?: AccountFormValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    account === undefined ? createAccountAction : updateAccountAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {account === undefined ? null : <input type="hidden" name="accountId" value={account.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`account-name-${account?.id ?? "new"}`}>Nama akun</Label>
          <Input
            id={`account-name-${account?.id ?? "new"}`}
            name="name"
            defaultValue={account?.name ?? ""}
            maxLength={80}
            placeholder="Contoh: BCA, GoPay, Dompet"
            className="mt-2"
            required
          />
        </div>

        <div>
          <Label htmlFor={`account-type-${account?.id ?? "new"}`}>Jenis</Label>
          <NativeSelect
            id={`account-type-${account?.id ?? "new"}`}
            name="type"
            defaultValue={account?.type ?? "CASH"}
            className="mt-2 w-full"
          >
            {TYPES.map((type) => (
              <NativeSelectOption key={type.value} value={type.value}>
                {type.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor={`account-opening-${account?.id ?? "new"}`}>Saldo awal</Label>
          <Input
            id={`account-opening-${account?.id ?? "new"}`}
            name="openingBalance"
            defaultValue={account?.openingBalance ?? "0"}
            inputMode="numeric"
            placeholder="0"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor={`account-currency-${account?.id ?? "new"}`}>Mata uang</Label>
          <Input
            id={`account-currency-${account?.id ?? "new"}`}
            name="currency"
            defaultValue={account?.currency ?? "IDR"}
            maxLength={3}
            className="mt-2 uppercase"
          />
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Akun tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">{account === undefined ? "Tambah akun" : "Simpan akun"}</SubmitButton>
    </form>
  );
}
