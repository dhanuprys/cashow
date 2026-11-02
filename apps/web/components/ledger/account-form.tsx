"use client";

import { SUPPORTED_CURRENCIES } from "@cashow/domain";
import { useActionState, useEffect } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
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

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: "Tersimpan", description: state.message ?? "Perubahan tersimpan." });
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {account === undefined ? null : <input type="hidden" name="accountId" value={account.id} />}

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`account-name-${account?.id ?? "new"}`}>Nama akun</FieldLabel>
          <Input
            id={`account-name-${account?.id ?? "new"}`}
            name="name"
            defaultValue={account?.name ?? ""}
            maxLength={80}
            placeholder="Contoh: BCA, GoPay, Dompet"
            className="mt-2"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`account-type-${account?.id ?? "new"}`}>Jenis</FieldLabel>
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
        </Field>

        <Field>
          <FieldLabel htmlFor={`account-opening-${account?.id ?? "new"}`}>Saldo awal</FieldLabel>
          <CurrencyInput
            id={`account-opening-${account?.id ?? "new"}`}
            name="openingBalance"
            defaultValue={account?.openingBalance ?? "0"}
            placeholder="0"
            className="mt-2"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`account-currency-${account?.id ?? "new"}`}>Mata uang</FieldLabel>
          <NativeSelect
            id={`account-currency-${account?.id ?? "new"}`}
            name="currency"
            defaultValue={account?.currency ?? "IDR"}
            className="mt-2 w-full"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </FieldGroup>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Akun tersimpan.</p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton size="sm" className="w-full sm:w-auto">
          {account === undefined ? "Tambah akun" : "Simpan akun"}
        </SubmitButton>
      </div>
    </form>
  );
}
